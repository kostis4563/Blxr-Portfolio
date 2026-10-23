import { describe, test, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { sha3, checkOnion, normalizeOnion, onionParts, typo } from '../../src/lib/onion.js'
import { CIRCUITS, ONION_EXAMPLES, ONION_PARTS, SECTIONS, HISTORY, STATS } from '../../src/lib/darkweb.js'

const hex = (bytes) => Buffer.from(bytes).toString('hex')
const TOR = ONION_EXAMPLES[0].address

describe('sha3', () => {
  test.each([0, 1, 3, 32, 135, 136, 137, 271, 272, 300])('matches node for %i bytes', (length) => {
    const input = Uint8Array.from({ length }, (_, i) => (i * 37 + length) & 0xff)
    expect(hex(sha3(input))).toBe(createHash('sha3-256').update(input).digest('hex'))
  })

  test('known vector', () => {
    expect(hex(sha3(new TextEncoder().encode('abc')))).toBe('3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532')
  })
})

describe('checkOnion', () => {
  test.each(ONION_EXAMPLES.map((e) => [e.label, e.address]))('%s is a valid v3 address', (_, address) => {
    const result = checkOnion(address)
    expect(result.status).toBe('valid')
    expect(result.checksum).toBe(result.expected)
    expect(address).toHaveLength(56)
    expect(address.endsWith('d')).toBe(true)
  })

  test('normalizes what people paste', () => {
    expect(normalizeOnion(` HTTP://WWW.${TOR.toUpperCase()}.onion/index.html?x=1#y `)).toBe(TOR)
    expect(checkOnion(`https://${TOR}.onion/`).status).toBe('valid')
  })

  test('explains what is wrong', () => {
    expect(checkOnion('').status).toBe('empty')
    expect(checkOnion('   ').status).toBe('empty')
    expect(checkOnion('expyuzz4wqqyqhjn.onion').status).toBe('v2')
    expect(checkOnion('hello0world').status).toBe('charset')
    expect(checkOnion('abc')).toMatchObject({ status: 'length', length: 3 })
    expect(checkOnion(`${TOR.slice(0, 55)}a`)).toMatchObject({ status: 'version', version: 0 })
  })

  test('a typo in the key breaks the checksum', () => {
    const seeds = [0, 0.13, 0.5, 0.77, 0.99]
    for (const a of seeds) {
      for (const b of seeds) {
        const draws = [a, b]
        const mangled = typo(TOR, () => draws.shift())
        expect([...mangled].filter((c, i) => c !== TOR[i])).toHaveLength(1)
        expect(mangled.slice(52)).toBe(TOR.slice(52))
        expect(checkOnion(mangled).status).toBe('checksum')
      }
    }
  })

  test('parts cover the whole address and have a legend each', () => {
    const parts = onionParts(TOR)
    expect(parts.map((p) => p.text).join('')).toBe(TOR)
    expect(parts.map((p) => p.text.length)).toEqual([52, 3, 1])
    for (const p of parts) expect(ONION_PARTS[p.kind]).toBeTruthy()
  })
})

describe('circuits', () => {
  test.each(Object.entries(CIRCUITS))('%s steps point at real nodes and wires', (_, circuit) => {
    const wires = circuit.nodes.length - 1
    expect(new Set(circuit.nodes.map((n) => n.id)).size).toBe(circuit.nodes.length)
    for (const step of circuit.steps) {
      expect(step.at).toBeGreaterThanOrEqual(0)
      expect(step.at).toBeLessThan(circuit.nodes.length)
      for (const i of step.lit ?? []) expect(i).toBeLessThan(wires)
      expect(step.title.length).toBeGreaterThan(0)
    }
  })

  test('a website circuit peels one layer per relay, in order', () => {
    const { nodes, steps } = CIRCUITS.web
    expect(nodes.filter((n) => n.tone !== 'end')).toHaveLength(3)
    expect(steps.map((s) => s.layers)).toEqual([3, 2, 1, 0, 0])
    expect(steps.map((s) => s.at)).toEqual([0, 1, 2, 3, 4])
    for (const step of steps) expect(Object.keys(step.sees).sort()).toEqual(['contents', 'destination', 'ip'])
  })

  test('an onion circuit uses six relays and no exit', () => {
    const { nodes } = CIRCUITS.onion
    expect(nodes.filter((n) => n.tone !== 'end')).toHaveLength(6)
    expect(nodes.some((n) => n.id === 'exit')).toBe(false)
  })
})

describe('content', () => {
  test('section ids are unique', () => {
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length)
  })

  test('history runs in order', () => {
    const years = HISTORY.map((h) => parseInt(h.year, 10))
    expect([...years].sort((a, b) => a - b)).toEqual(years)
  })

  test('the address length stat matches the real thing', () => {
    expect(STATS.find((s) => s.label.includes('onion address')).value).toBe(String(TOR.length))
  })
})
