import { useState, useEffect, useRef } from 'react'
import ProjectCover from './components/project-cover'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { projectsList, findProject, isVideoLink } from './lib/projects'
import { libraryList } from './lib/library'
import SiteFooter from './components/site-footer'
import { link, navigate, projectPath, useRouteHash, HOME_PATH, LIBRARY_PATH, CONTACT_PATH } from './lib/router'
import { imageProps, SIZES } from './lib/images'

const youtubeId = (url) => /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url ?? '')?.[1] ?? null

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const GUTTER = 'px-6 sm:px-10'
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]'
const LABEL = 'font-mono text-[12px] text-ink-subtle select-none sm:pt-0.5'
const ROW = 'grid grid-cols-1 gap-3 sm:grid-cols-[7.5rem_1fr] sm:gap-6'
const PILL = 'project-cta group/pill inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-line bg-surface pl-3 pr-2.5 text-[12.5px] font-medium outline-none transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg'
const ARROW_OUT = `h-3 w-3 transition-transform duration-300 ${EASE} group-hover/pill:-translate-y-px group-hover/pill:translate-x-px`

const pad = (n) => String(n).padStart(2, '0')

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Cover({ project, sizes, className = '' }) {
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
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  )
}

function ProjectIndex({ onJump }) {
  const [active, setActive] = useState(projectsList[0]?.id)
  const current = findProject(active) ?? projectsList[0]

  return (
    <nav aria-label="Project index" className="border-t border-dashed border-line md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <ol className="project-index">
        {projectsList.map((project, index) => (
          <li
            key={project.id}
            onPointerEnter={() => setActive(project.id)}
            onFocus={() => setActive(project.id)}
            className="border-b border-dashed border-line last:border-b-0 animate-rise-in"
            style={{ animationDelay: `${220 + index * 50}ms` }}
          >
            <a
              {...link(projectPath(project.id), () => onJump(project.id))}
              data-active={active === project.id ? '' : undefined}
              className={`project-index-row group relative grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 py-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/40 sm:grid-cols-[3rem_1fr_auto_1.5rem] sm:py-5 ${GUTTER}`}
            >
              <span aria-hidden="true" className="contact-row-fill absolute inset-0 bg-surface-raised" />
              <span className="relative font-mono text-[11px] tabular-nums text-ink-faint transition-colors duration-300 group-hover:text-ink-muted">
                {pad(index + 1)}
              </span>
              <span className="relative min-w-0">
                <span className={`project-index-title block truncate font-bagus text-[24px] leading-[1.1] tracking-[-0.01em] text-ink-strong transition-[transform,opacity] duration-500 ${EASE} group-hover:translate-x-1.5 sm:text-[30px]`}>
                  {project.title}
                </span>
                <span className="mt-1 block truncate text-[12px] text-ink-subtle sm:hidden">{project.category}</span>
              </span>
              <span className="relative hidden text-right text-[12.5px] text-ink-subtle transition-colors duration-300 group-hover:text-ink-secondary sm:block">
                {project.category}
              </span>
              <span aria-hidden="true" className="relative flex justify-end text-ink-faint transition-colors duration-300 group-hover:text-ink-strong">
                <Icon name="arrowDown" className={`h-4 w-4 transition-transform duration-500 ${EASE} group-hover:translate-y-0.5`} />
              </span>
            </a>
          </li>
        ))}
      </ol>

      <div aria-hidden="true" className="hidden border-l border-dashed border-line p-6 md:block lg:p-8 animate-fade-in" style={{ animationDelay: '360ms' }}>
        <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-raised">
          {projectsList.map((project) => (
            <div
              key={project.id}
              className="project-preview absolute inset-0"
              data-active={active === project.id ? '' : undefined}
            >
              <Cover project={project} sizes={SIZES.archivePreview} />
            </div>
          ))}
          <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-[var(--hairline)]" />
        </div>
        <div key={current.id} className="project-preview-caption mt-5">
          <p className="font-mono text-[11px] text-ink-subtle">
            {current.badge ?? current.category}
            <span className="mx-1.5 text-ink-faint">·</span>
            {current.date}
          </p>
          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-muted">{current.shortDescription}</p>
        </div>
      </div>
    </nav>
  )
}

function ProjectLinks({ project }) {
  const url = project.url && !(isVideoLink(project.url) && !project.video) ? project.url : null
  if (!url && !project.github) return null

  return (
    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className={`${PILL} text-ink-strong`}>
          <span>{project.urlLabel || 'Live demo'}</span>
          <Icon name="arrowUpRight" className={ARROW_OUT} strokeWidth={2} />
        </a>
      )}
      {project.github && (
        <a href={project.github} target="_blank" rel="noreferrer" className={`${PILL} text-ink-muted hover:text-ink-strong`}>
          <span>Source</span>
          <Icon name="arrowUpRight" className={ARROW_OUT} strokeWidth={2} />
        </a>
      )}
    </div>
  )
}

function Bullets({ items, columns }) {
  return (
    <ol className={`grid gap-x-8 gap-y-3 ${columns ? 'md:grid-cols-2' : ''}`}>
      {items.map((item, i) => (
        <li key={item} className="flex gap-3 text-[13.5px] leading-relaxed text-ink-secondary">
          <span aria-hidden="true" className="w-5 shrink-0 pt-[3px] font-mono text-[10.5px] tabular-nums text-ink-faint">{pad(i + 1)}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
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

function CaseStudy({ project, onCollapse }) {
  return (
    <div className={`flex flex-col gap-10 border-t border-dashed border-line pt-10 pb-10 sm:pt-12 ${GUTTER}`}>
      <section className={ROW}>
        <h3 className={LABEL}>Overview</h3>
        <p className="max-w-[64ch] text-[14.5px] leading-[1.75] text-ink-secondary">
          {project.fullDescription}
        </p>
      </section>

      <section className={ROW}>
        <h3 className={LABEL}>What it does</h3>
        <Bullets items={project.features} columns />
      </section>

      {project.internals?.length > 0 && (
        <section className={ROW}>
          <h3 className={LABEL}>Under the hood</h3>
          <Bullets items={project.internals} />
        </section>
      )}

      <section className={ROW}>
        <h3 className={LABEL}>Stack</h3>
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
      </section>

      {project.gallery?.length > 0 && (
        <section className={ROW}>
          <h3 className={LABEL}>Gallery</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {project.gallery.map((item, i) => {
              const wide = i === 0 && project.gallery.length % 2 === 1
              return (
                <figure
                  key={item.src}
                  className={`relative overflow-hidden rounded-lg bg-surface-raised ${wide ? 'sm:col-span-2 aspect-[2/1]' : 'aspect-[4/3]'}`}
                >
                  <img
                    {...imageProps(item.src, wide ? SIZES.archiveGalleryWide : SIZES.archiveGallery)}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-top"
                  />
                  <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-[var(--hairline)]" />
                </figure>
              )
            })}
          </div>
        </section>
      )}

      <div className={ROW}>
        <span aria-hidden="true" className="hidden sm:block" />
        <button
          type="button"
          tabIndex={-1}
          onClick={onCollapse}
          className="group inline-flex items-center gap-1.5 justify-self-start text-[12.5px] font-medium text-ink-subtle transition-colors duration-200 hover:text-ink-strong cursor-pointer"
        >
          <span>Close case study</span>
          <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:-translate-y-0.5">↑</span>
        </button>
      </div>
    </div>
  )
}

function ProjectEntry({ project, index, isOpen, isPlaying, onToggle, onCollapse, onPlay }) {
  const videoId = youtubeId(project.video ?? (isVideoLink(project.url) ? project.url : null))
  const playLabel = project.video ? 'Watch showcase' : project.urlLabel || 'Watch showcase'
  const detailsId = `${project.id}-details`
  const titleId = `${project.id}-title`
  const metrics = project.metrics ?? []

  return (
    <article
      id={project.id}
      aria-labelledby={titleId}
      className="project-entry border-b border-dashed border-line"
    >
      <header className={`pt-14 sm:pt-20 ${GUTTER}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className={KICKER}>
            <span className="text-ink-faint">{pad(index + 1)}</span>
            <span className="mx-2 text-ink-faint">/</span>
            {project.category}
            <span className="mx-2 text-ink-faint">·</span>
            {project.date}
          </p>
          {project.badge && (
            <span className="rounded-full border border-dashed border-line-strong px-2 py-px font-mono text-[10.5px] text-ink-muted">
              {project.badge}
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-x-8">
          <h2 id={titleId} className="font-bagus text-[40px] leading-[0.95] tracking-[-0.02em] text-ink-strong sm:col-start-1 sm:row-start-1 sm:text-[60px]">
            {project.title}
          </h2>
          <p className="max-w-[60ch] text-[15px] leading-[1.6] text-ink-muted sm:col-span-2 sm:row-start-2">
            {project.shortDescription}
          </p>
          <div className="sm:col-start-2 sm:row-start-1">
            <ProjectLinks project={project} />
          </div>
        </div>
      </header>

      <div className={`mt-10 ${GUTTER}`}>
        <div
          onClick={() => (videoId ? onPlay() : onToggle())}
          className={`project-entry-cover group relative aspect-video w-full overflow-hidden rounded-xl ${isPlaying ? 'bg-black' : 'bg-surface-raised cursor-pointer'}`}
        >
          {isPlaying ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              title={`${project.title} showcase`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <Cover project={project} sizes={SIZES.archiveCover} className="project-entry-img" />
          )}
          {!isPlaying && <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-[var(--hairline)]" />}
          {videoId && !isPlaying && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onPlay() }}
              aria-label={`${playLabel} — ${project.title}`}
              className="project-play absolute inset-0 flex items-end justify-start p-3 outline-none cursor-pointer sm:p-5"
            >
              <span className="project-play-pill inline-flex h-11 items-center gap-2.5 rounded-full bg-black/55 pl-1.5 pr-5 text-[13px] font-semibold text-white ring-1 ring-white/15 backdrop-blur-md">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                  <svg className="h-3 w-3 translate-x-px" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2.5 1.5v9l8-4.5z" /></svg>
                </span>
                {playLabel}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 border-t border-dashed border-line sm:grid-cols-[minmax(0,1fr)_auto]">
        {metrics.length > 0 && (
          <dl
            className="grid grid-cols-1 sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
            style={{ '--cols': metrics.length }}
          >
            {metrics.map((metric, i) => (
              <div
                key={metric.label}
                className={`flex items-baseline justify-between gap-4 border-b border-dashed border-line py-3.5 sm:flex-col sm:items-start sm:justify-start sm:gap-1.5 sm:border-b-0 sm:py-5 ${GUTTER} ${i > 0 ? 'sm:border-l' : ''}`}
              >
                <dt className="font-mono text-[11px] text-ink-subtle">{metric.label}</dt>
                <dd className="text-right text-[14px] font-medium leading-snug text-ink-strong sm:text-left">{metric.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={detailsId}
          onClick={onToggle}
          className={`project-toggle group relative flex items-center justify-between gap-6 py-4 text-[13px] font-medium text-ink-muted outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/40 aria-expanded:text-ink-strong cursor-pointer sm:border-l sm:border-dashed sm:border-line sm:py-5 ${GUTTER}`}
        >
          <span aria-hidden="true" className="contact-row-fill absolute inset-0 bg-surface-raised" />
          <span className="relative whitespace-nowrap">{isOpen ? 'Close case study' : 'Read case study'}</span>
          <span aria-hidden="true" className="relative flex h-7 w-7 items-center justify-center rounded-full border border-line bg-bg text-ink-strong transition-colors duration-200 group-hover:border-line-strong">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
              <path d="M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path className="project-toggle-plus" d="M8 3.5v9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      </div>

      <div id={detailsId} className="project-details" data-open={isOpen ? '' : undefined}>
        <div>
          <div className="project-details-inner" inert={!isOpen}>
            <CaseStudy project={project} onCollapse={onCollapse} />
          </div>
        </div>
      </div>
    </article>
  )
}

function EndRow({ index, name, detail, props }) {
  return (
    <li className="border-b border-dashed border-line">
      <a
        {...props}
        className={`contact-row group relative grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/40 sm:grid-cols-[3rem_1fr_auto_2rem] sm:py-7 ${GUTTER}`}
      >
        <span aria-hidden="true" className="contact-row-fill absolute inset-0 bg-surface-raised" />
        <span className="relative font-mono text-[11px] tabular-nums text-ink-faint transition-colors duration-300 group-hover:text-ink-muted">
          {index}
        </span>
        <span className="relative min-w-0">
          <span className={`block font-bagus text-[24px] leading-none tracking-[-0.01em] text-ink-strong transition-transform duration-500 ${EASE} group-hover:translate-x-1.5 sm:text-[32px]`}>
            {name}
          </span>
          <span className="mt-1.5 block truncate text-[12.5px] text-ink-subtle sm:hidden">{detail}</span>
        </span>
        <span className="relative hidden text-right text-[13px] text-ink-subtle transition-colors duration-300 group-hover:text-ink-secondary sm:block">
          {detail}
        </span>
        <span aria-hidden="true" className="relative flex justify-end text-ink-faint transition-colors duration-300 group-hover:text-ink-strong">
          <Icon name="arrowRight" className={`h-4 w-4 transition-transform duration-500 ${EASE} group-hover:translate-x-1`} />
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
  const jumpingTo = useRef(null)

  const openOne = (id) => setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  const play = (id) => setPlaying((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const collapse = (id) => {
    toggle(id)
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  const jump = (id) => {
    jumpingTo.current = id
    navigate(projectPath(id), { replace: true })
    const el = document.getElementById(id)
    el?.classList.remove('reveal-pending')
    el?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (!targetId) {
      if (!hash) window.scrollTo(0, 0)
      return
    }
    if (jumpingTo.current === targetId) {
      jumpingTo.current = null
      return
    }
    openOne(targetId)
    document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
  }, [targetId])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    if (reducedMotion()) return

    const items = Array.from(document.querySelectorAll('.project-entry'))
    const pending = items.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92)
    if (!pending.length) return

    for (const el of pending) el.classList.add('reveal-pending')
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('reveal-in')
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 })
    for (const el of pending) observer.observe(el)

    return () => {
      observer.disconnect()
      for (const el of items) el.classList.remove('reveal-pending', 'reveal-in')
    }
  }, [])

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

        <section className={`pt-16 pb-12 sm:pt-24 sm:pb-16 ${GUTTER}`}>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 animate-rise-in">
            <p className={KICKER}>/ projects</p>
            <p className="font-mono text-[11px] tabular-nums text-ink-subtle">
              {pad(projectsList.length)} projects
            </p>
          </div>
          <h1
            className="mt-8 font-bagus text-[48px] leading-[0.95] tracking-[-0.02em] text-ink-strong sm:text-[96px] animate-fade-in-up"
            style={{ animationDelay: '60ms' }}
          >
            Projects
          </h1>
          <p
            className="mt-6 max-w-[50ch] text-[15px] leading-[1.6] text-ink-muted animate-fade-in-up"
            style={{ animationDelay: '150ms' }}
          >
            Everything I've built so far, from security tooling to client work. Each one comes with the story behind it, the stack and, where I can share it, the source.
          </p>
        </section>

        <ProjectIndex onJump={jump} />

        <div className="border-t border-dashed border-line">
          {projectsList.map((project, index) => (
            <ProjectEntry
              key={project.id}
              project={project}
              index={index}
              isOpen={open.has(project.id)}
              isPlaying={playing.has(project.id)}
              onToggle={() => toggle(project.id)}
              onCollapse={() => collapse(project.id)}
              onPlay={() => play(project.id)}
            />
          ))}
        </div>

        <section aria-labelledby="projects-more">
          <h2 id="projects-more" className={`${KICKER} ${GUTTER} pb-4 pt-14`}>
            Also
          </h2>
          <ul className="border-t border-dashed border-line">
            <EndRow
              index={pad(1)}
              name="FiveM Library"
              detail={`${libraryList.length} interfaces and scripts`}
              props={link(LIBRARY_PATH)}
            />
            <EndRow
              index={pad(2)}
              name="Start a project"
              detail="Email, or a message thread here"
              props={link(CONTACT_PATH)}
            />
          </ul>
        </section>

        <SiteFooter gutter={GUTTER} className="mt-auto" />

      </main>

    </div>
  )
}
