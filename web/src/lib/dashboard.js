import { CONTACT_EMAIL } from './profile'

export const OWNER_EMAIL = CONTACT_EMAIL
export const isSiteOwner = (user) => Boolean(user?.email) && user.email.toLowerCase() === OWNER_EMAIL

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
    ],
  },
  {
    label: 'Owner',
    owner: true,
    items: [
      { id: 'day', label: 'My day', icon: 'listTodo', deep: true, narrow: true },
      { id: 'admin', label: 'Admin', icon: 'sliders', narrow: true },
    ],
  },
]

export const ADMIN_SECTION = NAV.at(-1).items.find((item) => item.id === 'admin')

export const ADMIN = [
  {
    label: 'People',
    items: [
      {
        id: 'reviewpanel',
        label: 'Review panel',
        hint: 'Moderate reviews and hand out invites',
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
      { id: 'calls', label: 'Calls', hint: 'Bookings, weekly hours and blocked time', icon: 'phoneCall', standalone: true },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'blog', label: 'Blog', hint: 'Posts and drafts on /blog', icon: 'pencil', deep: true },
      { id: 'gallery', label: 'Gallery', hint: 'Photos and UI shots on /gallery', icon: 'image', deep: true },
      { id: 'volunteer', label: 'Volunteering', hint: 'Events and photos on /volunteer', icon: 'heart', deep: true },
      { id: 'quotes', label: 'Quotes', hint: 'The lines on /quote', icon: 'flag', deep: true },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'logs', label: 'Logs', hint: 'Requests, exceptions and browser errors', icon: 'logs', deep: true }],
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
  profile: 'Build the page people see at kostis.wtf/@you.',
  boards: 'Columns, cards and due dates for whatever you are building.',
  messages: 'A private line between your account and the owner.',
  settings: 'Manage your account, security and preferences.',
  'settings/profile': 'Your account name and photo.',
  'settings/account': 'Sign-in email, connected accounts and regional preferences.',
  'settings/security': 'Password, two-factor authentication and sessions.',
  'settings/appearance': 'Theme, density and motion for this browser.',
  'settings/notifications': 'What we email you and what shows up in the app.',
  'settings/privacy': 'Your data, analytics choices and account deletion.',
  day: 'Your homework and what to study each day. Only you can see it.',
  admin: 'Everything behind the public site, in one place.',
  reviewpanel: 'Moderate reviews, hand out invite links and tune the form — signed in as you.',
  calls: 'Booked calls, weekly hours and blocked time for /book.',
  volunteer: 'Events you volunteered at, with photos. Saved events show up on /volunteer right away.',
  gallery: 'Photos and UI shots. Drop images in and they show up on /gallery right away.',
  quotes: 'Lines you live by. Pick the main one, add more, and they show up on /quote right away.',
  logs: 'What the server saw: failed requests, exceptions, upstreams and browser errors.',
}

export const DEFAULT_SECTION = 'boards'

const flat = () =>
  [
    ...NAV.map((group) => group.items.map((item) => (group.owner ? { ...item, owner: true } : item))),
    ADMIN.flatMap((group) => group.items.map((item) => ({ ...item, owner: true, section: ADMIN_SECTION }))),
    NAV_FOOTER,
  ].flatMap((items) =>
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
