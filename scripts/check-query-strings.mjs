import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['web/src', 'server/src']
const EXT = /\.(m?js|jsx|ts|tsx)$/
const BAD = /\.(or|filter|textSearch)\(\s*[`'"]/g

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (EXT.test(name)) yield path
  }
}

const hits = []
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (BAD.test(line)) hits.push(`${relative('.', file)}:${index + 1}: ${line.trim()}`)
      BAD.lastIndex = 0
    })
  }
}

if (hits.length) {
  console.error('String-built PostgREST filters are not allowed — use the typed builders (.eq/.in/.is/...):\n')
  for (const hit of hits) console.error('  ' + hit)
  process.exit(1)
}
