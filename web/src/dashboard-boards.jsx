import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import {
  BTN_BARE,
  BTN_QUIET,
  BTN_SOLID,
  BoardBanner,
  BoardMark,
  Chip,
  Empty,
  INPUT,
  Menu,
  MenuItem,
  MenuLabel,
  MenuLine,
  Dot,
  Note,
  Progress,
  StoredImage,
  Tag,
  SaveMark,
  SearchField,
  Sheet,
  Swatch,
  TEXTAREA,
  UndoBar,
} from './components/boards/ui'
import Columns from './components/boards/columns'
import { Bone, Lines, Loading } from './components/skeleton'
import CardDialog from './components/boards/card-dialog'
import BoardSettings from './components/boards/board-settings'
import MoveDialog from './components/boards/move-dialog'
import Tour, { TourButton, tourSeen } from './components/boards/tour'
import { FactStrip, PurposePicker, FactSheet } from './components/boards/purpose'
import { WhenPicker } from './components/boards/when-picker'
import { dayWords, gapWords } from './lib/boards-when'
import {
  BOARDS_TAB,
  COLOURS,
  EMPTY_FILTERS,
  LIMITS,
  PURPOSES,
  SORTS,
  ago,
  factHaystack,
  factLead,
  filtersActive,
  plural,
  purposeOf,
  remindOf,
  shade,
  tally,
} from './lib/boards'
import * as api from './lib/boards-api'
import { dashboardPath, navigate } from './lib/router'

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readHash(hash) {
  const parts = (hash || '').replace(/^#/, '').split('/')
  const second = parts[1] || ''
  if (ID_RE.test(second)) return { tab: 'boards', board: second, card: ID_RE.test(parts[2] || '') ? parts[2] : null }
  return { tab: BOARDS_TAB.some((entry) => entry.id === second) ? second : 'boards', board: null, card: null }
}

const go = (next) => {
  const path = next.board ? `boards/${next.board}${next.card ? `/${next.card}` : ''}` : `boards${next.tab && next.tab !== 'boards' ? `/${next.tab}` : ''}`
  navigate(dashboardPath(path), { replace: Boolean(next.replace) })
}

function IndexSkeleton() {
  return (
    <Loading label="Loading your boards" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2"><Bone className="h-5 w-5 rounded-md" /><Bone className="h-3.5 w-32" /></div>
          <Lines count={2} className="mt-3" />
          <Bone className="mt-3 h-2.5 w-24" />
          <div className="mt-5 flex items-baseline gap-2"><Bone className="h-4 w-6" /><Bone className="h-2.5 w-20" /></div>
          <Bone className="mt-2 h-1 w-full" />
          <Bone className="mt-3 h-2.5 w-16" />
        </div>
      ))}
    </Loading>
  )
}

function BoardSkeleton() {
  const cards = [[3, 2], [2, 3, 1], [1]]
  return (
    <Loading label="Opening the board" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Bone className="h-7 w-7 rounded-md" />
        <Bone className="h-5 w-44" />
        <span className="flex-1" />
        <Bone className="h-7 w-24 rounded-lg" />
        <Bone className="h-7 w-7 rounded-lg" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {cards.map((column, i) => (
          <div key={i} className="flex w-[280px] shrink-0 flex-col gap-2 rounded-xl border border-line bg-surface-raised/35 p-2 max-sm:w-[86vw]">
            <div className="flex items-center gap-2 px-1 py-1.5"><Bone className="h-3 w-20" /><Bone className="h-3 w-4" /></div>
            {column.map((lines, j) => (
              <div key={j} className="rounded-lg border border-line bg-surface p-3">
                <Lines count={lines} />
                <div className="mt-2.5 flex gap-2"><Bone className="h-2 w-10" /><Bone className="h-2 w-6" /></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Loading>
  )
}

function ComingUp({ boards, onOpen }) {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let alive = true
    api.fetchAgenda(14).then(
      (next) => alive && setRows(next),
      () => alive && setRows([]),
    )
    return () => {
      alive = false
    }
  }, [])

  const chasing = useMemo(() => {
    const on = new Map((boards || []).map((entry) => [entry.id, remindOf(entry)]))
    return (rows || []).filter((row) => {
      const remind = on.get(row.board_id)
      return remind?.on && !remind.quiet
    })
  }, [rows, boards])

  if (!rows || !chasing.length) return null

  const now = Date.now()
  const late = chasing.filter((row) => Date.parse(row.due) < now).length

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((held) => !held)}
        className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <Icon name="bell" className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
        <span className="text-[13px] font-semibold tracking-tight text-ink-strong">Coming up</span>
        {late > 0 ? (
          <span className="text-[11.5px] font-medium tabular-nums text-red-500">{late} overdue</span>
        ) : (
          <span className="text-[11.5px] tabular-nums text-ink-subtle">{chasing.length}</span>
        )}
        <span className="flex-1" />
        <Icon name={open ? 'chevronDown' : 'chevronRight'} className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <ul className="border-t border-line">
          {chasing.slice(0, 8).map((row) => {
            const at = Date.parse(row.due)
            const tone = at < now ? 'text-red-500' : at - now < 48 * 3600000 ? 'text-amber-500' : 'text-ink-subtle'
            return (
              <li key={row.card_id}>
                <button
                  type="button"
                  onClick={() => onOpen(row.board_id, row.card_id)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <Dot colour={row.colour} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-secondary">{row.title}</span>
                  <span className="hidden shrink-0 text-[11px] text-ink-faint sm:block">{row.board_name}</span>
                  <span className={`shrink-0 text-[11.5px] tabular-nums ${tone}`} title={gapWords(at, now)}>
                    {dayWords(at, now)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function BoardTile({ board, onOpen }) {
  const { cards, done, overdue, soon, archived } = board.counts
  const purpose = purposeOf(board.purpose)
  const lead = factLead(purpose, board.facts)

  return (
    <button
      type="button"
      onClick={() => onOpen(board.id)}
      className="group relative flex cursor-pointer flex-col items-stretch overflow-hidden rounded-xl border border-line bg-surface text-left transition-colors hover:border-line-strong"
    >
      {board.art?.banner?.path ? (
        <span className="block h-16 w-full overflow-hidden border-b border-line">
          <StoredImage path={board.art.banner.path} alt="" focus={board.art.banner.focus} className="h-full w-full object-cover" />
        </span>
      ) : (
        <span className={`absolute inset-x-0 top-0 h-px ${shade(board.colour).stripe}`} aria-hidden="true" />
      )}

      <span className="flex flex-1 flex-col p-4">
        <span className="flex items-center gap-2">
          <BoardMark board={board} size="sm" />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium tracking-tight text-ink-strong">{board.name}</span>
          {board.archived && <Tag>Archived</Tag>}
        </span>

        <span className="mt-1.5 line-clamp-2 block min-h-[32px] text-[12px] leading-relaxed text-ink-muted">
          {board.note || <span className="text-ink-faint">No description.</span>}
        </span>

        <span className="mt-2 flex min-h-[15px] items-center gap-1.5 overflow-hidden text-[11px] text-ink-faint">
          {purpose.id !== 'personal' && (
            <>
              <Icon name={purpose.icon} className="h-3 w-3 shrink-0" />
              <span className="shrink-0">{purpose.label}</span>
            </>
          )}
          {lead && (
            <span className="min-w-0 truncate">
              {purpose.id !== 'personal' && '· '}
              {lead.text}
            </span>
          )}
        </span>

        <span className="mt-4 block">
          <span className="mb-2 flex items-baseline gap-1.5">
            <span className="font-mono text-[15px] font-semibold leading-none tabular-nums text-ink-strong">{done}</span>
            <span className="text-[11.5px] text-ink-subtle">
              of {cards} done
              {archived > 0 && <span className="text-ink-faint"> · {archived} archived</span>}
            </span>
            <span className="flex-1" />
            {overdue > 0 ? (
              <span className="text-[11.5px] font-medium tabular-nums text-red-500">{overdue} overdue</span>
            ) : soon > 0 ? (
              <span className="text-[11.5px] tabular-nums text-amber-500">{soon} due soon</span>
            ) : null}
          </span>
          <Progress done={done} total={cards} />
        </span>

        <span className="mt-3 block text-[11px] text-ink-faint">{board.updated_at ? `Touched ${ago(board.updated_at)}` : ''}</span>
      </span>
    </button>
  )
}

function NewBoard({ onCreate, onClose, busy }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [colour, setColour] = useState('violet')
  const [purpose, setPurpose] = useState('personal')
  const [facts, setFacts] = useState({})

  const kept = Object.fromEntries(
    purposeOf(purpose)
      .fields.map((field) => [field.id, (facts[field.id] ?? '').trim()])
      .filter(([, value]) => value),
  )

  return (
    <Sheet
      title="New board"
      subtitle="It starts with To do, Doing and Done. You can rename or replace them at any point."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => onCreate({ name: name.trim(), note: note.trim(), colour, purpose, facts: kept })}
            className={BTN_SOLID}
          >
            Create board
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-board-name" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-subtle">
            Name
          </label>
          <input
            id="new-board-name"
            data-autofocus
            value={name}
            maxLength={LIMITS.name}
            placeholder="What is it called?"
            onChange={(event) => setName(event.target.value)}
            className={INPUT}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="new-board-note" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-subtle">
              Description
            </label>
            <span className="text-[11px] text-ink-faint">optional</span>
          </div>
          <textarea id="new-board-note" value={note} rows={2} maxLength={LIMITS.note} placeholder="One line about what it is for." onChange={(event) => setNote(event.target.value)} className={TEXTAREA} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-subtle">Colour</span>
          <div className="flex flex-wrap items-center gap-2">
            {COLOURS.map((entry) => (
              <Swatch key={entry.id} colour={entry.id} active={colour === entry.id} onPick={setColour} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-subtle">What is it for</span>
          <PurposePicker value={purpose} onPick={setPurpose} />
        </div>

        {purposeOf(purpose).fields.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-subtle">Details</span>
            <FactSheet purpose={purpose} facts={facts} onSet={(key, value) => setFacts((held) => ({ ...held, [key]: value }))} onDropStray={() => setFacts({})} />
          </div>
        )}

        <p className="text-[11.5px] text-ink-faint">Art, labels and reminders are set up from the board itself once it exists.</p>
      </div>
    </Sheet>
  )
}

function BulkBar({ board, picked, cards, onRun, onClear, busy }) {
  const chosen = cards.filter((card) => picked.has(card.id))
  const dueAnchor = useRef(null)
  const [dating, setDating] = useState(false)
  if (!chosen.length) return null

  return (
    <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 py-2 shadow-xl">
      <span className="text-[12px] tabular-nums text-ink-subtle">
        <span className="font-medium text-ink-strong">{chosen.length}</span> selected
      </span>
      <span className="hidden flex-1 sm:block" />

      <button type="button" disabled={busy} onClick={() => onRun(chosen, 'done')} className={BTN_QUIET}>
        <Icon name="check" className="h-3.5 w-3.5" />
        Done
      </button>
      <button type="button" disabled={busy} onClick={() => onRun(chosen, 'undone')} className={BTN_QUIET}>
        Reopen
      </button>
      <span ref={dueAnchor}>
        <button type="button" disabled={busy} onClick={() => setDating(true)} className={BTN_QUIET}>
          <Icon name="calendar" className="h-3.5 w-3.5" />
          Due
        </button>
      </span>

      <Menu
        label="More for the selection"
        trigger={({ toggle }) => (
          <button type="button" aria-haspopup="menu" disabled={busy} onClick={toggle} className={BTN_QUIET}>
            <Icon name="dots" className="h-3.5 w-3.5" />
            More
          </button>
        )}
      >
        <MenuLabel>Move to</MenuLabel>
        {board.lists.map((list) => (
          <MenuItem key={list.id} icon="arrowRight" onClick={() => onRun(chosen, 'move', list.id)}>
            {list.name}
          </MenuItem>
        ))}
        {(board.labels || []).length > 0 && (
          <>
            <MenuLine />
            <MenuLabel>Label</MenuLabel>
            {board.labels.map((label) => (
              <MenuItem key={label.id} icon="tag" onClick={() => onRun(chosen, 'label', label.id)}>
                {label.name}
              </MenuItem>
            ))}
            {board.labels.map((label) => (
              <MenuItem key={`un-${label.id}`} icon="x" onClick={() => onRun(chosen, 'unlabel', label.id)}>
                Remove {label.name}
              </MenuItem>
            ))}
          </>
        )}
        <MenuLine />
        <MenuItem icon="archive" onClick={() => onRun(chosen, 'archive')}>
          Archive
        </MenuItem>
        <MenuItem icon="undo" onClick={() => onRun(chosen, 'restore')}>
          Restore
        </MenuItem>
        <MenuItem icon="trash" tone="danger" onClick={() => onRun(chosen, 'delete')}>
          Delete
        </MenuItem>
      </Menu>

      <button type="button" onClick={onClear} className={BTN_BARE}>
        Clear
      </button>

      {dating && (
        <WhenPicker
          anchor={dueAnchor}
          value={null}
          board={board}
          onClose={() => setDating(false)}
          onChange={(iso) => onRun(chosen, 'due', iso)}
        />
      )}
    </div>
  )
}

export default function DashboardBoards({ hash }) {
  const route = readHash(hash)
  const { tab, board: openId, card: openCard } = route

  const [index, setIndex] = useState(null)
  const [board, setBoard] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [setup, setSetup] = useState(false)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('touched')
  const [kind, setKind] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const [creating, setCreating] = useState(false)
  const [settings, setSettings] = useState(false)
  const [sending, setSending] = useState(null)
  const [tour, setTour] = useState(false)
  const [undo, setUndo] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [picked, setPicked] = useState(() => new Set())

  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const load = useCallback(
    async (quiet) => {
      if (!quiet) setLoading(true)
      try {
        if (openId) {
          const result = await api.fetchBoard(openId)
          if (!live.current) return
          setBoard(result.board)
          setCards(result.cards)
          if (!index) {
            const rows = await api.fetchBoards(false)
            if (live.current) setIndex(rows)
          }
        } else {
          const rows = await api.fetchBoards(tab === 'archive')
          if (!live.current) return
          setIndex(rows)
        }
        if (live.current) setError(null)
      } catch (failure) {
        if (!live.current) return
        if (failure.setup) {
          setSetup(true)
          setError(null)
        } else if (failure.status === 404 && openId) {
          setNotice('That board is gone — it was deleted, or it was never yours.')
          go({ tab: 'boards', replace: true })
        } else if (!quiet) {
          setError(failure.message)
          if (openId) setBoard(null)
        }
      } finally {
        if (live.current) setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openId, tab],
  )

  useEffect(() => {
    if (!openId) {
      setBoard(null)
      setCards([])
      setFilters(EMPTY_FILTERS)
      setChoosing(false)
      setPicked(new Set())
    }
    load()
  }, [openId, tab, load])

  useEffect(() => {
    api.sweepBin()
  }, [])

  useEffect(() => {
    if (!openId || !board) return undefined
    const timer = setInterval(async () => {
      if (busy || dragging || document.hidden) return
      try {
        const rev = await api.fetchRev(openId)
        if (rev !== null && rev !== board.rev) load(true)
      } catch {
      }
    }, 12_000)
    return () => clearInterval(timer)
  }, [openId, board, busy, dragging, load])

  useEffect(() => {
    if (!openCard || !board || loading) return
    if (!cards.some((card) => card.id === openCard)) go({ board: board.id, replace: true })
  }, [openCard, board, cards, loading])

  useEffect(() => {
    if (board && cards.length > 0 && !tourSeen()) setTour(true)
  }, [board, cards.length])

  const run = useCallback(
    async (work, { reload = false } = {}) => {
      setBusy(true)
      setError(null)
      try {
        const result = await work()
        if (live.current) setSavedAt(Date.now())
        if (reload && live.current) await load(true)
        return result
      } catch (failure) {
        if (live.current) {
          setError(failure.message)
          await load(true)
        }
        return null
      } finally {
        if (live.current) setBusy(false)
      }
    },
    [load],
  )

  const patchCard = useCallback((id, changes) => {
    setCards((held) => held.map((card) => (card.id === id ? { ...card, ...changes } : card)))
  }, [])

  const actions = useMemo(() => {
    const board_ = {
      set: (changes) => {
        setBoard((held) => (held ? { ...held, ...changes } : held))
        return run(() => api.updateBoard(openId, changes).then((next) => live.current && setBoard(next)))
      },
      remove: () => api.deleteBoard(openId),
      art: {
        set: (kindName, result) => run(async () => setBoard(await api.setArt(board, kindName, result))),
        remove: (kindName) => run(async () => setBoard(await api.removeArt(board, kindName))),
        place: (kindName, focus) => run(async () => setBoard(await api.placeArt(board, kindName, focus))),
      },
    }

    return {
      busy,
      savedAt,
      now,
      board: board_,
      label: {
        set: (label) => run(async () => setBoard(await api.setLabel(board, label))),
        remove: (label) =>
          run(async () => {
            setBoard(await api.removeLabel(board, label.id, cards))
            setCards((held) => held.map((card) => ({ ...card, labels: (card.labels || []).filter((id) => id !== label.id) })))
          }),
      },
      column: {
        add: (name) => run(async () => setBoard(await api.addList(board, name))),
        set: (id, changes) => {
          setBoard((held) => ({ ...held, lists: held.lists.map((list) => (list.id === id ? { ...list, ...changes } : list)) }))
          return run(async () => setBoard(await api.updateList(board, id, changes)))
        },
        move: (id, at) => {
          setBoard((held) => {
            const lists = [...held.lists]
            const from = lists.findIndex((list) => list.id === id)
            const [moved] = lists.splice(from, 1)
            lists.splice(Math.max(0, Math.min(lists.length, at)), 0, moved)
            return { ...held, lists }
          })
          return run(async () => setBoard(await api.moveList(board, id, at)))
        },
        sort: (id, by) =>
          run(async () => {
            await api.sortList(board.id, id, cards.filter((card) => card.list_id === id), by)
            await load(true)
          }),
        remove: (column) => {
          const inside = cards.filter((card) => card.list_id === column.id)
          const elsewhere = board.lists.find((list) => list.id !== column.id)
          const keep = inside.length && elsewhere ? elsewhere.id : null
          return run(async () => {
            setBoard(await api.removeList(board, column.id, keep))
            await load(true)
            if (inside.length) {
              setNotice(keep ? `${plural(inside.length, 'card')} moved to ${elsewhere.name}.` : `${plural(inside.length, 'card')} went with it.`)
            }
          })
        },
      },
      card: {
        add: (listId, title, atTop) =>
          run(async () => {
            const made = await api.createCard(board, listId, title, {
              atTop,
              siblings: cards.filter((card) => card.list_id === listId && !card.archived),
            })
            if (live.current) setCards((held) => [...held, made])
          }),
        set: (card, changes) => {
          patchCard(card.id, changes)
          return run(async () => {
            const next = await api.updateCard(card, changes)
            if (live.current) patchCard(card.id, next)
          })
        },
        move: (card, listId, at, siblings, done) => {
          patchCard(card.id, { list_id: listId, ...(done !== undefined ? { done } : {}) })
          return run(async () => {
            const next = await api.moveCard(card, listId, at, siblings, { done })
            if (live.current && next) patchCard(card.id, next)
          })
        },
        duplicate: (card) =>
          run(async () => {
            const made = await api.duplicateCard(card, cards.filter((entry) => entry.list_id === card.list_id))
            if (live.current) setCards((held) => [...held, made])
          }),
        remove: (card) =>
          run(async () => {
            await api.deleteCard(card.id)
            if (!live.current) return
            setCards((held) => held.filter((entry) => entry.id !== card.id))
            setUndo({ id: card.id, what: `Deleted “${card.title}”` })
          }),
        step: {
          add: (card, text) => run(async () => patchCard(card.id, await api.addStep(card, text))),
          set: (card, stepId, changes) => run(async () => patchCard(card.id, await api.setStep(card, stepId, changes))),
          remove: (card, stepId) => run(async () => patchCard(card.id, await api.removeStep(card, stepId))),
          move: (card, stepId, at) => run(async () => patchCard(card.id, await api.moveStep(card, stepId, at))),
        },
        comment: {
          add: (card, body) => run(async () => patchCard(card.id, await api.addComment(card, body))),
          edit: (card, id, body) => run(async () => patchCard(card.id, await api.editComment(card, id, body))),
          remove: (card, id) => run(async () => patchCard(card.id, await api.removeComment(card, id))),
        },
        link: {
          add: (card, label, url) => run(async () => patchCard(card.id, await api.addLink(card, label, url))),
          remove: (card, id) => run(async () => patchCard(card.id, await api.removeLink(card, id))),
        },
        file: {
          add: async (card, prepared) => {
            const next = await api.attachFile(card, prepared)
            if (live.current) {
              patchCard(card.id, next)
              setSavedAt(Date.now())
            }
            return next
          },
          remove: (card, id) => run(async () => patchCard(card.id, await api.removeFile(card, id))),
        },
      },
      bulk: (chosen, action, value) =>
        run(async () => {
          const siblings = action === 'move' ? cards.filter((card) => card.list_id === value) : []
          const count = await api.bulkCards(chosen, action, value, { siblings })
          await load(true)
          if (live.current) {
            setPicked(new Set())
            setChoosing(false)
            setNotice(`${plural(count, 'card')} updated.`)
          }
        }),
    }
  }, [board, cards, busy, savedAt, now, openId, run, load, patchCard])

  const listed = useMemo(() => {
    const wanted = search.trim().toLowerCase()
    const rows = (index || [])
      .filter((entry) => !kind || (entry.purpose || 'personal') === kind)
      .filter((entry) => !wanted || `${entry.name} ${entry.note || ''} ${factHaystack(entry)}`.toLowerCase().includes(wanted))
    const sorted = [...rows]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'touched') sorted.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    if (sort === 'made') sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    if (sort === 'open')
      sorted.sort((a, b) => b.counts.cards - b.counts.done - (a.counts.cards - a.counts.done) || a.name.localeCompare(b.name))
    return sorted
  }, [index, search, sort, kind])

  const kinds = useMemo(() => {
    const seen = new Set((index || []).map((entry) => entry.purpose || 'personal'))
    return PURPOSES.filter((entry) => seen.has(entry.id))
  }, [index])

  const counts = useMemo(() => tally(cards, now), [cards, now])
  const card = openCard ? cards.find((entry) => entry.id === openCard) : null
  const canWrite = Boolean(board) && !board.archived

  const createBoard = async (payload) => {
    const made = await run(() => api.createBoard(payload))
    if (made) {
      setCreating(false)
      go({ board: made.id })
    }
  }

  if (openId && board) {
    return (
      <div className="flex flex-col gap-5">
        {error && <Note tone="error" onDismiss={() => setError(null)}>{error}</Note>}
        {notice && <Note tone="info" onDismiss={() => setNotice(null)}>{notice}</Note>}

        {board.art?.banner?.path && <BoardBanner board={board} className="h-28 sm:h-36" />}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <button type="button" onClick={() => go({ tab: 'boards' })} className="mb-1.5 inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink-strong">
              <Icon name="chevronLeft" className="h-3.5 w-3.5" />
              All boards
            </button>

            <h2 data-tour="board-head" className="flex items-center gap-2.5 text-[18px] font-semibold tracking-tight text-ink-strong">
              <BoardMark board={board} size="lg" />
              <span className="min-w-0 truncate">{board.name}</span>
              {board.archived && <Tag tone="amber">Archived</Tag>}
            </h2>

            {board.note && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{board.note}</p>}

            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] tabular-nums text-ink-subtle">
              <span>{plural(counts.cards, 'card')}</span>
              <span className="text-ink-faint">·</span>
              <span>{counts.done} done</span>
              {counts.overdue > 0 && (
                <>
                  <span className="text-ink-faint">·</span>
                  <span className="font-medium text-red-500">{counts.overdue} overdue</span>
                </>
              )}
              {counts.archived > 0 && (
                <>
                  <span className="text-ink-faint">·</span>
                  <span>{counts.archived} archived</span>
                </>
              )}
            </p>

            <div className="mt-3">
              <FactStrip board={board} onMore={() => setSettings(true)} />
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            <SaveMark state={busy ? 'saving' : savedAt ? 'saved' : 'rest'} at={savedAt} now={now} />
            <button type="button" data-tour="board-settings" onClick={() => setSettings(true)} className={BTN_QUIET}>
              <Icon name="settings" className="h-3.5 w-3.5" />
              Settings
            </button>
            <TourButton onClick={() => setTour(true)} />
            <button type="button" disabled={loading} onClick={() => load()} className={BTN_QUIET}>
              <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="max-sm:sr-only">Refresh</span>
            </button>
          </div>
        </div>

        <div data-tour="board-filters" className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2">
          <SearchField value={filters.text} onChange={(text) => setFilters((held) => ({ ...held, text }))} placeholder="Find a card" className="w-full sm:w-[190px]" />

          <span aria-hidden="true" className="mx-1 hidden h-4 w-px bg-line sm:block" />

          <Chip active={filters.hideDone} onClick={() => setFilters((held) => ({ ...held, hideDone: !held.hideDone }))}>
            <Icon name="eyeOff" className="h-3.5 w-3.5" />
            Hide done
          </Chip>

          <Chip active={filters.archived} onClick={() => setFilters((held) => ({ ...held, archived: !held.archived }))}>
            <Icon name="archive" className="h-3.5 w-3.5" />
            Archive
          </Chip>

          <Menu
            label="Due"
            width="w-48"
            trigger={({ toggle }) => (
              <Chip active={Boolean(filters.due)} onClick={toggle}>
                <Icon name="clock" className="h-3.5 w-3.5" />
                {{ overdue: 'Overdue', soon: 'Due soon', none: 'No date' }[filters.due] || 'Due'}
              </Chip>
            )}
          >
            {[
              ['', 'Any'],
              ['overdue', 'Overdue'],
              ['soon', 'Due soon'],
              ['none', 'No due date'],
            ].map(([id, label]) => (
              <MenuItem key={id || 'any'} checked={filters.due === id} onClick={() => setFilters((held) => ({ ...held, due: id }))}>
                {label}
              </MenuItem>
            ))}
          </Menu>

          {(board.labels || []).length > 0 && (
            <Menu
              label="Label"
              width="w-52"
              trigger={({ toggle }) => (
                <Chip active={Boolean(filters.label)} onClick={toggle}>
                  <Icon name="tag" className="h-3.5 w-3.5" />
                  {board.labels.find((entry) => entry.id === filters.label)?.name || 'Label'}
                </Chip>
              )}
            >
              <MenuItem checked={!filters.label} onClick={() => setFilters((held) => ({ ...held, label: '' }))}>
                Any label
              </MenuItem>
              <MenuLine />
              {board.labels.map((label) => (
                <MenuItem key={label.id} checked={filters.label === label.id} onClick={() => setFilters((held) => ({ ...held, label: label.id }))}>
                  <span className="flex items-center gap-2">
                    <Dot colour={label.colour} />
                    {label.name}
                  </span>
                </MenuItem>
              ))}
            </Menu>
          )}

          <Chip active={choosing} onClick={() => {
            setChoosing((held) => !held)
            if (choosing) setPicked(new Set())
          }}>
            <Icon name="squareCheck" className="h-3.5 w-3.5" />
            Select
          </Chip>

          {filtersActive(filters) && (
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className={BTN_BARE}>
              Clear
            </button>
          )}
        </div>

        <div data-tour="board-rail">
          <Columns
            board={board}
            cards={cards}
            filters={filters}
            canWrite={canWrite}
            actions={actions}
            onOpen={(id) => go({ board: board.id, card: id })}
            onDragging={setDragging}
            onSend={(id) => setSending(cards.find((entry) => entry.id === id))}
            selection={{ choosing, picked, setPicked, setChoosing }}
          />
        </div>

        <BulkBar board={board} picked={picked} cards={cards} busy={busy} onRun={(chosen, action, value) => actions.bulk(chosen, action, value)} onClear={() => { setPicked(new Set()); setChoosing(false) }} />

        {card && (
          <CardDialog
            board={board}
            card={card}
            cards={cards}
            canWrite={canWrite}
            actions={actions}
            error={null}
            onClose={() => go({ board: board.id })}
            onSend={(id) => setSending(cards.find((entry) => entry.id === id))}
          />
        )}

        {settings && (
          <BoardSettings
            board={board}
            cards={cards}
            canWrite={canWrite}
            actions={actions}
            onClose={() => setSettings(false)}
            onDeleted={() => {
              setSettings(false)
              setIndex(null)
              go({ tab: 'boards' })
            }}
            onRestored={() => load(true)}
          />
        )}

        {sending && (
          <MoveDialog
            boards={index || []}
            board={board}
            card={sending}
            busy={busy}
            onClose={() => setSending(null)}
            onMove={async (targetId, listId) => {
              const target = await api.fetchBoard(targetId)
              await run(async () => {
                await api.transferCard(sending, targetId, listId, target.cards.filter((entry) => entry.list_id === listId))
                setCards((held) => held.filter((entry) => entry.id !== sending.id))
                setNotice(`Moved to ${target.board.name}.`)
              })
              setSending(null)
              if (openCard === sending.id) go({ board: board.id })
            }}
          />
        )}

        {tour && <Tour onClose={() => setTour(false)} />}

        {undo && (
          <UndoBar
            what={undo.what}
            busy={busy}
            onClose={() => setUndo(null)}
            onUndo={async () => {
              const back = await run(() => api.undeleteCard(undo.id))
              if (back) setCards((held) => [...held, back])
              setUndo(null)
            }}
          />
        )}
      </div>
    )
  }

  if (openId) {
    return (
      <div className="flex flex-col gap-4">
        {error && <Note tone="error">{error}</Note>}
        {loading ? <BoardSkeleton /> : null}
        {!loading && !board && (
          <Empty
            icon="alert"
            title="That board is not here"
            body="It was deleted, or it belongs to somebody else."
            action={
              <button type="button" onClick={() => go({ tab: 'boards' })} className={BTN_SOLID}>
                Back to your boards
              </button>
            }
          />
        )}
      </div>
    )
  }

  if (setup) {
    return (
      <Empty
        icon="alert"
        title="Boards are not set up on this project yet"
        body="They keep their data in two Postgres tables and a storage bucket. Open the Supabase SQL editor, paste deploy/supabase/boards.sql and run it — then reload this page."
        action={
          <button
            type="button"
            onClick={() => {
              setSetup(false)
              load()
            }}
            className={BTN_QUIET}
          >
            <Icon name="refresh" className="h-3.5 w-3.5" />
            Try again
          </button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Note tone="error" onDismiss={() => setError(null)}>{error}</Note>}
      {notice && <Note tone="info" onDismiss={() => setNotice(null)}>{notice}</Note>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
          {BOARDS_TAB.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-current={tab === entry.id ? 'page' : undefined}
              onClick={() => go({ tab: entry.id })}
              className={`h-[26px] cursor-pointer rounded-md px-2.5 text-[12px] transition-colors ${
                tab === entry.id ? 'bg-surface-raised font-medium text-ink-strong' : 'text-ink-subtle hover:text-ink-strong'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <SearchField value={search} onChange={setSearch} placeholder="Search boards" className="w-full sm:w-[200px]" />

        {kinds.length > 1 && (
          <Menu
            label="Purpose"
            width="w-48"
            trigger={({ toggle }) => (
              <Chip active={Boolean(kind)} onClick={toggle}>
                <Icon name="filter" className="h-3.5 w-3.5" />
                {purposeOf(kind).id === 'personal' && !kind ? 'All kinds' : purposeOf(kind).label}
              </Chip>
            )}
          >
            <MenuItem checked={!kind} onClick={() => setKind('')}>
              All kinds
            </MenuItem>
            <MenuLine />
            {kinds.map((entry) => (
              <MenuItem key={entry.id} icon={entry.icon} checked={kind === entry.id} onClick={() => setKind(entry.id)}>
                {entry.label}
              </MenuItem>
            ))}
          </Menu>
        )}

        <Menu
          label="Sort"
          width="w-52"
          trigger={({ toggle }) => (
            <Chip onClick={toggle}>
              <Icon name="sort" className="h-3.5 w-3.5" />
              {SORTS.find((entry) => entry.id === sort)?.label}
            </Chip>
          )}
        >
          {SORTS.map((entry) => (
            <MenuItem key={entry.id} checked={sort === entry.id} onClick={() => setSort(entry.id)}>
              {entry.label}
            </MenuItem>
          ))}
        </Menu>

        <span className="flex-1" />

        <button type="button" disabled={busy || (index || []).length >= LIMITS.boards} onClick={() => setCreating(true)} className={BTN_SOLID}>
          <Icon name="plus" className="h-3.5 w-3.5" />
          New board
        </button>
      </div>

      {tab === 'boards' && index && index.length > 0 && (
        <ComingUp boards={index} onOpen={(boardId, cardId) => go({ board: boardId, card: cardId })} />
      )}

      {loading && !index && <IndexSkeleton />}

      {index && listed.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listed.map((entry) => (
            <BoardTile key={entry.id} board={entry} onOpen={(id) => go({ board: id })} />
          ))}
        </div>
      )}

      {index && listed.length === 0 && (
        <Empty
          icon={tab === 'archive' ? 'archive' : 'kanban'}
          title={
            search || kind
              ? 'Nothing matches that'
              : tab === 'archive'
                ? 'Nothing archived'
                : 'No boards yet'
          }
          body={
            search || kind
              ? 'Try a different word, or clear the filters.'
              : tab === 'archive'
                ? 'Archiving a board hides it here without deleting anything.'
                : 'A board is a set of columns and the cards you move between them. Yours are private — nobody else can open them.'
          }
          action={
            search || kind ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setKind('')
                }}
                className={BTN_QUIET}
              >
                Clear filters
              </button>
            ) : tab === 'boards' ? (
              <button type="button" onClick={() => setCreating(true)} className={BTN_SOLID}>
                <Icon name="plus" className="h-3.5 w-3.5" />
                Make your first board
              </button>
            ) : null
          }
        />
      )}

      {index && listed.length > 0 && (index || []).length >= LIMITS.boards && (
        <p className="text-[11.5px] text-ink-faint">{LIMITS.boards} boards is the most one account keeps. Archive one to make room.</p>
      )}

      {creating && <NewBoard busy={busy} onClose={() => setCreating(false)} onCreate={createBoard} />}
    </div>
  )
}

