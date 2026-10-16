import { describe, test, expect } from 'vitest'
import { MAP_COUNTRIES } from '../../src/lib/travel-map.js'
import { VISITED } from '../../src/lib/travel.js'

describe('travel', () => {
  test('every visited country has a shape on the map', () => {
    for (const { name } of VISITED) {
      expect(MAP_COUNTRIES[name], `${name} is not a Natural Earth name in travel-map.js`).toMatch(/^M/)
    }
  })

  test('no country twice, exactly one home, whole visit counts', () => {
    const names = VISITED.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
    expect(VISITED.filter((c) => c.home)).toHaveLength(1)
    for (const c of VISITED.filter((c) => !c.home)) expect(Number.isInteger(c.visits) && c.visits > 0, c.name).toBe(true)
  })
})
