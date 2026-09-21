import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { fetchReviews } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { link, REVIEWS_PATH } from '../lib/router'
import { Stars } from './star-rating'
import { imageUrl } from '../lib/images'
import { summarize, relativeTime } from '../lib/reviews'
import { GITHUB_USERNAME } from '../lib/profile'

const DWELL_MS = 7000

let gsapPromise = null
const loadGsap = () => (gsapPromise ??= import('gsap').then((m) => m.default ?? m.gsap))

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function pick(list) {
  const byPin = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
  const byDate = (a, b) => Date.parse(b.at) - Date.parse(a.at)
  return [...list].sort((a, b) => byPin(a, b) || b.rating - a.rating || byDate(a, b))
}

function splitLead(text) {
  const clean = text.replace(/\s+/g, ' ').trim()
  const m = clean.match(/^(.{12,120}?[.!?])(\s|$)/)
  if (!m) return [clean, '']
  return [m[1], clean.slice(m[1].length).trim()]
}

const Words = ({ text, className }) =>
  text.split(' ').map((w, i) => (
    <span key={i} data-w className={`inline-block ${className}`}>
      {w}{'\u00a0'}
    </span>
  ))

const PFP = imageUrl('/pfp.webp', 416)

function Portrait({ active, pulseKey }) {
  const canvasRef = useRef(null)
  const fxRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!active || reduceMotion() || navigator.connection?.saveData) return
    let cancelled = false
    let unbind = () => {}

    import('../lib/quote-portrait').then(({ createPortrait }) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      const fx = createPortrait(canvas, PFP, () => { if (!cancelled) setReady(true) })
      if (!fx) return
      fxRef.current = fx
      fx.start()

      const onMove = (e) => {
        const r = canvas.getBoundingClientRect()
        fx.setPointer((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
      }
      const onLeave = () => fx.setPointer(null)
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
      window.addEventListener('resize', fx.resize)
      unbind = () => {
        canvas.removeEventListener('pointermove', onMove)
        canvas.removeEventListener('pointerleave', onLeave)
        window.removeEventListener('resize', fx.resize)
      }
    })

    return () => {
      cancelled = true
      unbind()
      fxRef.current?.dispose()
      fxRef.current = null
      setReady(false)
    }
  }, [active])

  useEffect(() => {
    if (pulseKey) fxRef.current?.pulse()
  }, [pulseKey])

  return (
    <div className="quote-photo relative h-[200px] w-full overflow-hidden bg-surface sm:h-auto sm:w-[208px]">
      <img
        src={PFP}
        alt=""
        width="520"
        height="520"
        draggable="false"
        className="absolute inset-0 h-full w-full select-none object-cover [filter:grayscale(0.85)]"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute inset-0 block h-full w-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/60 to-transparent px-3 pb-2.5 pt-8 font-mono text-[10px] tracking-[0.14em] text-white/70"
      >
        @{GITHUB_USERNAME}
      </span>
    </div>
  )
}

const TICKS = [
  'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
  'right-0 top-0 translate-x-1/2 -translate-y-1/2',
  'left-0 bottom-0 -translate-x-1/2 translate-y-1/2',
  'right-0 bottom-0 translate-x-1/2 translate-y-1/2',
]

const CHEVRON =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-subtle outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:bg-surface-hover focus-visible:text-ink-strong'

export default function Testimonials() {
  const { t, lang } = useI18n()
  const [items, setItems] = useState(null)
  const [stats, setStats] = useState(null)
  const [index, setIndex] = useState(0)
  const [seen, setSeen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [lit, setLit] = useState(false)
  const [paused, setPaused] = useState(false)
  const [pulseKey, setPulseKey] = useState(0)
  const sectionRef = useRef(null)
  const bodyRef = useRef(null)
  const busyRef = useRef(false)
  const swipeRef = useRef(null)
  const progressRef = useRef(null)

  useEffect(() => {
    const ctl = new AbortController()
    fetchReviews({ signal: ctl.signal })
      .then((list) => { setItems(pick(list)); setStats(summarize(list)) })
      .catch(() => setItems([]))
    return () => ctl.abort()
  }, [])

  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const near = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); near.disconnect() }
    }, { rootMargin: '400px 0px' })
    const shown = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting)
      if (e.isIntersecting) setLit(true)
    }, { threshold: 0.35 })
    near.observe(el)
    shown.observe(el)
    return () => { near.disconnect(); shown.disconnect() }
  }, [items])

  const go = useCallback((next) => {
    if (!items?.length || busyRef.current) return
    const count = items.length
    const to = ((next % count) + count) % count
    if (to === index) return
    setPulseKey((k) => k + 1)
    const body = bodyRef.current
    if (reduceMotion() || !body) { setIndex(to); return }
    busyRef.current = true
    loadGsap().then((gsap) => {
      if (progressRef.current) gsap.to(progressRef.current, { xPercent: -100, duration: 0.35, ease: 'power2.in', overwrite: true })
      gsap.to(body, {
        opacity: 0, y: -6, duration: 0.22, ease: 'power2.in', overwrite: true,
        onComplete: () => { setIndex(to); busyRef.current = false },
      })
    })
  }, [items, index])

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body || !items?.length || reduceMotion()) return
    let dead = false
    loadGsap().then((gsap) => {
      if (dead) return
      gsap.set(body, { opacity: 1, y: 0 })
      gsap.fromTo(
        body.querySelectorAll('[data-w]'),
        { opacity: 0, y: 8, filter: 'blur(5px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.55, stagger: 0.016, ease: 'power3.out', overwrite: true },
      )
      gsap.fromTo(
        body.querySelector('[data-who]'),
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.3, ease: 'power3.out', overwrite: true },
      )
    })
    return () => { dead = true }
  }, [index, items])

  useEffect(() => {
    if (!visible || paused || !items || items.length < 2) return
    const id = setTimeout(() => go(index + 1), DWELL_MS)
    return () => clearTimeout(id)
  }, [visible, paused, items, index, go])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
  }
  const onPointerDown = (e) => { if (e.pointerType !== 'mouse') swipeRef.current = e.clientX }
  const onPointerUp = (e) => {
    const from = swipeRef.current
    swipeRef.current = null
    if (from == null) return
    const dx = e.clientX - from
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
  }

  if (!items?.length) return null

  const item = items[index]
  const [lead, rest] = splitLead(item.text)
  const many = items.length > 1

  return (
    <section
      ref={sectionRef}
      id="reviews"
      data-in={lit || undefined}
      className="scroll-mt-8 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 pt-12 text-left"
    >
      <div className="flex items-end justify-between gap-6 px-6">
        <div>
          <h2 className="text-[20px] text-ink-strong tracking-tight font-bagus">{t('home.reviews')}</h2>
          <p className="mt-1.5 text-[12.5px] text-ink-subtle">{t('home.reviewsTagline')}</p>
          {stats?.count > 0 && (
            <p className="mt-3 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle">
              <Stars value={stats.average} size={10} />
              <span className="text-ink-secondary">{stats.average.toFixed(1)}</span>
              <span className="text-ink-faint">·</span>
              <span>{t(stats.count === 1 ? 'rev.count.one' : 'rev.count', { n: stats.count })}</span>
            </p>
          )}
        </div>
        <a
          {...link(REVIEWS_PATH)}
          className="group/all inline-flex shrink-0 items-center gap-1 text-[12.5px] text-ink-muted transition-colors hover:text-ink-strong"
        >
          {t('rev.seeAll')}
          <span aria-hidden="true" className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/all:translate-x-0.5">→</span>
        </a>
      </div>

      <figure
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false) }}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        data-paused={paused || !visible || undefined}
        className="relative mt-10 mb-6"
      >
        <span aria-hidden="true" className="quote-rule quote-rule-x top-0" />
        <span aria-hidden="true" className="quote-rule quote-rule-x bottom-0" />

        <div className="relative mx-6">
          <span aria-hidden="true" className="quote-rule quote-rule-y left-0" />
          <span aria-hidden="true" className="quote-rule quote-rule-y right-0" />
          {TICKS.map((at) => (
            <svg key={at} aria-hidden="true" viewBox="0 0 11 11" className={`quote-tick absolute z-10 h-[11px] w-[11px] text-ink-subtle ${at}`}>
              <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
            </svg>
          ))}
          {many && (
            <span key={index} ref={progressRef} aria-hidden="true" className="quote-progress z-10" style={{ '--dwell': `${DWELL_MS}ms` }} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[208px_minmax(0,1fr)]">
            <Portrait active={seen} pulseKey={pulseKey} />

            <div ref={bodyRef} className="relative flex min-w-0 flex-col justify-between gap-5 px-6 py-6 sm:min-h-[208px] sm:gap-6 sm:px-8 sm:py-7">
              <span aria-hidden="true" className="pointer-events-none absolute right-7 top-4 select-none font-vergilia text-[56px] leading-none text-ink-faint/25">”</span>
              <blockquote className="line-clamp-[9] text-[14.5px] leading-[1.65] sm:line-clamp-6 sm:text-[15.5px]">
                <span aria-hidden="true" className="text-ink-faint">“</span>
                <Words text={lead} className="font-medium text-ink-strong" />
                {rest && <Words text={rest} className="text-ink-muted" />}
                <span aria-hidden="true" className="-ml-1 text-ink-faint">”</span>
              </blockquote>

              <figcaption className="flex min-w-0 items-end justify-between gap-4">
                <div data-who className="min-w-0">
                  <p className="truncate text-[13px] font-semibold tracking-tight text-ink-strong">{item.name}</p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <Stars value={item.rating} size={10} />
                    {item.role && <p className="truncate text-[11.5px] text-ink-subtle">{item.role}</p>}
                    <time dateTime={item.at} className="shrink-0 font-mono text-[10px] tracking-wide text-ink-faint">{relativeTime(item.at, lang)}</time>
                  </div>
                </div>

                {many && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => go(index - 1)} aria-label={t('rev.prev')} className={CHEVRON}>
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3.5 5.5 8 10 12.5" /></svg>
                    </button>
                    <span className="min-w-[44px] text-center font-mono text-[10.5px] tabular-nums tracking-[0.14em] text-ink-subtle" aria-live="polite">
                      {String(index + 1).padStart(2, '0')}<span className="mx-1 text-ink-faint">/</span>{String(items.length).padStart(2, '0')}
                    </span>
                    <button type="button" onClick={() => go(index + 1)} aria-label={t('rev.next')} className={CHEVRON}>
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
                    </button>
                  </div>
                )}
              </figcaption>
            </div>
          </div>
        </div>
      </figure>
    </section>
  )
}
