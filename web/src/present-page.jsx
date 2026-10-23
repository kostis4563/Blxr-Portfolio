import { useEffect, useRef, useState } from 'react'
import { Icon } from './components/icon'
import { Spinner } from './components/skeleton'
import Slide from './components/presentations/slide'
import Presenter, { Stage, enterFullscreen, useDeckNav } from './components/presentations/presenter'
import { link, useRouteHash, HOME_PATH } from './lib/router'
import { tokenFromHash, imagesOf, sectionNumber, keyAction, revealIn } from './lib/presentations'
import { fetchShared, preloadImages, errorText } from './lib/presentations-api'

const SITE_TITLE = 'kostis.wtf'

const slideFromHash = (hash) => Math.max(0, (Number(/\/(\d+)$/.exec(hash || '')?.[1]) || 1) - 1)

function Shell({ children, deck, onPresent }) {
  return (
    <div className="flex min-h-dvh flex-col bg-black text-white antialiased">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <a {...link(HOME_PATH)} className="shrink-0 rounded-md font-mono text-[13px] font-semibold tracking-tight text-white/80 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/50">
          blxr
        </a>
        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-white/15" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[14px] font-semibold tracking-tight">{deck ? deck.title : 'Shared presentation'}</h1>
          {deck && (
            <p className="truncate text-[12px] text-white/50">
              {deck.author ? <>by {deck.author} · </> : null}
              {deck.slides.length} slide{deck.slides.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
        {deck && (
          <button
            type="button"
            onClick={onPresent}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-black outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2"
            title="Present full screen (F)"
          >
            <Icon name="play" className="h-3.5 w-3.5" /> Present
          </button>
        )}
      </header>
      {children}
    </div>
  )
}

function Message({ icon, title, body }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 pb-16">
      <div className="max-w-[400px] text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white/70">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <p className="mt-4 text-[15px] font-semibold">{title}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{body}</p>
        <a {...link(HOME_PATH)} className="mt-5 inline-flex h-9 items-center rounded-full px-4 text-[13px] text-white/70 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-white">
          Go to {SITE_TITLE}
        </a>
      </div>
    </main>
  )
}

function Viewer({ deck, token, start }) {
  const { view, go, settle } = useDeckNav(deck.slides.length, start)
  const [showing, setShowing] = useState(false)
  const strip = useRef(null)
  const count = deck.slides.length

  const present = () => {
    enterFullscreen()
    setShowing(true)
  }

  useEffect(() => {
    preloadImages(imagesOf(deck.slides))
    document.title = `${deck.title} — ${SITE_TITLE}`
  }, [deck])

  useEffect(() => {
    try {
      window.history.replaceState(window.history.state, '', `#${token}${view.index ? `/${view.index + 1}` : ''}`)
    } catch {
    }
    revealIn(strip.current, strip.current?.querySelector(`[data-slide-index="${view.index}"]`), 'smooth')
  }, [token, view.index])

  const keys = useRef({})
  keys.current = { go, count, showing, present }
  useEffect(() => {
    const onKey = (event) => {
      const held = keys.current
      if (held.showing) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const action = keyAction(event)
      if (action === 'next' && event.key !== 'Enter') held.go((at) => at + 1)
      else if (action === 'prev') held.go((at) => at - 1)
      else if (action === 'first') held.go(0)
      else if (action === 'last') held.go(held.count - 1)
      else if (action === 'fullscreen') held.present()
      else return
      event.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Shell deck={deck} onPresent={present}>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-6 sm:px-6">
        <div className="relative w-full" style={{ maxWidth: 'min(1280px, calc((100dvh - 230px) * 16 / 9))' }}>
          <Stage deck={deck} view={view} onSettled={settle} className="w-full rounded-xl shadow-2xl ring-1 ring-white/15" />
          <button type="button" aria-label="Previous slide" onClick={() => go((at) => at - 1)} className="absolute inset-y-0 left-0 w-1/3 cursor-pointer opacity-0" disabled={view.index === 0} tabIndex={-1} />
          <button type="button" aria-label="Next slide" onClick={() => go((at) => at + 1)} className="absolute inset-y-0 right-0 w-2/3 cursor-pointer opacity-0" disabled={view.index === count - 1} tabIndex={-1} />
        </div>

        <div className="flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-1">
          <button type="button" aria-label="Previous slide" onClick={() => go((at) => at - 1)} disabled={view.index === 0} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-30">
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <span className="w-16 text-center font-mono text-[12.5px] tabular-nums text-white/75" aria-live="polite">
            {view.index + 1} / {count}
          </span>
          <button type="button" aria-label="Next slide" onClick={() => go((at) => at + 1)} disabled={view.index === count - 1} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-30">
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
          <button type="button" aria-label="Present full screen" title="Full screen (F)" onClick={present} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white">
            <Icon name="maximize" className="h-4 w-4" />
          </button>
        </div>

        {count > 1 && (
          <ol ref={strip} className="deck-strip flex w-full max-w-[1440px] gap-2.5 overflow-x-auto px-0.5 pb-2 pt-1" aria-label="All slides">
            {deck.slides.map((slide, i) => (
              <li key={slide.id} data-slide-index={i} className="w-32 shrink-0">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Slide ${i + 1}`}
                  aria-current={i === view.index ? 'true' : undefined}
                  className="block w-full cursor-pointer outline-none"
                >
                  <span className="deck-thumb pointer-events-none" inert>
                    <Slide slide={slide} theme={deck.theme} index={i} part={sectionNumber(deck.slides, i)} numbers={deck.numbers} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </main>

      {showing && (
        <Presenter
          deck={deck}
          start={view.index}
          onClose={(last) => {
            setShowing(false)
            go(last)
          }}
        />
      )}
    </Shell>
  )
}

export default function PresentPage() {
  const hash = useRouteHash()
  const token = tokenFromHash(hash)
  const hasHash = hash.length > 1
  const [state, setState] = useState({ status: 'idle' })
  const start = useRef(0)

  useEffect(() => {
    if (!token) {
      setState({ status: hasHash ? 'missing' : 'empty' })
      return undefined
    }
    let live = true
    start.current = slideFromHash(window.location.hash)
    setState({ status: 'loading' })
    fetchShared(token).then(
      (deck) => live && setState({ status: 'ready', deck }),
      (error) => live && setState({ status: error?.code === 'missing' ? 'missing' : 'error', error }),
    )
    return () => { live = false }
  }, [token, hasHash])

  if (state.status === 'ready') return <Viewer key={token} deck={state.deck} token={token} start={start.current} />

  return (
    <Shell>
      {state.status === 'loading' || state.status === 'idle' ? (
        <main className="flex flex-1 items-center justify-center pb-16 text-white/60" aria-busy="true">
          <span className="inline-flex items-center gap-2 text-[13px]"><Spinner className="h-4 w-4" /> Opening the presentation</span>
        </main>
      ) : state.status === 'missing' ? (
        <Message
          icon="lock"
          title="This presentation is not available"
          body="The link may have been turned off or replaced by its owner, or it did not come through whole. Ask them for a fresh one."
        />
      ) : state.status === 'error' ? (
        <Message icon="alert" title="Could not open the presentation" body={errorText(state.error)} />
      ) : (
        <Message
          icon="presentation"
          title="Nothing to show yet"
          body="This page plays presentations shared from kostis.wtf. Open the full link you were sent; it ends in a long code."
        />
      )}
    </Shell>
  )
}
