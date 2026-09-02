import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, basename } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = resolve(here, 'public/icons')
const appFile = resolve(here, 'src/app.jsx')

const source = await readFile(appFile, 'utf8')
const urls = [...new Set([...source.matchAll(/https:\/\/svgl\.app\/library\/[\w.-]+\.svg/g)].map((m) => m[0]))]

if (!urls.length) {
  console.log('fetch-icons: no svgl.app URLs left in src/app.jsx — nothing to do.')
  process.exit(0)
}

await mkdir(iconsDir, { recursive: true })

let bytes = 0
for (const url of urls) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const svg = await res.text()

  if (!svg.trimStart().startsWith('<svg') && !svg.trimStart().startsWith('<?xml')) {
    throw new Error(`${url} did not return SVG`)
  }
  await writeFile(resolve(iconsDir, basename(url)), svg)
  bytes += svg.length
  console.log(`  ${basename(url).padEnd(28)} ${(svg.length / 1024).toFixed(1)} KB`)
}

console.log(
  `fetch-icons: ${urls.length} marks, ${(bytes / 1024).toFixed(0)} KB -> public/icons/\n` +
    'Now point src/app.jsx at /icons/<file>.svg and drop svgl.app from the CSP img-src.',
)
