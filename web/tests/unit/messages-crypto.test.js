import { describe, test, expect, beforeAll } from 'vitest'
import { createIdentity, unwrapIdentity, sealText, openText, sealBytes, openBytes, safetyCode, parseSealed, toB64, fromB64 } from '../../src/lib/messages-crypto.js'
import { isSealed, previewOf } from '../../src/lib/messages.js'

const THREAD = '6f1c2a0e-3b4d-4e5f-8a9b-0c1d2e3f4a5b'
let alice
let bob
let keys

beforeAll(async () => {
  alice = await createIdentity('alice', 'correct horse battery staple')
  bob = await createIdentity('bob', 'Tr0ub4dor&3 but longer')
  keys = new Map([
    [alice.row.kid, alice.row.public_key],
    [bob.row.kid, bob.row.public_key],
  ])
}, 30_000)

const keyOf = async (kid) => keys.get(kid) || null
const peer = (side) => ({ kid: side.row.kid, public_key: side.row.public_key })

describe('message encryption', () => {
  test('base64url round-trips', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255])
    expect(fromB64(toB64(bytes))).toEqual(bytes)
    expect(toB64(bytes)).not.toMatch(/[+/=]/)
  })

  test('the stored row never holds the private key in the clear', () => {
    expect(alice.row.public_key.d).toBeUndefined()
    expect(alice.row.rounds).toBeGreaterThanOrEqual(600_000)
    expect(alice.identity.privateKey.extractable).toBe(false)
  })

  test('both sides read what either sends, and the server sees only ciphertext', async () => {
    const text = 'meet at 9 — bring the 🔑'
    const sealed = await sealText(text, { threadId: THREAD, identity: alice.identity, peer: peer(bob) })
    expect(isSealed(sealed)).toBe(true)
    expect(sealed).not.toContain('meet')
    expect(previewOf({ body: sealed, files: [] })).toBe('Encrypted message')
    expect(await openText(sealed, { threadId: THREAD, identity: bob.identity, keyOf })).toBe(text)
    expect(await openText(sealed, { threadId: THREAD, identity: alice.identity, keyOf })).toBe(text)
  })

  test('the same text seals differently every time', async () => {
    const ctx = { threadId: THREAD, identity: alice.identity, peer: peer(bob) }
    expect(await sealText('hi', ctx)).not.toBe(await sealText('hi', ctx))
  })

  test('a flipped bit, a moved message or an outsider all fail', async () => {
    const sealed = await sealText('secret', { threadId: THREAD, identity: alice.identity, peer: peer(bob) })
    const { from, to, payload } = parseSealed(sealed)
    const bytes = fromB64(payload)
    bytes[bytes.length - 1] ^= 1
    const tampered = `e2e1.${from}.${to}.${toB64(bytes)}`
    await expect(openText(tampered, { threadId: THREAD, identity: bob.identity, keyOf })).rejects.toMatchObject({ reason: 'tampered' })
    await expect(openText(sealed, { threadId: 'another-thread', identity: bob.identity, keyOf })).rejects.toMatchObject({ reason: 'tampered' })

    const eve = await createIdentity('eve', 'eve has her own passphrase')
    await expect(openText(sealed, { threadId: THREAD, identity: eve.identity, keyOf })).rejects.toMatchObject({ reason: 'stale' })
    await expect(openText(sealed, { threadId: THREAD, identity: null, keyOf })).rejects.toMatchObject({ reason: 'locked' })
  }, 30_000)

  test('files are sealed and bound to their path', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7 pretend')
    const ctx = { threadId: THREAD, identity: alice.identity, peer: peer(bob), path: `${THREAD}/abc.pdf` }
    const { blob, tag } = await sealBytes(bytes, ctx)
    const plain = await openBytes(blob, tag, { threadId: THREAD, identity: bob.identity, keyOf, path: `${THREAD}/abc.pdf` })
    expect(new Uint8Array(plain)).toEqual(bytes)
    await expect(openBytes(blob, tag, { threadId: THREAD, identity: bob.identity, keyOf, path: `${THREAD}/swapped.pdf` })).rejects.toMatchObject({ reason: 'tampered' })
  })

  test('the passphrase unlocks the key, and only the right one', async () => {
    const back = await unwrapIdentity('alice', alice.row, 'correct horse battery staple')
    expect(back.kid).toBe(alice.row.kid)
    await expect(unwrapIdentity('alice', alice.row, 'wrong horse')).rejects.toMatchObject({ reason: 'passphrase' })
    await expect(unwrapIdentity('mallory', alice.row, 'correct horse battery staple')).rejects.toMatchObject({ reason: 'passphrase' })
  }, 30_000)

  test('both people get the same safety code', async () => {
    const one = await safetyCode(alice.row.public_key, bob.row.public_key)
    const two = await safetyCode(bob.row.public_key, alice.row.public_key)
    expect(one).toEqual(two)
    expect(one).toHaveLength(12)
    one.forEach((group) => expect(group).toMatch(/^\d{5}$/))
  })
})
