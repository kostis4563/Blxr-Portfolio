import { readFile } from 'node:fs/promises'

const file = process.argv[2] || 'web/coverage/coverage-summary.json'
const { total } = JSON.parse(await readFile(file, 'utf8'))

const rows = ['lines', 'statements', 'functions', 'branches'].map((k) => `| ${k} | ${total[k].pct}% | ${total[k].covered} / ${total[k].total} |`)
console.log(['### Web unit test coverage', '', '| | covered | |', '|---|---|---|', ...rows].join('\n'))
