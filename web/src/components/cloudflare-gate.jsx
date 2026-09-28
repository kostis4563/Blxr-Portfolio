import { useEffect, useId, useRef, useState } from 'react'
import { gateEnabled, gatePassed, rememberGatePassed, mountGate } from '../lib/captcha'
import { Spinner } from './skeleton'

const SUCCESS_HOLD_MS = 700
const FADE_MS = 450

const COPY = {
  checking: {
    title: 'Checking your browser',
    body: 'A quick Cloudflare check before the site loads. It usually takes a second or two.',
  },
  passed: {
    title: 'Verified',
    body: 'Loading the site…',
  },
  failed: {
    title: "Couldn't verify your browser",
    body: 'Cloudflare could not finish the check. Try again, or reload the page.',
  },
}

export default function CloudflareGate() {
  const titleId = useId()
  const box = useRef(null)
  const [phase, setPhase] = useState(() => (gateEnabled() ? 'checking' : 'done'))
  const [attempt, setAttempt] = useState(0)
  const active = phase !== 'done'

  useEffect(() => {
    if (!active) return undefined
    if (gatePassed()) {
      setPhase('done')
      return undefined
    }
    let widget = null
    let cancelled = false
    mountGate(box.current, {
      theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
      onPass: () => {
        rememberGatePassed()
        setPhase('passed')
      },
      onFail: () => setPhase('failed'),
    })
      .then((w) => {
        if (cancelled) w.remove()
        else widget = w
      })
      .catch(() => {
        if (!cancelled) setPhase('leaving')
      })
    return () => {
      cancelled = true
      widget?.remove()
    }
  }, [active, attempt])

  useEffect(() => {
    const next = { passed: ['leaving', SUCCESS_HOLD_MS], leaving: ['done', FADE_MS] }[phase]
    if (!next) return undefined
    const id = setTimeout(() => setPhase(next[0]), next[1])
    return () => clearTimeout(id)
  }, [phase])

  if (!active) return null

  const copy = COPY[phase] ?? COPY.passed
  const retry = () => {
    setPhase('checking')
    setAttempt((n) => n + 1)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`cf-gate ${phase === 'leaving' ? 'is-leaving' : ''}`}
    >
      <div className="flex w-full max-w-[380px] flex-col items-start px-5 text-left">
        <p aria-hidden="true" className="font-bagus text-[30px] font-normal leading-none tracking-[-0.02em] text-ink-strong">
          blxr
        </p>

        <div role="status" className="mt-6 min-h-18">
          <p id={titleId} className="text-[15px] font-medium text-ink-strong">{copy.title}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{copy.body}</p>
        </div>

        <div className="mt-6 grid h-[65px] w-[300px] max-w-full">
          <div className="flex h-[65px] items-center gap-2.5 self-start rounded-lg border border-line bg-surface px-4 text-[12.5px] text-ink-subtle [grid-area:1/1]">
            <Spinner />
            Connecting to Cloudflare…
          </div>
          <div ref={box} className="leading-none scheme-light [grid-area:1/1]" />
        </div>

        {phase === 'failed' && (
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex h-9 items-center rounded-[10px] bg-surface-inverted px-4 text-[13px] font-medium text-ink-on-inverted outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
          >
            Try again
          </button>
        )}

        <p className="mt-10 self-stretch border-t border-dashed border-line pt-4 font-mono text-[11px] text-ink-faint">
          Protected by Cloudflare Turnstile
        </p>
      </div>
    </div>
  )
}
