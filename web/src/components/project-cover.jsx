export default function ProjectCover({ project, className = '' }) {
  const accent = project.accent ?? '#6b7280'

  return (
    <div
      aria-hidden="true"
      className={`relative w-full h-full overflow-hidden bg-surface ${className}`}
    >
      {}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--color-ink-strong) 0.5px, transparent 0.5px)',
          backgroundSize: '14px 14px'
        }}
      />

      {}
      <div
        className="absolute -right-1/4 -top-1/3 w-[110%] aspect-square rounded-full blur-3xl opacity-[0.22]"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 62%)` }}
      />

      {}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {[52, 96, 140, 184, 228].map((r, i) => (
          <circle
            key={r}
            cx="58"
            cy="212"
            r={r}
            stroke={accent}
            strokeWidth="1"
            opacity={0.3 - i * 0.045}
          />
        ))}
        <circle cx="58" cy="212" r="5" fill={accent} opacity="0.5" />
      </svg>

      {}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
      <div className="absolute inset-0 ring-1 ring-inset ring-[var(--hairline)]" />
    </div>
  )
}
