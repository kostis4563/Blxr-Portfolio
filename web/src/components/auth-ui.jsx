import { useState, useEffect } from 'react'
import { authSignInWith, AUTH_PROVIDERS } from '../lib/auth'
import { SOCIAL_ICON_PATHS } from '../lib/profile'
import { strengthOf } from '../lib/password'
import { Icon } from './icon'

export const LABEL = 'text-[11px] font-mono font-semibold text-ink-subtle uppercase tracking-wider'
export const FIELD_LABEL = 'text-[13.5px] font-medium text-ink-strong'
export const FILLED =
  'h-12 w-full rounded-xl border border-transparent bg-surface-hover px-4 text-[14px] text-ink-strong placeholder:text-ink-subtle transition-[border-color,background-color,box-shadow] duration-200 hover:bg-surface-hover-strong focus:border-line-strong focus:bg-surface-hover focus:shadow-[0_0_0_4px_var(--hairline)] focus:outline-none aria-[invalid=true]:border-red-500/60'
export const SOLID_CTA =
  'inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ink-strong px-5 text-[14px] font-semibold text-ink-inverse outline-none transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'
export const TILE =
  'flex h-12 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong px-3 text-[13.5px] font-medium text-ink-strong outline-none transition-colors duration-200 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/50'
export const FORM_TITLE = 'text-center text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink-strong sm:text-[28px]'
export const FORM_TAGLINE = 'mx-auto mt-2.5 max-w-[340px] text-center text-[14px] leading-relaxed text-ink-muted'
export const STRONG_LINK = 'cursor-pointer whitespace-nowrap font-semibold text-ink-strong underline-offset-4 transition-colors hover:underline'
export const INPUT =
  'w-full rounded-xl border border-line bg-surface-raised/60 px-3.5 py-2.5 text-[13.5px] text-ink-strong placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-line-strong focus:bg-surface focus:outline-none aria-[invalid=true]:border-red-500/60'
export const CTA =
  'inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-ink-on-inverted/15 bg-surface-inverted px-5 text-[13px] font-medium text-ink-on-inverted outline-none transition-[transform,opacity] duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0'
export const PROVIDER =
  'flex h-10 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-raised/60 text-ink-muted outline-none transition-colors duration-200 hover:border-line-strong hover:text-ink-strong focus-visible:border-line-strong focus-visible:text-ink-strong'
export const SWITCH = 'cursor-pointer font-medium text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-strong'
export const QUIET = 'cursor-pointer text-[11px] text-ink-subtle transition-colors hover:text-ink-strong'

export const PROVIDER_ICONS = {
  google:
    'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  discord: SOCIAL_ICON_PATHS.Discord,
  github: SOCIAL_ICON_PATHS.GitHub,
}
export const PROVIDER_NAMES = { google: 'Google', discord: 'Discord', github: 'GitHub' }

const STRENGTH_LABEL = ['', 'Weak', 'Okay', 'Good', 'Strong']
const STRENGTH_COLOR = ['', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-500']

export function Field({ label, error, hint, children, labelClass = LABEL }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <span className={labelClass}>{label}</span>
        {hint}
      </span>
      {children}
      {error && <span role="alert" className="text-[12px] text-red-500">{error}</span>}
    </label>
  )
}

export function PasswordInput({ id, value, onChange, autoComplete, invalid, autoFocus, className = INPUT, placeholder, label, iconToggle = false }) {
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
          placeholder={placeholder}
          aria-label={label}
          value={value}
          onChange={onChange}
          onKeyDown={watchCaps}
          onKeyUp={watchCaps}
          onBlur={() => setCaps(false)}
          aria-invalid={invalid || undefined}
          className={`${className} ${iconToggle ? 'pe-12' : 'pe-16'}`}
        />
        {iconToggle ? (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-pressed={shown}
            aria-label="Show password"
            title={shown ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 end-0 grid w-12 cursor-pointer place-items-center rounded-e-xl text-ink-subtle outline-none transition-colors hover:text-ink-strong focus-visible:text-ink-strong"
          >
            <Icon name={shown ? 'eye' : 'eyeOff'} className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-pressed={shown}
            className="absolute inset-y-0 end-0 cursor-pointer px-3.5 font-mono text-[11px] uppercase tracking-wider text-ink-subtle transition-colors hover:text-ink-strong"
          >
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
      </span>
      {caps && <span className="text-[11px] text-amber-500">Caps Lock is on.</span>}
    </>
  )
}

export function Strength({ password }) {
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

const BRAND_HOVER = { google: 'hover:text-ink-strong', discord: 'hover:text-[#5865F2]', github: 'hover:text-ink-strong' }

export function Providers({ next, disabled, onStart, onError, action = authSignInWith, verb = 'Continue', layout = 'grid', tileClass = PROVIDER, labels = false }) {
  const [pending, setPending] = useState(null)
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
      await action(provider, next)
    } catch (err) {
      setPending(null)
      onError?.(err)
    }
  }
  const rows = layout === 'rows'
  return (
    <div className={rows ? 'flex flex-col gap-2' : `grid grid-cols-3 ${labels ? 'gap-2.5' : 'gap-2'}`}>
      {AUTH_PROVIDERS.map((provider) => {
        const label = `${verb} with ${PROVIDER_NAMES[provider]}`
        const lit = pending === provider
        return (
          <button
            key={provider}
            type="button"
            onClick={() => go(provider)}
            disabled={disabled || Boolean(pending)}
            className={`${rows ? PROVIDER : `${tileClass} ${BRAND_HOVER[provider]}`} disabled:cursor-not-allowed disabled:opacity-50 ${rows ? 'gap-3 px-4 text-[13px] font-medium' : ''} ${lit ? 'border-line-strong text-ink-strong' : ''}`}
            aria-label={rows ? undefined : label}
            title={rows || labels ? undefined : label}
          >
            <svg className={`${rows || labels ? 'h-[16px] w-[16px]' : 'h-[18px] w-[18px]'} shrink-0`} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d={PROVIDER_ICONS[provider]} />
            </svg>
            {labels && !rows && <span className="hidden truncate min-[360px]:inline">{lit ? 'Opening…' : PROVIDER_NAMES[provider]}</span>}
            {rows && <span className="flex-1 text-left">{lit ? `Opening ${PROVIDER_NAMES[provider]}…` : label}</span>}
            {rows && <span aria-hidden="true" className="text-ink-faint">→</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Divider({ children }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 border-t border-dashed border-line" />
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{children}</span>
      <span className="h-px flex-1 border-t border-dashed border-line" />
    </div>
  )
}
