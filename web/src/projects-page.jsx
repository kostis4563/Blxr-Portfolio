import { useState, useEffect } from 'react'
import ProjectCover from './components/project-cover'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { useI18n } from './lib/i18n'
import {
  projectsList,
  findProject,
  isVideoLink,
  SHORT_KEY,
  FULL_KEY,
  FEATURE_KEY,
  METRIC_KEY,
  METRIC_VALUE_KEY,
  URL_LABEL_KEY
} from './lib/projects'
import { libraryList } from './lib/library'
import { link, useRouteHash, LIBRARY_PATH } from './lib/router'
import { imageProps, SIZES } from './lib/images'

const youtubeId = (url) => /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url ?? '')?.[1] ?? null

const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle'
const ROW = 'grid gap-y-3 sm:grid-cols-[152px_minmax(0,1fr)] sm:gap-x-8'

export default function ProjectsPage({ onBack, theme, onToggleTheme }) {
  const { t } = useI18n()

  const tShort = (p) => t(SHORT_KEY[p.id], null, p.shortDescription)
  const tFull = (p) => t(FULL_KEY[p.id], null, p.fullDescription)
  const tFeature = (p, i) => (FEATURE_KEY[p.id] ? t(`${FEATURE_KEY[p.id]}.${i + 1}`, null, p.features[i]) : p.features[i])
  const tCategory = (c) => t(`cat.${c}`, null, c)
  const tMetricLabel = (label) => t(METRIC_KEY[label], null, label)
  const tMetricValue = (value) => t(METRIC_VALUE_KEY[value], null, value)
  const tAction = (p) => (p.urlLabel ? t(URL_LABEL_KEY[p.urlLabel], null, p.urlLabel) : t('proj.liveDemo'))

  const hash = useRouteHash()
  const targetId = hash ? findProject(decodeURIComponent(hash.slice(1)))?.id ?? null : null

  const [open, setOpen] = useState(() => new Set())

  const [playing, setPlaying] = useState(() => new Set())
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
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  useEffect(() => {
    if (!targetId) {
      if (!hash) window.scrollTo(0, 0)
      return
    }
    setOpen((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)))
    document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
  }, [targetId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

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
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    for (const el of pending) observer.observe(el)

    return () => {
      observer.disconnect()
      for (const el of items) el.classList.remove('reveal-pending', 'reveal-in')
    }
  }, [])

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">

      <header className="w-full max-w-[880px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a
            {...link('/', onBack)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>{t('proj.backHome')}</span>
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

      <main className="w-full max-w-[880px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen bg-bg animate-rise-in">

        <div className="w-full flex items-baseline justify-between gap-6">
          <div className="max-w-[560px] text-left">
            <h1 className="text-[28px] sm:text-[32px] font-bold text-ink-strong tracking-[-0.03em] leading-tight">
              {t('home.projects')}
            </h1>
            <p className="mt-2 text-[14.5px] text-ink-muted leading-relaxed">
              {t('home.libraryTagline')}
            </p>
          </div>
          <span className="hidden sm:block font-mono text-[11px] text-ink-subtle shrink-0">
            {t('home.projectsCount', { n: projectsList.length })}
          </span>
        </div>

        <div className="w-full mt-12 flex flex-col">
          {projectsList.map((project, index) => {
            const isOpen = open.has(project.id)
            const videoId = isVideoLink(project.url) ? youtubeId(project.url) : null
            const isPlaying = videoId && playing.has(project.id)
            const detailsId = `${project.id}-details`

            return (
              <article
                key={project.id}
                id={project.id}
                className={`project-entry w-full scroll-mt-16 ${index > 0 ? 'mt-12 pt-12 border-t border-line' : ''}`}
              >
                <div
                  onClick={() => (videoId ? play(project.id) : toggle(project.id))}
                  className={`project-entry-cover group relative w-full overflow-hidden rounded-xl bg-surface-raised ${
                    isPlaying ? 'aspect-video bg-black' : 'aspect-[4/3] sm:aspect-[2/1] cursor-pointer'
                  }`}
                >
                  {isPlaying ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
                      title={`${project.title} showcase`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full border-0"
                    />
                  ) : project.image ? (
                    <img
                      {...imageProps(project.image, SIZES.archiveCover)}
                      alt={project.imageAlt ?? `${project.title} cover`}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 ? 'high' : undefined}
                      decoding="async"
                      width="1200"
                      height="675"
                      style={{ objectPosition: project.imagePosition ?? 'center' }}
                      className="project-entry-img absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <ProjectCover project={project} />
                  )}
                  {!isPlaying && <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-[var(--hairline)]" />}
                  {videoId && !isPlaying && (
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); play(project.id) }}
                      aria-label={`${tAction(project)} — ${project.title}`}
                      className="project-play absolute inset-0 flex items-end justify-start p-3 sm:p-4 outline-none cursor-pointer"
                    >
                      <span className="project-play-pill inline-flex items-center gap-2.5 h-11 pl-4 pr-5 rounded-full bg-black/55 text-white text-[13px] font-semibold backdrop-blur-md ring-1 ring-white/15">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white text-black">
                          <svg className="w-2.5 h-2.5 translate-x-px" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2.5 1.5v9l8-4.5z" /></svg>
                        </span>
                        {tAction(project)}
                      </span>
                    </button>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-ink-subtle">
                      <span className="text-ink-faint">{String(index + 1).padStart(2, '0')}</span>
                      <span className="mx-2 text-ink-faint">/</span>
                      {tCategory(project.category)} · {project.date}
                    </p>
                    <h2 className="mt-2 text-[22px] sm:text-[24px] font-semibold leading-tight tracking-tight text-ink-strong">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={detailsId}
                        onClick={() => toggle(project.id)}
                        className="cursor-pointer text-left outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
                      >
                        {project.title}
                      </button>
                    </h2>
                    <p className="mt-2 max-w-[560px] text-[14.5px] leading-relaxed text-ink-muted">
                      {tShort(project)}
                    </p>
                  </div>

                  {(project.url || project.github) && (
                    <div className="flex items-center gap-5 shrink-0 text-[13px] font-medium">
                      {project.github && (
                        <a href={project.github} target="_blank" rel="noreferrer" className="text-ink-muted hover:text-ink-strong transition-colors">
                          {t('proj.viewSource')} ↗
                        </a>
                      )}
                      {project.url && (
                        <a href={project.url} target="_blank" rel="noreferrer" className="text-ink-strong hover:text-ink-muted transition-colors">
                          {tAction(project)} ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                  {project.metrics?.length > 0 && (
                    <div className="flex flex-wrap gap-x-8 gap-y-3">
                      {project.metrics.map((metric) => (
                        <div key={metric.label} className="min-w-0">
                          <div className="text-[14px] font-semibold text-ink-strong leading-snug">
                            {tMetricValue(metric.value)}
                          </div>
                          <div className="mt-0.5 text-[10.5px] text-ink-subtle">
                            {tMetricLabel(metric.label)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={detailsId}
                    onClick={() => toggle(project.id)}
                    className="project-toggle inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors cursor-pointer outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
                  >
                    <span>{isOpen ? t('proj.hideDetails') : t('home.viewDetails')}</span>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>

                <div id={detailsId} className="project-details" data-open={isOpen ? '' : undefined}>
                  <div>
                    <div className="project-details-inner pt-8" inert={!isOpen}>
                      <section className={ROW}>
                        <h3 className={LABEL}>{t('proj.overview')}</h3>
                        <p className="text-[14px] leading-[1.75] text-ink-secondary">
                          {tFull(project)}
                        </p>
                      </section>

                      <section className={`${ROW} mt-8`}>
                        <h3 className={LABEL}>{t('proj.keyFeatures')}</h3>
                        <ul className="flex flex-col gap-2.5">
                          {project.features.map((_, i) => (
                            <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-ink-secondary">
                              <span className="text-ink-faint shrink-0" aria-hidden="true">—</span>
                              <span>{tFeature(project, i)}</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section className={`${ROW} mt-8`}>
                        <h3 className={LABEL}>{t('proj.technologies')}</h3>
                        <p className="font-mono text-[12px] leading-relaxed text-ink-muted">
                          {project.tags.join(' · ')}
                        </p>
                      </section>

                      {project.gallery?.length > 0 && (
                        <section className={`${ROW} mt-8`}>
                          <h3 className={LABEL}>{t('proj.gallery')}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {project.gallery.map((item, i) => {
                              const wide = i === 0 && project.gallery.length % 2 === 1
                              return (
                                <figure
                                  key={item.src}
                                  className={`overflow-hidden rounded-lg bg-surface-raised ${wide ? 'sm:col-span-2 aspect-[2/1]' : 'aspect-[4/3]'}`}
                                >
                                  <img
                                    {...imageProps(item.src, wide ? '(min-width: 880px) 632px, calc(100vw - 40px)' : '(min-width: 880px) 310px, calc(100vw - 40px)')}
                                    alt={item.alt}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover object-top"
                                  />
                                </figure>
                              )
                            })}
                          </div>
                        </section>
                      )}

                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => collapse(project.id)}
                        className="mt-8 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-subtle hover:text-ink-strong transition-colors cursor-pointer"
                      >
                        <span>{t('proj.hideDetails')}</span>
                        <span aria-hidden="true">↑</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <a
          {...link(LIBRARY_PATH)}
          className="group w-full mt-12 pt-8 border-t border-line flex items-center justify-between gap-4 cursor-pointer"
        >
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-ink-subtle">FiveM · {t('lib.count', { n: libraryList.length })}</p>
            <p className="mt-1 text-[15px] font-semibold text-ink-strong tracking-tight">{t('lib.title')}</p>
          </div>
          <span className="text-[13px] font-medium text-ink-muted group-hover:text-ink-strong group-hover:translate-x-0.5 transition-all shrink-0">
            {t('lib.open')} →
          </span>
        </a>

      </main>

    </div>
  )
}
