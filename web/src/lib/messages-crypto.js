// End-to-end encryption for messages.
//
// Every account holds an ECDH P-256 identity key. Two people share a conversation key:
//   ECDH(mine, theirs) -> HKDF-SHA-256 (salt = thread id) -> AES-256-GCM
// so only the two ends can derive it. The server stores ciphertext and public keys only.
//
// The private key leaves the device once, wrapped: PBKDF2-SHA-256 (600k rounds) over a
// passphrase -> AES-256-GCM. That copy lets another device unlock with the same passphrase.
// Unlocked, it lives in IndexedDB as a non-extractable CryptoKey, so page script can use it
// but never read its bytes.

import { SEALED_PREFIX } from './messages'

const subtle = () => globalThis.crypto?.subtle

export const SUITE = {
  agreement: 'ECDH P-256',
  derivation: 'HKDF-SHA-256',
  cipher: 'AES-256-GCM',
  wrap: 'PBKDF2-SHA-256 · 600,000 rounds',
}

export const ROUNDS = 600_000
const CURVE = { name: 'ECDH', namedCurve: 'P-256' }
const INFO = new TextEncoder().encode('blxr/messages/v1')
const enc = new TextEncoder()
const dec = new TextDecoder()

export class CryptoError extends Error {
  constructor(message, reason = 'broken') {
    super(message)
    this.name = 'CryptoError'
    this.reason = reason
  }
}

export const supported = () => Boolean(subtle() && globalThis.indexedDB)

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

export async function kidOf(publicJwk) {
  const raw = await subtle().exportKey('raw', await importPublic(publicJwk))
  return toB64(new Uint8Array(await subtle().digest('SHA-256', raw)).subarray(0, 12))
}

const importPublic = (jwk) => subtle().importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true }, CURVE, true, [])

// --- the device keyring ----------------------------------------------------

const DB = 'blxr-message-keys'
const STORE = 'identities'

function idb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbDo(mode, run) {
  const db = await idb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request?.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

const held = new Map()

export async function deviceIdentity(uid) {
  if (!uid || !supported()) return null
  if (held.has(uid)) return held.get(uid)
  const stored = await idbDo('readonly', (store) => store.get(uid)).catch(() => null)
  if (stored?.privateKey && stored.kid) held.set(uid, stored)
  return held.get(uid) || null
}

async function remember(uid, identity) {
  held.set(uid, identity)
  await idbDo('readwrite', (store) => store.put(identity, uid))
}

export async function forget(uid) {
  conversations.clear()
  if (uid) held.delete(uid)
  else held.clear()
  if (!supported()) return
  await idbDo('readwrite', (store) => (uid ? store.delete(uid) : store.clear())).catch(() => {})
}

// --- passphrase wrapping ---------------------------------------------------

async function passKey(passphrase, salt, rounds) {
  const base = await subtle().importKey('raw', enc.encode(String(passphrase).normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey'])
}

const wrapAad = (uid, kid) => enc.encode(`blxr/messages/key/v1|${uid}|${kid}`)

// A fresh identity: returns the row to store server-side, and keeps the usable key on this device.
export async function createIdentity(uid, passphrase) {
  const pair = await subtle().generateKey(CURVE, true, ['deriveBits'])
  const publicKey = await subtle().exportKey('jwk', pair.publicKey)
  const jwk = { kty: publicKey.kty, crv: publicKey.crv, x: publicKey.x, y: publicKey.y }
  const kid = await kidOf(jwk)
  const salt = random(16)
  const iv = random(12)
  const wrapper = await passKey(passphrase, salt, ROUNDS)
  const wrapped = await subtle().wrapKey('pkcs8', pair.privateKey, wrapper, { name: 'AES-GCM', iv, additionalData: wrapAad(uid, kid) })
  const row = { kid, public_key: jwk, wrapped: toB64(join(iv, new Uint8Array(wrapped))), salt: toB64(salt), rounds: ROUNDS }
  const local = await unwrapIdentity(uid, row, passphrase)
  return { row, identity: local }
}

export async function unwrapIdentity(uid, row, passphrase) {
  const blob = fromB64(row.wrapped)
  const wrapper = await passKey(passphrase, fromB64(row.salt), row.rounds)
  let privateKey
  try {
    privateKey = await subtle().unwrapKey(
      'pkcs8',
      blob.subarray(12),
      wrapper,
      { name: 'AES-GCM', iv: blob.subarray(0, 12), additionalData: wrapAad(uid, row.kid) },
      CURVE,
      false,
      ['deriveBits'],
    )
  } catch {
    throw new CryptoError('That passphrase does not open your key.', 'passphrase')
  }
  return { kid: row.kid, publicKey: row.public_key, privateKey }
}

export async function keepIdentity(uid, identity) {
  await remember(uid, identity)
  return identity
}

export async function unlockIdentity(uid, row, passphrase) {
  return keepIdentity(uid, await unwrapIdentity(uid, row, passphrase))
}

// --- conversation keys -----------------------------------------------------

const conversations = new Map()

async function conversationKey(threadId, identity, theirJwk, theirKid) {
  const id = `${threadId}|${identity.kid}|${theirKid}`
  if (!conversations.has(id)) {
    conversations.set(
      id,
      (async () => {
        const bits = await subtle().deriveBits({ name: 'ECDH', public: await importPublic(theirJwk) }, identity.privateKey, 256)
        const base = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey'])
        return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(threadId), info: INFO }, base, { name: 'AES-GCM', length: 256 }, false, [
          'encrypt',
          'decrypt',
        ])
      })().catch((failure) => {
        conversations.delete(id)
        throw failure
      }),
    )
  }
  return conversations.get(id)
}

const aadOf = (threadId, from, to, extra = '') => enc.encode(`blxr/messages/v1|${threadId}|${from}|${to}${extra ? `|${extra}` : ''}`)

export function parseSealed(body) {
  const text = String(body || '')
  if (!text.startsWith(SEALED_PREFIX)) return null
  const [, from, to, payload] = text.split('.')
  if (!from || !to || !payload) return null
  return { from, to, payload }
}

// Who this envelope belongs to from where I stand: my key id and theirs.
function sides(identity, from, to) {
  if (identity.kid === from) return { theirs: to }
  if (identity.kid === to) return { theirs: from }
  return null
}

export async function sealText(text, { threadId, identity, peer }) {
  const key = await conversationKey(threadId, identity, peer.public_key, peer.kid)
  const iv = random(12)
  const data = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(threadId, identity.kid, peer.kid) }, key, enc.encode(text))
  return `${SEALED_PREFIX}${identity.kid}.${peer.kid}.${toB64(join(iv, new Uint8Array(data)))}`
}

export async function openText(body, { threadId, identity, keyOf }) {
  const sealed = parseSealed(body)
  if (!sealed) throw new CryptoError('Not an encrypted message.', 'plain')
  if (!identity) throw new CryptoError('Unlock your key to read this.', 'locked')
  const side = sides(identity, sealed.from, sealed.to)
  if (!side) throw new CryptoError('Encrypted to a key this account no longer has.', 'stale')
  const peerJwk = await keyOf(side.theirs)
  if (!peerJwk) throw new CryptoError('Encrypted with a key that has since been replaced.', 'stale')
  const key = await conversationKey(threadId, identity, peerJwk, side.theirs)
  const blob = fromB64(sealed.payload)
  try {
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: blob.subarray(0, 12), additionalData: aadOf(threadId, sealed.from, sealed.to) }, key, blob.subarray(12))
    return dec.decode(plain)
  } catch {
    throw new CryptoError('This message failed its integrity check.', 'tampered')
  }
}

// Files: the stored object is iv || ciphertext, and the entry carries "e2e1.<from>.<to>".
export async function sealBytes(bytes, { threadId, identity, peer, path }) {
  const key = await conversationKey(threadId, identity, peer.public_key, peer.kid)
  const iv = random(12)
  const data = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(threadId, identity.kid, peer.kid, path) }, key, bytes)
  return { blob: join(iv, new Uint8Array(data)), tag: `${SEALED_PREFIX}${identity.kid}.${peer.kid}` }
}

export async function openBytes(bytes, tag, { threadId, identity, keyOf, path }) {
  const [, from, to] = String(tag).split('.')
  if (!identity) throw new CryptoError('Unlock your key to open this.', 'locked')
  const side = from && to ? sides(identity, from, to) : null
  const peerJwk = side ? await keyOf(side.theirs) : null
  if (!peerJwk) throw new CryptoError('Encrypted with a key that has since been replaced.', 'stale')
  const key = await conversationKey(threadId, identity, peerJwk, side.theirs)
  const blob = new Uint8Array(bytes)
  try {
    return await subtle().decrypt({ name: 'AES-GCM', iv: blob.subarray(0, 12), additionalData: aadOf(threadId, from, to, path) }, key, blob.subarray(12))
  } catch {
    throw new CryptoError('This file failed its integrity check.', 'tampered')
  }
}

// A code both people can read out to each other: equal codes mean nobody swapped a key in between.
export async function safetyCode(a, b) {
  const raws = await Promise.all([a, b].map(async (jwk) => new Uint8Array(await subtle().exportKey('raw', await importPublic(jwk)))))
  raws.sort((x, y) => {
    for (let index = 0; index < x.length; index += 1) if (x[index] !== y[index]) return x[index] - y[index]
    return 0
  })
  const digest = new Uint8Array(await subtle().digest('SHA-256', join(...raws)))
  const groups = []
  for (let index = 0; index < 12; index += 1) {
    const chunk = (digest[index * 2] << 8) | digest[index * 2 + 1]
    groups.push(String(chunk % 100000).padStart(5, '0'))
  }
  return groups
}
