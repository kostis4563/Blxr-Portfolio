import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../dashboard-sidebar'
import { StoredImage } from './ui'
import { sizeWords } from '../../lib/boards'

export default function Viewer({ files, at, onStep, onClose, onDownload }) {
  const entry = files[at]

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
      if (event.key === 'ArrowRight') onStep(1)
      if (event.key === 'ArrowLeft') onStep(-1)
    }
    document.addEventListener('keydown', onKey, true)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
    }
  }, [onClose, onStep])

  if (!entry || typeof document === 'undefined') return null

  return createPortal(
    <div data-nested-open role="dialog" aria-modal="true" aria-label={entry.name} className="fixed inset-0 z-[90] flex flex-col bg-black/90 animate-overlay-in">
      <header className="flex items-center gap-3 px-4 py-3 text-white">
        <span className="min-w-0 flex-1 truncate text-[13px]">{entry.name}</span>
        <span className="shrink-0 text-[12px] text-white/60 tabular-nums">
          {at + 1} of {files.length} · {sizeWords(entry.bytes)}
        </span>
        <button type="button" aria-label="Download" onClick={() => onDownload(entry)} className="cursor-pointer rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <Icon name="download" className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
        <StoredImage key={entry.id} path={entry.path} alt={entry.name} className="relative max-h-full max-w-full object-contain" />
        {files.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => onStep(-1)}
              className="absolute left-3 cursor-pointer rounded-full bg-black/50 p-2.5 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
            >
              <Icon name="chevronLeft" className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => onStep(1)}
              className="absolute right-3 cursor-pointer rounded-full bg-black/50 p-2.5 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
            >
              <Icon name="chevronRight" className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
