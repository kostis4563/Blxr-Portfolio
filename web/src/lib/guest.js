import { dashboardPath } from './router'

export const CLAIM_HASH = '#claim'
export const CLAIM_PATH = dashboardPath('claim')

const LOCKED = new Set([
  'messages',
  'profile',
  'settings/profile',
  'settings/account',
  'settings/security',
  'settings/notifications',
  'settings/privacy',
])

export const lockedForGuest = (path) => LOCKED.has(path)

const LOCKED_COPY = {
  messages: {
    title: 'A private line to the owner',
    why: 'A conversation needs a name on the other end, so messages stay members-only. It keeps the line quiet and real.',
    points: ['One thread, just you and the owner', 'Replies, reactions and attachments', 'Delivered live, with read receipts'],
  },
  profile: {
    title: 'Your page at blxr.net/@you',
    why: 'Handles are one per member, first come first served. Claim yours before someone else picks it.',
    points: ['A public page with your links, skills and status', 'Cover photo, accent colour and layout', 'A URL that is yours to share'],
  },
  settings: {
    title: 'Account, security and your data',
    why: 'All of these hang off an email address. Add one and they open up.',
    points: ['Sign-in email, password and connected accounts', 'Two-factor authentication and active sessions', 'Notification choices and a data export'],
  },
}

export const lockedCopyFor = (path) => LOCKED_COPY[String(path || '').split('/')[0]] || LOCKED_COPY.settings
