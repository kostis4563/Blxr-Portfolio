import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, HOME_PATH } from './lib/router'
import { LINKS_INTRO, LINKS, SITE_LINKS } from './lib/links'

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50'

function Row({ item }) {
  const external = !item.href.startsWith('mailto:')
  return (
    <li>
      <a
        href={item.href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={`group flex items-baseline justify-between gap-6 border-b border-dashed border-line py-3.5 ${FOCUS}`}
      >
        <span className="text-[15px] text-ink-strong">{item.label}</span>
        <span className="font-mono text-[12.5px] text-ink-subtle transition-colors duration-200 group-hover:text-ink-strong">
          {item.detail}
        </span>
      </a>
    </li>
  )
}

export default function LinksPage({ theme, onToggleTheme }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-x border-dashed border-line top-0 flex items-center px-6 sm:px-10">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
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

      <main className="w-full max-w-[960px] mx-auto flex flex-col items-center min-h-screen pt-14 border-x border-dashed border-line bg-bg px-6">
        <div className="w-full max-w-[400px] pt-20 pb-16 sm:pt-28">
          <h1 className="font-bagus text-[28px] leading-none text-ink-strong">blxr</h1>
          <p className="mt-3 text-[14px] text-ink-subtle">{LINKS_INTRO}</p>

          <ul className="mt-10 border-t border-dashed border-line">
            {LINKS.map((item) => (
              <Row key={item.label} item={item} />
            ))}
          </ul>

          <nav aria-label="Pages" className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink-subtle">
            {SITE_LINKS.map((item) => (
              <a key={item.to} {...link(item.to)} className={`rounded-sm transition-colors duration-200 hover:text-ink-strong ${FOCUS}`}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </main>
    </div>
  )
}
