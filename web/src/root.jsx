import { Component, StrictMode, lazy, Suspense, useEffect, useState } from 'react'
import App from './app.jsx'
import { I18nProvider } from './lib/i18n'

const MusicWidget = lazy(() => import('./components/music-widget.jsx'))

class WidgetBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

const WAKE_EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel']

const IDLE_MOUNT_MS = 4000

function DeferredMusicWidget() {
  const [ready, setReady] = useState(false)

  useEffect(() => {

    const listenerOptions = { passive: true, capture: true }
    const state = { loaded: document.readyState === 'complete', woken: false, done: false }
    let frame = 0
    let timer = 0

    const teardown = () => {
      window.removeEventListener('load', onLoad)
      for (const type of WAKE_EVENTS) window.removeEventListener(type, onWake, listenerOptions)
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }

    const mountIfReady = () => {
      if (state.done || !state.loaded || !state.woken) return
      state.done = true
      teardown()

      frame = requestAnimationFrame(() => setReady(true))
    }

    function onWake() {
      state.woken = true
      mountIfReady()
    }

    function onLoad() {
      state.loaded = true

      timer = setTimeout(onWake, IDLE_MOUNT_MS)
      mountIfReady()
    }

    for (const type of WAKE_EVENTS) window.addEventListener(type, onWake, listenerOptions)
    if (state.loaded) onLoad()
    else window.addEventListener('load', onLoad, { once: true })

    return teardown
  }, [])

  if (!ready) return null

  return (
    <WidgetBoundary>
      <Suspense fallback={null}>
        <MusicWidget />
      </Suspense>
    </WidgetBoundary>
  )
}

export default function Root() {
  return (
    <StrictMode>
      <I18nProvider>
        <App />
        <DeferredMusicWidget />
      </I18nProvider>
    </StrictMode>
  )
}
