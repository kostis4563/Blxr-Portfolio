import { useEffect, useId, useRef, useState } from 'react'
import {
  parseLink,
  loadReport,
  reportApiBase,
  summarize,
  errorState,
  safeHref,
  formatWhen,
  SEVERITIES,
  SEVERITY_LABEL,
  LOADING_STATE,
  INCOMPLETE_STATE,
  DEFAULT_TITLE,
} from './lib/report'

const THEME_KEY = 'blxr-theme'
const WORDMARK = '/wordmark-nav.png?v=95fab63c'
const PAD = 'px-6'
const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40'
const INSET_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/40'
const LABEL = 'font-watom text-[12px] text-ink-subtle'
const CODE = 'max-h-[28rem] overflow-auto whitespace-pre px-4 py-3.5 font-mono text-[12px] leading-[1.7] text-ink-secondary [tab-size:4]'
const CORNERS = ['tl', 'tr', 'br', 'bl']
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const SEVERITY_PHRASE = { critical: 'critical', high: 'high severity', medium: 'medium severity', low: 'low severity', info: 'informational' }

const tone = (severity) => ({ '--sev': severity ? `var(--sev-${severity})` : 'var(--color-ink-strong)' })
const spell = (n) => NUMBER_WORDS[n] ?? String(n)
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1)
const pad = (n) => String(n).padStart(2, '0')

export function overview(total, counts, worst) {
  if (!total) return 'No findings this time.'
  const lead = `${capitalize(spell(total))} ${total === 1 ? 'finding' : 'findings'}`
  const phrase = SEVERITY_PHRASE[worst]
  if (total === 1) return `${lead}, rated ${phrase}.`
  const top = counts[worst]
  const share = top === total ? `all ${phrase}` : `${spell(top)} of them ${phrase}`
  return `${lead}, ${share}. They’re sorted worst first, so start at the top.`
}

function useReport() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let current = 0
    const load = () => {
      const run = ++current
      const link = parseLink(window.location.hash)
      if (!link) {
        setState({ status: 'incomplete' })
        return
      }
      setState({ status: 'loading' })
      loadReport(link, reportApiBase(window.location.search))
        .then(({ report, expiresAt }) => ({ status: 'ready', id: link.id, summary: summarize(report), expiresAt }))
        .catch((error) => ({ status: 'error', ...errorState(error) }))
        .then((next) => {
          if (run === current) setState(next)
        })
    }
    load()
    window.addEventListener('hashchange', load)
    return () => {
      current += 1
      window.removeEventListener('hashchange', load)
    }
  }, [])

  return state
}

function useThemeToggle() {
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    root.dataset.theme = next
    root.style.colorScheme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
    }
    setTheme(next)
  }
  return [theme, toggle]
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path fill="currentColor" d="M12 6c3.31 0 6 2.69 6 6c0 3.31 -2.69 6 -6 6c-3.31 0 -6 -2.69 -6 -6c0 -3.31 2.69 -6 6 -6Z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        d="M12 21v1M21 12h1M12 3v-1M3 12h-1M18.5 18.5l0.5 0.5M18.5 5.5l0.5 -0.5M5.5 5.5l-0.5 -0.5M5.5 18.5l-0.5 0.5"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1.75" />
      <path strokeLinecap="round" d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  )
}

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 text-ink-faint">
      <path d="M5.5 10.5 10.5 5.5M6 5.5h4.5V10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path d="M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path className="toggle-plus" d="M8 3.5v9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function FrameLabel({ children }) {
  return (
    <span aria-hidden="true" className="frame-label left-6 top-4">
      <svg viewBox="0 0 12 12">
        <path d="M4 1v10M8 1v10M1 4h10M1 8h10" />
      </svg>
      {children}
    </span>
  )
}

function StripeBand({ busy = false }) {
  return (
    <div aria-hidden="true" data-busy={busy ? '' : undefined} className="stripe-band frame-bleed relative h-8 shrink-0 border-b border-dashed border-line">
      {['tl', 'tr', 'bl', 'br'].map((pos) => (
        <span key={pos} data-pos={pos} className="frame-cross" />
      ))}
    </div>
  )
}

function TopBar() {
  const [theme, toggle] = useThemeToggle()
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <header className="frame-bleed-b sticky top-0 z-40 h-[60px] shrink-0 border-b border-dashed border-line bg-bg md:bg-bg/90 md:backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
        <a
          href="/"
          aria-label="blxr.net home"
          className="group flex shrink-0 items-end gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/70 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
        >
          <img
            src={WORDMARK}
            alt=""
            width="111"
            height="50"
            draggable={false}
            className="h-[42px] w-auto select-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:scale-[1.04] sm:h-[50px]"
          />
          <span className="mb-[12px] text-[10px] font-bold leading-none tracking-tight text-ink-muted transition-colors duration-200 group-hover:text-ink-strong">report</span>
        </a>
        <nav aria-label="Site" className="-mr-2 flex h-full items-center text-ink-muted sm:-mr-4">
          <a
            href="/"
            className={`hidden h-8 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong sm:inline-flex ${RING}`}
          >
            blxr.net
            <ArrowUpRight />
          </a>
          <span aria-hidden="true" className="mx-1 h-full border-l border-dashed border-line" />
          <button
            type="button"
            onClick={toggle}
            aria-label={label}
            title={label}
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong ${RING}`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </nav>
      </div>
    </header>
  )
}

function State({ title, message, busy = false }) {
  return (
    <>
      <section className={`relative border-b border-dashed border-line pt-12 pb-14 ${PAD}`}>
        <FrameLabel>Report</FrameLabel>
        <h1 className="mt-2 font-bagus text-[30px] font-normal leading-[1.05] tracking-[-0.01em] text-ink-strong sm:text-[36px]">
          {title}
          {busy && (
            <span aria-hidden="true" className="dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          )}
        </h1>
        <p className="mt-3 max-w-[54ch] text-[15px] leading-[1.6] text-ink-muted [overflow-wrap:anywhere]">{message}</p>
      </section>
      <StripeBand busy={busy} />
      <ReportFooter />
    </>
  )
}

function Swatch({ active = true }) {
  return <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-[2px] ${active ? 'bg-(--sev)' : 'border border-line-strong'}`} />
}

function Grade({ grade, severity, worst }) {
  return (
    <div className="flex items-center gap-3.5">
      <div
        role="img"
        aria-label={grade ? `Grade ${grade}` : 'No grade'}
        title="Overall grade"
        style={severity ? tone(severity) : undefined}
        className={`grid h-16 w-16 shrink-0 select-none place-items-center rounded-[18px] font-bagus text-[30px] leading-none ${
          severity ? 'bg-(--sev) text-(--sev-ink) shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)]' : 'border border-line-strong bg-surface text-ink-faint'
        }`}
      >
        {grade || '—'}
      </div>
      <div className="flex flex-col gap-1">
        <span className={LABEL}>Overall grade</span>
        {worst ? (
          <span style={tone(worst)} className="flex items-center gap-2 text-[13px] text-ink-secondary">
            <Swatch />
            Worst finding is {SEVERITY_PHRASE[worst]}
          </span>
        ) : (
          <span className="text-[13px] text-ink-secondary">Nothing flagged</span>
        )}
      </div>
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-x-4">
      <dt className={LABEL}>{label}</dt>
      <dd className="min-w-0 text-ink-secondary [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

function Hero({ summary, total, expires }) {
  const scanned = formatWhen(summary.finishedAt)
  return (
    <section aria-labelledby="report-title" className={`relative border-b border-dashed border-line pt-12 pb-12 ${PAD}`}>
      <FrameLabel>Report</FrameLabel>
      <div className="rise mt-2 mb-7 flex flex-wrap items-start justify-between gap-4">
        <Grade grade={summary.grade} severity={summary.gradeSeverity} worst={summary.worst} />
        <span className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-line bg-surface pl-2.5 pr-3 text-[12px] font-medium text-ink-muted">
          <LockIcon />
          E2E encrypted
        </span>
      </div>
      <h1
        id="report-title"
        style={{ '--d': '80ms' }}
        className="rise mb-3 font-bagus text-[clamp(30px,8vw,44px)] font-normal leading-[1.05] tracking-[-0.02em] text-ink-strong [overflow-wrap:anywhere]"
      >
        {summary.host || 'Untitled scan'}
      </h1>
      <p style={{ '--d': '160ms' }} className="rise max-w-[54ch] text-[15px] leading-[1.6] text-ink-muted">
        {overview(total, summary.counts, summary.worst)}
      </p>
      <dl style={{ '--d': '240ms' }} className="rise mt-7 flex flex-col gap-2.5 text-[13.5px] leading-[1.55]">
        {summary.url && (
          <Fact label="Target">
            <span className="font-mono text-[12.5px]">{summary.url}</span>
          </Fact>
        )}
        <Fact label="Scan">{summary.scan}</Fact>
        {scanned && (
          <Fact label="Finished">
            <time dateTime={summary.finishedAt}>{scanned}</time>
          </Fact>
        )}
        {expires && <Fact label="Link expires">{expires}</Fact>}
      </dl>
    </section>
  )
}

function Tally({ label, count, severity, active, onClick }) {
  const body = (
    <>
      <span className={`font-bagus text-[30px] leading-none sm:text-[34px] ${count ? 'text-ink-strong' : 'text-ink-faint'}`}>{count}</span>
      <span className={`flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] ${count ? 'text-ink-muted' : 'text-ink-faint'}`}>
        {severity && <Swatch active={count > 0} />}
        {label}
      </span>
    </>
  )
  const base = 'relative flex h-full w-full flex-col items-center justify-center gap-3 py-7 sm:py-9'
  if (!onClick) return <div className={base} style={tone(severity)}>{body}</div>
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label}: ${count}`}
      onClick={onClick}
      style={tone(severity)}
      className={`${base} cursor-pointer transition-colors duration-200 hover:bg-surface-hover/50 focus-visible:bg-surface-hover/70 ${INSET_RING} ${
        active ? 'bg-surface-hover/60 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-(--sev)' : ''
      }`}
    >
      {body}
    </button>
  )
}

function Breakdown({ total, counts, filter, onFilter }) {
  return (
    <div role="group" aria-label="Filter findings by severity" className="border-y border-dashed border-line">
      <ul className="-mr-px -mb-px grid grid-cols-3 overflow-hidden sm:grid-cols-6">
        <li className="border-r border-b border-line/70">
          <Tally label="All" count={total} active={filter === 'all'} onClick={() => onFilter('all')} />
        </li>
        {SEVERITIES.map((severity) => (
          <li key={severity} className="border-r border-b border-line/70">
            <Tally
              label={SEVERITY_LABEL[severity]}
              count={counts[severity]}
              severity={severity}
              active={filter === severity}
              onClick={counts[severity] > 0 ? () => onFilter((current) => (current === severity ? 'all' : severity)) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function CopyButton({ value, label }) {
  const [state, setState] = useState('idle')
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    let next = 'copied'
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      next = 'failed'
    }
    setState(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className={`inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-hover hover:text-ink-strong ${RING}`}
    >
      {state === 'copied' ? (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 text-(--sev)" style={tone('info')} fill="none" stroke="currentColor" strokeWidth="1.75">
          <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 8.5 3 3 6-7" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.75" />
          <path strokeLinecap="round" d="M3.5 10.5v-6a1.5 1.5 0 0 1 1.5-1.5h6" />
        </svg>
      )}
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
    </button>
  )
}

function CodeCard({ label, action, children }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-line bg-bg">
      <div className="flex h-9 items-center justify-between gap-3 border-b border-dashed border-line pl-4 pr-1.5">
        <span className={LABEL}>{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function Captured({ content }) {
  const [open, setOpen] = useState(false)
  const lines = content.split('\n').length
  return (
    <details className="mt-5 overflow-hidden rounded-xl border border-line bg-bg" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary
        className={`flex h-9 cursor-pointer list-none select-none items-center justify-between gap-3 pl-4 pr-3 transition-colors duration-200 hover:bg-surface-hover/50 ${INSET_RING} [&::-webkit-details-marker]:hidden ${
          open ? 'border-b border-dashed border-line' : ''
        }`}
      >
        <span className={LABEL}>Captured file contents</span>
        <span className="flex items-center gap-2.5 font-mono text-[11px] text-ink-faint">
          {lines === 1 ? '1 line' : `${lines} lines`}
          <PlusIcon className="h-3 w-3 text-ink-muted" />
        </span>
      </summary>
      {open && <pre className={CODE}>{content}</pre>}
    </details>
  )
}

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-4">
      <dt className={LABEL}>{label}</dt>
      <dd className="min-w-0 whitespace-pre-line text-ink-secondary [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

export function FindingDetails({ id, finding }) {
  const href = finding.reference ? safeHref(finding.reference) : null
  const hasFields = finding.detail || finding.exploit || finding.remediation || finding.reference
  return (
    <div id={id} className={`reveal min-w-0 pt-1 pb-8 sm:pl-[10.5rem] ${PAD}`}>
      {hasFields && (
        <dl className="flex flex-col gap-3 text-[13.5px] leading-[1.6]">
          {finding.detail && <Field label="Detail">{finding.detail}</Field>}
          {finding.exploit && <Field label={finding.category === 'Performance' ? 'Impact' : 'Exploit'}>{finding.exploit}</Field>}
          {finding.remediation && <Field label="Fix">{finding.remediation}</Field>}
          {finding.reference && (
            <Field label="Ref">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:decoration-ink-muted ${RING}`}
                >
                  {finding.reference}
                </a>
              ) : (
                finding.reference
              )}
            </Field>
          )}
        </dl>
      )}
      {finding.evidence && (
        <CodeCard label="Evidence">
          <pre className={CODE}>{finding.evidence}</pre>
        </CodeCard>
      )}
      {finding.reproduction && (
        <CodeCard label="Proof of concept" action={<CopyButton value={finding.reproduction} label="proof of concept" />}>
          <pre className={`${CODE} text-ink-strong`}>{finding.reproduction}</pre>
        </CodeCard>
      )}
      {finding.capturedContent && <Captured content={finding.capturedContent} />}
    </div>
  )
}

function SeverityTag({ severity, className = '' }) {
  return (
    <span className={`items-center gap-2 font-mono text-[11.5px] leading-5 text-(--sev) ${className}`}>
      <Swatch />
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

function FindingRow({ finding, open, onToggle }) {
  const bodyId = `${useId()}-body`
  return (
    <li style={tone(finding.severity)} className={`transition-colors duration-200 ${open ? 'bg-surface/70' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className={`group grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 py-5 text-left transition-colors duration-200 hover:bg-surface-hover/40 focus-visible:bg-surface-hover/60 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] ${INSET_RING} ${PAD}`}
      >
        <SeverityTag severity={finding.severity} className="hidden pt-px sm:flex" />
        <span className="min-w-0">
          <SeverityTag severity={finding.severity} className="mb-1.5 flex sm:hidden" />
          <span className="block text-[14.5px] font-medium leading-snug text-ink-strong [overflow-wrap:anywhere]">{finding.title || 'Untitled finding'}</span>
          {(finding.category || finding.location) && (
            <span className="mt-1.5 flex min-w-0 items-baseline gap-2 text-[12.5px] leading-5 text-ink-subtle">
              {finding.category && <span className="max-w-[45%] shrink-0 truncate">{finding.category}</span>}
              {finding.category && finding.location && (
                <span aria-hidden="true" className="text-ink-faint">
                  ·
                </span>
              )}
              {finding.location && (
                <span className="min-w-0 truncate font-mono text-[11.5px]" title={finding.location}>
                  {finding.location}
                </span>
              )}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-raised text-ink-muted transition-colors duration-200 group-hover:border-line-strong group-hover:text-ink-strong group-aria-expanded:border-line-strong group-aria-expanded:text-ink-strong"
        >
          <PlusIcon />
        </span>
      </button>
      {open && <FindingDetails id={bodyId} finding={finding} />}
    </li>
  )
}

function AllClear({ host }) {
  return (
    <div className="border-y border-dashed border-line px-6 py-16 text-center sm:py-20">
      <p className="relative isolate inline-block font-bagus text-[30px] leading-none text-ink-strong sm:text-[36px]">
        All clear.
        <span aria-hidden="true" className="sel-box">
          {CORNERS.map((corner) => (
            <span key={corner} data-corner={corner} className="sel-handle" />
          ))}
        </span>
      </p>
      <p className="mx-auto mt-6 max-w-[46ch] text-[14px] leading-relaxed text-ink-muted [overflow-wrap:anywhere]">
        The scan finished without flagging anything
        {host && (
          <>
            {' on '}
            <span className="font-mono text-[13px] text-ink-secondary">{host}</span>
          </>
        )}
        .
      </p>
    </div>
  )
}

function ReportFooter({ generator }) {
  return (
    <footer className="mt-auto pt-16">
      <StripeBand />
      <div className={`flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between sm:gap-10 ${PAD}`}>
        <div className="flex max-w-[36ch] flex-col items-start gap-3">
          <a href="/" aria-label="blxr.net home" className={`font-bagus text-[22px] leading-none text-ink-strong ${RING} rounded`}>
            blxr
          </a>
          <p className="text-[12.5px] leading-relaxed text-ink-subtle">Decrypted in your browser. The key lives in this link and never reaches blxr.net.</p>
        </div>
        {generator && (
          <p className="max-w-[44ch] text-[12.5px] leading-relaxed text-ink-subtle sm:text-right">
            Generated by {generator}. For authorized security testing only, so verify findings before acting on them.
          </p>
        )}
      </div>
      <div className={`flex items-center justify-between gap-4 border-t border-dashed border-line py-4 text-[12px] text-ink-subtle ${PAD}`}>
        <span>© {new Date().getFullYear()} Blxr · Athens, Greece</span>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`group -mr-1 inline-flex cursor-pointer items-center gap-1.5 rounded px-1 transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong ${RING}`}
        >
          Back to top
          <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:-translate-y-0.5">
            ↑
          </span>
        </button>
      </div>
    </footer>
  )
}

export function ReportView({ summary, expiresAt }) {
  const { findings, counts } = summary
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(() => new Set())
  const total = findings.length
  const shown = filter === 'all' ? findings : findings.filter((finding) => finding.severity === filter)
  const allOpen = shown.length > 0 && shown.every((finding) => open.has(finding.key))

  const toggle = (key) =>
    setOpen((previous) => {
      const next = new Set(previous)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const toggleAll = () =>
    setOpen((previous) => {
      const next = new Set(previous)
      for (const finding of shown) {
        if (allOpen) next.delete(finding.key)
        else next.add(finding.key)
      }
      return next
    })

  return (
    <>
      <Hero summary={summary} total={total} expires={formatWhen(expiresAt)} />

      <StripeBand />

      <section aria-labelledby="findings-title" className="relative pt-12">
        <FrameLabel>Findings</FrameLabel>
        <div style={{ '--d': '300ms' }} className={`rise mb-7 flex items-end justify-between gap-4 ${PAD}`}>
          <h2 id="findings-title" className="flex items-baseline gap-2 font-bagus text-[20px] font-normal tracking-tight text-ink-strong">
            Breakdown
            <span className="font-mono text-[11px] tabular-nums text-ink-faint">{pad(total)}</span>
          </h2>
          {total > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className={`group inline-flex cursor-pointer items-center gap-1.5 rounded text-[13px] text-ink-muted transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong ${RING}`}
            >
              <span className="underline decoration-line-strong decoration-wavy decoration-1 underline-offset-[5px] transition-[text-decoration-color] duration-200 group-hover:decoration-ink-muted">
                {allOpen ? 'Collapse all' : 'Expand all'}
              </span>
            </button>
          )}
        </div>

        {total > 0 ? (
          <div style={{ '--d': '360ms' }} className="rise">
            <Breakdown total={total} counts={counts} filter={filter} onFilter={setFilter} />
            <ul aria-label="Findings" className="divide-y divide-dashed divide-line border-b border-dashed border-line">
              {shown.map((finding) => (
                <FindingRow key={finding.key} finding={finding} open={open.has(finding.key)} onToggle={() => toggle(finding.key)} />
              ))}
            </ul>
          </div>
        ) : (
          <AllClear host={summary.host} />
        )}
      </section>

      <ReportFooter generator={summary.generator} />
    </>
  )
}

export default function ReportPage() {
  const state = useReport()

  useEffect(() => {
    document.title = state.status === 'ready' ? state.summary.title : DEFAULT_TITLE
  }, [state])

  let content
  if (state.status === 'ready') content = <ReportView key={state.id} summary={state.summary} expiresAt={state.expiresAt} />
  else if (state.status === 'incomplete') content = <State {...INCOMPLETE_STATE} />
  else if (state.status === 'error') content = <State title={state.title} message={state.message} />
  else content = <State {...LOADING_STATE} busy />

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[960px] flex-col border-x border-dashed border-line bg-bg text-ink">
      <TopBar />
      <main aria-busy={state.status === 'loading'} className="flex min-w-0 flex-1 flex-col">
        {content}
      </main>
    </div>
  )
}
