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
      <kbd
       
        aria-hidden="true"
        className="hidden sm:inline-flex items-center justify-center min-w-[30px] font-mono text-[10px] tracking-[0.04em] leading-none pt-px"
      >
        {mac === null ? '' : mac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  )
}

export default CommandButton
