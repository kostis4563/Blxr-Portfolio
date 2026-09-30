import { useSyncExternalStore } from 'react'
import { currentSession } from './supabase'
import { isSiteOwner } from './dashboard'
import { remindOf, stepSeconds } from './boards'
import { gapWords } from './boards-when'
import { previewOf } from './messages'

const EVERY = 60_000
const RECENT = 14 * 86_400_000
const SHOWN = 20
const KEY = 'blxr:notifications'
const GIVE_UP = [401, 403, 501, 503]

const EMPTY = { items: null, failed: false, seen: 0, read: {} }

let state = EMPTY
let uid = null
let timer = null
let inflight = null
let ownerName = null
const blocked = new Set()
const listeners = new Set()

function emit(patch) {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}

function loadMarks(id) {
  try {
    const held = JSON.parse(localStorage.getItem(`${KEY}:${id}`) || 'null')
    return { seen: Number(held?.seen) || 0, read: held?.read && typeof held.read === 'object' ? held.read : {} }
  } catch {
    return { seen: 0, read: {} }
  }
}

function saveMarks() {
  if (!uid) return
  try {
    localStorage.setItem(`${KEY}:${uid}`, JSON.stringify({ seen: state.seen, read: state.read }))
  } catch {
  }
}

function claimsOf(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

const mfaSatisfied = (session) =>
  claimsOf(session.access_token).aal === 'aal2' || !(session.user.factors || []).some((f) => f?.status === 'verified')

export const isUnread = (item, marks = state) => item.live !== false && item.at > Math.max(marks.seen, marks.read[item.id] || 0)

function raisedAt(due, remind, now) {
  const marks = [due, ...remind.lead.map((step) => due - stepSeconds(step) * 1000), ...remind.late.map((step) => due + stepSeconds(step) * 1000)]
  const passed = marks.filter((at) => at <= now)
  return passed.length ? Math.max(...passed) : null
}

async function messageItems(owner, now) {
  const api = await import('./messages-api')
  if (owner) {
    const threads = await api.fetchInbox()
    return threads
      .filter((t) => t.last_at && !t.last_from_owner && (t.unread > 0 || now - Date.parse(t.last_at) < RECENT))
      .map((t) => ({
        id: `message:${t.id}`,
        at: Date.parse(t.last_at),
        title: t.unread > 1 ? `${t.unread} new messages from ${t.name}` : `Message from ${t.name}`,
        body: previewOf({ body: t.last_body, files: t.last_files }),
        path: `messages/${t.id}`,
        live: t.unread > 0,
      }))
  }
  ownerName ??= api.fetchOwner().then((row) => row?.name || 'the owner', () => 'the owner')
  const [count, latest, from] = await Promise.all([api.fetchUnread(), api.fetchLatestFromOwner(), ownerName])
  if (!latest) return []
  const at = Date.parse(latest.created_at)
  if (!count && now - at > RECENT) return []
  return [{
    id: 'message:owner',
    at,
    title: count > 1 ? `${count} new messages from ${from}` : `Message from ${from}`,
    body: previewOf(latest),
    path: 'messages',
    live: count > 0,
  }]
}

async function cardItems(now) {
  const api = await import('./boards-api')
  const chased = new Map()
  for (const board of await api.fetchBoards(false, { mine: true })) {
    const remind = remindOf(board)
    if (remind.on && !remind.quiet) chased.set(board.id, remind)
  }
  if (!chased.size) return []
  const ahead = Math.max(0, ...[...chased.values()].flatMap((remind) => remind.lead.map(stepSeconds)))
  const rows = await api.fetchAgenda(Math.ceil(ahead / 86400) + 1)
  return rows.flatMap((row) => {
    const remind = chased.get(row.board_id)
    const due = Date.parse(row.due)
    if (!remind || !Number.isFinite(due)) return []
    const at = raisedAt(due, remind, now)
    if (at === null) return []
    return [{
      id: `card:${row.card_id}`,
      at,
      title: row.title,
      body: `${due <= now ? 'Was due' : 'Due'} ${gapWords(due, now)} · ${row.board_name}`,
      path: `boards/${row.board_id}/${row.card_id}`,
    }]
  })
}

function reviewTitle(review) {
  if (review.pending) return 'Review awaiting approval'
  if (review.auto) return 'Invite expired — review posted for them'
  if (review.invited) return 'Invited review posted'
  return 'New review'
}

async function reviewItems(token, now) {
  const { fetchPanel } = await import('./api')
  const data = await fetchPanel({ bearer: token })
  return (data?.reviews || [])
    .filter((r) => r.pending || (!r.hidden && now - Date.parse(r.at) < RECENT))
    .map((r) => ({
      id: `review:${r.id}`,
      at: Date.parse(r.at),
      title: reviewTitle(r),
      body: `${r.name} · ${r.rating}★${r.text ? ` · ${r.text}` : ''}`,
      path: 'reviewpanel/reviews',
    }))
}

async function errorItems() {
  const { fetchLogs, SOURCE_LABEL } = await import('./logs-api')
  const data = await fetchLogs({ levels: ['error'], range: '24h' }, { limit: 5 })
  return (data?.items || []).map((e) => ({
    id: `log:${e.id}`,
    at: Date.parse(e.last || e.at),
    title: `${SOURCE_LABEL[e.source] || 'Server'} error${e.count > 1 ? ` ×${e.count}` : ''}`,
    body: e.message,
    path: 'logs',
  }))
}

export function refreshNotifications() {
  if (inflight) return inflight
  const session = currentSession()
  const user = session?.user
  if (!user) return Promise.resolve()
  const me = user.id
  if (me !== uid) {
    uid = me
    ownerName = null
    blocked.clear()
    emit({ ...EMPTY, ...loadMarks(me) })
  }

  const now = Date.now()
  const owner = isSiteOwner(user) && mfaSatisfied(session)
  const jobs = [
    ['messages', () => (user.is_anonymous ? [] : messageItems(owner, now))],
    ['cards', () => cardItems(now)],
    ...(owner ? [['reviews', () => reviewItems(session.access_token, now)], ['logs', () => errorItems()]] : []),
  ].filter(([name]) => !blocked.has(name))

  inflight = Promise.allSettled(jobs.map(([, run]) => run()))
    .then((results) => {
      if (uid !== me) return
      results.forEach((result, i) => {
        if (result.status === 'rejected' && GIVE_UP.includes(result.reason?.status)) blocked.add(jobs[i][0])
      })
      const failed = results.length > 0 && results.every((result) => result.status === 'rejected')
      if (failed && state.items) return emit({ failed })
      const items = results
        .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
        .filter((item) => Number.isFinite(item.at))
        .sort((a, b) => b.at - a.at)
        .slice(0, SHOWN)
      emit({ items, failed })
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function markRead(item) {
  if (!uid || !isUnread(item)) return
  const read = Object.fromEntries(Object.entries(state.read).filter(([, at]) => at > state.seen))
  emit({ read: { ...read, [item.id]: item.at } })
  saveMarks()
}

export function markAllRead() {
  if (!uid) return
  const newest = Math.max(0, ...(state.items || []).map((item) => item.at))
  emit({ seen: Math.max(Date.now(), newest), read: {} })
  saveMarks()
}

function tick() {
  if (document.visibilityState === 'visible') refreshNotifications()
}

function subscribe(fn) {
  listeners.add(fn)
  if (listeners.size === 1) {
    refreshNotifications()
    timer = setInterval(tick, EVERY)
    document.addEventListener('visibilitychange', tick)
  }
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = null
      document.removeEventListener('visibilitychange', tick)
    }
  }
}

const getSnapshot = () => state
const getServerSnapshot = () => EMPTY

export function useNotifications() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
