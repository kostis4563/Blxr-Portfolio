import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import * as server from '../../server/src/booking.mjs'
import * as web from '../../web/src/lib/call-options.js'

const asMap = (list) => Object.fromEntries(list.map((o) => [o.id, o.label]))

describe('the /book form and the server agree on the call options', () => {
  test('same places, with the labels the server writes into the calendar', () => {
    assert.deepEqual(
      web.CALL_PLACES.map((p) => [p.id, p.label, p.contact]),
      Object.entries(server.CALL_PLACES).map(([id, p]) => [id, p.label, p.contact]),
    )
  })

  test('same modes, languages, topics, budgets and timings', () => {
    assert.deepEqual(asMap(web.CALL_MODES), server.CALL_MODES)
    assert.deepEqual(asMap(web.CALL_LANGS), server.CALL_LANGS)
    assert.deepEqual(asMap(web.CALL_TOPICS), server.CALL_TOPICS)
    assert.deepEqual(asMap(web.CALL_BUDGETS), server.CALL_BUDGETS)
    assert.deepEqual(asMap(web.CALL_TIMELINES), server.CALL_TIMELINES)
    assert.deepEqual(web.CALL_LIMITS, server.CALL_LIMITS)
  })

  test('a contact or link the form accepts is one the server accepts', () => {
    const samples = {
      phone: ['+30 694 215 8830', '(212) 555-0199', '12345', '+30 69x 215', '1'.repeat(16), ''],
      handle: ['priya.raman', '@priya', 'OldName#1234', 'two words', 'a', ''],
      place: ['Slack huddle', 'x', 'y'.repeat(81), ''],
      link: ['zoom.us/j/1', 'https://meet.google.com/a', 'javascript:alert(1)', 'localhost', ''],
    }
    for (const [kind, values] of Object.entries(samples)) {
      for (const value of values) assert.equal(web.cleanContact(kind, value), server.cleanContact(kind, value), `${kind}: ${value}`)
    }
    for (const value of ['papadaki.studio', 'http://a.b/c', 'ftp://a.b', 'https://u:p@a.b', 'a b.com']) {
      assert.equal(web.cleanLink(value), server.cleanLink(value), value)
    }
  })
})
