import { useState, useEffect, useId, useRef } from 'react'
import ThemeToggle from './components/theme-toggle'
import { link, navigate, useRouteHash, HOME_PATH, LOGIN_PATH, REGISTER_PATH, RESET_PATH, UPDATE_PASSWORD_PATH, VERIFY_PATH, DASHBOARD_PATH } from './lib/router'
import { authLogin, authRegister, authRequestReset, authUpdatePassword, authSignInWith, authSignOut, mfaRequired, mfaChallenge, AUTH_PROVIDERS } from './lib/auth'
import { useAuth, clearRecovery } from './lib/supabase'
import { SOCIAL_ICON_PATHS } from './lib/profile'
import { PASSWORD_MIN, passwordProblem, strengthOf } from './lib/password'
import { Captcha } from './components/captcha'

const LABEL = 'text-[11px] font-mono font-semibold text-ink-subtle uppercase tracking-wider'
const INPUT =
  'w-full rounded-xl border border-line bg-surface-raised/60 px-3.5 py-2.5 text-[13.5px] text-ink-strong placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-line-strong focus:bg-surface focus:outline-none aria-[invalid=true]:border-red-500/60'
const CTA =
  'inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-surface-inverted px-5 text-[13px] font-medium text-ink-on-inverted outline-none transition-[transform,opacity] duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0'
const PROVIDER =
  'flex h-10 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-raised/60 text-ink-muted outline-none transition-colors duration-200 hover:border-line-strong hover:text-ink-strong focus-visible:border-line-strong focus-visible:text-ink-strong'
const SWITCH = 'cursor-pointer font-medium text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-strong'
const QUIET = 'cursor-pointer text-[11px] text-ink-subtle transition-colors hover:text-ink-strong'

export { PASSWORD_MIN }
const NAME_MAX = 32
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PROVIDER_ICONS = {
  google:
    'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  discord: SOCIAL_ICON_PATHS.Discord,
  github: SOCIAL_ICON_PATHS.GitHub,
}
const PROVIDER_NAMES = { google: 'Google', discord: 'Discord', github: 'GitHub' }

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
  if (mode === 'verify') return 'Could not verify the code.'
  if (mode === 'login') return 'Could not sign in.'
  if (mode === 'register') return 'Could not create the account.'
  if (mode === 'update') return 'Could not update the password.'
  return 'Could not send the reset link.'
}

// Supabase bounces failed links and provider sign-ins back with ?error=…&error_code=…
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

const STRENGTH_LABEL = ['', 'Weak', 'Okay', 'Good', 'Strong']
const STRENGTH_COLOR = ['', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-500']

function Field({ label, error, hint, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <span className={LABEL}>{label}</span>
        {hint}
      </span>
      {children}
      {error && <span role="alert" className="text-[12px] text-red-500">{error}</span>}
    </label>
  )
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, autoFocus }) {
  const [shown, setShown] = useState(false)
  const [caps, setCaps] = useState(false)
  const watchCaps = (e) => setCaps(Boolean(e.getModifierState?.('CapsLock')))
  return (
    <>
      <span className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          onKeyDown={watchCaps}
          onKeyUp={watchCaps}
          onBlur={() => setCaps(false)}
          aria-invalid={invalid || undefined}
          className={`${INPUT} pe-16`}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          className="absolute inset-y-0 end-0 cursor-pointer px-3.5 font-mono text-[11px] uppercase tracking-wider text-ink-subtle transition-colors hover:text-ink-strong"
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </span>
      {caps && <span className="text-[11px] text-amber-500">Caps Lock is on.</span>}
    </>
  )
}

function Strength({ password }) {
  const score = strengthOf(password)
  return (
    <span className="flex items-center gap-2" aria-live="polite">
      <span className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= score ? STRENGTH_COLOR[score] : 'bg-surface-hover'}`} />
        ))}
      </span>
      <span className="w-[6ch] text-right font-mono text-[10px] uppercase tracking-wider text-ink-faint">{STRENGTH_LABEL[score]}</span>
    </span>
  )
}

function Providers({ next, disabled, onStart, onError }) {
  const [pending, setPending] = useState(null)
  // Back from the provider restores this page from bfcache with `pending` still set.
  useEffect(() => {
    const onShow = (e) => { if (e.persisted) setPending(null) }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])
  const go = async (provider) => {
    if (pending) return
    setPending(provider)
    onStart?.()
    try {
      await authSignInWith(provider, next)
      // Supabase now owns the page; it navigates to the provider.
    } catch (err) {
      setPending(null)
      onError?.(err)
    }
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {AUTH_PROVIDERS.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => go(provider)}
          disabled={disabled || Boolean(pending)}
          className={`${PROVIDER} disabled:cursor-not-allowed disabled:opacity-50 ${pending === provider ? 'border-line-strong text-ink-strong' : ''}`}
          aria-label={`Continue with ${PROVIDER_NAMES[provider]}`}
          title={`Continue with ${PROVIDER_NAMES[provider]}`}
        >
          <svg className="h-[16px] w-[16px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d={PROVIDER_ICONS[provider]} />
          </svg>
        </button>
      ))}
    </div>
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

function Divider({ children }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 border-t border-dashed border-line" />
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{children}</span>
      <span className="h-px flex-1 border-t border-dashed border-line" />
    </div>
  )
}

const EMPTY = { name: '', email: '', password: '', confirm: '', code: '', remember: true }

// Same-origin paths only: no `//host`, no backslashes (browsers read `/\host` as
// `//host`), and never /login itself, which would strand the user on the form.
const safeNext = (to) => (to && /^\/(?![/\\])/.test(to) && !to.includes('\\') && !to.startsWith(LOGIN_PATH) ? to : null)

export default function LoginPage({ theme, onToggleTheme }) {
  const hash = useRouteHash()
  const mode = modeOf(hash)
  const copy = MODES[mode]
  const id = useId()
  const { session, recovery } = useAuth()

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [next, setNext] = useState(DASHBOARD_PATH)
  const [leaving, setLeaving] = useState(false)
  const captcha = useRef(null)

  // Keep the email when hopping between forms; drop everything else.
  useEffect(() => {
    setForm((f) => ({ ...EMPTY, email: f.email }))
    setErrors({})
    setError(null)
    setNotice(null)
  }, [mode])

  // Supabase (or a guarded page) lands here with ?next=… and maybe an error.
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

  // A reset link signs the user in and flags recovery: send them to the new-password form.
  useEffect(() => {
    if (recovery && mode !== 'update') navigate(UPDATE_PASSWORD_PATH, { replace: true })
  }, [recovery, mode])

  // Already signed in (or just finished an OAuth round-trip)? Move along —
  // unless two-factor is on and this session has not passed it yet.
  useEffect(() => {
    if (!session || recovery || mode === 'update' || leaving) return
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
  }, [session, recovery, mode, next, leaving])

  // #verify with nothing to verify: back to the sign-in form.
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

  // #update without a reset session: nothing to update.
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

      <main className="flex min-h-screen w-full flex-1 items-center justify-center px-5 pt-20 pb-16 animate-rise-in">
        <form
          key={mode}
          onSubmit={submit}
          noValidate
          aria-busy={leaving || undefined}
          className={`w-full max-w-[400px] rounded-2xl border border-line bg-surface-raised/40 p-7 transition-opacity ${leaving ? 'pointer-events-none opacity-60' : ''}`}
        >
          <p className={`${LABEL} mb-2`}>{copy.eyebrow}</p>
          <h1 className="text-[24px] font-bold tracking-tight text-ink-strong">{copy.title}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{tagline}</p>

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
              {(mode === 'login' || mode === 'register') && (
                <div className="mt-6 flex flex-col gap-5">
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

              <button type="submit" disabled={busy} className={`${CTA} mt-6`}>
                <span>{busy ? copy.busy : copy.cta}</span>
                {!busy && <span aria-hidden="true">→</span>}
              </button>
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
