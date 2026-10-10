import { useState, useEffect } from 'react'
import ProjectCover from './components/project-cover'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { projectsList, findProject, isVideoLink } from './lib/projects'
import { libraryList } from './lib/library'
import SiteFooter from './components/site-footer'
import { link, useRouteHash, HOME_PATH, LIBRARY_PATH, CONTACT_PATH } from './lib/router'
import { imageProps, SIZES } from './lib/images'

const youtubeId = (url) => /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url ?? '')?.[1] ?? null

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const GUTTER = 'px-6 sm:px-10'
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50'
const ACTION = `group inline-flex items-center gap-1.5 rounded-sm transition-colors duration-200 cursor-pointer ${FOCUS}`
const ARROW = 'inline-block transition-transform duration-200'
const INDENT = 'sm:pl-[224px]'
const ROW = `group flex items-baseline justify-between gap-6 border-b border-dashed border-line py-4 transition-colors duration-200 ${FOCUS}`

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Cover({ project, sizes }) {
  if (!project.image) return <ProjectCover project={project} />
  return (
    <img
      {...imageProps(project.image, sizes)}
      alt={project.imageAlt ?? `${project.title} cover`}
      loading="lazy"
      decoding="async"
      width="1200"
      height="675"
      style={{ objectPosition: project.imagePosition ?? 'center' }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className={KICKER}>{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function List({ items }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-ink-secondary">
          <span aria-hidden="true" className="select-none text-ink-faint">–</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Chips({ items }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item} className="rounded-md border border-line bg-surface-raised px-2 py-[3px] font-mono text-[11px] text-ink-secondary">
          {item}
        </li>
      ))}
    </ul>
  )
}

function Media({ project, videoId, isPlaying, onPlay }) {
  if (!videoId) return null
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-lg ${isPlaying ? 'bg-black' : 'bg-surface-raised'}`}>
      {isPlaying ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={`${project.title} showcase`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <>
          <Cover project={project} sizes={SIZES.projectMedia} />
          <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-[var(--hairline)]" />
          <button
            type="button"
            onClick={onPlay}
            aria-label={`Watch showcase — ${project.title}`}
            className="project-play absolute inset-0 flex items-end justify-start p-3 outline-none cursor-pointer sm:p-4"
          >
            <span className="project-play-pill inline-flex h-10 items-center gap-2.5 rounded-full bg-black/55 pl-1.5 pr-4 text-[13px] font-semibold text-white ring-1 ring-white/15 backdrop-blur-md">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
                <svg className="h-3 w-3 translate-x-px" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2.5 1.5v9l8-4.5z" /></svg>
              </span>
              Watch showcase
            </span>
          </button>
        </>
      )}
    </div>
  )
}

function Details({ project, videoId, isPlaying, onPlay }) {
  const metrics = project.metrics ?? []

  return (
    <div className={`flex flex-col gap-10 pb-12 ${INDENT}`}>
      <Media project={project} videoId={videoId} isPlaying={isPlaying} onPlay={onPlay} />

      <p className="max-w-[64ch] text-[14.5px] leading-[1.75] text-ink-secondary">{project.fullDescription}</p>

      {metrics.length > 0 && (
        <dl className="grid grid-cols-1 gap-4 border-y border-dashed border-line py-5 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-baseline justify-between gap-4 sm:flex-col sm:justify-start sm:gap-1">
              <dt className="font-mono text-[11px] text-ink-subtle">{metric.label}</dt>
              <dd className="text-right text-[14px] font-medium text-ink-strong sm:text-left">{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {project.features?.length > 0 && (
        <Section title="What it does">
          <List items={project.features} />
        </Section>
      )}

      {project.internals?.length > 0 && (
        <Section title="Under the hood">
          <List items={project.internals} />
        </Section>
      )}

      <Section title="Stack">
        {project.stack?.length > 0 ? (
          <dl className="flex flex-col gap-3">
            {project.stack.map(({ group, items }) => (
              <div key={group} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[5.5rem_1fr] sm:gap-4">
                <dt className="text-[12.5px] text-ink-muted sm:pt-[3px]">{group}</dt>
                <dd><Chips items={items} /></dd>
              </div>
            ))}
          </dl>
        ) : (
          <Chips items={project.tags} />
        )}
      </Section>

      {project.gallery?.length > 0 && (
        <Section title="Gallery">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {project.gallery.map((item) => (
              <figure key={item.src} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-raised">
                <img
                  {...imageProps(item.src, SIZES.projectGallery)}
                  alt={item.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-top"
                />
                <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-[var(--hairline)]" />
              </figure>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function ProjectRow({ project, isOpen, isPlaying, onToggle, onWatch }) {
  const videoId = youtubeId(project.video ?? (isVideoLink(project.url) ? project.url : null))
  const url = project.url && !isVideoLink(project.url) ? project.url : null
  const detailsId = `${project.id}-details`

  return (
    <article id={project.id} aria-labelledby={`${project.id}-title`} className={`scroll-mt-14 border-b border-dashed border-line ${GUTTER}`}>
      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 py-8 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6 sm:py-10">
        <div
          aria-hidden="true"
          onClick={onToggle}
          className="project-thumb relative aspect-video cursor-pointer self-start overflow-hidden rounded-md bg-surface-raised"
        >
          <Cover project={project} sizes={SIZES.projectThumb} />
          <div className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-[var(--hairline)]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id={`${project.id}-title`} className="min-w-0 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ink-strong sm:text-[20px]">
              <button type="button" onClick={onToggle} tabIndex={-1} className="text-left cursor-pointer outline-none">
                {project.title}
              </button>
            </h2>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-subtle">{project.date}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-ink-subtle">
            {project.category}
            {project.badge && <><span aria-hidden="true" className="mx-1.5 text-ink-faint">·</span>{project.badge}</>}
          </p>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.6] text-ink-muted">{project.shortDescription}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={detailsId}
              onClick={onToggle}
              className={`project-toggle ${ACTION} text-ink-strong`}
            >
              <span>{isOpen ? 'Hide details' : 'Details'}</span>
              <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                <path d="M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <path className="project-toggle-plus" d="M8 3v10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            {videoId && (
              <button type="button" onClick={onWatch} className={`${ACTION} text-ink-muted hover:text-ink-strong`}>
                <span>Watch</span>
                <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2.5 1.5v9l8-4.5z" /></svg>
              </button>
            )}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className={`${ACTION} text-ink-muted hover:text-ink-strong`}>
                <span>{project.urlLabel || 'Live demo'}</span>
                <span aria-hidden="true" className={`${ARROW} group-hover:-translate-y-px group-hover:translate-x-px`}>↗</span>
              </a>
            )}
            {project.github && (
              <a href={project.github} target="_blank" rel="noreferrer" className={`${ACTION} text-ink-muted hover:text-ink-strong`}>
                <span>Source</span>
                <span aria-hidden="true" className={`${ARROW} group-hover:-translate-y-px group-hover:translate-x-px`}>↗</span>
              </a>
            )}
          </div>
        </div>
      </div>

      <div id={detailsId} className="project-details" data-open={isOpen ? '' : undefined}>
        <div>
          <div className="project-details-inner" inert={!isOpen}>
            <Details project={project} videoId={videoId} isPlaying={isPlaying} onPlay={onWatch} />
          </div>
        </div>
      </div>
    </article>
  )
}

function Row({ name, detail, ...props }) {
  return (
    <li>
      <a {...props} className={ROW}>
        <span className="text-[15px] font-medium text-ink-strong">{name}</span>
        <span className="flex items-baseline gap-2 text-[13px] text-ink-subtle transition-colors duration-200 group-hover:text-ink-strong">
          <span className="font-mono">{detail}</span>
          <span aria-hidden="true" className={`${ARROW} group-hover:translate-x-0.5`}>→</span>
        </span>
      </a>
    </li>
  )
}

export default function ProjectsPage({ onBack, theme, onToggleTheme }) {
  const hash = useRouteHash()
  const targetId = hash ? findProject(decodeURIComponent(hash.slice(1)))?.id ?? null : null

  const [open, setOpen] = useState(() => new Set())
  const [playing, setPlaying] = useState(() => new Set())

  const add = (setter, id) => setter((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const watch = (id) => {
    add(setOpen, id)
    add(setPlaying, id)
  }

  useEffect(() => {
    if (!targetId) {
      if (!hash) window.scrollTo(0, 0)
      return
    }
    add(setOpen, targetId)
    document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [targetId])

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-clip antialiased font-sans animate-view-in">

      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-x border-dashed border-line top-0 flex items-center px-6 sm:px-10">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH, onBack)}
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            <span>Back to Home</span>
          </a>
          <div className="flex items-center gap-4">
            <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors duration-200" />
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="text-ink-muted hover:text-ink-strong transition-colors duration-200"
            />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[960px] mx-auto flex flex-col min-h-screen pt-14 border-x border-dashed border-line bg-bg">

        <section className={`pt-16 pb-12 sm:pt-24 sm:pb-16 animate-rise-in ${GUTTER}`}>
          <div className="flex items-baseline justify-between gap-6">
            <p className={KICKER}>/ projects</p>
            <p className="font-mono text-[11px] tabular-nums text-ink-subtle">{projectsList.length} projects</p>
          </div>
          <h1 className="mt-6 font-watom text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-strong sm:text-[64px]">Things I've built.</h1>
          <p className="mt-6 max-w-120 text-[15px] leading-[1.6] text-ink-muted">
            From security tooling to client work. Open any project for the story behind it, the stack and, where I can share it, the source.
          </p>
        </section>

        <div className="border-t border-dashed border-line animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          {projectsList.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isOpen={open.has(project.id)}
              isPlaying={playing.has(project.id)}
              onToggle={() => toggle(project.id)}
              onWatch={() => watch(project.id)}
            />
          ))}
        </div>

        <section aria-labelledby="projects-more" className={`mt-20 grid gap-y-4 sm:grid-cols-[180px_1fr] ${GUTTER}`}>
          <h2 id="projects-more" className={`${KICKER} sm:pt-5`}>Also</h2>
          <ul className="border-t border-dashed border-line">
            <Row {...link(LIBRARY_PATH)} name="FiveM Library" detail={`${libraryList.length} interfaces and scripts`} />
            <Row {...link(CONTACT_PATH)} name="Start a project" detail="get in touch" />
          </ul>
        </section>

        <SiteFooter gutter={GUTTER} className="mt-auto" />

      </main>

    </div>
  )
}
