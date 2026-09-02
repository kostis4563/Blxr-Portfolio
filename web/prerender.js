import { readFile, writeFile, rm, mkdir, readdir } from 'node:fs/promises'
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

const { render, localizedPaths, metaFor, NOT_FOUND_PATH } = await import(
  pathToFileURL(ssrEntry).href
)

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

  return resolve(dist, `${path.replace(/^\//, '')}.html`)
}

const LOCALE_CHUNK_RE = /^([a-z]{2})-[A-Za-z0-9_-]+\.js$/
const localeChunks = new Map()
for (const name of await readdir(resolve(dist, 'assets'))) {
  const match = LOCALE_CHUNK_RE.exec(name)
  if (match) localeChunks.set(match[1], `/assets/${name}`)
}

function localePreloadFor(lang) {
  const href = localeChunks.get(lang)
  return href ? `<link rel="modulepreload" crossorigin href="${href}">` : ''
}

const pages = [...localizedPaths(), NOT_FOUND_PATH]
const written = []

for (const path of pages) {
  const { html, head, lang, dir } = await render(path)
  const out = template
    .replace(HTML_RE, () => `<html lang="${lang}" dir="${dir}">`)
    .replace(TITLE_RE, () => head)
    .replace('</head>', () => `${localePreloadFor(lang)}</head>`)
    .replace(ROOT_RE, () => `${EMAIL_OFF}<div id="root">${html}</div>${EMAIL_ON}`)

  const file = outputFileFor(path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, out)
  written.push({ path, file, lang, bytes: out.length })
}

const templateHead = template.slice(0, template.indexOf('</head>'))
const linksOf = (pattern, format) =>
  [...templateHead.matchAll(pattern)].map(([, href]) => format(href))

const hints = [
  ...linksOf(/<link rel="stylesheet"[^>]*href="([^"]+)"/g, (href) => `<${href}>; rel=preload; as=style`),
  ...linksOf(
    /<link rel="preload"[^>]*href="([^"]+\.woff2)"[^>]*>/g,
    (href) => `<${href}>; rel=preload; as=font; type="font/woff2"; crossorigin`,
  ),
  ...linksOf(/<script type="module"[^>]*src="([^"]+)"/g, (href) => `<${href}>; rel=modulepreload; crossorigin`),
  ...linksOf(/<link rel="modulepreload"[^>]*href="([^"]+)"/g, (href) => `<${href}>; rel=modulepreload; crossorigin`),
]

await writeFile(
  resolve(here, 'early-hints.conf'),
  `${hints.map((value) => `add_header Link "${value.replace(/"/g, '\\"')}" always;`).join('\n')}
`,
)
console.log(`prerender: ${hints.length} early-hint links -> early-hints.conf`)

const SITE_URL = 'https://blxr.net'
const lastmod = new Date().toISOString().slice(0, 10)
const indexable = localizedPaths().filter((path) => !metaFor(path).noindex)

const priorityFor = (path) => {
  const { lang, route } = metaFor(path)
  if (lang === 'en') return route === '/' ? '1.0' : '0.8'
  return route === '/' ? '0.7' : '0.5'
}
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...indexable.map(
    (path) =>
      `  <url><loc>${SITE_URL}${path}</loc><lastmod>${lastmod}</lastmod>` +
      `<priority>${priorityFor(path)}</priority></url>`,
  ),
  '</urlset>',
  '',
].join('\n')
await writeFile(join(dist, 'sitemap.xml'), sitemap)

const hashes = new Set()
for (const name of await readdir(dist, { recursive: true })) {
  if (!name.endsWith('.html')) continue
  const html = await readFile(join(dist, name), 'utf8')

  for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`)
  }
}

await writeFile(join(here, 'csp-script-hashes.txt'), [...hashes].join(' '))

await rm(resolve(here, 'dist-ssr'), { recursive: true, force: true })

const kb = (n) => `${Math.round(n / 1024)} KB`
for (const { path, file, lang, bytes } of written) {
  if (lang !== 'en') continue
  console.log(`prerender: ${path.padEnd(20)} -> ${file.replace(`${dist}/`, '')} (${bytes} bytes)`)
}
const byLang = new Map()
for (const page of written) {
  const entry = byLang.get(page.lang) || { pages: 0, bytes: 0 }
  entry.pages += 1
  entry.bytes += page.bytes
  byLang.set(page.lang, entry)
}
const translated = [...byLang].filter(([lang]) => lang !== 'en')
for (const [lang, { pages: count, bytes }] of translated) {
  console.log(`prerender: ${lang.padEnd(20)} -> ${String(count).padStart(2)} pages, ${kb(bytes)}`)
}
console.log(
  `prerender: ${written.length} files across ${byLang.size} languages, ${kb(
    written.reduce((sum, page) => sum + page.bytes, 0),
  )} of HTML`,
)
console.log(
  `prerender: ${indexable.length} urls -> sitemap.xml` +
    (localizedPaths().length - indexable.length
      ? ` (${localizedPaths().length - indexable.length} noindex, omitted)`
      : ''),
)
console.log(`prerender: ${hashes.size} inline-script hashes -> csp-script-hashes.txt`)
