import { useEffect, useRef } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, HOME_PATH, CV_PATH } from './lib/router'
import { GITHUB_URL } from './lib/profile'
import { imageProps } from './lib/images'
import { themedIconFor } from './lib/skills'
import { USES_UPDATED, USES_INTRO, DESK, SOFTWARE, TERMINAL, PIPELINE, DATA_STORE, FONTS, MUSIC } from './lib/uses'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'

const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

function useReveal(ref) {
  useEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const items = Array.from(root.querySelectorAll('[data-reveal]'))
    const pending = items.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9)
    if (!pending.length) return

    for (const el of pending) el.classList.add('reveal-pending')

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('reveal-in')
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.1 })

    for (const el of pending) observer.observe(el)

    return () => {
      observer.disconnect()
      for (const el of items) el.classList.remove('reveal-pending', 'reveal-in')
    }
  }, [ref])
}

function formatUpdated(iso) {
  const date = new Date(`${iso}T00:00:00Z`)
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  } catch {
    return iso
  }
}

const SPAN = {
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  6: 'sm:col-span-2 md:col-span-6',
}

function Cell({ title, span = 2, className = '', children }) {
  return (
    <section
      data-reveal
      aria-label={title}
      className={`${SPAN[span]} flex min-w-0 flex-col rounded-2xl border border-line bg-surface-raised p-5 transition-colors duration-300 hover:border-line-strong ${className}`}
    >
      <h2 className={`${KICKER} mb-4`}>{title}</h2>
      {children}
    </section>
  )
}

function Specs({ specs }) {
  return (
    <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-subtle">
      {specs.join(' · ')}
    </p>
  )
}

function Icon({ src, size = 20 }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
      <img {...imageProps(src)} alt="" width={size} height={size} loading="lazy" decoding="async" className="object-contain" style={{ width: size, height: size }} />
    </span>
  )
}

function AppRow({ item, icon }) {
  const body = (
    <>
      <Icon src={icon} />
      <span className="truncate text-[13.5px] font-semibold tracking-tight text-ink-strong">{item.name}</span>
      {item.href && (
        <span aria-hidden="true" className="-ml-1.5 text-[11px] text-ink-faint transition-transform duration-200 group-hover/app:translate-x-0.5 group-hover/app:-translate-y-0.5">
          ↗
        </span>
      )}
    </>
  )
  const cls = 'group/app -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5'
  return (
    <li>
      {item.href ? (
        <a href={item.href} target="_blank" rel="noreferrer" className={`${cls} ${RING} transition-colors duration-200 hover:bg-surface-hover`}>
          {body}
        </a>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}

function SoftwareCell({ group, span, themedIcon, columns = 'grid-cols-1' }) {
  return (
    <Cell title={group.title} span={span}>
      <ul className={`grid gap-1 ${columns}`}>
        {group.items.map((item) => (
          <AppRow key={item.name} item={item} icon={themedIcon(item.icon)} />
        ))}
      </ul>
    </Cell>
  )
}

function Hardware() {
  const [machine, display, ...peripherals] = DESK
  return (
    <>
      <Cell title={machine.kind} span={4} className="justify-between">
        <div>
          <h3 className="text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink-strong sm:text-[30px]">{machine.name}</h3>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {machine.specs.map((spec) => (
              <li key={spec} className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] leading-none text-ink-secondary">
                {spec}
              </li>
            ))}
          </ul>
        </div>
      </Cell>
      <Cell title={display.kind} span={2}>
        <h3 className="text-[15px] font-semibold tracking-tight text-ink-strong">{display.name}</h3>
        <Specs specs={display.specs} />
      </Cell>
      {peripherals.map((item) => (
        <Cell key={item.id} title={item.kind} span={2}>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-strong">{item.name}</h3>
          <Specs specs={item.specs} />
          {item.id === 'audio' && <NowPlaying />}
        </Cell>
      ))}
    </>
  )
}

function TerminalCell() {
  return (
    <Cell title={`Terminal · ${TERMINAL.app}`} span={3}>
      <dl className="flex flex-col gap-1.5 font-mono text-[11.5px] leading-snug">
        {TERMINAL.lines.map((line) => (
          <div key={line.cmd} className="flex items-baseline justify-between gap-4">
            <dt className="truncate text-ink-muted">
              <span className="text-ink-faint">$ </span>
              {line.cmd}
            </dt>
            <dd className="shrink-0 tabular-nums text-ink-strong">{line.out}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-auto pt-4 font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">{TERMINAL.font}</p>
    </Cell>
  )
}

function HostingCell() {
  return (
    <Cell title="Hosting" span={3}>
      <ol className="flex flex-col">
        {PIPELINE.map((node, i) => (
          <li key={node.id} className="relative flex items-baseline gap-3 pb-3 pl-5 last:pb-0">
            <span aria-hidden="true" className="absolute left-[3px] top-[7px] h-[7px] w-[7px] rounded-full bg-ink-subtle" />
            {i < PIPELINE.length - 1 && <span aria-hidden="true" className="absolute left-[6px] top-[16px] bottom-0 w-px bg-line-strong" />}
            <span className="text-[13px] font-semibold tracking-tight text-ink-strong">{node.name}</span>
            <span className="ml-auto truncate font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">{node.sub}</span>
          </li>
        ))}
      </ol>
      <a
        href={DATA_STORE.href}
        target="_blank"
        rel="noreferrer"
        className={`group/app mt-4 flex items-center gap-2.5 rounded-lg border border-dashed border-line-strong px-3 py-2 transition-colors duration-200 hover:bg-surface-hover ${RING}`}
      >
        <img {...imageProps(DATA_STORE.icon)} alt="" width="14" height="14" loading="lazy" decoding="async" className="h-3.5 w-3.5 object-contain" />
        <span className="text-[12.5px] font-semibold tracking-tight text-ink-strong">{DATA_STORE.name}</span>
        <span className="ml-auto font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">/api/ data</span>
      </a>
    </Cell>
  )
}

function NowPlaying() {
  return (
    <div className="mt-auto flex items-center gap-2.5 pt-4">
      <img {...imageProps(MUSIC.icon)} alt="" width="14" height="14" loading="lazy" decoding="async" className="h-3.5 w-3.5 object-contain" />
      <span className="text-[12.5px] font-semibold tracking-tight text-ink-strong">{MUSIC.app}</span>
      <span className="ml-auto font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">Usually playing</span>
    </div>
  )
}

function FontsCell() {
  return (
    <Cell title="Fonts" span={6}>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        {FONTS.map((font) => (
          <li key={font.name} className="min-w-0">
            <span aria-hidden="true" className={`${font.className} block truncate text-[36px] leading-none text-ink-strong`}>
              {font.sample}
            </span>
            <span className="mt-3 block truncate text-[13px] font-semibold tracking-tight text-ink-strong">{font.name}</span>
            <span className="block font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">{font.role}</span>
          </li>
        ))}
      </ul>
    </Cell>
  )
}

export default function UsesPage({ theme, onToggleTheme }) {
  const updated = formatUpdated(USES_UPDATED)
  const mainRef = useRef(null)
  useReveal(mainRef)
  const themedIcon = themedIconFor(theme)
  const [editor, design, everyday] = SOFTWARE

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
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

      <main ref={mainRef} className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-20 flex flex-col items-start gap-10 min-h-screen bg-bg">
        <div className="w-full flex flex-col gap-3 text-left sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[560px]">
            <p className={`${KICKER} mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 animate-rise-in`}>
              <span>/ uses</span>
              <span aria-hidden="true">·</span>
              <span>macOS</span>
            </p>
            <h1 className="text-[32px] sm:text-[36px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-2 animate-rise-in" style={{ animationDelay: '60ms' }}>
              Uses
            </h1>
            <p className="text-[14.5px] sm:text-[15px] text-ink-muted font-normal leading-relaxed animate-rise-in" style={{ animationDelay: '120ms' }}>
              {USES_INTRO}
            </p>
          </div>
          <dl className="flex shrink-0 items-center gap-2 text-[12px] text-ink-subtle animate-rise-in" style={{ animationDelay: '180ms' }}>
            <dt className="font-mono uppercase tracking-wider text-[10.5px]">Updated</dt>
            <dd>
              <time dateTime={USES_UPDATED}>{updated}</time>
            </dd>
          </dl>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6 animate-rise-in" style={{ animationDelay: '240ms' }}>
          <Hardware />
          <SoftwareCell group={editor} span={3} themedIcon={themedIcon} columns="grid-cols-2" />
          <SoftwareCell group={design} span={3} themedIcon={themedIcon} columns="grid-cols-2" />
          <SoftwareCell group={everyday} span={6} themedIcon={themedIcon} columns="grid-cols-2 md:grid-cols-4" />
          <TerminalCell />
          <HostingCell />
          <FontsCell />
        </div>

        <footer data-reveal className="w-full max-w-[640px] border-t border-dashed border-line pt-7">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            What is this? A uses page the gear and software behind the work. There are hundreds more on{' '}
            <a
              href="https://uses.tech"
              target="_blank"
              rel="noreferrer"
              className="text-ink-secondary underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:text-ink-strong hover:decoration-ink-strong"
            >
              uses.tech
            </a>
            .
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(CV_PATH)} className={FOOT_LINK}>
              <span>CV</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={FOOT_LINK}>
              <span>GitHub</span>
              <span aria-hidden="true" className={FOOT_ARROW}>↗</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
