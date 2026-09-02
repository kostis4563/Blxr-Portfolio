import { useState, useEffect } from 'react'
import ProjectCover from './components/project-cover'
import ProjectMark from './components/project-mark'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { useI18n } from './lib/i18n'
import { projectsList, BADGE_KEY, SHORT_KEY } from './lib/projects'
import { libraryList, LIBRARY_CATEGORIES } from './lib/library'
import { link, projectPath, LIBRARY_PATH } from './lib/router'
import { trackPointerGlow } from './lib/pointer-glow'
import { imageProps } from './lib/images'

export default function ProjectsPage({ onBack, theme, onToggleTheme }) {
  const { t } = useI18n()

  const tBadge = (p) => t(BADGE_KEY[p.id], null, p.badge)
  const tShort = (p) => t(SHORT_KEY[p.id], null, p.shortDescription)
  const tCategory = (c) => t(`cat.${c}`, null, c)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const categories = ['All', ...new Set(projectsList.map((p) => p.category).filter(Boolean))]

  const filteredProjects = projectsList.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          project.shortDescription.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const libraryHaystack = [
    'fivem library',
    ...LIBRARY_CATEGORIES,
    ...libraryList.map((entry) => `${entry.title} ${entry.tags.join(' ')}`)
  ].join(' ').toLowerCase()
  const showLibraryBox =
    selectedCategory === 'All' && libraryHaystack.includes(searchQuery.toLowerCase())

  const handleMouseMove = trackPointerGlow

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">

      <header className="w-full max-w-[768px] bg-bg/90 backdrop-blur-md text-ink h-[52px] fixed left-1/2 -translate-x-1/2 z-40 border-b border-l border-dashed border-r border-line top-4 flex items-center px-6">
        <div className="w-full flex items-center justify-between">
          <a
            {...link('/', onBack)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>{t('proj.backHome')}</span>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-[13px] font-bold text-ink-strong tracking-tight">
              {t('proj.allProjects', { n: projectsList.length })}
            </span>
            {}
            <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors duration-200" />
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="text-ink-muted hover:text-ink-strong transition-colors duration-200"
            />
          </div>
        </div>
      </header>

      {}
      <main className="w-full max-w-[768px] mx-auto px-6 pt-28 pb-16 flex flex-col items-start border-l border-dashed border-r border-line min-h-screen bg-bg animate-rise-in">

        <div className="w-full mb-6 text-left">
          <h1 className="text-[26px] font-bold text-ink-strong tracking-tight mb-2">
            {t('proj.archiveTitle')}
          </h1>
          <p className="text-[14px] text-ink-muted font-normal leading-relaxed">
            {t('proj.archiveSubtitle')}
          </p>
        </div>

        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 pb-6 border-b border-dashed border-line">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder={t('proj.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-line rounded-xl pl-10 pr-4 py-1.5 text-[13px] text-ink-strong placeholder-neutral-500 focus:outline-none focus:border-line-strong transition-colors"
            />
          </div>

          {}
          {categories.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-ink-strong text-ink-inverse font-semibold'
                    : 'bg-surface-raised text-ink-muted hover:text-ink-strong border border-line'
                }`}
              >
                {cat === 'All' ? t('proj.filterAll') : tCategory(cat)}
              </button>
            ))}
          </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
          {filteredProjects.map((project) => (
            <a
              key={project.id}
              onMouseMove={handleMouseMove}
              {...link(projectPath(project.id))}
              className="relative p-[1px] rounded-[18px] bg-surface-raised hover:bg-surface-hover transition-colors duration-200 group overflow-hidden cursor-pointer flex flex-col justify-between"
            >
              <div
                className="glow-follow opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  '--glow-size': '240px',
                  background: 'radial-gradient(circle closest-side, var(--glow-strong) 0%, transparent 100%)'
                }}
              />

              <div className="relative bg-surface rounded-[17px] p-4 flex flex-col justify-between h-full text-left">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ProjectMark project={project} />
                      <h3 className="text-[15px] font-bold text-ink-strong tracking-tight truncate group-hover:text-purple-300 transition-colors">
                        {project.title}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                      {tBadge(project)}
                    </span>
                  </div>

                  <p className="text-ink-muted text-[12.5px] leading-snug line-clamp-2 mb-3">
                    {tShort(project)}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-line text-[11px]">
                  <span className="text-ink-subtle font-mono truncate">{tCategory(project.category)}</span>
                  <span className="text-ink-muted group-hover:text-ink-strong group-hover:translate-x-0.5 transition-all flex items-center gap-1 font-medium shrink-0">
                    {t('proj.view')}
                    <span>→</span>
                  </span>
                </div>
              </div>
            </a>
          ))}

          {}
          {showLibraryBox && (
            <a
              onMouseMove={handleMouseMove}
              {...link(LIBRARY_PATH)}
              aria-label={`${t('lib.title')}, ${t('lib.count', { n: libraryList.length })}`}
              className="col-span-full relative p-[1px] rounded-[18px] bg-surface-raised hover:bg-surface-hover transition-colors duration-200 group overflow-hidden cursor-pointer"
            >
              <div
                className="glow-follow opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  '--glow-size': '360px',
                  background: 'radial-gradient(circle closest-side, var(--glow-strong) 0%, transparent 100%)'
                }}
              />

              <div className="relative bg-surface rounded-[17px] p-4 flex items-stretch gap-4 text-left overflow-hidden">
                <div className="flex flex-col min-w-0 grow">
                  <div className="flex items-center gap-2.5 mb-2">
                    {}
                    <div className="w-7 h-7 rounded-lg bg-surface-raised border border-line-strong flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-ink-strong" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5L3.5 8l8.5 4.5L20.5 8 12 3.5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" />
                      </svg>
                    </div>
                    <h3 className="text-[15px] font-bold text-ink-strong tracking-tight truncate group-hover:text-purple-300 transition-colors">
                      {t('lib.title')}
                    </h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                      {t('lib.count', { n: libraryList.length })}
                    </span>
                  </div>

                  <p className="text-ink-muted text-[12.5px] leading-snug mb-3 max-w-[46ch]">
                    {t('lib.tagline')}
                  </p>

                  <div className="flex items-center justify-between gap-3 pt-2 mt-auto border-t border-line text-[11px]">
                    <span className="text-ink-subtle font-mono truncate">
                      {LIBRARY_CATEGORIES.map((cat) => tCategory(cat)).join(' · ')}
                    </span>
                    <span className="text-ink-muted group-hover:text-ink-strong group-hover:translate-x-0.5 transition-all flex items-center gap-1 font-medium shrink-0">
                      {t('lib.open')}
                      <span>→</span>
                    </span>
                  </div>
                </div>

                {}
                <div aria-hidden="true" className="hidden sm:flex items-center shrink-0 -space-x-8">
                  {libraryList.slice(0, 3).map((entry, i) => (
                    <div
                      key={entry.id}
                      className="w-[62px] h-[84px] rounded-lg overflow-hidden border border-line bg-surface-raised shadow-lg transition-transform duration-300 ease-out motion-reduce:transition-none"
                      style={{
                        transform: `rotate(${(i - 1) * 5}deg)`,
                        zIndex: i + 1
                      }}
                    >
                      {entry.image ? (
                        <img

                          {...imageProps(entry.image, '62px')}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="relative w-full h-full">
                          <ProjectCover project={entry} />
                          {}
                          <div
                            className="absolute inset-0"
                            style={{ background: `linear-gradient(150deg, ${entry.accent}38, transparent 70%)` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </a>
          )}

          {filteredProjects.length === 0 && !showLibraryBox && (
            <div className="col-span-full py-12 text-center text-ink-subtle text-[13px]">
              {t('proj.noResults', { q: searchQuery })}
            </div>
          )}
        </div>

      </main>

    </div>
  )
}
