import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => readFile(path.join(ROOT, p), 'utf8')

export const SECRET_PATTERNS = [
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{20,}/],
  ['Supabase service_role JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*cm9sZSI6InNlcnZpY2Vfcm9sZS[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|github_pat_[A-Za-z0-9_]{60,}/],
  ['Resend API key', /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}\b/],
  ['Discord bot token', /\b[MN][A-Za-z\d_-]{23,25}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}\b/],
  ['private key', /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
]

test('no tracked file contains a credential', async () => {
  const { stdout } = await exec('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 })
  const files = stdout.split('\0').filter((f) => f && !/\.(webp|png|jpe?g|gif|ico|mp3|mp4|woff2?|pdf)$|package-lock\.json$/.test(f))
  const hits = []
  for (const file of files) {
    let text
    try {
      text = await read(file)
    } catch {
      continue
    }
    for (const [label, re] of SECRET_PATTERNS) if (re.test(text)) hits.push(`${file}: ${label}`)
  }
  assert.deepEqual(hits, [])
})

test('.env files and deploy secrets are gitignored', async () => {
  for (const file of ['server/.env', 'web/.env', 'web/.env.local', 'deploy/.env-overrides', '.env']) {
    const { stdout } = await exec('git', ['check-ignore', '--no-index', file], { cwd: ROOT }).catch((e) => e)
    assert.equal(stdout.trim(), file, `${file} is not ignored`)
  }
})

test('deploy/server.env only carries public settings', async () => {
  const keys = [...(await read('deploy/server.env')).matchAll(/^([A-Z_]+)=/gm)].map((m) => m[1])
  for (const key of keys) assert.doesNotMatch(key, /SECRET|TOKEN|PASSWORD|SALT|RESEND|PRIVATE/, key)
  for (const key of keys.filter((k) => k.endsWith('_KEY'))) assert.match(key, /PUBLISHABLE/, key)
})

test('the browser build env only holds VITE_ values that are safe to ship', async () => {
  const env = await read('web/.env.production')
  for (const [, key, value] of env.matchAll(/^([A-Z_]+)=(.*)$/gm)) {
    assert.match(key, /^VITE_/, `${key} would be ignored by Vite anyway`)
    assert.doesNotMatch(key, /SECRET|SERVICE_ROLE|PRIVATE/)
    assert.doesNotMatch(value, /^sb_secret_/)
    if (key.endsWith('_KEY')) assert.match(value, /^sb_publishable_|^0x4/, `${key} should be a publishable/site key`)
  }
})
