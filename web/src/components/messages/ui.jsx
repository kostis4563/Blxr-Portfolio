import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../dashboard-sidebar'
import { Avatar } from '../account-menu'
import { signedUrl } from '../../lib/messages-api'
import { readableSize } from '../../lib/boards-files'
import { Bone, Dot, Loading } from '../skeleton'

export function Face({ name, avatar, size = 32, online = false, className = '' }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Avatar user={{ name: name || '?', avatar: avatar || null }} size={size} />
      {online && (
        <span
          aria-label="Online"
          title="Online"
          className="absolute -bottom-px -right-px block h-2.5 w-2.5 rounded-full border-2 border-surface bg-ink-strong"
        />
      )}
    </span>
  )
}

export function Picture({ path, alt = '', className = '', onLoad }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let live = true
    setUrl(null)
    if (!path) return undefined
    signedUrl(path).then((next) => live && setUrl(next))
    return () => {
      live = false
    }
  }, [path])

  if (!url) return <span className={`block animate-pulse bg-surface-raised ${className}`} />
  return <img src={url} alt={alt} loading="lazy" draggable={false} onLoad={onLoad} className={className} />
}

export function TypingDots({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="block h-1.5 w-1.5 rounded-full bg-ink-subtle animate-pulse"
          style={{ animationDuration: '1.1s', animationDelay: `${dot * 180}ms` }}
        />
      ))}
    </span>
  )
}

export function Lightbox({ files, at, onStep, onClose, onDownload }) {
  const file = files[at]
  const many = files.length > 1

  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight' && many) onStep(1)
      else if (event.key === 'ArrowLeft' && many) onStep(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [many, onClose, onStep])

  if (!file || typeof document === 'undefined') return null

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={file.name} className="fixed inset-0 z-[80] flex flex-col bg-black/90 animate-overlay-in" onClick={onClose}>
      <div className="flex h-12 shrink-0 items-center gap-2 px-3 text-white/80" onClick={(event) => event.stopPropagation()}>
        <span className="min-w-0 flex-1 truncate text-[12.5px]">{file.name}</span>
        <span className="text-[11px] tabular-nums text-white/50">
          {many ? `${at + 1} / ${files.length} · ` : ''}
          {readableSize(file.bytes)}
        </span>
        <button
          type="button"
          onClick={() => onDownload(file)}
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg hover:bg-white/10"
          aria-label="Download"
          title="Download"
        >
          <Icon name="download" className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg hover:bg-white/10" aria-label="Close">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {many && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onStep(-1)
            }}
            className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Previous"
          >
            <Icon name="chevronLeft" className="h-5 w-5" />
          </button>
        )}
        <Picture key={file.path} path={file.path} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        {many && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onStep(1)
            }}
            className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Next"
          >
            <Icon name="chevronRight" className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function InboxSkeleton({ rows = 6 }) {
  return (
    <Loading label="Loading conversations" className="divide-y divide-line/60">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Dot size={36} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2"><Bone className="h-3 w-24" /><Bone className="h-2 w-8" /></span>
            <Bone className={`mt-2 h-2.5 ${i % 3 === 0 ? 'w-4/5' : i % 3 === 1 ? 'w-3/5' : 'w-2/3'}`} />
          </span>
        </div>
      ))}
    </Loading>
  )
}

export function ThreadSkeleton() {
  const bubbles = [
    { mine: false, w: 'w-[56%]', h: 'h-9' },
    { mine: false, w: 'w-[38%]', h: 'h-9' },
    { mine: true, w: 'w-[48%]', h: 'h-9' },
    { mine: false, w: 'w-[64%]', h: 'h-14' },
    { mine: true, w: 'w-[30%]', h: 'h-9' },
    { mine: true, w: 'w-[52%]', h: 'h-9' },
  ]
  return (
    <Loading label="Loading messages" className="flex h-full flex-col justify-end gap-2 px-4 py-3">
      {bubbles.map((b, i) => (
        <span key={i} className={`flex items-end gap-2 ${b.mine ? 'justify-end' : ''}`}>
          {!b.mine && <Dot size={24} />}
          <Bone className={`${b.w} ${b.h} rounded-2xl`} />
        </span>
      ))}
    </Loading>
  )
}
