import { imageProps, SIZES } from '../lib/images'

export default function ProjectMark({ project, size = 'sm' }) {
  const box = size === 'lg' ? 'w-9 h-9 rounded-xl' : 'w-7 h-7 rounded-lg'
  const glyph = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
  const label = size === 'lg' ? 'text-[13px]' : 'text-[11px]'

  const glyphPx = size === 'lg' ? 24 : 20

  if (project.logo) {
    return (
      <div
        className={`${box} bg-surface-inverted border border-line-strong flex items-center justify-center shrink-0 overflow-hidden`}
      >
        <img

          {...imageProps(project.logo, SIZES.mark)}

          alt=""
          loading="lazy"
          decoding="async"
          width={glyphPx}
          height={glyphPx}
          className={`${glyph} object-contain`}
        />
      </div>
    )
  }

  return (
    <div
      className={`${box} bg-surface-raised border border-line-strong flex items-center justify-center shrink-0`}
    >
      <span className={`text-ink-strong font-bold ${label}`}>
        {project.title.slice(0, 2).toUpperCase()}
      </span>
    </div>
  )
}
