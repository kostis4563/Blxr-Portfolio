import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { Field, INPUT, TEXTAREA, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, Toggle, Modal, Segmented } from './components/settings-ui'
import { Note, Empty, CARD } from './components/boards/ui'
import { Spinner } from './components/skeleton'
import { navigate, dashboardPath, link, GALLERY_PATH } from './lib/router'
import { LIMITS, KINDS, formFrom, itemFrom, problemsOf, sortItems, filterItems, countsOf, formatDay, imageUrl, kindLabel } from './lib/gallery'
import { listItems, saveItem, deleteItem, uploadImage, removeImages, addFromFile, errorText } from './lib/gallery-api'

const FILTER_KEY = 'blxr:dashboard:gallery-filter'

const readFilter = () => {
  try {
    const v = localStorage.getItem(FILTER_KEY)
    return v === 'photo' || v === 'ui' ? v : 'all'
  } catch {
    return 'all'
  }
}

export default function DashboardGallery({ hash }) {
  const sub = decodeURIComponent(hash.replace(/^#/, '').split('/')[1] || '')
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await listItems())
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onSaved = useCallback((item) => {
    setItems((list) => sortItems([...(list || []).filter((i) => i.id !== item.id), item]))
  }, [])

  const onDeleted = useCallback((id) => {
    setItems((list) => (list || []).filter((i) => i.id !== id))
    navigate(dashboardPath('gallery'), { replace: true })
  }, [])

  if (error && !items) {
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
  if (!items) return <GridSkeleton />

  if (sub) {
    const item = items.find((i) => i.id === sub)
    if (!item) {
      return (
        <Empty
          icon="image"
          title="Nothing with that id"
          body="It may have been deleted."
          action={<a {...link(dashboardPath('gallery'))} className={BTN_SECONDARY}>Back to the gallery</a>}
        />
      )
    }
    return <ItemEditor key={sub} item={item} onSaved={onSaved} onDeleted={onDeleted} />
  }

  return <ItemGrid items={items} loading={loading} onReload={load} onAdded={onSaved} />
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="aspect-[4/3] rounded-xl bg-surface-hover" />
      ))}
    </div>
  )
}

function ItemGrid({ items, loading, onReload, onAdded }) {
  const [filter, setFilterState] = useState(readFilter)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const photoInput = useRef(null)
  const uiInput = useRef(null)

  const setFilter = (value) => {
    setFilterState(value)
    try { localStorage.setItem(FILTER_KEY, value) } catch {}
  }

  const counts = countsOf(items)
  const shown = filterItems(items, filter)
  const dropKind = filter === 'ui' ? 'ui' : 'photo'

  const addFiles = async (fileList, kind) => {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    setError(null)
    setUploading((n) => n + files.length)
    await Promise.all(
      files.map(async (file) => {
        try {
          onAdded(await addFromFile(file, kind))
        } catch (err) {
          setError(err)
        } finally {
          setUploading((n) => n - 1)
        }
      }),
    )
  }

  const picker = (ref, kind) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(e) => {
        addFiles(e.target.files, kind)
        e.target.value = ''
      }}
    />
  )

  return (
    <div
      className="flex flex-col gap-4"
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        addFiles(e.dataTransfer.files, dropKind)
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: `All ${counts.all}` }, ...KINDS.map((k) => ({ value: k.value, label: `${k.label} ${counts[k.value]}`, icon: k.icon }))]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <a href={GALLERY_PATH} target="_blank" rel="noreferrer" className={BTN_GHOST}>
            View page ↗
          </a>
          <button type="button" className={BTN_GHOST} onClick={onReload} disabled={loading} aria-label="Reload the gallery">
            <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" className={BTN_SECONDARY} onClick={() => uiInput.current?.click()}>
            <Icon name="monitor" className="h-3.5 w-3.5" /> Add UI
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => photoInput.current?.click()}>
            <Icon name="upload" className="h-3.5 w-3.5" /> Add photos
          </button>
          {picker(photoInput, 'photo')}
          {picker(uiInput, 'ui')}
        </div>
      </div>

      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}

      {shown.length === 0 && uploading === 0 ? (
        <button
          type="button"
          onClick={() => (dropKind === 'ui' ? uiInput : photoInput).current?.click()}
          className={`flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-[13px] transition-colors ${
            dragging ? 'border-line-strong bg-surface-hover/50 text-ink-strong' : 'border-line text-ink-subtle hover:border-line-strong hover:text-ink-strong'
          }`}
        >
          <Icon name={dropKind === 'ui' ? 'monitor' : 'image'} className="h-5 w-5" />
          {items.length === 0 ? 'The gallery is empty. Drop images here, or click to pick some.' : `No ${dropKind === 'ui' ? 'UI shots' : 'photos'} yet. Drop some here.`}
          <span className="text-[12px] text-ink-faint">Each image becomes its own item and goes live on /gallery right away.</span>
        </button>
      ) : (
        <ul className={`grid grid-cols-2 gap-3 rounded-xl transition-colors sm:grid-cols-3 lg:grid-cols-4 ${dragging ? 'bg-surface-hover/50 outline-2 outline-dashed outline-offset-4 outline-line-strong' : ''}`}>
          {Array.from({ length: uploading }, (_, i) => (
            <li key={`up-${i}`} className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line text-ink-subtle">
              <Spinner className="h-5 w-5" />
            </li>
          ))}
          {shown.map((item) => (
            <li key={item.id} className="group relative">
              <a
                {...link(dashboardPath(`gallery/${item.id}`))}
                className="block overflow-hidden rounded-xl border border-line bg-surface-raised outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/30"
              >
                <img src={imageUrl(item.image)} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              </a>
              <div className="pointer-events-none absolute left-2 top-2 flex gap-1">
                <span className="rounded bg-black/60 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-white">{kindLabel(item.kind)}</span>
                {!item.published && <span className="rounded bg-amber-500/90 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-black">Hidden</span>}
              </div>
              <p className="mt-1.5 truncate px-0.5 text-[12.5px] font-medium text-ink-strong">{item.title}</p>
              <p className="truncate px-0.5 font-mono text-[11px] tabular-nums text-ink-subtle">{formatDay(item.takenOn)}</p>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <p className="text-[12px] text-ink-faint">
          Drop images anywhere here to add them as {dropKind === 'ui' ? 'UI' : 'photos'}. Resized to WebP before upload.
        </p>
      )}
    </div>
  )
}

function ItemEditor({ item, onSaved, onDeleted }) {
  const [saved, setSaved] = useState(item)
  const initial = useMemo(() => formFrom(item), [item])
  const [form, setForm] = useState(initial)
  const [image, setImage] = useState({ image: item.image, width: item.width, height: item.height })
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const fresh = useRef(new Set())
  const fileInput = useRef(null)

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setJustSaved(false)
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(formFrom(saved)) || image.image !== saved.image
  const problems = problemsOf(form)
  const valid = Object.keys(problems).length === 0
  const shown = (key) => (showErrors ? problems[key] : null)

  useEffect(() => () => {
    if (fresh.current.size) removeImages([...fresh.current]).catch(() => {})
  }, [])

  useEffect(() => {
    if (!dirty) return undefined
    const onLeave = (e) => { e.preventDefault() }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  const replace = async (file) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const next = await uploadImage(saved.id, file)
      if (fresh.current.has(image.image)) {
        fresh.current.delete(image.image)
        removeImages([image.image]).catch(() => {})
      }
      fresh.current.add(next.image)
      setImage(next)
      setJustSaved(false)
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
    }
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
      const next = await saveItem(itemFrom({ ...saved, ...image }, form), { isNew: false })
      if (next.image !== saved.image) removeImages([saved.image]).catch(() => {})
      fresh.current.clear()
      setSaved(next)
      setForm(formFrom(next))
      setImage({ image: next.image, width: next.width, height: next.height })
      setShowErrors(false)
      setJustSaved(true)
      onSaved(next)
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
      await deleteItem(saved)
      if (fresh.current.size) await removeImages([...fresh.current]).catch(() => {})
      fresh.current.clear()
      setConfirmDelete(false)
      onDeleted(saved.id)
    } catch (err) {
      setError(err)
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-rise-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <a {...link(dashboardPath('gallery'))} className={BTN_GHOST} aria-label="Back to the gallery">
            <Icon name="arrowLeft" className="h-3.5 w-3.5" /> Gallery
          </a>
          <span className="truncate text-[13px] text-ink-muted">{form.title || 'Untitled'}</span>
          {dirty && !busy && <span className="text-[11.5px] text-ink-faint">· unsaved</span>}
          {justSaved && !dirty && <span className="text-[11.5px] text-emerald-500 animate-menu-in">· saved</span>}
        </div>
        <div className="flex items-center gap-2">
          {saved.published && (
            <a href={GALLERY_PATH} target="_blank" rel="noreferrer" className={BTN_GHOST}>
              View ↗
            </a>
          )}
          <button type="button" className={BTN_GHOST} onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Delete item">
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={save} disabled={busy || uploading || !dirty} title="⌘S">
            {busy ? 'Saving…' : uploading ? 'Uploading…' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section aria-label="Image" className={`${CARD} flex flex-col gap-3 p-3`}>
          <div className="relative grid min-h-48 place-items-center overflow-hidden rounded-lg bg-surface-raised">
            <img
              src={imageUrl(image.image)}
              alt={form.title}
              className="max-h-[60vh] w-full object-contain"
              style={{ aspectRatio: `${image.width} / ${image.height}` }}
            />
            {uploading && (
              <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                <Spinner className="h-6 w-6" />
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="font-mono text-[11.5px] tabular-nums text-ink-subtle">
              {image.width} × {image.height}
            </span>
            <button type="button" className={BTN_SECONDARY} onClick={() => fileInput.current?.click()} disabled={uploading || busy}>
              <Icon name="upload" className="h-3.5 w-3.5" /> Replace image
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                replace(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
        </section>

        <div className={`${CARD} flex flex-col gap-4 p-4`}>
          <Field label="Type">
            <Segmented label="Type" value={form.kind} onChange={set('kind')} options={KINDS.map((k) => ({ value: k.value, label: k.one, icon: k.icon }))} />
          </Field>

          <Field label="Title" htmlFor="gal-title" error={shown('title')} hint={`${form.title.length}/${LIMITS.title}`}>
            <input
              id="gal-title"
              className={`${INPUT} h-10 text-[15px] font-medium`}
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
              placeholder={form.kind === 'ui' ? 'Checkout flow, dark mode' : 'Sunset over Lycabettus'}
              maxLength={LIMITS.title}
              aria-invalid={Boolean(shown('title'))}
            />
          </Field>

          <Field label="Caption" htmlFor="gal-caption" error={shown('caption')} hint={`${form.caption.length}/${LIMITS.caption}`}>
            <textarea
              id="gal-caption"
              className={`${TEXTAREA} min-h-[96px]`}
              value={form.caption}
              onChange={(e) => set('caption')(e.target.value)}
              placeholder={form.kind === 'ui' ? 'What the screen does and what you were going for.' : 'Where, when, what caught your eye.'}
              maxLength={LIMITS.caption}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 *:min-w-0 [&_input]:min-w-0">
            <Field label="Date" htmlFor="gal-date" error={shown('takenOn')}>
              <input id="gal-date" type="date" className={INPUT} value={form.takenOn} onChange={(e) => set('takenOn')(e.target.value)} aria-invalid={Boolean(shown('takenOn'))} />
            </Field>
            <Field label="Tags" htmlFor="gal-tags" error={shown('tags')} hint="comma separated">
              <input id="gal-tags" className={INPUT} value={form.tags} onChange={(e) => set('tags')(e.target.value)} placeholder={form.kind === 'ui' ? 'dashboard, mobile' : 'athens, night'} aria-invalid={Boolean(shown('tags'))} />
            </Field>
          </div>

          <Field label="Link" htmlFor="gal-url" error={shown('url')} hint="optional">
            <input id="gal-url" type="url" className={`${INPUT} font-mono text-[12.5px]`} value={form.url} onChange={(e) => set('url')(e.target.value)} placeholder={form.kind === 'ui' ? 'https://figma.com/…' : 'https://…'} aria-invalid={Boolean(shown('url'))} />
          </Field>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-ink-strong">Show on /gallery</p>
              <p className="text-[12px] text-ink-muted">Hidden items are only visible to you.</p>
            </div>
            <Toggle checked={form.published} onChange={set('published')} label="Show on the gallery page" />
          </div>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        tone="danger"
        busy={busy}
        title="Delete this item?"
        description={`“${form.title || 'Untitled'}” and its image will be removed for good.`}
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
            <button type="button" className={BTN_DANGER} onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button>
          </>
        }
      />
    </div>
  )
}
