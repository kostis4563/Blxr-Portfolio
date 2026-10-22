import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Icon } from './dashboard-sidebar'
import { Field, INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, Modal } from './settings-ui'
import { Note, CARD } from './boards/ui'
import { Bone } from './skeleton'
import { formatLongDay } from '../lib/day'
import {
  HOMEWORK_LIMITS,
  parseHomework,
  dueLabel,
  visibleHomework,
  subjectsOf,
  homeworkForm,
  homeworkProblems,
  homeworkFrom,
} from '../lib/homework'
import { listHomework, saveHomework, markHomework, deleteHomework, errorText } from '../lib/day-api'

const DUE_TONE = { late: 'text-red-500', soon: 'text-[#0d99ff]', later: 'text-ink-faint' }

export default function Homework({ today, inputRef, onUndoable }) {
  const headingId = useId()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    try {
      setItems(await listHomework({ since: today }))
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [today])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => (items ? visibleHomework(items, today) : []), [items, today])
  const known = useMemo(() => (items ? subjectsOf(items) : []), [items])
  const left = shown.filter((item) => !item.doneOn).length

  const put = useCallback((next) => setItems((held) => (held || []).map((i) => (i.id === next.id ? next : i))), [])
  const add = useCallback((next) => setItems((held) => [...(held || []).filter((i) => i.id !== next.id), next]), [])
  const drop = useCallback((id) => setItems((held) => (held || []).filter((i) => i.id !== id)), [])
  const closeEditor = useCallback(() => setEditing(null), [])

  const toggle = useCallback(async (item) => {
    const next = { ...item, doneOn: item.doneOn ? null : today }
    put(next)
    try {
      await markHomework(item.id, next.doneOn)
    } catch (err) {
      put(item)
      setError(err)
    }
  }, [today, put])

  const quickAdd = useCallback(async (text) => {
    const parsed = parseHomework(text, today, known)
    if (!parsed) return false
    const item = { id: crypto.randomUUID(), ...parsed, doneOn: null, createdAt: new Date().toISOString() }
    add(item)
    try {
      put(await saveHomework(item, { isNew: true }))
      return true
    } catch (err) {
      drop(item.id)
      setError(err)
      return false
    }
  }, [today, known, add, put, drop])

  const save = useCallback(async (form, base) => {
    put(await saveHomework(homeworkFrom(base, form), { isNew: false }))
  }, [put])

  const remove = useCallback(async (item) => {
    setEditing(null)
    drop(item.id)
    try {
      await deleteHomework(item.id)
      onUndoable({ what: `Deleted “${item.title}”`, run: async () => add(await saveHomework(item, { isNew: true })) })
    } catch (err) {
      add(item)
      setError(err)
    }
  }, [add, drop, onUndoable])

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-[15px] font-semibold tracking-tight text-ink-strong">Homework</h2>
        {items && shown.length > 0 && (
          <span className="text-[12px] tabular-nums text-ink-faint">{left ? `${left} to do` : 'All done'}</span>
        )}
      </div>

      {error && (
        <Note tone="error" onDismiss={items ? () => setError(null) : undefined}>
          {errorText(error)}
        </Note>
      )}

      {error && !items ? (
        <div>
          <button type="button" className={BTN_SECONDARY} onClick={load}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          {!items ? (
            <ListSkeleton />
          ) : shown.length === 0 ? (
            <p className="px-5 pb-2 pt-8 text-center text-[13px] leading-relaxed text-ink-muted">
              Nothing due.
              <span className="block text-[12.5px] text-ink-faint">Subject first, due day last, like maths ex 4B q1–12 fri.</span>
            </p>
          ) : (
            <ul aria-label="Homework" className="divide-y divide-line">
              {shown.map((item) => (
                <Row key={item.id} item={item} today={today} onToggle={toggle} onOpen={setEditing} />
              ))}
            </ul>
          )}
          <HomeworkAdd inputRef={inputRef} today={today} known={known} onAdd={quickAdd} disabled={!items} divided={Boolean(items) && shown.length > 0} />
        </div>
      )}

      {editing && (
        <HomeworkEditor key={editing.id} base={editing} known={known} onClose={closeEditor} onSave={save} onDelete={remove} />
      )}
    </section>
  )
}

function Row({ item, today, onToggle, onOpen }) {
  const done = Boolean(item.doneOn)
  const due = done ? null : dueLabel(item.due, today)
  return (
    <li className="group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/40">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${item.title}, done`}
        onClick={() => onToggle(item)}
        className={`relative z-10 mt-px grid h-[18px] w-[18px] shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-[background-color,box-shadow,color] duration-150 focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${
          done ? 'bg-ink-strong text-ink-inverse' : 'text-transparent ring-1 ring-inset ring-line-strong hover:text-ink-faint hover:ring-ink-faint'
        }`}
      >
        <Icon name="check" className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="min-w-0 flex-1 cursor-pointer text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ink-strong/20"
      >
        <span className="flex min-w-0 items-baseline gap-2.5">
          {item.subject && (
            <span className={`shrink-0 text-[12px] font-medium ${done ? 'text-ink-faint' : 'text-ink-muted'}`}>{item.subject}</span>
          )}
          <span className={`truncate text-[14px] leading-5 ${done ? 'text-ink-faint line-through decoration-ink-faint' : 'text-ink-strong'}`}>{item.title}</span>
        </span>
      </button>
      {due && (
        <span className={`mt-0.5 shrink-0 text-[12px] tabular-nums ${DUE_TONE[due.tone]}`} title={`Due ${formatLongDay(item.due)}`}>
          {due.text}
        </span>
      )}
    </li>
  )
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="divide-y divide-line">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <span className="h-[18px] w-[18px] rounded-full ring-1 ring-inset ring-line" />
          <Bone className={`h-3 ${i ? 'w-28' : 'w-44'} max-w-full`} />
        </div>
      ))}
    </div>
  )
}

function HomeworkAdd({ inputRef, today, known, onAdd, disabled, divided }) {
  const [text, setText] = useState('')
  const preview = text.trim() ? parseHomework(text, today, known) : null
  const due = preview ? dueLabel(preview.due, today) : null

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
        maxLength={HOMEWORK_LIMITS.title + 40}
        aria-label="Add homework"
        placeholder="Add homework…"
        className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-ink-strong outline-none placeholder:text-ink-faint disabled:opacity-60"
      />
      {(preview?.subject || due) && (
        <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-ink-subtle animate-menu-in">
          {preview.subject && <span>{preview.subject}</span>}
          {preview.subject && due && <span aria-hidden="true" className="text-ink-faint">·</span>}
          {due && <span className={DUE_TONE[due.tone]}>{due.text}</span>}
        </span>
      )}
    </form>
  )
}

function HomeworkEditor({ base, known, onClose, onSave, onDelete }) {
  const formId = useId()
  const listId = useId()
  const [form, setForm] = useState(() => homeworkForm(base))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showErrors, setShowErrors] = useState(false)

  const problems = homeworkProblems(form)
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
      title="Homework"
      description={base.due ? `Due ${formatLongDay(base.due)}` : 'No due date'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <div className="mr-auto">
            <button
              type="button"
              className={`${BTN_GHOST} w-8 px-0 hover:text-red-500`}
              onClick={() => onDelete(base)}
              disabled={busy}
              aria-label="Delete"
              title="Delete"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
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
        <Field label="What" htmlFor="homework-title" error={shown('title')}>
          <input
            id="homework-title"
            data-autofocus
            className={INPUT}
            value={form.title}
            onChange={(e) => set('title')(e.target.value)}
            maxLength={HOMEWORK_LIMITS.title}
            aria-invalid={Boolean(shown('title'))}
            autoComplete="off"
          />
        </Field>

        <Field label="Subject" htmlFor="homework-subject" hint="optional" error={shown('subject')}>
          <input
            id="homework-subject"
            list={listId}
            className={INPUT}
            value={form.subject}
            onChange={(e) => set('subject')(e.target.value)}
            maxLength={HOMEWORK_LIMITS.subject}
            aria-invalid={Boolean(shown('subject'))}
            autoComplete="off"
          />
          <datalist id={listId}>
            {known.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>

        <Field label="Due" htmlFor="homework-due" hint="optional" error={shown('due')}>
          <div className="flex items-center gap-2">
            <input id="homework-due" type="date" className={`${INPUT} min-w-0`} value={form.due} onChange={(e) => set('due')(e.target.value)} />
            {form.due && (
              <button type="button" className={`${BTN_GHOST} w-8 px-0`} onClick={() => set('due')('')} aria-label="No due date" title="No due date">
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </Field>

        {error && <Note tone="error">{errorText(error)}</Note>}
      </form>
    </Modal>
  )
}
