import { useEffect, useRef, useState } from 'react'
import { Inspect, CommentPin } from './figma'
import LiveSelect from './live-select'
import ScrambleText from './scramble-text'
import { AvatarStack, CometCard, ContourField, FreshFindsHero, GlowButton, LogoWall, Marquee, MusicPill, RangeCalendar } from './gallery-live'
import { Icon } from './icon'
import { imageProps, SIZES } from '../lib/images'

const readTheme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

function useTheme() {
  const [theme, setTheme] = useState(() => (typeof document === 'undefined' ? 'dark' : readTheme()))
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

function SelectPiece({ lead, text, tail, name }) {
  const [run, setRun] = useState(0)
  return (
    <>
      <p key={run} className="text-center text-[19px] leading-[1.5] text-ink-muted">
        {lead && `${lead} `}
        <LiveSelect name={name}>{text}</LiveSelect>
        {tail}
      </p>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1 rounded-full border border-line bg-bg px-2.5 py-1 text-[11px] font-medium text-ink-muted outline-none transition-colors hover:border-line-strong hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30"
      >
        <Icon name="refresh" className="h-3 w-3" /> Replay
      </button>
    </>
  )
}

function InspectPiece({ text }) {
  const ref = useRef(null)
  const [size, setSize] = useState(text ? '' : '64 × 64')

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => setSize(`${Math.round(el.offsetWidth)} × ${Math.round(el.offsetHeight)}`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  return (
    <Inspect size={size}>
      {text ? (
        <span ref={ref} className="inline-flex h-10 items-center rounded-[10px] bg-surface-inverted px-4 text-[13px] font-medium text-ink-on-inverted">
          {text}
        </span>
      ) : (
        <img
          ref={ref}
          {...imageProps('/pfp.webp', SIZES.avatar)}
          alt="Blxr avatar"
          width="64"
          height="64"
          draggable="false"
          className="block h-16 w-16 rounded-[18px] object-cover select-none"
        />
      )}
    </Inspect>
  )
}

function HtmlPiece({ html, css, height, title }) {
  const theme = useTheme()
  const h = Math.min(800, Math.max(80, Number(height) || 220))
  const ink = theme === 'light' ? '#18181b' : '#f4f4f5'
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{color-scheme:${theme}}html,body{margin:0;height:100%;background:transparent}
body{display:grid;place-items:center;font:14px/1.5 system-ui,sans-serif;color:${ink}}
${String(css || '').replace(/<\/style/gi, '<\\/style')}
</style></head><body>${html || ''}</body></html>`

  return <iframe title={title || 'UI snippet'} sandbox="" srcDoc={doc} loading="lazy" className="block w-full border-0 bg-transparent" style={{ height: h }} />
}

export default function LivePiece({ live, title }) {
  if (!live) return null
  const p = live.props || {}
  switch (live.type) {
    case 'select':
      return <SelectPiece {...p} />
    case 'inspect':
      return <InspectPiece text={p.text} />
    case 'comment':
      return (
        <span className="self-end justify-self-start pb-2">
          <CommentPin name={p.name} initial={(p.name || '?').trim().charAt(0).toUpperCase()} text={p.text} time={p.time} />
        </span>
      )
    case 'scramble':
      return (
        <span className="font-bagus text-[40px] leading-none text-ink-strong">
          <ScrambleText key={`${p.text}|${p.alt}`} text={p.text} alt={p.alt} />
        </span>
      )
    case 'html':
      return <HtmlPiece {...p} title={title} />
    case 'comet':
      return <CometCard title={p.title} sub={p.sub} />
    case 'contour':
      return <ContourField />
    case 'loop':
      return <FreshFindsHero lead={p.lead} words={p.words} />
    case 'glow':
      return <GlowButton text={p.text} />
    case 'music':
      return <MusicPill label={p.label} />
    case 'marquee':
      return <Marquee items={p.items} />
    case 'calendar':
      return <RangeCalendar />
    case 'logos':
      return <LogoWall lead={p.lead} bold={p.bold} tail={p.tail} names={p.names} />
    case 'avatars':
      return <AvatarStack more={p.more} />
    default:
      return null
  }
}

export function LiveStage({ live, title, className = '' }) {
  const bare = live?.type === 'html'
  return (
    <div
      className={`relative grid place-items-center bg-bg bg-[radial-gradient(var(--color-line)_1px,transparent_1px)] [background-size:14px_14px] ${
        bare ? '' : 'min-h-[200px] px-6 py-10'
      } ${className}`}
    >
      <LivePiece live={live} title={title} />
    </div>
  )
}
