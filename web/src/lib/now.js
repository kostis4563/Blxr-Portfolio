// Content for the /now page. Edit this file whenever life changes — the page
// reads everything from here, including the "last updated" stamp.

export const NOW_UPDATED = '2026-09-18'

export const NOW_LOCATION = 'Athens, Greece'

export const NOW_INTRO =
  "This is a now page: a snapshot of what I'm focused on at the moment, not a résumé. " +
  'Final year of the IB, most evenings spent on code, and a growing list of things I want to understand properly instead of just well enough.'

// level: how far along I am with it, used for the little meter on each card.
//   1 = just started · 2 = getting comfortable · 3 = using it daily · 4 = going deep
export const NOW_LEARNING = [
  {
    name: 'Node.js',
    level: 3,
    note: 'Express APIs beyond the basics: auth flows, sessions, rate limiting, transactional email, and structuring a server so it does not turn into one giant file.',
    tags: ['Express', 'REST', 'auth'],
  },
  {
    name: 'PostgreSQL & SQL',
    level: 2,
    note: 'Schemas, joins, indexes and migrations. Learning to think in relations instead of reaching for JSON blobs, and using row level security in Supabase.',
    tags: ['Postgres', 'Supabase', 'RLS'],
  },
  {
    name: 'React, properly',
    level: 3,
    note: 'Hooks discipline, render performance, hydration and prerendering. This site is the testbed: every page is server rendered then hydrated.',
    tags: ['hooks', 'SSR', 'performance'],
  },
  {
    name: 'Next.js',
    level: 2,
    note: 'App Router, server components, server actions and caching. Figuring out when it beats a plain Vite + Express setup and when it is overkill.',
    tags: ['App Router', 'RSC', 'caching'],
  },
  {
    name: 'JavaScript, deeper',
    level: 3,
    note: 'The parts I skipped: the event loop for real, promises and async iteration, modules, closures, and reading other people\'s code without guessing.',
    tags: ['async', 'modules', 'ESM'],
  },
  {
    name: 'API design',
    level: 2,
    note: 'Designing endpoints people can actually use: consistent errors, pagination, versioning, and writing docs before the code.',
    tags: ['REST', 'errors', 'docs'],
  },
  {
    name: 'Bootstrap',
    level: 2,
    note: 'Grid, components and utilities for throwing together quick prototypes and school projects without writing every style by hand.',
    tags: ['grid', 'components'],
  },
]

// What I am actively building. `href` is optional.
export const NOW_BUILDING = [
  {
    name: 'Open source projects',
    status: 'ongoing',
    note: 'Shipping what I make publicly, with real READMEs and licences. Web Scanner is MIT and more is on the way as things stabilise.',
    href: 'https://github.com/kostis4563',
    hrefLabel: 'github.com/kostis4563',
  },
  {
    name: 'This site',
    status: 'active',
    note: 'A Vite + React frontend prerendered for 32 languages, an Express API and a Postgres database, deployed to my own box through GitHub Actions and nginx.',
    href: '/projects',
    hrefLabel: 'See the projects',
    internal: true,
  },
  {
    name: '7x0.site',
    status: 'active',
    note: 'A learning platform for FiveM server staff: detection guides, practice scans and quizzes. Iterating on the dashboard and the content.',
    href: 'https://7x0.site',
    hrefLabel: '7x0.site',
  },
  {
    name: 'Server & deploys',
    status: 'ongoing',
    note: 'Running my own Linux server: nginx, security headers, a self hosted runner, secrets that never touch the repo. Learning ops by breaking it.',
  },
]

export const NOW_STUDYING = {
  programme: 'IB Diploma Programme',
  where: 'Athens',
  note: 'Final year. Computer Science is the subject I care most about, and most of what I build outside school started with something from the syllabus.',
  subjects: [
    { name: 'Computer Science', focus: true },
    { name: 'Mathematics AA' },
    { name: 'Physics' },
    { name: 'Business' },
    { name: 'English B' },
    { name: 'Greek' },
  ],
  core: ['Extended Essay', 'Theory of Knowledge', 'CAS'],
  topics: ['Data structures', 'Databases', 'Networks & security', 'Software engineering', 'Computer systems'],
}

// Small stuff that fills the rest of the day.
export const NOW_ALSO = [
  { label: 'Editor', value: 'VS Code, Xcode for the Swift work' },
  { label: 'Machine', value: 'macOS daily, Windows for testing' },
  { label: 'Terminal', value: 'zsh, git, npm, ssh into the box' },
  { label: 'Reading', value: 'Docs, RFCs and other people\'s source code' },
  { label: 'Music', value: 'Whatever the site\'s music widget is playing' },
  { label: 'Timezone', value: 'EET / EEST' },
]

// Queued: things I want to get to next, roughly in order.
export const NOW_NEXT = [
  'TypeScript across the whole stack, not just where it is forced on me',
  'Docker for reproducible dev and deploys',
  'Automated tests that I actually keep running',
  'Go for backend services that need to be fast',
  'Reading more about how databases work under the hood',
]

// Things I am deliberately not doing right now.
export const NOW_NOT = [
  'Taking on new client work until exams are done',
  'Starting new projects before finishing the current ones',
  'Learning a new framework every month',
]
