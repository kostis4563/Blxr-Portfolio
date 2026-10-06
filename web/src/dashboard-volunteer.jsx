import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { Field, INPUT, TEXTAREA, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, Toggle, Modal } from './components/settings-ui'
import { Note, Empty, Tag, CARD } from './components/boards/ui'
import { Spinner } from './components/skeleton'
import { navigate, dashboardPath, link, VOLUNTEER_PATH } from './lib/router'
import {
  LIMITS,
  blankForm,
  formFrom,
  eventFrom,
  problemsOf,
  sortEvents,
  totalsOf,
  formatRange,
  formatHours,
  photoUrl,
} from './lib/volunteer'
import { listEvents, saveEvent, deleteEvent, uploadPhoto, removePhotos, errorText, VolunteerError } from './lib/volunteer-api'

const today = () => new Date().toISOString().slice(0, 10)
const newId = () => crypto.randomUUID()

export default function DashboardVolunteer({ hash }) {
  const sub = decodeURIComponent(hash.replace(/^#/, '').split('/')[1] || '')
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setEvents(await listEvents())
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onSaved = useCallback((event) => {
    setEvents((list) => sortEvents([...(list || []).filter((e) => e.id !== event.id), event]))
  }, [])

  const onDeleted = useCallback((id) => {
    setEvents((list) => (list || []).filter((e) => e.id !== id))
    navigate(dashboardPath('volunteer'), { replace: true })
  }, [])

  if (error && !events) {
    return (
      <div className="flex flex-col gap-3">
        <Note tone="error">{errorText(error)}</Note>
        <div>
          <button type="button" className={BTN_SECONDARY} onClick={load}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      </div>
    )
  }
  if (!events) return <ListSkeleton />

  if (sub) {
    const event = sub === 'new' ? null : events.find((e) => e.id === sub)
    if (sub !== 'new' && !event) {
      return (
        <Empty
          icon="calendar"
          title="No event with that id"
          body="It may have been deleted."
          action={<a {...link(dashboardPath('volunteer'))} className={BTN_SECONDARY}>All events</a>}
        />
      )
    }
    return <EventEditor key={sub} event={event} onSaved={onSaved} onDeleted={onDeleted} />
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}
      <EventList events={events} loading={loading} onReload={load} />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className={`${CARD} divide-y divide-line overflow-hidden`} aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <span className="h-3 w-20 rounded bg-surface-hover" />
          <span className="h-3 flex-1 rounded bg-surface-hover" />
        </div>
      ))}
    </div>
  )
}

function EventList({ events, loading, onReload }) {
  const totals = totalsOf(events)
  const newButton = (
    <a {...link(dashboardPath('volunteer/new'))} className={BTN_PRIMARY}>
      <Icon name="plus" className="h-3.5 w-3.5" /> New event
    </a>
  )
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-muted">
          {totals.events} event{totals.events === 1 ? '' : 's'}
          {totals.hours > 0 && <> · {formatHours(totals.hours)}</>}
          {totals.organizations > 0 && <> · {totals.organizations} organization{totals.organizations === 1 ? '' : 's'}</>}
        </p>
        <div className="flex items-center gap-2">
          <a href={VOLUNTEER_PATH} target="_blank" rel="noreferrer" className={BTN_GHOST}>
            View page ↗
          </a>
          <button type="button" className={BTN_GHOST} onClick={onReload} disabled={loading} aria-label="Reload events">
            <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {newButton}
        </div>
      </div>

      {events.length === 0 ? (
        <Empty icon="calendar" title="No events yet" body="Add an event you volunteered at. It shows up on /volunteer as soon as you save it." action={newButton} />
      ) : (
        <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
          {events.map((event) => (
            <li key={event.id} className="group relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-hover/60">
              {event.photos[0] ? (
                <img src={photoUrl(event.photos[0])} alt="" loading="lazy" className="h-10 w-14 shrink-0 rounded-md border border-line object-cover" />
              ) : (
                <span className="grid h-10 w-14 shrink-0 place-items-center rounded-md border border-dashed border-line text-ink-faint">
                  <Icon name="image" className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <a {...link(dashboardPath(`volunteer/${event.id}`))} className="block truncate text-[13.5px] font-medium text-ink-strong outline-none after:absolute after:inset-0 focus-visible:underline">
                  {event.title}
                </a>
                <p className="truncate text-[12px] text-ink-subtle">
                  <span className="font-mono tabular-nums">{formatRange(event.startedOn, event.endedOn)}</span>
                  {event.organization && <> · {event.organization}</>}
                </p>
              </div>
              {!event.published && <Tag tone="amber">Hidden</Tag>}
              {event.hours != null && <span className="hidden font-mono text-[11.5px] tabular-nums text-ink-subtle sm:inline">{formatHours(event.hours)}</span>}
              {event.photos.length > 0 && (
                <span className="hidden items-center gap-1 text-[11.5px] text-ink-subtle sm:inline-flex">
                  <Icon name="image" className="h-3.5 w-3.5" /> {event.photos.length}
                </span>
              )}
              <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function EventEditor({ event, onSaved, onDeleted }) {
  const isNew = !event
  const [id] = useState(() => event?.id || newId())
  const initial = useMemo(() => (event ? formFrom(event) : blankForm(today())), [event])
  const [form, setForm] = useState(initial)
  const [photos, setPhotos] = useState(() => event?.photos || [])
  const [saved, setSaved] = useState(event)
  const [uploading, setUploading] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const fresh = useRef(new Set())
  const fileInput = useRef(null)

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setJustSaved(false)
  }

  const savedForm = saved ? formFrom(saved) : null
  const savedPhotos = saved?.photos || []
  const dirty = saved
    ? JSON.stringify(form) !== JSON.stringify(savedForm) || photos.join('|') !== savedPhotos.join('|')
    : Boolean(form.title.trim() || photos.length)
  const problems = problemsOf(form)
  const valid = Object.keys(problems).length === 0
  const shown = (key) => (showErrors ? problems[key] : null)
  const room = LIMITS.photos - photos.length - uploading

  useEffect(() => () => {
    if (fresh.current.size) removePhotos([...fresh.current]).catch(() => {})
  }, [])

  useEffect(() => {
    if (!dirty) return undefined
    const onLeave = (e) => { e.preventDefault() }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  const addFiles = async (fileList) => {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    if (files.length > room) setError(new VolunteerError('too_many'))
    const take = files.slice(0, Math.max(0, room))
    if (!take.length) return
    setUploading((n) => n + take.length)
    setJustSaved(false)
    await Promise.all(
      take.map(async (file) => {
        try {
          const path = await uploadPhoto(id, file)
          fresh.current.add(path)
          setPhotos((list) => [...list, path])
        } catch (err) {
          setError(err)
        } finally {
          setUploading((n) => n - 1)
        }
      }),
    )
  }

  const dropPhoto = (path) => {
    setPhotos((list) => list.filter((p) => p !== path))
    setJustSaved(false)
    if (fresh.current.has(path)) {
      fresh.current.delete(path)
      removePhotos([path]).catch(() => {})
    }
  }

  const moveFirst = (path) => {
    setPhotos((list) => [path, ...list.filter((p) => p !== path)])
    setJustSaved(false)
  }

  const save = async () => {
    if (busy || uploading) return
    if (!valid) {
      setShowErrors(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await saveEvent(eventFrom(id, form, photos), { isNew: !saved })
      const gone = savedPhotos.filter((p) => !photos.includes(p))
      if (gone.length) removePhotos(gone).catch(() => {})
      fresh.current.clear()
      setSaved(next)
      setForm(formFrom(next))
      setPhotos(next.photos)
      setShowErrors(false)
      setJustSaved(true)
      onSaved(next)
      if (!saved) navigate(dashboardPath(`volunteer/${next.id}`), { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const remove = async () => {
    setBusy(true)
    try {
      await deleteEvent({ id, photos: [...new Set([...savedPhotos, ...photos])] })
      fresh.current.clear()
      setConfirmDelete(false)
      onDeleted(id)
    } catch (err) {
      setError(err)
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  const action = !saved ? 'Add event' : 'Save changes'

  return (
    <div className="flex flex-col gap-5 animate-rise-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <a {...link(dashboardPath('volunteer'))} className={BTN_GHOST} aria-label="All events">
            <Icon name="arrowLeft" className="h-3.5 w-3.5" /> Events
          </a>
          <span className="truncate text-[13px] text-ink-muted">{isNew && !saved ? 'New event' : form.title || 'Untitled'}</span>
          {dirty && !busy && <span className="text-[11.5px] text-ink-faint">· unsaved</span>}
          {justSaved && !dirty && <span className="text-[11.5px] text-emerald-500 animate-menu-in">· saved</span>}
        </div>
        <div className="flex items-center gap-2">
          {saved?.published && (
            <a href={VOLUNTEER_PATH} target="_blank" rel="noreferrer" className={BTN_GHOST}>
              View ↗
            </a>
          )}
          {saved && (
            <button type="button" className={BTN_GHOST} onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Delete event">
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" className={BTN_PRIMARY} onClick={save} disabled={busy || uploading > 0 || (saved && !dirty)} title="⌘S">
            {busy ? 'Saving…' : uploading ? 'Uploading…' : action}
          </button>
        </div>
      </div>

      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}

      <div className={`${CARD} grid gap-4 p-4 sm:grid-cols-2 *:min-w-0`}>
        <Field label="Event" htmlFor="vol-title" error={shown('title')} hint={`${form.title.length}/${LIMITS.title}`} className="sm:col-span-2">
          <input
            id="vol-title"
            className={`${INPUT} h-10 text-[15px] font-medium`}
            value={form.title}
            onChange={(e) => set('title')(e.target.value)}
            placeholder="Beach clean-up at Schinias"
            maxLength={LIMITS.title}
            aria-invalid={Boolean(shown('title'))}
            autoFocus={isNew}
          />
        </Field>

        <Field label="Organization" htmlFor="vol-org" error={shown('organization')}>
          <input id="vol-org" className={INPUT} value={form.organization} onChange={(e) => set('organization')(e.target.value)} placeholder="Who ran it" maxLength={LIMITS.organization} />
        </Field>
        <Field label="Your role" htmlFor="vol-role" error={shown('role')}>
          <input id="vol-role" className={INPUT} value={form.role} onChange={(e) => set('role')(e.target.value)} placeholder="Volunteer, team lead, …" maxLength={LIMITS.role} />
        </Field>

        <Field label="Location" htmlFor="vol-location" error={shown('location')}>
          <input id="vol-location" className={INPUT} value={form.location} onChange={(e) => set('location')(e.target.value)} placeholder="Athens, Greece" maxLength={LIMITS.location} />
        </Field>
        <Field label="Hours" htmlFor="vol-hours" error={shown('hours')} hint="optional">
          <input id="vol-hours" type="number" inputMode="decimal" min="0.5" step="0.5" max={LIMITS.hours} className={INPUT} value={form.hours} onChange={(e) => set('hours')(e.target.value)} placeholder="6" aria-invalid={Boolean(shown('hours'))} />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:col-span-2 *:min-w-0 [&_input]:min-w-0">
          <Field label="From" htmlFor="vol-start" error={shown('startedOn')}>
            <input id="vol-start" type="date" className={INPUT} value={form.startedOn} onChange={(e) => set('startedOn')(e.target.value)} aria-invalid={Boolean(shown('startedOn'))} />
          </Field>
          <Field label="To" htmlFor="vol-end" error={shown('endedOn')} hint={form.endedOn ? <button type="button" className="cursor-pointer hover:text-ink-strong" onClick={() => set('endedOn')('')}>One day</button> : 'leave empty for one day'}>
            <input id="vol-end" type="date" min={form.startedOn} className={INPUT} value={form.endedOn} onChange={(e) => set('endedOn')(e.target.value)} aria-invalid={Boolean(shown('endedOn'))} />
          </Field>
        </div>

        <Field label="What you did" htmlFor="vol-summary" error={shown('summary')} hint={`${form.summary.length}/${LIMITS.summary}`} className="sm:col-span-2">
          <textarea
            id="vol-summary"
            className={`${TEXTAREA} min-h-[120px]`}
            value={form.summary}
            onChange={(e) => set('summary')(e.target.value)}
            placeholder="A few lines about the event and your part in it."
            maxLength={LIMITS.summary}
          />
        </Field>

        <Field label="Link" htmlFor="vol-url" error={shown('url')} hint="optional">
          <input id="vol-url" type="url" className={`${INPUT} font-mono text-[12.5px]`} value={form.url} onChange={(e) => set('url')(e.target.value)} placeholder="https://…" aria-invalid={Boolean(shown('url'))} />
        </Field>
        <Field label="Tags" htmlFor="vol-tags" error={shown('tags')} hint="comma separated">
          <input id="vol-tags" className={INPUT} value={form.tags} onChange={(e) => set('tags')(e.target.value)} placeholder="environment, kids" aria-invalid={Boolean(shown('tags'))} />
        </Field>

        <div className="flex items-center justify-between gap-4 sm:col-span-2">
          <div>
            <p className="text-[13px] font-medium text-ink-strong">Show on /volunteer</p>
            <p className="text-[12px] text-ink-muted">Hidden events are only visible to you.</p>
          </div>
          <Toggle checked={form.published} onChange={set('published')} label="Show on the volunteer page" />
        </div>
      </div>

      <section
        aria-label="Photos"
        className={`${CARD} flex flex-col gap-3 p-4 transition-colors ${dragging ? 'border-line-strong bg-surface-hover/50' : ''}`}
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-ink-strong">Photos</p>
            <p className="text-[12px] text-ink-muted">
              {photos.length}/{LIMITS.photos} · drop images here. The first one is the cover. Resized to WebP before upload.
            </p>
          </div>
          <button type="button" className={BTN_SECONDARY} onClick={() => fileInput.current?.click()} disabled={room <= 0}>
            <Icon name="upload" className="h-3.5 w-3.5" /> Add photos
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {photos.length === 0 && uploading === 0 ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-[12.5px] text-ink-subtle transition-colors hover:border-line-strong hover:text-ink-strong"
          >
            <Icon name="image" className="h-5 w-5" />
            Drop photos from the event, or click to pick them
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photos.map((path, i) => (
              <li key={path} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-surface-raised">
                <img src={photoUrl(path)} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-white">Cover</span>
                )}
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  {i > 0 && (
                    <button type="button" onClick={() => moveFirst(path)} className="grid h-7 cursor-pointer place-items-center rounded-md bg-black/60 px-2 text-[11px] font-medium text-white hover:bg-black/80">
                      Make cover
                    </button>
                  )}
                  <button type="button" onClick={() => dropPhoto(path)} aria-label="Remove photo" className="grid h-7 w-7 cursor-pointer place-items-center rounded-md bg-black/60 text-white hover:bg-red-600">
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <li key={`up-${i}`} className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-line text-ink-subtle">
                <Spinner className="h-5 w-5" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={confirmDelete}
        tone="danger"
        busy={busy}
        title="Delete this event?"
        description={`“${form.title || 'Untitled'}” and its ${photos.length} photo${photos.length === 1 ? '' : 's'} will be removed for good.`}
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
            <button type="button" className={BTN_DANGER} onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete event'}</button>
          </>
        }
      />
    </div>
  )
}
