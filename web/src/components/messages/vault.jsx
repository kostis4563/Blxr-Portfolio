import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { BTN_BARE, BTN_QUIET, BTN_RISK, BTN_SOLID, CAPS, CARD, INPUT, Note } from '../boards/ui'
import { Loading, Spinner } from '../skeleton'
import { passwordProblem, strengthOf } from '../../lib/password'
import { SUITE } from '../../lib/messages-crypto'
import * as api from '../../lib/messages-api'

const STRENGTH = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

function Field({ label, value, onChange, autoFocus, autoComplete, invalid }) {
  const [shown, setShown] = useState(false)
  return (
    <label className="block">
      <span className={CAPS}>{label}</span>
      <span className="relative mt-1.5 block">
        <input
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          className={`${INPUT} h-9 pr-9 font-mono`}
        />
        <button
          type="button"
          onClick={() => setShown((held) => !held)}
          aria-label={shown ? 'Hide passphrase' : 'Show passphrase'}
          className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-ink-faint hover:text-ink-strong"
        >
          <Icon name={shown ? 'eyeOff' : 'eye'} className="h-3.5 w-3.5" />
        </button>
      </span>
    </label>
  )
}

function Suite() {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line pt-4 text-left">
      {[
        ['Key exchange', SUITE.agreement],
        ['Derivation', SUITE.derivation],
        ['Cipher', SUITE.cipher],
        ['Passphrase', SUITE.wrap],
      ].map(([what, how]) => (
        <li key={what} className="min-w-0">
          <span className="block text-[10.5px] uppercase tracking-wider text-ink-faint">{what}</span>
          <span className="block truncate font-mono text-[11.5px] text-ink-secondary">{how}</span>
        </li>
      ))}
    </ul>
  )
}

function Frame({ icon, title, blurb, children }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4">
      <div className={`${CARD} w-full max-w-[420px] p-6 text-center animate-rise-in`}>
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface-raised">
          <Icon name={icon} className="h-5 w-5 text-ink-strong" />
        </span>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink-strong">{title}</h2>
        <p className="mx-auto mt-1 max-w-[340px] text-[12.5px] leading-relaxed text-ink-muted">{blurb}</p>
        <div className="mt-5 text-left">{children}</div>
        <Suite />
      </div>
    </div>
  )
}

function Create({ resetting, onDone, onCancel }) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [understood, setUnderstood] = useState(false)

  const problem = first ? passwordProblem(first) : null
  const mismatch = second && first !== second
  const ready = !busy && first && !problem && first === second && understood
  const strength = strengthOf(first)

  const submit = async (event) => {
    event.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await api.createKey(first)
      onDone()
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return (
    <Frame
      icon={resetting ? 'refresh' : 'shield'}
      title={resetting ? 'Make a new key' : 'Encrypt your messages'}
      blurb={
        resetting
          ? 'A new key replaces the old one everywhere. Messages sealed with the old key stay unreadable — that is the point of encryption.'
          : 'Messages here are end-to-end encrypted. Pick a passphrase to protect your key — it never leaves this browser, and nobody (not even the server) can read what you write.'
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Passphrase" value={first} onChange={setFirst} autoFocus autoComplete="new-password" invalid={Boolean(problem)} />
        {first && (
          <div className="-mt-1 flex items-center gap-2">
            <span className="flex flex-1 gap-1">
              {[1, 2, 3, 4].map((step) => (
                <span key={step} className={`h-1 flex-1 rounded-full ${strength >= step ? 'bg-ink-strong' : 'bg-line'}`} />
              ))}
            </span>
            <span className="w-16 text-right text-[11px] text-ink-subtle">{STRENGTH[strength]}</span>
          </div>
        )}
        {problem && <p className="-mt-1 text-[11.5px] text-red-500">{problem}</p>}
        <Field label="Repeat it" value={second} onChange={setSecond} autoComplete="new-password" invalid={Boolean(mismatch)} />
        {mismatch && <p className="-mt-1 text-[11.5px] text-red-500">The two do not match.</p>}
        <label className="mt-1 flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
          <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} className="mt-0.5 cursor-pointer accent-current" />
          <span>I understand there is no recovery: forget this passphrase and my messages cannot be decrypted on a new device.</span>
        </label>
        {error && <Note tone="error">{error}</Note>}
        <div className="mt-1 flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={busy} className={`${BTN_QUIET} h-9 flex-1`}>
              Back
            </button>
          )}
          <button type="submit" disabled={!ready} className={`${BTN_SOLID} h-9 flex-1`}>
            {busy ? <><Spinner className="h-3.5 w-3.5" /> Generating key…</> : <><Icon name="key" className="h-3.5 w-3.5" /> {resetting ? 'Replace my key' : 'Create my key'}</>}
          </button>
        </div>
      </form>
    </Frame>
  )
}

function Unlock({ onDone, onReset }) {
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    if (!phrase || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.unlockKey(phrase)
      onDone()
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return (
    <Frame icon="lock" title="Unlock your messages" blurb="Your conversation is end-to-end encrypted. Enter your passphrase once to unlock it on this device.">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Passphrase" value={phrase} onChange={setPhrase} autoFocus autoComplete="current-password" invalid={Boolean(error)} />
        {error && <Note tone="error">{error}</Note>}
        <button type="submit" disabled={!phrase || busy} className={`${BTN_SOLID} h-9`}>
          {busy ? <><Spinner className="h-3.5 w-3.5" /> Unlocking…</> : <><Icon name="lock" className="h-3.5 w-3.5" /> Unlock</>}
        </button>
        <button type="button" onClick={onReset} disabled={busy} className={`${BTN_BARE} h-8 text-[12px]`}>
          Forgot it? Make a new key
        </button>
      </form>
    </Frame>
  )
}

function ConfirmReset({ onConfirm, onCancel }) {
  return (
    <Frame icon="alert" title="Replace your key?" blurb="Without the passphrase, the old key cannot be opened by anyone — including you. Every message sealed with it stays encrypted for good.">
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className={`${BTN_QUIET} h-9 flex-1`}>
          Keep trying
        </button>
        <button type="button" onClick={onConfirm} className={`${BTN_RISK} h-9 flex-1`}>
          Replace it
        </button>
      </div>
    </Frame>
  )
}

function Gate({ status, step, setStep, check }) {
  if (status.state === 'unsupported') {
    return <Frame icon="alert" title="This browser cannot encrypt" blurb="Messages need Web Crypto and IndexedDB. Open the dashboard in an up-to-date browser, outside private mode." />
  }
  if (status.state === 'missing') return <Create onDone={check} />
  if (step === 'confirm') return <ConfirmReset onConfirm={() => setStep('reset')} onCancel={() => setStep(null)} />
  if (step === 'reset') return <Create resetting onDone={check} onCancel={() => setStep(null)} />
  return <Unlock onDone={check} onReset={() => setStep('confirm')} />
}

export default function Vault({ shell, children }) {
  const [status, setStatus] = useState(null)
  const [step, setStep] = useState(null)
  const [error, setError] = useState(null)

  const check = useCallback(() => {
    setError(null)
    api.keyStatus().then(
      (next) => {
        setStatus(next)
        setStep(null)
      },
      (failure) => setError(failure),
    )
  }, [])

  useEffect(check, [check])

  if (error) {
    return shell(
      <div className="w-full p-4">
        <Note tone="error">
          {error.message}{' '}
          <button type="button" onClick={check} className="cursor-pointer font-medium underline underline-offset-2">
            Try again
          </button>
        </Note>
      </div>,
    )
  }
  if (!status) return <Loading label="Checking your key" />
  if (status.state === 'ready') return children({ relock: check })
  return shell(<Gate status={status} step={step} setStep={setStep} check={check} />)
}
