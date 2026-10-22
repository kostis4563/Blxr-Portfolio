import { describe, test, expect } from 'vitest'
import {
  HOMEWORK_LIMITS,
  fold,
  parseHomework,
  dueLabel,
  sortHomework,
  visibleHomework,
  subjectsOf,
  homeworkForm,
  homeworkProblems,
  homeworkFrom,
  homeworkFromRow,
  homeworkToRow,
} from '../../src/lib/homework.js'

const TODAY = '2026-10-22'

const hw = (over = {}) => ({
  id: over.id || 'x',
  subject: 'Maths',
  title: 'Ex 4B',
  due: null,
  doneOn: null,
  createdAt: '2026-10-20T10:00:00Z',
  ...over,
})

describe('parseHomework', () => {
  test('reads the subject first and the due day last', () => {
    expect(parseHomework('maths ex 4B q1-12 fri', TODAY)).toEqual({ subject: 'Maths', title: 'Ex 4B q1-12', due: '2026-10-23' })
  })

  test('knows short names for IB subjects', () => {
    expect(parseHomework('bm case study tomorrow', TODAY).subject).toBe('Business')
    expect(parseHomework('phys lab write-up', TODAY).subject).toBe('Physics')
    expect(parseHomework('tok journal entry', TODAY).subject).toBe('TOK')
    expect(parseHomework('cs trace table', TODAY).subject).toBe('CS')
  })

  test('prefers the names already in use, including several words', () => {
    const known = ['English B', 'Ελληνομάθεια']
    expect(parseHomework('english article draft mon', TODAY, known)).toMatchObject({ subject: 'English B', title: 'Article draft' })
    expect(parseHomework('eng article', TODAY, known).subject).toBe('English B')
    expect(parseHomework('english b article', TODAY, known)).toMatchObject({ subject: 'English B', title: 'Article' })
    expect(parseHomework('ελληνομαθεια κειμενο', TODAY, known)).toMatchObject({ subject: 'Ελληνομάθεια', title: 'Κειμενο' })
  })

  test('a weekday means the next one, never today', () => {
    expect(parseHomework('maths ex thu', TODAY).due).toBe('2026-10-29')
    expect(parseHomework('maths ex monday', TODAY).due).toBe('2026-10-26')
    expect(parseHomework('maths ex sun', TODAY).due).toBe('2026-10-25')
  })

  test('today, tomorrow and dates', () => {
    expect(parseHomework('maths ex today', TODAY).due).toBe(TODAY)
    expect(parseHomework('maths ex tmr', TODAY).due).toBe('2026-10-23')
    expect(parseHomework('maths ex 3/11', TODAY).due).toBe('2026-11-03')
    expect(parseHomework('maths ex 15.1', TODAY).due).toBe('2027-01-15')
    expect(parseHomework('maths ex 20/10', TODAY).due).toBe('2026-10-20')
    expect(parseHomework('maths ex 31/2', TODAY)).toMatchObject({ title: 'Ex 31/2', due: null })
  })

  test('drops a leading due, by or for', () => {
    expect(parseHomework('physics worksheet due fri', TODAY)).toMatchObject({ title: 'Worksheet', due: '2026-10-23' })
    expect(parseHomework('physics worksheet for tomorrow', TODAY)).toMatchObject({ title: 'Worksheet', due: '2026-10-23' })
  })

  test('leaves words that only look like days alone', () => {
    expect(parseHomework('physics notes on the sun', TODAY)).toMatchObject({ title: 'Notes on the sun', due: null })
  })

  test('works without a subject or a date', () => {
    expect(parseHomework('read chapter 3', TODAY)).toEqual({ subject: '', title: 'Read chapter 3', due: null })
    expect(parseHomework('maths', TODAY)).toEqual({ subject: '', title: 'Maths', due: null })
    expect(parseHomework('maths fri', TODAY)).toEqual({ subject: 'Maths', title: 'Homework', due: '2026-10-23' })
    expect(parseHomework('maths: ex 2', TODAY)).toMatchObject({ subject: 'Maths', title: 'Ex 2' })
    expect(parseHomework('   ', TODAY)).toBeNull()
  })

  test('caps the title length', () => {
    expect(parseHomework(`maths ${'a'.repeat(300)}`, TODAY).title).toHaveLength(HOMEWORK_LIMITS.title)
  })
})

describe('fold', () => {
  test('ignores case and accents', () => {
    expect(fold(' Ελληνομάθεια ')).toBe('ελληνομαθεια')
    expect(fold('Café')).toBe('cafe')
  })
})

describe('dueLabel', () => {
  test('says how soon it is due', () => {
    expect(dueLabel(null, TODAY)).toBeNull()
    expect(dueLabel(TODAY, TODAY)).toEqual({ text: 'Today', tone: 'soon' })
    expect(dueLabel('2026-10-23', TODAY)).toEqual({ text: 'Tomorrow', tone: 'soon' })
    expect(dueLabel('2026-10-26', TODAY)).toEqual({ text: 'Mon', tone: 'later' })
    expect(dueLabel('2026-11-05', TODAY)).toEqual({ text: '5 Nov', tone: 'later' })
    expect(dueLabel('2026-10-20', TODAY)).toEqual({ text: 'Late · Tue', tone: 'late' })
    expect(dueLabel('2026-10-01', TODAY)).toEqual({ text: 'Late · 1 Oct', tone: 'late' })
  })
})

describe('sorting', () => {
  test('open first, soonest due first, no date last, done at the bottom', () => {
    const list = [
      hw({ id: 'none' }),
      hw({ id: 'done', due: '2026-10-21', doneOn: TODAY }),
      hw({ id: 'fri', due: '2026-10-23' }),
      hw({ id: 'late', due: '2026-10-20' }),
      hw({ id: 'fri-later', due: '2026-10-23', createdAt: '2026-10-21T10:00:00Z' }),
    ]
    expect(sortHomework(list).map((i) => i.id)).toEqual(['late', 'fri', 'fri-later', 'none', 'done'])
  })

  test('only keeps work finished today', () => {
    const list = [hw({ id: 'a' }), hw({ id: 'b', doneOn: TODAY }), hw({ id: 'c', doneOn: '2026-10-21' })]
    expect(visibleHomework(list, TODAY).map((i) => i.id)).toEqual(['a', 'b'])
  })

  test('lists each subject once', () => {
    expect(subjectsOf([hw({ subject: 'Physics' }), hw({ subject: 'maths' }), hw(), hw({ subject: '' })])).toEqual(['maths', 'Physics'])
  })
})

describe('editing', () => {
  test('round-trips through the form', () => {
    const base = hw({ due: '2026-10-23' })
    const form = homeworkForm(base)
    expect(form).toEqual({ subject: 'Maths', title: 'Ex 4B', due: '2026-10-23' })
    expect(homeworkFrom(base, { ...form, title: '  Ex 4C ', due: '' })).toEqual({ ...base, title: 'Ex 4C', due: null })
  })

  test('flags what is wrong', () => {
    expect(homeworkProblems({ subject: '', title: 'x', due: '' })).toEqual({})
    expect(homeworkProblems({ subject: 'x'.repeat(41), title: ' ', due: '2026-02-30' })).toEqual({
      title: 'Say what the homework is.',
      subject: `Keep it under ${HOMEWORK_LIMITS.subject} characters.`,
      due: 'Pick a date.',
    })
  })
})

describe('rows', () => {
  test('maps to and from the table', () => {
    const row = { id: 'x', subject: 'Maths', title: 'Ex 4B', due: '2026-10-23', done_on: null, created_at: '2026-10-20T10:00:00Z' }
    const item = homeworkFromRow(row)
    expect(item).toEqual(hw({ due: '2026-10-23' }))
    expect(homeworkToRow(item)).toEqual({ id: 'x', subject: 'Maths', title: 'Ex 4B', due: '2026-10-23', done_on: null })
    expect(homeworkFromRow({ id: 'y', title: 'T', subject: null })).toMatchObject({ subject: '', due: null, doneOn: null, createdAt: null })
    expect(homeworkFromRow(null)).toBeNull()
  })
})
