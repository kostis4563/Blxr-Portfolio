import { supabase, loadSupabase } from './supabase'
import { BUCKET, LIMITS, fromRow, toRow, sortEvents } from './volunteer'

await loadSupabase()

export class VolunteerError extends Error {
  constructor(code, { status = 0 } = {}) {
    super(code)
    this.name = 'VolunteerError'
    this.code = code
    this.status = status
  }
}

export const ERROR_TEXT = {
  not_configured: 'Sign-in is not configured on this build, so there is nowhere to load events from.',
  not_set_up: 'Volunteering is not set up on this project yet. Run deploy/supabase/volunteer.sql in the Supabase SQL editor.',
  uploads_disabled: 'The volunteer photo bucket is missing. Run deploy/supabase/volunteer.sql again.',
  forbidden: 'Only the site owner can change events. If that is you, sign out and back in with two-factor.',
  invalid: 'The database refused this event. Check the fields and try again.',
  bad_image: 'That file could not be read as an image.',
  too_large: 'That photo is too big, even after shrinking it.',
  too_many: `An event holds at most ${LIMITS.photos} photos.`,
  offline: 'Could not reach the server. Check your connection and try again.',
  failed: 'Something went wrong. Try again.',
}

export const errorText = (err) => ERROR_TEXT[err?.code] || ERROR_TEXT.failed

function wrap(error) {
  if (!error) return null
  if (error instanceof VolunteerError) return error
  const msg = String(error.message || '').toLowerCase()
  let code = 'failed'
  if (['42P01', 'PGRST205', 'PGRST202'].includes(error.code)) code = 'not_set_up'
  else if (error.code === '42501' || error.code === 'PGRST301' || msg.includes('row-level security')) code = 'forbidden'
  else if (error.code === '23514' || error.code === '22P02' || error.code === '22007') code = 'invalid'
  else if (msg.includes('bucket not found')) code = 'uploads_disabled'
  else if (msg.includes('payload too large') || msg.includes('exceeded the maximum allowed size')) code = 'too_large'
  else if (msg.includes('mime type')) code = 'bad_image'
  else if (msg.includes('failed to fetch') || msg.includes('network')) code = 'offline'
  return new VolunteerError(code, { status: error.status || error.statusCode || 0 })
}

function client() {
  const sb = supabase()
  if (!sb) throw new VolunteerError('not_configured')
  return sb
}

async function run(fn) {
  let result
  try {
    result = await fn(client())
  } catch (err) {
    throw wrap(err) || new VolunteerError('failed')
  }
  if (result?.error) throw wrap(result.error)
  return result?.data ?? null
}

export async function listEvents() {
  const rows = await run((sb) => sb.from('volunteer_events').select('*').order('started_on', { ascending: false }))
  return sortEvents((rows || []).map(fromRow))
}

export async function saveEvent(event, { isNew }) {
  const row = toRow(event)
  const query = (sb) =>
    isNew
      ? sb.from('volunteer_events').insert(row).select('*').single()
      : sb.from('volunteer_events').update(row).eq('id', event.id).select('*').single()
  return fromRow(await run(query))
}

export async function deleteEvent(event) {
  await run((sb) => sb.from('volunteer_events').delete().eq('id', event.id))
  await removePhotos(event.photos).catch(() => {})
}

export async function removePhotos(paths) {
  if (!paths?.length) return
  await run((sb) => sb.storage.from(BUCKET).remove(paths))
}

const MAX_EDGE = 1800

async function toWebp(file) {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new VolunteerError('bad_image')
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  for (const quality of [0.84, 0.72, 0.6]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob || blob.type !== 'image/webp') throw new VolunteerError('bad_image')
    if (blob.size <= 2 * 1024 * 1024) return blob
  }
  throw new VolunteerError('too_large')
}

const slugOf = (name) =>
  String(name || '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'photo'

export async function uploadPhoto(eventId, file) {
  if (!file.type.startsWith('image/')) throw new VolunteerError('bad_image')
  if (file.size > 25 * 1024 * 1024) throw new VolunteerError('too_large')
  const blob = await toWebp(file)
  const path = `${eventId}/${slugOf(file.name)}-${Math.random().toString(16).slice(2, 8)}.webp`
  await run((sb) => sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false }))
  return path
}
