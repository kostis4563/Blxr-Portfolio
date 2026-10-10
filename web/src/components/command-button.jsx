import { useState, useEffect } from 'react'
import { openPalette, isMacLike } from '../lib/palette'

export function CommandButton({ className = '' }) {
  const [mac, setMac] = useState(null)

  useEffect(() => { setMac(isMacLike()) }, [])

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Command palette"
      aria-haspopup="dialog"
      title={`Command palette · ${mac ? '⌘K' : 'Ctrl K'}`}
      className={`${className} cursor-pointer`}
    >
      <svg className="w-[16px] h-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
      </svg>
      {}
      <span aria-hidden="true" className="hidden sm:inline-flex items-center gap-0.5">
        {mac !== null && (mac ? ['⌘', 'K'] : ['Ctrl', 'K']).map((key) => (
          <kbd
            key={key}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-ink-strong/5 px-1 font-sans text-[11px] leading-none text-ink-muted shadow-[inset_0_0_0_1px_var(--color-line-strong),inset_0_-1px_0_var(--color-line-strong)]"
          >
            {key}
          </kbd>
        ))}
      </span>
    </button>
  )
}

export default CommandButton
