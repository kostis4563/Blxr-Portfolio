import { useState } from 'react'
import { Icon } from './dashboard-sidebar'
import { SOCIAL_ICON_PATHS } from '../lib/profile'
import { accentOf, linkKind, hostOf, DEFAULT_SECTIONS } from '../lib/profiles'

// The profile as other people see it. The dashboard renders the same card as
// a live preview (`compact`), so what you edit is exactly what ships.

const BRAND_PATHS = {
  github: SOCIAL_ICON_PATHS.GitHub,
  discord: SOCIAL_ICON_PATHS.Discord,
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  twitch: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z',
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  instagram: 'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z',
  tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-1.99 6.15-1.58.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
}

export function LinkIcon({ url, className = 'h-3.5 w-3.5' }) {
  const kind = linkKind(url)
  const path = kind && BRAND_PATHS[kind.id]
  if (!path) return <Icon name="globe" className={className} />
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

const SHAPE = { circle: '9999px', rounded: '26%' }

export function ProfileAvatar({ profile, size }) {
  const [broken, setBroken] = useState(false)
  const accent = accentOf(profile.accent)
  const radius = SHAPE[profile.avatarShape] || SHAPE.circle
  const px = `${size}px`
  if (profile.avatar && !broken) {
    return (
      <img
        src={profile.avatar}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={{ width: px, height: px, borderRadius: radius }}
        className="shrink-0 object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: px, height: px, borderRadius: radius, fontSize: `${Math.round(size * 0.4)}px`,
        color: accent.id === 'ink' ? 'var(--color-bg)' : '#fff',
        backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
      }}
      className="grid shrink-0 place-items-center font-semibold uppercase"
    >
      {(profile.name || profile.handle || '?').trim().charAt(0) || '?'}
    </span>
  )
}

const PATTERN_STYLE = {
  dots: { backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.45) 1px, transparent 0)', backgroundSize: '14px 14px', opacity: 0.35 },
  grid: { backgroundImage: 'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '22px 22px', opacity: 0.35 },
  none: null,
}

function Banner({ profile, className }) {
  const accent = accentOf(profile.accent)
  const pattern = PATTERN_STYLE[profile.pattern] || null
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
    >
      {profile.cover ? (
        <>
          <img src={profile.cover} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        </>
      ) : pattern ? (
        <div className="absolute inset-0" style={pattern} />
      ) : null}
    </div>
  )
}

const joinedLabel = (iso) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null
}

function SectionLabel({ children, compact, centered }) {
  return <p className={`font-mono font-semibold uppercase tracking-wider text-ink-subtle ${centered ? 'text-center' : ''} ${compact ? 'mb-2 text-[9.5px]' : 'mb-3 text-[10.5px]'}`}>{children}</p>
}

// --- sections ------------------------------------------------------------------

function About({ profile, compact, joined, centered }) {
  const website = profile.website ? { href: profile.website, host: hostOf(profile.website) } : null
  const meta = profile.location || website || joined
  if (!profile.bio && !meta) return null
  return (
    <div>
      {profile.bio && (
        <p className={`whitespace-pre-line break-words leading-relaxed text-ink-muted ${centered ? 'text-center' : ''} ${compact ? 'text-[12.5px]' : 'text-[14px]'}`}>{profile.bio}</p>
      )}
      {meta && (
        <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 text-ink-muted ${centered ? 'justify-center' : ''} ${profile.bio ? (compact ? 'mt-3' : 'mt-4') : ''} ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
          {profile.location && (
            <li className="inline-flex items-center gap-1.5"><Icon name="pin" className="h-3.5 w-3.5 text-ink-subtle" /> {profile.location}</li>
          )}
          {website && (
            <li className="inline-flex items-center gap-1.5">
              <Icon name="link" className="h-3.5 w-3.5 text-ink-subtle" />
              <a href={website.href} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink-strong">{website.host}</a>
            </li>
          )}
          {joined && (
            <li className="inline-flex items-center gap-1.5"><Icon name="calendar" className="h-3.5 w-3.5 text-ink-subtle" /> Joined {joined}</li>
          )}
        </ul>
      )}
    </div>
  )
}

function Now({ profile, compact, centered }) {
  if (!profile.now) return null
  const accent = accentOf(profile.accent)
  return (
    <div>
      <SectionLabel compact={compact} centered={centered}>Now</SectionLabel>
      <div className="flex gap-3">
        <span aria-hidden="true" className="w-0.5 shrink-0 self-stretch rounded-full" style={{ backgroundImage: `linear-gradient(${accent.from}, ${accent.to})` }} />
        <p className={`whitespace-pre-line break-words leading-relaxed text-ink ${compact ? 'text-[12.5px]' : 'text-[14px]'}`}>{profile.now}</p>
      </div>
    </div>
  )
}

function Showcase({ profile, compact, centered }) {
  const items = profile.showcase.filter((s) => s.title?.trim())
  if (!items.length) return null
  return (
    <div>
      <SectionLabel compact={compact} centered={centered}>Showcase</SectionLabel>
      <ul className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {items.map((it, i) => {
          const Tag = it.url ? 'a' : 'div'
          const props = it.url ? { href: it.url, target: '_blank', rel: 'noreferrer' } : {}
          return (
            <li key={`${it.title}-${i}`}>
              <Tag
                {...props}
                className={`group flex h-full flex-col rounded-xl border border-line bg-surface-raised/50 text-left transition-[border-color,transform,background-color] duration-200 ${it.url ? 'hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-raised' : ''} ${compact ? 'p-3' : 'p-4'}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={`font-medium text-ink-strong ${compact ? 'text-[12.5px]' : 'text-[14px]'}`}>{it.title}</span>
                  {it.url && <Icon name="arrowUpRight" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle transition-colors group-hover:text-ink-strong" />}
                </span>
                {it.description && <span className={`mt-1 text-ink-muted ${compact ? 'text-[11.5px]' : 'text-[12.5px]'} leading-relaxed`}>{it.description}</span>}
                {it.url && <span className={`mt-auto pt-2 font-mono text-ink-subtle ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{hostOf(it.url)}</span>}
              </Tag>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Links({ profile, compact, centered }) {
  const links = profile.links.filter((l) => l.url)
  if (!links.length) return null
  return (
    <div>
      <SectionLabel compact={compact} centered={centered}>Links</SectionLabel>
      <ul className={`flex flex-wrap gap-2 ${centered ? 'justify-center' : ''}`}>
        {links.map((l, i) => {
          const kind = linkKind(l.url)
          const label = l.label?.trim() || kind?.label || hostOf(l.url)
          return (
            <li key={`${l.url}-${i}`}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-raised/60 font-medium text-ink-secondary transition-[color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:text-ink-strong ${compact ? 'h-7 px-2 text-[11.5px]' : 'h-8 px-2.5 text-[12.5px]'}`}
              >
                <LinkIcon url={l.url} className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                {label}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Skills({ profile, compact, centered }) {
  if (!profile.skills.length) return null
  return (
    <div>
      <SectionLabel compact={compact} centered={centered}>Skills</SectionLabel>
      <ul className={`flex flex-wrap gap-1.5 ${centered ? 'justify-center' : ''}`}>
        {profile.skills.map((s) => (
          <li key={s} className={`rounded-md border border-line px-2 text-ink-muted ${compact ? 'py-0.5 text-[11px]' : 'py-1 text-[12px]'}`}>{s}</li>
        ))}
      </ul>
    </div>
  )
}

const SECTION_VIEWS = { about: About, now: Now, showcase: Showcase, links: Links, skills: Skills }

// --- header --------------------------------------------------------------------

function Pills({ profile, compact, centered }) {
  const accent = accentOf(profile.accent)
  if (!profile.openToWork && !profile.status) return null
  const pill = compact ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-[12px]'
  return (
    <div className={`flex flex-wrap gap-1.5 ${centered ? 'justify-center' : ''} ${compact ? 'mt-2.5' : 'mt-3'}`}>
      {profile.openToWork && (
        <span className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-500 ${pill}`}>
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Open to work
        </span>
      )}
      {profile.status && (
        <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-raised/60 text-ink ${pill}`}>
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent.swatch }} />
          <span className="truncate">{profile.status}</span>
        </span>
      )}
    </div>
  )
}

function Identity({ profile, compact, centered }) {
  const name = profile.name.trim() || 'Your name'
  const handle = profile.handle || 'handle'
  return (
    <div className={centered ? 'text-center' : ''}>
      <h1 className={`break-words font-semibold tracking-tight text-ink-strong ${compact ? 'text-[17px]' : centered ? 'text-[26px] sm:text-[28px]' : 'text-[24px] sm:text-[26px]'}`}>{name}</h1>
      <p className={`mt-0.5 flex flex-wrap items-center gap-x-2 text-ink-muted ${centered ? 'justify-center' : ''} ${compact ? 'text-[12.5px]' : 'text-[14px]'}`}>
        <span className="font-mono">@{handle}</span>
        {profile.pronouns && (<><span aria-hidden="true" className="text-ink-faint">·</span><span>{profile.pronouns}</span></>)}
      </p>
      {profile.headline && <p className={`mt-2 font-medium text-ink ${compact ? 'text-[13px]' : 'text-[15px]'}`}>{profile.headline}</p>}
      <Pills profile={profile} compact={compact} centered={centered} />
    </div>
  )
}

function Sections({ profile, compact, centered, joined }) {
  const order = profile.sections?.length ? profile.sections : DEFAULT_SECTIONS
  const blocks = order
    .map((id) => {
      const View = SECTION_VIEWS[id]
      return View ? <View key={id} profile={profile} compact={compact} centered={centered} joined={joined} /> : null
    })
    .filter(Boolean)
  // Empty sections render null; we still need to know which ones are visible
  // to draw dividers, so probe by rendering into a wrapper with `empty:hidden`.
  return (
    <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-6'}`}>
      {blocks.map((block) => (
        <div key={block.key} className={`empty:hidden border-t border-line ${compact ? 'pt-4' : 'pt-6'}`}>{block}</div>
      ))}
    </div>
  )
}

// --- layouts -------------------------------------------------------------------

export default function ProfileCard({ profile, compact = false, className = '' }) {
  const joined = joinedLabel(profile.createdAt)
  const layout = profile.layout || 'card'
  const accent = accentOf(profile.accent)

  if (layout === 'minimal') {
    const size = compact ? 72 : 112
    return (
      <div className={`w-full ${className}`}>
        <div className={`mx-auto flex w-full flex-col ${compact ? 'max-w-full px-1 py-2' : 'max-w-[560px]'}`}>
          <span className="mx-auto rounded-full p-[3px]" style={{ backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, borderRadius: profile.avatarShape === 'rounded' ? '28%' : '9999px' }}>
            <span className="block bg-bg p-[3px]" style={{ borderRadius: 'inherit' }}>
              <ProfileAvatar profile={profile} size={size} />
            </span>
          </span>
          <div className={compact ? 'mt-3' : 'mt-5'}>
            <Identity profile={profile} compact={compact} centered />
          </div>
          <div className={compact ? 'mt-4' : 'mt-8'}>
            <Sections profile={profile} compact={compact} centered joined={joined} />
          </div>
        </div>
      </div>
    )
  }

  if (layout === 'cover') {
    const size = compact ? 64 : 104
    return (
      <div className={`w-full ${className}`}>
        <Banner profile={profile} className={compact ? 'h-[84px] rounded-xl' : 'h-44 sm:h-56 md:h-64'} />
        <div className={`mx-auto w-full ${compact ? 'px-2' : 'max-w-[640px] px-5 sm:px-6'}`}>
          <div className="relative z-10 flex items-end" style={{ marginTop: `-${Math.round(size / 2)}px` }}>
            <span className="bg-bg p-1" style={{ borderRadius: profile.avatarShape === 'rounded' ? '30%' : '9999px' }}>
              <ProfileAvatar profile={profile} size={size} />
            </span>
          </div>
          <div className={compact ? 'mt-3' : 'mt-4'}>
            <Identity profile={profile} compact={compact} />
          </div>
          <div className={compact ? 'mt-4' : 'mt-7'}>
            <Sections profile={profile} compact={compact} joined={joined} />
          </div>
        </div>
      </div>
    )
  }

  const size = compact ? 64 : 88
  return (
    <article className={`overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
      <Banner profile={profile} className={compact ? 'h-[72px]' : 'h-28 sm:h-36'} />
      <div className={compact ? 'px-4 pb-4' : 'px-6 pb-6 sm:px-8 sm:pb-8'}>
        <div className="relative z-10 flex items-end" style={{ marginTop: `-${Math.round(size / 2)}px` }}>
          <span className="bg-surface p-1 ring-1 ring-line" style={{ borderRadius: profile.avatarShape === 'rounded' ? '30%' : '9999px' }}>
            <ProfileAvatar profile={profile} size={size} />
          </span>
        </div>
        <div className={compact ? 'mt-3' : 'mt-4'}>
          <Identity profile={profile} compact={compact} />
        </div>
        <div className={compact ? 'mt-4' : 'mt-6'}>
          <Sections profile={profile} compact={compact} joined={joined} />
        </div>
      </div>
    </article>
  )
}
