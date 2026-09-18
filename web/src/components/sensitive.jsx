import { useEffect, useState } from 'react'

export function Sensitive({ children, className = '', as: Tag = 'span', interactive = true, label = 'Sensitive value, hover or tap to reveal' }) {
  const [shown, setShown] = useState(false)
  if (!interactive) return <Tag className={`sensitive ${className}`}>{children}</Tag>
  return (
    <Tag
      tabIndex={0}
      role="button"
      aria-label={shown ? undefined : label}
      aria-pressed={shown}
      data-revealed={shown || undefined}
      onClick={(e) => {
        if (window.getSelection?.()?.toString()) return
        e.stopPropagation()
        setShown((s) => !s)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setShown((s) => !s)
        }
      }}
      className={`sensitive ${className}`}
    >
      {children}
    </Tag>
  )
}

export function MailTo({ email, subject, className = '', children }) {
  const open = (e) => {
    e.preventDefault()
    window.location.href = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
  }
  return (
    <a href="#" onClick={open} className={className}>
      {children}
    </a>
  )
}

export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
