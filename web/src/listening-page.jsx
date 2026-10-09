import { useCallback, useEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, HOME_PATH, USES_PATH, CONTACT_PATH } from './lib/router'
import { relativeTime, absoluteTime } from './lib/reviews'
import {
  fetchSpotifyNow,
  fetchSpotifyRecent,
  fetchSpotifyTop,
  LISTENING_INTRO,
  LISTENING_RANGES,
  NOW_POLL_MS,
  RECENT_POLL_MS,
  TOP_TRACKS,
  formatDuration,
  sampleNow,
  progressAt,
  trackEnded,
  nowStatus,
  clockTime,
  groupByDay,
  listeningStats,
  onRepeat,
  playsOn,
  coverColor,
  fallbackColor,
} from './lib/listening'

const NEUTRAL = '#3a3a3a'
const SHELF = 12
const ARTISTS = 10
const SPOTIFY_LOGO =
  'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14C9.6 9.9 15 10.56 18.72 12.84c.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z'

const CSS = `
@property --accent{syntax:'<color>';inherits:true;initial-value:${NEUTRAL}}
.sp{--sp-bg:#121212;--sp-elev:#1f1f1f;--sp-row:rgba(255,255,255,.1);--sp-text:#fff;--sp-sub:#b3b3b3;--sp-faint:#7a7a7a;--sp-line:rgba(255,255,255,.1);--sp-chip:rgba(255,255,255,.08);--sp-chip-hover:rgba(255,255,255,.14);--sp-green:#1ed760;--sp-skel:#2a2a2a;min-height:100vh;background:var(--sp-bg);color:var(--sp-text);transition:--accent .9s ease;overflow-x:hidden;-webkit-font-smoothing:antialiased}
:root[data-theme='light'] .sp{--sp-bg:#fff;--sp-elev:#f2f2f2;--sp-row:rgba(0,0,0,.06);--sp-text:#121212;--sp-sub:#5b5b5b;--sp-faint:#8c8c8c;--sp-line:rgba(0,0,0,.1);--sp-chip:rgba(0,0,0,.06);--sp-chip-hover:rgba(0,0,0,.11);--sp-green:#1db954;--sp-skel:#ebebeb}
.sp a{color:inherit;text-decoration:none}
.sp button{cursor:pointer}
.sp :focus-visible{outline:2px solid var(--sp-text);outline-offset:2px;border-radius:4px}
.sp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sp-u:hover{text-decoration:underline}
.sp-trunc{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.sp-wrap{max-width:1080px;margin:0 auto;padding:0 20px}
@media(min-width:640px){.sp-wrap{padding:0 32px}}
.sp-bar{position:fixed;inset:0 0 auto;z-index:40;height:60px;color:#fff;transition:background-color .3s,box-shadow .3s}
.sp-bar[data-solid='true']{background:color-mix(in srgb,var(--accent) 60%,#000);box-shadow:0 4px 24px rgba(0,0,0,.25)}
.sp-bar .sp-wrap{height:100%;display:flex;align-items:center;justify-content:space-between;gap:12px}
.sp-bar-title{font-size:15px;font-weight:700;opacity:0;transform:translateY(6px);transition:opacity .3s,transform .3s;min-width:0}
.sp-bar[data-solid='true'] .sp-bar-title{opacity:1;transform:none}
.sp-pillbtn{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px 0 10px;border-radius:999px;background:rgba(0,0,0,.35);font-size:13px;font-weight:700;transition:background-color .2s,transform .2s;flex-shrink:0}
.sp-pillbtn:hover{background:rgba(0,0,0,.55);transform:scale(1.03)}
.sp-tools{display:flex;align-items:center;gap:4px;flex-shrink:0}
.sp-tool{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-width:32px;padding:0 8px;border-radius:999px;background:rgba(0,0,0,.35);color:#fff;transition:background-color .2s}
.sp-tool:hover{background:rgba(0,0,0,.55)}
.sp-hero{position:relative;background-color:var(--accent);color:#fff;padding:100px 0 28px}
.sp-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 0,rgba(0,0,0,.5) 100%);pointer-events:none}
.sp-hero-in{position:relative;z-index:1;display:flex;flex-direction:column;gap:22px}
@media(min-width:768px){.sp-hero-in{flex-direction:row;align-items:flex-end;gap:28px}}
.sp-cover{width:min(62vw,220px);aspect-ratio:1;flex-shrink:0;border-radius:6px;box-shadow:0 10px 48px rgba(0,0,0,.55);object-fit:cover;background:rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.5)}
@media(min-width:768px){.sp-cover{width:232px}}
.sp-hero-text{min-width:0;flex:1}
.sp-kicker{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700}
.sp-kicker[data-live='true']{color:var(--sp-green)}
.sp-title{font-size:clamp(36px,7.4vw,92px);font-weight:800;letter-spacing:-.045em;line-height:1.02;margin:8px 0 14px;padding-bottom:.06em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.sp-title-sm{font-size:clamp(28px,4.6vw,52px)}
.sp-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 0;font-size:14px;color:rgba(255,255,255,.72)}
.sp-meta strong{color:#fff;font-weight:700}
.sp-meta>*+*::before{content:'•';margin:0 7px;color:rgba(255,255,255,.6)}
.sp-band{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 42%,var(--sp-bg)) 0,var(--sp-bg) 240px)}
.sp-controls{display:flex;flex-wrap:wrap;align-items:center;gap:16px 24px;padding:24px 0 8px}
.sp-play{width:56px;height:56px;border-radius:50%;background:var(--sp-green);color:#000;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 8px 18px rgba(0,0,0,.3);transition:transform .15s,background-color .15s}
.sp-play:hover{transform:scale(1.06);background:#3be477}
.sp-play[aria-disabled='true']{opacity:.5;pointer-events:none}
.sp-progress{display:flex;align-items:center;gap:10px;flex:1;min-width:220px;max-width:560px;font-size:11.5px;color:var(--sp-sub);font-variant-numeric:tabular-nums}
.sp-progress>span{width:38px}
.sp-progress>span:first-child{text-align:right}
.sp-bar-track{flex:1;height:4px;border-radius:2px;background:var(--sp-line);overflow:hidden}
.sp-bar-fill{height:100%;border-radius:2px;background:var(--sp-text);transition:width .9s linear,background-color .2s}
.sp-progress:hover .sp-bar-fill{background:var(--sp-green)}
.sp-on{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--sp-sub);margin-left:auto;transition:color .2s}
.sp-on:hover{color:var(--sp-text)}
.sp-eq{display:inline-flex;align-items:flex-end;gap:2px;height:12px}
.sp-eq i{width:3px;height:3px;border-radius:1px;background:currentColor}
.sp-eq[data-on='true'] i{animation:sp-eq .9s ease-in-out infinite}
.sp-eq i:nth-child(2){animation-delay:-.3s}.sp-eq i:nth-child(3){animation-delay:-.6s}.sp-eq i:nth-child(4){animation-delay:-.45s}
@keyframes sp-eq{0%,100%{height:3px}50%{height:12px}}
.sp-sec{padding:32px 0 4px}
.sp-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px 16px;margin-bottom:16px}
.sp-h2{font-size:24px;font-weight:800;letter-spacing:-.025em;line-height:1.15;margin:0}
.sp-hsub{font-size:13px;color:var(--sp-sub);margin-top:4px}
.sp-more{font-size:13px;font-weight:700;color:var(--sp-sub);transition:color .2s}
.sp-more:hover{color:var(--sp-text);text-decoration:underline}
.sp-chips{display:flex;flex-wrap:wrap;gap:8px}
.sp-chip{height:32px;padding:0 14px;border-radius:999px;background:var(--sp-chip);font-size:13.5px;font-weight:600;transition:background-color .2s,transform .1s}
.sp-chip:hover{background:var(--sp-chip-hover)}
.sp-chip:active{transform:scale(.97)}
.sp-chip[aria-pressed='true']{background:var(--sp-text);color:var(--sp-bg)}
.sp-wrapped{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media(min-width:900px){.sp-wrapped{grid-template-columns:repeat(4,minmax(0,1fr))}}
.sp-w{position:relative;isolation:isolate;overflow:hidden;border-radius:12px;padding:16px;min-height:236px;display:flex;flex-direction:column;justify-content:space-between;gap:16px;color:#000;transition:transform .25s cubic-bezier(.2,.8,.2,1)}
a.sp-w:hover{transform:translateY(-3px) rotate(-.4deg)}
.sp-w::before,.sp-w::after{content:'';position:absolute;z-index:-1;pointer-events:none}
.sp-w-1{background:#1ed760}
.sp-w-1::before{width:150%;aspect-ratio:1;right:-95%;bottom:-95%;border-radius:50%;border:30px solid rgba(0,0,0,.13)}
.sp-w-2{background:#f573a0}
.sp-w-2::before{width:120%;aspect-ratio:1;right:-70%;top:-60%;background:rgba(255,255,255,.18);transform:rotate(28deg);border-radius:18px}
.sp-w-3{background:#2d46b9;color:#fff}
.sp-w-3::before{width:220%;height:38px;left:-60%;top:58px;background:#509bf5;transform:rotate(-12deg)}
.sp-w-3::after{width:220%;height:18px;left:-60%;top:110px;background:#c4f0d4;transform:rotate(-12deg);opacity:.85}
.sp-w-4{background:#ff9b2e}
.sp-w-4::before{width:90px;height:90px;right:-18px;top:-18px;border-radius:50%;background:#ffd23f}
.sp-w-4::after{width:120%;aspect-ratio:1;left:-60%;bottom:-85%;border-radius:50%;border:22px dashed rgba(0,0,0,.14)}
.sp-w-label{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.sp-w-big{font-size:clamp(22px,2.6vw,30px);font-weight:800;letter-spacing:-.035em;line-height:1.05;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.sp-w-num{font-size:clamp(54px,6.4vw,84px);font-weight:800;letter-spacing:-.06em;line-height:.9}
.sp-w-sub{font-size:13px;font-weight:600;opacity:.78;margin-top:8px}
.sp-w-img{width:92px;height:92px;object-fit:cover;box-shadow:0 8px 24px rgba(0,0,0,.28);background:rgba(0,0,0,.15)}
.sp-w-1 .sp-w-img{border-radius:50%}
.sp-w-2 .sp-w-img{border-radius:4px;transform:rotate(-4deg)}
.sp-skel{background:var(--sp-skel);border-radius:4px;animation:sp-pulse 1.4s ease-in-out infinite}
.sp-w.sp-skel{border-radius:12px}
@keyframes sp-pulse{50%{opacity:.55}}
.sp-thead,.sp-row{display:grid;grid-template-columns:24px minmax(0,1fr) 52px;gap:16px;align-items:center;padding:0 12px}
@media(min-width:768px){.sp-thead,.sp-row{grid-template-columns:24px minmax(0,5fr) minmax(0,3fr) 64px}}
.sp-thead{height:36px;border-bottom:1px solid var(--sp-line);margin-bottom:8px;font-size:13px;color:var(--sp-sub)}
.sp-row{height:58px;border-radius:5px;font-size:14px;color:var(--sp-sub);transition:background-color .15s}
.sp-row:hover{background:var(--sp-row)}
.sp-col3{display:none}
@media(min-width:768px){.sp-col3{display:block}}
.sp-end{text-align:right;font-variant-numeric:tabular-nums}
.sp-n{text-align:right;font-size:15px;font-variant-numeric:tabular-nums;display:flex;justify-content:flex-end}
.sp-n svg{display:none;color:var(--sp-text)}
.sp-row:hover .sp-n span{display:none}
.sp-row:hover .sp-n svg{display:block}
.sp-tt{display:flex;align-items:center;gap:12px;min-width:0}
.sp-tt img,.sp-tt .sp-ph{width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0;background:var(--sp-elev)}
.sp-name{font-size:15px;color:var(--sp-text);font-weight:500}
.sp-e{display:inline-flex;align-items:center;justify-content:center;height:16px;min-width:16px;padding:0 3px;margin-right:6px;border-radius:2px;background:var(--sp-sub);color:var(--sp-bg);font-size:9px;font-weight:800;vertical-align:1px}
.sp-day{font-size:13px;font-weight:700;color:var(--sp-text);padding:18px 12px 6px}
.sp-shelf{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin:0 -12px}
@media(max-width:639px){.sp-shelf .sp-card{padding:8px}.sp-shelf .sp-card-title{font-size:13px}.sp-shelf .sp-rank{display:none}}
@media(min-width:640px){.sp-shelf{gap:4px}}
@media(min-width:900px){.sp-shelf{grid-template-columns:repeat(5,minmax(0,1fr))}}
.sp-scroll{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(148px,calc((100% - 20px) / 6));gap:4px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -12px;padding-bottom:6px;scrollbar-width:thin}
.sp-card{position:relative;display:block;padding:12px;border-radius:8px;transition:background-color .25s;scroll-snap-align:start;min-width:0}
.sp-card:hover{background:var(--sp-elev)}
.sp-card-img{position:relative;margin-bottom:12px}
.sp-card-img img,.sp-card-img .sp-ph{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;background:var(--sp-elev);color:var(--sp-faint);box-shadow:0 8px 24px rgba(0,0,0,.35)}
.sp-card-round .sp-card-img img,.sp-card-round .sp-card-img .sp-ph{border-radius:50%}
.sp-card-play{position:absolute;right:8px;bottom:8px;width:46px;height:46px;border-radius:50%;background:var(--sp-green);color:#000;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 12px rgba(0,0,0,.3);opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}
.sp-card:hover .sp-card-play,.sp-card:focus-visible .sp-card-play{opacity:1;transform:none}
.sp-card-title{font-size:15px;font-weight:700;color:var(--sp-text)}
.sp-card-sub{font-size:13px;color:var(--sp-sub);margin-top:4px}
.sp-rank{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--sp-text);color:var(--sp-bg);font-size:11px;font-weight:800;margin-right:6px;vertical-align:1px}
.sp-msg{font-size:14px;color:var(--sp-sub);padding:8px 0}
.sp-msg button{font-weight:700;color:var(--sp-text);margin-left:8px}
.sp-msg button:hover{text-decoration:underline}
.sp-stats{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 8px}
.sp-stat{padding:6px 12px;border-radius:999px;background:var(--sp-chip);font-size:12.5px;color:var(--sp-sub)}
.sp-stat b{color:var(--sp-text);font-weight:700}
.sp-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid var(--sp-line);margin-top:48px;padding:24px 0 56px;font-size:13px;color:var(--sp-sub)}
.sp-foot-brand{display:flex;align-items:center;gap:10px}
.sp-foot-links{display:flex;gap:20px;font-weight:700}
.sp-foot-links a:hover{color:var(--sp-text);text-decoration:underline}
`

const loadNow = (_, opts) => fetchSpotifyNow(opts).then((data) => sampleNow(data))
const loadRecent = (_, opts) => fetchSpotifyRecent(opts)
const topCache = new Map()
const loadTop = async (range, opts) => {
  const hit = topCache.get(range)
  if (hit) return hit
  const data = await fetchSpotifyTop(range, opts)
  topCache.set(range, data)
  return data
}

function usePageVisible() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden')
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

function useScrolled(offset) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [offset])
  return scrolled
}

function useClock(every) {
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    if (!every) return
    setClock(Date.now())
    const id = setInterval(() => setClock(Date.now()), every)
    return () => clearInterval(id)
  }, [every])
  return clock
}

function useLive(load, { key = '', every = 0, active = true } = {}) {
  const [state, setState] = useState({ key, data: null, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!active) return
    const ctrl = new AbortController()
    let timer = 0
    const run = async () => {
      try {
        const data = await load(key, { signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        setState({ key, data, error: null })
      } catch (err) {
        if (ctrl.signal.aborted) return
        const code = err?.code || 'failed'
        setState((prev) => ({ key, data: prev.key === key ? prev.data : null, error: code }))
        if (code === 'spotify_disabled') return
      }
      if (every) timer = setTimeout(run, every)
    }
    run()
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [load, key, every, active, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  const current = state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current || (state.data === null && state.error === null),
    refresh,
  }
}

function useAccent(track) {
  const [accent, setAccent] = useState(NEUTRAL)
  const url = track?.thumb || track?.art
  const seed = track?.id || track?.title
  useEffect(() => {
    if (!seed) return
    let live = true
    coverColor(url).then((color) => {
      if (live) setAccent(color || fallbackColor(seed))
    })
    return () => {
      live = false
    }
  }, [url, seed])
  return accent
}

function Glyph({ d, size = 16, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  )
}

const PLAY = 'M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z'
const NOTE = 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'
const CLOCK = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 1.6a8.4 8.4 0 1 1 0 16.8 8.4 8.4 0 0 1 0-16.8zM11.2 6v6.5l4.6 2.7.8-1.4-3.8-2.2V6z'
const BACK = 'M15.7 4.3a1 1 0 0 1 0 1.4L9.4 12l6.3 6.3a1 1 0 0 1-1.4 1.4l-7-7a1 1 0 0 1 0-1.4l7-7a1 1 0 0 1 1.4 0z'

function Spotify({ size = 20 }) {
  return <Glyph d={SPOTIFY_LOGO} size={size} />
}

function Img({ src, alt = '', className, size = 300 }) {
  if (!src) {
    return (
      <span aria-hidden="true" className={`sp-ph ${className || ''}`}>
        <svg viewBox="0 0 24 24" width="28%" height="28%" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={NOTE} />
        </svg>
      </span>
    )
  }
  return <img src={src} alt={alt} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={className} />
}

function Out({ href, className = 'sp-u', children, label, tabIndex }) {
  if (!href) return <span className={className}>{children}</span>
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={className} tabIndex={tabIndex}>
      {children}
    </a>
  )
}

function Artists({ track }) {
  const artists = track?.artists || []
  if (!artists.length) return <>Unknown artist</>
  return artists.map((artist, index) => (
    <span key={`${artist.name}-${index}`}>
      {index > 0 && ', '}
      <Out href={artist.url}>{artist.name}</Out>
    </span>
  ))
}

function Explicit({ track }) {
  if (!track?.explicit) return null
  return (
    <span className="sp-e" title="Explicit">
      E
    </span>
  )
}

function Equalizer({ on }) {
  return (
    <span aria-hidden="true" className="sp-eq" data-on={on}>
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

function heroState(now, recent, clock) {
  const status = nowStatus(now.data)
  const last = recent.data?.[0]
  if (now.loading) return { kind: 'loading' }
  if (now.error === 'spotify_disabled') return { kind: 'message', title: 'Not connected right now', body: 'The Spotify link is off for the moment. Check back later.' }
  if (!now.data && now.error) return { kind: 'message', title: 'Could not reach Spotify', body: 'Trying again in a few seconds.' }
  if (status === 'podcast') return { kind: 'message', title: 'Listening to a podcast', body: 'Podcast episodes stay private, so there is nothing to show here.' }
  if (status === 'idle' && !last) return { kind: 'message', title: 'Nothing playing', body: recent.loading ? 'Looking up the last song…' : 'Nothing played lately.' }
  if (status === 'idle') return { kind: 'track', status, track: last.track, label: `Last played ${relativeTime(last.playedAt, clock)}` }
  return { kind: 'track', status, track: now.data.track, label: status === 'playing' ? 'Now playing' : 'Paused' }
}

function Hero({ hero }) {
  if (hero.kind === 'loading') {
    return (
      <div className="sp-hero-in">
        <div className="sp-cover sp-skel" style={{ background: 'rgba(255,255,255,.12)' }} />
        <div className="sp-hero-text">
          <div className="sp-skel" style={{ width: 110, height: 14, background: 'rgba(255,255,255,.14)' }} />
          <div className="sp-skel" style={{ width: '70%', height: 64, margin: '14px 0', background: 'rgba(255,255,255,.14)' }} />
          <div className="sp-skel" style={{ width: 220, height: 14, background: 'rgba(255,255,255,.14)' }} />
        </div>
      </div>
    )
  }
  if (hero.kind === 'message') {
    return (
      <div className="sp-hero-in">
        <div className="sp-cover">
          <Spotify size={72} />
        </div>
        <div className="sp-hero-text">
          <p className="sp-kicker">Spotify</p>
          <h2 className="sp-title sp-title-sm">{hero.title}</h2>
          <p className="sp-meta">
            <span>{hero.body}</span>
          </p>
        </div>
      </div>
    )
  }
  const { track, status, label } = hero
  return (
    <div className="sp-hero-in">
      <Out href={track.url} className="" tabIndex={-1} label={`${track.title} on Spotify`}>
        <Img src={track.art} className="sp-cover" size={300} />
      </Out>
      <div className="sp-hero-text" aria-live="polite">
        <p className="sp-kicker" data-live={status === 'playing'}>
          <Equalizer on={status === 'playing'} />
          <span>{label}</span>
        </p>
        <h2 className="sp-title" title={track.title}>
          <Out href={track.url}>{track.title}</Out>
        </h2>
        <p className="sp-meta">
          <strong>
            <Artists track={track} />
          </strong>
          {track.album?.name && (
            <span>
              <Out href={track.album.url}>{track.album.name}</Out>
            </span>
          )}
          {track.durationMs && <span>{formatDuration(track.durationMs)}</span>}
          {track.explicit && <span>Explicit</span>}
        </p>
      </div>
    </div>
  )
}

function Controls({ hero, now, clock }) {
  const track = hero.kind === 'track' ? hero.track : null
  const at = track && hero.status !== 'idle' ? progressAt(now.data, clock) : null
  const duration = track?.durationMs
  const pct = at !== null && duration ? Math.min(100, (at / duration) * 100) : 0
  return (
    <div className="sp-controls">
      <a
        href={track?.url || undefined}
        target="_blank"
        rel="noreferrer"
        className="sp-play"
        aria-label={track ? `Play ${track.title} on Spotify` : 'Play on Spotify'}
        aria-disabled={!track?.url}
      >
        <Glyph d={PLAY} size={24} />
      </a>
      {at !== null && duration ? (
        <div className="sp-progress">
          <span>{formatDuration(at)}</span>
          <div
            className="sp-bar-track"
            role="progressbar"
            aria-label="Track progress"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration / 1000)}
            aria-valuenow={Math.round(at / 1000)}
            aria-valuetext={`${formatDuration(at)} of ${formatDuration(duration)}`}
          >
            <div className="sp-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span>{formatDuration(duration)}</span>
        </div>
      ) : (
        <div className="sp-progress" />
      )}
      <a href="https://open.spotify.com" target="_blank" rel="noreferrer" className="sp-on">
        <Spotify size={22} />
        <span>Open Spotify</span>
      </a>
    </div>
  )
}

function Section({ id, title, sub, action, children }) {
  return (
    <section aria-labelledby={id} className="sp-sec">
      <div className="sp-head">
        <div>
          <h2 id={id} className="sp-h2">
            {title}
          </h2>
          {sub && <p className="sp-hsub">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Unavailable({ error, onRetry }) {
  if (error === 'spotify_disabled') return <p className="sp-msg">Not connected right now.</p>
  return (
    <p className="sp-msg">
      Could not load this from Spotify.
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </p>
  )
}

function Chips({ value, onChange }) {
  return (
    <div role="group" aria-label="Time range" className="sp-chips">
      {LISTENING_RANGES.map((range) => (
        <button key={range.id} type="button" aria-pressed={range.id === value} onClick={() => onChange(range.id)} className="sp-chip">
          {range.label}
        </button>
      ))}
    </div>
  )
}

function WrappedCard({ tone, href, children }) {
  const className = `sp-w sp-w-${tone}`
  if (!href) return <div className={className}>{children}</div>
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  )
}

function Wrapped({ top, recent, rangeLabel, clock }) {
  if (top.loading || recent.loading) {
    return (
      <div className="sp-wrapped" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`sp-w sp-w-${n} sp-skel`} />
        ))}
      </div>
    )
  }
  const artist = top.data?.artists?.[0]
  const song = top.data?.tracks?.[0]
  const plays = recent.data || []
  const stats = listeningStats(plays)
  const [repeat] = onRepeat(plays, 2)
  const today = playsOn(plays, clock)
  if (!artist && !song && !plays.length) return <Unavailable error={top.error || recent.error} onRetry={top.refresh} />

  return (
    <div className="sp-wrapped">
      <WrappedCard tone={1} href={artist?.url}>
        <p className="sp-w-label">Top artist</p>
        {artist ? (
          <div>
            <Img src={artist.art || artist.thumb} className="sp-w-img" size={160} />
            <p className="sp-w-big" style={{ marginTop: 14 }}>
              {artist.name}
            </p>
            <p className="sp-w-sub">#1 · last {rangeLabel}</p>
          </div>
        ) : (
          <p className="sp-w-sub">Not enough listening yet.</p>
        )}
      </WrappedCard>
      <WrappedCard tone={2} href={song?.url}>
        <p className="sp-w-label">Top song</p>
        {song ? (
          <div>
            <Img src={song.art || song.thumb} className="sp-w-img" size={300} />
            <p className="sp-w-big" style={{ marginTop: 14 }}>
              {song.title}
            </p>
            <p className="sp-w-sub sp-trunc">{song.artists.map((a) => a.name).join(', ')}</p>
          </div>
        ) : (
          <p className="sp-w-sub">Not enough listening yet.</p>
        )}
      </WrappedCard>
      <WrappedCard tone={3}>
        <p className="sp-w-label">Minutes listened</p>
        <div>
          <p className="sp-w-num">{stats.minutes.toLocaleString('en-US')}</p>
          <p className="sp-w-sub">
            across my last {stats.plays} plays · {stats.artists} artists
          </p>
        </div>
      </WrappedCard>
      {repeat ? (
        <WrappedCard tone={4} href={repeat.track.url}>
          <p className="sp-w-label">On repeat</p>
          <div>
            <p className="sp-w-num">×{repeat.count}</p>
            <p className="sp-w-sub sp-trunc" style={{ fontWeight: 800, opacity: 1 }}>
              {repeat.track.title}
            </p>
            <p className="sp-w-sub sp-trunc" style={{ marginTop: 2 }}>
              {repeat.track.artists.map((a) => a.name).join(', ')}
            </p>
          </div>
        </WrappedCard>
      ) : (
        <WrappedCard tone={4}>
          <p className="sp-w-label">Today</p>
          <div>
            <p className="sp-w-num">{today}</p>
            <p className="sp-w-sub">{today === 1 ? 'song played so far' : 'songs played so far'}</p>
          </div>
        </WrappedCard>
      )}
    </div>
  )
}

function TrackTitle({ track }) {
  return (
    <div className="sp-tt">
      <Img src={track.thumb || track.art} size={64} />
      <div style={{ minWidth: 0 }}>
        <p className="sp-name sp-trunc">
          <Out href={track.url}>{track.title}</Out>
        </p>
        <p className="sp-trunc" style={{ fontSize: 13.5 }}>
          <Explicit track={track} />
          <Artists track={track} />
        </p>
      </div>
    </div>
  )
}

function TableHead({ third, last }) {
  return (
    <div className="sp-thead" aria-hidden="true">
      <span className="sp-end">#</span>
      <span>Title</span>
      <span className="sp-col3">{third}</span>
      <span className="sp-end" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {last}
      </span>
    </div>
  )
}

function RowsSkeleton({ rows }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sp-row">
          <span />
          <div className="sp-tt">
            <div className="sp-skel" style={{ width: 40, height: 40 }} />
            <div style={{ flex: 1 }}>
              <div className="sp-skel" style={{ width: `${60 - (i % 3) * 12}%`, height: 12 }} />
              <div className="sp-skel" style={{ width: '30%', height: 10, marginTop: 8 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TopTracks({ top }) {
  const [all, setAll] = useState(false)
  if (top.loading) return <RowsSkeleton rows={5} />
  if (!top.data) return <Unavailable error={top.error} onRetry={top.refresh} />
  const tracks = top.data.tracks
  if (!tracks.length) return <p className="sp-msg">Not enough listening in this range yet.</p>
  const shown = all ? tracks : tracks.slice(0, TOP_TRACKS)
  return (
    <div>
      <TableHead third="Album" last={<Glyph d={CLOCK} size={16} />} />
      <ol>
        {shown.map((track, index) => (
          <li key={track.id || index} className="sp-row">
            <span className="sp-n">
              <span>{index + 1}</span>
              <Out href={track.url} className="" label={`Play ${track.title} on Spotify`}>
                <Glyph d={PLAY} size={14} />
              </Out>
            </span>
            <TrackTitle track={track} />
            <span className="sp-col3 sp-trunc">
              <Out href={track.album?.url}>{track.album?.name}</Out>
            </span>
            <span className="sp-end">{track.durationMs ? formatDuration(track.durationMs) : ''}</span>
          </li>
        ))}
      </ol>
      {tracks.length > TOP_TRACKS && (
        <button type="button" className="sp-more" style={{ margin: '14px 12px 0' }} onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show less' : 'See more'}
        </button>
      )}
    </div>
  )
}

function Card({ href, img, round, title, sub, rank }) {
  return (
    <a href={href || undefined} target="_blank" rel="noreferrer" className={`sp-card ${round ? 'sp-card-round' : ''}`}>
      <div className="sp-card-img">
        <Img src={img} size={300} />
        <span className="sp-card-play" aria-hidden="true">
          <Glyph d={PLAY} size={20} />
        </span>
      </div>
      <p className="sp-card-title sp-trunc">
        {rank && <span className="sp-rank">{rank}</span>}
        {title}
      </p>
      <p className="sp-card-sub sp-trunc">{sub}</p>
    </a>
  )
}

function CardsSkeleton({ count, round, scroll }) {
  return (
    <div className={scroll ? 'sp-scroll' : 'sp-shelf'} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sp-card">
          <div className="sp-skel" style={{ width: '100%', aspectRatio: '1', borderRadius: round ? '50%' : 6, marginBottom: 12 }} />
          <div className="sp-skel" style={{ width: '70%', height: 12 }} />
          <div className="sp-skel" style={{ width: '45%', height: 10, marginTop: 8 }} />
        </div>
      ))}
    </div>
  )
}

function TopArtists({ top }) {
  if (top.loading) return <CardsSkeleton count={5} round />
  if (!top.data) return <Unavailable error={top.error} onRetry={top.refresh} />
  const artists = top.data.artists.slice(0, ARTISTS)
  if (!artists.length) return <p className="sp-msg">Not enough listening in this range yet.</p>
  return (
    <div className="sp-shelf">
      {artists.map((artist, index) => (
        <Card key={artist.id || index} href={artist.url} img={artist.art || artist.thumb} round title={artist.name} sub="Artist" rank={index + 1} />
      ))}
    </div>
  )
}

function Recent({ recent, clock }) {
  const [history, setHistory] = useState(false)
  if (recent.loading) return <CardsSkeleton count={6} scroll />
  if (!recent.data) return <Unavailable error={recent.error} onRetry={recent.refresh} />
  if (!recent.data.length) return <p className="sp-msg">Nothing played lately.</p>

  const stats = listeningStats(recent.data)
  return (
    <div>
      <div className="sp-scroll">
        {recent.data.slice(0, SHELF).map((item) => (
          <Card
            key={`${item.playedAt}-${item.track.id}`}
            href={item.track.url}
            img={item.track.art}
            title={item.track.title}
            sub={`${item.track.artists.map((a) => a.name).join(', ')} · ${relativeTime(item.playedAt, clock)}`}
          />
        ))}
      </div>
      <div className="sp-stats">
        <span className="sp-stat">
          <b>{stats.plays}</b> plays
        </span>
        <span className="sp-stat">
          <b>{stats.artists}</b> artists
        </span>
        <span className="sp-stat">
          <b>{stats.minutes}</b> minutes
        </span>
        {stats.since && (
          <span className="sp-stat">
            since <b>{relativeTime(stats.since, clock)}</b>
          </span>
        )}
      </div>
      {history && (
        <div style={{ marginTop: 12 }}>
          <TableHead third="Album" last="Played" />
          {groupByDay(recent.data, clock).map((group) => (
            <div key={group.key}>
              <p className="sp-day">{group.label}</p>
              <ol>
                {group.items.map((item, index) => (
                  <li key={`${item.playedAt}-${item.track.id}`} className="sp-row">
                    <span className="sp-n">
                      <span>{index + 1}</span>
                      <Out href={item.track.url} className="" label={`Play ${item.track.title} on Spotify`}>
                        <Glyph d={PLAY} size={14} />
                      </Out>
                    </span>
                    <TrackTitle track={item.track} />
                    <span className="sp-col3 sp-trunc">
                      <Out href={item.track.album?.url}>{item.track.album?.name}</Out>
                    </span>
                    <span className="sp-end" title={absoluteTime(item.playedAt)}>
                      {clockTime(item.playedAt)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="sp-more" style={{ margin: '10px 0 0' }} onClick={() => setHistory((v) => !v)} aria-expanded={history}>
        {history ? 'Hide full history' : `Show full history (${recent.data.length})`}
      </button>
    </div>
  )
}

export default function ListeningPage({ theme, onToggleTheme }) {
  const visible = usePageVisible()
  const scrolled = useScrolled(180)
  const [range, setRange] = useState(LISTENING_RANGES[0].id)
  const now = useLive(loadNow, { key: 'now', every: NOW_POLL_MS, active: visible })
  const recent = useLive(loadRecent, { key: 'recent', every: RECENT_POLL_MS, active: visible })
  const top = useLive(loadTop, { key: range })
  const status = nowStatus(now.data)
  const clock = useClock(status === 'playing' && visible ? 1000 : 30_000)
  const hero = heroState(now, recent, clock)
  const accent = useAccent(hero.kind === 'track' ? hero.track : null)
  const rangeLabel = LISTENING_RANGES.find((r) => r.id === range)?.label || ''

  const trackId = now.data?.track?.id
  const refreshRecent = recent.refresh
  const seenTrack = useRef(trackId)
  useEffect(() => {
    if (!trackId || seenTrack.current === trackId) return
    if (seenTrack.current) refreshRecent()
    seenTrack.current = trackId
  }, [trackId, refreshRecent])

  const refreshNow = now.refresh
  const endedSample = useRef(0)
  useEffect(() => {
    if (!now.data || !trackEnded(now.data, clock) || endedSample.current === now.data.sampledAt) return
    endedSample.current = now.data.sampledAt
    refreshNow()
  }, [now.data, clock, refreshNow])

  return (
    <div className="sp animate-view-in" style={{ '--accent': accent }}>
      <style>{CSS}</style>
      <header className="sp-bar" data-solid={scrolled}>
        <div className="sp-wrap">
          <a {...link(HOME_PATH)} className="sp-pillbtn">
            <Glyph d={BACK} size={16} />
            <span>Home</span>
          </a>
          <p className="sp-bar-title sp-trunc" aria-hidden="true">
            {hero.kind === 'track' ? hero.track.title : 'Listening'}
          </p>
          <div className="sp-tools">
            <CommandButton className="sp-tool" />
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="sp-tool" />
          </div>
        </div>
      </header>

      <main>
        <h1 className="sp-sr">Listening: what Blxr is playing on Spotify</h1>
        <section className="sp-hero" aria-label="Now playing">
          <div className="sp-wrap">
            <Hero hero={hero} />
          </div>
        </section>

        <div className="sp-band">
          <div className="sp-wrap">
            <Controls hero={hero} now={now} clock={clock} />

            <Section id="listening-wrapped" title="Lately, wrapped" sub={`My last ${rangeLabel} on Spotify`} action={<Chips value={range} onChange={setRange} />}>
              <Wrapped top={top} recent={recent} rangeLabel={rangeLabel} clock={clock} />
            </Section>

            <Section id="listening-top" title="Top tracks" sub={`Most played · last ${rangeLabel}`}>
              <TopTracks top={top} />
            </Section>

            <Section id="listening-artists" title="Top artists" sub={`Most played · last ${rangeLabel}`}>
              <TopArtists top={top} />
            </Section>

            <Section id="listening-recent" title="Recently played" sub="The last 50 songs, newest first">
              <Recent recent={recent} clock={clock} />
            </Section>

            <footer className="sp-foot">
              <div className="sp-foot-brand">
                <Spotify size={24} />
                <span>{LISTENING_INTRO}</span>
              </div>
              <div className="sp-foot-links">
                <a {...link(USES_PATH)}>What I use</a>
                <a {...link(CONTACT_PATH)}>Send me a song</a>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  )
}
