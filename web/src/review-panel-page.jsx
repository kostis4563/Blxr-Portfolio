import { useState, useEffect, useMemo, useCallback } from 'react'
import ThemeToggle from './components/theme-toggle'
import { Stars } from './components/star-rating'
import { useI18n } from './lib/i18n'
import { link, REVIEWS_PATH } from './lib/router'
import {
  panelLogin,
  panelLogout,
  panelSession,
  fetchPanel,
  panelUpdateReview,
  panelDeleteReview,
  panelSaveSettings,
  createInvite,
  deleteInvite,
} from './lib/api'
import { REVIEW_LIMITS, INVITE_DAYS, relativeTime, absoluteTime, inviteLink } from './lib/reviews'

const LABEL = 'text-[11px] font-mono font-semibold text-ink-subtle uppercase tracking-wider'
const INPUT =
  'w-full rounded-xl border border-line bg-surface-raised/60 px-3.5 py-2.5 text-[13.5px] text-ink-strong placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-line-strong focus:bg-surface focus:outline-none'
const CTA =
  'inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-surface-inverted ps-5 pe-4 text-[13px] font-medium text-ink-on-inverted outline-none transition-[transform,opacity] duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0'
const ACTION = 'cursor-pointer text-[12px] font-medium text-ink-muted transition-colors hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-40'
const DANGER = 'cursor-pointer text-[12px] font-medium text-ink-subtle transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40'
const CHIP = 'rounded-md border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider'

const TABS = ['overview', 'reviews', 'invites', 'settings']
const FILTERS = ['all', 'pending', 'hidden', 'featured', 'auto', 'invited', 'replied']

const STATUS_CHIP = {
  pending: 'text-amber-500 border-amber-500/30',
  used: 'text-emerald-500 border-emerald-500/30',
  auto: 'text-ink-muted border-line-strong',
  expired: 'text-ink-faint border-line',
}

function flagsOf(r) {
  const flags = []
  if (r.pending) flags.push(['pending', 'text-amber-500 border-amber-500/30'])
  else if (r.hidden) flags.push(['hidden', 'text-ink-faint border-line'])
  if (r.pinned) flags.push(['featured', 'text-amber-500 border-amber-500/30'])
  if (r.auto) flags.push(['auto', 'text-ink-muted border-line-strong'])
  else if (r.invited) flags.push(['invited', 'text-emerald-500 border-emerald-500/30'])
  if (r.editedAt) flags.push(['edited', 'text-ink-faint border-line'])
  if (r.reply) flags.push(['replied', 'text-ink-muted border-line-strong'])
  return flags
}

function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      await panelLogin(password)
      onLogin()
    } catch (err) {
      if (err?.code === 'locked') setError(`Too many attempts. Try again in ${Math.ceil((err.retryAfter || 900) / 60)} min.`)
      else if (err?.code === 'wrong_password') setError('Wrong password.')
      else if (err?.code === 'panel_disabled') setError('The panel is off: REVIEW_OWNER_KEY is not set on the server.')
      else setError('Could not sign in.')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-[380px] rounded-2xl border border-line bg-surface-raised/40 p-7">
        <p className={`${LABEL} mb-2`}>Owner</p>
        <h1 className="text-[24px] font-bold tracking-tight text-ink-strong">Review panel</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">Manage reviews, invite links and settings.</p>
        <label className="mt-6 flex flex-col gap-2">
          <span className={LABEL}>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </label>
        {error && <p role="alert" className="mt-3 text-[12.5px] text-red-500">{error}</p>}
        <button type="submit" disabled={busy || !password} className={`${CTA} mt-5`}>
          <span>{busy ? 'Signing in…' : 'Sign in'}</span>
          {!busy && <span aria-hidden="true">→</span>}
        </button>
      </form>
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-raised/40 px-4 py-3.5">
      <p className="text-[24px] font-bold leading-none tracking-tight text-ink-strong tabular-nums">{value}</p>
      <p className={`${LABEL} mt-2`}>{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-faint">{hint}</p>}
    </div>
  )
}

function Confirm({ label, onConfirm, className = DANGER }) {
  const [armed, setArmed] = useState(false)
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={className}>
        {label}
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={onConfirm} className="cursor-pointer rounded-md bg-red-500/15 px-2 py-0.5 text-[12px] font-semibold text-red-500 transition-colors hover:bg-red-500/25">
        Confirm
      </button>
      <button type="button" onClick={() => setArmed(false)} className={ACTION}>
        Cancel
      </button>
    </span>
  )
}

function ReviewRow({ item, lang, busy, onPatch, onDelete, onCopy, copied }) {
  const [mode, setMode] = useState(null)
  const [draft, setDraft] = useState(null)
  const [reply, setReply] = useState(item.reply?.text || '')
  const [error, setError] = useState(null)

  const startEdit = () => {
    setDraft({ name: item.name, role: item.role || '', rating: item.rating, text: item.text })
    setMode('edit')
    setError(null)
  }

  const save = async (patch) => {
    setError(null)
    try {
      await onPatch(item.id, patch)
      setMode(null)
    } catch (err) {
      setError(err?.code === 'invalid' ? `Check: ${err.fields.join(', ')}.` : err?.code === 'link' ? 'Links are not allowed.' : 'Could not save.')
    }
  }

  return (
    <li className="border-b border-line py-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[14px] font-semibold tracking-tight text-ink-strong">{item.name}</span>
        {item.role && <span className="text-[12px] text-ink-subtle">{item.role}</span>}
        <Stars value={item.rating} size={11} className="ms-1" />
        {flagsOf(item).map(([flag, cls]) => (
          <span key={flag} className={`${CHIP} ${cls}`}>{flag}</span>
        ))}
        <time dateTime={item.at} title={absoluteTime(item.at, lang)} className="ms-auto whitespace-nowrap font-mono text-[11px] text-ink-subtle">
          {relativeTime(item.at, lang)}
        </time>
      </div>

      {mode === 'edit' ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input className={INPUT} value={draft.name} maxLength={REVIEW_LIMITS.name.max} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" />
          <input className={INPUT} value={draft.role} maxLength={REVIEW_LIMITS.role.max} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Role" />
          <select className={`${INPUT} sm:w-[88px]`} value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
          </select>
          <textarea className={`${INPUT} min-h-[100px] resize-y sm:col-span-3`} value={draft.text} maxLength={REVIEW_LIMITS.text.max} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <div className="flex items-center gap-4 sm:col-span-3">
            <button type="button" disabled={busy} onClick={() => save(draft)} className={CTA}>Save</button>
            <button type="button" onClick={() => setMode(null)} className={ACTION}>Cancel</button>
            {error && <span className="text-[12.5px] text-red-500">{error}</span>}
          </div>
        </div>
      ) : (
        <p className="mt-2.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-secondary">{item.text}</p>
      )}

      {mode === 'reply' ? (
        <div className="mt-3 flex flex-col gap-3">
          <textarea className={`${INPUT} min-h-[80px] resize-y`} value={reply} maxLength={REVIEW_LIMITS.text.max} onChange={(e) => setReply(e.target.value)} placeholder="Your reply, shown under the review." />
          <div className="flex items-center gap-4">
            <button type="button" disabled={busy} onClick={() => save({ reply })} className={CTA}>Save reply</button>
            {item.reply && <button type="button" disabled={busy} onClick={() => save({ reply: '' })} className={DANGER}>Remove reply</button>}
            <button type="button" onClick={() => setMode(null)} className={ACTION}>Cancel</button>
            {error && <span className="text-[12.5px] text-red-500">{error}</span>}
          </div>
        </div>
      ) : (
        item.reply && (
          <div className="mt-3 rounded-xl border border-line bg-surface-raised/40 px-4 py-3">
            <p className={LABEL}>Reply · {relativeTime(item.reply.at, lang)}</p>
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-secondary">{item.reply.text}</p>
          </div>
        )
      )}

      {!mode && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <button type="button" onClick={() => onCopy(item.id)} className="cursor-pointer font-mono text-[10.5px] text-ink-faint transition-colors hover:text-ink-muted">
            {copied ? 'copied' : `#${item.id}`}
          </button>
          {item.pending && (
            <button type="button" disabled={busy} onClick={() => save({ pending: false })} className="cursor-pointer text-[12px] font-semibold text-emerald-500 transition-colors hover:text-emerald-400">
              Approve
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => save({ hidden: !item.hidden, ...(item.pending ? { pending: false, hidden: true } : {}) })} className={ACTION}>
            {item.hidden && !item.pending ? 'Unhide' : item.pending ? 'Reject' : 'Hide'}
          </button>
          <button type="button" disabled={busy} onClick={() => save({ pinned: !item.pinned })} className={ACTION}>
            {item.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button type="button" onClick={() => { setMode('reply'); setError(null) }} className={ACTION}>
            {item.reply ? 'Edit reply' : 'Reply'}
          </button>
          <button type="button" onClick={startEdit} className={ACTION}>Edit</button>
          <Confirm label="Delete" onConfirm={() => onDelete(item.id)} />
          {error && <span className="text-[12.5px] text-red-500">{error}</span>}
        </div>
      )}
    </li>
  )
}

function Invites({ invites, lang, busy, onCreate, onRevoke, onCopy, copied }) {
  const [draft, setDraft] = useState({ name: '', role: '', text: '', rating: 5, days: INVITE_DAYS })
  const [created, setCreated] = useState(null)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    try {
      const invite = await onCreate(draft)
      setCreated(invite)
      setDraft({ name: '', role: '', text: '', rating: 5, days: INVITE_DAYS })
    } catch (err) {
      setError(err?.code === 'invalid' ? `Check: ${err.fields.join(', ')}.` : err?.code === 'link' ? 'Links are not allowed.' : 'Could not create the link.')
    }
  }

  return (
    <div>
      <p className="mb-6 max-w-[600px] text-[13.5px] leading-relaxed text-ink-muted">
        Create a link for someone you worked with. Their name is filled in and rate limits don’t apply. If the link
        isn’t used before it expires, a review with the chosen rating is posted under that name with the fallback text.
      </p>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Name</span>
          <input className={INPUT} value={draft.name} maxLength={REVIEW_LIMITS.name.max} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Role or company <span className="font-normal normal-case tracking-normal text-ink-faint">· optional</span></span>
          <input className={INPUT} value={draft.role} maxLength={REVIEW_LIMITS.role.max} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
        </label>
        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className={LABEL}>Fallback text <span className="font-normal normal-case tracking-normal text-ink-faint">· optional, only used for the automatic review</span></span>
          <textarea className={`${INPUT} min-h-[80px] resize-y`} rows={3} value={draft.text} maxLength={REVIEW_LIMITS.text.max} placeholder="Rated without leaving a written review." onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Automatic rating</span>
          <select className={INPUT} value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Days until automatic</span>
          <input type="number" min={1} max={30} className={INPUT} value={draft.days} onChange={(e) => setDraft({ ...draft, days: Number(e.target.value) || INVITE_DAYS })} />
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button type="submit" disabled={busy || draft.name.trim().length < REVIEW_LIMITS.name.min} className={CTA}>
            <span>Create link</span>
            <span aria-hidden="true">→</span>
          </button>
          {error && <p role="alert" className="text-[12.5px] text-red-500">{error}</p>}
        </div>
      </form>

      {created && (
        <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-line bg-surface-raised/40 p-4 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-secondary">{inviteLink(created.token)}</code>
          <button type="button" onClick={() => onCopy(inviteLink(created.token), created.token)} className="shrink-0 cursor-pointer rounded-full border border-line-strong bg-surface-raised px-3.5 py-1.5 text-[12px] font-semibold text-ink-secondary transition-colors hover:text-ink-strong">
            {copied === created.token ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}

      {invites.length > 0 ? (
        <ol className="mt-8 border-t border-line">
          {invites.map((invite) => (
            <li key={invite.token} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink-strong">
                  {invite.name}
                  {invite.role && <span className="ms-2 font-normal text-ink-subtle">{invite.role}</span>}
                  <span className="ms-2 font-mono text-[10.5px] text-ink-faint">{invite.rating || 5}★ if unused</span>
                </p>
                <p className="mt-0.5 font-mono text-[10.5px] text-ink-faint">
                  {invite.status === 'pending'
                    ? `expires ${relativeTime(invite.expiresAt, lang)}`
                    : invite.reviewId
                      ? `→ #${invite.reviewId}${invite.auto ? ' (automatic)' : ''}`
                      : 'expired'}
                </p>
              </div>
              <span className={`${CHIP} ${STATUS_CHIP[invite.status]}`}>{invite.status}</span>
              {invite.status === 'pending' && (
                <>
                  <button type="button" onClick={() => onCopy(inviteLink(invite.token), invite.token)} className={ACTION}>
                    {copied === invite.token ? 'Copied' : 'Copy link'}
                  </button>
                  <Confirm label="Revoke" onConfirm={() => onRevoke(invite.token)} />
                </>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-8 text-[13px] text-ink-subtle">No invite links yet.</p>
      )}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3.5 rounded-2xl border border-line bg-surface-raised/40 p-4 transition-colors hover:border-line-strong">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-ink-strong' : 'bg-surface-hover-strong'}`}>
        <span className={`h-4 w-4 rounded-full bg-bg transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <span>
        <span className="block text-[13.5px] font-semibold text-ink-strong">{label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">{hint}</span>
      </span>
    </label>
  )
}

function Settings({ settings, reviews, busy, onSave, onLogout }) {
  const [terms, setTerms] = useState(settings.blockedTerms.join('\n'))
  const [saved, setSaved] = useState(false)

  const saveTerms = async () => {
    await onSave({ blockedTerms: terms.split('\n').map((t) => t.trim()).filter(Boolean) })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(reviews, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `blxr-reviews-${new Date().toISOString().slice(0, 10)}.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        label="Pause new reviews"
        hint="The form stays visible but every submission is refused with “Not taking new reviews right now.”"
        checked={settings.paused}
        disabled={busy}
        onChange={(paused) => onSave({ paused })}
      />
      <Toggle
        label="Require approval"
        hint="New reviews wait in the panel instead of going live. The writer sees their own review marked “awaiting approval” until you approve it. Invite links skip this."
        checked={settings.approval}
        disabled={busy}
        onChange={(approval) => onSave({ approval })}
      />

      <div className="rounded-2xl border border-line bg-surface-raised/40 p-4">
        <p className="text-[13.5px] font-semibold text-ink-strong">Blocked terms</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
          One per line. Submissions containing any of these (case and accent insensitive) are refused. Existing reviews are not affected.
        </p>
        <textarea className={`${INPUT} mt-3 min-h-[120px] resize-y font-mono text-[12.5px]`} value={terms} onChange={(e) => setTerms(e.target.value)} />
        <div className="mt-3 flex items-center gap-4">
          <button type="button" disabled={busy} onClick={saveTerms} className={CTA}>{saved ? 'Saved' : 'Save terms'}</button>
          <span className="font-mono text-[11px] text-ink-faint">{terms.split('\n').filter((t) => t.trim()).length} terms</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface-raised/40 p-4">
        <button type="button" onClick={exportJson} className={ACTION}>Export reviews as JSON</button>
        <a {...link(REVIEWS_PATH)} className={ACTION}>Open public page →</a>
        <button type="button" onClick={onLogout} className={`${DANGER} ms-auto`}>Log out</button>
      </div>
    </div>
  )
}

export default function ReviewPanelPage({ theme, onToggleTheme }) {
  const { lang } = useI18n()
  const [auth, setAuth] = useState('checking')
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('overview')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    panelSession().then((ok) => setAuth(ok ? 'in' : 'out'))
  }, [])

  const refresh = useCallback(async () => {
    try {
      setData(await fetchPanel())
      setError(null)
    } catch (err) {
      if (err?.status === 401) setAuth('out')
      else setError('Could not load the panel.')
    }
  }, [])

  useEffect(() => {
    if (auth !== 'in') return
    refresh()
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [auth, refresh, tab])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(null), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const run = async (fn) => {
    setBusy(true)
    try {
      const result = await fn()
      await refresh()
      return result
    } finally {
      setBusy(false)
    }
  }

  const copy = (text, id = text) => navigator.clipboard?.writeText(text).then(() => setCopied(id)).catch(() => {})

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.reviews.filter((r) => {
      if (filter === 'pending' && !r.pending) return false
      if (filter === 'hidden' && !(r.hidden && !r.pending)) return false
      if (filter === 'featured' && !r.pinned) return false
      if (filter === 'auto' && !r.auto) return false
      if (filter === 'invited' && !r.invited) return false
      if (filter === 'replied' && !r.reply) return false
      if (!q) return true
      return [r.name, r.role, r.text, r.id].some((v) => (v || '').toLowerCase().includes(q))
    })
  }, [data, query, filter])

  if (auth === 'checking') return <div className="min-h-screen bg-bg" />
  if (auth === 'out') return (
    <div className="min-h-screen bg-bg text-ink font-sans antialiased animate-view-in">
      <Login onLogin={() => setAuth('in')} />
    </div>
  )

  const stats = data?.stats
  const pending = data ? data.reviews.filter((r) => r.pending) : []

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a {...link(REVIEWS_PATH)} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer">
            <span>←</span>
            <span>Reviews</span>
          </a>
          <div className="flex items-center gap-4">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="text-ink-muted hover:text-ink-strong transition-colors duration-200" />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen bg-bg animate-rise-in">
        <div className="mb-8 flex w-full flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`${LABEL} mb-3`}>Owner</p>
            <h1 className="text-[30px] font-bold tracking-[-0.035em] leading-tight text-ink-strong">Review panel</h1>
          </div>
          <nav className="flex items-center gap-1.5 overflow-x-auto" aria-label="Sections">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={tab === name}
                onClick={() => setTab(name)}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap capitalize ${
                  tab === name ? 'bg-ink-strong text-ink-inverse font-semibold' : 'text-ink-muted hover:text-ink-strong'
                }`}
              >
                {name}
                {name === 'reviews' && stats?.pending > 0 && <span className="ms-1.5 font-mono text-[10px] text-amber-500">{stats.pending}</span>}
              </button>
            ))}
          </nav>
        </div>

        {error && <p role="alert" className="mb-6 w-full rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[12.5px] text-red-500">{error}</p>}

        {!data ? (
          <p className="text-[13px] text-ink-subtle">Loading…</p>
        ) : tab === 'overview' ? (
          <div className="w-full">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Average" value={stats.average.toFixed(1)} hint={`${stats.visible} visible`} />
              <Stat label="Pending" value={stats.pending} hint={data.settings.approval ? 'approval on' : 'approval off'} />
              <Stat label="Last 7 days" value={stats.lastWeek} hint={`${stats.lastMonth} in 30 days`} />
              <Stat label="Invites open" value={stats.invitesPending} hint={`${stats.auto} auto posted`} />
              <Stat label="Hidden" value={stats.hidden} />
              <Stat label="Featured" value={stats.pinned} />
              <Stat label="Via invite" value={stats.invited} />
              <Stat label="Total stored" value={stats.total} />
            </div>

            <div className="mt-6 rounded-2xl border border-line bg-surface-raised/40 p-5">
              <p className={`${LABEL} mb-3`}>Distribution</p>
              <div className="flex flex-col gap-1.5">
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = stats.distribution[n]
                  const pct = stats.visible ? (c / stats.visible) * 100 : 0
                  return (
                    <div key={n} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                      <span className="w-[3ch] font-mono text-[12px] text-ink-muted">{n}<span className="text-ink-faint">★</span></span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-surface-hover"><span className="block h-full rounded-full bg-ink-muted" style={{ width: `${pct}%` }} /></span>
                      <span className="w-[3ch] text-right font-mono text-[12px] text-ink-subtle">{c}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {pending.length > 0 && (
              <div className="mt-8">
                <p className={`${LABEL} mb-1`}>Awaiting approval</p>
                <ol className="border-t border-line">
                  {pending.map((item) => (
                    <ReviewRow key={item.id} item={item} lang={lang} busy={busy} copied={copied === item.id} onCopy={copy}
                      onPatch={(id, patch) => run(() => panelUpdateReview(id, patch))}
                      onDelete={(id) => run(() => panelDeleteReview(id))} />
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : tab === 'reviews' ? (
          <div className="w-full">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input type="search" placeholder="Search name, role, text or id…" value={query} onChange={(e) => setQuery(e.target.value)} className={`${INPUT} sm:max-w-[320px]`} />
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {FILTERS.map((name) => (
                  <button key={name} type="button" aria-pressed={filter === name} onClick={() => setFilter(name)}
                    className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap capitalize ${filter === name ? 'bg-ink-strong text-ink-inverse font-semibold' : 'text-ink-muted hover:text-ink-strong'}`}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <p className="mb-1 font-mono text-[11px] text-ink-subtle">{filtered.length} of {data.reviews.length}</p>
            <ol className="border-t border-line">
              {filtered.map((item) => (
                <ReviewRow key={item.id} item={item} lang={lang} busy={busy} copied={copied === item.id} onCopy={copy}
                  onPatch={(id, patch) => run(() => panelUpdateReview(id, patch))}
                  onDelete={(id) => run(() => panelDeleteReview(id))} />
              ))}
            </ol>
            {filtered.length === 0 && <p className="py-10 text-center text-[13px] text-ink-subtle">Nothing matches.</p>}
          </div>
        ) : tab === 'invites' ? (
          <div className="w-full">
            <Invites invites={data.invites} lang={lang} busy={busy} copied={copied} onCopy={copy}
              onCreate={(draft) => run(() => createInvite(draft))}
              onRevoke={(token) => run(() => deleteInvite(token))} />
          </div>
        ) : (
          <div className="w-full">
            <Settings settings={data.settings} reviews={data.reviews} busy={busy}
              onSave={(patch) => run(() => panelSaveSettings({ ...data.settings, ...patch }))}
              onLogout={() => panelLogout().finally(() => setAuth('out'))} />
          </div>
        )}
      </main>
    </div>
  )
}
