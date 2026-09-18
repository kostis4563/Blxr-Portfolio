import { supabase, currentSession } from './supabase'
import { LIMITS, STARTING_LISTS, shortId, sortCards, positionFor, needsRenumber, POSITION_STEP } from './boards'
import { extensionFor } from './boards-files'

export class BoardError extends Error {
  constructor(message, { status = 0, setup = false } = {}) {
    super(message)
    this.name = 'BoardError'
    this.status = status
    this.setup = setup
  }
}

const BUCKET = 'boards'

function client() {
  const sb = supabase()
  if (!sb) throw new BoardError('Boards need an account, and sign-in is not configured on this build.')
  return sb
}

const myId = () => currentSession()?.user?.id || null

const SETUP_MESSAGE = 'Boards are not set up on this project yet — run deploy/supabase/boards.sql in the Supabase SQL editor.'

function lift(error, what) {
  if (!error) return null
  const text = String(error.message || '')
  if (['42P01', 'PGRST202', 'PGRST205'].includes(error.code)) {
    return new BoardError(SETUP_MESSAGE, { status: 501, setup: true })
  }
  if (error.code === '23514') {
    if (text.includes('lists_shape')) return new BoardError(`A board takes at most ${LIMITS.lists} columns.`)
    if (text.includes('labels_shape')) return new BoardError(`A board takes at most ${LIMITS.labels} labels.`)
    if (text.includes('checklist_shape')) return new BoardError(`A card takes at most ${LIMITS.steps} steps.`)
    if (text.includes('comments_shape')) return new BoardError(`A card takes at most ${LIMITS.comments} comments.`)
    if (text.includes('links_shape')) return new BoardError(`A card takes at most ${LIMITS.links} links.`)
    if (text.includes('files_shape')) return new BoardError(`A card takes at most ${LIMITS.files} files.`)
    if (text.includes('title_len')) return new BoardError(`A card title has to fit in ${LIMITS.title} characters.`)
    if (text.includes('name_len')) return new BoardError(`A board name has to fit in ${LIMITS.name} characters.`)
    if (text.includes('note_len')) return new BoardError(`A board description has to fit in ${LIMITS.note} characters.`)
    if (text.includes('notes_len')) return new BoardError(`Card notes have to fit in ${LIMITS.notes} characters.`)
    return new BoardError('That value is outside what a board accepts.')
  }
  if (error.code === '42501' || error.code === 'PGRST301') {
    return new BoardError('That board is not yours to change.', { status: 403 })
  }
  if (error.code === 'PGRST116') return new BoardError('That board is gone.', { status: 404 })
  if (text.toLowerCase().includes('failed to fetch')) {
    return new BoardError('No connection — that change was not saved.', { status: 0 })
  }
  return new BoardError(what ? `${what}: ${text}` : text, { status: error.status || 0 })
}

function unwrap({ data, error }, what) {
  if (error) throw lift(error, what)
  return data
}

const BOARD_COLUMNS = 'id, owner, name, note, colour, purpose, facts, lists, labels, remind, art, archived, seq, rev, created_at, updated_at'
const INDEX_COLUMNS = `${BOARD_COLUMNS}, count_cards, count_done, count_overdue, count_soon, count_archived`
const CARD_COLUMNS =
  'id, board_id, seq, list_id, position, title, notes, done, archived, due, labels, checklist, comments, links, files, activity, deleted_at, completed_at, created_at, updated_at'

export async function fetchBoards(archived = false) {
  const rows = unwrap(
    await client().from('board_index').select(INDEX_COLUMNS).eq('archived', archived).order('updated_at', { ascending: false }),
    'Boards could not be loaded',
  )
  return (rows || []).map(shapeBoard)
}

export async function fetchBoard(id) {
  const sb = client()
  const [board, cards] = await Promise.all([
    sb.from('boards').select(BOARD_COLUMNS).eq('id', id).maybeSingle(),
    sb.from('board_cards').select(CARD_COLUMNS).eq('board_id', id).is('deleted_at', null).order('position'),
  ])
  const record = unwrap(board, 'That board could not be loaded')
  if (!record) throw new BoardError('That board is gone — it was deleted, or it was never yours.', { status: 404 })
  return { board: shapeBoard(record), cards: unwrap(cards, 'Cards could not be loaded') || [] }
}

export async function fetchRev(id) {
  const row = unwrap(await client().from('boards').select('rev').eq('id', id).maybeSingle())
  return row ? row.rev : null
}

export async function fetchAgenda(days = 14) {
  const rows = unwrap(await client().rpc('boards_agenda', { horizon: `${days} days` }), 'The agenda could not be loaded')
  return rows || []
}

export async function fetchBin(boardId) {
  const rows = unwrap(
    await client()
      .from('board_cards')
      .select(CARD_COLUMNS)
      .eq('board_id', boardId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(20),
    'The bin could not be read',
  )
  return rows || []
}

export async function sweepBin() {
  try {
    await client().rpc('boards_sweep_bin')
  } catch {
  }
}

function shapeBoard(row) {
  return {
    ...row,
    note: row.note || '',
    facts: row.facts || {},
    lists: Array.isArray(row.lists) ? row.lists : [],
    labels: Array.isArray(row.labels) ? row.labels : [],
    remind: row.remind || {},
    art: row.art || {},
    counts: {
      cards: row.count_cards ?? 0,
      done: row.count_done ?? 0,
      overdue: row.count_overdue ?? 0,
      soon: row.count_soon ?? 0,
      archived: row.count_archived ?? 0,
    },
  }
}

export async function createBoard({ name, note = '', colour = 'violet', purpose = 'personal', facts = {} }) {
  const owner = myId()
  if (!owner) throw new BoardError('Sign in first.')
  const lists = STARTING_LISTS.map((label, index) => ({
    id: shortId(),
    name: label,
    done: index === STARTING_LISTS.length - 1,
    cap: null,
  }))
  const row = unwrap(
    await client()
      .from('boards')
      .insert({ owner, name, note, colour, purpose, facts, lists })
      .select(BOARD_COLUMNS)
      .single(),
    'The board could not be created',
  )
  return shapeBoard(row)
}

export async function updateBoard(id, changes) {
  const row = unwrap(
    await client().from('boards').update(changes).eq('id', id).select(BOARD_COLUMNS).single(),
    'That change could not be saved',
  )
  return shapeBoard(row)
}

export async function deleteBoard(id) {
  await removeFolder(id)
  unwrap(await client().from('boards').delete().eq('id', id), 'The board could not be deleted')
}

export async function addList(board, name) {
  if (board.lists.length >= LIMITS.lists) throw new BoardError(`A board takes at most ${LIMITS.lists} columns.`)
  const lists = [...board.lists, { id: shortId(), name, done: false, cap: null }]
  return updateBoard(board.id, { lists })
}

export async function updateList(board, listId, changes) {
  const lists = board.lists.map((entry) => (entry.id === listId ? { ...entry, ...changes } : entry))
  return updateBoard(board.id, { lists })
}

export async function removeList(board, listId, keep = null) {
  const lists = board.lists.filter((entry) => entry.id !== listId)
  if (keep) {
    const target = board.lists.find((entry) => entry.id === keep)
    if (!target) throw new BoardError('That column is gone.')
    unwrap(
      await client().from('board_cards').update({ list_id: keep }).eq('board_id', board.id).eq('list_id', listId),
      'Those cards could not be moved',
    )
  } else {
    unwrap(
      await client()
        .from('board_cards')
        .update({ deleted_at: new Date().toISOString() })
        .eq('board_id', board.id)
        .eq('list_id', listId)
        .is('deleted_at', null),
      'Those cards could not be removed',
    )
  }
  return updateBoard(board.id, { lists })
}

export async function moveList(board, listId, index) {
  const lists = [...board.lists]
  const from = lists.findIndex((entry) => entry.id === listId)
  if (from < 0) return board
  const [held] = lists.splice(from, 1)
  lists.splice(Math.max(0, Math.min(lists.length, index)), 0, held)
  return updateBoard(board.id, { lists })
}

export async function sortList(boardId, listId, cards, by) {
  const ordered = sortCards(cards, by)
  await Promise.all(
    ordered.map((card, index) =>
      client().from('board_cards').update({ position: (index + 1) * POSITION_STEP }).eq('id', card.id),
    ),
  )
}

export async function setLabel(board, label) {
  const held = board.labels || []
  const existing = held.find((entry) => entry.id === label.id)
  if (!existing && held.length >= LIMITS.labels) throw new BoardError(`A board takes at most ${LIMITS.labels} labels.`)
  const labels = existing
    ? held.map((entry) => (entry.id === label.id ? { ...entry, ...label } : entry))
    : [...held, { id: label.id || shortId(), name: label.name, colour: label.colour }]
  return updateBoard(board.id, { labels })
}

export async function removeLabel(board, labelId, cards) {
  const labels = (board.labels || []).filter((entry) => entry.id !== labelId)
  const wearing = (cards || []).filter((card) => (card.labels || []).includes(labelId))
  await Promise.all(
    wearing.map((card) =>
      client()
        .from('board_cards')
        .update({ labels: card.labels.filter((id) => id !== labelId) })
        .eq('id', card.id),
    ),
  )
  return updateBoard(board.id, { labels })
}

const trail = (card, what, detail = {}) =>
  [...(card.activity || []), { at: new Date().toISOString(), what, detail }].slice(-LIMITS.activity)

export async function createCard(board, listId, title, { atTop = false, siblings = [] } = {}) {
  const ordered = [...siblings].sort((a, b) => a.position - b.position)
  const position = atTop ? positionFor(ordered, 0) : positionFor(ordered, ordered.length)
  const row = unwrap(
    await client()
      .from('board_cards')
      .insert({
        board_id: board.id,
        owner: myId(),
        list_id: listId,
        position,
        title,
        activity: [{ at: new Date().toISOString(), what: 'created', detail: {} }],
      })
      .select(CARD_COLUMNS)
      .single(),
    'The card could not be created',
  )
  return row
}

export async function updateCard(card, changes, { note = null } = {}) {
  const patch = { ...changes }
  if (note) patch.activity = trail(card, note.what, note.detail)
  const row = unwrap(
    await client().from('board_cards').update(patch).eq('id', card.id).select(CARD_COLUMNS).single(),
    'That change could not be saved',
  )
  return row
}

export async function moveCard(card, listId, index, siblings, { done = undefined } = {}) {
  const ordered = [...siblings].sort((a, b) => a.position - b.position)
  const changes = { list_id: listId, position: positionFor(ordered, index) }
  if (done !== undefined && done !== card.done) changes.done = done

  const moved = await updateCard(card, changes, {
    note: card.list_id === listId ? null : { what: 'moved', detail: { to: listId } },
  })

  if (needsRenumber(ordered, index)) {
    const rebuilt = [...ordered]
    rebuilt.splice(index, 0, moved)
    await Promise.all(
      rebuilt.map((entry, place) =>
        client().from('board_cards').update({ position: (place + 1) * POSITION_STEP }).eq('id', entry.id),
      ),
    )
    return { ...moved, position: (index + 1) * POSITION_STEP, renumbered: true }
  }
  return moved
}

export async function duplicateCard(card, siblings) {
  const ordered = [...siblings].sort((a, b) => a.position - b.position)
  const at = ordered.findIndex((entry) => entry.id === card.id)
  const row = unwrap(
    await client()
      .from('board_cards')
      .insert({
        board_id: card.board_id,
        owner: myId(),
        list_id: card.list_id,
        position: positionFor(ordered, at < 0 ? ordered.length : at + 1),
        title: `${card.title} (copy)`.slice(0, LIMITS.title),
        notes: card.notes,
        due: card.due,
        labels: card.labels,
        done: false,
        checklist: (card.checklist || []).map((step) => ({ ...step, done: false })),
        links: card.links || [],
        activity: [{ at: new Date().toISOString(), what: 'copied', detail: { from: card.seq } }],
      })
      .select(CARD_COLUMNS)
      .single(),
    'The card could not be copied',
  )
  return row
}

export async function deleteCard(cardId) {
  unwrap(
    await client().from('board_cards').update({ deleted_at: new Date().toISOString() }).eq('id', cardId),
    'The card could not be deleted',
  )
}

export async function undeleteCard(cardId) {
  const row = unwrap(
    await client().from('board_cards').update({ deleted_at: null }).eq('id', cardId).select(CARD_COLUMNS).single(),
    'The card could not be brought back',
  )
  return row
}

export async function purgeCard(card) {
  await Promise.all((card.files || []).map((entry) => removePath(entry.path)))
  unwrap(await client().from('board_cards').delete().eq('id', card.id), 'The card could not be removed')
}

export async function bulkCards(cards, action, value, { siblings = [] } = {}) {
  const held = (cards || []).slice(0, LIMITS.bulk)
  if (!held.length) return 0
  const ids = held.map((card) => card.id)
  const sb = client()

  if (action === 'delete') {
    unwrap(await sb.from('board_cards').update({ deleted_at: new Date().toISOString() }).in('id', ids), 'Those cards could not be deleted')
    return held.length
  }

  const flat = {
    done: { done: true },
    undone: { done: false },
    archive: { archived: true },
    restore: { archived: false },
    due: { due: value || null },
  }[action]

  if (flat) {
    unwrap(await sb.from('board_cards').update(flat).in('id', ids), 'Those cards could not be changed')
    return held.length
  }

  if (action === 'label' || action === 'unlabel') {
    await Promise.all(
      held.map((card) => {
        const labels = action === 'label'
          ? [...new Set([...(card.labels || []), value])]
          : (card.labels || []).filter((id) => id !== value)
        return sb.from('board_cards').update({ labels }).eq('id', card.id)
      }),
    )
    return held.length
  }

  if (action === 'move') {
    const ordered = [...siblings].sort((a, b) => a.position - b.position)
    let position = (ordered[ordered.length - 1]?.position ?? 0) + POSITION_STEP
    await Promise.all(
      held.map((card) => {
        const at = position
        position += POSITION_STEP
        return sb.from('board_cards').update({ list_id: value, position: at }).eq('id', card.id)
      }),
    )
    return held.length
  }

  throw new BoardError('That is not something a selection can do.')
}

export async function transferCard(card, targetBoardId, listId, siblings) {
  const ordered = [...siblings].sort((a, b) => a.position - b.position)
  const row = unwrap(
    await client()
      .from('board_cards')
      .update({
        board_id: targetBoardId,
        list_id: listId,
        position: positionFor(ordered, ordered.length),
        labels: [],
        activity: trail(card, 'transferred', { from: card.board_id }),
      })
      .eq('id', card.id)
      .select(CARD_COLUMNS)
      .single(),
    'The card could not be moved to that board',
  )
  return row
}

export function addStep(card, text) {
  if ((card.checklist || []).length >= LIMITS.steps) throw new BoardError(`A card takes at most ${LIMITS.steps} steps.`)
  const checklist = [...(card.checklist || []), { id: shortId(), text, done: false }]
  return updateCard(card, { checklist })
}

export function setStep(card, stepId, changes) {
  const checklist = (card.checklist || []).map((step) => (step.id === stepId ? { ...step, ...changes } : step))
  return updateCard(card, { checklist })
}

export function removeStep(card, stepId) {
  return updateCard(card, { checklist: (card.checklist || []).filter((step) => step.id !== stepId) })
}

export function moveStep(card, stepId, index) {
  const checklist = [...(card.checklist || [])]
  const from = checklist.findIndex((step) => step.id === stepId)
  if (from < 0) return Promise.resolve(card)
  const [held] = checklist.splice(from, 1)
  checklist.splice(Math.max(0, Math.min(checklist.length, index)), 0, held)
  return updateCard(card, { checklist })
}

export function addComment(card, body) {
  if ((card.comments || []).length >= LIMITS.comments) {
    throw new BoardError(`A card takes at most ${LIMITS.comments} comments.`)
  }
  const comments = [...(card.comments || []), { id: shortId(), body, at: new Date().toISOString() }]
  return updateCard(card, { comments })
}

export function editComment(card, commentId, body) {
  const comments = (card.comments || []).map((entry) =>
    entry.id === commentId ? { ...entry, body, edited: new Date().toISOString() } : entry,
  )
  return updateCard(card, { comments })
}

export function removeComment(card, commentId) {
  return updateCard(card, { comments: (card.comments || []).filter((entry) => entry.id !== commentId) })
}

export function addLink(card, label, url) {
  if ((card.links || []).length >= LIMITS.links) throw new BoardError(`A card takes at most ${LIMITS.links} links.`)
  const links = [...(card.links || []), { id: shortId(), label, url }]
  return updateCard(card, { links })
}

export function removeLink(card, linkId) {
  return updateCard(card, { links: (card.links || []).filter((entry) => entry.id !== linkId) })
}

const folderFor = (boardId) => `${myId()}/${boardId}`

async function upload(path, blob, contentType) {
  const { error } = await client().storage.from(BUCKET).upload(path, blob, { contentType, upsert: true })
  if (error) {
    if (String(error.message || '').toLowerCase().includes('bucket not found')) {
      throw new BoardError(SETUP_MESSAGE, { status: 501, setup: true })
    }
    throw lift(error, 'The file could not be uploaded')
  }
  return path
}

async function removePath(path) {
  if (!path) return
  try {
    await client().storage.from(BUCKET).remove([path])
  } catch {
  }
}

async function removeFolder(boardId) {
  const sb = client()
  const root = folderFor(boardId)
  const paths = []
  try {
    const { data: top } = await sb.storage.from(BUCKET).list(root, { limit: 200 })
    for (const entry of top || []) {
      if (entry.id) {
        paths.push(`${root}/${entry.name}`)
        continue
      }
      const { data: inner } = await sb.storage.from(BUCKET).list(`${root}/${entry.name}`, { limit: 200 })
      for (const leaf of inner || []) paths.push(`${root}/${entry.name}/${leaf.name}`)
    }
    if (paths.length) await sb.storage.from(BUCKET).remove(paths)
  } catch {
  }
}

const SIGNED_TTL = 3600
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

export function forgetSignedUrl(path) {
  signed.delete(path)
}

export async function setArt(board, kind, { blob, type }, focus) {
  const path = `${folderFor(board.id)}/art/${kind}-${shortId()}.${extensionFor(type)}`
  await upload(path, blob, type)
  const previous = board.art?.[kind]?.path
  const art = {
    ...(board.art || {}),
    [kind]: { path, focus: focus || { x: 50, y: 50 }, at: new Date().toISOString() },
  }
  const saved = await updateBoard(board.id, { art })
  if (previous && previous !== path) await removePath(previous)
  return saved
}

export function placeArt(board, kind, focus) {
  const held = board.art?.[kind]
  if (!held) throw new BoardError('There is nothing to reposition.')
  return updateBoard(board.id, { art: { ...board.art, [kind]: { ...held, focus } } })
}

export async function removeArt(board, kind) {
  const held = board.art?.[kind]
  const art = { ...(board.art || {}) }
  delete art[kind]
  const saved = await updateBoard(board.id, { art })
  if (held?.path) await removePath(held.path)
  return saved
}

export async function attachFile(card, prepared) {
  if ((card.files || []).length >= LIMITS.files) throw new BoardError(`A card takes at most ${LIMITS.files} files.`)
  const id = shortId()
  const base = `${myId()}/${card.board_id}/cards/${card.id}/${id}`
  const path = `${base}.${extensionFor(prepared.type)}`
  await upload(path, prepared.blob, prepared.type)

  let thumbPath = null
  if (prepared.thumb) {
    thumbPath = `${base}-thumb.webp`
    await upload(thumbPath, prepared.thumb, 'image/webp')
  }

  const entry = {
    id,
    name: prepared.name,
    type: prepared.type,
    bytes: prepared.bytes,
    path,
    thumb: thumbPath,
    at: new Date().toISOString(),
  }
  return updateCard(card, { files: [...(card.files || []), entry] }, { note: { what: 'attached', detail: { name: entry.name } } })
}

export async function removeFile(card, fileId) {
  const entry = (card.files || []).find((held) => held.id === fileId)
  const saved = await updateCard(card, { files: (card.files || []).filter((held) => held.id !== fileId) })
  if (entry) {
    await removePath(entry.path)
    await removePath(entry.thumb)
  }
  return saved
}

export async function downloadFile(entry) {
  const { data, error } = await client().storage.from(BUCKET).download(entry.path)
  if (error) throw lift(error, 'That file could not be downloaded')
  const url = URL.createObjectURL(data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = entry.name || 'attachment'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
