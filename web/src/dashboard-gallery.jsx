import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { Field, INPUT, TEXTAREA, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, Toggle, Modal, Segmented, Select } from './components/settings-ui'
import { Note, Empty, CARD } from './components/boards/ui'
import { Spinner } from './components/skeleton'
import { LiveStage } from './components/live-piece'
import { navigate, dashboardPath, link, GALLERY_PATH } from './lib/router'
import { LIMITS, KINDS, LIVE_TYPES, liveType, newLive, draftLive, formFrom, itemFrom, problemsOf, sortItems, countsOf, formatDay, imageUrl, isVideo, kindLabel, moveItem, mergeOrder, withPositions } from './lib/gallery'
import { listItems, saveItem, deleteItem, uploadImage, removeImages, addFromFile, isMediaFile, patchItem, reorderItems, errorText } from './lib/gallery-api'

const ACCEPT = 'image/*,video/mp4,video/webm,video/quicktime'

function PlayBadge() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white">
      <Icon name="play" className="h-3.5 w-3.5" />
    </span>
  )
}

const FILTER_KEY = 'blxr:dashboard:gallery-filter'

const today = () => {
  const now = new Date()
  return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

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

  if (sub === 'new') {
    const created = (item) => {
      onSaved(item)
      navigate(dashboardPath(`gallery/${item.id}`), { replace: true })
    }
    return <ItemEditor key="new" item={draftLive(today())} isNew onSaved={created} onDeleted={onDeleted} />
  }

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

  return <ItemGrid items={items} loading={loading} onReload={load} onAdded={onSaved} onReorder={setItems} />
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

const TOOL = 'grid h-7 w-7 cursor-pointer place-items-center rounded-md bg-black/60 text-white backdrop-blur-sm outline-none transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-default disabled:opacity-40'

function GridCard({ item, index, count, dragged, onDragStart, onDragOver, onDragEnd, onMove, onPatch }) {
  const ui = item.kind === 'ui'
  const type = item.live ? liveType(item.live.type)?.label : isVideo(item.image) ? 'Video' : kindLabel(item.kind)
  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragOver={(e) => onDragOver(e, item)}
      onDragEnd={onDragEnd}
      className={`group relative cursor-grab transition-opacity active:cursor-grabbing ${ui && item.wide ? 'col-span-2' : ''} ${dragged ? 'opacity-40' : ''}`}
    >
      <a
        {...link(dashboardPath(`gallery/${item.id}`))}
        draggable={false}
        className={`block overflow-hidden rounded-xl border bg-surface-raised outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${
          item.published ? 'border-line hover:border-line-strong' : 'border-dashed border-line-strong'
        }`}
      >
        <span className={`relative block overflow-hidden ${ui ? 'h-48' : 'aspect-[4/5]'} ${item.published ? '' : 'opacity-50'}`}>
          {item.live ? (
            <span className="pointer-events-none absolute left-0 top-0 flex h-[166.667%] w-[166.667%] origin-top-left scale-[0.6]" inert>
              <LiveStage live={item.live} title={item.title} className="flex-1" />
            </span>
          ) : (
            <img src={imageUrl(item.poster || item.image)} alt="" draggable={false} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          )}
          {isVideo(item.image) && <PlayBadge />}
        </span>
      </a>

      <div className="pointer-events-none absolute left-2 top-2 flex gap-1">
        <span className="rounded bg-black/60 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-white">{type}</span>
        {!item.published && <span className="rounded bg-amber-500/90 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-black">Hidden</span>}
      </div>

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <button type="button" className={TOOL} onClick={() => onMove(item, -1)} disabled={index === 0} aria-label={`Move ${item.title} earlier`} title="Move earlier">
          <Icon name="chevronLeft" className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={TOOL} onClick={() => onMove(item, 1)} disabled={index === count - 1} aria-label={`Move ${item.title} later`} title="Move later">
          <Icon name="chevronRight" className="h-3.5 w-3.5" />
        </button>
        {ui && (
          <button
            type="button"
            className={`${TOOL} w-auto! px-2 text-[10.5px] font-semibold ${item.wide ? 'bg-white! text-black! hover:bg-white/85!' : ''}`}
            onClick={() => onPatch(item, { wide: !item.wide })}
            aria-pressed={item.wide}
            aria-label={`Show ${item.title} wide`}
            title={item.wide ? 'Wide: takes two columns' : 'Normal: one column'}
          >
            2×
          </button>
        )}
        <button
          type="button"
          className={TOOL}
          onClick={() => onPatch(item, { published: !item.published })}
          aria-label={item.published ? `Hide ${item.title}` : `Show ${item.title}`}
          title={item.published ? 'Hide from /gallery' : 'Show on /gallery'}
        >
          <Icon name={item.published ? 'eye' : 'eyeOff'} className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2 px-0.5">
        <p className="truncate text-[12.5px] font-medium text-ink-strong">{item.title}</p>
        <p className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">{formatDay(item.takenOn)}</p>
      </div>
    </li>
  )
}

function ItemGrid({ items, loading, onReload, onAdded, onReorder }) {
  const [filter, setFilterState] = useState(readFilter)
  const [uploading, setUploading] = useState({ photo: 0, ui: 0 })
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [drag, setDrag] = useState(null)
  const [orderState, setOrderState] = useState(null)
  const photoInput = useRef(null)

  useEffect(() => {
    if (orderState !== 'saved') return undefined
    const t = setTimeout(() => setOrderState(null), 2000)
    return () => clearTimeout(t)
  }, [orderState])
  const uiInput = useRef(null)

  const setFilter = (value) => {
    setFilterState(value)
    try { localStorage.setItem(FILTER_KEY, value) } catch {}
  }

  const counts = countsOf(items)
  const dropKind = filter === 'ui' ? 'ui' : 'photo'
  const kindsShown = KINDS.filter((k) => filter === 'all' || filter === k.value)
  const sectionOf = (kind) => (drag?.kind === kind ? drag.list : items.filter((i) => i.kind === kind))
  const nothing = kindsShown.every((k) => counts[k.value] === 0 && uploading[k.value] === 0)

  const addFiles = async (fileList, kind) => {
    const files = [...(fileList || [])].filter(isMediaFile)
    if (!files.length) return
    setError(null)
    const bump = (by) => setUploading((u) => ({ ...u, [kind]: u[kind] + by }))
    bump(files.length)
    await Promise.all(
      files.map(async (file) => {
        try {
          onAdded(await addFromFile(file, kind))
        } catch (err) {
          setError(err)
        } finally {
          bump(-1)
        }
      }),
    )
  }

  const commit = async (section) => {
    const next = withPositions(mergeOrder(items, section))
    if (next.every((i, n) => i.id === items[n].id && i.position === items[n].position)) return
    const before = items
    onReorder(next)
    setOrderState('saving')
    try {
      await reorderItems(next.map((i) => i.id))
      setOrderState('saved')
    } catch (err) {
      onReorder(before)
      setError(err)
      setOrderState(null)
    }
  }

  const move = (item, by) => {
    const section = items.filter((i) => i.kind === item.kind)
    const at = section.findIndex((i) => i.id === item.id)
    const target = section[at + by]
    if (target) commit(moveItem(section, item.id, target.id))
  }

  const patch = async (item, change) => {
    onAdded({ ...item, ...change })
    try {
      onAdded(await patchItem(item.id, change))
    } catch (err) {
      onAdded(item)
      setError(err)
    }
  }

  const dragRef = useRef(null)
  const setDragBoth = (next) => {
    dragRef.current = next
    setDrag(next)
  }
  const dragStart = (e, item) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.title)
    setDragBoth({ id: item.id, kind: item.kind, list: items.filter((i) => i.kind === item.kind) })
  }
  const dragOver = (e, target) => {
    const d = dragRef.current
    if (!d || target.kind !== d.kind) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (target.id !== d.id) {
      const list = moveItem(d.list, d.id, target.id)
      if (list !== d.list) setDragBoth({ ...d, list })
    }
  }
  const dragEnd = (e) => {
    const d = dragRef.current
    setDragBoth(null)
    if (d && e.dataTransfer.dropEffect !== 'none') commit(d.list)
  }

  const picker = (ref, kind) => (
    <input
      ref={ref}
      type="file"
      accept={ACCEPT}
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
        <div className="flex items-center gap-3">
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[{ value: 'all', label: `All ${counts.all}` }, ...KINDS.map((k) => ({ value: k.value, label: `${k.label} ${counts[k.value]}`, icon: k.icon }))]}
          />
          {orderState === 'saving' && <span className="text-[11.5px] text-ink-faint">Saving order…</span>}
          {orderState === 'saved' && <span className="text-[11.5px] text-emerald-500 animate-menu-in">Order saved</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={GALLERY_PATH} target="_blank" rel="noreferrer" className={BTN_GHOST}>
            View page ↗
          </a>
          <button type="button" className={BTN_GHOST} onClick={onReload} disabled={loading} aria-label="Reload the gallery">
            <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a {...link(dashboardPath('gallery/new'))} className={BTN_SECONDARY}>
            <Icon name="zap" className="h-3.5 w-3.5" /> Add live UI
          </a>
          <button type="button" className={BTN_SECONDARY} onClick={() => uiInput.current?.click()}>
            <Icon name="monitor" className="h-3.5 w-3.5" /> Add UI shot
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => photoInput.current?.click()}>
            <Icon name="upload" className="h-3.5 w-3.5" /> Add photos
          </button>
          {picker(photoInput, 'photo')}
          {picker(uiInput, 'ui')}
        </div>
      </div>

      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}

      {nothing ? (
        <button
          type="button"
          onClick={() => (dropKind === 'ui' ? uiInput : photoInput).current?.click()}
          className={`flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-[13px] transition-colors ${
            dragging ? 'border-line-strong bg-surface-hover/50 text-ink-strong' : 'border-line text-ink-subtle hover:border-line-strong hover:text-ink-strong'
          }`}
        >
          <Icon name={dropKind === 'ui' ? 'monitor' : 'image'} className="h-5 w-5" />
          {items.length === 0 ? 'The gallery is empty. Drop images or videos here, or click to pick some.' : `No ${dropKind === 'ui' ? 'UI shots' : 'photos'} yet. Drop some here.`}
          <span className="text-[12px] text-ink-faint">Each file becomes its own item and goes live on /gallery right away.</span>
        </button>
      ) : (
        <div className={`flex flex-col gap-8 rounded-xl transition-colors ${dragging ? 'bg-surface-hover/50 outline-2 outline-dashed outline-offset-4 outline-line-strong' : ''}`}>
          {kindsShown.map((kind) => {
            const section = sectionOf(kind.value)
            const pending = uploading[kind.value]
            if (!section.length && !pending) return null
            const ui = kind.value === 'ui'
            return (
              <section key={kind.value} aria-label={kind.label}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h3 className="text-[13px] font-medium text-ink-strong">{ui ? 'Interfaces' : kind.label}</h3>
                  <span className="font-mono text-[11px] tabular-nums text-ink-faint">{section.length}</span>
                </div>
                <ul
                  onDragOver={(e) => { if (dragRef.current?.kind === kind.value) e.preventDefault() }}
                  className={`grid gap-3 ${ui ? 'grid-flow-row-dense grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}
                >
                  {Array.from({ length: pending }, (_, i) => (
                    <li key={`up-${i}`} className={`grid place-items-center rounded-xl border border-dashed border-line text-ink-subtle ${ui ? 'h-48' : 'aspect-[4/5]'}`}>
                      <Spinner className="h-5 w-5" />
                    </li>
                  ))}
                  {section.map((item, i) => (
                    <GridCard
                      key={item.id}
                      item={item}
                      index={i}
                      count={section.length}
                      dragged={drag?.id === item.id}
                      onDragStart={dragStart}
                      onDragOver={dragOver}
                      onDragEnd={dragEnd}
                      onMove={move}
                      onPatch={patch}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-[12px] text-ink-faint">
          Drag cards to change the order on /gallery, or use the arrows on each card. Drop images or videos anywhere here to add them as {dropKind === 'ui' ? 'UI' : 'photos'}; images are resized to WebP, videos (MP4, WebM, MOV, up to 50 MB) go up as they are.
        </p>
      )}
    </div>
  )
}

function LiveFields({ live, problems, onType, onProp }) {
  const def = liveType(live.type)
  return (
    <div className="flex flex-col gap-4 px-1 pb-1">
      <Field label="Component" htmlFor="gal-live-type" hint={def?.hint}>
        <Select id="gal-live-type" value={live.type} onChange={onType}>
          {LIVE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
      </Field>
      {(def?.fields || []).map((field) => {
        const id = `gal-live-${field.key}`
        const value = live.props[field.key] ?? ''
        const error = problems[`live.${field.key}`]
        const common = {
          id,
          value,
          onChange: (e) => onProp(field.key, e.target.value),
          placeholder: field.placeholder,
          maxLength: field.max,
          'aria-invalid': Boolean(error),
          spellCheck: field.code ? false : undefined,
        }
        return (
          <Field key={field.key} label={field.label} htmlFor={id} error={error} hint={field.max >= 100 ? `${value.length}/${field.max}` : field.required ? undefined : 'optional'}>
            {field.multiline ? (
              <textarea {...common} className={`${TEXTAREA} ${field.code ? 'min-h-[160px] font-mono text-[12px] leading-[1.55]' : 'min-h-[80px]'}`} />
            ) : (
              <input {...common} inputMode={field.number ? 'numeric' : undefined} className={INPUT} />
            )}
          </Field>
        )
      })}
    </div>
  )
}

function ItemEditor({ item, isNew = false, onSaved, onDeleted }) {
  const [saved, setSaved] = useState(item)
  const initial = useMemo(() => formFrom(item), [item])
  const [form, setForm] = useState(initial)
  const [image, setImage] = useState({ image: item.image, poster: item.poster, width: item.width, height: item.height })
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

  const dirty = isNew || JSON.stringify(form) !== JSON.stringify(formFrom(saved)) || image.image !== saved.image
  const problems = problemsOf(form)
  const valid = Object.keys(problems).length === 0
  const shown = (key) => (showErrors ? problems[key] : null)

  const setLiveType = (type) => {
    setForm((f) => ({
      ...f,
      live: newLive(type),
      title: !f.title.trim() || LIVE_TYPES.some((t) => t.label === f.title) ? liveType(type).label : f.title,
    }))
    setJustSaved(false)
  }
  const setLiveProp = (key, value) => {
    setForm((f) => ({ ...f, live: { ...f.live, props: { ...f.live.props, [key]: value } } }))
    setJustSaved(false)
  }

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
        const stale = [image.image, image.poster].filter(Boolean)
        stale.forEach((path) => fresh.current.delete(path))
        removeImages(stale).catch(() => {})
      }
      for (const path of [next.image, next.poster]) if (path) fresh.current.add(path)
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
      const next = await saveItem(itemFrom({ ...saved, ...image }, form), { isNew })
      if (isNew) {
        onSaved(next)
        return
      }
      if (next.image !== saved.image) removeImages([saved.image, saved.poster]).catch(() => {})
      fresh.current.clear()
      setSaved(next)
      setForm(formFrom(next))
      setImage({ image: next.image, poster: next.poster, width: next.width, height: next.height })
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
          {!isNew && saved.published && (
            <a href={GALLERY_PATH} target="_blank" rel="noreferrer" className={BTN_GHOST}>
              View ↗
            </a>
          )}
          {!isNew && (
            <button type="button" className={BTN_GHOST} onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Delete item">
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" className={BTN_PRIMARY} onClick={save} disabled={busy || uploading || !dirty} title="⌘S">
            {busy ? 'Saving…' : uploading ? 'Uploading…' : isNew ? 'Add to the gallery' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {form.live ? (
          <section aria-label="Component" className={`${CARD} flex flex-col gap-4 p-3`}>
            <div className="overflow-hidden rounded-lg border border-line">
              <LiveStage live={form.live} title={form.title} />
            </div>
            <LiveFields live={form.live} problems={showErrors ? problems : {}} onType={setLiveType} onProp={setLiveProp} />
          </section>
        ) : (
        <section aria-label="Image" className={`${CARD} flex flex-col gap-3 p-3`}>
          <div className="relative grid min-h-48 place-items-center overflow-hidden rounded-lg bg-surface-raised">
            {isVideo(image.image) ? (
              <video
                key={image.image}
                src={imageUrl(image.image)}
                poster={imageUrl(image.poster)}
                controls
                muted
                playsInline
                preload="metadata"
                aria-label={form.title}
                className="max-h-[60vh] w-full object-contain"
                style={{ aspectRatio: `${image.width} / ${image.height}` }}
              />
            ) : (
              <img
                src={imageUrl(image.image)}
                alt={form.title}
                className="max-h-[60vh] w-full object-contain"
                style={{ aspectRatio: `${image.width} / ${image.height}` }}
              />
            )}
            {uploading && (
              <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                <Spinner className="h-6 w-6" />
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="font-mono text-[11.5px] tabular-nums text-ink-subtle">
              {isVideo(image.image) ? 'Video · ' : ''}{image.width} × {image.height}
            </span>
            <button type="button" className={BTN_SECONDARY} onClick={() => fileInput.current?.click()} disabled={uploading || busy}>
              <Icon name="upload" className="h-3.5 w-3.5" /> Replace file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                replace(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
        </section>
        )}

        <div className={`${CARD} flex flex-col gap-4 p-4`}>
          {!form.live && (
            <Field label="Type">
              <Segmented label="Type" value={form.kind} onChange={set('kind')} options={KINDS.map((k) => ({ value: k.value, label: k.one, icon: k.icon }))} />
            </Field>
          )}

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

          {(form.live || form.kind === 'ui') && (
            <Field label="Width on the page" hint="wide takes two columns">
              <Segmented
                label="Width on the page"
                value={form.wide ? 'wide' : 'normal'}
                onChange={(v) => set('wide')(v === 'wide')}
                options={[{ value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Wide' }]}
              />
            </Field>
          )}

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
        description={`“${form.title || 'Untitled'}”${saved.live ? '' : ' and its image'} will be removed for good.`}
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
