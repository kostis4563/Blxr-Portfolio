import { describe, test, expect } from 'vitest'
import { PAYMENT_METHODS, CRYPTO_COINS } from '../../src/lib/payment.js'

describe('payment methods', () => {
  test('ids are unique and every method has a mark and a short tag', () => {
    const ids = PAYMENT_METHODS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const method of PAYMENT_METHODS) {
      expect(method.path).toMatch(/^[Mm]/)
      expect(method.tag.length).toBeLessThanOrEqual(12)
    }
  })

  test('tints come in a dark and a light shade', () => {
    for (const { tint } of [...PAYMENT_METHODS, ...CRYPTO_COINS]) {
      if (tint) expect(tint).toEqual({ dark: expect.stringMatching(/^#[0-9a-f]{6}$/), light: expect.stringMatching(/^#[0-9a-f]{6}$/) })
    }
  })
})
