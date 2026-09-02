import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, 'public')

const W = 1200
const H = 630

const BG = '#0a0a0a'
const LINE = '#262626'
const PURPLE = '#8b5cf6'

const COLUMN = 768
const railLeft = (W - COLUMN) / 2
const railRight = railLeft + COLUMN

const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="${PURPLE}" stop-opacity="0.16" />
      <stop offset="100%" stop-color="${PURPLE}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}" />
  <rect width="${W}" height="${H}" fill="url(#glow)" />
  <line x1="${railLeft}" y1="0" x2="${railLeft}" y2="${H}"
        stroke="${LINE}" stroke-width="1" stroke-dasharray="6 6" />
  <line x1="${railRight}" y1="0" x2="${railRight}" y2="${H}"
        stroke="${LINE}" stroke-width="1" stroke-dasharray="6 6" />
  <text x="${W / 2}" y="${H - 74}" text-anchor="middle"
        font-family="Plus Jakarta Sans, DejaVu Sans, sans-serif"
        font-size="26" font-weight="600" letter-spacing="6"
        fill="#737373">blxr.net</text>
</svg>`)

const mark = await sharp(await readFile(resolve(pub, 'favicon-wordmark.png')))
  .trim()
  .resize({ width: 620, fit: 'inside' })
  .toBuffer()

const { height: markHeight } = await sharp(mark).metadata()

const png = await sharp(background)
  .composite([{ input: mark, left: Math.round((W - 620) / 2), top: Math.round(H / 2 - markHeight / 2 - 30) }])
  .png({ compressionLevel: 9, palette: true })
  .toBuffer()

await writeFile(resolve(pub, 'og.png'), png)

const { width, height } = await sharp(png).metadata()
console.log(`make-og-image: public/og.png ${width}x${height}, ${(png.length / 1024).toFixed(0)} KB`)
