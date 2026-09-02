import { mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { translations } from './src/lib/i18n-tables.js'
import { LANG_CODES } from './src/lib/languages.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, 'src/lib/locales')

await mkdir(outDir, { recursive: true })

for (const file of await readdir(outDir).catch(() => [])) {
  if (file.endsWith('.js')) await rm(join(outDir, file))
}

let total = 0
for (const code of LANG_CODES) {
  const table = translations[code]
  if (!table) throw new Error(`build-locales: no table for '${code}' in i18n-tables.js`)

  const entries = Object.keys(table)
    .sort()
    .map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(table[key])},`)

  await writeFile(
    join(outDir, `${code}.js`),
    `export default {\n${entries.join('\n')}\n}\n`,
  )
  total += entries.length
}

console.log(
  `build-locales: ${LANG_CODES.length} locales, ${total} strings -> src/lib/locales/`,
)
