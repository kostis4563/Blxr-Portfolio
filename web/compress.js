import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { gzip, brotliCompress, constants as zlibConstants } from 'node:zlib'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, extname } from 'node:path'

const gzipAsync = promisify(gzip)
const brotliAsync = promisify(brotliCompress)

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, 'dist')

const COMPRESSIBLE = new Set([
  '.html', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt', '.webmanifest', '.map',
])

const MIN_BYTES = 512

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile()) yield full
  }
}

let files = 0
let rawTotal = 0
let gzTotal = 0
let brTotal = 0
let brFiles = 0

async function compressFile(file) {
  const { size } = await stat(file)
  if (size < MIN_BYTES) return

  const raw = await readFile(file)
  const gz = await gzipAsync(raw, { level: 9 })

  if (gz.length >= raw.length) return

  await writeFile(`${file}.gz`, gz)
  files += 1
  rawTotal += raw.length
  gzTotal += gz.length

  const br = await brotliAsync(raw, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: zlibConstants.BROTLI_MAX_QUALITY,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  })
  if (br.length < gz.length) {
    await writeFile(`${file}.br`, br)
    brFiles += 1
    brTotal += br.length
  } else {

    brTotal += gz.length
  }
}

const queue = []
for await (const file of walk(dist)) {
  if (COMPRESSIBLE.has(extname(file))) queue.push(file)
}

const CONCURRENCY = Math.max(2, availableParallelism())
let cursor = 0
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (cursor < queue.length) await compressFile(queue[cursor++])
  }),
)

const kb = (n) => `${(n / 1024).toFixed(0)} KB`
const pct = (n) => `${((1 - n / rawTotal) * 100).toFixed(0)}%`
console.log(
  `compress: ${files} files, ${kb(rawTotal)} raw -> ` +
    `${kb(gzTotal)} gzip (${pct(gzTotal)} smaller), ` +
    `${kb(brTotal)} brotli across ${brFiles} .br (${pct(brTotal)} smaller)`,
)
