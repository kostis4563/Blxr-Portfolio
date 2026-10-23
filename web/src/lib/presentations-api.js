import { supabase, loadSupabase, currentSession } from './supabase'
import { readArt, extensionFor } from './boards-files'
import { deckFrom, deckToRow, newToken, shortId, sortDecks, LIMITS, TOKEN_RE } from './presentations'

await loadSupabase()

export class PresentationError extends Error {
  constructor(code, { status = 0 } = {}) {
    super(code)
    this.name = 'PresentationError'
    this.code = code
    this.status = status
  }
}

export const ERROR_TEXT = {
  not_configured: 'Sign-in is not configured on this build, so there is nowhere to keep presentations.',
  not_set_up: 'Presentations are not set up on this project yet. Run deploy/supabase/presentations.sql in the Supabase SQL editor.',
  forbidden: 'That presentation is not yours to change.',
  guest: 'Presentations are for members. Claim your account to make one.',
  limit: `You have ${LIMITS.decks} presentations, which is the most an account keeps. Delete one to make room.`,
  too_big: 'This presentation got too big to save. Split it into two, or trim the longest slides.',
  invalid: 'The database refused that change. Check the slide and try again.',
  missing: 'That presentation is gone. It may have been deleted in another tab.',
  upload: 'The image could not be uploaded. Try a smaller PNG, JPEG, WebP or GIF.',
  offline: 'Could not reach the server, so that change is not saved yet.',
  failed: 'Something went wrong. Try again.',
}

export const errorText = (err) => (err?.code ? ERROR_TEXT[err.code] : err?.message) || ERROR_TEXT.failed

function wrap(error) {
  if (!error) return null
  if (error instanceof PresentationError) return error
  const msg = String(error.message || '').toLowerCase()
  let code = 'failed'
  if (['42P01', 'PGRST205', 'PGRST202', 'PGRST204', '42703', '42883'].includes(error.code) || msg.includes('bucket not found')) code = 'not_set_up'
  else if (msg.includes('presentation_limit')) code = 'limit'
  else if (error.code === '23514' && msg.includes('slides_size')) code = 'too_big'
  else if (error.code === '23514' || error.code === '22P02') code = 'invalid'
  else if (error.code === 'PGRST116') code = 'missing'
  else if (error.code === '42501' || error.code === 'PGRST301' || msg.includes('row-level security')) code = 'forbidden'
  else if (msg.includes('failed to fetch') || msg.includes('network')) code = 'offline'
  return new PresentationError(code, { status: error.status || error.statusCode || 0 })
}

function client() {
  const sb = supabase()
  if (!sb) throw new PresentationError('not_configured')
  return sb
}

async function run(fn) {
  let result
  try {
    result = await fn(client())
  } catch (err) {
    throw wrap(err) || new PresentationError('failed')
  }
  if (result?.error) throw wrap(result.error)
  return result?.data ?? null
}

const BUCKET = 'presentations'
const COLUMNS = 'id, title, theme, transition, numbers, slides, share_token, shared_at, created_at, updated_at'
const myId = () => currentSession()?.user?.id || null
const guest = () => Boolean(currentSession()?.user?.is_anonymous)

export async function listPresentations() {
  const rows = await run((sb) => sb.from('presentations').select(COLUMNS).order('updated_at', { ascending: false }))
  return sortDecks((rows || []).map(deckFrom))
}

export async function createPresentation(deck) {
  if (guest()) throw new PresentationError('guest', { status: 403 })
  const owner = myId()
  const row = { ...deckToRow(deck), ...(owner ? { owner } : null) }
  return deckFrom(await run((sb) => sb.from('presentations').insert(row).select(COLUMNS).single()))
}

export async function savePresentation(id, patch) {
  return deckFrom(await run((sb) => sb.from('presentations').update(deckToRow(patch)).eq('id', id).select(COLUMNS).single()))
}

export async function copyPresentation(deck) {
  const id = crypto.randomUUID()
  const slides = await Promise.all(
    deck.slides.map(async (slide) => ({ ...slide, id: shortId(), image: slide.image ? { ...slide.image, path: await copyImage(slide.image.path, id) } : null })),
  )
  const title = `${deck.title} (copy)`.slice(0, LIMITS.title)
  const owner = myId()
  const row = { id, ...deckToRow({ ...deck, title, slides }), ...(owner ? { owner } : null) }
  return deckFrom(await run((sb) => sb.from('presentations').insert(row).select(COLUMNS).single()))
}

export async function deletePresentation(deck) {
  await run((sb) => sb.from('presentations').delete().eq('id', deck.id))
  await removeFolder(deck.id)
}

export const setSharing = (id, on) => savePresentation(id, { shareToken: on ? newToken() : null })

export async function fetchShared(token) {
  if (!TOKEN_RE.test(token || '')) throw new PresentationError('missing', { status: 404 })
  const rows = await run((sb) => sb.rpc('shared_presentation', { token }))
  const row = Array.isArray(rows) ? rows[0] : rows
  if (!row) throw new PresentationError('missing', { status: 404 })
  return deckFrom(row)
}

function folderFor(deckId) {
  const me = myId()
  if (!me) throw new PresentationError('forbidden', { status: 401 })
  return `${me}/${deckId}`
}

export async function uploadSlideImage(deckId, file) {
  if (guest()) throw new PresentationError('guest', { status: 403 })
  let art
  try {
    art = await readArt(file, 'slide')
  } catch (err) {
    throw Object.assign(new PresentationError('upload'), { message: err.message, code: null })
  }
  const path = `${folderFor(deckId)}/${shortId()}.${extensionFor(art.type)}`
  await run((sb) => sb.storage.from(BUCKET).upload(path, art.blob, { contentType: art.type, upsert: false }))
  return path
}

async function copyImage(path, deckId) {
  const name = path.split('/').pop()
  const to = `${folderFor(deckId)}/${shortId()}.${name.split('.').pop()}`
  try {
    await run((sb) => sb.storage.from(BUCKET).copy(path, to))
    return to
  } catch {
    return null
  }
}

export async function removeSlideImages(paths) {
  const mine = paths.filter((path) => path && path.startsWith(`${myId()}/`))
  if (!mine.length) return
  try {
    await client().storage.from(BUCKET).remove(mine)
  } catch {
  }
}

async function removeFolder(deckId) {
  try {
    const sb = client()
    const root = folderFor(deckId)
    const { data } = await sb.storage.from(BUCKET).list(root, { limit: 1000 })
    const paths = (data || []).filter((entry) => entry.id).map((entry) => `${root}/${entry.name}`)
    if (paths.length) await sb.storage.from(BUCKET).remove(paths)
  } catch {
  }
}

const SIGNED_TTL = 3600
const signed = new Map()
let queue = null

function flushSigning() {
  const batch = queue
  queue = null
  let request
  try {
    request = client().storage.from(BUCKET).createSignedUrls([...batch.keys()], SIGNED_TTL)
  } catch {
    request = Promise.resolve({ data: null, error: true })
  }
  request
    .then(({ data, error }) => {
      const found = new Map()
      if (!error) for (const row of data || []) if (row?.signedUrl && !row.error) found.set(row.path, row.signedUrl)
      for (const [path, waiting] of batch) {
        const url = found.get(path) || null
        if (url) signed.set(path, { url, until: Date.now() + (SIGNED_TTL - 120) * 1000 })
        for (const settle of waiting) settle(url)
      }
    })
    .catch(() => {
      for (const waiting of batch.values()) for (const settle of waiting) settle(null)
    })
}

export function slideImageUrl(path) {
  if (!path) return Promise.resolve(null)
  const held = signed.get(path)
  if (held && held.until > Date.now()) return Promise.resolve(held.url)
  return new Promise((resolve) => {
    if (!queue) {
      queue = new Map()
      queueMicrotask(flushSigning)
    }
    queue.set(path, [...(queue.get(path) || []), resolve])
  })
}

export const cachedImageUrl = (path) => {
  const held = path ? signed.get(path) : null
  return held && held.until > Date.now() ? held.url : null
}

export function preloadImages(paths) {
  for (const path of new Set(paths)) {
    slideImageUrl(path).then((url) => {
      if (!url) return
      const image = new Image()
      image.decoding = 'async'
      image.src = url
    })
  }
}
