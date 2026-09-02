import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, extname, basename } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, 'public')

const COVER_Q = 78
const LOGO_Q = 82

const TARGETS = [

  { glob: /^(async|amitista|delivo)\.webp$/, widths: [480, 768, 1200], quality: COVER_Q },
  { dir: 'library', glob: /\.webp$/, widths: [480, 768, 1200], quality: COVER_Q },

  { glob: /^banner-(chrome|crystal)\.webp$/, widths: [480, 768, 1600], quality: COVER_Q },

  { glob: /^pfp\.webp$/, widths: [128, 192], quality: LOGO_Q },

  { glob: /^(async|amitista|delivo)-logo\.webp$/, widths: [48, 96], quality: LOGO_Q },

  { glob: /^hand-(left|right)\.webp$/, widths: [300], quality: 80 },
]

const bytes = (n) => `${(n / 1024).toFixed(1)} KB`

async function publicImages() {
  const out = []
  for (const entry of await readdir(pub, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const child of await readdir(join(pub, entry.name))) {
        out.push({ url: `/${entry.name}/${child}`, dir: entry.name, name: child })
      }
    } else {
      out.push({ url: `/${entry.name}`, dir: '', name: entry.name })
    }
  }
  return out
}

const VARIANT_SUFFIX = /-\d+\.(webp|png)$/

const targetFor = (image) =>
  VARIANT_SUFFIX.test(image.name)
    ? undefined
    : TARGETS.find((t) => (t.dir ?? '') === image.dir && t.glob.test(image.name))

const manifest = {}
let savedTotal = 0
let wroteTotal = 0

for (const image of await publicImages()) {
  const target = targetFor(image)
  if (!target) continue

  const file = join(pub, image.dir, image.name)
  const source = await readFile(file)
  const meta = await sharp(source).metadata()
  const stem = basename(image.name, extname(image.name))
  const ext = target.format ? `.${target.format}` : extname(image.name)

  const widths = target.widths.filter((w) => w <= meta.width)
  const written = []

  for (const width of widths) {
    const out = join(pub, image.dir, `${stem}-${width}${ext}`)
    const pipeline = sharp(source).resize({ width, withoutEnlargement: true })
    const encoded = await (target.lossless
      ? pipeline.webp({ lossless: true, effort: 6 })
      : pipeline.webp({ quality: target.quality, effort: 6 })
    ).toBuffer()
    await writeFile(out, encoded)
    written.push({ width, size: encoded.length })
    wroteTotal += encoded.length
  }

  const largest = written[written.length - 1]
  savedTotal += source.length - (largest?.size ?? source.length)

  manifest[image.url] = {
    v: createHash('sha256').update(source).digest('hex').slice(0, 8),
    ext,
    widths: written.map((w) => w.width),
  }

  console.log(
    `${image.url.padEnd(40)} ${meta.width}x${meta.height} ${bytes(source.length).padStart(9)}` +
      ` -> ${written.map((w) => `${w.width}w ${bytes(w.size)}`).join(', ')}`,
  )
}

for (const image of await publicImages()) {
  if (manifest[image.url] || VARIANT_SUFFIX.test(image.name)) continue
  if (!/\.(webp|png|jpe?g|svg|gif|avif)$/.test(image.name)) continue
  const source = await readFile(join(pub, image.dir, image.name))
  manifest[image.url] = {
    v: createHash('sha256').update(source).digest('hex').slice(0, 8),
    ext: extname(image.name),
    widths: [],
  }
}

const entries = Object.keys(manifest)
  .sort()
  .map((url) => {
    const { v, ext, widths } = manifest[url]
    return `  '${url}': { v: '${v}', ext: '${ext}', widths: [${widths.join(', ')}] },`
  })

await writeFile(
  resolve(here, 'src/lib/image-manifest.js'),
  `export const IMAGES = {
${entries.join('\n')}
}
`,
)

console.log(
  `\n${Object.values(manifest).filter((m) => m.widths.length).length} images -> ` +
    `${bytes(wroteTotal)} of variants written; ` +
    `${bytes(savedTotal)} saved at full width alone, and far more at the widths a phone picks.`,
)
console.log(`manifest: ${entries.length} entries -> src/lib/image-manifest.js`)
