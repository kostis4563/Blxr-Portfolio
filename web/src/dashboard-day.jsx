import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { Field, INPUT, TEXTAREA, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, Modal, Segmented } from './components/settings-ui'
import { Note, CARD, Chip, UndoBar } from './components/boards/ui'
import { Bone } from './components/skeleton'
import Homework from './components/day-homework'
import { navigate, dashboardPath } from './lib/router'
import { prefersTwelveHour } from './lib/booking'
import { mergeAccountPrefs } from './lib/prefs'
import {
  LIMITS,
  DAY_NAMES,
  REPEATS,
  TIMINGS,
  todayIso,
  isDate,
  shiftDay,
  weekOf,
  formatLongDay,
  formatShortDay,
  formatWeekday,
  dayNumber,
  relativeDay,
  formatRange,
  parseQuick,
  onWeekday,
  occursOn,
  doneOn,
  planFor,
  toggleMark,
  repeatLabel,
  formFrom,
  problemsOf,
  blockFrom,
} from './lib/day'
import { listBlocks, saveBlock, markBlock, deleteBlock, errorText } from './lib/day-api'

const newId = () => crypto.randomUUID()
const ACCENT = 'text-[#0d99ff]'
const firstLine = (text) => text.split('\n')[0]

function isTyping(target) {
  const tag = target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
}

function useToday() {
  const [today, setToday] = useState(() => todayIso())
  useEffect(() => {
    const tick = () => setToday(todayIso())
    const timer = setInterval(tick, 60000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

function useTwelve(user) {
  const format = mergeAccountPrefs(user?.user_metadata?.prefs).locale.timeFormat
  return useMemo(() => (format === 'auto' ? prefersTwelveHour() : format === '12'), [format])
}

function useBlocks(weekStart) {
  const [blocks, setBlocks] = useState(null)
  const [weeks, setWeeks] = useState(() => new Set())
  const [error, setError] = useState(null)

  const fetchAround = useCallback(async (start) => {
    const from = shiftDay(start, -7)
    const to = shiftDay(start, 13)
    try {
      const rows = await listBlocks({ from, to })
      setBlocks((held) => [...(held || []).filter((b) => !b.repeat && (b.day < from || b.day > to)), ...rows])
      setWeeks((held) => new Set([...held, from, start, shiftDay(start, 7)]))
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => {
    if ([-7, 0, 7].every((by) => weeks.has(shiftDay(weekStart, by)))) return
    fetchAround(weekStart)
  }, [weekStart, weeks, fetchAround])

  const reload = useCallback(() => fetchAround(weekStart), [fetchAround, weekStart])

  return { blocks, setBlocks, ready: weeks.has(weekStart), error, setError, reload }
}

export default function DashboardDay({ hash, user }) {
  const today = useToday()
  const sub = hash.replace(/^#/, '').split('/')[1] || ''
  const day = isDate(sub) ? sub : today
  const week = useMemo(() => weekOf(day), [day])
  const { blocks, setBlocks, ready, error, setError, reload } = useBlocks(week[0])
  const twelve = useTwelve(user)
  const items = useMemo(() => (blocks ? planFor(blocks, day) : []), [blocks, day])
  const done = items.filter((block) => doneOn(block, day)).length
  const [editing, setEditing] = useState(null)
  const [undo, setUndo] = useState(null)
  const [undoBusy, setUndoBusy] = useState(false)
  const field = useRef(null)
  const homeworkField = useRef(null)

  const go =useCallback((iso) => navigate(dashboardPath(iso === today ? 'day' : `day/${iso}`), { replace: true }), [today])

  const put = useCallback((next) => setBlocks((held) => (held || []).map((b) => (b.id === next.id ? next : b))), [setBlocks])
  const add = useCallback((next) => setBlocks((held) => [...(held || []).filter((b) => b.id !== next.id), next]), [setBlocks])
  const drop = useCallback((id) => setBlocks((held) => (held || []).filter((b) => b.id !== id)), [setBlocks])

  const closeEditor = useCallback(() => setEditing(null), [])
  const closeUndo = useCallback(() => setUndo(null), [])

  const toggle = useCallback(async (block) => {
    const next = { ...block, done: toggleMark(block.done, day, !doneOn(block, day), today) }
    put(next)
    try {
      await markBlock(block.id, { done: next.done })
    } catch (err) {
      put(block)
      setError(err)
    }
  }, [day, today, put, setError])

  const quickAdd = useCallback(async (text) => {
    const parsed = parseQuick(text)
    if (!parsed) return false
    const block = { id: newId(), ...parsed, note: '', day, repeat: 0, done: [], skipped: [], createdAt: new Date().toISOString() }
    add(block)
    try {
      put(await saveBlock(block, { isNew: true }))
      return true
    } catch (err) {
      drop(block.id)
      setError(err)
      return false
    }
  }, [day, add, put, drop, setError])

  const save = useCallback(async (form, base) => {
    put(await saveBlock(blockFrom(base.id, form, { day, base }), { isNew: false }))
  }, [day, put])

  const remove = useCallback(async (block) => {
    setEditing(null)
    drop(block.id)
    try {
      await deleteBlock(block.id)
      setUndo({ what: `Deleted “${block.title}”`, run: async () => add(await saveBlock(block, { isNew: true })) })
    } catch (err) {
      add(block)
      setError(err)
    }
  }, [add, drop, setError])

  const skip = useCallback(async (block) => {
    setEditing(null)
    const next = { ...block, skipped: toggleMark(block.skipped, day, true, today) }
    put(next)
    try {
      await markBlock(block.id, { skipped: next.skipped })
      setUndo({
        what: `Skipped “${block.title}” on ${formatShortDay(day)}`,
        run: async () => {
          await markBlock(block.id, { skipped: block.skipped })
          put(block)
        },
      })
    } catch (err) {
      put(block)
      setError(err)
    }
  }, [day, today, put, setError])

  const runUndo = useCallback(async () => {
    if (!undo) return
    setUndoBusy(true)
    try {
      await undo.run()
    } catch (err) {
      setError(err)
    } finally {
      setUndoBusy(false)
      setUndo(null)
    }
  }, [undo, setError])

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) return
      if (e.key === 'ArrowLeft') go(shiftDay(day, -1))
      else if (e.key === 'ArrowRight') go(shiftDay(day, 1))
      else if (e.key === 't') go(today)
      else if (e.key === 'n') field.current?.focus()
      else if (e.key === 'h') homeworkField.current?.focus()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, day, today])

  if (error && !blocks) {
    return (
      <div className="flex flex-col gap-3">
        <Note tone="error">{errorText(error)}</Note>
        <div>
          <button type="button" className={BTN_SECONDARY} onClick={reload}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-rise-in">
      <Homework today={today} inputRef={homeworkField} onUndoable={setUndo} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <DayBar day={day} today={today} onGo={go} />
          <WeekStrip week={week} day={day} today={today} blocks={ready ? blocks : null} onGo={go} />
        </div>

        {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}

        <div className="flex flex-col gap-2">
          <section aria-label={`Plan for ${formatLongDay(day)}`} className={`${CARD} overflow-hidden`}>
            {!ready ? (
              <ListSkeleton />
            ) : items.length === 0 ? (
              <p className="px-5 pb-2 pt-8 text-center text-[13px] leading-relaxed text-ink-muted">
                Nothing for {formatWeekday(day)} yet.
                <span className="block text-[12.5px] text-ink-faint">Start with a time if it needs one, like 17:00 Math.</span>
              </p>
            ) : (
              <ul aria-label="Plan" className="divide-y divide-line">
                {items.map((block) => (
                  <Item key={block.id} block={block} day={day} twelve={twelve} onToggle={toggle} onOpen={setEditing} />
                ))}
              </ul>
            )}
            <QuickAdd inputRef={field} day={day} twelve={twelve} onAdd={quickAdd} disabled={!ready} divided={ready && items.length > 0} />
          </section>
          {ready && items.length > 0 && (
            <p className="px-1 text-right text-[12px] tabular-nums text-ink-faint">
              {done === items.length ? 'All done' : `${done} of ${items.length} done`}
            </p>
          )}
        </div>
      </div>

      {editing && (
        <ItemEditor key={editing.id} base={editing} day={day} onClose={closeEditor} onSave={save} onDelete={remove} onSkip={skip} />
      )}

      {undo && <UndoBar what={undo.what} onUndo={runUndo} onClose={closeUndo} busy={undoBusy} />}
    </div>
  )
}

function DayBar({ day, today, onGo }) {
  const picker = useRef(null)
  const openPicker = () => {
    const input = picker.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      input.focus()
    }
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="relative min-w-0">
        <button
          type="button"
          onClick={openPicker}
          aria-label={`${formatLongDay(day)}, pick another day`}
          className="-mx-1.5 flex min-w-0 cursor-pointer items-baseline gap-2 rounded-md px-1.5 py-0.5 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/30"
        >
          <span className="truncate text-[15px] font-semibold tracking-tight text-ink-strong">{formatLongDay(day)}</span>
          <span className={`shrink-0 text-[12.5px] ${day === today ? ACCENT : 'text-ink-subtle'}`}>{relativeDay(day, today)}</span>
        </button>
        <input
          ref={picker}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={day}
          onChange={(e) => isDate(e.target.value) && onGo(e.target.value)}
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
        />
      </span>
      <div className="flex shrink-0 items-center">
        <button type="button" className={`${BTN_GHOST} w-8 px-0`} onClick={() => onGo(shiftDay(day, -1))} aria-label="Previous day" title="Previous day · ←">
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>
        <button type="button" className={`${BTN_GHOST} px-2.5`} onClick={() => onGo(today)} disabled={day === today} title="Today · T">
          Today
        </button>
        <button type="button" className={`${BTN_GHOST} w-8 px-0`} onClick={() => onGo(shiftDay(day, 1))} aria-label="Next day" title="Next day · →">
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function WeekStrip({ week, day, today, blocks, onGo }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {week.map((iso, i) => {
        const plan = blocks ? planFor(blocks, iso) : []
        const left = plan.filter((block) => !doneOn(block, iso)).length
        const on = iso === day
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onGo(iso)}
            aria-pressed={on}
            aria-label={`${formatLongDay(iso)}${blocks ? `, ${left} to do` : ''}`}
            className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${
              on ? 'bg-surface ring-1 ring-inset ring-line' : 'hover:bg-surface-hover/50'
            }`}
          >
            <span className={`text-[11px] ${on ? 'text-ink-muted' : 'text-ink-faint'}`}>{DAY_NAMES[i]}</span>
            <span className={`text-[15px] font-medium leading-none tabular-nums ${iso === today ? ACCENT : on ? 'text-ink-strong' : 'text-ink-secondary'}`}>
              {dayNumber(iso)}
            </span>
            <span aria-hidden="true" className={`h-1 w-1 rounded-full ${!plan.length ? 'bg-transparent' : left ? 'bg-ink-muted' : 'bg-line-strong'}`} />
          </button>
        )
      })}
    </div>
  )
}

function Item({ block, day, twelve, onToggle, onOpen }) {
  const done = doneOn(block, day)
  return (
    <li className="group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/40">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${block.title}, done`}
        onClick={() => onToggle(block)}
        className={`relative z-10 mt-px grid h-[18px] w-[18px] shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-[background-color,box-shadow,color] duration-150 focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${
          done ? 'bg-ink-strong text-ink-inverse' : 'text-transparent ring-1 ring-inset ring-line-strong hover:text-ink-faint hover:ring-ink-faint'
        }`}
      >
        <Icon name="check" className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => onOpen(block)}
        className="min-w-0 flex-1 cursor-pointer text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ink-strong/20"
      >
        <span className="flex min-w-0 items-baseline gap-2.5">
          {block.start !== null && (
            <span className={`shrink-0 font-mono text-[12px] tabular-nums ${done ? 'text-ink-faint' : 'text-ink-muted'}`}>
              {formatRange(block.start, block.end, twelve)}
            </span>
          )}
          <span className={`truncate text-[14px] leading-5 ${done ? 'text-ink-faint line-through decoration-ink-faint' : 'text-ink-strong'}`}>{block.title}</span>
        </span>
        {block.note && <span className="mt-0.5 block truncate text-[12.5px] text-ink-subtle">{firstLine(block.note)}</span>}
      </button>
      {block.repeat > 0 && (
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11.5px] text-ink-faint" title={repeatLabel(block.repeat)}>
          <Icon name="repeat" className="h-3 w-3" />
          <span className="hidden sm:inline">{repeatLabel(block.repeat)}</span>
        </span>
      )}
    </li>
  )
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="divide-y divide-line">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <span className="h-[18px] w-[18px] rounded-full ring-1 ring-inset ring-line" />
          <Bone className={`h-3 ${i === 1 ? 'w-28' : 'w-44'} max-w-full`} />
        </div>
      ))}
    </div>
  )
}

function QuickAdd({ inputRef, day, twelve, onAdd, disabled, divided }) {
  const [text, setText] = useState('')
  const preview = text.trim() ? parseQuick(text) : null

  const submit = async (e) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || disabled) return
    setText('')
    const ok = await onAdd(value)
    if (!ok) setText(value)
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={submit} className={`flex items-center gap-3 px-4 ${divided ? 'border-t border-line' : ''}`}>
      <Icon name="plus" className="h-[18px] w-[18px] shrink-0 p-0.5 text-ink-faint" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        maxLength={LIMITS.title + 24}
        aria-label={`Add to ${formatWeekday(day)}`}
        placeholder={`Add to ${formatWeekday(day)}…`}
        className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-ink-strong outline-none placeholder:text-ink-faint disabled:opacity-60"
      />
      {preview?.start != null && (
        <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-ink-subtle animate-menu-in">{formatRange(preview.start, preview.end, twelve)}</span>
      )}
    </form>
  )
}

function ItemEditor({ base, day, onClose, onSave, onDelete, onSkip }) {
  const formId = useId()
  const [form, setForm] = useState(() => formFrom(base))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showErrors, setShowErrors] = useState(false)

  const routine = Boolean(base.repeat)
  const problems = problemsOf(form)
  const shown = (key) => (showErrors ? problems[key] : null)
  const set = (key) => (value) => setForm((held) => ({ ...held, [key]: value }))

  const submit = async (e) => {
    e?.preventDefault()
    if (busy) return
    if (Object.keys(problems).length) {
      setShowErrors(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave(form, base)
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title="Edit"
      description={routine ? `${repeatLabel(base.repeat)}, since ${formatShortDay(base.day)}` : formatLongDay(base.day)}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <div className="mr-auto flex items-center gap-1">
            <button
              type="button"
              className={`${BTN_GHOST} w-8 px-0 hover:text-red-500`}
              onClick={() => onDelete(base)}
              disabled={busy}
              aria-label="Delete"
              title={routine ? 'Delete from every day' : 'Delete'}
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
            {routine && occursOn(base, day) && (
              <button type="button" className={BTN_GHOST} onClick={() => onSkip(base)} disabled={busy}>
                Skip {formatWeekday(day)}
              </button>
            )}
          </div>
          <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form={formId} className={BTN_PRIMARY} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4 pb-1">
        <Field label="What" htmlFor="day-title" error={shown('title')}>
          <input
            id="day-title"
            data-autofocus
            className={INPUT}
            value={form.title}
            onChange={(e) => set('title')(e.target.value)}
            maxLength={LIMITS.title}
            aria-invalid={Boolean(shown('title'))}
            autoComplete="off"
          />
        </Field>

        <Field label="When" error={shown('time')}>
          <div className="flex flex-col gap-2">
            <div>
              <Segmented value={form.timed ? 'set' : 'any'} onChange={(value) => set('timed')(value === 'set')} options={TIMINGS} label="When" />
            </div>
            {form.timed && (
              <div className="flex items-center gap-2">
                <input type="time" step={300} aria-label="Starts" className={`${INPUT} min-w-0`} value={form.start} onChange={(e) => set('start')(e.target.value)} />
                <span className="text-ink-faint" aria-hidden="true">–</span>
                <input type="time" step={300} aria-label="Ends, optional" className={`${INPUT} min-w-0`} value={form.end} onChange={(e) => set('end')(e.target.value)} />
                {form.end && (
                  <button type="button" className={`${BTN_GHOST} w-8 px-0`} onClick={() => set('end')('')} aria-label="No end time" title="No end time">
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </Field>

        <Field label="Repeats" error={shown('days')}>
          <div className="flex flex-col gap-2">
            <div>
              <Segmented value={form.repeat} onChange={set('repeat')} options={REPEATS} label="Repeats" />
            </div>
            {form.repeat === 'custom' && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Days">
                {DAY_NAMES.map((name, i) => (
                  <Chip key={name} active={onWeekday(form.days, i)} onClick={() => set('days')(form.days ^ (1 << i))}>
                    {name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field label="Note" htmlFor="day-note" hint="optional" error={shown('note')}>
          <textarea
            id="day-note"
            className={`${TEXTAREA} min-h-[80px]`}
            value={form.note}
            onChange={(e) => set('note')(e.target.value)}
            maxLength={LIMITS.note}
            placeholder="Pages, links, anything to remember"
          />
        </Field>

        {error && <Note tone="error">{errorText(error)}</Note>}
      </form>
    </Modal>
  )
}
