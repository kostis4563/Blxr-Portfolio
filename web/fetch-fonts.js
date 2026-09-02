import { mkdir, writeFile, stat, rename, readFile, readdir, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const CSS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800' +
  '&family=Playfair+Display:ital,wght@1,400;1,600;1,700' +
  '&display=swap'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const KEEP = new Set(['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'vietnamese'])

const PINNED_TEXT = {
  'Playfair Display': "LET'S BUILD",
}

const PYFTSUBSET = process.env.PYFTSUBSET || 'pyftsubset'

const cp = (s) => `U+${s.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`

function subsetInPlace(path, text, label) {
  const unicodes = [...new Set([...text])].map(cp).sort()
  try {
    execFileSync(
      PYFTSUBSET,
      [
        path,
        `--unicodes=${unicodes.join(',')}`,
        '--flavor=woff2',
        "--layout-features=''",
        `--output-file=${path}`,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    return unicodes.join(', ')
  } catch (err) {

    throw new Error(
      `could not subset ${label} with '${PYFTSUBSET}'.\n` +
        `Install it with:  pip install fonttools brotli\n` +
        `or point PYFTSUBSET at one.\nUnderlying error: ${err.message}`,
    )
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const fontsDir = resolve(here, 'public/fonts')
const cssOut = resolve(here, 'src/fonts.css')

const res = await fetch(CSS_URL, { headers: { 'User-Agent': UA } })
if (!res.ok) throw new Error(`Google Fonts CSS -> HTTP ${res.status}`)
const css = await res.text()

const BLOCK_RE = /\/\* ([a-z-]+) \*\/\s*(@font-face \{[^}]+\})/g

await mkdir(fontsDir, { recursive: true })

const rules = []
const downloaded = new Map()
let skipped = 0

const pinnedRanges = new Map()

for (const [, subset, rule] of css.matchAll(BLOCK_RE)) {
  const family = rule.match(/font-family: '([^']+)'/)[1]
  const pinned = PINNED_TEXT[family]

  if (pinned ? subset !== 'latin' : !KEEP.has(subset)) {
    skipped += 1
    continue
  }

  const weight = rule.match(/font-weight: ([^;]+)/)[1].trim()
  const style = rule.match(/font-style: ([^;]+)/)?.[1].trim() ?? 'normal'
  const range = rule.match(/unicode-range: ([^;]+)/)[1].trim()
  const url = rule.match(/src: url\(([^)]+)\)/)[1]

  let file = downloaded.get(url)
  if (!file) {

    const slug = family.toLowerCase().replace(/\s+/g, '-')
    file = `${slug}-${subset}${style === 'italic' ? '-italic' : ''}.woff2`
    const dest = resolve(fontsDir, file)
    const bin = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!bin.ok) throw new Error(`${url} -> HTTP ${bin.status}`)
    const bytes = Buffer.from(await bin.arrayBuffer())
    await writeFile(dest, bytes)
    downloaded.set(url, file)

    if (pinned) {
      const range = subsetInPlace(dest, pinned, file)

      const hash = createHash('sha256').update(await readFile(dest)).digest('hex').slice(0, 8)
      const hashed = file.replace(/\.woff2$/, `-${hash}.woff2`)
      await rename(dest, resolve(fontsDir, hashed))
      downloaded.set(url, hashed)

      const stale = new RegExp(`^${file.replace(/\.woff2$/, '')}-[0-9a-f]{8}\\.woff2$`)
      for (const name of await readdir(fontsDir)) {
        if (name !== hashed && (stale.test(name) || name === file)) {
          await unlink(resolve(fontsDir, name))
          console.log(`  removed stale ${name}`)
        }
      }

      const after = (await stat(resolve(fontsDir, hashed))).size
      pinnedRanges.set(hashed, range)
      file = hashed
      console.log(
        `  fetched ${file} -> subset to ${new Set(pinned).size} glyphs ` +
          `(${(bytes.length / 1024).toFixed(1)} KB -> ${(after / 1024).toFixed(1)} KB)`,
      )
    } else {
      console.log(`  fetched ${file}`)
    }
  }

  rules.push({ family, weight, style, range: pinnedRanges.get(file) ?? range, file })
}

const byFile = new Map()
for (const r of rules) {
  const key = `${r.file}|${r.style}`
  const seen = byFile.get(key)
  if (!seen) {
    byFile.set(key, { ...r, weights: [Number(r.weight)] })
  } else {
    seen.weights.push(Number(r.weight))
  }
}

const out = []

for (const r of byFile.values()) {
  const lo = Math.min(...r.weights)
  const hi = Math.max(...r.weights)
  out.push('@font-face {')
  out.push(`  font-family: '${r.family}';`)
  out.push(`  font-style: ${r.style};`)
  out.push(`  font-weight: ${lo === hi ? lo : `${lo} ${hi}`};`)
  out.push('  font-display: swap;')
  out.push(`  src: url('/fonts/${r.file}') format('woff2');`)
  out.push(`  unicode-range: ${r.range};`)
  out.push('}')
  out.push('')
}

await writeFile(cssOut, out.join('\n'))
console.log(
  `fetch-fonts: ${downloaded.size} files in public/fonts/, ` +
    `${byFile.size} @font-face rules -> src/fonts.css (${skipped} rules skipped as out-of-subset)`,
)
