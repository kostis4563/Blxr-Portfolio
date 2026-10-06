import { supabase, loadSupabase, currentSession } from './supabase'
import { LIMITS, TYPING_EVERY, isSealed } from './messages'
import * as vault from './messages-crypto'
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
    if (text.includes('message_keys')) return new MessageError('That key was not accepted.')
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

const KEY_COLUMNS = 'kid, public_key, wrapped, salt, rounds, updated_at'

async function fetchMyKey() {
  return unwrap(await client().from('message_keys').select(KEY_COLUMNS).eq('member', myId()).maybeSingle(), 'Your key could not be loaded')
}

async function saveMyKey(row) {
  unwrap(await client().from('message_keys').upsert({ member: myId(), ...row }, { onConflict: 'member' }), 'Your key could not be saved')
  publicKeys.at = 0
}

export async function keyStatus() {
  if (!vault.supported()) return { state: 'unsupported' }
  const uid = myId()
  const [row, device] = await Promise.all([fetchMyKey(), vault.deviceIdentity(uid)])
  if (!row) {
    if (device) await vault.forget(uid)
    return { state: 'missing' }
  }
  if (device && device.kid === row.kid) return { state: 'ready', kid: row.kid, since: row.updated_at }
  if (device) await vault.forget(uid)
  return { state: 'locked', kid: row.kid, since: row.updated_at }
}

export async function createKey(passphrase) {
  const uid = myId()
  const { row, identity } = await vault.createIdentity(uid, passphrase)
  await saveMyKey(row)
  await vault.keepIdentity(uid, identity)
  opened.clear()
}

export async function unlockKey(passphrase) {
  const row = await fetchMyKey()
  if (!row) throw new MessageError('There is no key on this account yet.')
  try {
    await vault.unlockIdentity(myId(), row, passphrase)
  } catch (failure) {
    throw new MessageError(failure.message)
  }
  opened.clear()
}

export async function lockDevice() {
  await vault.forget(myId())
  opened.clear()
}

const publicKeys = { at: 0, rows: [], inflight: null }
const KEYS_FRESH = 60_000
const KEYS_RETRY = 5_000

async function loadKeys(force = false) {
  const age = Date.now() - publicKeys.at
  if (!force && age < KEYS_FRESH) return publicKeys.rows
  if (force && age < KEYS_RETRY) return publicKeys.rows
  publicKeys.inflight ??= client()
    .rpc('messages_public_keys')
    .then(({ data, error }) => {
      if (error) throw lift(error, 'Encryption keys could not be loaded')
      publicKeys.rows = data || []
      publicKeys.at = Date.now()
      return publicKeys.rows
    })
    .finally(() => {
      publicKeys.inflight = null
    })
  return publicKeys.inflight
}

async function keyOf(kid) {
  const find = (rows) => rows.find((row) => row.kid === kid)?.public_key || null
  return find(await loadKeys()) || find(await loadKeys(true))
}

async function peerOf(threadId, force = false) {
  const uid = myId()
  const find = (rows) => rows.find((row) => row.thread === threadId && row.member !== uid) || null
  return find(await loadKeys(force)) || (force ? null : find(await loadKeys(true)))
}

export async function conversation(threadId, { force = false } = {}) {
  const [identity, peer] = await Promise.all([vault.deviceIdentity(myId()), peerOf(threadId, force)])
  const code = identity && peer ? await vault.safetyCode(identity.publicKey, peer.public_key) : null
  return { kid: identity?.kid || null, peer: peer ? { kid: peer.kid, owner: peer.owner } : null, code, suite: vault.SUITE }
}

const opened = new Map()

async function openBody(threadId, body) {
  const id = `${threadId}|${body}`
  if (!opened.has(id)) {
    opened.set(
      id,
      vault.openText(body, { threadId, identity: await vault.deviceIdentity(myId()), keyOf }).then(
        (text) => ({ text }),
        (failure) => ({ text: '', broken: failure.reason || 'broken', why: failure.message }),
      ),
    )
  }
  const result = await opened.get(id)
  if (result.broken === 'locked' || result.broken === 'stale') opened.delete(id)
  return result
}

export async function openRow(row) {
  if (!row || !isSealed(row.body)) return row && { ...row, secure: false }
  const { text, broken, why } = await openBody(row.thread_id, row.body)
  return { ...row, body: text, cipher: row.body, secure: true, broken: broken || null, why: why || null }
}

const openRows = (rows) => Promise.all((rows || []).map(openRow))

export async function openPreview(threadId, body) {
  if (!isSealed(body)) return body
  const { text, broken } = await openBody(threadId, body)
  return broken ? body : text
}

async function seal(threadId, body) {
  const identity = await vault.deviceIdentity(myId())
  if (!identity) throw new MessageError('Unlock your key before you write — messages here are end-to-end encrypted.', { status: 423 })
  const peer = await peerOf(threadId)
  if (!peer || !body) return body
  return vault.sealText(body, { threadId, identity, peer })
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
  const rows = unwrap(await client().rpc('messages_inbox'), 'The inbox could not be loaded') || []
  return Promise.all(rows.map(async (row) => (isSealed(row.last_body) ? { ...row, last_body: await openPreview(row.id, row.last_body) } : row)))
}

export async function fetchUnread() {
  return unwrap(await client().rpc('messages_unread')) || 0
}

export async function fetchLatestFromOwner() {
  const rows = unwrap(
    await client().rpc('messages_latest').select('id, thread_id, body, files, deleted_at, created_at'),
    'The latest message could not be loaded',
  )
  return rows?.[0] ? openRow(rows[0]) : null
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
  return { messages: await openRows(rows.slice(0, limit).reverse()), more }
}

export async function fetchChanged(threadId, since) {
  const rows = unwrap(
    await client().from('messages').select(MESSAGE_COLUMNS).eq('thread_id', threadId).gt('updated_at', since).order('created_at'),
    'Messages could not be refreshed',
  )
  return openRows(rows)
}

export async function sendMessage(threadId, { body = '', files = [], replyTo = null }) {
  const row = unwrap(
    await client()
      .from('messages')
      .insert({ thread_id: threadId, author: myId(), body: await seal(threadId, body), files, reply_to: replyTo })
      .select(MESSAGE_COLUMNS)
      .single(),
    'That could not be sent',
  )
  return openRow(row)
}

export async function editMessage(message, body) {
  const sealed = await seal(message.thread_id, body)
  return openRow(unwrap(await client().from('messages').update({ body: sealed }).eq('id', message.id).select(MESSAGE_COLUMNS).single(), 'That edit was not saved'))
}

export async function reactMessage(id, reactions) {
  return openRow(unwrap(await client().from('messages').update({ reactions }).eq('id', id).select(MESSAGE_COLUMNS).single(), 'That reaction was not saved'))
}

export async function unsendMessage(message) {
  const row = unwrap(
    await client().from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', message.id).select(MESSAGE_COLUMNS).single(),
    'That could not be unsent',
  )
  const paths = (message.files || []).flatMap((file) => [file.path, file.thumb]).filter(Boolean)
  if (paths.length) await client().storage.from(BUCKET).remove(paths)
  return openRow(row)
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
  const identity = await vault.deviceIdentity(myId())
  if (!identity) throw new MessageError('Unlock your key before you attach anything.', { status: 423 })
  const peer = await peerOf(threadId)
  let tag = null
  const put = async (target, blob, type) => {
    if (!peer) return upload(target, blob, type)
    const sealed = await vault.sealBytes(await blob.arrayBuffer(), { threadId, identity, peer, path: target })
    tag = sealed.tag
    return upload(target, new Blob([sealed.blob], { type }), type)
  }
  await put(path, prepared.blob, prepared.type)
  let thumb = null
  if (prepared.thumb) {
    thumb = `${base}-thumb.webp`
    await put(thumb, prepared.thumb, 'image/webp')
  }
  const entry = { id, name: String(prepared.name || 'attachment').slice(0, 200), type: prepared.type, bytes: prepared.bytes, path, thumb }
  return tag ? { ...entry, enc: tag } : entry
}

const unsealed = new Map()

async function openFile(path, tag, type) {
  const { data, error } = await client().storage.from(BUCKET).download(path)
  if (error || !data) throw new MessageError('That file could not be fetched.')
  if (!tag) return data
  const plain = await vault.openBytes(await data.arrayBuffer(), tag, { threadId: path.split('/')[0], identity: await vault.deviceIdentity(myId()), keyOf, path })
  return new Blob([plain], type ? { type } : {})
}

export async function fileUrl(path, tag) {
  if (!path) return null
  if (!tag) return signedUrl(path)
  if (!unsealed.has(path)) {
    unsealed.set(
      path,
      openFile(path, tag, path.endsWith('-thumb.webp') ? 'image/webp' : '').then(
        (blob) => URL.createObjectURL(blob),
        (failure) => {
          unsealed.delete(path)
          throw failure
        },
      ),
    )
  }
  return unsealed.get(path).catch(() => null)
}

export async function discardFile(entry) {
  const paths = [entry.path, entry.thumb].filter(Boolean)
  if (paths.length) await client().storage.from(BUCKET).remove(paths)
}

export async function downloadFile(entry) {
  let data
  try {
    data = await openFile(entry.path, entry.enc, entry.type)
  } catch (failure) {
    throw failure instanceof MessageError ? failure : new MessageError(failure.message)
  }
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
      openRow(payload.new).then((row) => handlers.onMessage?.(row))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` }, (payload) => {
      openRow(payload.new).then((row) => handlers.onMessage?.(row))
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
