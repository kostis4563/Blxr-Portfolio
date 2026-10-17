import { useState, useEffect, useId, useRef } from 'react'
import ThemeToggle from './components/theme-toggle'
import { link, navigate, useRouteHash, HOME_PATH, LOGIN_PATH, REGISTER_PATH, RESET_PATH, UPDATE_PASSWORD_PATH, VERIFY_PATH, DASHBOARD_PATH } from './lib/router'
import { authLogin, authRegister, authUpdatePassword, authSignOut, authContinueAsGuest, isGuest, mfaRequired, mfaChallenge } from './lib/auth'
import { useAuth, clearRecovery } from './lib/supabase'
import { PASSWORD_MIN, passwordProblem } from './lib/password'
import { Captcha, TICK_FIRST } from './components/captcha'
import { FIELD_LABEL, FILLED, SOLID_CTA, TILE, SWITCH, STRONG_LINK, FORM_TITLE, FORM_TAGLINE, Field, PasswordInput, Strength, Providers } from './components/auth-ui'
import ResetPassword from './components/reset-password'

export { PASSWORD_MIN }
const NAME_MAX = 32
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MODES = {
  login: {
    title: 'Sign in to your account',
    tagline: 'Pick a provider, or use your email and password.',
    cta: 'Sign in',
    busy: 'Signing in…',
    quote: { text: 'Talk is cheap. Show me the code.', by: 'Linus Torvalds' },
  },
  register: {
    title: 'Create your account',
    tagline: 'Pick a provider, or sign up with an email and password.',
    cta: 'Create account',
    busy: 'Creating account…',
    quote: { text: 'Real artists ship.', by: 'Steve Jobs' },
  },
  reset: {
    title: 'Reset your password',
    quote: { text: 'Premature optimization is the root of all evil.', by: 'Donald Knuth' },
  },
  update: {
    title: 'Choose a new password',
    tagline: 'You are signed in through the reset link. Pick a new password to keep using.',
    cta: 'Update password',
    busy: 'Updating…',
    quote: { text: 'Make it work, make it right, make it fast.', by: 'Kent Beck' },
  },
  verify: {
    title: 'Enter your code',
    tagline: 'Open your authenticator app and type the 6-digit code for blxr.',
    cta: 'Verify',
    busy: 'Verifying…',
    quote: { text: 'Security is a process, not a product.', by: 'Bruce Schneier' },
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
  if (code === 'link_expired') return mode === 'reset-code' ? 'That code is wrong or has expired.' : 'That link has expired. Request a new one.'
  if (code === 'not_configured') return 'Accounts are not set up on this build yet.'
  if (code === 'bad_code') return 'That code is not right. Codes change every 30 seconds.'
  if (code === 'code_expired') return 'That code expired — enter the current one.'
  if (code === 'no_factor') return 'No authenticator is set up for this account.'
  if (code === 'captcha') return 'The security check did not pass. Give it a second, then try again.'
  if (code === 'guest_disabled') return 'Guest access is turned off right now. Create an account instead.'
  if (mode === 'verify') return 'Could not verify the code.'
  if (mode === 'guest') return 'Could not open a guest session.'
  if (mode === 'login') return 'Could not sign in.'
  if (mode === 'register') return 'Could not create the account.'
  if (mode === 'update') return 'Could not update the password.'
  if (mode === 'reset-code') return 'Could not check the code.'
  return 'Could not send the code.'
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
  if (!form.password) errors.password = mode === 'update' ? 'Enter a new password.' : 'Enter your password.'
  else if (mode !== 'login') {
    const problem = passwordProblem(form.password, { email: form.email || accountEmail, name: form.name })
    if (problem) errors.password = problem
  }
  if (mode !== 'login' && form.confirm !== form.password) errors.confirm = 'Passwords do not match.'
  return errors
}

function Panel({ mode, quote }) {
  return (
    <aside className="login-aurora relative isolate flex h-[148px] flex-col overflow-hidden rounded-[24px] text-white md:sticky md:top-4 md:col-start-1 md:row-span-2 md:row-start-1 md:h-[calc(100dvh-2rem)] md:min-h-[600px] md:rounded-[28px]">
      <div className="relative z-10 mt-auto w-full px-6 pb-6 md:px-12 md:pb-12 lg:px-14 lg:pb-14">
        <p className="flex items-baseline text-[34px] font-semibold leading-none tracking-[-0.045em] md:text-[clamp(3.25rem,5.6vw,5.75rem)]">
          Hello, world
          <span aria-hidden="true" className="ms-[0.12em] h-[0.74em] w-[0.07em] rounded-[1px] bg-white/85 animate-caret" />
        </p>
        <figure key={mode} className="mt-6 hidden max-w-[380px] animate-rise-in md:block lg:mt-8">
          <blockquote className="text-pretty text-[16px] leading-relaxed text-white/75 lg:text-[17px]">“{quote.text}”</blockquote>
          <figcaption className="mt-2.5 text-[13px] text-white/45">{quote.by}</figcaption>
        </figure>
      </div>
    </aside>
  )
}

function OrRule() {
  return (
    <div className="my-7 flex items-center gap-4 text-[12.5px] text-ink-subtle" aria-hidden="true">
      <span className="h-px flex-1 bg-line-strong" />
      Or
      <span className="h-px flex-1 bg-line-strong" />
    </div>
  )
}

function Notice({ title, children, tone = 'ok' }) {
  const ring = tone === 'ok' ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-line bg-surface'
  return (
    <div className={`rounded-xl border px-4 py-3.5 text-[13px] leading-relaxed text-ink ${ring}`}>
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
    if (recovery && mode !== 'update' && mode !== 'reset') navigate(UPDATE_PASSWORD_PATH, { replace: true })
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
    if (captcha.current?.pending()) {
      setError(TICK_FIRST)
      return
    }

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
    if (captcha.current?.pending()) {
      setError(TICK_FIRST)
      return
    }
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

  const social = mode === 'login' || mode === 'register'
  const card = `w-full animate-rise-in transition-opacity ${leaving ? 'pointer-events-none opacity-60' : ''}`
  const leave = () => {
    setLeaving(true)
    navigate(next, { replace: true })
  }

  const updateLocked = mode === 'update' && session === null
  const tagline =
    mode !== 'update' ? copy.tagline
    : updateLocked ? 'Reset links only work once and expire after an hour.'
    : recovery ? copy.tagline
    : 'Pick a new password for your account.'

  return (
    <div className="min-h-dvh bg-bg text-ink selection:bg-selection selection:text-ink-strong antialiased font-sans animate-view-in">
      <div className="grid min-h-dvh w-full grid-cols-1 grid-rows-[auto_auto_1fr] gap-3 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-6 lg:gap-x-10 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
        <div className="flex h-11 items-center justify-between px-1 md:col-start-2 md:row-start-1 md:px-2">
          <a {...link(HOME_PATH)} className="inline-flex items-center gap-2 rounded-lg text-[13px] font-medium text-ink-muted transition-colors duration-200 hover:text-ink-strong">
            <span aria-hidden="true">←</span>
            <span>Home</span>
          </a>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors duration-200 hover:bg-surface-hover hover:text-ink-strong" />
        </div>

        <Panel mode={mode} quote={copy.quote} />

        <main className="flex min-w-0 items-center justify-center px-2 pb-10 pt-6 sm:px-4 md:col-start-2 md:row-start-2 md:pb-14 md:pt-2">
          <div className="w-full max-w-[420px]">
            {mode === 'reset' ? (
              <ResetPassword
                email={form.email}
                onEmailChange={(email) => setForm((f) => ({ ...f, email }))}
                copy={copy}
                describe={messageFor}
                next={next}
                onDone={leave}
                className={card}
              />
            ) : (
              <form key={mode} onSubmit={submit} noValidate aria-busy={leaving || undefined} className={card}>
                <h1 className={FORM_TITLE}>{copy.title}</h1>
                <p className={FORM_TAGLINE}>{tagline}</p>

                {notice?.kind === 'confirm' ? (
                  <div className="mt-8">
                    <Notice title="Confirm your email">
                      We sent a link to <span className="text-ink-strong">{notice.email}</span>. Open it to activate the account, then sign in.
                    </Notice>
                  </div>
                ) : updateLocked ? (
                  <div className="mt-8">
                    <Notice title="That link has expired" tone="plain">
                      Open the reset link from your email in this browser, or request a new code.
                    </Notice>
                  </div>
                ) : (
                  <>
                    {guest && social && (
                      <div className="mt-8 rounded-xl border border-line bg-surface px-4 py-3.5 text-[13px] leading-relaxed">
                        <p className="font-medium text-ink-strong">You are browsing as a guest.</p>
                        <p className="mt-1 text-ink-muted">
                          Signing in here switches to that account and leaves your guest board behind. To keep it,{' '}
                          <a {...link(`${DASHBOARD_PATH}#claim`)} className={SWITCH}>claim the guest account</a> instead.
                        </p>
                      </div>
                    )}

                    {social && (
                      <div className="mt-8">
                        <Providers next={next} disabled={busy} onStart={() => setError(null)} onError={fail} tileClass={TILE} labels />
                        <OrRule />
                      </div>
                    )}

                    <div className={`${social ? '' : 'mt-8'} flex flex-col gap-5`}>
                      {mode === 'verify' && (
                        <Field label="Verification code" error={errors.code} labelClass={FIELD_LABEL}>
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
                            className={`${FILLED} text-center font-mono text-[18px] tracking-[0.35em]`}
                          />
                        </Field>
                      )}

                      {mode === 'register' && (
                        <Field label="Name" error={errors.name} labelClass={FIELD_LABEL}>
                          <input
                            id={`${id}-name`}
                            type="text"
                            autoComplete="nickname"
                            autoFocus
                            maxLength={NAME_MAX}
                            placeholder="What should I call you?"
                            value={form.name}
                            onChange={set('name')}
                            aria-invalid={Boolean(errors.name) || undefined}
                            className={FILLED}
                          />
                        </Field>
                      )}

                      {mode !== 'update' && mode !== 'verify' && (
                        <Field label="Email" error={errors.email} labelClass={FIELD_LABEL}>
                          <input
                            id={`${id}-email`}
                            type="email"
                            autoComplete="email"
                            autoFocus={mode !== 'register'}
                            inputMode="email"
                            spellCheck={false}
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={set('email')}
                            aria-invalid={Boolean(errors.email) || undefined}
                            className={FILLED}
                          />
                        </Field>
                      )}

                      {mode !== 'verify' && (
                        <Field
                          label={mode === 'update' ? 'New password' : 'Password'}
                          error={errors.password}
                          labelClass={FIELD_LABEL}
                          hint={
                            mode === 'login' && (
                              <a {...link(RESET_PATH)} className="cursor-pointer text-[12.5px] text-ink-muted transition-colors hover:text-ink-strong">Forgot password?</a>
                            )
                          }
                        >
                          <PasswordInput
                            id={`${id}-password`}
                            value={form.password}
                            onChange={set('password')}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            autoFocus={mode === 'update'}
                            placeholder={mode === 'login' ? 'Enter your password' : 'Choose a password'}
                            invalid={Boolean(errors.password)}
                            className={FILLED}
                            iconToggle
                          />
                          {mode !== 'login' && (form.password
                            ? <Strength password={form.password} />
                            : !errors.password && <span className="text-[12.5px] text-ink-subtle">Must be at least {PASSWORD_MIN} characters.</span>)}
                        </Field>
                      )}

                      {(mode === 'register' || mode === 'update') && (
                        <Field label="Confirm password" error={errors.confirm} labelClass={FIELD_LABEL}>
                          <PasswordInput
                            id={`${id}-confirm`}
                            value={form.confirm}
                            onChange={set('confirm')}
                            autoComplete="new-password"
                            placeholder="Type it once more"
                            invalid={Boolean(errors.confirm)}
                            className={FILLED}
                            iconToggle
                          />
                        </Field>
                      )}

                      {mode === 'login' && (
                        <label className="-mt-1 flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-ink-muted">
                          <input
                            type="checkbox"
                            checked={form.remember}
                            onChange={set('remember')}
                            className="h-4 w-4 cursor-pointer rounded border-line accent-ink-strong"
                          />
                          Keep me signed in
                        </label>
                      )}
                    </div>

                    {social && <Captcha handle={captcha} visible />}

                    {error && (
                      <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-3.5 py-2.5 text-[13px] text-red-500">
                        {error}
                      </p>
                    )}

                    <button type="submit" disabled={busy || guestBusy} className={`${SOLID_CTA} mt-7`}>
                      {busy ? copy.busy : copy.cta}
                    </button>

                    {mode === 'login' && guest && (
                      <p className="mt-4 text-center text-[13px] text-ink-muted">
                        Or{' '}
                        <a {...link(DASHBOARD_PATH)} className={SWITCH}>back to the dashboard</a> as a guest.
                      </p>
                    )}
                  </>
                )}

                <p className="mt-6 text-balance text-center text-[13.5px] leading-relaxed text-ink-muted">
                  {mode === 'login' ? (
                    <>
                      No account yet?{' '}
                      <a {...link(REGISTER_PATH)} className={STRONG_LINK}>Create one</a>
                      {!guest && (
                        <>
                          {' '}or{' '}
                          <button
                            type="button"
                            onClick={continueAsGuest}
                            disabled={busy || guestBusy}
                            title="No email needed. Try a board and claim it as yours later."
                            className={`${STRONG_LINK} disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline`}
                          >
                            {guestBusy ? 'opening a guest session…' : 'continue as guest'}
                          </button>
                        </>
                      )}
                    </>
                  ) : mode === 'register' ? (
                    <>
                      Already have an account?{' '}
                      <a {...link(LOGIN_PATH)} className={STRONG_LINK}>Sign in</a>
                    </>
                  ) : mode === 'verify' ? (
                    <>
                      Not you?{' '}
                      <a {...link(LOGIN_PATH, async () => { await authSignOut(); navigate(LOGIN_PATH, { replace: true }) })} className={STRONG_LINK}>Sign out</a>
                    </>
                  ) : updateLocked ? (
                    <>
                      Link expired?{' '}
                      <a {...link(RESET_PATH)} className={STRONG_LINK}>Get a new code</a>
                    </>
                  ) : (
                    <>
                      Changed your mind?{' '}
                      <a {...link(next, () => { clearRecovery(); navigate(next, { replace: true }) })} className={STRONG_LINK}>Skip for now</a>
                    </>
                  )}
                </p>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
