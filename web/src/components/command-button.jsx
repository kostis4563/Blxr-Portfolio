import { useState, useEffect } from 'react'
import { openPalette, isMacLike } from '../lib/palette'

const KEY_CLASS =
  'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-ink-strong/5 px-1 font-sans text-[11px] leading-none text-ink-muted shadow-[inset_0_0_0_1px_var(--color-line-strong),inset_0_-1px_0_var(--color-line-strong)]'

const PILL_CLASS =
  'group h-8 items-center gap-1.5 rounded-md px-2 outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/20'

function SearchGlyph({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function Keys({ mac, className = '' }) {
  return (
    <span aria-hidden="true" className={`items-center gap-0.5 ${className}`}>
      {mac !== null && (mac ? ['⌘', 'K'] : ['Ctrl', 'K']).map((key) => (
        <kbd key={key} className={KEY_CLASS}>{key}</kbd>
      ))}
    </span>
  )
}

export function CommandButton({ className = '', variant }) {
  const [mac, setMac] = useState(null)

  useEffect(() => { setMac(isMacLike()) }, [])

  const shortcut = mac ? '⌘K' : 'Ctrl K'

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search the site"
        aria-haspopup="dialog"
        aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
        title={`Search · ${shortcut}`}
        className={`${PILL_CLASS} ${className} cursor-pointer`}
      >
        <SearchGlyph className="h-3.5 w-3.5 shrink-0" />
        {mac !== null && (
          <span aria-hidden="true" className="font-mono text-[11px] tracking-tight text-ink-faint transition-colors duration-200 group-hover:text-ink-muted">
            {shortcut}
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Command palette"
      aria-haspopup="dialog"
      title={`Command palette · ${shortcut}`}
      className={`${className} cursor-pointer`}
    >
      <SearchGlyph className="w-4 h-4 shrink-0" />
      <Keys mac={mac} className="hidden sm:inline-flex" />
    </button>
  )
}

export default CommandButton
