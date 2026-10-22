import { supabase, loadSupabase } from './supabase'
import { fromRow, toRow } from './day'
import { homeworkFromRow, homeworkToRow } from './homework'

await loadSupabase()

export class DayError extends Error {
  constructor(code, { status = 0 } = {}) {
    super(code)
    this.name = 'DayError'
    this.code = code
    this.status = status
  }
}

export const ERROR_TEXT = {
  not_configured: 'Sign-in is not configured on this build, so there is nowhere to keep your day.',
  not_set_up: 'My day is not set up on this project yet. Run deploy/supabase/day.sql in the Supabase SQL editor.',
  forbidden: 'Only the site owner can plan here. If that is you, sign out and back in with two-factor.',
  invalid: 'The database refused this. Check the fields and try again.',
  offline: 'Could not reach the server. Check your connection and try again.',
  failed: 'Something went wrong. Try again.',
}

export const errorText = (err) => ERROR_TEXT[err?.code] || ERROR_TEXT.failed

function wrap(error) {
  if (!error) return null
  if (error instanceof DayError) return error
  const msg = String(error.message || '').toLowerCase()
  let code = 'failed'
  if (['42P01', 'PGRST205', 'PGRST202', 'PGRST204', '42703'].includes(error.code)) code = 'not_set_up'
  else if (error.code === '42501' || error.code === 'PGRST301' || msg.includes('row-level security')) code = 'forbidden'
  else if (error.code === '23514' || error.code === '22P02' || error.code === '22007' || error.code === '22008') code = 'invalid'
  else if (msg.includes('failed to fetch') || msg.includes('network')) code = 'offline'
  return new DayError(code, { status: error.status || error.statusCode || 0 })
}

function client() {
  const sb = supabase()
  if (!sb) throw new DayError('not_configured')
  return sb
}

async function run(fn) {
  let result
  try {
    result = await fn(client())
  } catch (err) {
    throw wrap(err) || new DayError('failed')
  }
  if (result?.error) throw wrap(result.error)
  return result?.data ?? null
}

export async function listBlocks({ from, to }) {
  const [routines, dated] = await Promise.all([
    run((sb) => sb.from('day_blocks').select('*').gt('repeat', 0)),
    run((sb) => sb.from('day_blocks').select('*').eq('repeat', 0).gte('day', from).lte('day', to)),
  ])
  return [...(routines || []), ...(dated || [])].map(fromRow)
}

export async function saveBlock(block, { isNew }) {
  const row = toRow(block)
  const query = (sb) =>
    isNew
      ? sb.from('day_blocks').insert(row).select('*').single()
      : sb.from('day_blocks').update(row).eq('id', block.id).select('*').single()
  return fromRow(await run(query))
}

export async function markBlock(id, marks) {
  await run((sb) => sb.from('day_blocks').update(marks).eq('id', id))
}

export async function deleteBlock(id) {
  await run((sb) => sb.from('day_blocks').delete().eq('id', id))
}

export async function listHomework({ since }) {
  const [open, finished] = await Promise.all([
    run((sb) => sb.from('day_homework').select('*').is('done_on', null)),
    run((sb) => sb.from('day_homework').select('*').gte('done_on', since)),
  ])
  return [...(open || []), ...(finished || [])].map(homeworkFromRow)
}

export async function saveHomework(item, { isNew }) {
  const row = homeworkToRow(item)
  const query = (sb) =>
    isNew
      ? sb.from('day_homework').insert(row).select('*').single()
      : sb.from('day_homework').update(row).eq('id', item.id).select('*').single()
  return homeworkFromRow(await run(query))
}

export async function markHomework(id, doneOn) {
  await run((sb) => sb.from('day_homework').update({ done_on: doneOn }).eq('id', id))
}

export async function deleteHomework(id) {
  await run((sb) => sb.from('day_homework').delete().eq('id', id))
}
