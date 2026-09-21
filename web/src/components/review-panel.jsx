import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Stars, StarPicker } from './star-rating'
import { Sensitive } from './sensitive'
import { link, REVIEWS_PATH } from '../lib/router'
import {
  fetchPanel,
  panelUpdateReview,
  panelDeleteReview,
  panelSaveSettings,
  createInvite,
  deleteInvite,
} from '../lib/api'
import { REVIEW_LIMITS, INVITE_DAYS, relativeTime, absoluteTime, inviteLink } from '../lib/reviews'

const LABEL = 'text-[11px] font-mono font-semibold text-ink-subtle uppercase tracking-wider'
const INPUT =
  'w-full rounded-xl border border-line bg-surface-raised/60 px-3.5 py-2.5 text-[13.5px] text-ink-strong placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-line-strong focus:bg-surface focus:outline-none'
const CTA =
  'inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-surface-inverted ps-5 pe-4 text-[13px] font-medium text-ink-on-inverted outline-none transition-[transform,opacity] duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0'
const APPROVE =
  'inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-emerald-500 ps-5 pe-4 text-[13px] font-semibold text-white outline-none transition-[transform,opacity] duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0'
const ACTION = 'cursor-pointer text-[12px] font-medium text-ink-muted transition-colors hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-40'
const DANGER = 'cursor-pointer text-[12px] font-medium text-ink-subtle transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40'
const CHIP = 'rounded-md border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider'

const FILTERS = ['all', 'pending', 'hidden', 'featured', 'auto', 'invited', 'replied']

const STATUS_CHIP = {
  pending: 'text-amber-500 border-amber-500/30',
  used: 'text-emerald-500 border-emerald-500/30',
  auto: 'text-ink-muted border-line-strong',
  expired: 'text-ink-faint border-line',
}

const FIELD_ERRORS = {
  name: `Name has to be ${REVIEW_LIMITS.name.min}–${REVIEW_LIMITS.name.max} characters.`,
  role: `Role has to be ${REVIEW_LIMITS.role.max} characters or fewer.`,
  text: `Fallback text has to be at least ${REVIEW_LIMITS.text.min} characters, or left empty.`,
  rating: 'Pick a rating between 1 and 5.',
}

const fieldError = (fields) => fields.map((f) => FIELD_ERRORS[f] || `Check: ${f}.`).join(' ')

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

function ReviewRow({ item, busy, onOpen, onPatch, onCopy, copied }) {
  const open = () => onOpen(item.id)
  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }

  return (
    <li className="border-b border-line">
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            open()
          }
        }}
        className="group -mx-3 cursor-pointer rounded-xl px-3 py-4 outline-none transition-colors hover:bg-surface-raised/60 focus-visible:ring-2 focus-visible:ring-ink-strong/50"
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[14px] font-semibold tracking-tight text-ink-strong">{item.name}</span>
          {item.role && <span className="text-[12px] text-ink-subtle">{item.role}</span>}
          <Stars value={item.rating} size={11} className="ms-1" />
          {flagsOf(item).map(([flag, cls]) => (
            <span key={flag} className={`${CHIP} ${cls}`}>{flag}</span>
          ))}
          <time dateTime={item.at} title={absoluteTime(item.at)} className="ms-auto whitespace-nowrap font-mono text-[11px] text-ink-subtle">
            {relativeTime(item.at)}
          </time>
        </div>
        <p className="mt-2 line-clamp-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-secondary">{item.text}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <button type="button" onClick={stop(() => onCopy(item.id))} className="cursor-pointer font-mono text-[10.5px] text-ink-faint transition-colors hover:text-ink-muted">
            {copied ? 'copied' : `#${item.id}`}
          </button>
          {item.pending && (
            <>
              <button type="button" disabled={busy} onClick={stop(() => onPatch(item.id, { pending: false }))} className="cursor-pointer text-[12px] font-semibold text-emerald-500 transition-colors hover:text-emerald-400 disabled:opacity-40">
                Approve
              </button>
              <button type="button" disabled={busy} onClick={stop(() => onPatch(item.id, { pending: false, hidden: true }))} className={ACTION}>
                Reject
              </button>
            </>
          )}
          {item.reply && <span className="text-[11.5px] text-ink-faint">replied</span>}
          <span className="ms-auto text-[12px] font-medium text-ink-faint transition-colors group-hover:text-ink-muted">
            Open <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </li>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className={LABEL}>{label}</span>
        {hint && <span className="font-mono text-[10.5px] text-ink-faint tabular-nums">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function ReviewDialog({ item, list, busy, onPatch, onDelete, onOpen, onClose }) {
  const [draft, setDraft] = useState(() => ({ name: item.name, role: item.role || '', rating: item.rating, text: item.text, reply: item.reply?.text || '' }))
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const textRef = useRef(null)

  const index = list.findIndex((r) => r.id === item.id)
  const prev = index > 0 ? list[index - 1] : null
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null

  const patch = {}
  if (draft.name.trim() !== item.name) patch.name = draft.name.trim()
  if (draft.role.trim() !== (item.role || '')) patch.role = draft.role.trim()
  if (draft.rating !== item.rating) patch.rating = draft.rating
  if (draft.text.trim() !== item.text) patch.text = draft.text.trim()
  if (draft.reply.trim() !== (item.reply?.text || '')) patch.reply = draft.reply.trim()
  const dirty = Object.keys(patch).length > 0

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [item.id])

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 1800)
    return () => window.clearTimeout(timer)
  }, [saved])

  const close = () => {
    if (dirty) setLeaving(true)
    else onClose()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (dirty) setLeaving(true)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dirty, onClose])

  const go = (target) => {
    if (!target) return
    if (dirty) {
      setLeaving(true)
      return
    }
    onOpen(target.id)
  }

  const apply = async (extra, { closeAfter = false } = {}) => {
    setError(null)
    try {
      await onPatch(item.id, { ...patch, ...extra })
      if (closeAfter) onClose()
      else setSaved(true)
    } catch (err) {
      setError(err?.code === 'invalid' ? fieldError(err.fields) : err?.code === 'link' ? 'Links are not allowed.' : err?.code === 'blocked' ? 'Contains a blocked term.' : 'Could not save.')
    }
  }

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (dirty && !busy) apply({})
      return
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
    if (typing) return
    if (e.key === 'ArrowLeft' || e.key === 'k') go(prev)
    if (e.key === 'ArrowRight' || e.key === 'j') go(next)
  }

  const textRows = Math.min(18, Math.max(7, Math.ceil(draft.text.length / 70) + draft.text.split('\n').length))

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm animate-overlay-in sm:items-center sm:p-6" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rv-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[94vh] w-full max-w-[760px] flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl animate-panel-in sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5 sm:px-7">
          <div className="flex items-center gap-1">
            <button type="button" disabled={!prev} onClick={() => go(prev)} aria-label="Previous review" className={`${ACTION} rounded-md px-1.5 py-0.5 text-[15px] leading-none`}>←</button>
            <span className="font-mono text-[11px] text-ink-subtle tabular-nums">{index >= 0 ? `${index + 1} / ${list.length}` : '—'}</span>
            <button type="button" disabled={!next} onClick={() => go(next)} aria-label="Next review" className={`${ACTION} rounded-md px-1.5 py-0.5 text-[15px] leading-none`}>→</button>
          </div>
          <div className="ms-auto flex items-center gap-2">
            {flagsOf(item).map(([flag, cls]) => (
              <span key={flag} className={`${CHIP} ${cls}`}>{flag}</span>
            ))}
          </div>
          <button type="button" onClick={close} aria-label="Close" className="ms-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="rv-dialog-title" className="text-[20px] font-bold tracking-tight text-ink-strong">{item.name}</h2>
            <Stars value={item.rating} size={13} />
            <span className="font-mono text-[11px] text-ink-subtle">#{item.id}</span>
            <time dateTime={item.at} className="ms-auto font-mono text-[11px] text-ink-subtle">{absoluteTime(item.at)}</time>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" hint={`${draft.name.length} / ${REVIEW_LIMITS.name.max}`}>
              <input className={INPUT} value={draft.name} maxLength={REVIEW_LIMITS.name.max} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Role" hint={`${draft.role.length} / ${REVIEW_LIMITS.role.max}`}>
              <input className={INPUT} value={draft.role} maxLength={REVIEW_LIMITS.role.max} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Optional" />
            </Field>
          </div>

          <div className="mt-4">
            <p className={`${LABEL} mb-1`}>Rating</p>
            <StarPicker value={draft.rating} onChange={(rating) => setDraft({ ...draft, rating })} name={`rating-${item.id}`} />
          </div>

          <div className="mt-4">
            <Field label="Review" hint={`${draft.text.length} / ${REVIEW_LIMITS.text.max}`}>
              <textarea
                ref={textRef}
                rows={textRows}
                className={`${INPUT} resize-y text-[15px] leading-relaxed`}
                value={draft.text}
                maxLength={REVIEW_LIMITS.text.max}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Reply from you" hint={item.reply ? `posted ${relativeTime(item.reply.at)}` : 'shown under the review'}>
              <textarea
                rows={3}
                className={`${INPUT} resize-y`}
                value={draft.reply}
                maxLength={REVIEW_LIMITS.text.max}
                onChange={(e) => setDraft({ ...draft, reply: e.target.value })}
                placeholder="Leave empty for no reply."
              />
            </Field>
          </div>

          {(item.auto || item.invited || item.editedAt) && (
            <p className="mt-4 text-[12px] text-ink-subtle">
              {item.auto ? 'Posted automatically after an invite expired. ' : item.invited ? 'Submitted through an invite link. ' : ''}
              {item.editedAt ? `Edited ${relativeTime(item.editedAt)}.` : ''}
            </p>
          )}
        </div>

        <div className="border-t border-line px-5 py-3.5 sm:px-7">
          {leaving ? (
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[13px] text-ink-secondary">Unsaved changes.</span>
              <button type="button" onClick={onClose} className="cursor-pointer rounded-md bg-red-500/15 px-2.5 py-1 text-[12px] font-semibold text-red-500 transition-colors hover:bg-red-500/25">Discard</button>
              <button type="button" onClick={() => setLeaving(false)} className={ACTION}>Keep editing</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Confirm label="Delete" onConfirm={() => onDelete(item.id).then(onClose, () => setError('Could not delete.'))} />
              <button type="button" disabled={busy} onClick={() => apply({ hidden: !item.hidden, ...(item.pending ? { pending: false, hidden: true } : {}) })} className={ACTION}>
                {item.hidden && !item.pending ? 'Unhide' : item.pending ? 'Reject' : 'Hide'}
              </button>
              <button type="button" disabled={busy} onClick={() => apply({ pinned: !item.pinned })} className={ACTION}>
                {item.pinned ? 'Unpin' : 'Pin'}
              </button>
              {error && <span role="alert" className="text-[12.5px] text-red-500">{error}</span>}
              {saved && !error && <span className="text-[12.5px] text-emerald-500">Saved</span>}
              <div className="ms-auto flex items-center gap-3">
                {item.pending ? (
                  <>
                    {dirty && <button type="button" disabled={busy} onClick={() => apply({})} className={ACTION}>Save only</button>}
                    <button type="button" disabled={busy} onClick={() => apply({ pending: false }, { closeAfter: true })} className={APPROVE}>
                      {dirty ? 'Save & approve' : 'Approve'}
                    </button>
                  </>
                ) : (
                  <button type="button" disabled={busy || !dirty} onClick={() => apply({})} className={CTA}>
                    Save changes
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Invites({ invites, busy, onCreate, onRevoke, onCopy, copied }) {
  const [draft, setDraft] = useState({ name: '', role: '', text: '', rating: 5, days: INVITE_DAYS })
  const [created, setCreated] = useState(null)
  const [error, setError] = useState(null)

  const textLength = draft.text.trim().length
  const textTooShort = textLength > 0 && textLength < REVIEW_LIMITS.text.min

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (textTooShort) {
      setError(FIELD_ERRORS.text)
      return
    }
    try {
      const invite = await onCreate(draft)
      setCreated(invite)
      setDraft({ name: '', role: '', text: '', rating: 5, days: INVITE_DAYS })
    } catch (err) {
      setError(err?.code === 'invalid' ? fieldError(err.fields) : err?.code === 'link' ? 'Links are not allowed.' : 'Could not create the link.')
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
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className={LABEL}>Fallback text <span className="font-normal normal-case tracking-normal text-ink-faint">· optional, only used for the automatic review</span></span>
            <span className={`font-mono text-[10.5px] tabular-nums ${textTooShort ? 'text-red-500' : 'text-ink-faint'}`}>
              {textLength === 0 ? `${REVIEW_LIMITS.text.min} characters minimum if used` : `${textLength} / ${textTooShort ? REVIEW_LIMITS.text.min : REVIEW_LIMITS.text.max}`}
            </span>
          </span>
          <textarea className={`${INPUT} min-h-[80px] resize-y ${textTooShort ? 'border-red-500/50' : ''}`} rows={3} value={draft.text} maxLength={REVIEW_LIMITS.text.max} placeholder="Rated without leaving a written review." onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
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
          <Sensitive as="code" className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-secondary">{inviteLink(created.token)}</Sensitive>
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
                    ? `expires ${relativeTime(invite.expiresAt)}`
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

function Settings({ settings, reviews, busy, onSave }) {
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
      </div>
    </div>
  )
}

export default function ReviewPanel({ tab, auth = () => ({}), onUnauthorized, onData }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [copied, setCopied] = useState(null)
  const [openId, setOpenId] = useState(null)
  const props = useRef({ auth, onUnauthorized, onData })
  useEffect(() => {
    props.current = { auth, onUnauthorized, onData }
  })

  const refresh = useCallback(async () => {
    try {
      const next = await fetchPanel(props.current.auth())
      setData(next)
      props.current.onData?.(next)
      setError(null)
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) props.current.onUnauthorized?.(err?.code)
      else setError('Could not load the panel.')
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh, tab])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(null), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const run = async (fn) => {
    setBusy(true)
    try {
      const result = await fn(props.current.auth())
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

  const stats = data?.stats
  const pending = data ? data.reviews.filter((r) => r.pending) : []
  const dialogList = tab === 'overview' ? pending : filtered
  const openItem = openId && data ? data.reviews.find((r) => r.id === openId) : null
  const rowProps = {
    busy,
    onCopy: copy,
    onOpen: setOpenId,
    onPatch: (id, patch) => run((opts) => panelUpdateReview(id, patch, opts)),
  }

  return (
    <>
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
                  <ReviewRow key={item.id} item={item} copied={copied === item.id} {...rowProps} />
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
              <ReviewRow key={item.id} item={item} copied={copied === item.id} {...rowProps} />
            ))}
          </ol>
          {filtered.length === 0 && <p className="py-10 text-center text-[13px] text-ink-subtle">Nothing matches.</p>}
        </div>
      ) : tab === 'invites' ? (
        <div className="w-full">
          <Invites invites={data.invites} busy={busy} copied={copied} onCopy={copy}
            onCreate={(draft) => run((opts) => createInvite(draft, opts))}
            onRevoke={(token) => run((opts) => deleteInvite(token, opts))} />
        </div>
      ) : (
        <div className="w-full">
          <Settings settings={data.settings} reviews={data.reviews} busy={busy}
            onSave={(patch) => run((opts) => panelSaveSettings({ ...data.settings, ...patch }, opts))} />
        </div>
      )}

      {openItem && (
        <ReviewDialog
          key={openItem.id}
          item={openItem}
          list={dialogList.length ? dialogList : [openItem]}
          busy={busy}
          onPatch={rowProps.onPatch}
          onDelete={(id) => run((opts) => panelDeleteReview(id, opts))}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}
