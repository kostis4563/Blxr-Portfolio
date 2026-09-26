import { supabase, loadSupabase, currentSession } from './supabase'
import { LIMITS, TYPING_EVERY } from './messages'
import { extensionFor } from './boards-files'
import { shortId } from './boards'

await loadSupabase()

export class MessageError extends Error {
  constructor(message, { status = 0, setup = false } = {}) {
    super(message)
    this.name = 'MessageError'
    this.status = status
    this.setup = setup
  }
}

const BUCKET = 'messages'
const SIGNED_TTL = 60 * 60

function client() {
  const sb = supabase()
  if (!sb) throw new MessageError('Messages need an account, and sign-in is not configured on this build.')
  return sb
}

export const myId = () => currentSession()?.user?.id || null

const SETUP_MESSAGE = 'Messages are not set up on this project yet — run deploy/supabase/messages.sql in the Supabase SQL editor.'

function lift(error, what) {
  if (!error) return null
  const text = String(error.message || '')
  if (['42P01', 'PGRST202', 'PGRST205'].includes(error.code)) {
    return new MessageError(SETUP_MESSAGE, { status: 501, setup: true })
  }
  if (error.code === '23514') {
    if (text.includes('body_len')) return new MessageError(`A message has to fit in ${LIMITS.body} characters.`)
    if (text.includes('files_shape')) return new MessageError(`A message takes at most ${LIMITS.files} files.`)
    if (text.includes('files_ok')) return new MessageError('That attachment does not belong to this conversation.')
    if (text.includes('has_content')) return new MessageError('There is nothing in that message to send.')
    return new MessageError('That is outside what a message accepts.')
  }
  if (error.code === '42501' || error.code === 'PGRST301' || text.includes('not yours') || text.includes('only the sender')) {
    return new MessageError('That is not yours to change.', { status: 403 })
  }
  if (text.includes('was unsent')) return new MessageError('That message was unsent.', { status: 410 })
  if (error.code === 'PGRST116') return new MessageError('That conversation is gone.', { status: 404 })
  if (text.toLowerCase().includes('failed to fetch')) {
    return new MessageError('No connection — that was not sent.', { status: 0 })
  }
  return new MessageError(what ? `${what}: ${text}` : text, { status: error.status || 0 })
}

function unwrap({ data, error }, what) {
  if (error) throw lift(error, what)
  return data
}

export async function amOwner() {
  return Boolean(unwrap(await client().rpc('is_site_owner'), 'Your role could not be checked'))
}

export async function openThread() {
  return unwrap(await client().rpc('messages_open'), 'Your conversation could not be opened')
}

export async function fetchOwner() {
  const rows = unwrap(await client().rpc('messages_owner'), 'The other side could not be loaded')
  return rows?.[0] || null
}

export async function fetchInbox() {
  return unwrap(await client().rpc('messages_inbox'), 'The inbox could not be loaded') || []
}

export async function fetchUnread() {
  return unwrap(await client().rpc('messages_unread')) || 0
}

const THREAD_COLUMNS = 'id, member, member_seen_at, owner_seen_at, created_at, updated_at'
const MESSAGE_COLUMNS = 'id, thread_id, author, from_owner, body, files, reply_to, reactions, edited_at, deleted_at, created_at, updated_at'

export async function fetchThread(id) {
  const row = unwrap(await client().from('threads').select(THREAD_COLUMNS).eq('id', id).maybeSingle(), 'That conversation could not be loaded')
  if (!row) throw new MessageError('That conversation is gone.', { status: 404 })
  return row
}

export async function fetchMessages(threadId, { before = null, limit = LIMITS.page } = {}) {
  let query = client().from('messages').select(MESSAGE_COLUMNS).eq('thread_id', threadId).order('created_at', { ascending: false }).limit(limit + 1)
  if (before) query = query.lt('created_at', before)
  const rows = unwrap(await query, 'Messages could not be loaded') || []
  const more = rows.length > limit
  return { messages: rows.slice(0, limit).reverse(), more }
}

export async function fetchChanged(threadId, since) {
  const rows = unwrap(
    await client().from('messages').select(MESSAGE_COLUMNS).eq('thread_id', threadId).gt('updated_at', since).order('created_at'),
    'Messages could not be refreshed',
  )
  return rows || []
}

export async function sendMessage(threadId, { body = '', files = [], replyTo = null }) {
  const row = unwrap(
    await client()
      .from('messages')
      .insert({ thread_id: threadId, author: myId(), body, files, reply_to: replyTo })
      .select(MESSAGE_COLUMNS)
      .single(),
    'That could not be sent',
  )
  return row
}

export async function editMessage(id, body) {
  return unwrap(await client().from('messages').update({ body }).eq('id', id).select(MESSAGE_COLUMNS).single(), 'That edit was not saved')
}

export async function reactMessage(id, reactions) {
  return unwrap(await client().from('messages').update({ reactions }).eq('id', id).select(MESSAGE_COLUMNS).single(), 'That reaction was not saved')
}

export async function unsendMessage(message) {
  const row = unwrap(
    await client().from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', message.id).select(MESSAGE_COLUMNS).single(),
    'That could not be unsent',
  )
  const paths = (message.files || []).flatMap((file) => [file.path, file.thumb]).filter(Boolean)
  if (paths.length) await client().storage.from(BUCKET).remove(paths)
  return row
}

export async function markSeen(threadId) {
  unwrap(await client().rpc('messages_seen', { thread: threadId }))
}

export async function deleteThread(threadId) {
  const { data: listed } = await client().storage.from(BUCKET).list(threadId, { limit: 1000 })
  const paths = (listed || []).map((entry) => `${threadId}/${entry.name}`)
  if (paths.length) await client().storage.from(BUCKET).remove(paths)
  unwrap(await client().from('threads').delete().eq('id', threadId), 'That conversation could not be cleared')
}

const signed = new Map()

export async function signedUrl(path) {
  if (!path) return null
  const held = signed.get(path)
  if (held && held.until > Date.now()) return held.url
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
  if (error || !data?.signedUrl) return null
  signed.set(path, { url: data.signedUrl, until: Date.now() + (SIGNED_TTL - 120) * 1000 })
  return data.signedUrl
}

async function upload(path, blob, contentType) {
  const { error } = await client().storage.from(BUCKET).upload(path, blob, { contentType, upsert: false })
  if (error) {
    if (String(error.message || '').toLowerCase().includes('bucket not found')) {
      throw new MessageError(SETUP_MESSAGE, { status: 501, setup: true })
    }
    throw lift(error, 'The file could not be uploaded')
  }
  return path
}

export async function uploadFile(threadId, prepared) {
  const id = shortId()
  const base = `${threadId}/${id}`
  const path = `${base}.${extensionFor(prepared.type)}`
  await upload(path, prepared.blob, prepared.type)
  let thumb = null
  if (prepared.thumb) {
    thumb = `${base}-thumb.webp`
    await upload(thumb, prepared.thumb, 'image/webp')
  }
  return { id, name: String(prepared.name || 'attachment').slice(0, 200), type: prepared.type, bytes: prepared.bytes, path, thumb }
}

export async function discardFile(entry) {
  const paths = [entry.path, entry.thumb].filter(Boolean)
  if (paths.length) await client().storage.from(BUCKET).remove(paths)
}

export async function downloadFile(entry) {
  const { data, error } = await client().storage.from(BUCKET).download(entry.path)
  if (error || !data) throw new MessageError('That file could not be fetched.')
  const url = URL.createObjectURL(data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = entry.name || 'file'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function channelOf(sb, topic, key) {
  return sb.channel(topic, { config: { private: true, presence: { key }, broadcast: { self: false, ack: false } } })
}

export function live(threadId, handlers = {}) {
  const sb = supabase()
  const uid = myId()
  if (!sb || !uid) return { typing() {}, leave() {}, state: () => 'CLOSED' }

  let status = 'JOINING'
  let lastTyped = 0
  const channel = channelOf(sb, `thread:${threadId}`, uid)

  channel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` }, (payload) => {
      handlers.onMessage?.(payload.new)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` }, (payload) => {
      handlers.onMessage?.(payload.new)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'threads', filter: `id=eq.${threadId}` }, (payload) => {
      handlers.onThread?.(payload.new)
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.uid && payload.uid !== uid) handlers.onTyping?.(payload.uid)
    })
    .on('presence', { event: 'sync' }, () => {
      const here = Object.keys(channel.presenceState()).filter((key) => key !== uid)
      handlers.onPresence?.(here)
    })
    .subscribe((next) => {
      status = next
      handlers.onStatus?.(next)
      if (next === 'SUBSCRIBED') channel.track({ at: Date.now() }).catch(() => {})
    })

  return {
    state: () => status,
    typing() {
      const now = Date.now()
      if (status !== 'SUBSCRIBED' || now - lastTyped < TYPING_EVERY) return
      lastTyped = now
      channel.send({ type: 'broadcast', event: 'typing', payload: { uid } }).catch(() => {})
    },
    leave() {
      sb.removeChannel(channel)
    },
  }
}

export function lobby(owner, handlers = {}) {
  const sb = supabase()
  const uid = myId()
  if (!sb || !uid) return { leave() {} }

  const channel = channelOf(sb, 'messages:lobby', uid)
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    handlers.onOwnerHere?.(Object.values(state).some((entries) => entries.some((entry) => entry.owner)))
  })
  if (owner) {
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => handlers.onMessage?.(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => handlers.onMessage?.(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'threads' }, (payload) => handlers.onThread?.(payload.new))
  }
  channel.subscribe((status) => {
    handlers.onStatus?.(status)
    if (status === 'SUBSCRIBED' && owner) channel.track({ owner: true, at: Date.now() }).catch(() => {})
  })

  return {
    leave() {
      sb.removeChannel(channel)
    },
  }
}
