import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import SiteFooter from './components/site-footer'
import BottomBlur from './components/bottom-blur'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { Bone } from './components/skeleton'
import { LiveStage } from './components/live-piece'
import { link, HOME_PATH, dashboardPath } from './lib/router'
import { useAuth } from './lib/supabase'
import { isSiteOwner } from './lib/dashboard'
import { GALLERY_INTRO, KINDS, countsOf, filterItems, formatDay, imageUrl, isVideo, kindLabel } from './lib/gallery'
import { listItems, errorText } from './lib/gallery-api'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const GUTTER = 'px-6 sm:px-10'
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]'
const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/30'

const FILTERS = [{ value: 'all', label: 'All', hash: '' }, ...KINDS.map((k) => ({ value: k.value, label: k.label, hash: k.value === 'photo' ? 'photos' : k.value }))]
const filterFromHash = (hash) => FILTERS.find((f) => f.hash && f.hash === hash.replace(/^#/, ''))?.value || 'all'

const SECTIONS = [
  { kind: 'photo', title: 'Photos' },
  { kind: 'ui', title: 'Interfaces' },
]

const OWNS_ARROWS = 'input, textarea, select, [contenteditable], [role=grid], [role=slider]'

const pad = (n) => String(n).padStart(2, '0')
const rise = (index) => ({ animationDelay: `${120 + Math.min(index, 9) * 50}ms` })

function Filters({ value, counts, onChange }) {
  return (
    <div role="tablist" aria-label="Filter the gallery" className="flex items-center gap-6">
      {FILTERS.map((f) => {
        const on = f.value === value
        return (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(f.value)}
            className={`inline-flex cursor-pointer items-baseline gap-1.5 rounded text-[13px] font-medium transition-colors ${RING} ${
              on ? 'text-ink-strong' : 'text-ink-faint hover:text-ink-muted'
            }`}
          >
            {f.label}
            <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">{counts[f.value] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}

function SectionHead({ section, count }) {
  return (
    <div className={`${GUTTER} flex items-baseline gap-2 pb-5 pt-12 animate-rise-in`}>
      <h2 className="text-[13px] font-medium text-ink-strong">{section.title}</h2>
      <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">{count}</span>
    </div>
  )
}

function Media({ item, eager, fill = false }) {
  const style = fill ? undefined : { aspectRatio: `${item.width} / ${item.height}` }
  const size = `block w-full transition-transform duration-700 ${EASE} group-hover:scale-[1.03] ${fill ? 'absolute inset-0 h-full object-cover object-top' : 'h-auto'}`
  return isVideo(item.image) ? (
    <video
      src={imageUrl(item.image)}
      poster={imageUrl(item.poster)}
      width={item.width}
      height={item.height}
      muted
      loop
      playsInline
      preload="none"
      className={size}
      style={style}
    />
  ) : (
    <img
      src={imageUrl(item.image)}
      alt={item.title}
      width={item.width}
      height={item.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={size}
      style={style}
    />
  )
}

const previewOn = (on) => (e) => {
  const clip = e.currentTarget.querySelector('video')
  if (!clip) return
  if (on) clip.play().catch(() => {})
  else clip.pause()
}

function HiddenBadge({ className = '' }) {
  return <span className={`absolute rounded bg-amber-500/90 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-black ${className}`}>Hidden</span>
}

function PhotoTile({ item, index, onOpen }) {
  const video = isVideo(item.image)
  return (
    <li className="mb-4 break-inside-avoid animate-rise-in" style={rise(index)}>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        onPointerEnter={previewOn(true)}
        onPointerLeave={previewOn(false)}
        aria-label={`Open ${item.title}${video ? ' (video)' : ''}`}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-line bg-surface-raised text-left outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40"
      >
        <Media item={item} eager={index < 4} />
        {video && (
          <span aria-hidden="true" className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-0">
            <Icon name="play" className="h-3.5 w-3.5" />
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3.5 pb-3 pt-12 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="block truncate text-[13.5px] font-semibold text-white">{item.title}</span>
          <span className="block font-mono text-[10.5px] tabular-nums text-white/70">{formatDay(item.takenOn)}</span>
        </span>
        {!item.published && <HiddenBadge className="left-2 top-2" />}
      </button>
    </li>
  )
}

function InterfaceTile({ item, index, onOpen }) {
  return (
    <li className={`flex animate-rise-in ${item.wide ? 'sm:col-span-2' : ''}`} style={rise(index)}>
      <figure className="group/tile flex w-full flex-col">
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-line transition-colors duration-300 group-hover/tile:border-line-strong">
          {item.live ? (
            <LiveStage live={item.live} title={item.title} className="flex-1" />
          ) : (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => onOpen(item.id)}
              onPointerEnter={previewOn(true)}
              onPointerLeave={previewOn(false)}
              className="group relative block min-h-[240px] flex-1 cursor-zoom-in overflow-hidden bg-bg"
            >
              <Media item={item} fill />
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            aria-label={`Open ${item.title} up close`}
            title="Open up close"
            className={`absolute bottom-2.5 right-2.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-line bg-bg/80 text-ink-subtle opacity-0 backdrop-blur-sm transition-[opacity,color] duration-200 hover:text-ink-strong focus-visible:opacity-100 group-hover/tile:opacity-100 [@media(hover:none)]:opacity-100 ${RING}`}
          >
            <Icon name="maximize" className="h-3.5 w-3.5" />
          </button>
          {!item.published && <HiddenBadge className="left-2.5 top-2.5" />}
        </div>
        <figcaption className="mt-2.5 flex items-baseline justify-between gap-3 px-0.5">
          <span className="truncate text-[13px] font-medium text-ink-strong">{item.title}</span>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[12px] text-ink-faint transition-colors hover:text-ink-strong">
              Link <span aria-hidden="true">↗</span>
            </a>
          )}
        </figcaption>
      </figure>
    </li>
  )
}

function Lightbox({ items, index, onClose, onStep }) {
  const item = items[index]
  const closeRef = useRef(null)

  useEffect(() => {
    const back = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose()
      if (e.defaultPrevented || e.target.closest?.(OWNS_ARROWS)) return
      if (e.key === 'ArrowRight') onStep(1)
      else if (e.key === 'ArrowLeft') onStep(-1)
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      back?.focus?.()
    }
  }, [onClose, onStep])

  const many = items.length > 1
  const ARROW = 'grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white/10 text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60'
  const framed = item.kind === 'ui' ? 'ring-1 ring-white/15' : ''

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title}, ${index + 1} of ${items.length}`}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/90 p-4 backdrop-blur-sm animate-overlay-in sm:p-8"
      onClick={onClose}
    >
      <figure key={item.id} className="flex max-h-full min-h-0 max-w-full flex-col items-center gap-4 animate-rise-in" onClick={(e) => e.stopPropagation()}>
        {item.live ? (
          <div className="flex min-h-[min(60vh,560px)] w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15">
            <LiveStage live={item.live} title={item.title} className="flex-1" />
          </div>
        ) : isVideo(item.image) ? (
          <video
            src={imageUrl(item.image)}
            poster={imageUrl(item.poster)}
            width={item.width}
            height={item.height}
            controls
            autoPlay
            loop
            playsInline
            aria-label={item.title}
            className={`max-h-[74vh] min-h-0 w-auto max-w-full rounded-lg bg-black object-contain shadow-2xl ${framed}`}
          />
        ) : (
          <img
            src={imageUrl(item.image)}
            alt={item.title}
            width={item.width}
            height={item.height}
            className={`max-h-[74vh] min-h-0 w-auto max-w-full rounded-lg object-contain shadow-2xl ${framed}`}
          />
        )}
        <figcaption className="w-full max-w-[640px] text-center">
          <p className="text-[15px] font-semibold text-white">{item.title}</p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-white/55">
            {kindLabel(item.kind)} · {formatDay(item.takenOn)}
          </p>
          {item.caption && <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-white/75">{item.caption}</p>}
          {(item.tags.length > 0 || item.url) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/65">{tag}</span>
              ))}
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-white/80 hover:text-white">
                  Open link <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          )}
        </figcaption>
      </figure>
      <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} className={`${ARROW} absolute right-4 top-4`}>
        <Icon name="x" className="h-4 w-4" />
      </button>
      {many && (
        <>
          <button type="button" aria-label="Previous" onClick={(e) => { e.stopPropagation(); onStep(-1) }} className={`${ARROW} absolute left-3 top-1/2 -translate-y-1/2 sm:left-5`}>
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next" onClick={(e) => { e.stopPropagation(); onStep(1) }} className={`${ARROW} absolute right-3 top-1/2 -translate-y-1/2 sm:right-5`}>
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
          <p className="absolute left-4 top-6 font-mono text-[11px] tabular-nums text-white/60">
            {pad(index + 1)} / {pad(items.length)}
          </p>
        </>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the gallery" className={`${GUTTER} pb-16 pt-12`}>
      <Bone className="h-3 w-24 rounded" />
      <Bone className="mt-4 h-6 w-40 rounded" />
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className={`aspect-[3/4] w-full rounded-xl ${i > 1 ? 'hidden md:block' : ''} ${i > 2 ? 'md:hidden lg:block' : ''}`} />
        ))}
      </div>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Bone key={i} className={`h-[300px] w-full rounded-xl ${i === 0 ? 'sm:col-span-2' : ''}`} />
        ))}
      </div>
    </div>
  )
}

function Blank({ children, action }) {
  return (
    <div className={`${GUTTER} pb-20 pt-12`}>
      <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center animate-rise-in">
        <Icon name="image" className="mx-auto h-5 w-5 text-ink-faint" />
        <p className="mx-auto mt-3 max-w-[40ch] text-[13.5px] leading-relaxed text-ink-muted">{children}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

export default function GalleryPage({ theme, onToggleTheme }) {
  const { session } = useAuth()
  const owner = isSiteOwner(session?.user)
  const [state, setState] = useState({ status: 'loading', items: [], error: null })
  const [filter, setFilterState] = useState('all')
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    let cancelled = false
    setFilterState(filterFromHash(window.location.hash))
    listItems()
      .then((items) => { if (!cancelled) setState({ status: 'ready', items, error: null }) })
      .catch((error) => { if (!cancelled) setState({ status: 'error', items: [], error }) })
    return () => { cancelled = true }
  }, [])

  const setFilter = (value) => {
    setFilterState(value)
    const hash = FILTERS.find((f) => f.value === value)?.hash
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`)
  }

  const counts = useMemo(() => countsOf(state.items), [state.items])
  const shown = useMemo(() => filterItems(state.items, filter), [state.items, filter])
  const groups = useMemo(
    () => SECTIONS.map((section) => ({ section, items: shown.filter((i) => i.kind === section.kind) })).filter((g) => g.items.length > 0),
    [shown],
  )
  const ordered = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const viewIndex = viewing ? ordered.findIndex((i) => i.id === viewing) : -1

  const open = useCallback((id) => setViewing(id), [])
  const close = useCallback(() => setViewing(null), [])
  const step = useCallback(
    (by) => setViewing((id) => {
      const at = ordered.findIndex((i) => i.id === id)
      return at < 0 ? null : ordered[(at + by + ordered.length) % ordered.length].id
    }),
    [ordered],
  )

  const ready = state.status === 'ready'
  const any = ready && state.items.length > 0

  const addLink = owner && (
    <a
      {...link(dashboardPath('gallery'))}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink-strong"
    >
      <Icon name="plus" className="h-3.5 w-3.5" /> Add to the gallery
    </a>
  )

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-clip antialiased font-sans animate-view-in">
      <header className="w-full max-w-[1120px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 frame-bleed-b border-b border-x border-dashed border-line top-0 flex items-center px-6 sm:px-10">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            <span>Back to Home</span>
          </a>
          <div className="flex items-center gap-4">
            <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors duration-200" />
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="text-ink-muted hover:text-ink-strong transition-colors duration-200"
            />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1120px] mx-auto flex flex-col min-h-screen pt-14 border-x border-dashed border-line bg-bg">
        <section className={`${GUTTER} pt-16 pb-12 sm:pt-24 sm:pb-14`}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 animate-rise-in">
            <p className={KICKER}>/ gallery</p>
            {addLink}
          </div>
          <h1 className="mt-8 font-vergilia text-[34px] leading-[1.1] text-ink-strong sm:text-[48px] animate-fade-in-up" style={{ animationDelay: '60ms' }}>
            Gallery
          </h1>
          <p className="mt-6 max-w-[48ch] text-[15px] leading-[1.6] text-ink-muted animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            {GALLERY_INTRO}
          </p>
        </section>

        {any && (
          <div className="sticky top-14 z-30 border-b border-dashed border-line bg-bg/85 backdrop-blur-md">
            <div className={`${GUTTER} py-3.5`}>
              <Filters value={filter} counts={counts} onChange={setFilter} />
            </div>
          </div>
        )}

        {state.status === 'loading' && <Skeleton />}
        {state.status === 'error' && <Blank>{errorText(state.error)}</Blank>}
        {ready && state.items.length === 0 && <Blank action={addLink}>Nothing on the wall yet. The first pieces are on their way.</Blank>}
        {any && shown.length === 0 && <Blank>Nothing in this section yet.</Blank>}
        {any && shown.length > 0 && (
          <div key={filter} className="pb-16">
            {groups.map(({ section, items }) => (
              <section key={section.kind} aria-label={section.title}>
                <SectionHead section={section} count={items.length} />
                {section.kind === 'photo' ? (
                  <ul className={`${GUTTER} columns-2 gap-4 md:columns-3 lg:columns-4`}>
                    {items.map((item, i) => (
                      <PhotoTile key={item.id} item={item} index={i} onOpen={open} />
                    ))}
                  </ul>
                ) : (
                  <ul className={`${GUTTER} grid grid-flow-row-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
                    {items.map((item, i) => (
                      <InterfaceTile key={item.id} item={item} index={i} onOpen={open} />
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}

        <SiteFooter gutter={GUTTER} stripe className="mt-auto" />
      </main>

      <BottomBlur />

      {viewIndex >= 0 && <Lightbox items={ordered} index={viewIndex} onClose={close} onStep={step} />}
    </div>
  )
}
