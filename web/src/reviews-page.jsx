import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Stars, StarPicker } from './components/star-rating'
import { useI18n } from './lib/i18n'
import { link, useRouteHash, HOME_PATH } from './lib/router'
import { fetchReviews, submitReview } from './lib/api'
import { CONTACT_EMAIL } from './lib/profile'
import {
  REVIEW_LIMITS,
  RATINGS,
  SORTS,
  PAGE_SIZE,
  summarize,
  sortReviews,
  initials,
  relativeTime,
  absoluteTime,
  validateDraft,
  deviceToken,
  readOwnReview,
  rememberOwnReview,
  forgetOwnReview,
} from './lib/reviews'

const LABEL = 'text-[11px] font-mono font-semibold text-ink-subtle uppercase tracking-wider'
const CHIP = 'px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap'
const CTA =
  'group inline-flex h-10 items-center gap-2 rounded-full bg-surface-inverted ps-5 pe-4 text-[13px] font-medium text-ink-on-inverted outline-none transition-[transform,opacity] duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer'

const inputClass = (invalid) =>
  `w-full rounded-xl border bg-surface-raised/60 px-3.5 py-2.5 text-[13.5px] text-ink-strong placeholder:text-ink-faint transition-colors focus:outline-none focus:bg-surface ${
    invalid ? 'border-red-500/60 focus:border-red-500/80' : 'border-line hover:border-line-strong focus:border-line-strong'
  }`

function Field({ id, label, hint, counter, error, group = false, children }) {
  const Label = group ? 'span' : 'label'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={group ? undefined : id} id={group ? `${id}-label` : undefined} className={LABEL}>
          {label}
          {hint && <span className="ms-1.5 font-normal normal-case tracking-normal text-ink-faint">· {hint}</span>}
        </Label>
        {counter && (
          <span className={`font-mono text-[10.5px] tabular-nums ${counter.over ? 'text-red-500' : 'text-ink-faint'}`}>
            {counter.text}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}

function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-hover ${className}`} />
}

function LoadingState() {
  return (
    <div className="w-full">
      <div className="mb-8 grid grid-cols-1 gap-8 rounded-2xl border border-line bg-surface-raised/40 p-6 sm:grid-cols-[auto_1fr] sm:gap-12 sm:p-7">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-14 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="flex flex-col justify-center gap-3">
          {RATINGS.map((n) => <Skeleton key={n} className="h-2 w-full" />)}
        </div>
      </div>
      <div className="border-t border-line">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3.5 border-b border-line py-6">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Summary({ summary, filter, onFilter, t, plural }) {
  const { count, average, distribution } = summary
  return (
    <section
      aria-label={t('rev.breakdown')}
      className="mb-8 grid w-full grid-cols-1 gap-8 rounded-2xl border border-line bg-surface-raised/40 p-6 sm:grid-cols-[auto_1fr] sm:gap-12 sm:p-7"
    >
      <div className="flex flex-col items-start">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[56px] font-bold leading-none tracking-[-0.045em] text-ink-strong tabular-nums">
            {average.toFixed(1)}
          </span>
          <span className="text-[14px] font-medium text-ink-subtle">/ 5</span>
        </div>
        <Stars value={average} size={16} className="mt-3.5" />
        <p className="mt-2.5 text-[12px] text-ink-muted">{plural('rev.basedOn', count)}</p>
      </div>

      <div className="flex flex-col justify-center gap-1" role="group" aria-label={t('rev.breakdown')}>
        {RATINGS.map((n) => {
          const c = distribution[n]
          const pct = count ? (c / count) * 100 : 0
          const active = filter === n
          return (
            <button
              key={n}
              type="button"
              disabled={!c}
              aria-pressed={active}
              aria-label={t('rev.onlyStars', { n })}
              onClick={() => onFilter(active ? null : n)}
              className="group -mx-1.5 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-1.5 py-1 text-left transition-colors enabled:cursor-pointer enabled:hover:bg-surface-hover disabled:cursor-default"
            >
              <span className={`w-[3ch] font-mono text-[12px] tabular-nums ${active ? 'text-ink-strong' : 'text-ink-muted'}`}>
                {n}
                <span aria-hidden="true" className="text-ink-faint">★</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                <span
                  className={`block h-full rounded-full transition-[width,background-color] duration-500 ${
                    active ? 'bg-ink-strong' : c ? 'bg-ink-muted group-hover:bg-ink-strong' : 'bg-transparent'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className={`w-[3ch] text-right font-mono text-[12px] tabular-nums ${active ? 'text-ink-strong' : 'text-ink-subtle'}`}>
                {c}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ReviewCard({ item, lang, isOwn, highlighted, copied, onCopyId, t }) {
  return (
    <article id={`review-${item.id}`} className={`border-b border-line py-6 ${highlighted ? 'animate-rise-in' : ''}`}>
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full border border-line bg-surface-raised text-[12px] font-semibold tracking-tight text-ink-secondary"
        >
          {initials(item.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="max-w-full truncate text-[14.5px] font-semibold tracking-tight text-ink-strong">{item.name}</h3>
            {isOwn && (
              <span className="rounded-md border border-line bg-surface-raised px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                {t('rev.you')}
              </span>
            )}
            <time
              dateTime={item.at}
              title={absoluteTime(item.at, lang)}
              className="ms-auto whitespace-nowrap font-mono text-[11px] text-ink-subtle"
            >
              {relativeTime(item.at, lang)}
            </time>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Stars value={item.rating} size={12} />
            {item.role && <span className="truncate text-[12px] text-ink-subtle">{item.role}</span>}
          </div>
        </div>
      </div>

      <p className="mt-3.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-secondary sm:ps-[52px]">{item.text}</p>

      <div className="mt-3 sm:ps-[52px]">
        <button
          type="button"
          onClick={() => onCopyId(item.id)}
          title={t('rev.copyId')}
          aria-label={t('rev.copyId')}
          className="cursor-pointer font-mono text-[10.5px] text-ink-faint transition-colors hover:text-ink-muted"
        >
          {copied ? t('contact.copied') : `#${item.id}`}
        </button>
      </div>
    </article>
  )
}

function OwnNote({ own, t }) {
  const subject = encodeURIComponent(`Review #${own.id}`)
  return (
    <div className="rounded-2xl border border-dashed border-line-strong p-6 sm:p-7">
      <p className="text-[14.5px] font-semibold tracking-tight text-ink-strong">{t('rev.own.title')}</p>
      <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-ink-muted">{t('rev.own.body')}</p>
      <a
        href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}
        className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:text-ink-strong"
      >
        <span>{t('cmd.sendEmail')}</span>
        <span aria-hidden="true">→</span>
      </a>
    </div>
  )
}

function SuccessNote({ published, onView, t }) {
  return (
    <div className="animate-rise-in rounded-2xl border border-line bg-surface-raised/40 p-6 sm:p-7">
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l5 5 10-10.5" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold tracking-tight text-ink-strong">{t('rev.success.title', { name: published.name })}</p>
          <p className="mt-1 text-[13px] text-ink-muted">{t('rev.success.body')}</p>
          <button
            type="button"
            onClick={onView}
            className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:text-ink-strong"
          >
            <span>{t('rev.success.view')}</span>
            <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function retryPhrase(seconds, lang) {
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'always' })
    if (seconds >= 86_400) return rtf.format(Math.ceil(seconds / 86_400), 'day')
    if (seconds >= 3600) return rtf.format(Math.ceil(seconds / 3600), 'hour')
    return rtf.format(Math.max(1, Math.ceil(seconds / 60)), 'minute')
  } catch {
    return ''
  }
}

const EMPTY_DRAFT = { name: '', role: '', rating: 0, text: '', website: '' }

function ReviewForm({ own, nameRef, onPublished, onView }) {
  const { t, lang } = useI18n()
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState('idle')
  const [serverError, setServerError] = useState(null)
  const [serverErrors, setServerErrors] = useState({})
  const [published, setPublished] = useState(null)

  const errors = validateDraft(draft)
  const kindOf = (field) => errors[field] || serverErrors[field]
  const visible = (field) => Boolean(kindOf(field)) && (touched[field] || attempted || field in serverErrors)

  const set = (field) => (value) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
    if (Object.keys(serverErrors).length) setServerErrors({})
    if (serverError) setServerError(null)
  }
  const touch = (field) => () => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))

  const fieldError = (field) => {
    if (!visible(field)) return null
    const kind = kindOf(field)
    if (field === 'rating') return null
    if (kind === 'link') return t('rev.error.link')
    if (kind === 'blocked') return t('rev.error.blocked')
    const { min, max } = REVIEW_LIMITS[field]
    return min ? t('rev.error.length', { min, max }) : t('rev.error.max', { max })
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setAttempted(true)
    const first = ['name', 'role', 'rating', 'text'].find((field) => errors[field])
    if (first) {
      const el = event.currentTarget.querySelector(first === 'rating' ? 'input[name="rating"]' : `#rev-${first}`)
      el?.focus()
      return
    }

    setStatus('sending')
    setServerError(null)
    try {
      const item = await submitReview({
        name: draft.name.trim(),
        role: draft.role.trim(),
        rating: draft.rating,
        text: draft.text.trim(),
        website: draft.website,
        device: deviceToken(),
      })
      const result = item || {
        id: '',
        name: draft.name.trim(),
        role: draft.role.trim(),
        rating: draft.rating,
        text: draft.text.trim(),
        at: new Date().toISOString(),
      }
      setPublished(result)
      setStatus('done')
      onPublished(result)
    } catch (err) {
      setStatus('idle')
      const code = err?.code
      if (code === 'invalid' || code === 'link' || code === 'blocked') {
        const fields = err.fields?.length ? err.fields : ['text']
        setServerErrors(Object.fromEntries(fields.map((field) => [field, code === 'invalid' ? 'length' : code])))
        setServerError({ code })
      } else if (code === 'rate_limited') {
        setServerError({ code, when: retryPhrase(err.retryAfter || 3 * 86_400, lang) })
      } else if (code === 'busy' || code === 'full') {
        setServerError({ code: 'later' })
      } else {
        setServerError({ code: 'generic' })
      }
    }
  }

  if (status === 'done' && published) return <SuccessNote published={published} onView={() => onView(published.id)} t={t} />
  if (own) return <OwnNote own={own} t={t} />

  const textLength = draft.text.trim().length
  const sending = status === 'sending'
  const alert =
    serverError &&
    {
      invalid: t('rev.error.invalid'),
      link: t('rev.error.link'),
      blocked: t('rev.error.blocked'),
      rate_limited: t('rev.error.rateLimited', { when: serverError.when }),
      later: t('rev.error.later'),
      generic: t('rev.error.generic'),
    }[serverError.code]

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="rev-name" label={t('rev.form.name')} error={fieldError('name')}>
          <input
            id="rev-name"
            ref={nameRef}
            type="text"
            autoComplete="name"
            maxLength={REVIEW_LIMITS.name.max}
            value={draft.name}
            onChange={(e) => set('name')(e.target.value)}
            onBlur={touch('name')}
            aria-invalid={Boolean(visible('name')) || undefined}
            aria-describedby={visible('name') ? 'rev-name-error' : undefined}
            className={inputClass(visible('name'))}
          />
        </Field>
        <Field id="rev-role" label={t('rev.form.role')} hint={t('rev.form.optional')} error={fieldError('role')}>
          <input
            id="rev-role"
            type="text"
            autoComplete="organization-title"
            maxLength={REVIEW_LIMITS.role.max}
            value={draft.role}
            onChange={(e) => set('role')(e.target.value)}
            onBlur={touch('role')}
            aria-invalid={Boolean(visible('role')) || undefined}
            className={inputClass(visible('role'))}
          />
        </Field>
      </div>

      <Field id="rev-rating" group label={t('rev.form.rating')} error={fieldError('rating')}>
        <StarPicker value={draft.rating} onChange={set('rating')} invalid={visible('rating')} labelledBy="rev-rating-label" />
      </Field>

      <Field
        id="rev-text"
        label={t('rev.form.text')}
        counter={{ text: `${textLength}/${REVIEW_LIMITS.text.max}`, over: textLength > REVIEW_LIMITS.text.max }}
        error={fieldError('text')}
      >
        <textarea
          id="rev-text"
          rows={5}
          maxLength={REVIEW_LIMITS.text.max}
          value={draft.text}
          onChange={(e) => set('text')(e.target.value)}
          onBlur={touch('text')}
          placeholder={t('rev.form.textPlaceholder')}
          aria-invalid={Boolean(visible('text')) || undefined}
          aria-describedby={visible('text') ? 'rev-text-error' : undefined}
          className={`${inputClass(visible('text'))} min-h-[120px] resize-y leading-relaxed`}
        />
      </Field>

      <div aria-hidden="true" className="absolute -start-[9999px] top-0 h-px w-px overflow-hidden">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={draft.website}
            onChange={(e) => set('website')(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button type="submit" disabled={sending} className={CTA}>
          <span>{sending ? t('rev.form.submitting') : t('rev.form.submit')}</span>
          {!sending && <span className="inline-block transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>}
        </button>
        <p className="max-w-[44ch] text-[11.5px] leading-relaxed text-ink-faint">{t('rev.form.notice')}</p>
      </div>

      {alert && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[12.5px] text-red-500">
          {alert}
        </p>
      )}
    </form>
  )
}

function usePlural() {
  const { t, lang } = useI18n()
  return (key, n) => {
    let form = 'other'
    try {
      form = new Intl.PluralRules(lang).select(n)
    } catch {
    }
    return t(`${key}.${form}`, { n }, t(key, { n }))
  }
}

export default function ReviewsPage({ theme, onToggleTheme }) {
  const { t, lang } = useI18n()
  const plural = usePlural()
  const hash = useRouteHash()

  const [status, setStatus] = useState('loading')
  const [items, setItems] = useState([])
  const [sort, setSort] = useState('newest')
  const [filter, setFilter] = useState(null)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [own, setOwn] = useState(null)
  const [highlight, setHighlight] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const nameRef = useRef(null)
  const formRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const list = await fetchReviews()
      const remembered = readOwnReview()
      const stillThere = remembered && list.some((item) => item.id === remembered.id)
      if (remembered && !stillThere) forgetOwnReview()
      setItems(list)
      setOwn(stillThere ? remembered : null)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (window.location.hash !== '#write') window.scrollTo(0, 0)
    load()
  }, [load])

  const focusForm = useCallback(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 350)
  }, [])

  useEffect(() => {
    if (hash === '#write') focusForm()
  }, [hash, focusForm])

  useEffect(() => {
    if (!copiedId) return
    const timer = window.setTimeout(() => setCopiedId(null), 1500)
    return () => window.clearTimeout(timer)
  }, [copiedId])

  const summary = useMemo(() => summarize(items), [items])
  const ordered = useMemo(() => {
    const pool = filter ? items.filter((item) => item.rating === filter) : items
    return sortReviews(pool, sort)
  }, [items, filter, sort])
  const visible = ordered.slice(0, shown)
  const remaining = ordered.length - visible.length

  const onPublished = (item) => {
    if (item.id) {
      setItems((prev) => [item, ...prev.filter((r) => r.id !== item.id)])
      rememberOwnReview(item)
      setOwn({ id: item.id, at: item.at })
      setHighlight(item.id)
    }
    setSort('newest')
    setFilter(null)
  }

  const viewReview = (id) => {
    document.getElementById(`review-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const copyId = (id) => {
    navigator.clipboard?.writeText(id).then(() => setCopiedId(id)).catch(() => {})
  }

  const changeFilter = (next) => {
    setFilter(next)
    setShown(PAGE_SIZE)
  }

  const ready = status === 'ready'

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">

      <header className="w-full max-w-[880px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>{t('proj.backHome')}</span>
          </a>
          <div className="flex items-center gap-4">
            <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors duration-200" />
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="text-ink-muted hover:text-ink-strong transition-colors duration-200"
            />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[880px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen bg-bg animate-rise-in">

        <div className="w-full max-w-[620px] mb-10 text-left">
          <p className="text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em] mb-4">
            {t('rev.kicker')}
            {ready && summary.count > 0 && ` / ${plural('rev.count', summary.count)}`}
          </p>
          <h1 className="text-[34px] sm:text-[40px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-4">
            {t('rev.title')}
          </h1>
          <p className="text-[15px] sm:text-[16px] text-ink-muted font-normal leading-relaxed">
            {t('rev.tagline')}
          </p>
        </div>

        {status === 'loading' && <LoadingState />}

        {status === 'error' && (
          <div className="w-full rounded-2xl border border-line px-6 py-12 text-center">
            <p className="text-[13.5px] text-ink-muted">{t('rev.error.load')}</p>
            <button
              type="button"
              onClick={() => {
                setStatus('loading')
                load()
              }}
              className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface-raised px-4 py-2 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:text-ink-strong"
            >
              {t('rev.retry')}
            </button>
          </div>
        )}

        {ready && summary.count === 0 && (
          <div className="w-full rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
            <p className="text-[15px] font-semibold tracking-tight text-ink-strong">{t('rev.empty')}</p>
            <p className="mt-1.5 text-[13px] text-ink-muted">{t('rev.emptyHint')}</p>
            <button type="button" onClick={focusForm} className={`${CTA} mt-6`}>
              <span>{t('rev.write')}</span>
              <span aria-hidden="true">↓</span>
            </button>
          </div>
        )}

        {ready && summary.count > 0 && (
          <>
            <Summary summary={summary} filter={filter} onFilter={changeFilter} t={t} plural={plural} />

            <div className="mb-1 flex w-full flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label={t('rev.sortBy')}>
                {SORTS.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={sort === mode}
                    onClick={() => setSort(mode)}
                    className={`${CHIP} ${
                      sort === mode ? 'bg-ink-strong text-ink-inverse font-semibold' : 'text-ink-muted hover:text-ink-strong'
                    }`}
                  >
                    {t(`rev.sort.${mode}`)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {filter ? (
                  <button
                    type="button"
                    onClick={() => changeFilter(null)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-strong"
                  >
                    <span>{t('rev.onlyStars', { n: filter })}</span>
                    <span aria-hidden="true" className="text-ink-subtle">✕</span>
                  </button>
                ) : (
                  <span className="font-mono text-[11px] text-ink-subtle">{plural('rev.count', ordered.length)}</span>
                )}
                <button
                  type="button"
                  onClick={focusForm}
                  className="group inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink-strong"
                >
                  <span>{t('rev.write')}</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-y-0.5">↓</span>
                </button>
              </div>
            </div>

            <ol className="w-full border-t border-line">
              {visible.map((item) => (
                <li key={item.id}>
                  <ReviewCard
                    item={item}
                    lang={lang}
                    isOwn={own?.id === item.id}
                    highlighted={highlight === item.id}
                    copied={copiedId === item.id}
                    onCopyId={copyId}
                    t={t}
                  />
                </li>
              ))}
            </ol>

            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
                className="mt-6 inline-flex cursor-pointer items-center gap-2 self-center rounded-full border border-line-strong bg-surface-raised px-4 py-2 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:text-ink-strong"
              >
                <span>{t('rev.showMore')}</span>
                <span className="font-mono text-[11px] text-ink-subtle">+{remaining}</span>
              </button>
            )}
          </>
        )}

        <section
          id="write"
          ref={formRef}
          aria-labelledby="write-heading"
          className="mt-16 w-full scroll-mt-24 border-t border-dashed border-line pt-10"
        >
          <div className="mb-7 max-w-[560px]">
            <h2 id="write-heading" className="text-[22px] font-bold tracking-tight text-ink-strong">{t('rev.write')}</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{t('rev.form.intro')}</p>
          </div>
          <ReviewForm own={own} nameRef={nameRef} onPublished={onPublished} onView={viewReview} />
        </section>

      </main>
    </div>
  )
}
