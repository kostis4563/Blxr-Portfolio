import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseHours,
  isTimeZone,
  zonedTime,
  dayKey,
  openSlots,
  occursOn,
  blockRanges,
  cleanSchedule,
  placeOfUrl,
  cleanLink,
  cleanContact,
  cleanCallDetails,
  callDetailLines,
  readCallDetails,
  callPlan,
} from '../src/booking.mjs'

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

describe('blocks', () => {
  const block = (over = {}) => ({ id: 'abc123', date: '2026-10-14', start: 840, end: 900, repeat: 'none', until: null, except: [], label: '', ...over })
  const daysOf = (b, from = '2026-10-12', count = 92) =>
    Array.from({ length: count }, (_, i) => new Date(Date.parse(`${from}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10)).filter((key) => occursOn(b, key))

  test('each repeat lands on the right days, from its first day on', () => {
    assert.deepEqual(daysOf(block()), ['2026-10-14'])
    assert.deepEqual(daysOf(block({ repeat: 'daily', until: '2026-10-16' })), ['2026-10-14', '2026-10-15', '2026-10-16'])
    assert.deepEqual(daysOf(block({ repeat: 'weekdays', until: '2026-10-20' })), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20'])
    assert.deepEqual(daysOf(block({ repeat: 'weekly', until: '2026-11-04' })), ['2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04'])
    assert.deepEqual(daysOf(block({ repeat: 'biweekly', until: '2026-11-25' })), ['2026-10-14', '2026-10-28', '2026-11-11', '2026-11-25'])
    assert.deepEqual(daysOf(block({ repeat: 'monthly', date: '2026-10-31' })), ['2026-10-31', '2026-12-31'])
  })

  test('skipped days are left out of a repeat', () => {
    assert.deepEqual(daysOf(block({ repeat: 'weekly', until: '2026-11-04', except: ['2026-10-21', '2026-10-28'] })), ['2026-10-14', '2026-11-04'])
  })

  test('blockRanges turns wall-clock blocks into instants in the zone, all-day ones included', () => {
    const ranges = blockRanges([block(), block({ id: 'allday', date: '2026-10-16', start: null, end: null })], {
      from: at('2026-10-12T00:00:00Z'),
      to: at('2026-10-20T00:00:00Z'),
      timeZone: 'Europe/Athens',
    })
    assert.deepEqual(ranges.map(([a, b]) => `${iso(a)}/${iso(b)}`), ['2026-10-14T11:00:00.000Z/2026-10-14T12:00:00.000Z', '2026-10-15T21:00:00.000Z/2026-10-16T21:00:00.000Z'])
  })

  test('a weekly block keeps its wall-clock time across the DST change', () => {
    const ranges = blockRanges([block({ date: '2026-10-19', start: 600, end: 660, repeat: 'weekly' })], {
      from: at('2026-10-18T00:00:00Z'),
      to: at('2026-10-28T00:00:00Z'),
      timeZone: 'Europe/Athens',
    })
    assert.deepEqual(ranges.map(([a]) => iso(a)), ['2026-10-19T07:00:00.000Z', '2026-10-26T08:00:00.000Z'])
  })

  test('openSlots treats block ranges like any other busy time', () => {
    const windows = parseHours('wed 13:00-16:00')
    const busy = blockRanges([block()], { from: at('2026-10-12T00:00:00Z'), to: at('2026-10-16T00:00:00Z'), timeZone: 'Europe/Athens' })
    const slots = openSlots({ now: at('2026-10-12T00:00:00Z'), windows, timeZone: 'Europe/Athens', minutes: 30, days: 4, busy }).map(iso)
    assert.deepEqual(slots, ['2026-10-14T10:00:00.000Z', '2026-10-14T10:30:00.000Z', '2026-10-14T12:00:00.000Z', '2026-10-14T12:30:00.000Z'])
  })
})

describe('cleanSchedule', () => {
  let n = 0
  const opts = { today: '2026-10-12', makeId: () => `gen${String(++n).padStart(4, '0')}` }

  test('sorts the hours, names new blocks, and drops blocks and skips that are over', () => {
    const { schedule } = cleanSchedule(
      {
        hours: [
          { day: 3, start: 840, end: 1080 },
          { day: 1, start: 600, end: 1080 },
          { day: 3, start: 600, end: 780 },
        ],
        blocks: [
          { date: '2026-10-20', start: null, end: null, repeat: 'none', label: '  Trip\n to   Crete ' },
          { id: 'keepme', date: '2026-09-02', start: 720, end: 780, repeat: 'weekly', until: null, except: ['2026-09-09', '2026-10-21', '2026-10-21'] },
          { id: 'oldone', date: '2026-10-01', start: 600, end: 660, repeat: 'none' },
          { id: 'ended1', date: '2026-09-01', start: 600, end: 660, repeat: 'daily', until: '2026-10-11' },
        ],
        paused: true,
      },
      opts,
    )
    assert.deepEqual(schedule.hours, [
      { day: 1, start: 600, end: 1080 },
      { day: 3, start: 600, end: 780 },
      { day: 3, start: 840, end: 1080 },
    ])
    assert.deepEqual(schedule.blocks, [
      { id: 'gen0001', date: '2026-10-20', start: null, end: null, repeat: 'none', until: null, except: [], label: 'Trip to Crete' },
      { id: 'keepme', date: '2026-09-02', start: 720, end: 780, repeat: 'weekly', until: null, except: ['2026-10-21'], label: '' },
    ])
    assert.equal(schedule.paused, true)
  })

  test('refuses broken hours and blocks, naming what was wrong', () => {
    const good = { hours: [], blocks: [] }
    assert.deepEqual(cleanSchedule({ ...good, hours: [{ day: 7, start: 600, end: 700 }] }, opts), { error: 'invalid', fields: ['hours'] })
    assert.deepEqual(cleanSchedule({ ...good, hours: [{ day: 1, start: 700, end: 600 }] }, opts), { error: 'invalid', fields: ['hours'] })
    assert.deepEqual(cleanSchedule({ ...good, hours: [{ day: 1, start: 601, end: 700 }] }, opts), { error: 'invalid', fields: ['hours'] })
    for (const bad of [
      { date: '2026-02-30', start: null, end: null, repeat: 'none' },
      { date: '2026-10-20', start: 600, end: null, repeat: 'none' },
      { date: '2026-10-20', start: 600, end: 1500, repeat: 'none' },
      { date: '2026-10-20', start: 600, end: 660, repeat: 'yearly' },
      { date: '2026-10-20', start: 600, end: 660, repeat: 'daily', until: '2026-10-19' },
      { date: '2026-10-20', start: 600, end: 660, repeat: 'weekly', except: ['soon'] },
    ]) {
      assert.deepEqual(cleanSchedule({ ...good, blocks: [bad] }, opts), { error: 'invalid', fields: ['blocks'] }, JSON.stringify(bad))
    }
    assert.deepEqual(cleanSchedule({ hours: 'mon-fri', blocks: null, paused: 'yes' }, opts), { error: 'invalid', fields: ['hours', 'blocks', 'paused'] })
  })

  test('two blocks never share an id', () => {
    const { schedule } = cleanSchedule(
      {
        hours: [],
        blocks: [
          { id: 'same12', date: '2026-10-20', start: null, end: null, repeat: 'none' },
          { id: 'same12', date: '2026-10-21', start: null, end: null, repeat: 'none' },
        ],
      },
      opts,
    )
    assert.equal(new Set(schedule.blocks.map((b) => b.id)).size, 2)
  })
})

describe('call details', () => {
  test('a video link names its app', () => {
    assert.equal(placeOfUrl('https://facetime.apple.com/join#v=1'), 'facetime')
    assert.equal(placeOfUrl('https://meet.google.com/abc-defg-hij'), 'meet')
    assert.equal(placeOfUrl('https://us02web.zoom.us/j/1'), 'zoom')
    assert.equal(placeOfUrl('https://teams.live.com/meet/1'), 'teams')
    assert.equal(placeOfUrl('https://whereby.com/blxr'), null)
    assert.equal(placeOfUrl('not a url'), null)
  })

  test('links get https:// when it is missing, and only web links pass', () => {
    assert.equal(cleanLink('papadaki.studio'), 'https://papadaki.studio/')
    assert.equal(cleanLink(' http://example.com/a?b=1 '), 'http://example.com/a?b=1')
    for (const bad of ['', 'localhost', 'javascript:alert(1)', 'ftp://example.com', 'https://user:pw@example.com', 'two words.com', `https://example.com/${'a'.repeat(300)}`]) {
      assert.equal(cleanLink(bad), null, bad)
    }
  })

  test('each kind of contact has its own shape', () => {
    assert.equal(cleanContact('phone', ' +30 694  215 8830 '), '+30 694 215 8830')
    assert.equal(cleanContact('phone', '(212) 555-0199'), '(212) 555-0199')
    assert.equal(cleanContact('phone', '12345'), null)
    assert.equal(cleanContact('phone', '+30 69x 215'), null)
    assert.equal(cleanContact('handle', '@priya.raman'), 'priya.raman')
    assert.equal(cleanContact('handle', 'Old Name#1234'), null)
    assert.equal(cleanContact('handle', 'OldName#1234'), 'OldName#1234')
    assert.equal(cleanContact('place', 'Slack huddle'), 'Slack huddle')
    assert.equal(cleanContact('place', 'x'), null)
    assert.equal(cleanContact('link', ''), '')
    assert.equal(cleanContact('link', 'zoom.us/j/1'), 'https://zoom.us/j/1')
  })

  test('only what the place needs is kept, and budget and timing only for a project', () => {
    const { details, fields } = cleanCallDetails({ place: 'phone', contact: '+44 7700 900123', mode: 'video', lang: 'xx', topic: 'chat', budget: 'mid', timeline: 'now' })
    assert.deepEqual(fields, [])
    assert.deepEqual(details, { place: 'phone', contact: '+44 7700 900123', mode: 'voice', lang: 'en', topic: 'chat', budget: null, timeline: null, company: '', link: '' })
    assert.deepEqual(cleanCallDetails({}).details.place, null)
    assert.deepEqual(cleanCallDetails({ place: 'facetime', contact: '' }).fields, [])
  })

  test('what is written into the event reads back the same', () => {
    const input = { place: 'other', contact: 'Café — Athens', mode: 'voice', lang: 'el', topic: 'project', budget: 'huge', timeline: 'later', company: 'Kafeneio', link: 'kafeneio.gr' }
    const { details } = cleanCallDetails(input)
    const lines = callDetailLines(details)
    assert.equal(lines[0], 'Where: Somewhere else — Café — Athens')
    assert.deepEqual(readCallDetails(['Note: ignored', ...lines]), details)
    assert.deepEqual(readCallDetails([]), { place: null, contact: '', mode: null, lang: 'en', topic: null, budget: null, timeline: null, company: '', link: '' })
    assert.equal(readCallDetails(['Where: Signal']).place, 'other')
    assert.equal(readCallDetails(['Where: Signal']).contact, 'Signal')
  })

  test('the plan sent to the guest names the place without repeating what they typed', () => {
    const plan = (input, video = null) => callPlan(cleanCallDetails(input).details, video)
    assert.equal(plan({}), 'The video link follows by email.')
    assert.equal(plan({ place: 'facetime' }, 'https://facetime.apple.com/join'), 'Join on FaceTime: https://facetime.apple.com/join')
    assert.equal(plan({ place: 'zoom', contact: 'https://zoom.us/j/9' }, 'https://zoom.us/j/9'), 'On Zoom, using your link.')
    assert.equal(plan({ place: 'teams', mode: 'voice' }), 'On Microsoft Teams. I’ll email you the link before we talk. Voice only, no camera needed.')
    assert.equal(plan({ place: 'phone', contact: '+44 7700 900123' }), 'By phone. I’ll call you at the number you gave.')
    assert.equal(plan({ place: 'discord', contact: 'priya' }), 'On Discord. I’ll call you there.')
    assert.equal(plan({ place: 'other', contact: 'Signal' }), 'Where you suggested. I’ll confirm the details by email.')
  })
})
