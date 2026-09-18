import { CONTACT_EMAIL } from './profile'

export const OWNER_EMAIL = CONTACT_EMAIL
export const isSiteOwner = (user) => Boolean(user?.email) && user.email.toLowerCase() === OWNER_EMAIL

export const ICONS = {
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  chart: ['M3 3v18h18', 'm7 14 4-4 4 4 5-6'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z'],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  star: ['M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z'],
  image: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'm3 16 5-5 4 4 3-3 6 6', 'M15.5 8.5h.01'],
  rocket: [
    'M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.8-.8-.8-2.1-.8-2.9-.2z',
    'm12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z',
    'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0',
    'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  ],
  terminal: ['m4 17 6-6-6-6', 'M12 19h8'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm21 21-4.35-4.35'],
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  pin: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  upload: ['m16 16-4-4-4 4', 'M12 12v9', 'M20.4 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 3 15.3'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  palette: ['M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8z', 'M7.5 12h.01', 'M10.5 8h.01', 'M14.5 8h.01'],
  globe: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  key: ['m21 2-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  chevronLeft: ['m15 18-6-6 6-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  sun: ['M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707m0-12.728.707.707m12.728 12.728.707.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  dots: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  check: ['m5 12 5 5L20 7'],
  clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M3 10h18'],
  chevronsUpDown: ['m7 15 5 5 5-5', 'm7 9 5-5 5 5'],
  panelLeft: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 3v18'],
  arrowUpRight: ['M7 17 17 7', 'M7 7h10v10'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  lock: ['M5 11a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z', 'M8 9V7a4 4 0 0 1 8 0v2'],
  mail: ['M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z', 'm2 7 10 7 10-7'],
  monitor: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M8 21h8', 'M12 17v4'],
  smartphone: ['M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M12 18h.01'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  trash: ['M3 6h18', 'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M10 11v6', 'M14 11v6'],
  copy: ['M9 9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  refresh: ['M21 12a9 9 0 0 1-15.4 6.4L3 16', 'M3 21v-5h5', 'M3 12a9 9 0 0 1 15.4-6.4L21 8', 'M21 3v5h-5'],
  eyeOff: ['M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2', 'M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a10.7 10.7 0 0 0 5.4-1.4', 'm2 2 20 20', 'M14.1 14.1a3 3 0 0 1-4.2-4.2'],

  kanban: ['M4 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z', 'M8 7v8', 'M12 7v5', 'M16 7v11'],
  archive: ['M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', 'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8', 'M10 12h4'],
  filter: ['M3 5h18l-7 8v6l-4 2v-8z'],
  tag: ['M3 3h7.2a2 2 0 0 1 1.4.6l8.8 8.8a2 2 0 0 1 0 2.8l-5.4 5.4a2 2 0 0 1-2.8 0L3.6 11.8a2 2 0 0 1-.6-1.4z', 'M7.5 7.5h.01'],
  paperclip: ['M21 11.5 12.4 20a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.9-7.8'],
  message: ['M21 12a8 8 0 0 1-8 8H8l-5 3 1.2-4.2A8 8 0 1 1 21 12z'],
  listTodo: ['m3 6 1.5 1.5L7 5', 'm3 14 1.5 1.5L7 13', 'M11 6h10', 'M11 14h10', 'M11 18h6'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  arrowLeft: ['M19 12H5', 'm12 19-7-7 7-7'],
  arrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
  undo: ['M3 7v6h6', 'M3.5 13a9 9 0 1 0 2.1-6.4L3 9'],
  crop: ['M6 2v14a2 2 0 0 0 2 2h14', 'M18 22V8a2 2 0 0 0-2-2H2'],
  move: ['M5 9 2 12l3 3', 'M9 5l3-3 3 3', 'M15 19l-3 3-3-3', 'M19 9l3 3-3 3', 'M2 12h20', 'M12 2v20'],
  sort: ['M3 6h12', 'M3 12h8', 'M3 18h4', 'm17 8 3-3 3 3', 'M20 5v14'],
  square: ['M4 4h16v16H4z'],
  squareCheck: ['M4 4h16v16H4z', 'm8.5 12 2.5 2.5L16 9.5'],
  circle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'],
  circleCheck: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'm8.5 12 2.5 2.5L16 9.5'],
  send: ['m22 2-7 20-4-9-9-4z', 'M22 2 11 13'],
  file: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'],
  save: ['M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 3v6h7V3', 'M8 15h8'],
  bookmark: ['M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z'],
  history: ['M3 7v6h6', 'M3.5 13a9 9 0 1 0 2.1-6.4L3 9', 'M12 8v4.5l3 1.8'],

  smile: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01'],
  reply: ['M9 17 4 12l5-5', 'M20 18v-2a4 4 0 0 0-4-4H4'],
  pencil: ['M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z', 'm15 5 4 4'],
  arrowDown: ['M12 5v14', 'm19 12-7 7-7-7'],

  logs: ['M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  xCircle: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'm15 9-6 6', 'm9 9 6 6'],
  server: ['M4 3h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M4 14h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z', 'M7 6.5h.01', 'M7 17.5h.01'],
  bug: ['m8 2 1.9 1.9', 'M14.1 3.9 16 2', 'M9 7.1V6a3 3 0 1 1 6 0v1.1', 'M12 20a6 6 0 0 0 6-6v-2a6 6 0 0 0-12 0v2a6 6 0 0 0 6 6z', 'M12 20v-9', 'M6.5 9H3', 'M6 13H2', 'M6.5 17 3 19', 'M17.5 9H21', 'M18 13h4', 'm17.5 17 3.5 2'],
  cloud: ['M17.5 19a4.5 4.5 0 0 0 .4-9A7 7 0 0 0 4.3 12.5 3.5 3.5 0 0 0 5.5 19z'],
  pause: ['M7 4h3v16H7z', 'M14 4h3v16h-3z'],
  play: ['m6 4 14 8-14 8z'],
}

export const NAV = [
  {
    label: 'Workspace',
    items: [
      { id: 'boards', label: 'Boards', icon: 'kanban', deep: true, wide: true },
      { id: 'messages', label: 'Messages', icon: 'message', deep: true, bare: true },
    ],
  },
  {
    label: 'You',
    items: [
      { id: 'profile', label: 'Profile', icon: 'user' },
      { id: 'stats', label: 'Stats', icon: 'chart' },
    ],
  },
  {
    label: 'Owner',
    owner: true,
    items: [
      {
        id: 'reviewpanel',
        label: 'Review panel',
        icon: 'star',
        subnav: true,
        roomy: true,
        children: [
          { id: 'overview', label: 'Overview' },
          { id: 'reviews', label: 'Reviews' },
          { id: 'invites', label: 'Invites' },
          { id: 'settings', label: 'Settings' },
        ],
      },
      { id: 'logs', label: 'Logs', icon: 'logs', deep: true },
    ],
  },
]

export const navFor = (user) => NAV.filter((group) => !group.owner || isSiteOwner(user))

export const NAV_FOOTER = [
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    subnav: true,
    children: [
      { id: 'profile', label: 'Profile' },
      { id: 'account', label: 'Account' },
      { id: 'security', label: 'Security' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'privacy', label: 'Data & privacy' },
    ],
  },
]

export const BLURBS = {
  profile: 'Build the page people see at blxr.net/u/you.',
  boards: 'Columns, cards and due dates for whatever you are building.',
  messages: 'A private line between your account and the owner.',
  stats: 'Your commits, files and lines across every repo you touch.',
  settings: 'Manage your account, security and preferences.',
  'settings/profile': 'Your account name and photo.',
  'settings/account': 'Sign-in email, connected accounts and regional preferences.',
  'settings/security': 'Password, two-factor authentication and sessions.',
  'settings/appearance': 'Theme, density and motion for this browser.',
  'settings/notifications': 'What we email you and what shows up in the app.',
  'settings/privacy': 'Your data, analytics choices and account deletion.',
  reviewpanel: 'Moderate reviews, hand out invite links and tune the form — signed in as you.',
  logs: 'What the server saw: failed requests, exceptions, upstreams and browser errors.',
}

export const DEFAULT_SECTION = 'boards'

const flat = () =>
  [...NAV.map((group) => group.items.map((item) => (group.owner ? { ...item, owner: true } : item))), NAV_FOOTER].flatMap((items) =>
    items.flatMap((item) => [
      { ...item, path: item.id, parent: null },
      ...(item.children || []).map((child) => ({ ...child, path: `${item.id}/${child.id}`, parent: item })),
    ]),
  )

export const NAV_FLAT = flat()

export function itemForHash(hash) {
  const path = (hash || '').replace(/^#/, '')
  const exact = NAV_FLAT.find((item) => item.path === path)
  if (exact) return exact
  const head = path.split('/')[0]
  const deep = NAV_FLAT.find((item) => item.deep && item.path === head)
  return deep || NAV_FLAT.find((item) => item.path === DEFAULT_SECTION)
}

export const SIDEBAR_STORAGE_KEY = 'blxr:dashboard:sidebar'

export const NOTIFICATIONS = [
  { id: 1, title: 'New review awaiting approval', body: 'Maria K. · 5 stars on 7x0', time: '2 min ago', unread: true },
  { id: 2, title: 'Deploy #412 finished', body: 'main · 1m 08s', time: '38 min ago', unread: true },
  { id: 3, title: 'New message', body: 'Contact form · "Freelance inquiry"', time: '1 hr ago', unread: false },
  { id: 4, title: 'Domain verified', body: 'blxr.net · DNS records look good', time: 'Yesterday', unread: false },
]
