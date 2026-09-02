import { useEffect } from 'react'
import ProjectCover from './components/project-cover'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { useI18n } from './lib/i18n'
import { findProject, METRIC_KEY, METRIC_VALUE_KEY, URL_LABEL_KEY, SHORT_KEY } from './lib/projects'
import { link, PROJECTS_PATH } from './lib/router'
import { imageProps } from './lib/images'
import SevenXZeroPage from './seven-x-zero-page'
import { AmitistaPage, AsyncPage, PadooFoodPage } from './custom-project-pages'

export default function ProjectPage({ projectId, theme, onToggleTheme }) {
  const { t } = useI18n()
  const project = findProject(projectId)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [projectId])

  if (!project) return null

  if (project.id === '7x0-site') {
    return <SevenXZeroPage project={project} theme={theme} onToggleTheme={onToggleTheme} />
  }

  if (project.id === 'async') return <AsyncPage project={project} theme={theme} onToggleTheme={onToggleTheme} />
  if (project.id === 'padoofood') return <PadooFoodPage project={project} theme={theme} onToggleTheme={onToggleTheme} />
  if (project.id === 'amitista') return <AmitistaPage project={project} theme={theme} onToggleTheme={onToggleTheme} />

  const tCategory = (c) => t(`cat.${c}`, null, c)
  const tMetricLabel = (label) => t(METRIC_KEY[label], null, label)
  const tMetricValue = (value) => t(METRIC_VALUE_KEY[value], null, value)
  const tShort = t(SHORT_KEY[project.id], null, project.shortDescription)
  const actionLabel = project.urlLabel
    ? t(URL_LABEL_KEY[project.urlLabel], null, project.urlLabel)
    : t('proj.liveDemo')

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">

      {}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] z-0"
        style={{
          background: `radial-gradient(72% 100% at 50% 0%, ${project.accent ?? 'transparent'}26, transparent 70%)`
        }}
      />

      {}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-4 bg-bg z-30"
      />

      {}
      <header className="w-full max-w-[768px] bg-bg text-ink h-[52px] fixed left-1/2 -translate-x-1/2 z-40 border-b border-l border-dashed border-r border-line top-4 flex items-center px-6">
        <div className="w-full flex items-center justify-between">
          {}
          <a
            {...link(PROJECTS_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>{t('proj.archiveTitle')}</span>
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

      <main className="w-full max-w-[768px] mx-auto px-6 pt-24 pb-20 flex flex-col items-start border-l border-dashed border-r border-line min-h-screen bg-bg animate-rise-in">

        {}
        <div className="relative w-[calc(100%+3rem)] -mx-6 border-b border-dashed border-line overflow-hidden">
          <div className="relative w-full aspect-[2/1] min-h-[280px] bg-surface-raised">
            {project.image ? (
              <img

                {...imageProps(project.image, '(min-width: 768px) 768px, 100vw')}
                alt={project.imageAlt ?? `${project.title} cover`}

                fetchPriority="high"
                decoding="async"
                width="1200"
                height="675"
                style={{ objectPosition: project.imagePosition ?? 'center' }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <ProjectCover project={project} />
            )}
            {}
            <div className="absolute inset-0 bg-gradient-to-t from-bg from-[16%] via-bg/85 via-[38%] to-transparent to-[84%]" />
          </div>

          <div className="absolute inset-x-0 bottom-0 px-6 pb-6 sm:pb-7">
            <div className="flex items-center gap-2 mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {}
              <span
                className="w-[7px] h-[7px] rounded-full shrink-0"
                style={{ backgroundColor: project.accent ?? 'var(--color-ink-faint)' }}
              />
              <span>{tCategory(project.category)}</span>
              <span className="w-[3px] h-[3px] rounded-full bg-ink-faint" />
              <span>{project.date}</span>
            </div>
            {}
            <h1 className="text-[clamp(30px,5.2vw,40px)] leading-[1.02] font-bold text-ink-strong tracking-tight">
              {project.title}
            </h1>
          </div>
        </div>

        <div className="w-full mt-7 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          {}
          <p className="text-ink-secondary text-[15.5px] leading-relaxed max-w-[460px]">
            {tShort}
          </p>

          {}
          {(project.url || project.github) && (
            <div className="flex items-center gap-5 shrink-0 sm:pt-0.5">
              {project.github && (
                <a
                  href={project.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-ink-muted hover:text-ink-strong text-[13px] font-semibold transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  <span>GitHub</span>
                </a>
              )}
              {project.url && (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink-strong text-ink-inverse text-[13px] font-semibold hover:bg-ink-secondary transition-colors"
                >
                  <span>{actionLabel}</span>
                  <span>→</span>
                </a>
              )}
            </div>
          )}
        </div>

        {project.gallery?.length > 0 && (
          <div className="w-full mt-10 grid grid-cols-2 gap-4 items-start">
            {project.gallery.map((item) => (
              <figure key={item.src} className="overflow-hidden rounded-xl border border-line bg-surface-raised">
                <img
                  {...imageProps(item.src, '(min-width: 768px) 360px, 50vw')}
                  alt={item.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto block"
                />
              </figure>
            ))}
          </div>
        )}

        <div className="w-full mt-8 grid grid-cols-3 border-y border-line">
          {project.metrics.map((metric, i) => (
            <div key={i} className="px-4 py-4 border-l border-line first:border-l-0">
              <div className="text-[10.5px] text-ink-subtle font-medium">{tMetricLabel(metric.label)}</div>
              <div className="text-[15px] font-semibold text-ink-strong leading-snug mt-1">{tMetricValue(metric.value)}</div>
            </div>
          ))}
        </div>

        <p className="w-full mt-9 text-ink-secondary text-[14px] leading-[1.75]">
          {project.fullDescription}
        </p>

        <section className="w-full mt-10">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle mb-4">
            {t('proj.keyFeatures')}
          </h2>
          {}
          <ul className="w-full border-t border-line">
            {project.features.map((feature, i) => (
              <li
                key={i}
                className="py-3 border-b border-line text-[13.5px] text-ink-secondary leading-relaxed"
              >
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full mt-10">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle mb-3">
            {t('proj.technologies')}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-md bg-surface-raised text-[11.5px] text-ink-muted font-medium tracking-tight"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        {}
        <a
          {...link(PROJECTS_PATH)}
          className="mt-12 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-muted hover:text-ink-strong transition-colors cursor-pointer"
        >
          <span>←</span>
          <span>{t('proj.archiveTitle')}</span>
        </a>

      </main>
    </div>
  )
}
