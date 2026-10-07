import { useState } from 'react'
import { SunIcon } from './sun-icon'

export default function ThemeToggle({ theme, onToggle, className = '' }) {
  const isDark = theme === 'dark'
  const [toggled, setToggled] = useState(false)

  const toggle = (event) => {
    setToggled(true)
    onToggle?.(event)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`${className} cursor-pointer`}

      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? (
        <SunIcon className="w-[16px] h-[16px]" intro={toggled} />
      ) : (
        <svg
          className="w-[16px] h-[16px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
          />
        </svg>
      )}
    </button>
  )
}
