import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { useI18n } from './lib/i18n'
import { imageProps } from './lib/images'
import { link, PROJECTS_PATH } from './lib/router'

const FLOW = [
  ['01', 'Learn', 'Detection guides explain the traces cheats leave behind and the tools used to find them.'],
  ['02', 'Investigate', 'Analyse suspicious files and follow a structured player-check workflow.'],
  ['03', 'Practise', 'Use quizzes and simulated scans to sharpen decisions before a live check.']
]

export default function SevenXZeroPage({ project, theme, onToggleTheme }) {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-bg text-ink selection:bg-selection selection:text-ink-strong overflow-x-hidden antialiased font-sans animate-view-in">
      <div aria-hidden="true" className="fixed inset-x-0 top-0 h-4 bg-bg z-30" />
      <header className="w-full max-w-[1120px] bg-bg/95 backdrop-blur-xl h-[52px] fixed left-1/2 -translate-x-1/2 z-40 border-b border-x border-dashed border-line top-4 flex items-center px-6">
        <div className="w-full flex items-center justify-between">
          <a {...link(PROJECTS_PATH)} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors cursor-pointer">
            <span>←</span>
            <span>{t('proj.archiveTitle')}</span>
          </a>
          <div className="flex items-center gap-4">
            <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors" />
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="text-ink-muted hover:text-ink-strong transition-colors" />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1120px] mx-auto pt-28 pb-20 border-x border-dashed border-line min-h-screen bg-bg animate-rise-in">
        <section className="px-6 sm:px-10 lg:px-14">
          <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            <span>FiveM investigation training</span>
            <span className="text-ink-faint">/</span>
            <span>2026</span>
          </div>

          <div className="mt-7 grid lg:grid-cols-[1fr_auto] lg:items-end gap-7">
            <div>
              <h1 className="text-[clamp(52px,9vw,104px)] leading-[0.88] font-bold tracking-[-0.065em] text-ink-strong">7x0.site</h1>
              <p className="mt-7 max-w-[650px] text-[clamp(17px,2.2vw,22px)] leading-[1.45] tracking-[-0.02em] text-ink-secondary">
                Learn the evidence. Understand the tools. Make a better call.
              </p>
            </div>
            <a href={project.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-ink-strong text-ink-inverse text-[13px] font-semibold hover:bg-ink-secondary transition-colors w-fit">
              Visit 7x0.site <span>↗</span>
            </a>
          </div>
        </section>

        <section className="mt-12 px-3 sm:px-6">
          <div className="relative rounded-2xl border border-line bg-surface-raised p-2 sm:p-3 shadow-2xl shadow-black/10">
            <div className="flex items-center gap-1.5 px-2 pb-2.5" aria-hidden="true">
              <span className="w-2 h-2 rounded-full bg-ink-faint" />
              <span className="w-2 h-2 rounded-full bg-ink-faint" />
              <span className="w-2 h-2 rounded-full bg-ink-faint" />
              <span className="ml-3 h-1.5 w-24 rounded-full bg-line" />
            </div>
            <img {...imageProps(project.image, '(min-width: 1120px) 1060px, 96vw')} alt={project.imageAlt} fetchPriority="high" decoding="async" width="2048" height="1015" className="w-full h-auto rounded-lg border border-line" />
          </div>
        </section>

        <section className="mt-20 px-6 sm:px-10 lg:px-14 grid md:grid-cols-[0.7fr_1.3fr] gap-10 md:gap-20">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">The platform</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {project.tags.slice(0, 3).map((tag) => <span key={tag} className="px-2.5 py-1 rounded-md bg-surface-raised text-[11.5px] text-ink-muted font-medium">{tag}</span>)}
            </div>
          </div>
          <p className="text-[17px] sm:text-[19px] leading-[1.7] text-ink-secondary tracking-[-0.015em]">{project.fullDescription}</p>
        </section>

        <section className="mt-20 border-y border-line">
          <div className="px-6 sm:px-10 lg:px-14 py-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">How it works</p>
          </div>
          <div className="grid md:grid-cols-3 border-t border-line">
            {FLOW.map(([number, title, copy], index) => (
              <article key={title} className={`p-6 sm:p-8 ${index ? 'border-t md:border-t-0 md:border-l' : ''} border-line`}>
                <span className="text-[11px] font-mono text-violet-500">{number}</span>
                <h2 className="mt-8 text-[22px] font-semibold tracking-tight text-ink-strong">{title}</h2>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 px-6 sm:px-10 lg:px-14">
          <div className="max-w-xl">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">From first visit to responsible use</p>
            <h2 className="mt-4 text-[30px] sm:text-[40px] leading-tight font-semibold tracking-[-0.035em] text-ink-strong">A clear entry point, backed by clear rules.</h2>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-8 items-start max-w-[680px] mx-auto">
            {project.gallery.map((item, index) => (
              <figure key={item.src} className={index === 1 ? 'mt-16' : ''}>
                <div className="rounded-[18px] border border-line bg-surface-raised p-2 shadow-xl shadow-black/10">
                  <img {...imageProps(item.src, '(min-width: 768px) 300px, 44vw')} alt={item.alt} loading="lazy" decoding="async" className="w-full h-auto rounded-xl" />
                </div>
                <figcaption className="mt-3 text-[11px] uppercase tracking-[0.12em] text-ink-subtle">{index === 0 ? 'Landing page' : 'Terms of service'}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mt-24 mx-6 sm:mx-10 lg:mx-14 rounded-2xl bg-ink-strong text-ink-inverse p-7 sm:p-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.16em] opacity-60">Built for better investigations</p>
            <h2 className="mt-4 max-w-xl text-[28px] sm:text-[38px] leading-tight font-semibold tracking-[-0.035em]">Train before the player check starts.</h2>
          </div>
          <a href={project.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[13px] font-semibold shrink-0">Open 7x0.site <span>↗</span></a>
        </section>

        <a {...link(PROJECTS_PATH)} className="mt-12 ml-6 sm:ml-10 lg:ml-14 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-muted hover:text-ink-strong transition-colors cursor-pointer">
          <span>←</span><span>{t('proj.archiveTitle')}</span>
        </a>
      </main>
    </div>
  )
}
