import { SEALED_PREFIX } from './messages'

const subtle = () => globalThis.crypto?.subtle
const enc = new TextEncoder()
const dec = new TextDecoder()

export const SUITE = { cipher: 'AES-256-GCM', key: '256-bit key per conversation', nonce: '96-bit random nonce per message' }

export class CryptoError extends Error {
  constructor(message, reason = 'broken') {
    super(message)
    this.name = 'CryptoError'
    this.reason = reason
  }
}

export const supported = () => Boolean(subtle())

export function toB64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let text = ''
  for (let index = 0; index < view.length; index += 0x8000) text += String.fromCharCode(...view.subarray(index, index + 0x8000))
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64(text) {
  const plain = String(text).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(plain + '='.repeat((4 - (plain.length % 4)) % 4))
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

const random = (size) => globalThis.crypto.getRandomValues(new Uint8Array(size))

function join(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

export async function importKey(secret) {
  const raw = fromB64(secret)
  if (raw.length !== 32) throw new CryptoError('That conversation key is malformed.')
  return subtle().importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

const aadOf = (threadId, path = '') => enc.encode(`blxr/messages/v1|${threadId}${path ? `|${path}` : ''}`)

export function parseSealed(body) {
  const text = String(body || '')
  if (!text.startsWith(SEALED_PREFIX)) return null
  const payload = text.slice(SEALED_PREFIX.length)
  if (!payload) return null
  const bytes = fromB64(payload)
  return { payload, nonce: toB64(bytes.subarray(0, 12)), cipher: toB64(bytes.subarray(12, -16)), tag: toB64(bytes.subarray(-16)) }
}

export async function sealText(text, { threadId, key }) {
  const iv = random(12)
  const data = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(threadId) }, key, enc.encode(text))
  return `${SEALED_PREFIX}${toB64(join(iv, new Uint8Array(data)))}`
}

export async function openText(body, { threadId, key }) {
  const sealed = parseSealed(body)
  if (!sealed) throw new CryptoError('Not an encrypted message.', 'plain')
  if (!key) throw new CryptoError('The key for this conversation is missing.', 'missing')
  const blob = fromB64(sealed.payload)
  try {
    return dec.decode(await subtle().decrypt({ name: 'AES-GCM', iv: blob.subarray(0, 12), additionalData: aadOf(threadId) }, key, blob.subarray(12)))
  } catch {
    throw new CryptoError('This message failed its integrity check.', 'tampered')
  }
}

export async function sealBytes(bytes, { threadId, key, path }) {
  const iv = random(12)
  const data = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(threadId, path) }, key, bytes)
  return join(iv, new Uint8Array(data))
}

export async function openBytes(bytes, { threadId, key, path }) {
  if (!key) throw new CryptoError('The key for this conversation is missing.', 'missing')
  const blob = new Uint8Array(bytes)
  try {
    return await subtle().decrypt({ name: 'AES-GCM', iv: blob.subarray(0, 12), additionalData: aadOf(threadId, path) }, key, blob.subarray(12))
  } catch {
    throw new CryptoError('This file failed its integrity check.', 'tampered')
  }
}
