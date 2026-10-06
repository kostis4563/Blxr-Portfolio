import { describe, test, expect, beforeAll } from 'vitest'
import { importKey, sealText, openText, sealBytes, openBytes, parseSealed, toB64, fromB64 } from '../../src/lib/messages-crypto.js'
import { isSealed, previewOf } from '../../src/lib/messages.js'

const THREAD = '6f1c2a0e-3b4d-4e5f-8a9b-0c1d2e3f4a5b'
const secret = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
let key
let other

beforeAll(async () => {
  key = await importKey(secret())
  other = await importKey(secret())
})

describe('message encryption', () => {
  test('base64url round-trips', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255])
    expect(fromB64(toB64(bytes))).toEqual(bytes)
    expect(toB64(bytes)).not.toMatch(/[+/=]/)
  })

  test('takes the key the database issues, and nothing else', async () => {
    expect(key.extractable).toBe(false)
    await expect(importKey(btoa('too short'))).rejects.toThrow(/malformed/)
  })

  test('round-trips, and the stored form gives nothing away', async () => {
    const text = 'meet at 9 — bring the 🔑'
    const sealed = await sealText(text, { threadId: THREAD, key })
    expect(isSealed(sealed)).toBe(true)
    expect(sealed).not.toContain('meet')
    expect(previewOf({ body: sealed, files: [] })).toBe('Encrypted message')
    expect(await openText(sealed, { threadId: THREAD, key })).toBe(text)
  })

  test('splits into nonce, ciphertext and tag for the encrypted view', async () => {
    const parts = parseSealed(await sealText('hello', { threadId: THREAD, key }))
    expect(fromB64(parts.nonce)).toHaveLength(12)
    expect(fromB64(parts.cipher)).toHaveLength(5)
    expect(fromB64(parts.tag)).toHaveLength(16)
  })

  test('the same text seals differently every time', async () => {
    expect(await sealText('hi', { threadId: THREAD, key })).not.toBe(await sealText('hi', { threadId: THREAD, key }))
  })

  test('a flipped bit, another conversation or another key all fail', async () => {
    const sealed = await sealText('secret', { threadId: THREAD, key })
    const bytes = fromB64(parseSealed(sealed).payload)
    bytes[bytes.length - 1] ^= 1
    await expect(openText(`enc1.${toB64(bytes)}`, { threadId: THREAD, key })).rejects.toMatchObject({ reason: 'tampered' })
    await expect(openText(sealed, { threadId: 'another-thread', key })).rejects.toMatchObject({ reason: 'tampered' })
    await expect(openText(sealed, { threadId: THREAD, key: other })).rejects.toMatchObject({ reason: 'tampered' })
    await expect(openText(sealed, { threadId: THREAD, key: null })).rejects.toMatchObject({ reason: 'missing' })
  })

  test('files are sealed and bound to their path', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7 pretend')
    const path = `${THREAD}/abc.pdf`
    const blob = await sealBytes(bytes, { threadId: THREAD, key, path })
    expect(new Uint8Array(await openBytes(blob, { threadId: THREAD, key, path }))).toEqual(bytes)
    await expect(openBytes(blob, { threadId: THREAD, key, path: `${THREAD}/swapped.pdf` })).rejects.toMatchObject({ reason: 'tampered' })
  })
})
