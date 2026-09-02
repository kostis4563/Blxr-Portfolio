import { useState, useEffect, useCallback } from 'react'
import ProjectCover from './components/project-cover'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { useI18n } from './lib/i18n'
import {
  libraryList,
  findLibraryItem,
  hasPlaceholders,
  LIB_METRIC_KEY,
  LIB_VALUE_KEY
} from './lib/library'
import { link, backOr, libraryPath, LIBRARY_PATH, PROJECTS_PATH } from './lib/router'
import { imageProps, SIZES } from './lib/images'

function EntryCover(
  { entry, src = entry.image, alt = `${entry.title} preview`, className = '' }
) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) return <ProjectCover project={entry} />

  return (
    <img
      {...imageProps(src, SIZES.contentColumn)}
      alt={alt}
      loading="lazy"
      decoding="async"
      width="1200"
      height="675"
      onError={() => setFailed(true)}
      className={className}
    />
  )
}

const ENTRY_NUMBER = new Map(libraryList.map((entry, i) => [entry.id, String(i + 1).padStart(2, '0')]))

export default function LibraryPage({ openItemId = null, theme, onToggleTheme }) {
  const { t } = useI18n()

  const tCategory = (c) => t(`cat.${c}`, null, c)
  const tMetricLabel = (label) => t(LIB_METRIC_KEY[label], null, label)
  const tMetricValue = (value) => t(LIB_VALUE_KEY[value], null, value)

  const tMetricSummary = (metric) =>
    /^\d+$/.test(metric.value)
      ? `${metric.value} ${tMetricLabel(metric.label).toLowerCase()}`
      : tMetricValue(metric.value)

  const selectedItem = findLibraryItem(openItemId)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const closeItem = useCallback(() => backOr(LIBRARY_PATH), [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (selectedItem) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [selectedItem])

  useEffect(() => {
    if (!selectedItem) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeItem()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedItem, closeItem])

  const categories = ['All', ...new Set(libraryList.map((entry) => entry.category).filter(Boolean))]

  const filteredItems = libraryList.filter((entry) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      entry.title.toLowerCase().includes(q) ||
      entry.shortDescription.toLowerCase().includes(q) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(q))
    const matchesCategory = selectedCategory === 'All' || entry.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">

      <header className="w-full max-w-[880px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          {}
          <a
            {...link(PROJECTS_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>{t('lib.back')}</span>
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

        {}
        <div className="w-full max-w-[620px] mb-12 text-left">
          <p className="text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em] mb-4">
            FiveM / {t('lib.count', { n: libraryList.length })}
          </p>
          <h1 className="text-[34px] sm:text-[40px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-4">
            {t('lib.title')}
          </h1>
          <p className="text-[15px] sm:text-[16px] text-ink-muted font-normal leading-relaxed">
            {t('lib.tagline')}
          </p>
        </div>

        {}
        {hasPlaceholders && (
          <div className="w-full mb-6 rounded-xl border border-dashed border-line-strong bg-surface-raised px-4 py-3 flex items-start gap-2.5">
            <span aria-hidden="true" className="text-[13px] leading-[1.5] text-amber-400">●</span>
            <p className="text-[12.5px] text-ink-muted leading-relaxed">
              {t('lib.placeholderNotice')}
            </p>
          </div>
        )}

        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-8">
          <div className="relative w-full sm:max-w-[300px]">
            <svg className="w-4 h-4 text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder={t('lib.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-b border-line pl-9 pr-3 py-2 text-[13px] text-ink-strong placeholder-neutral-500 focus:outline-none focus:border-ink-muted transition-colors"
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
                      : 'text-ink-muted hover:text-ink-strong'
                  }`}
                >
                  {cat === 'All' ? t('proj.filterAll') : tCategory(cat)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col w-full border-t border-line">
          {filteredItems.map((entry) => (
            <a
              key={entry.id}
              {...link(libraryPath(entry.id))}
              className="group py-6 sm:py-7 border-b border-line cursor-pointer grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-5 sm:gap-7 items-center"
            >
              {}
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-surface-raised">
                <EntryCover
                  entry={entry}
                  className="w-full h-full object-cover object-center"
                />

                {entry.placeholder && (
                  <span className="absolute top-2.5 right-3 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                    {t('lib.badge.example')}
                  </span>
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-[17px] font-bold text-ink-strong tracking-tight truncate group-hover:text-ink transition-colors">
                    {entry.title}
                  </h3>
                  <span className="text-ink-faint group-hover:text-ink-strong group-hover:translate-x-0.5 transition-all" aria-hidden="true">→</span>
                </div>

                <p className="text-ink-muted text-[13px] leading-relaxed line-clamp-2 mb-4">
                  {entry.shortDescription}
                </p>

                {}
                <div className="flex items-center gap-2 text-[10px] font-mono text-ink-subtle uppercase tracking-wider">
                  <span>{tCategory(entry.category)}</span>
                  <span className="text-ink-faint">/</span>
                  <span>{entry.metrics.slice(0, 2).map(tMetricSummary).join(' · ')}</span>
                </div>
              </div>
            </a>
          ))}

          {filteredItems.length === 0 && (
            <div className="col-span-full py-12 text-center text-ink-subtle text-[13px]">
              {t('lib.noResults', { q: searchQuery })}
            </div>
          )}
        </div>

      </main>

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-overlay-in"
          onClick={closeItem}
        >
          <div
            className="relative w-full max-w-[680px] max-h-[90vh] bg-surface border border-line rounded-2xl overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-2xl flex flex-col text-left animate-panel-in"
            onClick={(e) => e.stopPropagation()}
          >
            {}
            <div className="sticky top-0 z-30 h-0 flex justify-end">
              <button
                onClick={closeItem}
                aria-label="Close resource details"
                className="mt-3.5 mr-3.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/70 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {}
            <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-surface-raised">
              <EntryCover entry={selectedItem} className="w-full h-full object-cover object-center" />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 flex items-center gap-3">
                <div className="min-w-0">
                  <h2 className="text-[22px] font-bold text-white tracking-tight truncate">
                    {selectedItem.title}
                  </h2>
                  <span className="text-[11px] font-mono text-white/70 uppercase tracking-wider">
                    {tCategory(selectedItem.category)} · {selectedItem.date} · {ENTRY_NUMBER.get(selectedItem.id)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-7 space-y-7">

              {}
              {selectedItem.placeholder && (
                <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.07] px-4 py-3 flex items-start gap-2.5">
                  <span aria-hidden="true" className="text-[13px] leading-[1.5] text-amber-500">●</span>
                  <p className="text-[12.5px] text-ink-secondary leading-relaxed">
                    {t('lib.placeholderNotice')}
                  </p>
                </div>
              )}

              {}
              <div className="flex items-stretch border-y border-line">
                {selectedItem.metrics.map((metric, i) => (
                  <div
                    key={i}
                    className={`flex-1 min-w-0 px-2 py-4 text-left ${i > 0 ? 'border-l border-line' : ''}`}
                  >
                    <div className="text-[14px] font-bold text-ink-strong truncate">{tMetricValue(metric.value)}</div>
                    <div className="mt-0.5 text-[10px] font-mono text-ink-subtle uppercase tracking-wider truncate">{tMetricLabel(metric.label)}</div>
                  </div>
                ))}
              </div>

              {selectedItem.gallery?.slice(1).map((src, i) => (
                <div key={src} className="overflow-hidden rounded-xl border border-line bg-surface-raised">
                  <EntryCover
                    entry={selectedItem}
                    src={src}
                    alt={`${selectedItem.title} admin interface ${i + 1}`}
                    className="w-full h-auto object-contain"
                  />
                </div>
              ))}

              <div>
                <h3 className="text-[11px] font-mono font-semibold text-ink-subtle uppercase tracking-wider mb-2">
                  {t('proj.overview')}
                </h3>
                <p className="text-ink-secondary text-[13.5px] leading-relaxed">
                  {selectedItem.fullDescription}
                </p>
              </div>

              <div>
                <h3 className="text-[11px] font-mono font-semibold text-ink-subtle uppercase tracking-wider mb-2.5">
                  {t('proj.keyFeatures')}
                </h3>
                <ul className="space-y-2.5">
                  {selectedItem.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-ink-secondary">
                      <span aria-hidden="true" className="text-ink-faint shrink-0">—</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-[11px] font-mono font-semibold text-ink-subtle uppercase tracking-wider mb-2">
                  {t('proj.technologies')}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedItem.tags.map((tag, i) => (
                    <span key={i} className="text-[11px] font-mono text-ink-muted">
                      {tag}
                      {i < selectedItem.tags.length - 1 && <span className="ml-1.5 text-ink-faint">·</span>}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            {}
            {(selectedItem.github || selectedItem.url) && (
              <div className="sticky bottom-0 bg-surface/90 backdrop-blur-md px-6 py-4 border-t border-dashed border-line flex items-center justify-end gap-3 z-10">
                {selectedItem.github && (
                  <a
                    href={selectedItem.github}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-raised border border-line-strong text-ink-secondary hover:text-ink-strong text-[13px] font-semibold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                    <span>GitHub</span>
                  </a>
                )}

                {selectedItem.url && (
                  <a
                    href={selectedItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink-strong text-ink-inverse text-[13px] font-semibold hover:bg-ink-secondary transition-colors"
                  >
                    <span>{selectedItem.urlLabel ? t('proj.watchShowcase') : t('proj.liveDemo')}</span>
                    <span>→</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
