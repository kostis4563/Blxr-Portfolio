import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import {
  BTN_BARE,
  BTN_SOLID,
  INPUT,
  InlineEdit,
  Menu,
  MenuItem,
  MenuLabel,
  MenuLine,
  PointerMenu,
  Dot,
  StoredImage,
  Tag,
} from './ui'
import { WhenPicker } from './when-picker'
import { DUE_TONE, LIMITS, LIST_SORTS, cardMatches, dueState, plural } from '../../lib/boards'
import { isImage } from '../../lib/boards-files'

const CARD_SHELL = 'group/tile relative w-full rounded-lg border bg-surface text-left transition-colors'
const TILE_META = 'mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-[22px] text-[10.5px] tabular-nums text-ink-faint'

function indexFromPoint(node, clientY, dragged) {
  const tiles = [...node.querySelectorAll('[data-card]')].filter((tile) => tile.dataset.card !== dragged)
  for (let index = 0; index < tiles.length; index += 1) {
    const box = tiles[index].getBoundingClientRect()
    if (clientY < box.top + box.height / 2) return index
  }
  return tiles.length
}

function Tile({ card, board, now, dragged, canWrite, onOpen, onDragStart, onDragEnd, actions, onSend, choosing, picked, onPicked }) {
  const labels = (board.labels || []).filter((label) => (card.labels || []).includes(label.id))
  const shots = (card.files || []).filter(isImage)
  const steps = card.checklist || []
  const ticked = steps.filter((step) => step.done).length
  const due = dueState(card, now)
  const [at, setAt] = useState(null)
  const [picking, setPicking] = useState(false)
  const root = useRef(null)
  const chip = useRef(null)

  const anchor = useMemo(() => ({ get current() { return chip.current ?? root.current } }), [])

  const reveal = (event) => {
    if (!canWrite || choosing) return
    event.preventDefault()
    event.stopPropagation()
    const box = event.currentTarget.getBoundingClientRect()
    setAt(event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : { x: box.right - 200, y: box.bottom })
  }

  const meta =
    due || steps.length > 0 || (card.comments || []).length > 0 || (card.links || []).length > 0 || (card.files || []).length > 0

  return (
    <span ref={root} className="relative block">
      <button
        type="button"
        data-card={card.id}
        draggable={canWrite && !choosing}
        aria-pressed={choosing ? picked : undefined}
        onContextMenu={reveal}
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', card.id)
          event.dataTransfer.effectAllowed = 'move'
          onDragStart(card.id)
        }}
        onDragEnd={onDragEnd}
        onClick={(event) => (choosing ? onPicked(card.id, event.shiftKey) : onOpen(card.id))}
        className={`${CARD_SHELL} px-2.5 py-2 ${
          picked ? 'border-ink-strong/50 bg-surface-hover' : 'border-line hover:border-line-strong hover:bg-surface-raised'
        } ${dragged === card.id ? 'opacity-40' : ''} ${card.archived ? 'opacity-70' : ''}`}
      >
        {shots.length > 0 && (
          <span className="relative -mx-2.5 -mt-2 mb-2 block h-24 overflow-hidden rounded-t-lg bg-surface-raised">
            <StoredImage path={shots[0].thumb || shots[0].path} alt="" className="h-full w-full object-cover" />
            {shots.length > 1 && (
              <span className="absolute bottom-1 right-1 rounded border border-line bg-surface/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink">
                +{shots.length - 1}
              </span>
            )}
          </span>
        )}

        {labels.length > 0 && (
          <span className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {labels.map((label) => (
              <span key={label.id} className="inline-flex items-center gap-1 text-[10.5px] text-ink-subtle">
                <Dot colour={label.colour} className="h-1.5 w-1.5" />
                {label.name}
              </span>
            ))}
          </span>
        )}

        <span className="flex items-start gap-2">
          <span
            role="checkbox"
            aria-checked={card.done}
            aria-label={card.done ? 'Done — mark unfinished' : 'Mark done'}
            tabIndex={canWrite && !choosing ? 0 : -1}
            onClick={
              canWrite && !choosing
                ? (event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    actions.card.set(card, { done: !card.done })
                  }
                : undefined
            }
            onKeyDown={
              canWrite && !choosing
                ? (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    event.stopPropagation()
                    actions.card.set(card, { done: !card.done })
                  }
                : undefined
            }
            className={`mt-px shrink-0 ${canWrite && !choosing ? 'cursor-pointer' : ''}`}
          >
            <Icon name={card.done ? 'circleCheck' : 'circle'} className={`h-[15px] w-[15px] ${card.done ? 'text-ink-strong' : 'text-ink-faint transition-colors hover:text-ink-muted'}`} />
          </span>

          <span className={`min-w-0 flex-1 text-[12.5px] leading-snug ${card.done ? 'text-ink-faint line-through' : 'text-ink-secondary'}`}>{card.title}</span>
          <span className="mt-px shrink-0 font-mono text-[9.5px] tabular-nums text-ink-faint opacity-0 transition-opacity max-sm:mr-5 max-sm:opacity-100 group-hover/tile:opacity-100">
            {card.seq}
          </span>
        </span>

        {meta && (
          <span className={TILE_META}>
            {due && !card.done && (
              <span
                ref={chip}
                role={canWrite ? 'button' : undefined}
                tabIndex={canWrite ? 0 : undefined}
                aria-label={canWrite ? `Due ${due.label} — change it` : undefined}
                onClick={
                  canWrite
                    ? (event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setPicking(true)
                      }
                    : undefined
                }
                onKeyDown={
                  canWrite
                    ? (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        event.stopPropagation()
                        setPicking(true)
                      }
                    : undefined
                }
                className={`inline-flex items-center gap-1 font-medium tabular-nums ${DUE_TONE[due.tone]} ${
                  canWrite ? 'cursor-pointer rounded px-0.5 hover:bg-surface-hover' : ''
                }`}
              >
                <Icon name="clock" className="h-3 w-3" />
                {due.tone === 'late' ? 'Overdue' : due.label}
              </span>
            )}
            {steps.length > 0 && (
              <span className={`inline-flex items-center gap-1 ${ticked === steps.length ? 'text-ink-subtle' : ''}`}>
                <Icon name="listTodo" className="h-3 w-3" />
                {ticked}/{steps.length}
              </span>
            )}
            {(card.comments || []).length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Icon name="message" className="h-3 w-3" />
                {card.comments.length}
              </span>
            )}
            {(card.links || []).length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Icon name="link" className="h-3 w-3" />
                {card.links.length}
              </span>
            )}
            {(card.files || []).length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Icon name="paperclip" className="h-3 w-3" />
                {card.files.length}
              </span>
            )}
            {card.archived && <Tag>Archived</Tag>}
          </span>
        )}
      </button>

      {canWrite && choosing && (
        <span aria-hidden="true" className={`pointer-events-none absolute right-1.5 top-2 ${picked ? 'text-ink-strong' : 'text-ink-faint'}`}>
          <Icon name={picked ? 'squareCheck' : 'square'} className="h-4 w-4" />
        </span>
      )}

      {canWrite && !choosing && (
        <button
          type="button"
          aria-label={`What to do with ${card.title}`}
          aria-haspopup="menu"
          onClick={reveal}
          className={`absolute right-1 top-1.5 cursor-pointer rounded border border-line bg-surface p-0.5 text-ink-faint transition-opacity hover:text-ink-strong focus:opacity-100 group-hover/tile:opacity-100 max-sm:p-1.5 max-sm:opacity-100 ${
            at ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Icon name="dots" className="h-3.5 w-3.5" />
        </button>
      )}

      {at && (
        <PointerMenu at={at} onClose={() => setAt(null)}>
          <MenuItem icon={card.done ? 'circle' : 'circleCheck'} onClick={() => actions.card.set(card, { done: !card.done })}>
            {card.done ? 'Mark unfinished' : 'Mark done'}
          </MenuItem>
          <MenuItem icon="calendar" onClick={() => setPicking(true)}>
            {card.due ? 'Change due date' : 'Set a due date'}
          </MenuItem>
          <MenuItem icon="copy" onClick={() => actions.card.duplicate(card)}>
            Duplicate
          </MenuItem>
          <MenuItem icon="send" onClick={() => onSend(card.id)}>
            Move to another board…
          </MenuItem>
          <MenuItem icon="squareCheck" onClick={() => onPicked(card.id, false)}>
            Select
          </MenuItem>
          <MenuLine />
          <MenuItem icon="archive" onClick={() => actions.card.set(card, { archived: !card.archived })}>
            {card.archived ? 'Restore' : 'Archive'}
          </MenuItem>
          <MenuItem icon="trash" tone="danger" onClick={() => actions.card.remove(card)}>
            Delete
          </MenuItem>
        </PointerMenu>
      )}

      {picking && canWrite && (
        <WhenPicker
          anchor={anchor}
          value={card.due}
          now={now}
          board={board}
          onClose={() => setPicking(false)}
          onChange={(iso) => actions.card.set(card, { due: iso })}
        />
      )}
    </span>
  )
}

function Composer({ onAdd, onClose, busy, atTop }) {
  const [title, setTitle] = useState('')
  const field = useRef(null)

  useEffect(() => field.current?.focus(), [])

  const send = (again) => {
    const cleaned = title.trim()
    if (!cleaned) return
    onAdd(cleaned)
    setTitle('')
    if (again) field.current?.focus()
    else onClose()
  }

  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-line-strong bg-surface p-2 ${atTop ? 'mb-1.5' : 'mt-1.5'}`}>
      <textarea
        ref={field}
        rows={2}
        value={title}
        maxLength={LIMITS.title}
        placeholder="What needs doing?"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
          if (event.key !== 'Enter') return
          event.preventDefault()
          send(event.shiftKey)
        }}
        className="w-full resize-none bg-transparent text-[12.5px] leading-snug text-ink-strong outline-none placeholder:text-ink-faint"
      />
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy || !title.trim()} onClick={() => send(false)} className={BTN_SOLID}>
          Add card
        </button>
        <button type="button" onClick={onClose} className={BTN_BARE}>
          Cancel
        </button>
        <span className="ml-auto text-[10px] text-ink-faint">⇧↵ keeps going</span>
      </div>
    </div>
  )
}

function Column({
  column,
  position,
  total,
  board,
  cards,
  load,
  dragged,
  dropAt,
  canWrite,
  actions,
  filters,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onSend,
  choosing,
  picked,
  onPicked,
  onPickColumn,
}) {
  const [composing, setComposing] = useState(null)
  const [limiting, setLimiting] = useState(false)
  const [limit, setLimit] = useState('')
  const body = useRef(null)

  const shown = cards.length
  const hidden = filters.archived ? 0 : Math.max(0, load - shown)
  const cap = filters.archived ? 0 : column.cap || 0
  const over = cap > 0 && load > cap
  const full = cap > 0 && load >= cap

  const carried = dragged ? (board.allCards || []).find((entry) => entry.id === dragged) : null
  const barred = full && Boolean(carried) && carried.list_id !== column.id && !carried.archived

  const tally = filters.archived ? String(shown) : hidden ? `${shown}/${load}` : cap ? `${load}/${cap}` : String(load)
  const reading = filters.archived
    ? `${plural(shown, 'archived card')} — a column limit does not count these`
    : hidden
      ? `${shown} of ${load} shown${cap ? `, the limit is ${cap}` : ''}`
      : cap
        ? `${load} of ${cap} — the column limit`
        : undefined

  const finished = cards.filter((card) => card.done && !card.archived)

  const saveLimit = () => {
    setLimiting(false)
    const cleaned = limit.trim()
    const held = column.cap ?? null
    if (cleaned === '') {
      if (held !== null) actions.column.set(column.id, { cap: null })
      return
    }
    const read = Number(cleaned)
    if (!Number.isFinite(read)) return
    const wanted = Math.min(LIMITS.listCap, Math.max(0, Math.round(read))) || null
    if (wanted !== held) actions.column.set(column.id, { cap: wanted })
  }

  return (
    <section
      data-column={column.id}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex w-[280px] shrink-0 flex-col rounded-xl border bg-surface-raised/35 max-sm:w-[86vw] ${
        barred ? 'border-dashed border-red-500/40' : dropAt !== null ? 'border-line-strong' : 'border-line'
      }`}
    >
      <header className={`flex h-10 items-center gap-2 rounded-t-xl border-b px-2.5 ${over ? 'border-red-500/30' : 'border-line'}`}>
        {column.done && <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-ink-subtle" title="Dropping a card here ticks it off" />}

        {limiting ? (
          <>
            <label htmlFor={`cap-${column.id}`} className="shrink-0 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-subtle">
              Limit
            </label>
            <input
              autoFocus
              id={`cap-${column.id}`}
              type="number"
              min="0"
              max={LIMITS.listCap}
              value={limit}
              placeholder="none"
              onChange={(event) => setLimit(event.target.value)}
              onBlur={saveLimit}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setLimiting(false)
                if (event.key === 'Enter') saveLimit()
              }}
              className={`${INPUT} h-7`}
            />
          </>
        ) : (
          <>
            {canWrite ? (
              <InlineEdit
                value={column.name}
                maxLength={LIMITS.listName}
                ariaLabel="Column name"
                onSave={(name) => actions.column.set(column.id, { name })}
                className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-strong"
              />
            ) : (
              <span className="min-w-0 truncate font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-strong">{column.name}</span>
            )}
            <span
              title={reading}
              className={`shrink-0 font-mono text-[10.5px] tabular-nums ${over ? 'font-semibold text-red-500' : full ? 'text-amber-500' : 'text-ink-faint'}`}
            >
              {tally}
            </span>
          </>
        )}

        <span className="flex-1" />

        {canWrite && !limiting && (
          <>
            <button
              type="button"
              aria-label={`Add a card to ${column.name}`}
              onClick={() => setComposing('top')}
              className="cursor-pointer rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink-strong"
            >
              <Icon name="plus" className="h-4 w-4" />
            </button>
            <Menu
              label={`${column.name} options`}
              trigger={({ toggle }) => (
                <button type="button" aria-label={`${column.name} options`} aria-haspopup="menu" onClick={toggle} className="cursor-pointer rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink-strong">
                  <Icon name="dots" className="h-4 w-4" />
                </button>
              )}
            >
              <MenuLabel>Order</MenuLabel>
              {LIST_SORTS.map((sort) => (
                <MenuItem key={sort.id} icon="sort" onClick={() => actions.column.sort(column.id, sort.id)}>
                  Sort by {sort.label.toLowerCase()}
                </MenuItem>
              ))}
              <MenuLine />
              <MenuItem icon="arrowLeft" disabled={position === 0} onClick={() => actions.column.move(column.id, position - 1)}>
                Move left
              </MenuItem>
              <MenuItem icon="arrowRight" disabled={position === total - 1} onClick={() => actions.column.move(column.id, position + 1)}>
                Move right
              </MenuItem>
              <MenuLine />
              <MenuItem
                icon="filter"
                onClick={() => {
                  setLimit(column.cap ? String(column.cap) : '')
                  setLimiting(true)
                }}
              >
                {column.cap ? `Change limit (${column.cap})` : 'Set a card limit'}
              </MenuItem>
              <MenuItem icon={column.done ? 'circle' : 'circleCheck'} checked={column.done} onClick={() => actions.column.set(column.id, { done: !column.done })}>
                Finish line
              </MenuItem>
              <MenuItem icon="squareCheck" onClick={() => onPickColumn(cards.map((card) => card.id))}>
                Select every card here
              </MenuItem>
              {finished.length > 0 && (
                <MenuItem icon="archive" onClick={() => actions.bulk(finished, 'archive')}>
                  Archive {plural(finished.length, 'finished card')}
                </MenuItem>
              )}
              <MenuLine />
              <MenuItem icon="trash" tone="danger" onClick={() => actions.column.remove(column)}>
                Delete column
              </MenuItem>
            </Menu>
          </>
        )}
      </header>

      <div ref={body} data-column-body className="flex min-h-[60px] flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {composing === 'top' && <Composer atTop onAdd={(title) => actions.card.add(column.id, title, true)} onClose={() => setComposing(null)} busy={actions.busy} />}

        {cards.map((card, index) => (
          <span key={card.id} className="block">
            {dropAt === index && <span aria-hidden="true" className="mb-1.5 block h-px bg-ink-strong" />}
            <Tile
              card={card}
              board={board}
              now={actions.now}
              dragged={dragged}
              canWrite={canWrite}
              onOpen={onOpen}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              actions={actions}
              onSend={onSend}
              choosing={choosing}
              picked={picked.has(card.id)}
              onPicked={onPicked}
            />
          </span>
        ))}

        {dropAt === cards.length && <span aria-hidden="true" className="block h-px bg-ink-strong" />}

        {!cards.length && composing !== 'top' && (
          <p className="px-1 py-8 text-center text-[11.5px] text-ink-faint">{hidden ? `${plural(hidden, 'card')} hidden` : 'Nothing here'}</p>
        )}

        {hidden > 0 && cards.length > 0 && <p className="px-1 pt-1 text-center text-[10.5px] text-ink-faint">{plural(hidden, 'more')} hidden by the filters</p>}

        {composing === 'bottom' && <Composer onAdd={(title) => actions.card.add(column.id, title, false)} onClose={() => setComposing(null)} busy={actions.busy} />}
      </div>

      {canWrite && composing !== 'bottom' && (
        <button
          type="button"
          onClick={() => setComposing('bottom')}
          className="flex w-full cursor-pointer items-center gap-1.5 rounded-b-xl border-t border-line px-3 py-2 text-left text-[12px] text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink-strong"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          Add a card
        </button>
      )}
    </section>
  )
}

const PAN_SKIP = 'a,button,input,textarea,select,[data-card],[data-column] header,[contenteditable="true"],[role="menu"]'

export default function Columns({ board, cards, filters, canWrite, actions, onOpen, onDragging, onSend, selection }) {
  const [dragged, setDragged] = useState(null)
  const [drop, setDrop] = useState(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const rail = useRef(null)
  const pan = useRef(null)

  const { choosing, picked, setPicked, setChoosing } = selection

  const byColumn = useMemo(() => {
    const map = new Map(board.lists.map((list) => [list.id, []]))
    const loads = new Map(board.lists.map((list) => [list.id, 0]))
    for (const card of cards) {
      if (!map.has(card.list_id)) continue
      if (!card.archived) loads.set(card.list_id, loads.get(card.list_id) + 1)
      if (cardMatches(card, filters, board.labels)) map.get(card.list_id).push(card)
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position)
    return { map, loads }
  }, [board.lists, board.labels, cards, filters])

  const endDrag = useCallback(() => {
    setDragged(null)
    setDrop(null)
    onDragging(false)
  }, [onDragging])

  const startDrag = useCallback(
    (id) => {
      setDragged(id)
      onDragging(true)
    },
    [onDragging],
  )

  useEffect(() => {
    const move = (event) => {
      if (!pan.current || !rail.current) return
      rail.current.scrollLeft = pan.current.from - (event.clientX - pan.current.x)
    }
    const drop_ = () => {
      if (pan.current && rail.current) rail.current.classList.remove('cursor-grabbing')
      pan.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop_)
    window.addEventListener('pointercancel', drop_)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop_)
      window.removeEventListener('pointercancel', drop_)
    }
  }, [])

  const grab = (event) => {
    if (event.button !== 0 || event.target.closest(PAN_SKIP)) return
    pan.current = { x: event.clientX, from: rail.current.scrollLeft }
    rail.current.classList.add('cursor-grabbing')
  }

  const onPicked = useCallback(
    (id, range) => {
      setChoosing(true)
      setPicked((held) => {
        const next = new Set(held)
        if (range) {
          const column = cards.find((card) => card.id === id)?.list_id
          const row = (byColumn.map.get(column) || []).map((card) => card.id)
          const last = [...next].filter((entry) => row.includes(entry)).pop()
          if (last) {
            const from = row.indexOf(last)
            const to = row.indexOf(id)
            row.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((entry) => next.add(entry))
            return next
          }
        }
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [byColumn.map, cards, setChoosing, setPicked],
  )

  const pickColumn = useCallback(
    (ids) => {
      setChoosing(true)
      setPicked((held) => new Set([...held, ...ids]))
    },
    [setChoosing, setPicked],
  )

  const onColumnDragOver = (column) => (event) => {
    if (!dragged || !canWrite) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const holder = event.currentTarget.querySelector('[data-column-body]')
    const index = indexFromPoint(holder || event.currentTarget, event.clientY, dragged)
    setDrop({ column: column.id, index })
  }

  const onColumnDrop = (column) => async (event) => {
    if (!dragged || !canWrite) return
    event.preventDefault()
    const card = cards.find((entry) => entry.id === dragged)
    const visible = (byColumn.map.get(column.id) || []).filter((entry) => entry.id !== card?.id)
    const at = drop?.column === column.id ? drop.index : visible.length
    endDrag()
    if (!card) return

    const full = cards
      .filter((entry) => entry.list_id === column.id && entry.id !== card.id && Boolean(entry.archived) === Boolean(card.archived))
      .sort((a, b) => a.position - b.position)
    const anchor = visible[at]
    const index = anchor ? Math.max(0, full.findIndex((entry) => entry.id === anchor.id)) : full.length

    const wasDone = board.lists.find((list) => list.id === card.list_id)?.done
    const done = column.done ? true : wasDone && !column.done ? false : undefined
    await actions.card.move(card, column.id, index, full, done)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={rail}
        onPointerDown={grab}
        onDragOver={(event) => dragged && event.preventDefault()}
        onDragEnd={endDrag}
        className="flex cursor-grab items-start gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]"
      >
        {board.lists.map((column, index) => (
          <Column
            key={column.id}
            column={column}
            position={index}
            total={board.lists.length}
            board={{ ...board, allCards: cards }}
            cards={byColumn.map.get(column.id) || []}
            load={byColumn.loads.get(column.id) || 0}
            dragged={dragged}
            dropAt={drop?.column === column.id ? drop.index : null}
            canWrite={canWrite}
            actions={actions}
            filters={filters}
            onOpen={onOpen}
            onDragStart={startDrag}
            onDragEnd={endDrag}
            onDragOver={onColumnDragOver(column)}
            onDrop={onColumnDrop(column)}
            onSend={onSend}
            choosing={choosing}
            picked={picked}
            onPicked={onPicked}
            onPickColumn={pickColumn}
          />
        ))}

        {canWrite && board.lists.length < LIMITS.lists && (
          <div className="w-[260px] shrink-0 max-sm:w-[70vw]">
            {adding ? (
              <div className="flex flex-col gap-2 rounded-xl border border-line-strong bg-surface p-2">
                <input
                  autoFocus
                  value={name}
                  maxLength={LIMITS.listName}
                  placeholder="Column name"
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setAdding(false)
                      setName('')
                    }
                    if (event.key !== 'Enter') return
                    const cleaned = name.trim()
                    if (!cleaned) return
                    actions.column.add(cleaned)
                    setName('')
                    setAdding(false)
                  }}
                  className={INPUT}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!name.trim()}
                    onClick={() => {
                      actions.column.add(name.trim())
                      setName('')
                      setAdding(false)
                    }}
                    className={BTN_SOLID}
                  >
                    Add column
                  </button>
                  <button type="button" onClick={() => setAdding(false)} className={BTN_BARE}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex h-10 w-full cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-line px-3 text-left text-[12px] text-ink-subtle transition-colors hover:border-line-strong hover:text-ink-strong"
              >
                <Icon name="plus" className="h-3.5 w-3.5" />
                Add a column
              </button>
            )}
          </div>
        )}
      </div>

      {board.lists.length >= LIMITS.lists && <p className="text-[11.5px] text-ink-faint">{LIMITS.lists} columns is the most a board takes.</p>}
    </div>
  )
}
