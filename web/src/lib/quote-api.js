import { supabase, loadSupabase } from './supabase'
import { fromRow, toRow, sortQuotes } from './quote'

await loadSupabase()

export class QuoteError extends Error {
  constructor(code, { status = 0 } = {}) {
    super(code)
    this.name = 'QuoteError'
    this.code = code
    this.status = status
  }
}

export const ERROR_TEXT = {
  not_configured: 'Sign-in is not configured on this build, so there is nowhere to load quotes from.',
  not_set_up: 'Quotes are not set up on this project yet. Run deploy/supabase/quotes.sql in the Supabase SQL editor.',
  forbidden: 'Only the site owner can change quotes. If that is you, sign out and back in with two-factor.',
  taken: 'Another quote already uses that link. Pick a different one.',
  invalid: 'The database refused this quote. Check the fields and try again.',
  offline: 'Could not reach the server. Check your connection and try again.',
  failed: 'Something went wrong. Try again.',
}

export const errorText = (err) => ERROR_TEXT[err?.code] || ERROR_TEXT.failed

function wrap(error) {
  if (!error) return null
  if (error instanceof QuoteError) return error
  const msg = String(error.message || '').toLowerCase()
  let code = 'failed'
  if (['42P01', 'PGRST205', 'PGRST202', 'PGRST204', '42703'].includes(error.code)) code = 'not_set_up'
  else if (error.code === '42501' || error.code === 'PGRST301' || msg.includes('row-level security')) code = 'forbidden'
  else if (error.code === '23505') code = 'taken'
  else if (error.code === '23514' || error.code === '22P02' || error.code === '22007') code = 'invalid'
  else if (msg.includes('failed to fetch') || msg.includes('network')) code = 'offline'
  return new QuoteError(code, { status: error.status || error.statusCode || 0 })
}

function client() {
  const sb = supabase()
  if (!sb) throw new QuoteError('not_configured')
  return sb
}

async function run(fn) {
  let result
  try {
    result = await fn(client())
  } catch (err) {
    throw wrap(err) || new QuoteError('failed')
  }
  if (result?.error) throw wrap(result.error)
  return result?.data ?? null
}

export async function listQuotes({ includeHidden = false } = {}) {
  const rows = await run((sb) => {
    const query = sb.from('quotes').select('*')
    return (includeHidden ? query : query.eq('published', true)).order('added_on', { ascending: false })
  })
  return sortQuotes((rows || []).map(fromRow))
}

export async function saveQuote(quote, { isNew }) {
  const row = toRow(quote)
  const query = (sb) =>
    isNew
      ? sb.from('quotes').insert(row).select('*').single()
      : sb.from('quotes').update(row).eq('id', quote.id).select('*').single()
  return fromRow(await run(query))
}

export async function deleteQuote(id) {
  await run((sb) => sb.from('quotes').delete().eq('id', id))
}
