import { ICONS } from '../lib/dashboard'

export function Icon({ name, className = 'h-[18px] w-[18px]', strokeWidth = 1.7 }) {
  return (
    <svg
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
