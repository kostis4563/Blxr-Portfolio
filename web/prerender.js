import { readFile, writeFile, rm, mkdir, readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, 'dist')
const ssrEntry = resolve(here, 'dist-ssr/entry-server.js')
const indexPath = resolve(dist, 'index.html')

const ROOT_RE = /<div id="?root"?>\s*<\/div>/

const TITLE_RE = /<title>[\s\S]*?<\/title>/

const HTML_RE = /<html[^>]*>/

const EMAIL_OFF = '<!--email_off-->'
const EMAIL_ON = '<!--email_on-->'

const {
  render,
  staticPaths,
  metaFor,
  lastmodFor,
  parseRoute,
  NOT_FOUND_PATH,
  LOGIN_PATH,
  DASHBOARD_PATH,
  PROFILE_BASE_PATH,
  PROFILE_SHELL_FILE,
} = await import(pathToFileURL(ssrEntry).href)

const template = await readFile(indexPath, 'utf8')
if (!ROOT_RE.test(template)) {
  throw new Error(
    `prerender: could not find an empty <div id="root"></div> in ${indexPath}. ` +
      'Did the client build run first, or did the markup change?',
  )
}
if (!TITLE_RE.test(template)) {
  throw new Error(`prerender: no <title> to replace in ${indexPath}.`)
}

function outputFileFor(path) {
  if (path === '/') return indexPath
  if (path === PROFILE_BASE_PATH) return resolve(dist, PROFILE_SHELL_FILE)

  return resolve(dist, `${path.replace(/^\//, '')}.html`)
}

const pages = [...staticPaths(), NOT_FOUND_PATH, LOGIN_PATH, DASHBOARD_PATH, PROFILE_BASE_PATH]
const written = []

for (const path of pages) {
  const { html, head } = await render(path)
  const out = template
    .replace(HTML_RE, () => '<html lang="en" dir="ltr">')
    .replace(TITLE_RE, () => head)
    .replace(ROOT_RE, () => `${EMAIL_OFF}<div id="root">${html}</div>${EMAIL_ON}`)

  const file = outputFileFor(path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, out)
  written.push({ path, file, bytes: out.length })
}

const templateHead = template.slice(0, template.indexOf('</head>'))
const linksOf = (pattern, format) =>
  [...templateHead.matchAll(pattern)].map(([, href]) => format(href))

const hints = [
  ...linksOf(
    /<link rel="stylesheet"[^>]*href="([^"]+)"/g,
    (href) => `<${href}>; rel=preload; as=style; crossorigin=anonymous`,
  ),
  ...linksOf(
    /<link rel="preload"[^>]*href="([^"]+\.woff2)"[^>]*>/g,
    (href) => `<${href}>; rel=preload; as=font; type="font/woff2"; crossorigin=anonymous`,
  ),
  ...linksOf(
    /<script type="module"[^>]*src="([^"]+)"/g,
    (href) => `<${href}>; rel=modulepreload; crossorigin=anonymous`,
  ),
  ...linksOf(
    /<link rel="modulepreload"[^>]*href="([^"]+)"/g,
    (href) => `<${href}>; rel=modulepreload; crossorigin=anonymous`,
  ),
]

await writeFile(
  resolve(here, 'early-hints.conf'),
  `${hints.map((value) => `add_header Link "${value.replace(/"/g, '\\"')}" always;`).join('\n')}
`,
)
console.log(`prerender: ${hints.length} early-hint links -> early-hints.conf`)

const SITE_URL = 'https://blxr.net'
const buildDate = new Date().toISOString().slice(0, 10)
const indexable = staticPaths().filter((path) => !metaFor(path).noindex)

const exec = promisify(execFile)
const SHARED_SOURCES = ['src/lib/seo.js', 'src/root.jsx']
const ROUTE_SOURCES = {
  home: ['src/app.jsx', 'src/components', 'src/lib/projects.js', 'src/lib/skills.js'],
  projects: ['src/projects-page.jsx', 'src/lib/projects.js', 'src/components/project-cover.jsx'],
  library: ['src/library-page.jsx', 'src/lib/library.js'],
  reviews: ['src/reviews-page.jsx'],
}

const repo = resolve(here, '..')
const git = (...args) =>
  exec('git', ['-c', `safe.directory=${repo}`, ...args], { cwd: here }).then(({ stdout }) => stdout.trim())

async function gitDate(files) {
  try {
    if ((await git('rev-parse', '--is-shallow-repository')) === 'true') return null
    const date = await git('log', '-1', '--format=%cs', '--', ...files)
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
  } catch {
    return null
  }
}

const routeDates = new Map()
for (const [name, files] of Object.entries(ROUTE_SOURCES)) {
  routeDates.set(name, await gitDate([...files, ...SHARED_SOURCES]))
}
const fromGit = [...routeDates.values()].some(Boolean)
if (!fromGit) {
  console.warn('prerender: no git history for lastmod, using the build date (shallow clone?)')
}

const lastmodForPath = (path) =>
  lastmodFor(path) || routeDates.get(parseRoute(metaFor(path).route).name) || buildDate

const priorityFor = (path) => (metaFor(path).route === '/' ? '1.0' : '0.8')
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...indexable.map(
    (path) =>
      `  <url><loc>${SITE_URL}${path}</loc><lastmod>${lastmodForPath(path)}</lastmod>` +
      `<priority>${priorityFor(path)}</priority></url>`,
  ),
  '</urlset>',
  '',
].join('\n')
await writeFile(join(dist, 'sitemap.xml'), sitemap)

const EXECUTABLE_TYPE_RE = /^(module|(text|application)\/(javascript|ecmascript))?$/i

const hashes = new Set()
for (const name of await readdir(dist, { recursive: true })) {
  if (!name.endsWith('.html')) continue
  const html = await readFile(join(dist, name), 'utf8')

  for (const [, attrs, body] of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    const type = (/\btype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1] || '').trim()
    if (!EXECUTABLE_TYPE_RE.test(type)) continue
    hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`)
  }
}

await writeFile(join(here, 'csp-script-hashes.txt'), [...hashes].join(' '))

await rm(resolve(here, 'dist-ssr'), { recursive: true, force: true })

const kb = (n) => `${Math.round(n / 1024)} KB`
for (const { path, file, bytes } of written) {
  console.log(`prerender: ${path.padEnd(20)} -> ${file.replace(`${dist}/`, '')} (${bytes} bytes)`)
}
console.log(
  `prerender: ${written.length} files, ${kb(written.reduce((sum, page) => sum + page.bytes, 0))} of HTML`,
)
console.log(
  `prerender: ${indexable.length} urls -> sitemap.xml` +
    (staticPaths().length - indexable.length
      ? ` (${staticPaths().length - indexable.length} noindex, omitted)`
      : '') +
    (fromGit ? `, lastmod from git` : ''),
)
console.log(`prerender: ${hashes.size} inline-script hashes -> csp-script-hashes.txt`)
