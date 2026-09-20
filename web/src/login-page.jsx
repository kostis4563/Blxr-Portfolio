import { useState, useEffect, useId, useRef } from 'react'
import ThemeToggle from './components/theme-toggle'
import { link, navigate, useRouteHash, HOME_PATH, LOGIN_PATH, REGISTER_PATH, RESET_PATH, UPDATE_PASSWORD_PATH, VERIFY_PATH, DASHBOARD_PATH } from './lib/router'
import { authLogin, authRegister, authRequestReset, authUpdatePassword, authSignOut, authContinueAsGuest, isGuest, mfaRequired, mfaChallenge } from './lib/auth'
import { useAuth, clearRecovery } from './lib/supabase'
import { PASSWORD_MIN, passwordProblem } from './lib/password'
import { Captcha } from './components/captcha'
import { Icon } from './components/icon'
import { LABEL, INPUT, CTA, SWITCH, QUIET, Field, PasswordInput, Strength, Providers, Divider } from './components/auth-ui'

export { PASSWORD_MIN }
const NAME_MAX = 32
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MODES = {
  login: {
    eyebrow: 'Welcome back',
    title: 'Sign in',
    tagline: 'Pick a provider, or use your email and password.',
    cta: 'Sign in',
    busy: 'Signing in…',
  },
  register: {
    eyebrow: 'New here',
    title: 'Create an account',
    tagline: 'Pick a provider, or sign up with an email and password.',
    cta: 'Create account',
    busy: 'Creating account…',
  },
  reset: {
    eyebrow: 'Forgot password',
    title: 'Reset your password',
    tagline: 'Enter your email and we will send you a link to choose a new one.',
    cta: 'Send reset link',
    busy: 'Sending…',
  },
  update: {
    eyebrow: 'Almost there',
    title: 'Choose a new password',
    tagline: 'You are signed in through the reset link. Pick a new password to keep using.',
    cta: 'Update password',
    busy: 'Updating…',
  },
  verify: {
    eyebrow: 'Two-factor authentication',
    title: 'Enter your code',
    tagline: 'Open your authenticator app and type the 6-digit code for blxr.',
    cta: 'Verify',
    busy: 'Verifying…',
  },
}

function modeOf(hash) {
  if (hash === '#register') return 'register'
  if (hash === '#reset') return 'reset'
  if (hash === '#update') return 'update'
  if (hash === '#verify') return 'verify'
  return 'login'
}

function messageFor(err, mode) {
  const code = err?.code
  if (code === 'locked') return `Too many attempts. Try again in ${Math.ceil((err.retryAfter || 900) / 60)} min.`
  if (code === 'wrong_password' || code === 'invalid_credentials') return 'Wrong email or password.'
  if (code === 'email_taken') return 'An account with this email already exists.'
  if (code === 'name_taken') return 'That name is already taken.'
  if (code === 'weak_password') return `Use at least ${PASSWORD_MIN} characters.`
  if (code === 'invalid') return 'Please check the highlighted fields.'
  if (code === 'offline') return 'You appear to be offline.'
  if (code === 'email_not_confirmed') return 'Confirm your email first — check your inbox for the link.'
  if (code === 'same_password') return 'That is already your password. Pick a different one.'
  if (code === 'signup_disabled') return 'Sign-ups are closed right now.'
  if (code === 'provider_disabled') return 'That sign-in method is turned off.'
  if (code === 'link_expired') return 'That link has expired. Request a new one.'
  if (code === 'not_configured') return 'Accounts are not set up on this build yet.'
  if (code === 'bad_code') return 'That code is not right. Codes change every 30 seconds.'
  if (code === 'code_expired') return 'That code expired — enter the current one.'
  if (code === 'no_factor') return 'No authenticator is set up for this account.'
  if (code === 'captcha') return 'The verification check did not pass. Reload the page and try again.'
  if (code === 'guest_disabled') return 'Guest access is turned off right now. Create an account instead.'
  if (mode === 'verify') return 'Could not verify the code.'
  if (mode === 'guest') return 'Could not open a guest session.'
  if (mode === 'login') return 'Could not sign in.'
  if (mode === 'register') return 'Could not create the account.'
  if (mode === 'update') return 'Could not update the password.'
  return 'Could not send the reset link.'
}

function messageForCallback(params) {
  const code = params.get('error_code') || params.get('error')
  if (!code) return null
  if (code === 'access_denied' && !params.get('error_code')) return 'You cancelled the sign-in.'
  if (code === 'otp_expired') return 'That link has expired or was already used. Request a new one.'
  if (code === 'identity_already_exists' || code === 'email_exists') return 'That email is already tied to a different sign-in method.'
  if (code === 'provider_disabled') return 'That sign-in method is turned off.'
  if (code === 'signup_disabled') return 'Sign-ups are closed right now.'
  return 'Sign-in failed. Try again.'
}

function validate(mode, form, accountEmail = '') {
  const errors = {}
  if (mode === 'verify') {
    if (!/^\d{6}$/.test(form.code.replace(/\s+/g, ''))) errors.code = 'Enter the 6-digit code.'
    return errors
  }
  if (mode === 'register') {
    const name = form.name.trim()
    if (!name) errors.name = 'Enter a name.'
    else if (name.length > NAME_MAX) errors.name = `Keep it under ${NAME_MAX} characters.`
  }
  if (mode !== 'update' && !EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email.'
  if (mode !== 'reset') {
    if (!form.password) errors.password = mode === 'update' ? 'Enter a new password.' : 'Enter your password.'
    else if (mode !== 'login') {
      const problem = passwordProblem(form.password, { email: form.email || accountEmail, name: form.name })
      if (problem) errors.password = problem
    }
  }
  if (mode !== 'login' && mode !== 'reset' && form.confirm !== form.password) errors.confirm = 'Passwords do not match.'
  return errors
}

const PERKS = [
  { icon: 'kanban', title: 'Boards', body: 'Columns, cards and due dates. Private to you.' },
  { icon: 'message', title: 'A line to me', body: 'One private thread, straight to the owner.' },
  { icon: 'user', title: 'Your page', body: 'blxr.net/u/you — links, skills, what you are up to.' },
]

function Perks() {
  return (
    <ul className="flex flex-col">
      {PERKS.map((perk, i) => (
        <li key={perk.title} className="flex items-start gap-3.5 border-t border-dashed border-line py-3.5 first:border-t-0 first:pt-0">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-raised/60 text-ink-muted">
            <Icon name={perk.icon} className="h-[14px] w-[14px]" />
          </span>
          <span className="min-w-0">
            <span className="flex items-baseline gap-2">
              <span className="text-[13.5px] font-semibold text-ink-strong">{perk.title}</span>
              <span className="font-mono text-[10px] text-ink-faint">0{i + 1}</span>
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">{perk.body}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function GuestDoor({ onClick, busy, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-dashed border-line-strong px-4 py-3.5 text-left outline-none transition-colors hover:border-ink-strong/60 hover:bg-surface-raised/40 focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong font-semibold text-ink-subtle transition-colors group-hover:text-ink-strong">?</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-ink-strong">{busy ? 'Opening a guest session…' : 'Just looking? Continue as guest'}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">No email. Try one board, claim it as yours whenever you like.</span>
      </span>
      <span aria-hidden="true" className="text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </button>
  )
}

function Notice({ title, children, tone = 'ok' }) {
  const ring = tone === 'ok' ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-line bg-surface'
  return (
    <div className={`mt-6 rounded-xl border px-4 py-3.5 text-[12.5px] leading-relaxed text-ink ${ring}`}>
      <p className="font-medium text-ink-strong">{title}</p>
      <p className="mt-1 text-ink-muted">{children}</p>
    </div>
  )
}

const EMPTY = { name: '', email: '', password: '', confirm: '', code: '', remember: true }

const safeNext = (to) => (to && /^\/(?![/\\])/.test(to) && !to.includes('\\') && !to.startsWith(LOGIN_PATH) ? to : null)

export default function LoginPage({ theme, onToggleTheme }) {
  const hash = useRouteHash()
  const mode = modeOf(hash)
  const copy = MODES[mode]
  const id = useId()
  const { session, recovery } = useAuth()
  const guest = isGuest(session?.user)

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [next, setNext] = useState(DASHBOARD_PATH)
  const [leaving, setLeaving] = useState(false)
  const [guestBusy, setGuestBusy] = useState(false)
  const captcha = useRef(null)

  useEffect(() => {
    setForm((f) => ({ ...EMPTY, email: f.email }))
    setErrors({})
    setError(null)
    setNotice(null)
  }, [mode])

  useEffect(() => {
    const url = new URL(window.location.href)
    const params = url.searchParams
    const fromHash = new URLSearchParams(url.hash.startsWith('#') && url.hash.includes('=') ? url.hash.slice(1) : '')
    const to = safeNext(params.get('next'))
    if (to) setNext(to)
    const message = messageForCallback(params) || messageForCallback(fromHash)
    if (message) {
      setError(message)
      for (const key of ['error', 'error_code', 'error_description']) params.delete(key)
      const cleanHash = fromHash.has('error') ? '' : url.hash
      window.history.replaceState(null, '', `${url.pathname}${params.size ? `?${params}` : ''}${cleanHash}`)
    }
  }, [])

  useEffect(() => {
    if (recovery && mode !== 'update') navigate(UPDATE_PASSWORD_PATH, { replace: true })
  }, [recovery, mode])

  useEffect(() => {
    if (!session || recovery || mode === 'update' || leaving) return
    if (guest && (mode === 'login' || mode === 'register' || mode === 'reset')) return
    let cancelled = false
    mfaRequired().then((needed) => {
      if (cancelled) return
      if (needed) {
        if (mode !== 'verify') navigate(VERIFY_PATH, { replace: true })
        return
      }
      setLeaving(true)
      navigate(next, { replace: true })
    })
    return () => { cancelled = true }
  }, [session, recovery, mode, next, leaving, guest])

  useEffect(() => {
    if (mode === 'verify' && session === null) navigate(LOGIN_PATH, { replace: true })
  }, [mode, session])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const fail = (err) => {
    setError(messageFor(err, mode))
    if (Array.isArray(err?.fields) && err.fields.length) {
      const note = err.code === 'email_taken' ? 'Already in use.' : err.code === 'weak_password' ? `Use at least ${PASSWORD_MIN} characters.` : 'Check this field.'
      setErrors(Object.fromEntries(err.fields.map((field) => [field, note])))
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const nextErrors = validate(mode, form, session?.user?.email || '')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setBusy(true)
    setError(null)
    const email = form.email.trim()
    try {
      const captchaToken = captcha.current && mode !== 'update' && mode !== 'verify' ? await captcha.current.run() : undefined
      if (mode === 'login') {
        await authLogin({ email, password: form.password, remember: form.remember, captchaToken })
        setLeaving(true)
        navigate(next, { replace: true })
      } else if (mode === 'register') {
        const { confirmed } = await authRegister({ name: form.name.trim(), email, password: form.password, captchaToken })
        if (confirmed) {
          setLeaving(true)
          navigate(next, { replace: true })
        } else {
          setNotice({ kind: 'confirm', email })
        }
      } else if (mode === 'update') {
        await authUpdatePassword(form.password)
        setLeaving(true)
        navigate(next, { replace: true })
      } else if (mode === 'verify') {
        await mfaChallenge(form.code)
        setLeaving(true)
        navigate(next, { replace: true })
      } else {
        await authRequestReset(email, { captchaToken })
        setNotice({ kind: 'reset', email })
      }
    } catch (err) {
      fail(err)
      setForm((f) => ({ ...f, password: '', confirm: '', code: '' }))
    } finally {
      setBusy(false)
    }
  }

  const continueAsGuest = async () => {
    if (busy || guestBusy) return
    setGuestBusy(true)
    setError(null)
    try {
      const captchaToken = captcha.current ? await captcha.current.run() : undefined
      await authContinueAsGuest({ captchaToken })
      setLeaving(true)
      navigate(next, { replace: true })
    } catch (err) {
      setError(messageFor(err, 'guest'))
    } finally {
      setGuestBusy(false)
    }
  }

  const wide = mode === 'login' || mode === 'register'

  const updateLocked = mode === 'update' && session === null
  const tagline =
    mode !== 'update' ? copy.tagline
    : updateLocked ? 'Reset links only work once and expire after an hour.'
    : recovery ? copy.tagline
    : 'Pick a new password for your account.'

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a {...link(HOME_PATH)} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer">
            <span>←</span>
            <span>Home</span>
          </a>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} className="text-ink-muted hover:text-ink-strong transition-colors duration-200" />
        </div>
      </header>

      <main className={`mx-auto flex min-h-screen w-full max-w-[960px] flex-1 px-5 pt-20 pb-16 animate-rise-in sm:px-8 ${wide ? 'flex-col justify-center md:grid md:grid-cols-[minmax(0,1fr)_400px] md:items-center md:gap-14' : 'items-center justify-center'}`}>
        {wide && (
          <section className="mb-10 md:mb-0">
            <p className={`${LABEL} mb-3`}>{copy.eyebrow}</p>
            <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-strong sm:text-[38px]">{copy.title}</h1>
            <p className="mt-3 max-w-[380px] text-[14px] leading-relaxed text-ink-muted">{tagline}</p>
            <div className="mt-8 hidden md:block">
              <p className={`${LABEL} mb-4`}>What an account is for</p>
              <Perks />
            </div>
            {!guest && (
              <div className="mt-8 hidden md:block">
                <GuestDoor onClick={continueAsGuest} busy={guestBusy} disabled={busy || guestBusy} />
              </div>
            )}
          </section>
        )}

        <form
          key={mode}
          onSubmit={submit}
          noValidate
          aria-busy={leaving || undefined}
          className={`w-full max-w-[400px] rounded-2xl border border-line bg-surface-raised/40 p-7 transition-opacity ${wide ? 'mx-auto md:mx-0' : ''} ${leaving ? 'pointer-events-none opacity-60' : ''}`}
        >
          {!wide && (
            <>
              <p className={`${LABEL} mb-2`}>{copy.eyebrow}</p>
              <h1 className="text-[24px] font-bold tracking-tight text-ink-strong">{copy.title}</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{tagline}</p>
            </>
          )}

          {notice?.kind === 'reset' ? (
            <Notice title="Check your inbox">
              If an account exists for <span className="text-ink-strong">{notice.email}</span>, a reset link is on its way. Open it in this browser — it expires in an hour.
            </Notice>
          ) : notice?.kind === 'confirm' ? (
            <Notice title="Confirm your email">
              We sent a link to <span className="text-ink-strong">{notice.email}</span>. Open it to activate the account, then sign in.
            </Notice>
          ) : updateLocked ? (
            <Notice title="That link has expired" tone="plain">
              Open the reset link from your email in this browser, or request a new one.
            </Notice>
          ) : (
            <>
              {guest && (mode === 'login' || mode === 'register') && (
                <div className="mb-6 rounded-xl border border-line bg-surface px-4 py-3.5 text-[12.5px] leading-relaxed">
                  <p className="font-medium text-ink-strong">You are browsing as a guest.</p>
                  <p className="mt-1 text-ink-muted">
                    Signing in here switches to that account and leaves your guest board behind. To keep it,{' '}
                    <a {...link(`${DASHBOARD_PATH}#claim`)} className={SWITCH}>claim the guest account</a> instead.
                  </p>
                </div>
              )}

              {(mode === 'login' || mode === 'register') && (
                <div className="flex flex-col gap-5">
                  <Providers next={next} disabled={busy} onStart={() => setError(null)} onError={fail} />
                  <Divider>or with email</Divider>
                </div>
              )}

              <div className={`${mode === 'login' || mode === 'register' ? 'mt-5' : 'mt-6'} flex flex-col gap-4`}>
                {mode === 'verify' && (
                  <Field label="Verification code" error={errors.code}>
                    <input
                      id={`${id}-code`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={7}
                      autoFocus
                      placeholder="123 456"
                      value={form.code}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d\s]/g, '')
                        setForm((f) => ({ ...f, code: value }))
                        if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }))
                      }}
                      aria-invalid={Boolean(errors.code) || undefined}
                      className={`${INPUT} font-mono tracking-[0.25em]`}
                    />
                  </Field>
                )}

                {mode === 'register' && (
                  <Field label="Name" error={errors.name}>
                    <input
                      id={`${id}-name`}
                      type="text"
                      autoComplete="nickname"
                      autoFocus
                      maxLength={NAME_MAX}
                      value={form.name}
                      onChange={set('name')}
                      aria-invalid={Boolean(errors.name) || undefined}
                      className={INPUT}
                    />
                  </Field>
                )}

                {mode !== 'update' && mode !== 'verify' && (
                  <Field label="Email" error={errors.email}>
                    <input
                      id={`${id}-email`}
                      type="email"
                      autoComplete="email"
                      autoFocus={mode !== 'register'}
                      inputMode="email"
                      spellCheck={false}
                      value={form.email}
                      onChange={set('email')}
                      aria-invalid={Boolean(errors.email) || undefined}
                      className={INPUT}
                    />
                  </Field>
                )}

                {mode !== 'reset' && mode !== 'verify' && (
                  <Field
                    label={mode === 'update' ? 'New password' : 'Password'}
                    error={errors.password}
                    hint={
                      mode === 'login' ? (
                        <a {...link(RESET_PATH)} className={QUIET}>Forgot password?</a>
                      ) : (
                        <span className="text-[11px] text-ink-faint">{PASSWORD_MIN}+ characters</span>
                      )
                    }
                  >
                    <PasswordInput
                      id={`${id}-password`}
                      value={form.password}
                      onChange={set('password')}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      autoFocus={mode === 'update'}
                      invalid={Boolean(errors.password)}
                    />
                    {mode !== 'login' && form.password && <Strength password={form.password} />}
                  </Field>
                )}

                {(mode === 'register' || mode === 'update') && (
                  <Field label="Confirm password" error={errors.confirm}>
                    <PasswordInput
                      id={`${id}-confirm`}
                      value={form.confirm}
                      onChange={set('confirm')}
                      autoComplete="new-password"
                      invalid={Boolean(errors.confirm)}
                    />
                  </Field>
                )}

                {mode === 'login' && (
                  <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-ink-muted">
                    <input
                      type="checkbox"
                      checked={form.remember}
                      onChange={set('remember')}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-line accent-ink-strong"
                    />
                    Keep me signed in
                  </label>
                )}
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-3.5 py-2.5 text-[12.5px] text-red-500">
                  {error}
                </p>
              )}

              {(mode === 'login' || mode === 'register' || mode === 'reset') && <Captcha handle={captcha} />}

              <button type="submit" disabled={busy || guestBusy} className={`${CTA} mt-6`}>
                <span>{busy ? copy.busy : copy.cta}</span>
                {!busy && <span aria-hidden="true">→</span>}
              </button>

              {mode === 'login' && !guest && (
                <div className="mt-4 text-center md:hidden">
                  <button
                    type="button"
                    onClick={continueAsGuest}
                    disabled={busy || guestBusy}
                    className="cursor-pointer text-[12.5px] text-ink-muted transition-colors hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {guestBusy ? 'Opening a guest session…' : <>Just looking? <span className={SWITCH}>Continue as guest</span></>}
                  </button>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
                    No email needed. You can try a board and claim it as yours later.
                  </p>
                </div>
              )}

              {mode === 'login' && guest && (
                <p className="mt-4 text-center text-[12px] text-ink-muted">
                  Or{' '}
                  <a {...link(DASHBOARD_PATH)} className={SWITCH}>back to the dashboard</a> as a guest.
                </p>
              )}
            </>
          )}

          <p className="mt-5 text-center text-[12.5px] text-ink-muted">
            {mode === 'login' ? (
              <>
                No account yet?{' '}
                <a {...link(REGISTER_PATH)} className={SWITCH}>Create one</a>
              </>
            ) : mode === 'register' ? (
              <>
                Already have an account?{' '}
                <a {...link(LOGIN_PATH)} className={SWITCH}>Sign in</a>
              </>
            ) : mode === 'verify' ? (
              <>
                Not you?{' '}
                <a {...link(LOGIN_PATH, async () => { await authSignOut(); navigate(LOGIN_PATH, { replace: true }) })} className={SWITCH}>Sign out</a>
              </>
            ) : mode === 'update' ? (
              updateLocked ? (
                <>
                  Need a new link?{' '}
                  <a {...link(RESET_PATH)} className={SWITCH}>Request one</a>
                </>
              ) : (
                <>
                  Changed your mind?{' '}
                  <a {...link(next, () => { clearRecovery(); navigate(next, { replace: true }) })} className={SWITCH}>Skip for now</a>
                </>
              )
            ) : (
              <>
                Remembered it?{' '}
                <a {...link(LOGIN_PATH)} className={SWITCH}>Back to sign in</a>
              </>
            )}
          </p>
        </form>
      </main>
    </div>
  )
}
