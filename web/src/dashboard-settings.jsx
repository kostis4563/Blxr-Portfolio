import { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { Avatar } from './components/account-menu'
import {
  Section, Row, Field, Badge, Toggle, Segmented, Select, Modal, CopyButton, ErrorNote, InfoNote, SubTabs,
  ToastProvider, DensityProvider, useToast, INPUT, TEXTAREA, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, BTN_GHOST,
} from './components/settings-ui'
import { link, navigate, dashboardPath, HOME_PATH } from './lib/router'
import { profileOf } from './lib/supabase'
import {
  authUpdateProfile, authUpdateEmail, authVerifyPassword, authUpdatePassword, authLinkIdentity, authUnlinkIdentity,
  authSignOutOthers, authDeleteAccount, mfaFactors, mfaEnroll, mfaVerify, mfaUnenroll, AUTH_PROVIDERS,
} from './lib/auth'
import { useDevicePrefs, setDevicePref, mergeAccountPrefs, DATE_FORMATS, timeZones, localTimeZone, formatDate } from './lib/prefs'
import { LANGUAGES } from './lib/languages'
import { useI18n } from './lib/i18n'
import { clearRecent } from './lib/recent'
import { SOCIAL_ICON_PATHS } from './lib/profile'
import { normalizeUrl } from './lib/profiles'
import { Sensitive } from './components/sensitive'
import { PASSWORD_MIN, passwordProblem, strengthOf } from './lib/password'
import { Captcha } from './components/captcha'

const NAME_MAX = 32
const BIO_MAX = 160
const LOCATION_MAX = 64
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_RE = /^\d{6}$/

const PROVIDER_NAMES = { email: 'Email & password', google: 'Google', discord: 'Discord', github: 'GitHub' }
const PROVIDER_ICONS = {
  google:
    'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  discord: SOCIAL_ICON_PATHS.Discord,
  github: SOCIAL_ICON_PATHS.GitHub,
}

const MESSAGES = {
  invalid_credentials: 'Current password is incorrect.',
  same_password: 'That is already your password. Pick a different one.',
  weak_password: `Use at least ${PASSWORD_MIN} characters.`,
  locked: 'Too many attempts. Try again in a minute.',
  offline: 'You appear to be offline.',
  email_taken: 'That email is already in use.',
  bad_code: 'That code is not right. Codes change every 30 seconds.',
  code_expired: 'That code expired — enter the current one.',
  mfa_disabled: 'Two-factor authentication is not enabled on this project yet.',
  linking_disabled: 'Connecting extra accounts is not enabled on this project yet.',
  identity_taken: 'That account is already connected to a different user.',
  last_identity: 'Add another way to sign in before removing this one.',
  needs_mfa: 'Verify with your authenticator app first, then try again.',
  reauth: 'Your session has expired. Sign in again and retry.',
  delete_disabled: 'Account deletion is not enabled on this server yet.',
  not_configured: 'Accounts are not set up on this build.',
  invalid: 'Please check the highlighted fields.',
}
const messageFor = (err, fallback) => MESSAGES[err?.code] || fallback

const STRENGTH_LABEL = ['', 'Weak', 'Okay', 'Good', 'Strong']
const STRENGTH_COLOR = ['', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-500']

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

function PasswordInput({ id, value, onChange, autoComplete, invalid, placeholder }) {
  const [shown, setShown] = useState(false)
  return (
    <span className="relative block">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={`${INPUT} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-ink-subtle transition-colors hover:text-ink-strong"
      >
        <Icon name={shown ? 'eyeOff' : 'eye'} className="h-4 w-4" />
      </button>
    </span>
  )
}

function useAccountPrefs(user) {
  const toast = useToast()
  const stored = user.user_metadata?.prefs
  const remote = useMemo(() => mergeAccountPrefs(stored), [stored])
  const [prefs, setPrefs] = useState(remote)
  const latest = useRef(prefs)
  latest.current = prefs
  const remoteRef = useRef(remote)
  remoteRef.current = remote
  const dirty = useRef(false)
  const timer = useRef(0)

  useEffect(() => {
    if (!dirty.current) setPrefs(remote)
  }, [remote])
  useEffect(() => () => clearTimeout(timer.current), [])

  const set = useCallback((group, key, value) => {
    dirty.current = true
    const next = { ...latest.current, [group]: { ...latest.current[group], [key]: value } }
    setPrefs(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await authUpdateProfile({ prefs: next })
        dirty.current = false
        toast('Saved')
      } catch (err) {
        dirty.current = false
        setPrefs(remoteRef.current)
        toast(messageFor(err, 'Could not save that change.'), 'error')
      }
    }, 500)
  }, [toast])

  return [prefs, set]
}

function ProfileTab({ user }) {
  const toast = useToast()
  const id = useId()
  const profile = profileOf(user)
  const meta = user.user_metadata || {}
  const initial = useMemo(
    () => ({ name: profile.name, bio: meta.bio || '', website: meta.website || '', location: meta.location || '' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.updated_at],
  )
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => { setForm(initial) }, [initial])

  const dirty = Object.keys(initial).some((k) => initial[k] !== form[k])
  const set = (key) => (e) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const save = async (e) => {
    e.preventDefault()
    if (busy || !dirty) return
    const next = {}
    const name = form.name.trim()
    if (!name) next.name = 'Enter a name.'
    else if (name.length > NAME_MAX) next.name = `Keep it under ${NAME_MAX} characters.`
    if (form.bio.length > BIO_MAX) next.bio = `Keep it under ${BIO_MAX} characters.`
    if (form.location.length > LOCATION_MAX) next.location = `Keep it under ${LOCATION_MAX} characters.`
    const website = normalizeUrl(form.website)
    if (website === null) next.website = 'Enter a valid URL.'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    setError(null)
    try {
      await authUpdateProfile({ name, bio: form.bio.trim(), website, location: form.location.trim() })
      toast('Profile saved')
    } catch (err) {
      setError(messageFor(err, 'Could not save your profile.'))
    } finally {
      setBusy(false)
    }
  }

  const removePhoto = async () => {
    if (removing) return
    setRemoving(true)
    try {
      await authUpdateProfile({ avatar_url: null, picture: null })
      toast('Photo removed')
    } catch (err) {
      toast(messageFor(err, 'Could not remove the photo.'), 'error')
    } finally {
      setRemoving(false)
    }
  }

  const created = user.created_at ? new Date(user.created_at) : null

  return (
    <>
      <form onSubmit={save} noValidate>
        <Section
          id="profile"
          title="Name & photo"
          description={
            <>
              How you appear on reviews and in the dashboard. Your public page is built under{' '}
              <a {...link(dashboardPath('profile'))} className="font-medium text-ink-strong underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong">Profile</a>.
            </>
          }
          footer={
            <>
              <span key={dirty} className="flex items-center gap-1.5 text-[12px] text-ink-subtle animate-menu-in">
                {!dirty && <Icon name="check" className="h-3.5 w-3.5" />}
                {dirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
              <span className="flex items-center gap-2">
                {dirty && (
                  <button type="button" onClick={() => { setForm(initial); setErrors({}); setError(null) }} className={BTN_GHOST}>
                    Reset
                  </button>
                )}
                <button type="submit" disabled={!dirty || busy} className={BTN_PRIMARY}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </span>
            </>
          }
        >
          <Row
            label="Photo"
            description={
              profile.avatar
                ? `Comes from your ${PROVIDER_NAMES[profile.provider] || profile.provider} account.`
                : 'No photo yet — your initial is shown instead. Sign in with a provider to use its photo.'
            }
          >
            <Avatar user={profile} size={44} />
            {profile.avatar && (
              <button type="button" onClick={removePhoto} disabled={removing} className={`${BTN_SECONDARY} ml-2`}>
                {removing ? 'Removing…' : 'Remove'}
              </button>
            )}
          </Row>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Display name" htmlFor={`${id}-name`} error={errors.name} hint={`${form.name.length}/${NAME_MAX}`}>
              <input id={`${id}-name`} type="text" autoComplete="nickname" maxLength={NAME_MAX} value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name) || undefined} className={INPUT} />
            </Field>
            <Field label="Location" htmlFor={`${id}-location`} error={errors.location}>
              <input id={`${id}-location`} type="text" autoComplete="address-level2" maxLength={LOCATION_MAX} placeholder="Athens, GR" value={form.location} onChange={set('location')} aria-invalid={Boolean(errors.location) || undefined} className={INPUT} />
            </Field>
            <Field label="Website" htmlFor={`${id}-website`} error={errors.website} className="sm:col-span-2">
              <input id={`${id}-website`} type="url" autoComplete="url" inputMode="url" spellCheck={false} placeholder="https://" value={form.website} onChange={set('website')} aria-invalid={Boolean(errors.website) || undefined} className={INPUT} />
            </Field>
            <Field label="Bio" htmlFor={`${id}-bio`} error={errors.bio} hint={`${form.bio.length}/${BIO_MAX}`} className="sm:col-span-2">
              <textarea id={`${id}-bio`} maxLength={BIO_MAX} rows={3} placeholder="A line or two about you." value={form.bio} onChange={set('bio')} aria-invalid={Boolean(errors.bio) || undefined} className={TEXTAREA} />
            </Field>
            {error && <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div>}
          </div>
        </Section>
      </form>

      <Section title="Account details" description="Read-only information about this account.">
        <Row label="User ID" description="Quote this when you contact support.">
          <Sensitive as="code" className="truncate font-mono text-[12px] text-ink-muted">{user.id}</Sensitive>
          <CopyButton text={user.id} />
        </Row>
        <Row label="Signed in with">
          <Badge>{PROVIDER_NAMES[profile.provider] || profile.provider}</Badge>
        </Row>
        {created && (
          <Row label="Member since">
            <span className="text-[13px] text-ink-muted">{created.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </Row>
        )}
      </Section>
    </>
  )
}

function EmailSection({ user }) {
  const id = useId()
  const [email, setEmail] = useState(user.email || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sentTo, setSentTo] = useState(null)
  useEffect(() => { setEmail(user.email || '') }, [user.email])

  const verified = Boolean(user.email_confirmed_at)
  const pending = user.new_email && user.new_email !== user.email ? user.new_email : sentTo
  const dirty = email.trim().toLowerCase() !== (user.email || '').toLowerCase()

  const save = async (e) => {
    e.preventDefault()
    if (busy || !dirty) return
    const next = email.trim()
    if (!EMAIL_RE.test(next)) return setError('Enter a valid email.')
    setBusy(true)
    setError(null)
    try {
      await authUpdateEmail(next)
      setSentTo(next)
    } catch (err) {
      setError(messageFor(err, 'Could not change the email.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <Section
        id="email"
        title="Email address"
        description="Used to sign in and for account notices."
        footer={
          <>
            <span className="text-[12px] text-ink-subtle">Changing it sends a confirmation link to both addresses.</span>
            <button type="submit" disabled={!dirty || busy} className={BTN_PRIMARY}>{busy ? 'Sending…' : 'Change email'}</button>
          </>
        }
      >
        <div className="flex flex-col gap-3 px-5 py-4">
          <Field
            label="Email"
            htmlFor={`${id}-email`}
            error={error}
            hint={<Badge tone={verified ? 'ok' : 'warn'}>{verified ? 'Verified' : 'Unverified'}</Badge>}
          >
            <input id={`${id}-email`} type="email" autoComplete="email" inputMode="email" spellCheck={false} value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} aria-invalid={Boolean(error) || undefined} className={INPUT} />
          </Field>
          {pending && (
            <InfoNote icon="mail">
              A change to <span className="text-ink-strong">{pending}</span> is waiting for confirmation. Open the links we sent to both inboxes to finish.
            </InfoNote>
          )}
        </div>
      </Section>
    </form>
  )
}

function ConnectedAccounts({ user }) {
  const toast = useToast()
  const identities = user.identities || []
  const [pending, setPending] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [error, setError] = useState(null)
  const canUnlink = identities.length > 1

  const connect = async (provider) => {
    if (pending) return
    setPending(provider)
    setError(null)
    try {
      await authLinkIdentity(provider)
    } catch (err) {
      setPending(null)
      setError(messageFor(err, `Could not connect ${PROVIDER_NAMES[provider]}.`))
    }
  }

  const unlink = async () => {
    const identity = confirm
    if (!identity) return
    setPending(identity.provider)
    try {
      await authUnlinkIdentity(identity)
      toast(`${PROVIDER_NAMES[identity.provider]} disconnected`)
    } catch (err) {
      setError(messageFor(err, `Could not disconnect ${PROVIDER_NAMES[identity.provider]}.`))
    } finally {
      setPending(null)
      setConfirm(null)
    }
  }

  const emailIdentity = identities.find((i) => i.provider === 'email')

  return (
    <Section id="connected" title="Connected accounts" description="Sign in with any of these. Keep at least one.">
      <Row
        label={
          <span className="flex items-center gap-2">
            <Icon name="mail" className="h-4 w-4 text-ink-muted" /> Email & password
          </span>
        }
        description={emailIdentity ? <Sensitive>{user.email}</Sensitive> : 'Set a password under Security to sign in with your email too.'}
      >
        {emailIdentity ? <Badge tone="ok">Connected</Badge> : (
          <a {...link(dashboardPath('settings/security'))} className={BTN_SECONDARY}>Set password</a>
        )}
      </Row>
      {AUTH_PROVIDERS.map((provider) => {
        const identity = identities.find((i) => i.provider === provider)
        const detail = identity?.identity_data?.email || identity?.identity_data?.user_name || identity?.identity_data?.full_name
        return (
          <Row
            key={provider}
            label={
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 text-ink-muted" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d={PROVIDER_ICONS[provider]} /></svg>
                {PROVIDER_NAMES[provider]}
              </span>
            }
            description={identity ? (detail ? <Sensitive>{detail}</Sensitive> : 'Connected') : 'Not connected'}
          >
            {identity ? (
              <>
                <Badge tone="ok">Connected</Badge>
                <button
                  type="button"
                  onClick={() => setConfirm(identity)}
                  disabled={!canUnlink || pending === provider}
                  title={canUnlink ? undefined : 'Add another sign-in method first'}
                  className={BTN_GHOST}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button type="button" onClick={() => connect(provider)} disabled={Boolean(pending)} className={BTN_SECONDARY}>
                {pending === provider ? 'Redirecting…' : 'Connect'}
              </button>
            )}
          </Row>
        )
      })}
      {error && <div className="px-5 py-3"><ErrorNote>{error}</ErrorNote></div>}

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        busy={Boolean(pending)}
        title={`Disconnect ${confirm ? PROVIDER_NAMES[confirm.provider] : ''}?`}
        description="You will no longer be able to sign in with it. You can connect it again later."
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} disabled={Boolean(pending)} className={BTN_SECONDARY}>Cancel</button>
            <button type="button" onClick={unlink} disabled={Boolean(pending)} className={BTN_DANGER} data-autofocus>
              {pending ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </>
        }
      />
    </Section>
  )
}

function RegionalPreferences({ prefs, setPref }) {
  const { lang, setLang } = useI18n()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  const zones = useMemo(timeZones, [])
  const local = useMemo(localTimeZone, [])
  const locale = prefs.locale

  return (
    <Section id="regional" title="Language & region" description={`Preview: ${formatDate(now, locale)}`}>
      <Row label="Site language" description="Used on the public site. The dashboard is English for now.">
        <Select value={lang} onChange={(code) => setLang(code, { redirect: false })} ariaLabel="Site language" className="w-[200px]">
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.name}{l.code !== 'en' ? ` · ${l.english}` : ''}</option>
          ))}
        </Select>
      </Row>
      <Row label="Time zone" description="Times in the dashboard and in emails.">
        <Select value={locale.timezone} onChange={(v) => setPref('locale', 'timezone', v)} ariaLabel="Time zone" className="w-[240px]">
          <option value="auto">Automatic · {local}</option>
          {zones.map((z) => <option key={z} value={z}>{z.replaceAll('_', ' ')}</option>)}
        </Select>
      </Row>
      <Row label="Date format">
        <Select value={locale.dateFormat} onChange={(v) => setPref('locale', 'dateFormat', v)} ariaLabel="Date format" className="w-[160px]">
          {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </Select>
      </Row>
      <Row label="Time format">
        <Segmented
          label="Time format"
          value={locale.timeFormat}
          onChange={(v) => setPref('locale', 'timeFormat', v)}
          options={[{ value: 'auto', label: 'Auto' }, { value: '12', label: '12-hour' }, { value: '24', label: '24-hour' }]}
        />
      </Row>
      <Row label="Week starts on">
        <Segmented
          label="Week starts on"
          value={locale.weekStart}
          onChange={(v) => setPref('locale', 'weekStart', v)}
          options={[{ value: 'monday', label: 'Monday' }, { value: 'sunday', label: 'Sunday' }]}
        />
      </Row>
    </Section>
  )
}

function AccountTab({ user, prefs, setPref }) {
  return (
    <>
      <EmailSection user={user} />
      <ConnectedAccounts user={user} />
      <RegionalPreferences prefs={prefs} setPref={setPref} />
    </>
  )
}

const EMPTY_PASSWORD = { current: '', password: '', confirm: '' }

function PasswordSection({ user }) {
  const toast = useToast()
  const id = useId()
  const hasPassword = (user.identities || []).some((i) => i.provider === 'email')
  const [form, setForm] = useState(EMPTY_PASSWORD)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const captcha = useRef(null)

  const set = (key) => (e) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const next = {}
    if (hasPassword && !form.current) next.current = 'Enter your current password.'
    if (!form.password) next.password = 'Enter a new password.'
    else {
      const problem = passwordProblem(form.password, { email: user.email, name: user.user_metadata?.name })
      if (problem) next.password = problem
    }
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    setError(null)
    try {
      if (hasPassword) {
        try {
          const captchaToken = captcha.current ? await captcha.current.run() : undefined
          await authVerifyPassword(user.email, form.current, { captchaToken })
        } catch (err) {
          if (err?.code === 'invalid_credentials') {
            setErrors({ current: 'Incorrect password.' })
            return
          }
          throw err
        }
      }
      await authUpdatePassword(form.password)
      setForm(EMPTY_PASSWORD)
      toast(hasPassword ? 'Password updated' : 'Password set')
    } catch (err) {
      setError(messageFor(err, 'Could not update the password.'))
      setForm((f) => ({ ...f, password: '', confirm: '' }))
    } finally {
      setBusy(false)
    }
  }

  const ready = form.password && form.confirm && (!hasPassword || form.current)

  return (
    <form onSubmit={submit} noValidate>
      <Section
        id="password"
        title={hasPassword ? 'Password' : 'Set a password'}
        description={
          hasPassword
            ? 'We will email you when it changes.'
            : 'You sign in with a provider. Adding a password lets you use your email as well.'
        }
        footer={
          <>
            <span className="text-[12px] text-ink-subtle">{PASSWORD_MIN}+ characters. Mixed case, digits and symbols make it stronger.</span>
            <button type="submit" disabled={!ready || busy} className={BTN_PRIMARY}>
              {busy ? 'Saving…' : hasPassword ? 'Update password' : 'Set password'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <input type="email" autoComplete="username" value={user.email || ''} readOnly hidden aria-hidden="true" tabIndex={-1} />
          {hasPassword && (
            <Field label="Current password" htmlFor={`${id}-current`} error={errors.current} className="sm:col-span-2">
              <PasswordInput id={`${id}-current`} value={form.current} onChange={set('current')} autoComplete="current-password" invalid={Boolean(errors.current)} />
            </Field>
          )}
          <Field label="New password" htmlFor={`${id}-new`} error={errors.password}>
            <PasswordInput id={`${id}-new`} value={form.password} onChange={set('password')} autoComplete="new-password" invalid={Boolean(errors.password)} />
            {form.password && <Strength password={form.password} />}
          </Field>
          <Field label="Confirm new password" htmlFor={`${id}-confirm`} error={errors.confirm}>
            <PasswordInput id={`${id}-confirm`} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" invalid={Boolean(errors.confirm)} />
          </Field>
          {error && <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div>}
          {hasPassword && <div className="sm:col-span-2"><Captcha handle={captcha} /></div>}
        </div>
      </Section>
    </form>
  )
}

function EnrollDialog({ open, onClose, onDone }) {
  const id = useId()
  const [factor, setFactor] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setFactor(null)
    setCode('')
    setError(null)
    setShowSecret(false)
    mfaEnroll()
      .then((f) => { if (!cancelled) setFactor(f) })
      .catch((err) => { if (!cancelled) setError(messageFor(err, 'Could not start the setup.')) })
    return () => { cancelled = true }
  }, [open])

  const cancel = () => {
    if (busy) return
    if (factor) mfaUnenroll(factor.id).catch(() => {})
    onClose()
  }

  const verify = async (e) => {
    e?.preventDefault()
    if (busy || !factor) return
    const digits = code.replace(/\s+/g, '')
    if (!CODE_RE.test(digits)) return setError('Enter the 6-digit code from the app.')
    setBusy(true)
    setError(null)
    try {
      await mfaVerify(factor.id, digits)
      onDone()
    } catch (err) {
      setError(messageFor(err, 'Could not verify the code.'))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={cancel}
      busy={busy}
      title="Set up an authenticator app"
      description="Scan the code with Google Authenticator, 1Password, Authy or any TOTP app, then enter the 6-digit code it shows."
      footer={
        <>
          <button type="button" onClick={cancel} disabled={busy} className={BTN_SECONDARY}>Cancel</button>
          <button type="submit" form={`${id}-form`} disabled={busy || !factor || code.replace(/\s+/g, '').length < 6} className={BTN_PRIMARY}>
            {busy ? 'Verifying…' : 'Turn on'}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={verify} noValidate className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-[132px] w-[132px] shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white p-1.5">
            {factor ? (
              <img src={factor.qr} alt="QR code for your authenticator app" width={120} height={120} className="h-full w-full" />
            ) : (
              <span className="h-full w-full animate-pulse rounded-lg bg-neutral-200" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-muted">
            <p>Can't scan it? Enter this key by hand.</p>
            <div className="mt-1.5 flex items-center gap-1">
              <code className={`min-w-0 flex-1 truncate rounded-md border border-line bg-surface-raised/60 px-2 py-1 font-mono text-[12px] text-ink-strong ${showSecret ? '' : 'select-none blur-[3px]'}`}>
                {factor?.secret || '••••••••••••••••'}
              </code>
              <button type="button" onClick={() => setShowSecret((s) => !s)} aria-label={showSecret ? 'Hide key' : 'Show key'} disabled={!factor} className={`${BTN_GHOST} h-7 w-7 px-0`}>
                <Icon name={showSecret ? 'eyeOff' : 'eye'} className="h-3.5 w-3.5" />
              </button>
              {factor && <CopyButton text={factor.secret} label="" />}
            </div>
          </div>
        </div>
        <Field label="Verification code" htmlFor={`${id}-code`} error={error}>
          <input
            id={`${id}-code`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={7}
            placeholder="123 456"
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/[^\d\s]/g, '')); setError(null) }}
            disabled={!factor}
            aria-invalid={Boolean(error) || undefined}
            className={`${INPUT} font-mono tracking-[0.2em]`}
            data-autofocus
          />
        </Field>
      </form>
    </Modal>
  )
}

function TwoFactorSection() {
  const toast = useToast()
  const [factors, setFactors] = useState(undefined)
  const [enrolling, setEnrolling] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(() => mfaFactors().then(setFactors).catch(() => setFactors([])), [])
  useEffect(() => { reload() }, [reload])

  const enabled = Boolean(factors?.length)

  const remove = async () => {
    if (!removing || busy) return
    setBusy(true)
    try {
      await mfaUnenroll(removing.id)
      await reload()
      toast('Two-factor authentication turned off')
      setRemoving(null)
    } catch (err) {
      setError(messageFor(err, 'Could not turn it off.'))
      setRemoving(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section id="2fa" title="Two-factor authentication" description="A second step at sign-in, even if someone has your password.">
      <Row
        label={
          <span className="flex items-center gap-2">
            Authenticator app
            {factors === undefined ? null : <Badge tone={enabled ? 'ok' : 'neutral'}>{enabled ? 'On' : 'Off'}</Badge>}
          </span>
        }
        description={
          enabled
            ? `Enabled${factors[0].updated_at ? ` on ${new Date(factors[0].updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}. You will be asked for a code on every new sign-in.`
            : 'Use a time-based code from an app such as 1Password, Google Authenticator or Authy.'
        }
      >
        {factors === undefined ? (
          <span className="h-8 w-20 animate-pulse rounded-lg bg-surface-hover" aria-hidden="true" />
        ) : enabled ? (
          <button type="button" onClick={() => setRemoving(factors[0])} className={BTN_SECONDARY}>Turn off</button>
        ) : (
          <button type="button" onClick={() => { setError(null); setEnrolling(true) }} className={BTN_PRIMARY}>Set up</button>
        )}
      </Row>
      {enabled && (
        <div className="px-5 py-3">
          <InfoNote icon="alert">
            There are no recovery codes yet. Keep your authenticator app backed up — losing it means losing access to this account.
          </InfoNote>
        </div>
      )}
      {error && <div className="px-5 py-3"><ErrorNote>{error}</ErrorNote></div>}

      <EnrollDialog
        open={enrolling}
        onClose={() => setEnrolling(false)}
        onDone={async () => {
          setEnrolling(false)
          await reload()
          toast('Two-factor authentication is on')
        }}
      />
      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        busy={busy}
        tone="danger"
        title="Turn off two-factor authentication?"
        description="Your password alone will be enough to sign in. You can set it up again at any time."
        footer={
          <>
            <button type="button" onClick={() => setRemoving(null)} disabled={busy} className={BTN_SECONDARY}>Keep it on</button>
            <button type="button" onClick={remove} disabled={busy} className={BTN_DANGER} data-autofocus>{busy ? 'Turning off…' : 'Turn off'}</button>
          </>
        }
      />
    </Section>
  )
}

function SessionsSection({ user, prefs, setPref }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const persist = (() => {
    try { return localStorage.getItem('blxr-auth-persist') !== 'session' } catch { return true }
  })()
  const provider = user.app_metadata?.provider || 'email'

  const signOutOthers = async () => {
    if (busy) return
    setBusy(true)
    try {
      await authSignOutOthers()
      toast('Signed out everywhere else')
    } catch (err) {
      toast(messageFor(err, 'Could not sign out other devices.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section id="sessions" title="Sessions & alerts" description="Where you are signed in and what we tell you about it.">
      <Row
        label="This device"
        description={`Signed in with ${PROVIDER_NAMES[provider] || provider}${user.last_sign_in_at ? ` · ${formatDate(user.last_sign_in_at, prefs.locale)}` : ''}. ${persist ? 'Stays signed in.' : 'Ends when the browser closes.'}`}
      >
        <Badge tone="ok">Current</Badge>
      </Row>
      <Row label="Other devices" description="Revoke every other session. This one stays signed in.">
        <button type="button" onClick={signOutOthers} disabled={busy} className={BTN_SECONDARY}>
          {busy ? 'Signing out…' : 'Sign out other devices'}
        </button>
      </Row>
      <Row label="New sign-in alerts" description="Email me when my account is used from a new device or location." htmlFor="pref-login-alerts">
        <Toggle id="pref-login-alerts" checked={prefs.security.loginAlerts} onChange={(v) => setPref('security', 'loginAlerts', v)} />
      </Row>
      <Row label="Password change alerts" description="Email me whenever my password changes.">
        <Badge>Always on</Badge>
        <Toggle checked disabled label="Password change alerts (always on)" onChange={() => {}} />
      </Row>
    </Section>
  )
}

function SecurityTab({ user, prefs, setPref }) {
  return (
    <>
      <PasswordSection user={user} />
      <TwoFactorSection />
      <SessionsSection user={user} prefs={prefs} setPref={setPref} />
    </>
  )
}

const SWATCH = {
  light: { bg: '#f4f3f0', surface: '#ffffff', line: '#dbd8d2', ink: '#97918a', strong: '#17150f' },
  dark: { bg: '#0a0a0a', surface: '#161616', line: '#2a2a2a', ink: '#525252', strong: '#e5e5e5' },
}

function Preview({ scheme }) {
  const s = SWATCH[scheme]
  return (
    <svg viewBox="0 0 120 76" className="h-full w-full" aria-hidden="true">
      <rect width="120" height="76" fill={s.bg} />
      <rect x="0" y="0" width="34" height="76" fill={s.surface} />
      <line x1="34.5" y1="0" x2="34.5" y2="76" stroke={s.line} />
      <rect x="7" y="9" width="8" height="8" rx="2" fill={s.strong} />
      <rect x="7" y="24" width="20" height="4" rx="2" fill={s.strong} opacity="0.85" />
      <rect x="7" y="33" width="16" height="4" rx="2" fill={s.ink} />
      <rect x="7" y="42" width="18" height="4" rx="2" fill={s.ink} />
      <rect x="44" y="12" width="40" height="6" rx="3" fill={s.strong} />
      <rect x="44" y="26" width="66" height="38" rx="5" fill={s.surface} stroke={s.line} />
      <rect x="52" y="34" width="30" height="4" rx="2" fill={s.ink} />
      <rect x="52" y="44" width="46" height="4" rx="2" fill={s.line} />
      <rect x="52" y="52" width="38" height="4" rx="2" fill={s.line} />
    </svg>
  )
}

function ThemeTile({ value, label, current, onSelect }) {
  const on = current === value
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onSelect(value)}
      className={`group flex cursor-pointer flex-col gap-2 rounded-xl border p-1.5 text-left outline-none transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ink-strong/30 active:translate-y-0 ${
        on ? 'border-ink-strong' : 'border-line hover:border-line-strong'
      }`}
    >
      <span className="relative block aspect-[120/76] w-full overflow-hidden rounded-lg border border-line">
        {value === 'system' ? (
          <>
            <span className="absolute inset-0"><Preview scheme="light" /></span>
            <span className="absolute inset-0 [clip-path:polygon(50%_0,100%_0,100%_100%,50%_100%)]"><Preview scheme="dark" /></span>
          </>
        ) : (
          <Preview scheme={value} />
        )}
      </span>
      <span className="flex items-center justify-between px-1.5 pb-1">
        <span className={`text-[13px] ${on ? 'font-medium text-ink-strong' : 'text-ink-muted group-hover:text-ink-strong'}`}>{label}</span>
        <span className={`grid h-4 w-4 place-items-center rounded-full border transition-colors duration-200 ${on ? 'border-ink-strong bg-ink-strong text-bg' : 'border-line-strong'}`}>
          {on && <Icon name="check" className="h-2.5 w-2.5 animate-menu-in" strokeWidth={3} />}
        </span>
      </span>
    </button>
  )
}

function AppearanceTab({ themePreference, onSetTheme, sidebarCollapsed, onSetSidebarCollapsed }) {
  const device = useDevicePrefs()
  const toast = useToast()
  const setDevice = (key, value) => { setDevicePref(key, value); toast('Saved') }

  return (
    <>
      <Section id="theme" title="Theme" description="Dark by default. System follows your operating system and switches automatically.">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3 px-5 py-4">
          <ThemeTile value="system" label="System" current={themePreference} onSelect={onSetTheme} />
          <ThemeTile value="light" label="Light" current={themePreference} onSelect={onSetTheme} />
          <ThemeTile value="dark" label="Dark" current={themePreference} onSelect={onSetTheme} />
        </div>
      </Section>

      <Section id="layout" title="Layout" description="These apply to this browser only.">
        <Row label="Density" description="Compact tightens spacing across the dashboard.">
          <Segmented
            label="Density"
            value={device.density}
            onChange={(v) => setDevice('density', v)}
            options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]}
          />
        </Row>
        <Row label="Collapsed sidebar" description="Start with the sidebar as an icon rail. ⌘B toggles it any time." htmlFor="pref-sidebar">
          <Toggle id="pref-sidebar" checked={sidebarCollapsed} onChange={onSetSidebarCollapsed} />
        </Row>
        <Row label="Reduce motion" description="Skips animations and transitions. Also follows the OS setting." htmlFor="pref-motion">
          <Toggle id="pref-motion" checked={device.reduceMotion} onChange={(v) => setDevice('reduceMotion', v)} />
        </Row>
      </Section>
    </>
  )
}

function TimeInput({ id, value, onChange, label, disabled }) {
  return (
    <input type="time" id={id} aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${INPUT} w-[112px]`} />
  )
}

function NotificationsTab({ prefs, setPref }) {
  const toast = useToast()
  const n = prefs.notifications
  const [permission, setPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission))

  const setDesktop = async (on) => {
    if (!on) return setPref('notifications', 'desktop', false)
    if (permission === 'unsupported') return toast('Not supported in this browser.', 'error')
    let result = permission
    if (result !== 'granted') {
      try { result = await Notification.requestPermission() } catch { result = 'denied' }
      setPermission(result)
    }
    if (result === 'granted') setPref('notifications', 'desktop', true)
    else toast('Notifications are blocked in your browser settings.', 'error')
  }

  return (
    <>
      <Section id="email-notifications" title="Email" description="Sent to your account email. Security notices cannot be turned off.">
        <Row label="Security alerts" description="Password changes, new sign-ins and other account notices.">
          <Badge>Always on</Badge>
          <Toggle checked disabled label="Security alerts (always on)" onChange={() => {}} />
        </Row>
        <Row label="Review activity" description="When a review you left is approved, edited or replied to." htmlFor="pref-reviews">
          <Toggle id="pref-reviews" checked={n.reviewActivity} onChange={(v) => setPref('notifications', 'reviewActivity', v)} />
        </Row>
        <Row label="Mentions & replies" description="When someone mentions you or replies to you." htmlFor="pref-mentions">
          <Toggle id="pref-mentions" checked={n.mentions} onChange={(v) => setPref('notifications', 'mentions', v)} />
        </Row>
        <Row label="Product updates" description="New features and occasional announcements. Never more than a few a year." htmlFor="pref-updates">
          <Toggle id="pref-updates" checked={n.productUpdates} onChange={(v) => setPref('notifications', 'productUpdates', v)} />
        </Row>
        <Row label="Activity digest" description="A summary of what happened while you were away." htmlFor="pref-digest">
          <Select id="pref-digest" value={n.digest} onChange={(v) => setPref('notifications', 'digest', v)} className="w-[140px]">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="never">Never</option>
          </Select>
        </Row>
      </Section>

      <Section id="in-app" title="In-app" description="How notifications behave inside the dashboard.">
        <Row
          label={
            <span className="flex items-center gap-2">
              Desktop notifications
              {permission === 'denied' && <Badge tone="warn">Blocked</Badge>}
            </span>
          }
          description="Show system notifications while the dashboard is open in a tab."
          htmlFor="pref-desktop"
        >
          <Toggle id="pref-desktop" checked={n.desktop && permission === 'granted'} onChange={setDesktop} disabled={permission === 'unsupported'} />
        </Row>
        <Row label="Sound" description="Play a short tone for new notifications." htmlFor="pref-sound">
          <Toggle id="pref-sound" checked={n.sound} onChange={(v) => setPref('notifications', 'sound', v)} />
        </Row>
        <Row label="Unread badge" description="Show a dot on the bell when something is unread." htmlFor="pref-badge">
          <Toggle id="pref-badge" checked={n.badge} onChange={(v) => setPref('notifications', 'badge', v)} />
        </Row>
      </Section>

      <Section id="quiet" title="Quiet hours" description="Hold non-urgent notifications during these hours, in your time zone.">
        <Row label="Enable quiet hours" htmlFor="pref-quiet">
          <Toggle id="pref-quiet" checked={n.quietHours} onChange={(v) => setPref('notifications', 'quietHours', v)} />
        </Row>
        <Row label="Schedule" description={n.quietHours ? `From ${n.quietFrom} until ${n.quietTo}.` : 'Turn quiet hours on to set a schedule.'}>
          <TimeInput id="pref-quiet-from" label="Quiet hours start" value={n.quietFrom} disabled={!n.quietHours} onChange={(v) => setPref('notifications', 'quietFrom', v)} />
          <span className="text-[12px] text-ink-subtle">to</span>
          <TimeInput id="pref-quiet-to" label="Quiet hours end" value={n.quietTo} disabled={!n.quietHours} onChange={(v) => setPref('notifications', 'quietTo', v)} />
        </Row>
      </Section>
    </>
  )
}

function exportAccount(user) {
  const data = {
    exported_at: new Date().toISOString(),
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    providers: (user.identities || []).map((i) => i.provider),
    profile: user.user_metadata || {},
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `blxr-account-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function DeleteDialog({ open, onClose, user }) {
  const id = useId()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => { if (open) { setTyped(''); setError(null) } }, [open])

  const email = user.email || ''
  const match = typed.trim().toLowerCase() === email.toLowerCase()

  const confirm = async (e) => {
    e?.preventDefault()
    if (busy || !match) return
    setBusy(true)
    setError(null)
    try {
      await authDeleteAccount()
      navigate(HOME_PATH, { replace: true })
    } catch (err) {
      setError(messageFor(err, 'Could not delete the account. Try again later.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      tone="danger"
      title="Delete this account?"
      description="Your profile, sign-in methods and preferences are removed permanently. This cannot be undone."
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>Cancel</button>
          <button type="submit" form={`${id}-form`} disabled={!match || busy} className={BTN_DANGER}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={confirm} noValidate className="flex flex-col gap-3">
        <Field label={<>Type <span className="normal-case tracking-normal text-ink-strong">{email}</span> to confirm</>} htmlFor={`${id}-confirm`} error={error}>
          <input id={`${id}-confirm`} type="email" autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} className={INPUT} data-autofocus />
        </Field>
      </form>
    </Modal>
  )
}

function PrivacyTab({ user }) {
  const toast = useToast()
  const device = useDevicePrefs()
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <Section id="data" title="Your data" description="What we keep about you, and how to take it with you.">
        <Row label="Export account data" description="Download a JSON file with your profile, sign-in methods and preferences.">
          <button type="button" onClick={() => exportAccount(user)} className={BTN_SECONDARY}>
            <Icon name="download" className="h-3.5 w-3.5" /> Download
          </button>
        </Row>
        <Row label="Recent pages" description="The list of recently visited pages the search palette shows on this device.">
          <button type="button" onClick={() => { clearRecent(); toast('Recent pages cleared') }} className={BTN_SECONDARY}>Clear</button>
        </Row>
      </Section>

      <Section id="privacy" title="Privacy" description="Choices for this browser. Do Not Track and Global Privacy Control are always honoured.">
        <Row label="Usage analytics" description="Anonymous page views and performance metrics (Web Vitals). No cookies, no cross-site tracking." htmlFor="pref-analytics">
          <Toggle id="pref-analytics" checked={device.analytics} onChange={(v) => { setDevicePref('analytics', v); toast('Saved') }} />
        </Row>
      </Section>

      <Section id="danger" tone="danger" title="Danger zone" description="Permanent actions. Take a moment before you proceed.">
        <Row label="Delete account" description="Removes your account and everything tied to it. Reviews you left stay, without your name.">
          <button type="button" onClick={() => setDeleting(true)} className={BTN_DANGER}>
            <Icon name="trash" className="h-3.5 w-3.5" /> Delete account
          </button>
        </Row>
      </Section>

      <DeleteDialog open={deleting} onClose={() => setDeleting(false)} user={user} />
    </>
  )
}

function SettingsBody({ item, user, ...rest }) {
  const [prefs, setPref] = useAccountPrefs(user)
  const tab = item.id
  return (
    <div className="w-full">
      <SubTabs item={item} label="Settings sections" />
      <div key={tab} className="settings-stagger flex flex-col gap-5">
        {tab === 'profile' && <ProfileTab user={user} />}
        {tab === 'account' && <AccountTab user={user} prefs={prefs} setPref={setPref} />}
        {tab === 'security' && <SecurityTab user={user} prefs={prefs} setPref={setPref} />}
        {tab === 'appearance' && <AppearanceTab {...rest} />}
        {tab === 'notifications' && <NotificationsTab prefs={prefs} setPref={setPref} />}
        {tab === 'privacy' && <PrivacyTab user={user} />}
      </div>
    </div>
  )
}

export default function DashboardSettings(props) {
  const device = useDevicePrefs()
  return (
    <ToastProvider>
      <DensityProvider value={device.density}>
        <SettingsBody {...props} />
      </DensityProvider>
    </ToastProvider>
  )
}
