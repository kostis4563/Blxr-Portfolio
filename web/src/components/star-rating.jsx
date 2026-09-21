import { useState } from 'react'

const STAR = 'M12 2.6l2.9 6.2 6.7.7-5 4.6 1.4 6.7L12 17.4l-6 3.4 1.4-6.7-5-4.6 6.7-.7z'
const SLOTS = [1, 2, 3, 4, 5]
const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' }

function Star({ filled, className = '', style }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={style}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.6}
      strokeLinejoin="round"
    >
      <path d={STAR} />
    </svg>
  )
}

export function Stars({ value, size = 13, className = '' }) {
  const clamped = Math.max(0, Math.min(5, Number(value) || 0))
  const style = { width: size, height: size }

  return (
    <span
      role="img"
      aria-label={`${clamped} out of 5 stars`}
      className={`relative inline-flex shrink-0 leading-none ${className}`}
    >
      <span className="flex gap-[2px] text-ink-faint" aria-hidden="true">
        {SLOTS.map((i) => <Star key={i} filled={false} style={style} />)}
      </span>
      <span
        className="absolute inset-y-0 start-0 flex gap-[2px] overflow-hidden text-ink-strong"
        style={{ width: `${(clamped / 5) * 100}%` }}
        aria-hidden="true"
      >
        {SLOTS.map((i) => <Star key={i} filled style={style} />)}
      </span>
    </span>
  )
}

export function StarPicker({ value, onChange, invalid = false, name = 'rating', labelledBy }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value || 0

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : 'Your rating'}
      aria-invalid={invalid || undefined}
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
      onPointerLeave={() => setHover(0)}
    >
      <div className="flex items-center gap-0.5 -ms-1.5">
        {SLOTS.map((n) => {
          const lit = n <= shown
          return (
            <label
              key={n}
              className={`group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-surface-hover has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-strong/60 ${
                lit ? 'text-ink-strong' : 'text-ink-faint'
              }`}
              onPointerEnter={() => setHover(n)}
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                aria-label={`${n} — ${RATING_LABELS[n]}`}
                className="sr-only"
              />
              <Star
                filled={lit}
                className={`h-6 w-6 transition-transform duration-150 group-hover:scale-110 group-active:scale-95 ${lit ? '' : 'scale-95'}`}
              />
            </label>
          )
        })}
      </div>
      <span
        aria-live="polite"
        role={invalid && !shown ? 'alert' : undefined}
        className={`min-w-[6ch] text-[12.5px] font-medium transition-colors ${
          shown ? 'text-ink-secondary' : invalid ? 'text-red-500' : 'text-ink-faint'
        }`}
      >
        {shown ? RATING_LABELS[shown] : 'Pick a rating'}
      </span>
    </div>
  )
}

export default Stars
