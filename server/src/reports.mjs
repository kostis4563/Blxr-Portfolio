import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { readState, writeState } from './state.mjs'
import { safeEqual } from './guard.mjs'

export const REPORT_FORMAT = 1
export const REPORT_MIN_BYTES = 1 + 12 + 16
export const REPORT_MAX_BYTES = 5 * 1024 * 1024
export const REPORT_TTL_MS = 120 * 86_400_000
export const REPORT_ID_RE = /^[A-Za-z0-9_-]{22}$/
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const META_RE = /^([A-Za-z0-9_-]{22})\.json$/

export class ReportStoreFull extends Error {}

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex')

const validMeta = (m) =>
  m && typeof m === 'object' && typeof m.createdAt === 'string' && typeof m.expiresAt === 'string' && Number.isInteger(m.size) && m.size > 0 && typeof m.del === 'string'

async function writeFileAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`
  const handle = await fs.promises.open(tmp, 'w', 0o600)
  try {
    await handle.writeFile(data)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.promises.rename(tmp, file)
}

export function openReports(dir, { maxBytes, maxCount }) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const index = new Map()
  const pending = new Set()
  let bytes = 0

  const blobFile = (id) => path.join(dir, `${id}.bin`)
  const metaFile = (id) => path.join(dir, `${id}.json`)
  const expired = (meta, now) => !(Date.parse(meta.expiresAt) > now)

  const unlink = (file) => {
    try {
      fs.unlinkSync(file)
    } catch {
    }
  }

  function drop(id) {
    const meta = index.get(id)
    if (meta) {
      index.delete(id)
      bytes -= meta.size
    }
    unlink(metaFile(id))
    unlink(blobFile(id))
  }

  function sweep(now = Date.now()) {
    for (const [id, meta] of index) if (expired(meta, now)) drop(id)
    let names
    try {
      names = fs.readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      const id = name.slice(0, 22)
      if ((index.has(id) && (name === `${id}.json` || name === `${id}.bin`)) || pending.has(id)) continue
      unlink(path.join(dir, name))
    }
  }

  for (const name of fs.readdirSync(dir)) {
    const id = META_RE.exec(name)?.[1]
    if (!id) continue
    const meta = readState(metaFile(id))
    let size = -1
    try {
      size = fs.statSync(blobFile(id)).size
    } catch {
    }
    if (validMeta(meta) && meta.size === size) {
      index.set(id, meta)
      bytes += meta.size
    }
  }
  sweep()

  return {
    sweep,

    get count() {
      return index.size
    },

    get bytes() {
      return bytes
    },

    async create(blob, ttlMs, now = Date.now()) {
      if (index.size >= maxCount || bytes + blob.length > maxBytes) sweep(now)
      if (index.size >= maxCount || bytes + blob.length > maxBytes) throw new ReportStoreFull()
      const id = crypto.randomBytes(16).toString('base64url')
      const deleteToken = crypto.randomBytes(32).toString('base64url')
      const meta = {
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ttlMs).toISOString(),
        size: blob.length,
        del: sha256(deleteToken),
      }
      pending.add(id)
      bytes += meta.size
      try {
        await writeFileAtomic(blobFile(id), blob)
        if (!writeState(metaFile(id), meta)) throw new Error('report metadata could not be written')
        index.set(id, meta)
      } catch (err) {
        bytes -= meta.size
        unlink(metaFile(id))
        unlink(blobFile(id))
        throw err
      } finally {
        pending.delete(id)
      }
      return { id, deleteToken, createdAt: meta.createdAt, expiresAt: meta.expiresAt }
    },

    async get(id, now = Date.now()) {
      const meta = index.get(id)
      if (!meta || expired(meta, now)) return null
      try {
        return { blob: await fs.promises.readFile(blobFile(id)), createdAt: meta.createdAt, expiresAt: meta.expiresAt }
      } catch {
        drop(id)
        return null
      }
    },

    remove(id, token, now = Date.now()) {
      const meta = index.get(id)
      if (!meta || expired(meta, now)) return 'not_found'
      if (typeof token !== 'string' || !TOKEN_RE.test(token) || !safeEqual(sha256(token), meta.del)) return 'forbidden'
      drop(id)
      return 'deleted'
    },
  }
}
