import { CONTACT_EMAIL, GITHUB_URL, GITHUB_USERNAME, DISCORD_URL } from './profile'

export const CV_UPDATED = '2026-09-21'

export const CV_NAME = 'Kostis Nomikos'
export const CV_HANDLE = GITHUB_USERNAME
export const CV_LOCATION = 'Athens, Greece'
export const CV_TIMEZONE = 'EET / EEST (UTC+2 / UTC+3)'

export const CV_ROLE = { key: 'hero.bio2', fallback: 'Full stack developer specializing in backend systems and user interfaces.' }
export const CV_STATUS = { key: 'hero.bio1', fallback: 'IB Diploma student based in Athens.' }

export const CV_SUMMARY =
  'Full stack developer in the final year of the IB Diploma Programme. I build the whole thing: React frontends, ' +
  'Node and Express backends, and the Linux box it ships to. Most of my work has been security tooling and UIs for ' +
  'FiveM communities, plus client sites through my own studio. I like working close to the product and shipping ' +
  'things that still work once real people use them.'

export const CV_CONTACT = [
  { label: 'Email', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, sensitive: true },
  { label: 'Web', value: 'blxr.net', href: 'https://blxr.net' },
  { label: 'GitHub', value: `github.com/${GITHUB_USERNAME}`, href: GITHUB_URL },
]

export const CV_EXPERIENCE = [
  {
    role: 'Founder & Lead Developer',
    org: 'Amitista Studio',
    url: 'https://amitista.com',
    period: { from: '2026', present: true },
    location: 'Greece · Remote',
    summary:
      'A development studio taking on client work end to end: marketing sites, dashboards and web platforms, custom tools and backends, FiveM server builds, and interface design.',
    bullets: [
      'Own the studio and lead every build from brief through design, build and support, with scope and price settled before work starts.',
      'Ship React + Vite frontends with Tailwind, backed by Express APIs and nginx on self managed Linux.',
      'The person answering a client\'s messages is the person building the project.',
    ],
    stack: ['React', 'Tailwind CSS', 'Express'],
  },
  {
    role: { key: 'exp.async.role', fallback: 'Full Stack Developer' },
    org: { key: 'exp.async.org', fallback: 'Async Scanner' },
    url: 'https://github.com/kostis4563/async-anticheat',
    period: { from: '2025', to: '2026' },
    location: 'Remote',
    summary: { key: 'exp.async.desc', fallback: 'A forensic tool for analysing screenshares in video games. Front end in React and Tailwind, with Python, Go, Rust and C++ across the rest of the stack.' },
    bullets: [
      'Native Windows scanner in C++17 with a Dear ImGui interface that collects forensic evidence and submits a signed report.',
      'Express API, React dashboard and Discord bot on SQLite that ingest reports, run them through AI analysis and return a structured verdict.',
      'Process, memory and file system forensics matched against known cheat and injector families.',
    ],
    stack: ['C++17', 'Win32', 'Dear ImGui', 'Node.js', 'React', 'SQLite'],
  },
  {
    role: { key: 'exp.free.role', fallback: 'Freelance Developer' },
    org: { key: 'exp.free.org', fallback: 'Self employed' },
    url: null,
    period: { from: '2023', present: true },
    location: 'Remote',
    summary: { key: 'exp.free.desc', fallback: 'I build frontends for clients and help with the product design side too. I like working close to the product, and shipping things that still work once real people use them.' },
    bullets: [
      'UIs, HUDs and standalone resources for FiveM servers: NUI in HTML, CSS and JavaScript, React + TypeScript for ox_inventory, Lua on the game side.',
      'Product design alongside the build: wireframes in Figma, then the real thing.',
    ],
    stack: ['React', 'Tailwind CSS', 'JavaScript', 'Lua', 'NUI'],
  },
]

export const CV_PROJECT_IDS = ['7x0-site', 'web-scanner', 'async', 'padoofood']

export const CV_EDUCATION = [
  {
    degree: { key: 'edu.degree', fallback: 'International Baccalaureate Diploma Programme (IBDP)' },
    org: { key: 'edu.org', fallback: 'Athens' },
    period: { from: '2025', present: true },
    note: 'Final year. Computer Science is the focus subject, alongside Mathematics AA, Physics, Business, English B and Greek, plus the Extended Essay, Theory of Knowledge and CAS.',
    highlights: [
      { key: 'edu.subj.se', fallback: 'Software Engineering' },
      { key: 'edu.subj.cs', fallback: 'Computer Systems' },
      { key: 'edu.subj.dsa', fallback: 'Data Structures & Algorithms' },
      { key: 'edu.subj.db', fallback: 'Databases' },
      { key: 'edu.subj.web', fallback: 'Web / Software Development Concepts' },
    ],
  },
]

export { SKILL_CATEGORIES as CV_SKILLS, TOOL_CATEGORIES as CV_TOOLS } from './skills'

export const CV_LANGUAGES = [
  { name: 'Greek', level: 'Native' },
  { name: 'English', level: 'Fluent' },
  { name: 'French', level: 'B1' },
]
