export const ROADMAP_UPDATED = '2026-10-22'

export const ROADMAP_INTRO =
  'What I want to get done, and by when. Every goal has a month next to it, and when one slips it stays on the page and says so.'

export const AREAS = [
  { id: 'school', label: 'School' },
  { id: 'code', label: 'Code' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'uni', label: 'University' },
  { id: 'studio', label: 'Studio' },
  { id: 'life', label: 'Life' },
]

export const STATUSES = [
  { id: 'done', label: 'Done' },
  { id: 'active', label: 'In progress' },
  { id: 'planned', label: 'Planned' },
]

export const GOALS = [
  {
    id: 'ibdp-november-exams',
    title: 'IBDP November exams',
    note: 'The first exams of the Diploma Programme. The whole month goes to revision.',
    area: 'school',
    by: '2026-11',
    status: 'planned',
  },
  {
    id: 'javascript',
    title: 'JavaScript, properly',
    note: 'Closures, the event loop, async / await and modules: the language itself, not just enough of it to get by.',
    area: 'code',
    from: '2026-12',
    by: '2027-02',
    status: 'planned',
  },
  {
    id: 'fcc-javascript',
    title: 'freeCodeCamp JavaScript Certification',
    note: 'A free, verified certification, earned by passing freeCodeCamp’s JavaScript exam.',
    area: 'certificate',
    by: '2027-02',
    status: 'planned',
    href: 'https://www.freecodecamp.org/learn',
  },
  {
    id: 'nodejs',
    title: 'Node.js',
    note: 'JavaScript outside the browser: the file system, streams, events, child processes and npm.',
    area: 'code',
    from: '2027-03',
    by: '2027-04',
    status: 'planned',
    href: 'https://nodejs.org',
  },
  {
    id: 'express',
    title: 'Express',
    note: 'Routing, middleware and REST APIs on top of Node, ending in an API I build and deploy myself.',
    area: 'code',
    from: '2027-05',
    by: '2027-06',
    status: 'planned',
    href: 'https://expressjs.com',
  },
  {
    id: 'fcc-back-end',
    title: 'freeCodeCamp Back End Development and APIs',
    note: 'The Node and Express certification: five required projects, each one a working API.',
    area: 'certificate',
    by: '2027-07',
    status: 'planned',
    href: 'https://www.freecodecamp.org/learn',
  },
  {
    id: 'ielts',
    title: 'IELTS Academic, 6.5 or higher',
    note: 'TU Delft only waives the English test for English A, and I take English B. The result has to be under two years old when I apply.',
    area: 'certificate',
    by: '2027-09',
    status: 'planned',
    href: 'https://ielts.org',
  },
  {
    id: 'tu-delft-apply',
    title: 'Apply to TU Delft',
    note: 'BSc Computer Science and Engineering, through Studielink before 15 January. It is numerus fixus, so applying gets me into selection, not straight in.',
    area: 'uni',
    from: '2027-10',
    by: '2028-01',
    status: 'planned',
    href: 'https://www.tudelft.nl/en/onderwijs/opleidingen/bachelors/computer-science-and-engineering/bachelor-of-computer-science-and-engineering',
  },
  {
    id: 'tu-delft-selection',
    title: 'TU Delft selection',
    note: 'Tests in Mathematics and in Systematic Reasoning & Logical Thinking. The ranking number comes out on 15 April.',
    area: 'uni',
    from: '2028-01',
    by: '2028-04',
    status: 'planned',
    href: 'https://www.tudelft.nl/en/onderwijs/opleidingen/bachelors/computer-science-and-engineering/bachelor-of-computer-science-and-engineering/from-application-to-enrollment/selection-procedure',
  },
  {
    id: 'ib-diploma',
    title: 'IB Diploma final exams',
    note: 'The finals, in May. TU Delft only accepts Mathematics: Analysis & Approaches at HL.',
    area: 'school',
    by: '2028-05',
    status: 'planned',
  },
  {
    id: 'jsnad',
    title: 'OpenJS Node.js Application Developer (JSNAD)',
    note: 'The Linux Foundation’s Node.js exam: two hours of real tasks, no multiple choice. For the summer after the IB.',
    area: 'certificate',
    from: '2028-06',
    by: '2028-08',
    status: 'planned',
    href: 'https://training.linuxfoundation.org/certification/jsnad/',
  },
  {
    id: 'tu-delft-start',
    title: 'Start at TU Delft',
    note: 'First year of Computer Science and Engineering, in Delft.',
    area: 'uni',
    by: '2028-09',
    status: 'planned',
  },
]

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export const isMonth = (value) => typeof value === 'string' && MONTH_RE.test(value)

export function monthKey(ms) {
  const date = new Date(ms)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month, { short = false } = {}) {
  const [year, m] = month.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat('en-US', { month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, m - 1, 1)),
    )
  } catch {
    return month
  }
}

export function monthsBetween(from, to) {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export function spanOf(months) {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (!years) return plural(rest, 'month', 'months')
  return rest ? `${plural(years, 'year', 'years')}, ${plural(rest, 'month', 'months')}` : plural(years, 'year', 'years')
}

export function dueOf(goal, today) {
  if (goal.status === 'done') {
    if (!goal.doneAt) return { text: 'Done', late: false }
    const over = monthsBetween(goal.by, goal.doneAt)
    return over > 0 ? { text: `Done ${spanOf(over)} late`, late: false } : { text: 'Done on time', late: false }
  }
  const starts = goal.from ? monthsBetween(today, goal.from) : 0
  if (starts === 1) return { text: 'Starts next month', late: false }
  if (starts > 1) return { text: `Starts in ${spanOf(starts)}`, late: false }
  const left = monthsBetween(today, goal.by)
  if (left < 0) return { text: `${spanOf(-left)} late`, late: true }
  if (left === 0) return { text: 'Due this month', late: false }
  if (left === 1) return { text: 'Due next month', late: false }
  return { text: `In ${spanOf(left)}`, late: false }
}

export const startOf = (goal) => goal.from ?? goal.by

export const sortGoals = (goals) =>
  [...goals].sort((a, b) => startOf(a).localeCompare(startOf(b)) || a.by.localeCompare(b.by))

export function groupByYear(goals) {
  const years = []
  for (const goal of sortGoals(goals)) {
    const year = startOf(goal).slice(0, 4)
    if (years.at(-1)?.year !== year) years.push({ year, goals: [] })
    years.at(-1).goals.push(goal)
  }
  return years
}

export function statusCounts(goals, today) {
  const counts = { ...Object.fromEntries(STATUSES.map((s) => [s.id, 0])), late: 0 }
  for (const goal of goals) {
    counts[goal.status] += 1
    if (goal.status !== 'done' && goal.by < today) counts.late += 1
  }
  return counts
}

export function nextUp(goals, today) {
  const open = sortGoals(goals).filter((g) => g.status !== 'done')
  return open.find((g) => g.by >= today) ?? open[0] ?? null
}

export const todayBefore = (goals, today) => sortGoals(goals).find((g) => g.by >= today)?.id ?? null
