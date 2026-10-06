import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import SiteFooter from './components/site-footer'
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

const FILTERS = [{ value: 'all', label: 'All', hash: '' }, ...KINDS.map((k) => ({ value: k.value, label: k.label, hash: k.value === 'photo' ? 'photos' : k.value }))]
const filterFromHash = (hash) => FILTERS.find((f) => f.hash && f.hash === hash.replace(/^#/, ''))?.value || 'all'

function Filters({ value, counts, onChange }) {
  return (
    <div role="tablist" aria-label="Filter the gallery" className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const on = f.value === value
        return (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(f.value)}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${
              on ? 'border-ink-strong bg-ink-strong text-ink-inverse' : 'border-line text-ink-secondary hover:border-line-strong hover:text-ink-strong'
            }`}
          >
            {f.label}
            <span className={`font-mono text-[11px] tabular-nums ${on ? 'opacity-70' : 'text-ink-faint'}`}>{counts[f.value] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}

function WindowBar() {
  return (
    <span aria-hidden="true" className="flex h-6 items-center gap-1.5 border-b border-line bg-surface-raised px-2.5">
      <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
      <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
      <span className="h-2 w-2 rounded-full bg-[#28c840]" />
    </span>
  )
}

function Tile({ item, index, onOpen }) {
  const ui = item.kind === 'ui'
  const video = isVideo(item.image)
  const clip = useRef(null)
  const preview = (on) => {
    const el = clip.current
    if (!el) return
    if (on) el.play().catch(() => {})
    else el.pause()
  }

  return (
    <li className="mb-4 break-inside-avoid animate-rise-in" style={{ animationDelay: `${200 + Math.min(index, 9) * 50}ms` }}>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        onPointerEnter={video ? () => preview(true) : undefined}
        onPointerLeave={video ? () => preview(false) : undefined}
        aria-label={`Open ${item.title}${video ? ' (video)' : ''}`}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-line bg-surface-raised text-left outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40"
      >
        {ui && <WindowBar />}
        <span className="relative block overflow-hidden">
          {video ? (
            <video
              ref={clip}
              src={imageUrl(item.image)}
              poster={imageUrl(item.poster)}
              width={item.width}
              height={item.height}
              muted
              loop
              playsInline
              preload="none"
              className={`block h-auto w-full transition-transform duration-700 ${EASE} group-hover:scale-[1.03]`}
              style={{ aspectRatio: `${item.width} / ${item.height}` }}
            />
          ) : (
            <img
              src={imageUrl(item.image)}
              alt={item.title}
              width={item.width}
              height={item.height}
              loading={index < 4 ? 'eager' : 'lazy'}
              decoding="async"
              className={`block h-auto w-full transition-transform duration-700 ${EASE} group-hover:scale-[1.03]`}
              style={{ aspectRatio: `${item.width} / ${item.height}` }}
            />
          )}
          {video && (
            <span aria-hidden="true" className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-0">
              <Icon name="play" className="h-3.5 w-3.5" />
            </span>
          )}
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3.5 pb-3 pt-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-white">{item.title}</span>
            <span className="block font-mono text-[10.5px] tabular-nums text-white/70">{formatDay(item.takenOn)}</span>
          </span>
          <span className="shrink-0 rounded-full border border-white/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85">{kindLabel(item.kind)}</span>
        </span>
        {!item.published && (
          <span className="absolute right-2 top-2 rounded bg-amber-500/90 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-black">Hidden</span>
        )}
      </button>
    </li>
  )
}

function LiveTile({ item, index }) {
  return (
    <li className="mb-4 break-inside-avoid animate-rise-in" style={{ animationDelay: `${200 + Math.min(index, 9) * 50}ms` }}>
      <figure className="relative overflow-hidden rounded-xl border border-line bg-surface-raised">
        <WindowBar />
        <LiveStage live={item.live} title={item.title} />
        <figcaption className="flex items-start justify-between gap-3 border-t border-line px-3.5 py-3">
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold text-ink-strong">{item.title}</span>
            {item.caption && <span className="mt-0.5 block whitespace-pre-line text-[12px] leading-snug text-ink-subtle">{item.caption}</span>}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-ink-muted hover:text-ink-strong">
                Open link <span aria-hidden="true">↗</span>
              </a>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#0d99ff]" />
            Live
          </span>
        </figcaption>
        {!item.published && (
          <span className="absolute right-2 top-1 rounded bg-amber-500/90 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-black">Hidden</span>
        )}
      </figure>
    </li>
  )
}

function Lightbox({ items, index, onClose, onStep }) {
  const item = items[index]
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onStep(1)
      else if (e.key === 'ArrowLeft') onStep(-1)
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, onStep])

  const many = items.length > 1
  const ARROW = 'grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-black/50 text-white outline-none transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/60'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title}, ${index + 1} of ${items.length}`}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/90 p-4 animate-overlay-in sm:p-8"
      onClick={onClose}
    >
      <figure key={item.id} className="flex max-h-full min-h-0 max-w-full flex-col items-center gap-4 animate-rise-in" onClick={(e) => e.stopPropagation()}>
        {isVideo(item.image) ? (
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
            className={`max-h-[74vh] min-h-0 w-auto max-w-full rounded-lg bg-black object-contain shadow-2xl ${item.kind === 'ui' ? 'ring-1 ring-white/15' : ''}`}
          />
        ) : (
          <img
            src={imageUrl(item.image)}
            alt={item.title}
            width={item.width}
            height={item.height}
            className={`max-h-[74vh] min-h-0 w-auto max-w-full rounded-lg object-contain shadow-2xl ${item.kind === 'ui' ? 'ring-1 ring-white/15' : ''}`}
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
      <button type="button" aria-label="Close" onClick={onClose} className={`${ARROW} absolute right-4 top-4`}>
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
            {index + 1} / {items.length}
          </p>
        </>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the gallery" className={`${GUTTER} columns-1 gap-4 pb-16 sm:columns-2 lg:columns-3`}>
      {[260, 180, 320, 220, 280, 200].map((h, i) => (
        <Bone key={i} className="mb-4 w-full rounded-xl" style={{ height: h }} />
      ))}
    </div>
  )
}

function Blank({ children, action }) {
  return (
    <div className={`${GUTTER} pb-20`}>
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
  const pictures = useMemo(() => shown.filter((i) => !i.live), [shown])
  const viewIndex = viewing ? pictures.findIndex((i) => i.id === viewing) : -1

  const open = useCallback((id) => setViewing(id), [])
  const close = useCallback(() => setViewing(null), [])
  const step = useCallback(
    (by) => setViewing((id) => {
      const at = pictures.findIndex((i) => i.id === id)
      return at < 0 ? null : pictures[(at + by + pictures.length) % pictures.length].id
    }),
    [pictures],
  )

  const addLink = owner && (
    <a
      {...link(dashboardPath('gallery'))}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink-strong"
    >
      <Icon name="plus" className="h-3.5 w-3.5" /> Add to the gallery
    </a>
  )

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[1120px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-x border-dashed border-line top-0 flex items-center px-6 sm:px-10">
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
        <section className={`${GUTTER} pt-16 pb-10 sm:pt-24 sm:pb-12`}>
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
          {state.status === 'ready' && state.items.length > 0 && (
            <div className="mt-8 animate-rise-in" style={{ animationDelay: '200ms' }}>
              <Filters value={filter} counts={counts} onChange={setFilter} />
            </div>
          )}
        </section>

        {state.status === 'loading' && <Skeleton />}
        {state.status === 'error' && <Blank>{errorText(state.error)}</Blank>}
        {state.status === 'ready' && state.items.length === 0 && <Blank action={addLink}>Nothing on the wall yet. The first pieces are on their way.</Blank>}
        {state.status === 'ready' && state.items.length > 0 && shown.length === 0 && (
          <Blank>Nothing in this section yet.</Blank>
        )}
        {state.status === 'ready' && shown.length > 0 && (
          <ul key={filter} className={`${GUTTER} columns-1 gap-4 pb-16 sm:columns-2 lg:columns-3`}>
            {shown.map((item, i) =>
              item.live ? <LiveTile key={item.id} item={item} index={i} /> : <Tile key={item.id} item={item} index={i} onOpen={open} />,
            )}
          </ul>
        )}

        <SiteFooter gutter={GUTTER} className="mt-auto" />
      </main>

      {viewIndex >= 0 && <Lightbox items={pictures} index={viewIndex} onClose={close} onStep={step} />}
    </div>
  )
}
