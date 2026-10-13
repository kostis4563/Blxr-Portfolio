import { currentSession } from './supabase'

const ENDPOINT = '/api/book/schedule'

export class ScheduleError extends Error {
  constructor(code, { status = 0, fields = [], schedule = null } = {}) {
    super(code)
    this.code = code
    this.status = status
    this.fields = fields
    this.schedule = schedule
  }
}

async function request({ method = 'GET', body, signal } = {}) {
  const headers = {}
  const token = currentSession()?.access_token
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  let res
  try {
    res = await fetch(ENDPOINT, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ScheduleError('offline')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ScheduleError(typeof data?.error === 'string' ? data.error : 'failed', {
      status: res.status,
      fields: Array.isArray(data?.fields) ? data.fields : [],
      schedule: data?.schedule || null,
    })
  }
  return data
}

export const fetchSchedule = ({ signal } = {}) => request({ signal })

export const saveSchedule = ({ rev, hours, blocks, paused }) => request({ method: 'PUT', body: { rev, hours, blocks, paused } })

export const SCHEDULE_ERRORS = {
  offline: 'Could not reach the server. Check your connection and try again.',
  unauthorized: 'The server did not accept this session as the owner. Sign out and back in.',
  needs_mfa: 'The server only accepts owner sessions that passed two-factor. Sign out, sign back in and enter your code.',
  not_found: 'The owner tools are off on this server: SITE_OWNER_EMAIL is not set in its env file.',
  invalid: 'The server refused that change.',
  save_failed: 'The server could not write the schedule to disk.',
  failed: 'Something went wrong. Try again.',
}

export const CALENDAR_ERRORS = {
  booking_disabled: 'iCloud isn’t connected, so calls and busy time can’t be shown. Hours and blocks still save.',
  warming: 'Still reading your iCloud calendar. Calls show up in a moment.',
  calendar_failed: 'Couldn’t read your iCloud calendar just now. Hours and blocks still save.',
}
