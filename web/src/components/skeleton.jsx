export function Bone({ className = '', style }) {
  return <span aria-hidden="true" style={style} className={`skeleton block rounded-md ${className}`} />
}

export function Dot({ size = 36, className = '' }) {
  return <span aria-hidden="true" style={{ width: size, height: size }} className={`skeleton block shrink-0 rounded-full ${className}`} />
}

export function Figure({ className = '' }) {
  return (
    <span className={`flex flex-col gap-2 ${className}`}>
      <Bone className="h-2.5 w-16" />
      <Bone className="h-5 w-12" />
    </span>
  )
}

export function Lines({ count = 2, className = '' }) {
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3']
  return (
    <span className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} className={`h-2.5 ${i === count - 1 ? widths[Math.min(count, 3)] : widths[i % 2]}`} />
      ))}
    </span>
  )
}

export function Loading({ label, className = '', children }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
