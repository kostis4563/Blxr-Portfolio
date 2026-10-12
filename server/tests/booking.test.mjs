import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseHours, isTimeZone, zonedTime, dayKey, openSlots } from '../src/booking.mjs'

const iso = (ms) => new Date(ms).toISOString()
const at = (s) => Date.parse(s)

describe('parseHours', () => {
  test('day ranges expand, wrap past Sunday, and several windows can be listed', () => {
    assert.deepEqual(parseHours('mon-wed 10:00-18:00').map((w) => w.day), [1, 2, 3])
    assert.deepEqual(parseHours('fri-mon 09:00-12:00').map((w) => w.day), [5, 6, 0, 1])
    assert.deepEqual(parseHours('Tue 09:30-12:00; tue 14:00-17:15'), [
      { day: 2, start: 570, end: 720 },
      { day: 2, start: 840, end: 1035 },
    ])
    assert.deepEqual(parseHours('sun-sat 00:00-24:00').length, 7)
  })

  test('anything malformed is refused whole', () => {
    for (const bad of ['', 'weekdays 10:00-18:00', 'mon 18:00-10:00', 'mon 10:00-10:00', 'mon 10:60-11:00', 'mon 10:00-24:30', 'mon-fri 10:00-18:00, nope']) {
      assert.equal(parseHours(bad), null, bad)
    }
  })
})

test('isTimeZone accepts IANA names only', () => {
  assert.equal(isTimeZone('Europe/Athens'), true)
  assert.equal(isTimeZone('UTC'), true)
  assert.equal(isTimeZone('Mars/Olympus'), false)
  assert.equal(isTimeZone(''), false)
  assert.equal(isTimeZone(42), false)
})

describe('zonedTime', () => {
  test('wall-clock times in Athens map to the right instant on both sides of DST', () => {
    assert.equal(iso(zonedTime(2026, 10, 13, 600, 'Europe/Athens')), '2026-10-13T07:00:00.000Z')
    assert.equal(iso(zonedTime(2026, 11, 2, 600, 'Europe/Athens')), '2026-11-02T08:00:00.000Z')
    assert.equal(iso(zonedTime(2026, 3, 29, 600, 'Europe/Athens')), '2026-03-29T07:00:00.000Z')
    assert.equal(iso(zonedTime(2026, 10, 25, 600, 'Europe/Athens')), '2026-10-25T08:00:00.000Z')
    assert.equal(iso(zonedTime(2026, 10, 13, 1440, 'Europe/Athens')), '2026-10-13T21:00:00.000Z')
  })

  test('dayKey reads the date in the zone, not in UTC', () => {
    assert.equal(dayKey(at('2026-10-12T22:30:00Z'), 'Europe/Athens'), '2026-10-13')
    assert.equal(dayKey(at('2026-10-12T22:30:00Z'), 'UTC'), '2026-10-12')
  })
})

describe('openSlots', () => {
  const base = {
    now: at('2026-10-12T09:00:00Z'),
    windows: parseHours('mon-fri 10:00-12:00'),
    timeZone: 'Europe/Athens',
    minutes: 30,
    days: 3,
  }

  test('steps through each window and stops before a call would overrun it', () => {
    const slots = openSlots({ ...base, now: at('2026-10-11T00:00:00Z'), days: 2 }).map(iso)
    assert.deepEqual(slots, ['2026-10-12T07:00:00.000Z', '2026-10-12T07:30:00.000Z', '2026-10-12T08:00:00.000Z', '2026-10-12T08:30:00.000Z'])
    assert.equal(openSlots({ ...base, now: at('2026-10-11T00:00:00Z'), days: 2, minutes: 45, step: 30 }).length, 3)
  })

  test('notice, busy time and weekends all remove slots', () => {
    const slots = openSlots({
      ...base,
      notice: 12 * 60,
      days: 7,
      busy: [[at('2026-10-13T07:30:00Z'), at('2026-10-13T08:15:00Z')]],
    }).map(iso)
    assert.ok(!slots.some((s) => s.startsWith('2026-10-12')), 'today is inside the notice period')
    assert.deepEqual(slots.filter((s) => s.startsWith('2026-10-13')), ['2026-10-13T07:00:00.000Z', '2026-10-13T08:30:00.000Z'])
    assert.ok(!slots.some((s) => s.startsWith('2026-10-17') || s.startsWith('2026-10-18')), 'no weekend slots')
    assert.equal(slots.filter((s) => s.startsWith('2026-10-14')).length, 4)
  })

  test('a day that already has maxPerDay bookings is closed', () => {
    const slots = openSlots({ ...base, booked: [at('2026-10-13T07:00:00Z')], maxPerDay: 1, busy: [[at('2026-10-13T07:00:00Z'), at('2026-10-13T07:30:00Z')]] }).map(iso)
    assert.ok(!slots.some((s) => s.startsWith('2026-10-13')))
    assert.equal(slots.filter((s) => s.startsWith('2026-10-14')).length, 4)
  })

  test('overlapping windows do not repeat a slot', () => {
    const slots = openSlots({ ...base, windows: parseHours('tue 10:00-11:00, tue 10:30-11:30') })
    assert.equal(slots.length, new Set(slots).size)
    assert.equal(slots.length, 3)
  })
})
