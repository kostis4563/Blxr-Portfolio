import { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react'
import { Icon } from './components/dashboard-sidebar'
import ProfileCard, { ProfileAvatar, DecoratedAvatar, LinkIcon } from './components/profile-card'
import { SOCIAL_ICON_PATHS } from './lib/profile'
import {
  Section, Row, Field, Badge, Toggle, Segmented, Modal, CopyButton, ErrorNote, InfoNote, TabStrip,
  ToastProvider, DensityProvider, useToast, INPUT, TEXTAREA, LABEL, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, BTN_GHOST,
} from './components/settings-ui'
import { Bone, Dot, Lines, Loading } from './components/skeleton'
import { useDevicePrefs } from './lib/prefs'
import { profileOf } from './lib/supabase'
import { profilePath } from './lib/router'
import {
  LIMITS, ACCENTS, VISIBILITY, LAYOUTS, PATTERNS, AVATAR_SHAPES, PAGE_THEMES, SECTIONS, DEFAULT_SECTIONS, DECORATIONS, NAMEPLATES, HEX_RE, DISCORD_ID_RE,
  draftFromUser, handleProblem, normalizeUrl, profileUrl, hostOf, accentOf, paletteColor, nameplateImage,
  fetchMyProfile, checkHandle, saveProfile, deleteProfile, uploadAvatar, removeAvatar, uploadCover, removeCover,
} from './lib/profiles'
import { IMPORT_FIELDS, IMPORT_GROUPS, availableImports, applyImports, lookupDiscord } from './lib/discord'

const MESSAGES = {
  handle_taken: 'That handle is already taken.',
  profiles_not_set_up: 'Profiles are not set up on this project yet — run deploy/supabase/profiles.sql in the Supabase SQL editor.',
  profiles_outdated: 'The profiles table is missing newer columns — re-run deploy/supabase/profiles.sql in the Supabase SQL editor.',
  uploads_disabled: 'Photo uploads are not enabled yet — the avatars bucket is created by deploy/supabase/profiles.sql.',
  too_large: 'That image is too large. Try one under 12 MB.',
  bad_image: 'That file could not be read as an image.',
  forbidden: 'Your session has expired. Sign in again and retry.',
  offline: 'You appear to be offline.',
  invalid: 'Please check the highlighted fields.',
  not_configured: 'Accounts are not set up on this build.',
  bad_id: 'That doesn\u2019t look like a Discord user ID — it is 17 to 20 digits.',
  not_found: 'No Discord user has that ID.',
  rate_limited: 'Too many attempts right now. Try again in a moment.',
  unauthorized: 'Your session has expired. Sign in again and retry.',
  discord_failed: 'Discord did not answer. Try again in a moment.',
}
const messageFor = (err, fallback) => MESSAGES[err?.code] || fallback

let keySeq = 0
const withKeys = (list) => list.map((item) => ({ ...item, _k: ++keySeq }))
const stripKeys = (list) => list.map((item) => { const rest = { ...item }; delete rest._k; return rest })
const keyed = (p) => ({ ...p, links: withKeys(p.links), showcase: withKeys(p.showcase) })

const fingerprint = (p) => JSON.stringify({ ...p, links: stripKeys(p.links), showcase: stripKeys(p.showcase), createdAt: undefined, updatedAt: undefined })

const TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'about', label: 'About' },
  { id: 'content', label: 'Content' },
  { id: 'design', label: 'Design' },
  { id: 'publish', label: 'Publish' },
]
const FIELD_TAB = {
  name: 'basics', handle: 'basics', headline: 'basics', pronouns: 'basics', status: 'basics',
  bio: 'about', now: 'about', location: 'about', website: 'about',
  links: 'content', showcase: 'content',
  tagText: 'design', accentHex: 'design',
}

const DiscordMark = ({ className = 'h-3.5 w-3.5' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={SOCIAL_ICON_PATHS.Discord} /></svg>
)

function Skeleton() {
  return (
    <Loading label="Loading your profile" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex gap-1 border-b border-line pb-2.5">
          {['w-14', 'w-12', 'w-16', 'w-14'].map((w, i) => <Bone key={i} className={`mx-3 h-3 ${w}`} />)}
        </div>
        <div className="rounded-xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-4">
            <Bone className="h-3.5 w-20" />
            <Bone className="mt-2 h-2.5 w-64 max-w-full" />
          </div>
          <div className="flex items-center gap-4 border-b border-line px-5 py-4">
            <Dot size={56} />
            <div className="flex-1"><Bone className="h-3 w-12" /><Bone className="mt-2 h-2.5 w-48 max-w-full" /></div>
            <Bone className="h-8 w-20 rounded-lg" />
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={i === 4 ? 'sm:col-span-2' : ''}>
                <Bone className="h-2.5 w-16" />
                <Bone className="mt-2 h-9 w-full rounded-lg" />
              </div>
            ))}
            <div className="sm:col-span-2"><Bone className="h-2.5 w-12" /><Bone className="mt-2 h-9 w-full rounded-lg" /></div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Bone className="h-2.5 w-40" />
          <Bone className="h-8 w-28 rounded-lg" />
        </div>
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface lg:block">
        <Bone className="h-24 w-full rounded-none" />
        <div className="-mt-8 px-5 pb-5">
          <Dot size={64} className="ring-4 ring-surface" />
          <Bone className="mt-3 h-4 w-32" />
          <Bone className="mt-2 h-2.5 w-40" />
          <Lines count={3} className="mt-4" />
          <div className="mt-4 flex gap-1.5">{[0, 1, 2].map((i) => <Bone key={i} className="h-6 w-14 rounded-full" />)}</div>
        </div>
      </div>
    </Loading>
  )
}

function Spinner({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function HandleInput({ id, value, onChange, status, invalid }) {
  const tone = status?.kind === 'taken' || status?.kind === 'invalid' ? 'text-red-500' : status?.kind === 'ok' ? 'text-emerald-500' : 'text-ink-subtle'
  return (
    <div
      className={`flex h-9 w-full items-stretch overflow-hidden rounded-lg border bg-surface-raised/60 transition-colors focus-within:border-line-strong focus-within:bg-surface hover:border-line-strong ${invalid ? 'border-red-500/60' : 'border-line'}`}
    >
      <span className="flex select-none items-center border-r border-line px-2.5 font-mono text-[12px] text-ink-subtle">blxr.net/@</span>
      <input
        id={id}
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={LIMITS.handle}
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-status`}
        className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[13.5px] text-ink-strong placeholder:text-ink-faint focus:outline-none"
        placeholder="yourname"
      />
      <span id={`${id}-status`} aria-live="polite" className={`flex items-center gap-1 pr-2.5 text-[11.5px] ${tone}`}>
        {status?.kind === 'checking' && <Spinner />}
        {status?.kind === 'ok' && <Icon name="check" className="h-3.5 w-3.5 animate-menu-in" strokeWidth={2.2} />}
        {status?.kind === 'taken' && <Icon name="x" className="h-3.5 w-3.5 animate-menu-in" strokeWidth={2.2} />}
        {status?.text && <span className="hidden sm:inline">{status.text}</span>}
      </span>
    </div>
  )
}

const SWATCH = 'grid h-8 w-8 cursor-pointer place-items-center rounded-full outline-none ring-offset-2 ring-offset-surface transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:scale-110 focus-visible:ring-2 focus-visible:ring-ink-strong/40'

function Swatches({ value, hex, onChange, onHex }) {
  const custom = accentOf({ accent: 'custom', accentHex: hex })
  const on = value === 'custom'
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2">
        {ACCENTS.map((a) => {
          const picked = a.id === value
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={picked}
              aria-label={a.label}
              title={a.label}
              onClick={() => onChange(a.id)}
              style={{ backgroundImage: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
              className={`${SWATCH} ${picked ? 'scale-110 ring-2 ring-ink-strong' : ''}`}
            >
              {picked && <Icon name="check" className="h-3.5 w-3.5 text-white drop-shadow animate-menu-in" strokeWidth={2.6} />}
            </button>
          )
        })}
        <label
          title="Custom colour"
          style={{ backgroundImage: on ? `linear-gradient(135deg, ${custom.from}, ${custom.to})` : 'conic-gradient(#f43f5e, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #f43f5e)' }}
          className={`${SWATCH} relative focus-within:ring-2 focus-within:ring-ink-strong/40 ${on ? 'scale-110 ring-2 ring-ink-strong' : ''}`}
        >
          <input
            type="color"
            aria-label="Custom accent colour"
            value={HEX_RE.test(hex || '') ? hex : custom.swatch}
            onChange={(e) => onHex(e.target.value.toLowerCase())}
            onClick={() => !on && onChange('custom')}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          {on ? <Icon name="check" className="h-3.5 w-3.5 text-white drop-shadow animate-menu-in" strokeWidth={2.6} /> : <Icon name="plus" className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={2.6} />}
        </label>
      </div>
      {on && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-ink-muted">Custom</span>
          <input
            type="text"
            aria-label="Custom accent hex"
            value={hex || ''}
            maxLength={7}
            spellCheck={false}
            placeholder="#5865f2"
            onChange={(e) => onHex(e.target.value.trim().toLowerCase())}
            className={`${INPUT} h-7 w-24 font-mono text-[12px]`}
          />
        </div>
      )}
    </div>
  )
}

function ImportPreview({ user }) {
  const plate = user.nameplate?.asset ? nameplateImage(user.nameplate.asset) : null
  const color = paletteColor(user.nameplate?.palette)
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-raised/40">
      <div className="relative h-14" style={{ background: user.accent || 'var(--color-surface-raised)' }}>
        {user.banner && <img src={user.banner} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />}
      </div>
      <div className="-mt-6 px-3 pb-3">
        <DecoratedAvatar
          profile={{ avatar: user.avatar, decoration: user.decoration ? 'image' : 'none', decorationUrl: user.decoration?.url, accent: 'ink', avatarShape: 'circle', name: user.displayName }}
          size={48}
        />
        <div className="relative mt-1.5 overflow-hidden rounded-lg px-1.5 py-1">
          {plate && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0">
              <span className="absolute inset-0" style={{ backgroundImage: `linear-gradient(90deg, transparent, ${color}33)` }} />
              <img src={plate} alt="" referrerPolicy="no-referrer" className="absolute inset-y-0 right-0 h-full w-auto max-w-none" style={{ maskImage: 'linear-gradient(90deg, transparent, black 45%)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 45%)' }} />
            </span>
          )}
          <p className="relative flex items-center gap-1.5 text-[14px] font-semibold text-ink-strong">
            <span className="truncate">{user.displayName || user.username}</span>
            {user.tag?.text && (
              <span className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-1 font-mono text-[10px] font-semibold uppercase text-ink">
                {user.tag.badge && <img src={user.tag.badge} alt="" referrerPolicy="no-referrer" className="h-3 w-3" />}
                {user.tag.text}
              </span>
            )}
            {user.bot && <Badge tone="warn">Bot</Badge>}
          </p>
          <p className="relative truncate font-mono text-[12px] text-ink-muted">@{user.username}</p>
        </div>
      </div>
    </div>
  )
}

function ImportDialog({ open, onClose, form, onApply }) {
  const dialogId = useId()
  const [status, setStatus] = useState({ kind: 'idle' })
  const [chosen, setChosen] = useState(() => new Set())
  const abortRef = useRef(null)
  const found = status.kind === 'found' ? status.user : null
  const offered = useMemo(() => (found ? availableImports(found) : []), [found])
  const allOn = offered.length > 0 && offered.every((f) => chosen.has(f.id))

  useEffect(() => {
    if (open) return undefined
    abortRef.current?.abort()
    abortRef.current = null
    setStatus({ kind: 'idle' })
  }, [open])

  const [userId, setUserId] = useState(() => form.discordId || '')
  const cleanId = userId.replace(/\D/g, '')
  const validId = DISCORD_ID_RE.test(cleanId)

  const lookup = async () => {
    if (!validId || status.kind === 'waiting') return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStatus({ kind: 'waiting' })
    try {
      const u = await lookupDiscord(cleanId, { signal: ctrl.signal })
      setChosen(new Set(availableImports(u).map((f) => f.id)))
      setStatus({ kind: 'found', user: u })
    } catch (err) {
      if (err?.name === 'AbortError') return
      setStatus({ kind: 'error', text: messageFor(err, 'Could not reach Discord.') })
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
    }
  }
  const reset = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus({ kind: 'idle' })
  }

  const toggle = (fid, on) => setChosen((prev) => {
    const next = new Set(prev)
    if (on) next.add(fid)
    else next.delete(fid)
    return next
  })
  const preview = useMemo(() => (found ? applyImports(form, found, chosen) : form), [form, found, chosen])

  const apply = () => {
    if (!found) return
    onApply(found, chosen)
    onClose()
  }

  const waiting = status.kind === 'waiting'
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title="Import from Discord"
      description="Paste your Discord user ID, then pick what to bring over. Nothing is saved until you hit Save changes."
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button type="button" onClick={apply} disabled={!found || chosen.size === 0} className={BTN_PRIMARY}>
            <DiscordMark /> Import {found && chosen.size ? `${chosen.size} ${chosen.size === 1 ? 'thing' : 'things'}` : ''}
          </button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          {!found && (
            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line px-4 py-4">
              <Field label="Discord user ID" htmlFor={`${dialogId}-id`} error={status.kind === 'error' ? status.text : undefined}>
                <div className={`flex h-9 w-full items-stretch overflow-hidden rounded-lg border bg-surface-raised/60 transition-colors focus-within:border-line-strong focus-within:bg-surface hover:border-line-strong ${status.kind === 'error' ? 'border-red-500/60' : 'border-line'}`}>
                  <span className="grid w-9 shrink-0 place-items-center border-r border-line text-[#5865f2]"><DiscordMark /></span>
                  <input
                    id={`${dialogId}-id`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={24}
                    placeholder="981607036192190534"
                    value={userId}
                    onChange={(e) => { setUserId(e.target.value); if (status.kind === 'error') setStatus({ kind: 'idle' }) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup() } }}
                    disabled={waiting}
                    data-autofocus
                    aria-invalid={status.kind === 'error' || undefined}
                    className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] text-ink-strong placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={lookup}
                    disabled={waiting || !validId}
                    className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 border-l border-line px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:bg-surface-hover focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {waiting ? <Spinner className="h-3 w-3" /> : <Icon name="search" className="h-3 w-3" />}
                    {waiting ? 'Looking up' : 'Look up'}
                  </button>
                </div>
              </Field>
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Discord → Settings → Advanced → turn on <span className="font-medium text-ink-strong">Developer Mode</span>, then right-click your name → <span className="font-medium text-ink-strong">Copy User ID</span>.
                Only what is public on your profile comes over: name, photo, banner, decoration, nameplate and server tag.
              </p>
            </div>
          )}

          {found && (
            <div className="flex flex-col gap-3 animate-rise-in">
              <div className="flex items-center justify-between gap-2">
                <p className={LABEL}>Found</p>
                <button type="button" onClick={reset} className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>
                  <Icon name="arrowLeft" className="h-3.5 w-3.5" /> Different ID
                </button>
              </div>
              <ImportPreview user={found} />
              <div className="flex items-center justify-between">
                <p className={LABEL}>What to import</p>
                <button type="button" onClick={() => setChosen(allOn ? new Set() : new Set(offered.map((f) => f.id)))} className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>
                  {allOn ? 'Select none' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {IMPORT_GROUPS.map((g) => {
                  const rows = IMPORT_FIELDS.filter((f) => f.group === g.id && f.has(found))
                  if (!rows.length) return null
                  return (
                    <div key={g.id}>
                      <p className="mb-1 text-[11px] font-medium text-ink-subtle">{g.label}</p>
                      <ul className="flex flex-col overflow-hidden rounded-lg border border-line">
                        {rows.map((f) => (
                          <li key={f.id} className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2 last:border-b-0">
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium text-ink-strong">{f.label}</span>
                              <span className="block truncate text-[11.5px] text-ink-muted">{f.preview(found)}</span>
                            </span>
                            <Toggle checked={chosen.has(f.id)} onChange={(v) => toggle(f.id, v)} label={`Import ${f.label}`} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
                {fields_missing(found).length > 0 && (
                  <p className="text-[11.5px] text-ink-faint">Not on this account: {fields_missing(found).join(', ').toLowerCase()}.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="hidden flex-col gap-2 md:flex">
          <p className={LABEL}>Live preview</p>
          <div className={`transition-opacity ${found ? '' : 'opacity-60'}`}>
            <div className={preview.layout === 'card' ? '' : 'rounded-2xl border border-line bg-bg p-3'}>
              <ProfileCard key={found?.id || 'none'} profile={{ ...preview, links: preview.links.filter((l) => l.url) }} compact />
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-faint">{found ? 'Toggle things on the left to see them land.' : 'Your card, as it is now.'}</p>
        </aside>
      </div>
    </Modal>
  )
}

const fields_missing = (u) => IMPORT_FIELDS.filter((f) => !f.has(u) && f.id !== 'handle' && f.id !== 'link').map((f) => f.label)

function FlairTile({ current, option, accent, onSelect, sample }) {
  const on = current === option.id
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onSelect(option.id)}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-center outline-none transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${on ? 'border-ink-strong' : 'border-line hover:border-line-strong'}`}
    >
      <span className="grid h-14 place-items-center">{sample}</span>
      <span className="text-[12.5px] font-medium text-ink-strong">{option.label}</span>
      {option.description && <span className="text-[10.5px] leading-snug text-ink-muted">{option.description}</span>}
      <span className="sr-only">{accent.label}</span>
    </button>
  )
}

function ChipInput({ id, chips, onChange, max, maxLength, placeholder }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const full = chips.length >= max

  const add = (raw) => {
    const value = raw.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    if (!value || full) return
    if (chips.some((c) => c.toLowerCase() === value.toLowerCase())) return setDraft('')
    onChange([...chips, value])
    setDraft('')
  }
  const remove = (i) => onChange(chips.filter((_, idx) => idx !== i))

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && chips.length) {
      remove(chips.length - 1)
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={`${INPUT} flex h-auto min-h-9 cursor-text flex-wrap items-center gap-1.5 py-1.5 focus-within:border-line-strong focus-within:bg-surface`}
    >
      {chips.map((c, i) => (
        <span key={c} className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface pl-2 pr-1 text-[12px] text-ink animate-menu-in">
          {c}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(i) }}
            aria-label={`Remove ${c}`}
            className="grid h-4 w-4 cursor-pointer place-items-center rounded text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink-strong"
          >
            <Icon name="x" className="h-3 w-3" strokeWidth={2.2} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={draft}
        disabled={full}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft && add(draft)}
        placeholder={full ? '' : chips.length ? '' : placeholder}
        className="min-w-[120px] flex-1 bg-transparent text-[13.5px] text-ink-strong placeholder:text-ink-faint focus:outline-none disabled:cursor-default"
      />
    </div>
  )
}

function LinksEditor({ id, links, onChange, errors }) {
  const update = (k, patch) => onChange(links.map((l) => (l._k === k ? { ...l, ...patch } : l)))
  const remove = (k) => onChange(links.filter((l) => l._k !== k))
  const add = () => onChange([...links, { _k: ++keySeq, label: '', url: '' }])
  const full = links.length >= LIMITS.links

  return (
    <div className="flex flex-col gap-2.5">
      {links.length === 0 && (
        <p className="text-[12.5px] text-ink-subtle">No links yet. GitHub, X, Discord, YouTube and the like get their own icon.</p>
      )}
      {links.map((l, i) => {
        const err = errors?.[l._k]
        return (
          <div key={l._k} className="animate-menu-in">
            <div className="grid grid-cols-[32px_minmax(0,2fr)_minmax(0,3fr)_32px] items-center gap-2">
              <span className="grid h-9 w-8 place-items-center text-ink-subtle">
                <LinkIcon url={l.url} className="h-4 w-4" />
              </span>
              <input
                type="text"
                aria-label={`Link ${i + 1} label`}
                placeholder={hostLabel(l.url)}
                maxLength={LIMITS.linkLabel}
                value={l.label}
                onChange={(e) => update(l._k, { label: e.target.value })}
                className={INPUT}
              />
              <input
                type="url"
                inputMode="url"
                spellCheck={false}
                aria-label={`Link ${i + 1} URL`}
                placeholder="https://"
                value={l.url}
                onChange={(e) => update(l._k, { url: e.target.value })}
                aria-invalid={Boolean(err) || undefined}
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => remove(l._k)}
                aria-label="Remove link"
                className={`${BTN_GHOST} h-8 w-8 px-0`}
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
            {err && <p role="alert" className="mt-1 pl-10 text-[12px] text-red-500">{err}</p>}
          </div>
        )
      })}
      <div className="flex items-center justify-between">
        <button id={id} type="button" onClick={add} disabled={full} className={BTN_SECONDARY}>
          <Icon name="plus" className="h-3.5 w-3.5" /> Add link
        </button>
        <span className="text-[11px] text-ink-faint">{links.length}/{LIMITS.links}</span>
      </div>
    </div>
  )
}

const hostLabel = (url) => {
  const host = url ? hostOf(normalizeUrl(url) || url) : ''
  return host && host !== url ? host : 'Label'
}

function ShowcaseEditor({ id, items, onChange, errors }) {
  const update = (k, patch) => onChange(items.map((it) => (it._k === k ? { ...it, ...patch } : it)))
  const remove = (k) => onChange(items.filter((it) => it._k !== k))
  const add = () => onChange([...items, { _k: ++keySeq, title: '', description: '', url: '' }])
  const full = items.length >= LIMITS.showcase

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && (
        <p className="text-[12.5px] text-ink-subtle">Nothing yet. A project, a script, a design — anything with a title.</p>
      )}
      {items.map((it, i) => {
        const err = errors?.[it._k]
        return (
          <div key={it._k} className="rounded-lg border border-line bg-surface-raised/30 p-3 animate-menu-in">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_32px] items-center gap-2">
              <input
                type="text"
                aria-label={`Item ${i + 1} title`}
                placeholder="Title"
                maxLength={LIMITS.showcaseTitle}
                value={it.title}
                onChange={(e) => update(it._k, { title: e.target.value })}
                aria-invalid={Boolean(err?.title) || undefined}
                className={INPUT}
              />
              <input
                type="url"
                inputMode="url"
                spellCheck={false}
                aria-label={`Item ${i + 1} URL`}
                placeholder="https:// (optional)"
                value={it.url}
                onChange={(e) => update(it._k, { url: e.target.value })}
                aria-invalid={Boolean(err?.url) || undefined}
                className={INPUT}
              />
              <button type="button" onClick={() => remove(it._k)} aria-label="Remove item" className={`${BTN_GHOST} h-8 w-8 px-0`}>
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              aria-label={`Item ${i + 1} description`}
              placeholder="One line about it"
              maxLength={LIMITS.showcaseDescription}
              value={it.description}
              onChange={(e) => update(it._k, { description: e.target.value })}
              className={`${INPUT} mt-2`}
            />
            {(err?.title || err?.url) && <p role="alert" className="mt-1.5 text-[12px] text-red-500">{err.title || err.url}</p>}
          </div>
        )
      })}
      <div className="flex items-center justify-between">
        <button id={id} type="button" onClick={add} disabled={full} className={BTN_SECONDARY}>
          <Icon name="plus" className="h-3.5 w-3.5" /> Add item
        </button>
        <span className="text-[11px] text-ink-faint">{items.length}/{LIMITS.showcase}</span>
      </div>
    </div>
  )
}

function SectionOrder({ value, onChange }) {
  const visible = value
  const hidden = DEFAULT_SECTIONS.filter((id) => !value.includes(id))
  const move = (id, dir) => {
    const i = visible.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= visible.length) return
    const next = [...visible]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const toggle = (id, on) => onChange(on ? [...visible, id] : visible.filter((x) => x !== id))
  const row = (id, on, i) => {
    const meta = SECTIONS.find((s) => s.id === id)
    return (
      <li key={id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-[opacity,border-color] ${on ? 'border-line bg-surface' : 'border-transparent opacity-60'}`}>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink-strong">{meta.label}</span>
          <span className="block text-[11.5px] text-ink-muted">{meta.description}</span>
        </span>
        {on && (
          <span className="flex items-center">
            <button type="button" onClick={() => move(id, -1)} disabled={i === 0} aria-label={`Move ${meta.label} up`} className={`${BTN_GHOST} h-7 w-7 px-0`}>
              <Icon name="chevronDown" className="h-4 w-4 rotate-180" />
            </button>
            <button type="button" onClick={() => move(id, 1)} disabled={i === visible.length - 1} aria-label={`Move ${meta.label} down`} className={`${BTN_GHOST} h-7 w-7 px-0`}>
              <Icon name="chevronDown" className="h-4 w-4" />
            </button>
          </span>
        )}
        <Toggle checked={on} onChange={(v) => toggle(id, v)} label={`Show ${meta.label}`} />
      </li>
    )
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {visible.map((id, i) => row(id, true, i))}
      {hidden.map((id) => row(id, false, -1))}
    </ul>
  )
}

function LayoutTile({ layout, current, accent, onSelect }) {
  const on = current === layout.id
  const grad = { backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onSelect(layout.id)}
      className={`group flex cursor-pointer flex-col gap-2 rounded-xl border p-2 text-left outline-none transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${on ? 'border-ink-strong' : 'border-line hover:border-line-strong'}`}
    >
      <span aria-hidden="true" className="relative block h-[72px] w-full overflow-hidden rounded-lg border border-line bg-bg">
        {layout.id === 'card' && (
          <span className="absolute inset-x-3 top-2.5 block overflow-hidden rounded-md border border-line bg-surface">
            <span className="block h-4" style={grad} />
            <span className="ml-2 -mt-1.5 block h-3 w-3 rounded-full ring-2 ring-surface" style={grad} />
            <span className="ml-2 mt-1 block h-1 w-8 rounded bg-ink-muted" />
            <span className="ml-2 mb-2 mt-1 block h-1 w-12 rounded bg-line-strong" />
          </span>
        )}
        {layout.id === 'cover' && (
          <>
            <span className="block h-6 w-full" style={grad} />
            <span className="ml-3 -mt-1.5 block h-3.5 w-3.5 rounded-full ring-2 ring-bg" style={grad} />
            <span className="ml-3 mt-1 block h-1 w-8 rounded bg-ink-muted" />
            <span className="ml-3 mt-1 block h-1 w-14 rounded bg-line-strong" />
          </>
        )}
        {layout.id === 'minimal' && (
          <span className="flex h-full flex-col items-center justify-center gap-1">
            <span className="block h-4 w-4 rounded-full" style={grad} />
            <span className="block h-1 w-8 rounded bg-ink-muted" />
            <span className="block h-1 w-12 rounded bg-line-strong" />
          </span>
        )}
      </span>
      <span className="flex items-center justify-between px-0.5">
        <span className="text-[12.5px] font-medium text-ink-strong">{layout.label}</span>
        <span className={`grid h-4 w-4 place-items-center rounded-full border transition-colors ${on ? 'border-ink-strong bg-ink-strong text-ink-inverse' : 'border-line-strong'}`}>
          {on && <Icon name="check" className="h-2.5 w-2.5 animate-menu-in" strokeWidth={3} />}
        </span>
      </span>
      <span className="px-0.5 text-[11px] leading-snug text-ink-muted">{layout.description}</span>
    </button>
  )
}

function ImageRow({ label, description, preview, uploading, onPick, onRemove, extra }) {
  const ref = useRef(null)
  return (
    <Row label={label} description={description} align="start">
      {preview}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={ref} type="file" accept="image/*" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = '' }} className="hidden" tabIndex={-1} />
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading} className={BTN_SECONDARY}>
          {uploading ? <Spinner /> : <Icon name="upload" className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        {extra}
        {onRemove && <button type="button" onClick={onRemove} className={BTN_GHOST}>Remove</button>}
      </div>
    </Row>
  )
}

function DeleteDialog({ open, onClose, onConfirm, busy }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      tone="danger"
      title="Delete your profile?"
      description="Your public page goes away immediately and the handle is freed up. Your account is not affected."
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={BTN_GHOST}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} data-autofocus className={BTN_DANGER}>
            {busy ? 'Deleting…' : 'Delete profile'}
          </button>
        </>
      }
    />
  )
}

function Editor({ user }) {
  const toast = useToast()
  const id = useId()
  const account = profileOf(user)
  const [saved, setSaved] = useState(undefined)
  const [form, setForm] = useState(null)
  const [tab, setTab] = useState('basics')
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [handleStatus, setHandleStatus] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const closeImport = useCallback(() => setImportOpen(false), [])

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    fetchMyProfile(user.id)
      .then((row) => {
        if (cancelled) return
        setSaved(row)
        setForm(keyed(row || draftFromUser(user)))
      })
      .catch((err) => { if (!cancelled) setLoadError(messageFor(err, 'Could not load your profile.')) })
    return () => { cancelled = true }
  }, [user, attempt])

  const isNew = saved === null
  const dirty = useMemo(() => (form && saved ? fingerprint(form) !== fingerprint(saved) : Boolean(form)), [form, saved])

  const set = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }, [])
  const setField = (key) => (e) => set(key, e.target.value)

  const handle = form?.handle ?? ''
  useEffect(() => {
    if (!form) return
    const problem = handleProblem(handle)
    if (problem) return setHandleStatus(handle ? { kind: 'invalid', text: problem } : null)
    if (saved && handle === saved.handle) return setHandleStatus({ kind: 'own', text: 'Yours' })
    setHandleStatus({ kind: 'checking' })
    let cancelled = false
    const t = setTimeout(async () => {
      const free = await checkHandle(handle)
      if (cancelled) return
      setHandleStatus(free === null ? null : free ? { kind: 'ok', text: 'Available' } : { kind: 'taken', text: 'Taken' })
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [handle, saved?.handle])

  const validate = () => {
    const next = {}
    const over = (key, max) => { if (form[key].length > max) next[key] = `Keep it under ${max} characters.` }
    const name = form.name.trim()
    if (!name) next.name = 'Enter a display name.'
    else if (name.length > LIMITS.name) next.name = `Keep it under ${LIMITS.name} characters.`
    const hp = handleProblem(form.handle)
    if (hp) next.handle = hp
    else if (handleStatus?.kind === 'taken') next.handle = MESSAGES.handle_taken
    over('headline', LIMITS.headline); over('bio', LIMITS.bio); over('pronouns', LIMITS.pronouns)
    over('location', LIMITS.location); over('status', LIMITS.status); over('now', LIMITS.now)
    const website = normalizeUrl(form.website)
    if (website === null) next.website = 'Enter a valid URL.'
    else if (website.length > LIMITS.website) next.website = 'That URL is too long.'
    const tagText = form.tagText.trim().toUpperCase()
    if (tagText.length > LIMITS.tag) next.tagText = `Up to ${LIMITS.tag} characters.`
    else if (tagText && !/^[A-Z0-9]+$/.test(tagText)) next.tagText = 'Letters and numbers only.'
    if (form.accent === 'custom' && !HEX_RE.test(form.accentHex || '')) next.accentHex = 'Enter a colour like #5865f2.'

    const linkErrors = {}
    const links = []
    for (const l of form.links) {
      if (!l.url.trim() && !l.label.trim()) continue
      const url = normalizeUrl(l.url)
      if (!url) linkErrors[l._k] = 'Enter a valid URL.'
      else links.push({ label: l.label.trim().slice(0, LIMITS.linkLabel), url })
    }
    if (Object.keys(linkErrors).length) next.links = linkErrors

    const showErrors = {}
    const showcase = []
    for (const it of form.showcase) {
      const title = it.title.trim()
      if (!title && !it.url.trim() && !it.description.trim()) continue
      const url = normalizeUrl(it.url)
      if (!title) showErrors[it._k] = { title: 'Give it a title.' }
      else if (url === null) showErrors[it._k] = { url: 'Enter a valid URL.' }
      else showcase.push({ title: title.slice(0, LIMITS.showcaseTitle), description: it.description.trim().slice(0, LIMITS.showcaseDescription), url: url || '' })
    }
    if (Object.keys(showErrors).length) next.showcase = showErrors

    setErrors(next)
    if (Object.keys(next).length) {
      const first = Object.keys(next).find((k) => FIELD_TAB[k])
      if (first) setTab(FIELD_TAB[first])
      return null
    }
    return {
      ...form,
      name,
      headline: form.headline.trim(),
      bio: form.bio.trim(),
      pronouns: form.pronouns.trim(),
      location: form.location.trim(),
      status: form.status.trim(),
      now: form.now.trim(),
      website: website || '',
      links,
      showcase,
      skills: form.skills.slice(0, LIMITS.skills),
      sections: form.sections.length ? form.sections : DEFAULT_SECTIONS,
      tagText,
      tagBadgeUrl: tagText ? form.tagBadgeUrl : null,
      decoration: form.decoration === 'image' && !form.decorationUrl ? 'none' : form.decoration,
      nameplate: form.nameplate === 'image' && !form.nameplateAsset ? 'none' : form.nameplate,
    }
  }

  const importFromDiscord = (discordUser, chosen) => {
    setForm((f) => keyed(applyImports({ ...f, links: stripKeys(f.links), showcase: stripKeys(f.showcase) }, discordUser, chosen)))
    setErrors({})
    setError(null)
    toast(`Imported from Discord — save to apply`)
  }

  const save = async (e) => {
    e?.preventDefault()
    if (busy || !form) return
    const clean = validate()
    if (!clean) return setError(MESSAGES.invalid)
    setBusy(true)
    setError(null)
    try {
      const row = await saveProfile(user.id, clean)
      setSaved(row)
      setForm(keyed(row))
      toast(isNew ? 'Profile created' : 'Profile saved')
    } catch (err) {
      if (err.code === 'handle_taken') {
        setErrors((prev) => ({ ...prev, handle: MESSAGES.handle_taken }))
        setHandleStatus({ kind: 'taken', text: 'Taken' })
        setTab('basics')
      }
      setError(messageFor(err, 'Could not save your profile.'))
    } finally {
      setBusy(false)
    }
  }

  const discard = () => {
    setForm(keyed(saved || draftFromUser(user)))
    setErrors({})
    setError(null)
  }

  const pickImage = (kind) => async (file) => {
    if (!file || uploading) return
    setUploading(kind)
    try {
      const url = await (kind === 'avatar' ? uploadAvatar : uploadCover)(user.id, file)
      set(kind, url)
      toast(`${kind === 'avatar' ? 'Photo' : 'Cover'} uploaded — save to apply`)
    } catch (err) {
      toast(messageFor(err, 'Could not upload that image.'), 'error')
    } finally {
      setUploading(null)
    }
  }
  const clearAvatar = () => { set('avatar', null); removeAvatar(user.id) }
  const clearCover = () => { set('cover', null); removeCover(user.id) }

  const destroy = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteProfile(user.id)
      setConfirmDelete(false)
      setSaved(null)
      setForm(keyed(draftFromUser(user)))
      setErrors({})
      setError(null)
      setTab('basics')
      toast('Profile deleted')
    } catch (err) {
      toast(messageFor(err, 'Could not delete your profile.'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface px-6 py-14 text-center animate-rise-in">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-raised text-ink-subtle"><Icon name="user" className="h-5 w-5" /></span>
        <div>
          <p className="text-[15px] font-medium text-ink-strong">Could not load your profile</p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13px] leading-relaxed text-ink-muted">{loadError}</p>
        </div>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={BTN_SECONDARY}>
          <Icon name="refresh" className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    )
  }
  if (!form) return <Skeleton />

  const live = saved && saved.visibility !== 'private'
  const visibility = VISIBILITY.find((v) => v.value === form.visibility) || VISIBILITY[2]
  const canUseAccountPhoto = account.avatar && form.avatar !== account.avatar
  const accent = accentOf(form)
  const flagged = new Set(Object.keys(errors).filter((k) => errors[k]).map((k) => FIELD_TAB[k]))
  const tabs = TABS.map((t) => ({ ...t, badge: flagged.has(t.id) }))
  const grid = 'grid gap-4 px-5 py-4 sm:grid-cols-2'

  return (
    <form onSubmit={save} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        {isNew && (
          <InfoNote icon="user">
            <span className="font-medium text-ink-strong">You don&apos;t have a profile yet.</span> Fill in the basics and hit <span className="font-medium text-ink-strong">Create profile</span> — it stays private until you publish it.
          </InfoNote>
        )}

        <TabStrip tabs={tabs} value={tab} onChange={setTab} label="Profile sections" />

        <div key={tab} className="settings-stagger flex flex-col gap-5">
          {tab === 'basics' && (
            <Section id="identity" title="Identity" description="Who you are, at a glance. The handle becomes your URL.">
              <Row label="Import from Discord" description={form.discordId ? `Discord ID ${form.discordId}. Import again to refresh.` : 'Just your user ID — pulls name, photo, banner, decoration, nameplate and server tag.'}>
                <button type="button" onClick={() => setImportOpen(true)} className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>
                  <DiscordMark className="h-3 w-3" /> {form.discordId ? 'Re-import' : 'Import'}
                </button>
              </Row>
              <ImageRow
                label="Photo"
                description="Square works best. Resized to 320px before upload."
                preview={<ProfileAvatar profile={form} size={56} />}
                uploading={uploading === 'avatar'}
                onPick={pickImage('avatar')}
                onRemove={form.avatar ? clearAvatar : null}
                extra={canUseAccountPhoto && <button type="button" onClick={() => set('avatar', account.avatar)} className={BTN_GHOST}>Use account photo</button>}
              />
              <div className={grid}>
                <Field label="Display name" htmlFor={`${id}-name`} error={errors.name} hint={`${form.name.length}/${LIMITS.name}`}>
                  <input id={`${id}-name`} type="text" autoComplete="nickname" maxLength={LIMITS.name} value={form.name} onChange={setField('name')} aria-invalid={Boolean(errors.name) || undefined} className={INPUT} />
                </Field>
                <Field label="Handle" htmlFor={`${id}-handle`} error={errors.handle} hint={`${form.handle.length}/${LIMITS.handle}`}>
                  <HandleInput id={`${id}-handle`} value={form.handle} onChange={(v) => set('handle', v)} status={handleStatus} invalid={Boolean(errors.handle)} />
                </Field>
                <Field label="Headline" htmlFor={`${id}-headline`} error={errors.headline} hint={`${form.headline.length}/${LIMITS.headline}`}>
                  <input id={`${id}-headline`} type="text" maxLength={LIMITS.headline} placeholder="Frontend developer · FiveM scripter" value={form.headline} onChange={setField('headline')} aria-invalid={Boolean(errors.headline) || undefined} className={INPUT} />
                </Field>
                <Field label="Pronouns" htmlFor={`${id}-pronouns`} error={errors.pronouns}>
                  <input id={`${id}-pronouns`} type="text" maxLength={LIMITS.pronouns} placeholder="they/them" value={form.pronouns} onChange={setField('pronouns')} aria-invalid={Boolean(errors.pronouns) || undefined} className={INPUT} />
                </Field>
                <Field label="Status" htmlFor={`${id}-status`} error={errors.status} hint={`${form.status.length}/${LIMITS.status}`} className="sm:col-span-2">
                  <input id={`${id}-status`} type="text" maxLength={LIMITS.status} placeholder="🔨 Building a Discord bot" value={form.status} onChange={setField('status')} aria-invalid={Boolean(errors.status) || undefined} className={INPUT} />
                </Field>
              </div>
            </Section>
          )}

          {tab === 'about' && (
            <>
              <Section id="about" title="About" description="A few lines about you and where to find you.">
                <div className={grid}>
                  <Field label="Bio" htmlFor={`${id}-bio`} error={errors.bio} hint={`${form.bio.length}/${LIMITS.bio}`} className="sm:col-span-2">
                    <textarea id={`${id}-bio`} maxLength={LIMITS.bio} rows={4} placeholder="What you do, what you're into, what you're working on." value={form.bio} onChange={setField('bio')} aria-invalid={Boolean(errors.bio) || undefined} className={TEXTAREA} />
                  </Field>
                  <Field label="Location" htmlFor={`${id}-location`} error={errors.location}>
                    <input id={`${id}-location`} type="text" autoComplete="address-level2" maxLength={LIMITS.location} placeholder="Athens, GR" value={form.location} onChange={setField('location')} aria-invalid={Boolean(errors.location) || undefined} className={INPUT} />
                  </Field>
                  <Field label="Website" htmlFor={`${id}-website`} error={errors.website}>
                    <input id={`${id}-website`} type="url" autoComplete="url" inputMode="url" spellCheck={false} placeholder="https://" value={form.website} onChange={setField('website')} aria-invalid={Boolean(errors.website) || undefined} className={INPUT} />
                  </Field>
                </div>
                <Row label="Open to work" description="Shows a green badge under your name." htmlFor={`${id}-otw`}>
                  <Toggle id={`${id}-otw`} checked={form.openToWork} onChange={(v) => set('openToWork', v)} label="Open to work" />
                </Row>
              </Section>
              <Section id="now" title="Now" description="What you're up to at the moment. Its own section on the page; leave it empty to hide it.">
                <div className="px-5 py-4">
                  <Field label="Right now" htmlFor={`${id}-now`} error={errors.now} hint={`${form.now.length}/${LIMITS.now}`}>
                    <textarea id={`${id}-now`} maxLength={LIMITS.now} rows={3} placeholder="Rebuilding my portfolio, learning Go, looking for a summer internship." value={form.now} onChange={setField('now')} aria-invalid={Boolean(errors.now) || undefined} className={TEXTAREA} />
                  </Field>
                </div>
              </Section>
            </>
          )}

          {tab === 'content' && (
            <>
              <Section id="links" title="Links" description={`Up to ${LIMITS.links}. GitHub, X, Discord, YouTube and friends get their own icon.`}>
                <div className="px-5 py-4">
                  <LinksEditor id={`${id}-links`} links={form.links} onChange={(v) => set('links', v)} errors={errors.links} />
                </div>
              </Section>
              <Section id="showcase" title="Showcase" description={`Up to ${LIMITS.showcase} things you made, as cards.`}>
                <div className="px-5 py-4">
                  <ShowcaseEditor id={`${id}-showcase`} items={form.showcase} onChange={(v) => set('showcase', v)} errors={errors.showcase} />
                </div>
              </Section>
              <Section id="skills" title="Skills & interests" description={`Short tags, up to ${LIMITS.skills}. Enter or comma adds one.`}>
                <div className="px-5 py-4">
                  <ChipInput id={`${id}-skills`} chips={form.skills} onChange={(v) => set('skills', v)} max={LIMITS.skills} maxLength={LIMITS.skill} placeholder="React, Lua, UI design…" />
                  <p className="mt-2 text-right text-[11px] text-ink-faint">{form.skills.length}/{LIMITS.skills}</p>
                </div>
              </Section>
              <Section id="order" title="Sections" description="Choose what shows and in what order. Empty sections are skipped anyway.">
                <div className="px-5 py-4">
                  <SectionOrder value={form.sections} onChange={(v) => set('sections', v)} />
                </div>
              </Section>
            </>
          )}

          {tab === 'design' && (
            <>
              <Section id="layout" title="Layout" description="How the page is arranged.">
                <div role="radiogroup" aria-label="Layout" className="grid gap-3 px-5 py-4 sm:grid-cols-3">
                  {LAYOUTS.map((l) => <LayoutTile key={l.id} layout={l} current={form.layout} accent={accent} onSelect={(v) => set('layout', v)} />)}
                </div>
              </Section>
              <Section id="banner" title="Banner" description="Colour, texture and an optional cover photo. Minimal layout uses the colour for the avatar ring only.">
                <Row label="Accent" description="Fixed colours look the same to everyone; Mono follows their theme." align="start">
                  <div className="flex flex-col gap-1.5">
                    <Swatches value={form.accent} hex={form.accentHex} onChange={(v) => set('accent', v)} onHex={(v) => { set('accentHex', v); if (form.accent !== 'custom') set('accent', 'custom') }} />
                    {errors.accentHex && <p role="alert" className="text-[12px] text-red-500">{errors.accentHex}</p>}
                  </div>
                </Row>
                <Row label="Texture" description="Drawn over the colour when there is no cover photo.">
                  <Segmented label="Texture" value={form.pattern} onChange={(v) => set('pattern', v)} options={PATTERNS.map((p) => ({ value: p.id, label: p.label }))} />
                </Row>
                <ImageRow
                  label="Cover photo"
                  description="Wide, at least 1200×480. Cropped to 5:2 and resized before upload."
                  preview={
                    <span className="block h-12 w-[120px] shrink-0 overflow-hidden rounded-md border border-line" style={{ backgroundImage: form.cover ? undefined : `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}>
                      {form.cover && <img src={form.cover} alt="" className="h-full w-full object-cover" />}
                    </span>
                  }
                  uploading={uploading === 'cover'}
                  onPick={pickImage('cover')}
                  onRemove={form.cover ? clearCover : null}
                />
              </Section>
              <Section id="details" title="Details">
                <Row label="Avatar shape">
                  <Segmented label="Avatar shape" value={form.avatarShape} onChange={(v) => set('avatarShape', v)} options={AVATAR_SHAPES.map((a) => ({ value: a.id, label: a.label }))} />
                </Row>
                <Row label="Page theme" description="Force light or dark for visitors, or follow their own setting.">
                  <Segmented label="Page theme" value={form.theme} onChange={(v) => set('theme', v)} options={PAGE_THEMES.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))} />
                </Row>
              </Section>
              <Section id="flair" title="Flair" description="Little extras around your name and photo. The Discord ones come from Import from Discord on the Basics tab.">
                <Row label="Avatar decoration" description="Drawn around the photo." align="start" wide>
                  <div role="radiogroup" aria-label="Avatar decoration" className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5">
                    {DECORATIONS.filter((d) => d.id !== 'image' || form.decorationUrl).map((d) => (
                      <FlairTile
                        key={d.id}
                        option={d}
                        current={form.decoration}
                        accent={accent}
                        onSelect={(v) => set('decoration', v)}
                        sample={<DecoratedAvatar profile={{ ...form, decoration: d.id }} size={36} />}
                      />
                    ))}
                  </div>
                  {form.decorationUrl && (
                    <button type="button" onClick={() => { set('decorationUrl', null); if (form.decoration === 'image') set('decoration', 'none') }} className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>
                      <Icon name="trash" className="h-3.5 w-3.5" /> Forget the Discord decoration
                    </button>
                  )}
                </Row>
                <Row label="Nameplate" description="A strip behind your name." align="start" wide>
                  <div role="radiogroup" aria-label="Nameplate" className="grid w-full grid-cols-3 gap-2">
                    {NAMEPLATES.filter((n) => n.id !== 'image' || form.nameplateAsset).map((n) => (
                      <FlairTile
                        key={n.id}
                        option={n}
                        current={form.nameplate}
                        accent={accent}
                        onSelect={(v) => set('nameplate', v)}
                        sample={
                          <span className="relative block h-9 w-full min-w-[96px] overflow-hidden rounded-md border border-line bg-surface">
                            {n.id === 'accent' && <span className="absolute inset-0 opacity-25" style={{ backgroundImage: `linear-gradient(90deg, transparent, ${accent.from}, ${accent.to})` }} />}
                            {n.id === 'image' && form.nameplateAsset && (
                              <>
                                <span className="absolute inset-0" style={{ backgroundImage: `linear-gradient(90deg, transparent, ${paletteColor(form.nameplatePalette)}44)` }} />
                                <img src={nameplateImage(form.nameplateAsset)} alt="" referrerPolicy="no-referrer" className="absolute inset-y-0 right-0 h-full w-auto max-w-none" style={{ maskImage: 'linear-gradient(90deg, transparent, black 45%)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 45%)' }} />
                              </>
                            )}
                            <span className="absolute left-2 top-1/2 h-1.5 w-10 -translate-y-1/2 rounded bg-ink-muted" />
                          </span>
                        }
                      />
                    ))}
                  </div>
                  {form.nameplateAsset && (
                    <button type="button" onClick={() => { set('nameplateAsset', null); set('nameplatePalette', null); if (form.nameplate === 'image') set('nameplate', 'none') }} className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>
                      <Icon name="trash" className="h-3.5 w-3.5" /> Forget the Discord nameplate
                    </button>
                  )}
                </Row>
                <Row label="Server tag" description={`Up to ${LIMITS.tag} letters next to your name, like Discord's. The badge only comes from an import.`} htmlFor={`${id}-tag`} align="start">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      {form.tagBadgeUrl && <img src={form.tagBadgeUrl} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded" />}
                      <input
                        id={`${id}-tag`}
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={LIMITS.tag}
                        placeholder="BLXR"
                        value={form.tagText}
                        onChange={(e) => set('tagText', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        aria-invalid={Boolean(errors.tagText) || undefined}
                        className={`${INPUT} w-24 font-mono uppercase`}
                      />
                      {form.tagBadgeUrl && <button type="button" onClick={() => set('tagBadgeUrl', null)} className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>Drop badge</button>}
                    </div>
                    {errors.tagText && <p role="alert" className="text-[12px] text-red-500">{errors.tagText}</p>}
                  </div>
                </Row>
              </Section>
            </>
          )}

          {tab === 'publish' && (
            <>
              <Section id="visibility" title="Visibility" description="Who can open your page.">
                <Row label="Who can see it" description={visibility.description} align="start">
                  <Segmented
                    label="Visibility"
                    value={form.visibility}
                    onChange={(v) => set('visibility', v)}
                    options={VISIBILITY.map((v) => ({ value: v.value, label: v.label, icon: v.value === 'public' ? 'globe' : v.value === 'unlisted' ? 'link' : 'lock' }))}
                  />
                </Row>
                <Row label="Your URL" description={live ? 'Live now.' : saved ? 'Goes live once the profile is not private.' : 'Appears once the profile is created.'}>
                  <code className="truncate font-mono text-[12.5px] text-ink-muted">blxr.net/@{form.handle || '…'}</code>
                  {saved && <CopyButton text={profileUrl(saved.handle)} label="Copy" />}
                  {saved && (
                    <a href={profilePath(saved.handle)} target="_blank" rel="noreferrer" className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>
                      <Icon name="arrowUpRight" className="h-3.5 w-3.5" /> Open
                    </a>
                  )}
                </Row>
              </Section>
              {saved && (
                <Section id="danger" tone="danger" title="Delete profile" description="Removes your public page and frees the handle. Your account stays.">
                  <Row label="Delete this profile" description="This cannot be undone.">
                    <button type="button" onClick={() => setConfirmDelete(true)} className={BTN_DANGER}>Delete profile</button>
                  </Row>
                </Section>
              )}
            </>
          )}
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="sticky bottom-4 z-20">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg">
            <span key={`${isNew}-${dirty}`} className="flex items-center gap-1.5 text-[12.5px] text-ink-subtle animate-menu-in">
              {!dirty && !isNew && <Icon name="check" className="h-3.5 w-3.5" />}
              {isNew ? 'Not created yet' : dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <span className="flex items-center gap-2">
              {dirty && !isNew && <button type="button" onClick={discard} className={BTN_GHOST}>Discard</button>}
              <button type="submit" disabled={busy || (!dirty && !isNew) || handleStatus?.kind === 'checking'} className={BTN_PRIMARY}>
                {busy ? (isNew ? 'Creating…' : 'Saving…') : isNew ? 'Create profile' : 'Save changes'}
              </button>
            </span>
          </div>
        </div>
      </div>

      <aside className="order-first flex flex-col gap-3 animate-rise-in lg:order-none lg:sticky lg:top-[72px]">
        <div className="flex items-center justify-between gap-2">
          <p className={LABEL}>Live preview</p>
          <span className="flex items-center gap-2">
            <Badge tone={form.visibility === 'public' ? 'ok' : form.visibility === 'unlisted' ? 'warn' : 'neutral'}>{visibility.label}</Badge>
            <button
              type="button"
              onClick={() => setPreviewOpen((o) => !o)}
              aria-expanded={previewOpen}
              className={`${BTN_GHOST} h-7 px-2 text-[12px] lg:hidden`}
            >
              <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform duration-200 ${previewOpen ? 'rotate-180' : ''}`} />
              {previewOpen ? 'Hide' : 'Show'}
            </button>
          </span>
        </div>
        <div className={`${previewOpen ? 'flex' : 'hidden lg:flex'} flex-col gap-3`}>
          <div className={form.layout === 'card' ? '' : 'rounded-2xl border border-line bg-bg p-3'}>
            <ProfileCard profile={form} compact className={form.layout === 'card' ? 'shadow-sm' : ''} />
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            This is what visitors see at <span className="font-mono">blxr.net/@{form.handle || '…'}</span>.
          </p>
        </div>
      </aside>

      <DeleteDialog open={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)} onConfirm={destroy} busy={deleting} />
      <ImportDialog open={importOpen} onClose={closeImport} form={form} onApply={importFromDiscord} />
    </form>
  )
}

export default function DashboardProfile({ user }) {
  const device = useDevicePrefs()
  return (
    <ToastProvider>
      <DensityProvider value={device.density}>
        <Editor user={user} />
      </DensityProvider>
    </ToastProvider>
  )
}

