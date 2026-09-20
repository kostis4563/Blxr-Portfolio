import { useState, useEffect, useId, useCallback } from 'react'
import { Icon } from './icon'
import { Modal, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST } from './settings-ui'
import { Field, PasswordInput, Strength, Providers, Divider, INPUT, SWITCH } from './auth-ui'
import { link, LOGIN_PATH, DASHBOARD_PATH } from '../lib/router'
import { authClaimWithPassword, authClaimWith, GUEST_BOARD_LIMIT } from '../lib/auth'
import { PASSWORD_MIN, passwordProblem } from '../lib/password'
import { fetchBoards } from '../lib/boards-api'
import { lockedCopyFor } from '../lib/guest'

const NAME_MAX = 32
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function messageFor(err) {
  const code = err?.code
  if (code === 'email_taken') return 'An account with this email already exists — sign in to it instead.'
  if (code === 'weak_password') return `Use at least ${PASSWORD_MIN} characters.`
  if (code === 'locked') return 'Too many attempts. Give it a few minutes.'
  if (code === 'offline') return 'You appear to be offline.'
  if (code === 'invalid') return 'Please check the highlighted fields.'
  if (code === 'linking_disabled') return 'Provider sign-in is not available for guests on this project. Use an email instead.'
  if (code === 'provider_disabled') return 'That sign-in method is turned off.'
  if (code === 'identity_taken') return 'That account is already tied to a different member.'
  if (code === 'not_configured') return 'Accounts are not set up on this build yet.'
  return 'Could not claim the account. Try again.'
}

export function useGuestWork(hash) {
  const [boards, setBoards] = useState(null)
  useEffect(() => {
    if (hash === null) return undefined
    let cancelled = false
    const load = () => fetchBoards().then((rows) => { if (!cancelled) setBoards(rows) }).catch(() => {})
    load()
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      window.removeEventListener('focus', load)
    }
  }, [hash])
  return boards
}

export function GuestBar({ user, boards, onClaim }) {
  const made = boards?.[0] || null
  const pending = user.pendingEmail
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed border-line-strong bg-surface px-4 py-2.5 text-[12.5px] leading-snug animate-rise-in"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <Icon name={pending ? 'mail' : made ? 'save' : 'eye'} className="h-4 w-4 shrink-0 text-ink-subtle" />
        {pending ? (
          <span className="text-ink-muted">
            Almost yours — open the link we sent to <span className="font-medium text-ink-strong">{pending}</span> and this becomes a member account.
          </span>
        ) : made ? (
          <span className="text-ink-muted">
            <span className="font-medium text-ink-strong">{made.name}</span> only exists in this browser. Claim the account to keep it on every device.
          </span>
        ) : (
          <span className="text-ink-muted">
            You are browsing as a guest. Try a board — you can claim it as yours whenever you like.
          </span>
        )}
      </span>
      <button type="button" onClick={onClaim} className={`${made || pending ? BTN_PRIMARY : BTN_SECONDARY} h-7 px-2.5 text-[12px]`}>
        {pending ? 'Use a different email' : made ? 'Keep my work' : 'Claim account'}
      </button>
    </div>
  )
}

export function MembersOnly({ path, onClaim }) {
  const copy = lockedCopyFor(path)
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-line bg-surface px-6 py-12 text-center animate-rise-in">
      <span className="mb-4 grid h-10 w-10 place-items-center rounded-full border border-dashed border-line-strong text-ink-subtle">
        <Icon name="lock" className="h-4 w-4" />
      </span>
      <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-subtle">Members only</p>
      <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-ink-strong">{copy.title}</h2>
      <p className="mt-2 max-w-[400px] text-[13px] leading-relaxed text-ink-muted">{copy.why}</p>
      <ul className="mt-5 flex flex-col gap-1.5 text-left text-[12.5px] text-ink">
        {copy.points.map((point) => (
          <li key={point} className="flex items-center gap-2.5">
            <Icon name="check" className="h-3.5 w-3.5 text-ink-subtle" />
            {point}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onClaim} className={BTN_PRIMARY}>
          <Icon name="key" className="h-3.5 w-3.5" />
          Claim this account
        </button>
        <a {...link(LOGIN_PATH)} className={BTN_GHOST}>Already a member? Sign in</a>
      </div>
      <p className="mt-4 text-[11.5px] text-ink-faint">Your guest board comes with you — same account, just with a name on it.</p>
    </div>
  )
}

export function GuestBoardCap({ onClaim, max }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted">
      <span>
        Guests keep {GUEST_BOARD_LIMIT === 1 ? 'one board' : `${GUEST_BOARD_LIMIT} boards`}; members keep up to {max}.
      </span>
      <button type="button" onClick={onClaim} className={SWITCH}>Claim the account</button>
    </p>
  )
}

const EMPTY = { name: '', email: '', password: '' }

function validate(form) {
  const errors = {}
  const name = form.name.trim()
  if (!name) errors.name = 'Enter a name.'
  else if (name.length > NAME_MAX) errors.name = `Keep it under ${NAME_MAX} characters.`
  if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email.'
  if (!form.password) errors.password = 'Choose a password.'
  else {
    const problem = passwordProblem(form.password, { email: form.email, name })
    if (problem) errors.password = problem
  }
  return errors
}

export function ClaimDialog({ open, onClose, boards }) {
  const id = useId()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setErrors({})
    setError(null)
    setBusy(false)
    setSent(null)
  }, [open])

  const set = (key) => (e) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const fail = useCallback((err) => {
    setError(messageFor(err))
    if (err?.code === 'email_taken') setErrors({ email: 'Already in use.' })
    else if (err?.code === 'weak_password') setErrors({ password: `Use at least ${PASSWORD_MIN} characters.` })
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setBusy(true)
    setError(null)
    try {
      const email = form.email.trim()
      await authClaimWithPassword({ name: form.name.trim(), email, password: form.password })
      setSent(email)
    } catch (err) {
      fail(err)
      setForm((f) => ({ ...f, password: '' }))
    } finally {
      setBusy(false)
    }
  }

  const made = boards?.length || 0
  const description = sent
    ? null
    : made
      ? `Add a sign-in to this guest account and ${made === 1 ? 'your board stays' : `all ${made} boards stay`} exactly where ${made === 1 ? 'it is' : 'they are'} — same account, now yours anywhere.`
      : 'Add a sign-in to this guest account. Anything you make from here on is saved to it and follows you to any device.'

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={sent ? 'Check your inbox' : made ? 'Keep what you made' : 'Make this account yours'}
      description={description}
      footer={
        sent ? (
          <button type="button" onClick={onClose} className={BTN_PRIMARY}>Done</button>
        ) : (
          <>
            <button type="button" onClick={onClose} disabled={busy} className={BTN_GHOST}>Not now</button>
            <button type="submit" form={`${id}-form`} disabled={busy} className={BTN_PRIMARY}>
              {busy ? 'Saving…' : 'Claim account'}
            </button>
          </>
        )
      }
    >
      {sent ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3.5 text-[12.5px] leading-relaxed">
          <p className="text-ink-muted">
            We sent a link to <span className="font-medium text-ink-strong">{sent}</span>. Open it in this browser and the account is a member account — nothing else to do, and everything here stays put.
          </p>
        </div>
      ) : (
        <form id={`${id}-form`} onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Providers next={DASHBOARD_PATH} disabled={busy} onStart={() => setError(null)} onError={fail} action={authClaimWith} verb="Keep going" />
          <Divider>or with email</Divider>

          <Field label="Name" error={errors.name}>
            <input
              id={`${id}-name`}
              type="text"
              autoComplete="nickname"
              data-autofocus
              maxLength={NAME_MAX}
              value={form.name}
              onChange={set('name')}
              aria-invalid={Boolean(errors.name) || undefined}
              className={INPUT}
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              value={form.email}
              onChange={set('email')}
              aria-invalid={Boolean(errors.email) || undefined}
              className={INPUT}
            />
          </Field>
          <Field label="Password" error={errors.password} hint={<span className="text-[11px] text-ink-faint">{PASSWORD_MIN}+ characters</span>}>
            <PasswordInput
              id={`${id}-password`}
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              invalid={Boolean(errors.password)}
            />
            {form.password && <Strength password={form.password} />}
          </Field>

          {error && (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-3.5 py-2.5 text-[12.5px] text-red-500">
              {error}
            </p>
          )}

          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            Already have an account?{' '}
            <a {...link(LOGIN_PATH)} className={SWITCH}>Sign in</a> — note that your guest board stays with the guest account, not the one you sign in to.
          </p>
        </form>
      )}
    </Modal>
  )
}
