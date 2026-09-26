import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { BTN_BARE, BTN_QUIET, BTN_SOLID, Note, Sheet, StoredImage } from './ui'
import { ART_KINDS, cropArt, openArt, readArt, readableSize } from '../../lib/boards-files'
import { initials, shade } from '../../lib/boards'

const STAGE = { logo: { width: 320, height: 320 }, banner: { width: 540, height: 180 } }
const MINI = { logo: 40, banner: 132 }
const MAX_ZOOM = 4

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

function Cropper({ kind, source, image, type, animated, busy, onApply, onKeep, onClose }) {
  const spec = ART_KINDS[kind] ?? ART_KINDS.logo
  const stage = STAGE[kind] ?? STAGE.logo
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const { zoom } = view
  const [error, setError] = useState(null)
  const [working, setWorking] = useState(false)
  const drag = useRef(null)
  const floor = useRef(null)

  const wide = image?.naturalWidth ?? 1
  const tall = image?.naturalHeight ?? 1
  const base = Math.max(stage.width / wide, stage.height / tall)
  const shown = { width: wide * base * zoom, height: tall * base * zoom }
  const room = {
    x: Math.max(0, (shown.width - stage.width) / 2),
    y: Math.max(0, (shown.height - stage.height) / 2),
  }

  const settled = useMemo(
    () => ({ x: clamp(view.x, -room.x, room.x), y: clamp(view.y, -room.y, room.y) }),
    [view.x, view.y, room.x, room.y],
  )

  const box = useMemo(() => {
    const scale = base * zoom
    return {
      x: (shown.width / 2 - stage.width / 2 - settled.x) / scale,
      y: (shown.height / 2 - stage.height / 2 - settled.y) / scale,
      width: stage.width / scale,
      height: stage.height / scale,
    }
  }, [base, zoom, shown.width, shown.height, settled.x, settled.y, stage.width, stage.height])

  useEffect(() => {
    const move = (event) => {
      if (!drag.current) return
      const { from, x, y } = drag.current
      setView((held) => ({ ...held, x: from.x + (event.clientX - x), y: from.y + (event.clientY - y) }))
    }
    const drop = () => {
      drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
    }
  }, [])

  const grab = (event) => {
    drag.current = { x: event.clientX, y: event.clientY, from: settled }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  const turn = useCallback((next) => {
    setView((held) => {
      const wanted = clamp(next(held.zoom), 1, MAX_ZOOM)
      const ratio = wanted / held.zoom
      return { zoom: wanted, x: held.x * ratio, y: held.y * ratio }
    })
  }, [])

  useEffect(() => {
    const node = floor.current
    if (!node) return undefined
    const wheel = (event) => {
      event.preventDefault()
      turn((held) => held + (event.deltaY < 0 ? 0.15 : -0.15))
    }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  }, [turn, animated])

  const nudge = (event) => {
    const steps = { ArrowLeft: [12, 0], ArrowRight: [-12, 0], ArrowUp: [0, 12], ArrowDown: [0, -12] }
    const step = steps[event.key]
    if (step) {
      event.preventDefault()
      setView((held) => ({ ...held, x: held.x + step[0], y: held.y + step[1] }))
      return
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      turn((held) => held + 0.25)
    }
    if (event.key === '-') {
      event.preventDefault()
      turn((held) => held - 0.25)
    }
  }

  const apply = async () => {
    setError(null)
    setWorking(true)
    try {
      await onApply(await cropArt(image, kind, box, type))
    } catch (failure) {
      setError(failure.message)
      setWorking(false)
    }
  }

  const held = busy || working
  const mini = kind === 'logo' ? MINI.logo : MINI.banner
  const shrink = mini / stage.width

  const picture = (width, height, factor) => (
    <img
      src={source}
      alt=""
      draggable={false}
      style={{
        width: shown.width * factor,
        height: shown.height * factor,
        transform: `translate(${settled.x * factor}px, ${settled.y * factor}px)`,
      }}
      className="max-w-none select-none"
    />
  )

  return (
    <Sheet
      title={`Position the ${spec.label.toLowerCase()}`}
      subtitle={animated ? 'An animated image keeps its frame as it is — only the size is checked.' : 'Drag to move, scroll or use the slider to zoom. Arrow keys nudge.'}
      size="md"
      busy={held}
      onClose={onClose}
      footer={
        <>
          {onKeep && (
            <button type="button" disabled={held} onClick={onKeep} className={BTN_QUIET}>
              Use it as it is
            </button>
          )}
          <span className="flex-1" />
          <button type="button" disabled={held} onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          {!animated && (
            <button type="button" disabled={held} onClick={apply} className={BTN_SOLID}>
              {held ? 'Saving…' : 'Use this crop'}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Note tone="error">{error}</Note>}

        {animated ? (
          <div className="flex justify-center rounded-xl border border-line bg-surface-raised/40 p-4">
            <img src={source} alt="" className="max-h-[260px] rounded-lg" />
          </div>
        ) : (
          <>
            <div
              ref={floor}
              role="application"
              tabIndex={0}
              aria-label="Drag to position the image"
              onPointerDown={grab}
              onKeyDown={nudge}
              style={{ width: stage.width, height: stage.height }}
              className="relative mx-auto max-w-full cursor-grab touch-none overflow-hidden rounded-xl border border-line bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/25 active:cursor-grabbing"
            >
              <div className="absolute inset-0 flex items-center justify-center">{picture(1, 1, 1)}</div>
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <span className="absolute inset-y-0 left-1/3 w-px bg-white/15" />
                <span className="absolute inset-y-0 left-2/3 w-px bg-white/15" />
                <span className="absolute inset-x-0 top-1/3 h-px bg-white/15" />
                <span className="absolute inset-x-0 top-2/3 h-px bg-white/15" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" aria-label="Zoom out" onClick={() => turn((held) => held - 0.25)} className={`${BTN_BARE} px-1.5`}>
                <Icon name="search" className="h-4 w-4" />
                <span aria-hidden="true">−</span>
              </button>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.05}
                value={zoom}
                aria-label="Zoom"
                onChange={(event) => {
                  const next = Number(event.target.value)
                  turn(() => next)
                }}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-hover accent-[var(--color-ink-strong)]"
              />
              <button type="button" aria-label="Zoom in" onClick={() => turn((held) => held + 0.25)} className={`${BTN_BARE} px-1.5`}>
                <Icon name="search" className="h-4 w-4" />
                <span aria-hidden="true">+</span>
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised/40 p-3">
              <span
                style={{ width: mini, height: kind === 'logo' ? mini : mini / spec.ratio }}
                className={`relative shrink-0 overflow-hidden ${kind === 'logo' ? 'rounded-lg' : 'rounded-md'} bg-surface ring-1 ring-inset ring-line`}
              >
                <span className="absolute inset-0 flex items-center justify-center">{picture(1, 1, shrink)}</span>
              </span>
              <p className="text-[12px] leading-relaxed text-ink-muted">
                How it will look {kind === 'logo' ? 'beside the board name and on its tile' : 'across the top of the board'}.
              </p>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

export default function ArtField({ kind, board, colour, name, disabled, onPick, onClear, onFocus }) {
  const spec = ART_KINDS[kind] ?? ART_KINDS.logo
  const [picked, setPicked] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const field = useRef(null)
  const tone = shade(colour)

  const held = board?.art?.[kind]

  const choose = useCallback(
    async (file) => {
      if (!file) return
      setError(null)
      try {
        const opened = await openArt(file)
        setPicked({ ...opened, file, animated: file.type === 'image/gif' })
      } catch (failure) {
        setError(failure.message)
      }
      if (field.current) field.current.value = ''
    },
    [],
  )

  const apply = async (result) => {
    setBusy(true)
    try {
      await onPick(result)
      setPicked(null)
    } finally {
      setBusy(false)
    }
  }

  const keep = async () => {
    setBusy(true)
    setError(null)
    try {
      await onPick(await readArt(picked.file, kind))
      setPicked(null)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <span className={`${spec.frame} shrink-0 overflow-hidden rounded-lg border border-line ${held?.path ? 'bg-surface' : 'bg-surface-raised'}`}>
          {held?.path ? (
            <StoredImage path={held.path} alt="" focus={held.focus} className="h-full w-full object-cover" />
          ) : kind === 'logo' ? (
            <span className={`grid h-full w-full place-items-center text-[15px] font-semibold text-white ${tone.dot}`}>{initials(name || '?')}</span>
          ) : (
            <span className={`block h-full w-full bg-gradient-to-br ${tone.wash}`} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-ink-strong">{spec.label}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{spec.hint}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" disabled={disabled || busy} onClick={() => field.current?.click()} className={BTN_QUIET}>
              <Icon name="upload" className="h-3.5 w-3.5" />
              {held ? 'Replace' : 'Upload'}
            </button>
            {held && onFocus && (
              <button type="button" disabled={disabled || busy} onClick={onFocus} className={BTN_BARE}>
                <Icon name="move" className="h-3.5 w-3.5" />
                Reposition
              </button>
            )}
            {held && (
              <button type="button" disabled={disabled || busy} onClick={onClear} className={`${BTN_BARE} text-red-500 hover:text-red-400`}>
                <Icon name="trash" className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[10.5px] text-ink-faint">PNG, JPEG, WebP or GIF, up to {readableSize(spec.cap)} once cropped.</p>
        </div>
      </div>

      {error && <Note tone="error">{error}</Note>}

      <input
        ref={field}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => choose(event.target.files?.[0])}
      />

      {picked && (
        <Cropper
          kind={kind}
          source={picked.source}
          image={picked.image}
          type={picked.type}
          animated={picked.animated}
          busy={busy}
          onApply={apply}
          onKeep={keep}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}

export function FocusPicker({ board, kind, onClose, onSave, busy }) {
  const held = board.art?.[kind]
  const [focus, setFocus] = useState(held?.focus || { x: 50, y: 50 })
  const frame = useRef(null)
  const dragging = useRef(false)

  const set = useCallback((event) => {
    const box = frame.current?.getBoundingClientRect()
    if (!box) return
    setFocus({
      x: Math.round(clamp(((event.clientX - box.left) / box.width) * 100, 0, 100)),
      y: Math.round(clamp(((event.clientY - box.top) / box.height) * 100, 0, 100)),
    })
  }, [])

  useEffect(() => {
    const move = (event) => dragging.current && set(event)
    const drop = () => {
      dragging.current = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
    }
  }, [set])

  if (!held) return null

  return (
    <Sheet
      title={`Reposition the ${kind}`}
      subtitle="Click or drag to say which part of the picture should stay in view when it is cropped."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={() => setFocus({ x: 50, y: 50 })} className={BTN_BARE}>
            Centre
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={() => onSave(focus)} className={BTN_SOLID}>
            Save position
          </button>
        </>
      }
    >
      <div
        ref={frame}
        onPointerDown={(event) => {
          dragging.current = true
          set(event)
        }}
        className={`relative cursor-crosshair touch-none overflow-hidden rounded-xl border border-line ${kind === 'logo' ? 'aspect-square max-w-[320px]' : 'aspect-[3/1]'} mx-auto`}
      >
        <StoredImage path={held.path} alt="" className="h-full w-full object-cover" focus={focus} />
        <span
          aria-hidden="true"
          style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
        />
      </div>
      <p className="mt-3 text-center text-[12px] tabular-nums text-ink-faint">
        {focus.x}% across, {focus.y}% down
      </p>
    </Sheet>
  )
}
