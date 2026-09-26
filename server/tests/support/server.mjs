import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const SERVER = process.env.BLXR_SERVER_UNDER_TEST || path.resolve(here, '../../src/server.mjs')
export const FAKE = pathToFileURL(path.join(here, 'fake-upstreams.mjs')).href

export const OWNER_EMAIL = 'owner@example.com'
export const SECRET_KEY = 'sb_secret_test_only'

export const FULL_ENV = {
  SITE_URL: 'https://blxr.test',
  SITE_OWNER_EMAIL: OWNER_EMAIL,
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: SECRET_KEY,
  RESEND_API_KEY: 're_test_key',
  REVIEW_SALT: 'test-salt',
  GITHUB_TOKEN: 'ghp_test',
  GITHUB_USERS: 'octo',
}

export const confirmed = (id, email, extra = {}) => ({
  id,
  email,
  email_confirmed_at: '2026-01-01T00:00:00Z',
  ...extra,
})

export const USERS = {
  owner: confirmed('owner', OWNER_EMAIL),
  'owner-mfa': confirmed('owner-mfa', OWNER_EMAIL, { factors: [{ status: 'verified' }] }),
  'owner-unconfirmed': { id: 'owner-unconfirmed', email: OWNER_EMAIL },
  member: confirmed('member', 'member@example.com'),
  'member-mfa': confirmed('member-mfa', 'mfa@example.com', { factors: [{ status: 'verified' }] }),
}

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

export function jwt({ sub = 'member', aud = 'authenticated', exp = Math.floor(Date.now() / 1000) + 3600, aal = 'aal1', ...rest } = {}) {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, aud, exp, aal, ...rest })}.fake-signature-for-tests`
}

export const bearer = (claims) => ({ authorization: `Bearer ${jwt(claims)}` })

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

let ipCounter = 0
const nextIp = () => {
  ipCounter += 1
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`
}

export async function startServer({ env = FULL_ENV, scenario = {}, stateDir } = {}) {
  const state = stateDir ?? (await mkdtemp(path.join(os.tmpdir(), 'blxr-state-')))
  const fakeDir = await mkdtemp(path.join(os.tmpdir(), 'blxr-fake-'))
  const scenarioFile = path.join(fakeDir, 'scenario.json')
  const callsFile = path.join(fakeDir, 'calls.jsonl')
  await writeFile(scenarioFile, JSON.stringify({ users: USERS, ...scenario }))
  await writeFile(callsFile, '')

  const port = await freePort()
  const child = spawn(process.execPath, ['--import', FAKE, SERVER], {
    env: { PATH: process.env.PATH, TZ: 'UTC', PORT: String(port), STATE_DIRECTORY: state, FAKE_UPSTREAM_DIR: fakeDir, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  child.stdout.on('data', (d) => (output += d))
  child.stderr.on('data', (d) => (output += d))
  const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })))

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start within 10s:\n${output}`)), 10_000)
    const onData = () => {
      if (output.includes(`on http://127.0.0.1:${port}`)) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout.on('data', onData)
    exited.then(({ code }) => {
      clearTimeout(timer)
      reject(new Error(`server exited early (code ${code}):\n${output}`))
    })
  })

  const base = `http://127.0.0.1:${port}`

  async function request(pathname, { method = 'GET', headers = {}, body, ip = nextIp(), raw = false } = {}) {
    const init = { method, headers: { 'x-forwarded-for': ip, ...headers }, redirect: 'manual' }
    if (body !== undefined) {
      init.body = typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body)
      if (!Object.keys(init.headers).some((h) => h.toLowerCase() === 'content-type')) init.headers['content-type'] = 'application/json'
    }
    const res = await fetch(base + pathname, init)
    const text = await res.text()
    let json = null
    if (!raw && text) {
      try {
        json = JSON.parse(text)
      } catch {
      }
    }
    return { status: res.status, headers: res.headers, body: json, text }
  }

  return {
    base,
    port,
    stateDir: state,
    request,
    output: () => output,
    async scenario(next) {
      await writeFile(scenarioFile, JSON.stringify({ users: USERS, ...next }))
    },
    async calls(filter) {
      const lines = (await readFile(callsFile, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l))
      return filter ? lines.filter((c) => (typeof filter === 'string' ? c.url.includes(filter) : filter(c))) : lines
    },
    async clearCalls() {
      await writeFile(callsFile, '')
    },
    async stop(signal = 'SIGTERM') {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal)
      return exited
    },
    async cleanup({ keepState = false } = {}) {
      await this.stop()
      await rm(fakeDir, { recursive: true, force: true })
      if (!keepState) await rm(state, { recursive: true, force: true })
    },
  }
}

export const readState = async (dir, name) => JSON.parse(await readFile(path.join(dir, name), 'utf8'))
