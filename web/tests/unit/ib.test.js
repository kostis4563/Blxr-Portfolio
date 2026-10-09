import { describe, test, expect } from 'vitest'
import {
  SUBJECTS,
  LEVELS,
  findSubject,
  levelsOf,
  rawCuts,
  readEntry,
  gradeForMark,
  gradeForPercent,
  markResult,
  gradeRanges,
  subjectResult,
  neededOnRest,
  cutsFor,
  searchSubjects,
  RATINGS,
  corePoints,
  criteriaTotal,
  gradeFromMarks,
  diplomaResult,
  parseGradeList,
  checkOffer,
  cleanSlots,
  cleanOffers,
  cleanEntries,
  encodeShare,
  decodeShare,
} from '../../src/lib/ib.js'

const CUTS = [10, 20, 30, 40, 50, 60]

describe('subject data', () => {
  test('ids are unique', () => {
    expect(new Set(SUBJECTS.map((s) => s.id)).size).toBe(SUBJECTS.length)
  })

  test.each(SUBJECTS.flatMap((s) => levelsOf(s).map((level) => [s.id, level])))('%s %s is well formed', (id, level) => {
    const { components, overall } = findSubject(id).levels[level]
    expect(components.reduce((sum, c) => sum + c.weight, 0)).toBe(100)
    expect(new Set(components.map((c) => c.id)).size).toBe(components.length)
    for (const cuts of [overall, ...components.map((c) => c.cuts)]) {
      expect(cuts).toHaveLength(6)
      cuts.forEach((n, i) => {
        expect(n).toBeGreaterThan(0)
        expect(n).toBeLessThan(100)
        if (i) expect(n).toBeGreaterThan(cuts[i - 1])
      })
    }
    components.forEach((c) => expect(Number.isInteger(c.outOf) && c.outOf > 0).toBe(true))
    components
      .filter((c) => c.criteria)
      .forEach((c) => {
        expect(c.criteria.reduce((sum, item) => sum + item.max, 0)).toBe(c.outOf)
        expect(new Set(c.criteria.map((item) => item.id)).size).toBe(c.criteria.length)
      })
  })

  test('the common IAs can be marked by criteria', () => {
    for (const id of ['math-aa', 'physics', 'economics', 'history', 'english-a-ll', 'english-b', 'cs']) {
      expect(findSubject(id).levels.SL.components.some((c) => c.criteria)).toBe(true)
    }
  })

  test('every subject has at least one level', () => {
    SUBJECTS.forEach((s) => expect(levelsOf(s).length).toBeGreaterThan(0))
    expect(LEVELS).toEqual(['SL', 'HL'])
  })
})

describe('grading a paper', () => {
  test('raw cuts round up to whole marks', () => {
    expect(rawCuts(CUTS, 100)).toEqual([10, 20, 30, 40, 50, 60])
    expect(rawCuts([74.5], 110)).toEqual([82])
    expect(rawCuts([(82 / 110) * 100], 110)).toEqual([82])
  })

  test.each([
    [0, 1],
    [9, 1],
    [10, 2],
    [49, 5],
    [50, 6],
    [60, 7],
    [100, 7],
  ])('%i/100 is a %i', (mark, grade) => {
    expect(gradeForMark(mark, 100, CUTS)).toBe(grade)
  })

  test('the result says how far the next grade is and how much cushion there is', () => {
    expect(markResult(47, 100, CUTS)).toMatchObject({ grade: 5, above: 7, next: { grade: 6, at: 50, need: 3 } })
    expect(markResult(64, 100, CUTS)).toMatchObject({ grade: 7, above: 4, next: null })
  })

  test('ranges cover 0 to the total with no gaps', () => {
    const ranges = gradeRanges(CUTS, 80)
    expect(ranges[0]).toEqual({ grade: 7, from: 48, to: 80, empty: false })
    expect(ranges.at(-1)).toEqual({ grade: 1, from: 0, to: 7, empty: false })
    for (let i = 1; i < ranges.length; i++) expect(ranges[i].to + 1).toBe(ranges[i - 1].from)
  })

  test('percent grading includes the boundary itself', () => {
    expect(gradeForPercent(59.99, CUTS)).toBe(6)
    expect(gradeForPercent(60, CUTS)).toBe(7)
  })
})

describe('reading what was typed', () => {
  test.each([
    [{ mark: '' }, 'empty'],
    [{ mark: '12' }, 'ok'],
    [{ mark: '12.5' }, 'ok'],
    [{ mark: '81' }, 'tooHigh'],
    [{ mark: 'abc' }, 'empty'],
    [{ mark: '5', outOf: '0' }, 'badTotal'],
    [{ mark: '5', outOf: 'x' }, 'badTotal'],
    [{ mark: '5', outOf: '' }, 'ok'],
  ])('%j → %s', (entry, state) => {
    expect(readEntry(entry, 80).state).toBe(state)
  })

  test('falls back to the default total', () => {
    expect(readEntry(undefined, 110)).toEqual({ state: 'empty', outOf: 110, mark: null })
  })
})

describe('the subject grade', () => {
  const components = [
    { id: 'p1', outOf: 100, weight: 40 },
    { id: 'p2', outOf: 50, weight: 40 },
    { id: 'ia', outOf: 20, weight: 20 },
  ]

  test('weights each component', () => {
    const result = subjectResult(components, { p1: { mark: '80' }, p2: { mark: '25' }, ia: { mark: '20' } })
    expect(result.complete).toBe(true)
    expect(result.pct).toBeCloseTo(72)
  })

  test('partial marks give the average so far and what is needed on the rest', () => {
    const result = subjectResult(components, { ia: { mark: '18' } })
    expect(result.complete).toBe(false)
    expect(result.pct).toBeCloseTo(90)
    expect(result.banked).toBeCloseTo(18)
    const needs = neededOnRest(result, CUTS)
    expect(needs.find((n) => n.grade === 7).need).toBeCloseTo(52.5)
    expect(needs.find((n) => n.grade === 4)).toMatchObject({ state: 'open' })
  })

  test('flags grades already secured or out of reach', () => {
    const locked = neededOnRest(subjectResult(components, { p1: { mark: '100' }, p2: { mark: '50' } }), CUTS)
    expect(locked.every((n) => n.state === 'locked')).toBe(true)
    const out = neededOnRest(subjectResult(components, { p1: { mark: '0' }, p2: { mark: '0' } }), [10, 20, 30, 40, 50, 60])
    expect(out.find((n) => n.grade === 7).state).toBe('out')
  })

  test('nothing to suggest with no marks', () => {
    expect(neededOnRest(subjectResult(components, {}), CUTS)).toEqual([])
  })
})

describe('searching subjects', () => {
  const ids = (q) => searchSubjects(q).map((s) => s.id)

  test('an empty query lists everything in order', () => {
    expect(ids('')).toEqual(SUBJECTS.map((s) => s.id))
    expect(ids('   ')).toHaveLength(SUBJECTS.length)
  })

  test.each([
    ['econ', 'economics'],
    ['phys', 'physics'],
    ['chem', 'chemistry'],
    ['bm', 'business'],
    ['comp sci', 'cs'],
    ['maths aa', 'math-aa'],
    ['analysis', 'math-aa'],
    ['stats', 'math-ai'],
    ['english b', 'english-b'],
    ['spanish b', 'spanish-b'],
    ['greek b', 'greek-b'],
    ['ΕΛΛΗΝΙΚΆ', 'greek-a-ll'],
    ['french ab', 'french-ab'],
    ['ab initio', 'spanish-ab'],
    ['chinese', 'mandarin-a-ll'],
    ['mandarin b', 'mandarin-b'],
    ['latin', 'latin'],
    ['geo', 'geography'],
    ['itgs', 'digital-society'],
    ['sehs', 'sehs'],
    ['art', 'visual-arts'],
    ['drama', 'theatre'],
    ['ess', 'ess'],
  ])('%s finds %s first', (q, id) => {
    expect(ids(q)[0]).toBe(id)
  })

  test('names that start with the query rank above loose matches', () => {
    expect(ids('bio')[0]).toBe('biology')
    expect(ids('english')).toEqual(['english-a-ll', 'english-a-lit', 'english-b'])
  })

  test('every token has to match', () => {
    expect(ids('maths physics')).toEqual([])
    expect(ids('zzz')).toEqual([])
  })

  test('every subject has a short code', () => {
    SUBJECTS.forEach((s) => expect(s.code).toMatch(/^\S{2}$/))
  })
})

describe('ratings', () => {
  test('every grade has a label and a tone', () => {
    for (let grade = 1; grade <= 7; grade++) {
      expect(RATINGS[grade].label).toBeTruthy()
      expect(['great', 'good', 'pass', 'weak']).toContain(RATINGS[grade].tone)
    }
  })

  test('tones only get worse as the grade drops', () => {
    const order = ['great', 'good', 'pass', 'weak']
    for (let grade = 7; grade > 1; grade--) {
      expect(order.indexOf(RATINGS[grade - 1].tone)).toBeGreaterThanOrEqual(order.indexOf(RATINGS[grade].tone))
    }
  })
})

describe('IA criteria', () => {
  const criteria = [
    { id: 'a', max: 4 },
    { id: 'b', max: 6 },
  ]

  test('adds up what is filled in', () => {
    expect(criteriaTotal(criteria, { a: '3', b: '' })).toEqual({ total: 3, filled: 1, over: false, complete: false })
    expect(criteriaTotal(criteria, { a: '3', b: '5.5' })).toMatchObject({ total: 8.5, complete: true })
  })

  test('flags a criterion above its maximum', () => {
    expect(criteriaTotal(criteria, { a: '5' }).over).toBe(true)
  })
})

describe('core points', () => {
  test.each([
    ['A', 'A', 3],
    ['A', 'B', 3],
    ['B', 'A', 3],
    ['B', 'B', 2],
    ['A', 'D', 2],
    ['B', 'D', 1],
    ['C', 'C', 1],
    ['C', 'D', 0],
    ['D', 'D', 0],
  ])('TOK %s and EE %s give %i', (tok, ee, points) => {
    expect(corePoints(tok, ee)).toEqual({ points, fails: false })
  })

  test('an E in either fails', () => {
    expect(corePoints('E', 'A').fails).toBe(true)
    expect(corePoints('A', 'E').fails).toBe(true)
  })

  test('needs both grades', () => {
    expect(corePoints('A', '')).toBeNull()
  })
})

describe('the diploma', () => {
  const slots = (grades, levels = ['HL', 'HL', 'HL', 'SL', 'SL', 'SL']) =>
    grades.map((grade, i) => ({ name: `S${i + 1}`, level: levels[i], grade }))

  test('adds subjects and core points', () => {
    const result = diplomaResult(slots([7, 6, 6, 6, 5, 5]), corePoints('A', 'B'))
    expect(result).toMatchObject({ subjectTotal: 35, bonus: 3, total: 38, complete: true, passes: true, hlPoints: 19, slPoints: 16 })
  })

  test('a 1 fails it straight away', () => {
    const result = diplomaResult(slots([1, null, null, null, null, null]), null)
    expect(result.complete).toBe(false)
    expect(result.failures).toEqual(['A 1 in S1.'])
  })

  test('counts 2s and low grades', () => {
    expect(diplomaResult(slots([2, 2, 2, 7, 7, 7]), corePoints('A', 'A')).failures).toContain('More than two 2s.')
    expect(diplomaResult(slots([3, 3, 3, 3, 7, 7]), corePoints('A', 'A')).failures).toContain('More than three grades of 3 or below.')
  })

  test('checks the point floors once everything is in', () => {
    const result = diplomaResult(slots([4, 4, 3, 4, 4, 4]), corePoints('C', 'D'))
    expect(result.total).toBe(23)
    expect(result.failures).toEqual(['23 points, under the 24 needed.', '11 points at HL, under the 12 needed.'])
  })

  test('with four HL subjects the best three count and SL needs 5', () => {
    const result = diplomaResult(slots([7, 6, 5, 2, 3, 2], ['HL', 'HL', 'HL', 'HL', 'SL', 'SL']), corePoints('B', 'B'))
    expect(result).toMatchObject({ hlPoints: 18, slPoints: 5, slNeeded: 5, passes: true })
  })

  test('needs three or four HL subjects', () => {
    const result = diplomaResult(slots([7, 7, 7, 7, 7, 7], ['HL', 'HL', 'SL', 'SL', 'SL', 'SL']), corePoints('A', 'A'))
    expect(result.failures).toContain('The diploma needs three or four subjects at HL.')
  })

  test('an E in the core fails it', () => {
    expect(diplomaResult(slots([7, 7, 7, 7, 7, 7]), corePoints('E', 'A')).passes).toBe(false)
  })

  test('projected grades come from the weighted marks', () => {
    const subject = findSubject('math-aa')
    const fallback = (id, cuts) => cuts
    expect(gradeFromMarks(subject, 'SL', {}, fallback)).toBeNull()
    expect(gradeFromMarks(subject, 'SL', { p1: { mark: '80' }, p2: { mark: '80' }, ia: { mark: '20' } }, fallback)).toEqual({
      grade: 7,
      complete: true,
    })
  })
})

describe('offers', () => {
  const slots = [
    { name: 'Maths AA', level: 'HL', grade: 7 },
    { name: 'Physics', level: 'HL', grade: 5 },
    { name: 'Chemistry', level: 'HL', grade: 6 },
    { name: 'English', level: 'SL', grade: 6 },
    { name: 'Greek', level: 'SL', grade: 7 },
    { name: 'Economics', level: 'SL', grade: 5 },
  ]
  const diploma = diplomaResult(slots, corePoints('B', 'A'))

  test.each([
    ['766', [7, 6, 6]],
    ['7, 6, 6', [7, 6, 6]],
    ['6 7 6', [7, 6, 6]],
    ['', []],
    ['786', null],
    ['77777', null],
  ])('reads HL grades %j', (text, grades) => {
    expect(parseGradeList(text)).toEqual(grades)
  })

  test('meets an offer it is above', () => {
    expect(checkOffer({ points: '38', hl: '765' }, slots, diploma)).toEqual({ state: 'meets', gaps: [] })
  })

  test('says exactly what is short', () => {
    expect(checkOffer({ points: '40', hl: '766' }, slots, diploma)).toEqual({
      state: 'short',
      gaps: [
        { kind: 'points', need: 40, has: 39 },
        { kind: 'hl', name: 'Physics', has: 5, need: 6 },
      ],
    })
  })

  test('rejects nonsense', () => {
    expect(checkOffer({ points: '50', hl: '' }, slots, diploma).state).toBe('invalid')
    expect(checkOffer({ points: '', hl: '9' }, slots, diploma).state).toBe('invalid')
    expect(checkOffer({ points: '', hl: '' }, slots, diploma).state).toBe('empty')
  })

  test('is only on track while grades are missing', () => {
    const partial = slots.slice(0, 3).concat(slots.slice(3).map((slot) => ({ ...slot, grade: null })))
    expect(checkOffer({ hl: '765' }, partial, diplomaResult(partial, null)).state).toBe('onTrack')
  })
})

describe('sharing and stored data', () => {
  test('a share code round trips, including non latin text', () => {
    const data = { view: 'diploma', offers: [{ name: 'Πανεπιστήμιο Αθηνών', points: '38', hl: '766' }] }
    expect(decodeShare(encodeShare(data))).toEqual(data)
    expect(encodeShare(data)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test('broken codes give nothing', () => {
    expect(decodeShare('%%%')).toBeNull()
    expect(decodeShare(encodeShare([1, 2]))).toBeNull()
  })

  test('slots are cleaned into six valid ones', () => {
    const slots = cleanSlots([{ subject: 'physics', level: 'HL', grade: '6' }, { subject: 'nope', level: 'XL', grade: '9' }, 'junk'])
    expect(slots).toHaveLength(6)
    expect(slots[0]).toEqual({ subject: 'physics', level: 'HL', grade: '6' })
    expect(slots[1]).toEqual({ subject: null, level: 'HL', grade: '' })
    expect(slots[5]).toEqual({ subject: null, level: 'SL', grade: '' })
  })

  test('offers and marks keep only text fields', () => {
    const [offer] = cleanOffers([{ name: 'x'.repeat(80), points: 38, hl: '766', extra: true }])
    expect(offer.name).toHaveLength(60)
    expect(offer.points).toBe('')
    expect(offer).not.toHaveProperty('extra')
    expect(cleanEntries({ p1: { mark: '5', outOf: 7, criteria: { a: '2' } }, p2: 'x' })).toEqual({ p1: { mark: '5', criteria: { a: '2' } } })
  })
})

describe('custom boundaries', () => {
  test('uses saved cuts only when they are valid', () => {
    expect(cutsFor({ k: [1, 2, 3, 4, 5, 6] }, 'k', CUTS)).toEqual([1, 2, 3, 4, 5, 6])
    expect(cutsFor({ k: [6, 5, 4, 3, 2, 1] }, 'k', CUTS)).toBe(CUTS)
    expect(cutsFor({ k: [1, 2, 3] }, 'k', CUTS)).toBe(CUTS)
    expect(cutsFor({ k: [1, 2, 3, 4, 5, 101] }, 'k', CUTS)).toBe(CUTS)
    expect(cutsFor({}, 'k', CUTS)).toBe(CUTS)
    expect(cutsFor(null, 'k', CUTS)).toBe(CUTS)
  })
})
