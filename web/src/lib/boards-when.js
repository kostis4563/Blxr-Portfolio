const UNIT_SECONDS = { m: 60, h: 3600, d: 86400, w: 604800 }

export function startOfDay(at) {
  const day = new Date(at)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

export const sameDay = (a, b) => startOfDay(a) === startOfDay(b)

export function withTime(at, hour, minute) {
  const when = new Date(at)
  when.setHours(hour, minute, 0, 0)
  return when.getTime()
}

export function addMonths(at, count) {
  const when = new Date(at)
  const day = when.getDate()
  when.setDate(1)
  when.setMonth(when.getMonth() + count)
  when.setDate(Math.min(day, new Date(when.getFullYear(), when.getMonth() + 1, 0).getDate()))
  return when.getTime()
}

export function timeWords(at) {
  const when = new Date(at)
  if (!Number.isFinite(when.getTime())) return ''
  return when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function clock(at) {
  const when = new Date(at)
  if (!Number.isFinite(when.getTime())) return ''
  const day = when.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: when.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
  return `${day}, ${timeWords(at)}`
}

export function dayWords(at, now = Date.now()) {
  const when = new Date(at)
  if (!Number.isFinite(when.getTime())) return ''
  const days = Math.round((startOfDay(at) - startOfDay(now)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 1 && days < 7) return when.toLocaleDateString(undefined, { weekday: 'long' })
  return when.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: when.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  })
}

const countWords = (count, one) => `${count} ${count === 1 ? one : `${one}s`}`

export function gapWords(at, now = Date.now()) {
  const away = Math.round((at - now) / 1000)
  const size = Math.abs(away)
  const shape = (body) => (away < 0 ? `${body} ago` : `in ${body}`)
  if (size < 45) return away < 0 ? 'just now' : 'in under a minute'

  const minutes = Math.round(size / 60)
  if (minutes < 60) return shape(countWords(minutes, 'minute'))

  const hours = Math.round(size / 3600)
  if (hours < 3) {
    const whole = Math.floor(size / 3600)
    const spare = Math.round((size - whole * 3600) / 60)
    if (spare > 0) return shape(`${countWords(whole, 'hour')} ${countWords(spare, 'minute')}`)
  }
  if (hours < 48) return shape(countWords(hours, 'hour'))

  const days = Math.round(size / 86400)
  if (days < 60) return shape(countWords(days, 'day'))
  return shape(countWords(Math.round(size / 2592000), 'month'))
}

const MONDAY = new Date(2024, 0, 1).getTime()

export const weekdayNames = () =>
  Array.from({ length: 7 }, (_, index) =>
    new Date(MONDAY + index * 86400000).toLocaleDateString(undefined, { weekday: 'short' }),
  )

export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(year, month, 1 - lead + index)
    return { at: day.getTime(), day: day.getDate(), inside: day.getMonth() === month }
  })
}

export const monthWords = (year, month) =>
  new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const WEEKDAY_KEYS = {
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
  sun: 0, sunday: 0,
}

const NAMED_TIME = {
  midnight: [0, 0],
  morning: [9, 0],
  noon: [12, 0],
  midday: [12, 0],
  lunch: [13, 0],
  lunchtime: [13, 0],
  afternoon: [14, 0],
  evening: [18, 0],
  eod: [18, 0],
  night: [21, 0],
}

const UNIT_KEYS = {
  m: 'm', min: 'm', mins: 'm', minute: 'm', minutes: 'm',
  h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
  d: 'd', day: 'd', days: 'd',
  w: 'w', wk: 'w', wks: 'w', week: 'w', weeks: 'w',
  mo: 'mo', mon: 'mo', month: 'mo', months: 'mo',
}

const FILLER = new Set(['in', 'at', 'on', 'by', 'of', 'the', 'this', 'coming', 'from', 'now', 'due', 'me', 'it'])

export const WHEN_EXAMPLES = ['in 2 days', 'tomorrow 6pm', 'friday 09:00', '3 sep', '90m', 'next week', 'tonight']

function tidy(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
    .replace(/\bhalf\s+(?:an?\s+)?hour\b/g, '30 minutes')
    .replace(/\b(an?|one)\s+(?=(?:min|hour|hr|day|week|wk|month|mo)\w*\b)/g, '1 ')
    .replace(/\b(?:an?\s+)?fortnight\b/g, '2 weeks')
    .replace(/\btmrw?\b/g, 'tomorrow')
    .replace(/\btmrrw\b/g, 'tomorrow')
    .replace(/\s+/g, ' ')
    .trim()
}

function eatTime(words, taken) {
  for (let index = 0; index < words.length; index += 1) {
    if (taken[index]) continue
    const word = words[index]

    const named = NAMED_TIME[word]
    if (named) {
      taken[index] = true
      return { hour: named[0], minute: named[1] }
    }

    let found = /^(\d{1,2})[:.](\d{2})(am|pm)?$/.exec(word)
    if (found) {
      let hour = Number(found[1])
      const minute = Number(found[2])
      if (minute > 59 || hour > 23) return null
      const half = found[3] ?? (words[index + 1] === 'am' || words[index + 1] === 'pm' ? words[index + 1] : null)
      if (half) {
        if (hour > 12) return null
        hour = half === 'pm' ? (hour % 12) + 12 : hour % 12
        if (!found[3]) taken[index + 1] = true
      }
      taken[index] = true
      return { hour, minute }
    }

    found = /^(\d{1,2})(am|pm)$/.exec(word)
    if (found) {
      const hour = Number(found[1])
      if (hour > 12) return null
      taken[index] = true
      return { hour: found[2] === 'pm' ? (hour % 12) + 12 : hour % 12, minute: 0 }
    }

    if (/^\d{1,2}$/.test(word) && (words[index + 1] === 'am' || words[index + 1] === 'pm')) {
      const hour = Number(word)
      if (hour > 12) return null
      taken[index] = true
      taken[index + 1] = true
      return { hour: words[index + 1] === 'pm' ? (hour % 12) + 12 : hour % 12, minute: 0 }
    }

    if (/^\d{4}$/.test(word) && words.length === 1) {
      const hour = Number(word.slice(0, 2))
      const minute = Number(word.slice(2))
      if (hour < 24 && minute < 60) {
        taken[index] = true
        return { hour, minute }
      }
    }
  }
  return null
}

function eatDate(words, taken) {
  for (let index = 0; index < words.length; index += 1) {
    if (taken[index]) continue
    const word = words[index]

    let found = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(word)
    if (found) {
      taken[index] = true
      return { year: Number(found[1]), month: Number(found[2]) - 1, day: Number(found[3]) }
    }

    found = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(word)
    if (found) {
      taken[index] = true
      const stated = found[3] ? Number(found[3]) : null
      return {
        year: stated === null ? null : stated < 100 ? 2000 + stated : stated,
        month: Number(found[2]) - 1,
        day: Number(found[1]),
      }
    }
  }

  for (let index = 0; index < words.length; index += 1) {
    if (taken[index]) continue
    const key = /^([a-z]{3})[a-z]*$/.exec(words[index])
    const month = key ? MONTH_KEYS.indexOf(key[1]) : -1
    if (month < 0) continue
    if ((words[index] === 'mar' || words[index] === 'may') && words.length === 1) continue

    let day = null
    let stated = null
    for (const at of [index - 1, index + 1, index + 2]) {
      if (at < 0 || at >= words.length || taken[at]) continue
      if (day === null && /^\d{1,2}$/.test(words[at])) {
        day = Number(words[at])
        taken[at] = true
      } else if (stated === null && /^\d{4}$/.test(words[at])) {
        stated = Number(words[at])
        taken[at] = true
      }
    }
    if (day === null) continue
    taken[index] = true
    return { year: stated, month, day, loose: stated === null }
  }

  return null
}

function nextWeekday(now, weekday, jump) {
  const today = startOfDay(now)
  const ahead = (weekday - new Date(today).getDay() + 7) % 7
  return today + (ahead === 0 ? (jump ? 7 : 0) : ahead + (jump ? 7 : 0)) * 86400000
}

function eatDay(words, taken, now) {
  for (let index = 0; index < words.length; index += 1) {
    if (taken[index]) continue
    const word = words[index]
    const jump = words[index - 1] === 'next' && !taken[index - 1]

    if (word === 'today') {
      taken[index] = true
      return { at: startOfDay(now), named: true }
    }
    if (word === 'tonight') {
      taken[index] = true
      return { at: startOfDay(now), named: true, hour: 20, minute: 0 }
    }
    if (word === 'tomorrow') {
      taken[index] = true
      return { at: startOfDay(now) + 86400000, named: true }
    }
    if (word === 'yesterday') {
      taken[index] = true
      return { at: startOfDay(now) - 86400000, named: true }
    }
    if (word === 'week' && jump) {
      taken[index] = true
      taken[index - 1] = true
      return { at: startOfDay(now) + 7 * 86400000, named: true }
    }
    if (word === 'month' && jump) {
      taken[index] = true
      taken[index - 1] = true
      return { at: startOfDay(addMonths(now, 1)), named: true }
    }
    if (word === 'weekend') {
      taken[index] = true
      return { at: nextWeekday(now, 6, jump), named: true }
    }
    if (word === 'eow') {
      taken[index] = true
      return { at: nextWeekday(now, 5, false), named: true, hour: 18, minute: 0 }
    }

    const weekday = WEEKDAY_KEYS[word]
    if (weekday !== undefined) {
      taken[index] = true
      if (jump) taken[index - 1] = true
      return { at: nextWeekday(now, weekday, jump), named: true }
    }
  }
  return null
}

function eatGap(words, taken) {
  let seconds = 0
  let months = 0
  let any = false

  for (let index = 0; index < words.length; index += 1) {
    if (taken[index]) continue
    const word = words[index]

    const glued = /^(\d+(?:\.\d+)?)([a-z]{1,7})$/.exec(word)
    if (glued && UNIT_KEYS[glued[2]]) {
      const unit = UNIT_KEYS[glued[2]]
      if (unit === 'mo') months += Number(glued[1])
      else seconds += Number(glued[1]) * UNIT_SECONDS[unit]
      taken[index] = true
      any = true
      continue
    }

    if (/^\d+(?:\.\d+)?$/.test(word)) {
      const next = words[index + 1]
      const unit = next && !taken[index + 1] ? UNIT_KEYS[next] : null
      if (!unit) continue
      if (unit === 'mo') months += Number(word)
      else seconds += Number(word) * UNIT_SECONDS[unit]
      taken[index] = true
      taken[index + 1] = true
      any = true
    }
  }

  return any ? { seconds, months } : null
}

export function parseWhen(text, now = Date.now(), fallback = { hour: 18, minute: 0 }) {
  const cleaned = tidy(text)
  if (!cleaned) return null

  const words = cleaned.split(' ').filter(Boolean)
  const taken = words.map(() => false)

  const time = eatTime(words, taken)
  if (time === null && words.some((word) => /^\d{1,2}[:.]\d{2}/.test(word))) return null
  const date = eatDate(words, taken)
  const day = date ? null : eatDay(words, taken, now)
  const gap = eatGap(words, taken)

  words.forEach((word, index) => {
    if (!taken[index] && FILLER.has(word)) taken[index] = true
  })
  if (words.some((_, index) => !taken[index])) return null
  if (!time && !date && !day && !gap) return null

  const hour = time ? time.hour : (day?.hour ?? fallback.hour ?? 18)
  const minute = time ? time.minute : (day?.minute ?? fallback.minute ?? 0)

  let at
  let kind

  if (date) {
    const year = date.year ?? new Date(now).getFullYear()
    let picked = new Date(year, date.month, date.day, hour, minute, 0, 0)
    if (date.loose && picked.getTime() < now - 43200000) {
      picked = new Date(year + 1, date.month, date.day, hour, minute, 0, 0)
    }
    if (picked.getMonth() !== ((date.month % 12) + 12) % 12) return null
    at = picked.getTime()
    kind = 'date'
  } else if (day) {
    at = withTime(day.at, hour, minute)
    kind = 'day'
  } else if (gap) {
    at = now
    kind = 'gap'
  } else {
    at = withTime(now, hour, minute)
    if (at <= now) at += 86400000
    kind = 'time'
  }

  if (gap) {
    if (gap.months) at = addMonths(at, gap.months)
    at += gap.seconds * 1000
    if (kind === 'gap' && time) at = withTime(at, hour, minute)
    if (kind === 'gap' && !time) at = Math.round(at / 60000) * 60000
  }

  return Number.isFinite(at) ? { at, kind } : null
}

export function relativeChoices(now = Date.now()) {
  const face = new Date(now)
  const monthEnd = new Date(face.getFullYear(), face.getMonth() + 1, 0).getTime()
  return [
    { label: 'Tonight', at: withTime(now, 20, 0) },
    { label: 'Tomorrow', at: withTime(now + 86400000, 9, 0) },
    { label: 'Next week', at: withTime(now + 7 * 86400000, 18, 0) },
    { label: 'Month end', at: withTime(monthEnd, 18, 0) },
  ].filter((choice) => choice.at > now)
}

export const TIME_CHOICES = [9, 12, 15, 18].map((hour) => ({
  hour,
  minute: 0,
  label: timeWords(new Date(2024, 0, 1, hour, 0).getTime()),
}))
