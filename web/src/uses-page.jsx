import { useEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, HOME_PATH, CV_PATH } from './lib/router'
import { GITHUB_URL } from './lib/profile'
import { imageProps } from './lib/images'
import { themedIconFor } from './lib/skills'
import { USES_UPDATED, USES_INTRO, DESK, SOFTWARE, TERMINAL, PIPELINE, DATA_STORE, FONTS, MUSIC } from './lib/uses'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'

const CARD = 'rounded-2xl border border-line bg-surface-raised shadow-[0_18px_40px_-32px_var(--shadow-cast)]'

const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

const EASE = 'ease-[cubic-bezier(0.25,1,0.5,1)]'

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

const delay = (ms) => ({ '--reveal-delay': `${ms}ms` })

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

function SectionHead({ id, index, title, hint }) {
  return (
    <div data-reveal className="mb-4 flex items-baseline justify-between gap-4 border-b border-dashed border-line pb-2">
      <h2 id={id} className={`${KICKER} flex items-baseline gap-2`}>
        <span className="tabular-nums text-ink-faint">{String(index).padStart(2, '0')}</span>
        <span>{title}</span>
      </h2>
      {hint && (
        <span className="hidden items-center gap-1.5 text-[11px] text-ink-faint sm:inline-flex">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-ink-faint animate-pulse motion-reduce:animate-none" />
          {hint}
        </span>
      )}
    </div>
  )
}
function Hotspot({ id, label, box, active, onActivate, children }) {
  const on = active === id
  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={label}
      aria-pressed={on}
      data-on={on || undefined}
      onPointerEnter={() => onActivate(id)}
      onFocus={() => onActivate(id)}
      onClick={() => onActivate(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate(id)
        }
      }}
      className="group/spot cursor-pointer outline-none [&_*]:transition-[stroke,fill,opacity,transform] [&_*]:duration-300"
    >
      {children}
      <rect
        x={box[0] - 6}
        y={box[1] - 6}
        width={box[2] + 12}
        height={box[3] + 12}
        rx="9"
        fill="none"
        strokeDasharray="4 4"
        className={`stroke-ink-secondary animate-flow motion-reduce:animate-none ${on ? 'opacity-100' : 'opacity-0'}`}
      />
    </g>
  )
}

const FRAME = 'fill-surface stroke-ink-faint group-hover/spot:stroke-ink-secondary group-data-[on]/spot:stroke-ink-strong'
const PANEL = 'fill-bg stroke-line-strong'
const DETAIL = 'fill-ink-faint group-data-[on]/spot:fill-ink-muted'
const SOLID = 'fill-line-strong group-hover/spot:fill-ink-faint group-data-[on]/spot:fill-ink-subtle'

const KEY_ROWS = [15, 15, 14]
const KEY_W = 10.6
const KEY_GAP = 2
const KEY_X = 236
function Keys({ lit }) {
  const keys = []
  const key = (id, x, y, w, col) =>
    keys.push(
      <rect
        key={id}
        x={x}
        y={y}
        width={w}
        height={6.5}
        rx={1.2}
        className={`${DETAIL} ${lit ? 'animate-keywave motion-reduce:animate-none' : ''}`}
        style={lit ? { animationDelay: `${col * 70}ms` } : undefined}
      />,
    )
  KEY_ROWS.forEach((count, row) => {
    for (let i = 0; i < count; i++) key(`${row}-${i}`, KEY_X + i * (KEY_W + KEY_GAP), 219 + row * 8.5, KEY_W, i)
  })
  const y = 219 + 3 * 8.5
  const bottom = [
    [KEY_X, KEY_W * 1.4, 0],
    [KEY_X + (KEY_W * 1.4 + KEY_GAP), KEY_W, 1],
    [KEY_X + (KEY_W * 2.4 + KEY_GAP * 2), KEY_W, 2],
    [KEY_X + (KEY_W * 3.4 + KEY_GAP * 3), KEY_W * 5.6, 5],
    [KEY_X + (KEY_W * 9 + KEY_GAP * 4), KEY_W, 9],
    [KEY_X + (KEY_W * 10 + KEY_GAP * 5), KEY_W, 10],
    [KEY_X + (KEY_W * 11 + KEY_GAP * 6), KEY_W, 11],
    [KEY_X + (KEY_W * 12 + KEY_GAP * 7), KEY_W, 12],
    [KEY_X + (KEY_W * 13 + KEY_GAP * 8), KEY_W, 13],
  ]
  bottom.forEach(([x, w, col], i) => key(`b-${i}`, x, y, w, col))
  return keys
}
const CODE_LINES = [
  [0, 64], [14, 118], [14, 82], [28, 136], [28, 54], [14, 104], [0, 34], [0, 128], [14, 70],
]
const LAPTOP_LINES = [[0, 44], [0, 60], [0, 30]]

function ScreenLines({ lines, x, y, step, active }) {
  return lines.map(([indent, w], i) => (
    <rect
      key={i}
      x={x + indent}
      y={y + i * step}
      width={w}
      height="4"
      rx="2"
      style={{ transformOrigin: `${x + indent}px ${y + i * step}px`, animationDelay: `${i * 260}ms` }}
      className={`${DETAIL} ${active ? 'animate-typeline motion-reduce:animate-none' : ''}`}
    />
  ))
}

function Desk({ active, onActivate }) {
  return (
    <svg
      viewBox="0 0 640 300"
      className="h-auto w-full select-none"
      strokeWidth="1.25"
      strokeLinejoin="round"
      role="group"
    >
      <rect x="16" y="248" width="608" height="6" rx="3" className="fill-line-strong" />
      <rect x="48" y="254" width="6" height="40" rx="2" className="fill-line" />
      <rect x="586" y="254" width="6" height="40" rx="2" className="fill-line" />
      <Hotspot id="monitor" label="Display" box={[200, 30, 240, 172]} active={active} onActivate={onActivate}>
        <rect x="280" y="196" width="80" height="6" rx="3" className={SOLID} />
        <rect x="315" y="168" width="10" height="28" className={SOLID} />
        <rect x="200" y="30" width="240" height="138" rx="7" className={FRAME} />
        <rect x="207" y="37" width="226" height="118" rx="3.5" className={PANEL} />
        <ScreenLines lines={CODE_LINES} x={220} y={50} step={11.5} active />
        <rect x="220" y="147" width="4" height="5" rx="1" className="fill-ink-subtle animate-caret motion-reduce:animate-none" />
        <circle cx="320" cy="161.5" r="1.4" className="fill-ink-subtle" />
      </Hotspot>
      <Hotspot id="laptop" label="MacBook Air" box={[24, 176, 112, 72]} active={active} onActivate={onActivate}>
        <rect x="36" y="176" width="88" height="64" rx="4" className={FRAME} />
        <rect x="41" y="181" width="78" height="52" rx="2" className={PANEL} />
        <ScreenLines lines={LAPTOP_LINES} x={50} y={192} step={8} active={active === 'laptop'} />
        <rect x="24" y="240" width="112" height="8" rx="3" className={FRAME} />
        <rect x="68" y="242.5" width="24" height="3" rx="1.5" className={DETAIL} />
      </Hotspot>
      <Hotspot id="keyboard" label="Keyboard" box={[230, 214, 200, 34]} active={active} onActivate={onActivate}>
        <rect x="230" y="214" width="200" height="34" rx="4" className={FRAME} />
        <Keys lit={active === 'keyboard'} />
      </Hotspot>
      <Hotspot id="mouse" label="Mouse" box={[448, 212, 28, 36]} active={active} onActivate={onActivate}>
        <rect x="448" y="212" width="28" height="36" rx="12" className={FRAME} />
        <path d="M462 214v10" className="stroke-ink-faint" />
        <rect x="460.5" y="221" width="3" height="5" rx="1.5" className={`${DETAIL} ${active === 'mouse' ? 'animate-keywave motion-reduce:animate-none' : ''}`} />
      </Hotspot>
      <Hotspot id="audio" label="AirPods" box={[500, 224, 34, 24]} active={active} onActivate={onActivate}>
        <rect x="500" y="224" width="34" height="24" rx="6" className={FRAME} />
        <path d="M500 234h34" className="stroke-ink-faint" />
        <circle cx="517" cy="241" r="1.3" className={`fill-ink-subtle ${active === 'audio' ? 'animate-keywave motion-reduce:animate-none' : ''}`} />
      </Hotspot>
    </svg>
  )
}

function DeskCard({ item }) {
  return (
    <div key={item.id}>
      <p className={`${KICKER} animate-rise-in`}>{item.kind}</p>
      <h3 className="mt-1.5 animate-rise-in text-[17px] font-semibold tracking-tight text-ink-strong" style={{ animationDelay: '40ms' }}>
        {item.name}
      </h3>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {item.specs.map((spec, i) => (
          <li
            key={spec}
            className="animate-rise-in rounded-md bg-surface-hover px-2 py-1 font-mono text-[10.5px] tabular-nums leading-none text-ink-secondary ring-1 ring-inset ring-line"
            style={{ animationDelay: `${90 + i * 50}ms` }}
          >
            {spec}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DeskSection() {
  const [active, setActive] = useState('laptop')
  const current = DESK.find((item) => item.id === active) || DESK[0]

  return (
    <section aria-labelledby="uses-desk" className="w-full">
      <SectionHead id="uses-desk" index={1} title="The desk" hint="Hover for details" />
      <div className={`${CARD} grid grid-cols-1 overflow-hidden md:grid-cols-[1fr_260px]`}>
        <div className="relative px-4 pt-5 pb-2 sm:px-6">
          <div className="animate-float motion-reduce:animate-none">
            <Desk active={active} onActivate={setActive} />
          </div>
          <ol className="mt-1 flex flex-wrap gap-x-1 gap-y-1 pb-2">
            {DESK.map((item, index) => {
              const on = item.id === active
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onPointerEnter={() => setActive(item.id)}
                    onClick={() => setActive(item.id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10.5px] uppercase tracking-wider transition-[color,background-color,transform] duration-200 ${EASE} ${RING} ${
                      on ? 'bg-surface-hover text-ink-strong -translate-y-px' : 'text-ink-subtle hover:text-ink-secondary'
                    }`}
                  >
                    <span className="tabular-nums text-ink-faint">{String(index + 1).padStart(2, '0')}</span>
                    <span>{item.kind}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="border-t border-line bg-surface p-5 md:border-t-0 md:border-l md:p-6">
          <DeskCard item={current} />
        </div>
      </div>
    </section>
  )
}
function Tile({ item, icon }) {
  const external = Boolean(item.href)
  const Tag = external ? 'a' : 'div'
  const props = external ? { href: item.href, target: '_blank', rel: 'noreferrer' } : { tabIndex: 0 }
  return (
    <Tag
      {...props}
      className={`group/tile relative block h-[104px] overflow-hidden rounded-xl border border-line bg-surface-raised p-3 text-left no-underline transition-[border-color,background-color,transform,box-shadow] duration-300 ${EASE} ${RING} hover:-translate-y-1 hover:border-line-strong hover:bg-surface-hover hover:shadow-[0_14px_30px_-18px_var(--shadow-cast)] focus-visible:border-line-strong focus-visible:bg-surface-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      <span
        className={`absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface transition-transform duration-300 ${EASE} group-hover/tile:-translate-y-0.5 group-hover/tile:rotate-[-6deg] group-hover/tile:scale-105`}
      >
        <img
          {...imageProps(icon)}
          alt=""
          width="20"
          height="20"
          loading="lazy"
          decoding="async"
          className="h-5 w-5 object-contain"
        />
      </span>
      <span className="absolute left-3 right-3 top-[72px] flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-ink-strong">
        <span className="truncate">{item.name}</span>
        {external && (
          <span aria-hidden="true" className={`text-[11px] font-normal text-ink-faint transition-transform duration-300 ${EASE} group-hover/tile:translate-x-0.5 group-hover/tile:-translate-y-0.5`}>
            ↗
          </span>
        )}
      </span>
    </Tag>
  )
}

function SoftwareSection({ theme }) {
  const themedIcon = themedIconFor(theme)
  return (
    <section aria-labelledby="uses-software" className="w-full">
      <SectionHead id="uses-software" index={2} title="Software" />
      <div className="flex flex-col gap-7">
        {SOFTWARE.map((group) => (
          <div key={group.id}>
            <h3 data-reveal className="mb-2.5 text-[12px] font-medium text-ink-subtle">{group.title}</h3>
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {group.items.map((item, i) => (
                <li key={item.name} data-reveal style={delay(60 + i * 55)}>
                  <Tile item={item} icon={themedIcon(item.icon)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
function TerminalSection() {
  return (
    <section aria-labelledby="uses-terminal" className="flex min-w-0 flex-col">
      <SectionHead id="uses-terminal" index={3} title="Terminal" />
      <div data-reveal className={`${CARD} flex flex-1 flex-col overflow-hidden`}>
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3.5 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="ml-1 truncate text-[11px] font-medium text-ink-muted">{TERMINAL.app} — zsh</span>
          <span className="ml-auto font-mono text-[10px] text-ink-faint">{TERMINAL.font}</span>
        </div>
        <ol className="flex-1 px-4 py-3 font-mono text-[11.5px] leading-[1.7]">
          {TERMINAL.lines.map((line, i) => (
            <li
              key={line.cmd}
              data-reveal
              style={delay(120 + i * 110)}
              className="group/line -mx-2 rounded-md px-2 transition-colors duration-150 hover:bg-surface-hover/70"
            >
              <span className="text-ink-faint">~ %</span>{' '}
              <span className="text-ink-strong">{line.cmd}</span>
              <span className="block text-ink-muted transition-colors duration-150 group-hover/line:text-ink-secondary">{line.out}</span>
            </li>
          ))}
          <li aria-hidden="true" data-reveal style={delay(120 + TERMINAL.lines.length * 110)}>
            <span className="text-ink-faint">~ %</span>{' '}
            <span className="inline-block h-[13px] w-[7px] translate-y-[2px] bg-ink-secondary animate-caret motion-reduce:animate-none" />
          </li>
        </ol>
      </div>
    </section>
  )
}
function PipelineStep({ node, on, onActivate, branch, icon, index }) {
  return (
    <li className={`relative ${branch ? 'ml-6' : ''}`} data-reveal style={delay(100 + index * 70)}>
      {branch ? (
        <span aria-hidden="true" className="absolute -left-6 top-0 h-[18px] w-4 rounded-bl-md border-b border-l border-dashed border-line-strong" />
      ) : (
        <span
          aria-hidden="true"
          className={`absolute -left-[23px] top-[13px] h-2 w-2 rounded-full ring-2 ring-surface-raised transition-[background-color,transform] duration-300 ${
            on ? 'bg-ink-strong scale-125' : 'bg-ink-faint'
          }`}
        />
      )}
      <button
        type="button"
        onPointerEnter={() => onActivate(node.id)}
        onFocus={() => onActivate(node.id)}
        onClick={() => onActivate(node.id)}
        aria-pressed={on}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-[border-color,background-color,transform] duration-200 ${EASE} ${RING} ${
          on ? 'border-line-strong bg-surface-hover translate-x-0.5' : 'border-transparent hover:border-line hover:bg-surface-hover/60'
        }`}
      >
        {icon && (
          <img {...imageProps(icon)} alt="" width="14" height="14" loading="lazy" decoding="async" className="h-3.5 w-3.5 shrink-0 object-contain" />
        )}
        <span className="truncate text-[12.5px] font-semibold tracking-tight text-ink-strong">{node.name}</span>
        <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">{node.sub}</span>
      </button>
    </li>
  )
}

function HostingSection() {
  const [active, setActive] = useState('push')
  const data = { id: 'data', name: DATA_STORE.name, sub: '/api/' }

  return (
    <section aria-labelledby="uses-hosting" className="flex min-w-0 flex-col">
      <SectionHead id="uses-hosting" index={4} title="Hosting" />
      <div data-reveal className={`${CARD} flex flex-1 flex-col p-4 sm:p-5`}>
        <div className="relative ml-2 pl-5">
          <span aria-hidden="true" className="absolute left-[3.5px] top-3 bottom-3 w-px">
            <svg className="absolute inset-0 h-full w-px text-line-strong" preserveAspectRatio="none">
              <line x1="0.5" y1="0" x2="0.5" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="animate-flow motion-reduce:animate-none" />
            </svg>
            <span className="absolute -left-[2.5px] h-1.5 w-1.5 rounded-full bg-ink-strong shadow-[0_0_8px_2px_var(--color-ink-strong)] animate-packet motion-reduce:hidden" />
          </span>
          <ol className="flex flex-col gap-1">
            {PIPELINE.map((node, i) => (
              <PipelineStep key={node.id} index={i} node={node} on={active === node.id} onActivate={setActive} />
            ))}
            <PipelineStep index={PIPELINE.length} node={data} on={active === 'data'} onActivate={setActive} icon={DATA_STORE.icon} branch />
          </ol>
        </div>
      </div>
    </section>
  )
}
function FontsSection() {
  return (
    <section aria-labelledby="uses-fonts" className="flex min-w-0 flex-col">
      <SectionHead id="uses-fonts" index={5} title="Fonts" />
      <ul className="grid flex-1 grid-cols-2 gap-2.5">
        {FONTS.map((font, i) => (
          <li
            key={font.name}
            tabIndex={0}
            data-reveal
            style={delay(80 + i * 70)}
            className={`group/font relative h-[124px] overflow-hidden rounded-xl border border-line bg-surface-raised p-3 transition-[border-color,background-color,transform] duration-300 ${EASE} ${RING} hover:-translate-y-1 hover:border-line-strong hover:bg-surface-hover focus-visible:border-line-strong motion-reduce:hover:translate-y-0`}
          >
            <span
              className={`${font.className} absolute left-3 top-1 block text-[44px] leading-none text-ink-strong transition-[transform,letter-spacing] duration-300 ${EASE} group-hover/font:-translate-y-1 group-hover/font:tracking-wider`}
              aria-hidden="true"
            >
              {font.sample}
            </span>
            <span className="absolute inset-x-3 bottom-3 block">
              <span className="block truncate text-[12.5px] font-semibold tracking-tight text-ink-strong">{font.name}</span>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-subtle">{font.role}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
const EQ_DELAYS = [0, 180, 90, 260, 40]

function MusicSection() {
  return (
    <section aria-labelledby="uses-music" className="flex min-w-0 flex-col">
      <SectionHead id="uses-music" index={6} title="Music" />
      <div data-reveal className={`${CARD} group/music flex flex-1 flex-col justify-between p-4 sm:p-5`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface transition-transform duration-500 ${EASE} group-hover/music:rotate-[360deg]`}>
            <img {...imageProps(MUSIC.icon)} alt="" width="22" height="22" loading="lazy" decoding="async" className="h-[22px] w-[22px] object-contain" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold tracking-tight text-ink-strong">{MUSIC.app}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">Usually playing</p>
          </div>
          <span aria-hidden="true" className="ml-auto flex h-6 items-end gap-[3px]">
            {EQ_DELAYS.map((d, i) => (
              <span
                key={i}
                className="block h-6 w-[3px] origin-bottom rounded-full bg-ink-subtle animate-eq motion-reduce:animate-none motion-reduce:scale-y-50"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </span>
        </div>
        <div aria-hidden="true" className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-surface-hover">
          <span className="block h-full w-full origin-left rounded-full bg-ink-subtle animate-progress motion-reduce:animate-none motion-reduce:scale-x-[0.4]" />
        </div>
      </div>
    </section>
  )
}
export default function UsesPage({ theme, onToggleTheme }) {
  const updated = formatUpdated(USES_UPDATED)
  const mainRef = useRef(null)
  useReveal(mainRef)

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

      <main ref={mainRef} className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-20 flex flex-col items-start gap-12 min-h-screen bg-bg">
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

        <div className="w-full animate-rise-in" style={{ animationDelay: '240ms' }}>
          <DeskSection />
        </div>
        <SoftwareSection theme={theme} />

        <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-2 md:gap-8">
          <TerminalSection />
          <HostingSection />
        </div>

        <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-[1fr_300px] md:gap-8">
          <FontsSection />
          <MusicSection />
        </div>
        <footer data-reveal className="w-full max-w-[640px] border-t border-dashed border-line pt-7">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            What is this? A uses page — the gear and software behind the work. There are hundreds more on{' '}
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
