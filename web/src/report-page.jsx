import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  parseLink,
  linkHash,
  linkFromText,
  loadReport,
  deleteReport,
  reportApiBase,
  summarize,
  errorState,
  safeHref,
  formatWhen,
  matchesQuery,
  categoriesOf,
  compareFindings,
  rescanHref,
  readStatuses,
  writeStatuses,
  issueMarkdown,
  reportMarkdown,
  reportCsv,
  fixPrompt,
  exportName,
  SEVERITIES,
  SEVERITY_LABEL,
  STATUS_LABEL,
  LOADING_STATE,
  INCOMPLETE_STATE,
  DELETED_STATE,
  DEFAULT_TITLE,
} from './lib/report'

const THEME_KEY = 'blxr-theme'
const WRAP = 'mx-auto w-full max-w-[760px] px-6'
const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40'
const LABEL = 'text-[12px] font-medium text-ink-subtle'
const CODE =
  'max-h-[28rem] overflow-auto whitespace-pre rounded-lg border border-line bg-surface px-3.5 py-3 font-mono text-[12px] leading-[1.7] text-ink-secondary [tab-size:4] print:max-h-none print:overflow-visible print:whitespace-pre-wrap print:[overflow-wrap:anywhere]'
const BTN = `inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-3 text-[13px] text-ink-secondary transition-colors duration-200 hover:border-line-strong hover:text-ink-strong disabled:cursor-default disabled:opacity-50 ${RING}`
const TEXT_BTN = `inline-flex h-7 shrink-0 cursor-pointer items-center rounded-md text-[12.5px] text-ink-subtle transition-colors duration-200 hover:text-ink-strong ${RING}`
const INPUT =
  'h-9 w-full min-w-0 rounded-md border border-line bg-surface px-3 text-[13.5px] text-ink-strong outline-none transition-colors duration-200 placeholder:text-ink-faint hover:border-line-strong focus:border-line-strong focus-visible:ring-2 focus-visible:ring-ink-strong/15'

const EXPORTS = [
  { id: 'pdf', label: 'PDF', hint: 'Print or save' },
  { id: 'md', label: 'Markdown', hint: 'GitHub, Notion, email' },
  { id: 'csv', label: 'CSV', hint: 'Excel, Numbers, Jira' },
  { id: 'json', label: 'JSON', hint: 'Full raw report' },
]

const tone = (severity) => ({ '--sev': `var(--sev-${severity})` })

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const shareUrl = (link, extra) => `${window.location.origin}${window.location.pathname}${linkHash(link, extra)}`

function download(name, type, body) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function useReport() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let current = 0
    let active = null
    const load = () => {
      const link = parseLink(window.location.hash)
      if (link && active && link.id === active.id && link.key === active.key) {
        active = link
        setState((previous) => (previous.status === 'ready' ? { ...previous, link, focus: link.f ? { ref: link.f } : previous.focus } : previous))
        return
      }
      const run = ++current
      active = link
      if (!link) {
        setState({ status: 'incomplete' })
        return
      }
      setState({ status: 'loading' })
      loadReport(link, reportApiBase(window.location.search))
        .then(({ report, expiresAt }) => ({
          status: 'ready',
          id: link.id,
          link,
          report,
          summary: summarize(report),
          expiresAt,
          focus: link.f ? { ref: link.f } : null,
        }))
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

  return [state, setState]
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

function useStatuses(id) {
  const [statuses, setStatuses] = useState(() => {
    const store = id ? storage() : null
    return store ? readStatuses(store, id) : {}
  })
  const update = (ref, status) => {
    const next = { ...statuses }
    if (status) next[ref] = status
    else delete next[ref]
    setStatuses(next)
    const store = id ? storage() : null
    if (store) writeStatuses(store, id, next)
  }
  return [statuses, update]
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
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1.75" />
      <path strokeLinecap="round" d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  )
}

function Chevron({ className = '' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </svg>
  )
}

function SearchIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.25" />
      <path strokeLinecap="round" d="m10.25 10.25 3 3" />
    </svg>
  )
}

function CheckIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.75 6.25 2.25 2.25 4.25-4.75" />
    </svg>
  )
}

function DashIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M3 6h6" />
    </svg>
  )
}

function ArrowIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 10.5 10.5 5.5M6.5 5.5h4v4" />
    </svg>
  )
}

function TopBar() {
  const [theme, toggle] = useThemeToggle()
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md print:hidden">
      <div className={`${WRAP} flex h-14 items-center justify-between gap-4`}>
        <div className="flex min-w-0 items-center gap-2.5 text-[13.5px]">
          <a href="/" className={`rounded font-semibold tracking-tight text-ink-strong ${RING}`}>
            blxr
          </a>
          <span aria-hidden="true" className="text-ink-faint">
            /
          </span>
          <span className="truncate text-ink-muted">Security report</span>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          title={label}
          className={`-mr-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-subtle transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong ${RING}`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  )
}

function Footer({ children }) {
  return (
    <footer className={`${WRAP} mt-auto`}>
      <div className="flex gap-2.5 border-t border-line py-8 text-[12px] leading-relaxed text-ink-subtle">
        <span className="mt-[3px] text-ink-muted">
          <LockIcon />
        </span>
        <p className="max-w-[68ch]">
          <span className="font-medium text-ink-muted">E2E encrypted.</span> Decrypted in your browser. The key lives in this link and never reaches blxr.net.
          {children}
        </p>
      </div>
    </footer>
  )
}

function State({ title, message, busy = false }) {
  return (
    <>
      <section className={`${WRAP} pt-20 pb-24`}>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-strong">
          {title}
          {busy && (
            <span aria-hidden="true" className="dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          )}
        </h1>
        <p className="mt-2 max-w-[54ch] text-[14px] leading-relaxed text-ink-muted [overflow-wrap:anywhere]">{message}</p>
      </section>
      <Footer />
    </>
  )
}

function Dot({ className = '' }) {
  return <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full bg-(--sev) ${className}`} />
}

function Grade({ grade, severity }) {
  return (
    <div role="img" aria-label={grade ? `Grade ${grade}` : 'No grade'} title="Overall grade" className="flex shrink-0 flex-col items-center gap-1.5">
      <span
        aria-hidden="true"
        style={severity ? tone(severity) : undefined}
        className={`grid h-12 w-12 place-items-center rounded-xl border border-line bg-surface text-[21px] font-semibold tracking-tight ${
          severity ? 'text-(--sev)' : 'text-ink-faint'
        }`}
      >
        {grade || '—'}
      </span>
      <span aria-hidden="true" className="text-[11px] text-ink-subtle">
        Grade
      </span>
    </div>
  )
}

function Tab({ label, count, severity, active, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label}: ${count}`}
      onClick={onClick}
      style={severity ? tone(severity) : undefined}
      className={`relative flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm text-[13px] outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/40 ${
        active ? 'text-ink-strong after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink-strong' : 'text-ink-muted hover:text-ink-strong'
      }`}
    >
      {severity && <Dot className="h-1.5 w-1.5" />}
      <span>{label}</span>
      <span className="tabular-nums text-ink-faint">{count}</span>
    </button>
  )
}

function CopyButton({ value, label, children = 'Copy', className = TEXT_BTN }) {
  const [state, setState] = useState('idle')
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    let next = 'copied'
    try {
      await navigator.clipboard.writeText(typeof value === 'function' ? value() : value)
    } catch {
      next = 'failed'
    }
    setState(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button type="button" onClick={copy} aria-label={label} className={className}>
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : children}</span>
    </button>
  )
}

function ExportMenu({ onPick, hasJson }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const items = EXPORTS.filter((item) => item.id !== 'json' || hasJson)

  useEffect(() => {
    if (!open) return
    const away = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      root.current?.querySelector('button')?.focus()
    }
    root.current?.querySelector('[role="menuitem"]')?.focus()
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const move = (event) => {
    const all = [...event.currentTarget.querySelectorAll('[role="menuitem"]')]
    const at = all.indexOf(document.activeElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      all[(at + (event.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={root} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={BTN}>
        Export
        <Chevron className={`-mr-1 h-3.5 w-3.5 text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Export report"
          onKeyDown={move}
          className="reveal absolute left-0 top-full z-30 mt-1.5 w-60 rounded-lg border border-line bg-surface p-1 shadow-[0_12px_32px_-8px_var(--shadow-cast)]"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false)
                onPick(item.id)
              }}
              className="flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-secondary outline-none transition-colors duration-150 hover:bg-surface-hover hover:text-ink-strong focus-visible:bg-surface-hover focus-visible:text-ink-strong"
            >
              <span>{item.label}</span>
              <span className="text-[11.5px] text-ink-faint">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-[13.5px] leading-[1.65] text-ink-secondary [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

function Captured({ content }) {
  const [open, setOpen] = useState(false)
  const lines = content.split('\n').length
  return (
    <details className="group/captured print:hidden" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary
        className={`inline-flex cursor-pointer list-none select-none items-center gap-1 rounded text-[12.5px] text-ink-muted transition-colors duration-200 hover:text-ink-strong ${RING} [&::-webkit-details-marker]:hidden`}
      >
        Captured file contents
        <span className="text-ink-faint">· {lines === 1 ? '1 line' : `${lines} lines`}</span>
        <Chevron className="h-3.5 w-3.5 transition-transform duration-200 group-open/captured:rotate-180" />
      </summary>
      {open && <pre className={`mt-2 ${CODE}`}>{content}</pre>}
    </details>
  )
}

export function FindingDetails({ id, finding, open = true, children }) {
  const href = finding.reference ? safeHref(finding.reference) : null
  const hasFields = finding.detail || finding.exploit || finding.remediation || finding.reference
  return (
    <div id={id} className={`${open ? 'flex' : 'hidden'} reveal min-w-0 flex-col gap-5 pb-6 pl-9 print:flex`}>
      {hasFields && (
        <dl className="flex flex-col gap-4">
          {finding.detail && <Field label="Detail">{finding.detail}</Field>}
          {finding.exploit && <Field label={finding.category === 'Performance' ? 'Impact' : 'Exploit'}>{finding.exploit}</Field>}
          {finding.remediation && <Field label="Fix">{finding.remediation}</Field>}
          {finding.reference && (
            <Field label="Reference">
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
        <div>
          <p className={`mb-1.5 ${LABEL}`}>Evidence</p>
          <pre className={CODE}>{finding.evidence}</pre>
        </div>
      )}
      {finding.reproduction && (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className={LABEL}>Proof of concept</p>
            <CopyButton value={finding.reproduction} label="Copy proof of concept" className={`-mr-1.5 h-6 px-1.5 print:hidden ${TEXT_BTN}`} />
          </div>
          <pre className={`${CODE} text-ink-strong`}>{finding.reproduction}</pre>
        </div>
      )}
      {finding.capturedContent && <Captured content={finding.capturedContent} />}
      {children}
    </div>
  )
}

function StatusToggle({ finding, status, onStatus }) {
  const fixed = status === 'fixed'
  return (
    <label
      title={status ? STATUS_LABEL[status] : 'Mark as fixed'}
      className="relative mt-[13px] grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full"
    >
      <input
        type="checkbox"
        checked={fixed}
        onChange={() => onStatus(finding.ref, fixed ? null : 'fixed')}
        aria-label={`Fixed: ${finding.title || 'Untitled finding'}`}
        className={`h-4 w-4 cursor-pointer appearance-none rounded-full border-[1.5px] transition-colors duration-200 ${
          fixed ? 'border-ink-subtle bg-ink-subtle' : status ? 'border-ink-faint' : 'border-(--sev) bg-(--sev)/10 hover:bg-(--sev)/30'
        } ${RING}`}
      />
      {fixed && <CheckIcon className="pointer-events-none absolute h-2.5 w-2.5 text-bg" />}
      {status === 'ignored' && <DashIcon className="pointer-events-none absolute h-2.5 w-2.5 text-ink-faint" />}
    </label>
  )
}

function FindingRow({ finding, open, onToggle, status, onStatus, isNew, summary, link }) {
  const bodyId = `finding-${finding.ref}-body`
  const title = finding.title || 'Untitled finding'
  return (
    <li id={`finding-${finding.ref}`} style={tone(finding.severity)} className="scroll-mt-20">
      <div className="flex items-start gap-3 print:break-after-avoid print:break-inside-avoid">
        <StatusToggle finding={finding} status={status} onStatus={onStatus} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="group flex min-w-0 flex-1 cursor-pointer items-start gap-4 rounded-sm py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/30"
        >
          <span className="min-w-0 flex-1">
            <span
              className={`block text-[14px] font-medium leading-snug transition-colors duration-200 [overflow-wrap:anywhere] ${
                status ? 'text-ink-muted' : 'text-ink-strong group-hover:text-ink'
              } ${status === 'fixed' ? 'line-through decoration-ink-faint' : ''}`}
            >
              {title}
            </span>
            <span className="mt-1 flex min-w-0 items-baseline gap-1.5 text-[12.5px] leading-5 text-ink-subtle">
              {isNew && <span className="shrink-0 self-center rounded border border-line-strong px-1 text-[10.5px] font-semibold uppercase leading-4 tracking-wide text-ink-strong">New</span>}
              <span className="shrink-0 text-ink-muted">{SEVERITY_LABEL[finding.severity]}</span>
              {status && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0">{STATUS_LABEL[status]}</span>
                </>
              )}
              {finding.category && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline">
                    ·
                  </span>
                  <span className="hidden max-w-[40%] shrink-0 truncate sm:inline">{finding.category}</span>
                </>
              )}
              {finding.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="min-w-0 truncate font-mono text-[11.5px]" title={finding.location}>
                    {finding.location}
                  </span>
                </>
              )}
            </span>
          </span>
          <Chevron className="mt-0.5 h-4 w-4 text-ink-faint transition-[transform,color] duration-200 group-hover:text-ink-muted group-aria-expanded:rotate-180 print:hidden" />
        </button>
      </div>
      <FindingDetails id={bodyId} finding={finding} open={open}>
        <div className="-mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 print:hidden">
          <button type="button" onClick={() => onStatus(finding.ref, status === 'fixed' ? null : 'fixed')} className={TEXT_BTN}>
            {status === 'fixed' ? 'Reopen' : 'Mark as fixed'}
          </button>
          <button type="button" onClick={() => onStatus(finding.ref, status === 'ignored' ? null : 'ignored')} className={TEXT_BTN}>
            {status === 'ignored' ? 'Stop ignoring' : 'Ignore'}
          </button>
          <CopyButton value={() => issueMarkdown(finding, summary)} label={`Copy “${title}” as an issue`}>
            Copy as issue
          </CopyButton>
          {link && (
            <CopyButton value={() => shareUrl(link, { f: finding.ref })} label={`Copy a link to “${title}”`}>
              Copy link
            </CopyButton>
          )}
        </div>
      </FindingDetails>
    </li>
  )
}

function Overview({ summary, resolved }) {
  const { counts, findings } = summary
  const total = findings.length
  const present = SEVERITIES.filter((severity) => counts[severity] > 0)
  const legend = present.map((severity) => `${counts[severity]} ${SEVERITY_LABEL[severity].toLowerCase()}`).join(', ')
  const facts = [
    { label: 'Started', value: formatWhen(summary.startedAt) },
    { label: 'Duration', value: summary.duration },
    { label: 'Target', value: summary.url, mono: true },
    { label: 'Resolved', value: total ? `${resolved} of ${total}` : '' },
  ].filter((fact) => fact.value)

  return (
    <div className="border-t border-line pt-6">
      {total > 0 && (
        <>
          <div role="img" aria-label={`Findings by severity: ${legend}`} className="flex h-1.5 gap-[3px]">
            {present.map((severity) => (
              <span key={severity} style={{ ...tone(severity), flexGrow: counts[severity] }} className="h-full min-w-1.5 rounded-full bg-(--sev)" />
            ))}
          </div>
          <p aria-hidden="true" className="mt-2.5 hidden gap-4 text-[11px] text-ink-muted print:flex">
            {present.map((severity) => (
              <span key={severity} style={tone(severity)} className="flex items-center gap-1.5">
                <Dot className="h-1.5 w-1.5" />
                {counts[severity]} {SEVERITY_LABEL[severity]}
              </span>
            ))}
          </p>
        </>
      )}
      {facts.length > 0 && (
        <dl className={`grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-[1fr_0.75fr_1.75fr_0.75fr] ${total > 0 ? 'mt-6' : ''}`}>
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className={LABEL}>{fact.label}</dt>
              <dd title={fact.value} className={`mt-1 truncate text-ink-secondary tabular-nums print:whitespace-normal print:[overflow-wrap:anywhere] ${fact.mono ? 'font-mono text-[12.5px] leading-[1.6rem]' : 'text-[13.5px]'}`}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function FixFirst({ findings, onJump }) {
  return (
    <section aria-labelledby="fix-first" className="mt-10 print:hidden">
      <h2 id="fix-first" className={LABEL}>
        Fix these first
      </h2>
      <ol className="mt-2.5 divide-y divide-line rounded-lg border border-line">
        {findings.map((finding) => (
          <li key={finding.key} style={tone(finding.severity)}>
            <button
              type="button"
              onClick={() => onJump(finding.ref)}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-[7px] px-4 py-3 text-left outline-none transition-colors duration-200 hover:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/30"
            >
              <Dot />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-strong">{finding.title || 'Untitled finding'}</span>
              {finding.location && <span className="hidden max-w-[40%] truncate font-mono text-[11.5px] text-ink-subtle sm:block">{finding.location}</span>}
              <Chevron className="h-3.5 w-3.5 -rotate-90 text-ink-faint transition-colors duration-200 group-hover:text-ink-muted" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ComparePanel({ compare, onInput, onSubmit, onClose, newOnly, onNewOnly }) {
  if (compare.status === 'ready') {
    const { result } = compare
    return (
      <div className="reveal mt-6 rounded-lg border border-line px-4 py-3.5 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <p className="pt-1 text-[12.5px] leading-relaxed text-ink-subtle">
            Compared with the scan
            {compare.when && <> from {compare.when}</>}
            {compare.host && !compare.sameHost && (
              <>
                {' of '}
                <span className="font-mono text-[11.5px] text-ink-muted">{compare.host}</span>
              </>
            )}
            .
          </p>
          <button type="button" onClick={onClose} className={`-mr-1 px-1 ${TEXT_BTN}`}>
            Clear
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13.5px] text-ink-muted">
          <button
            type="button"
            aria-pressed={newOnly}
            disabled={!result.added.size}
            onClick={onNewOnly}
            title={result.added.size ? 'Show only new findings' : undefined}
            className={`-mx-1.5 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-1.5 transition-colors duration-200 hover:text-ink-strong disabled:cursor-default disabled:hover:text-ink-muted ${RING} ${
              newOnly ? 'bg-surface-hover text-ink-strong' : ''
            }`}
          >
            <span className="font-semibold tabular-nums text-ink-strong">{result.added.size}</span> new
          </button>
          <span>
            <span className="font-semibold tabular-nums text-ink-strong">{result.fixed.length}</span> fixed
          </span>
          <span>
            <span className="font-semibold tabular-nums text-ink-strong">{result.open}</span> still open
          </span>
        </div>
        {result.fixed.length > 0 && (
          <details className="group/fixed mt-2">
            <summary
              className={`inline-flex cursor-pointer list-none select-none items-center gap-1 rounded text-[12.5px] text-ink-subtle transition-colors duration-200 hover:text-ink-strong ${RING} [&::-webkit-details-marker]:hidden`}
            >
              What got fixed
              <Chevron className="h-3.5 w-3.5 transition-transform duration-200 group-open/fixed:rotate-180" />
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5 pb-1">
              {result.fixed.map((finding) => (
                <li key={finding.key} style={tone(finding.severity)} className="flex min-w-0 items-center gap-2.5 text-[13px] text-ink-muted">
                  <Dot className="h-1.5 w-1.5" />
                  <span className="min-w-0 truncate line-through decoration-ink-faint">{finding.title || 'Untitled finding'}</span>
                  {finding.location && <span className="hidden min-w-0 truncate font-mono text-[11.5px] text-ink-faint sm:block">{finding.location}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    )
  }

  const busy = compare.status === 'loading'
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="reveal mt-6 print:hidden"
    >
      <label htmlFor="compare-link" className={LABEL}>
        Compare with an earlier scan
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2 sm:flex-nowrap">
        <input
          id="compare-link"
          autoFocus
          value={compare.input}
          onChange={(event) => onInput(event.target.value)}
          placeholder="Paste the link of an earlier report"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={compare.status === 'error'}
          aria-describedby="compare-note"
          className={`${INPUT} basis-full sm:basis-auto`}
        />
        <button type="submit" disabled={busy || !compare.input.trim()} className={`${BTN} h-9`}>
          {busy ? 'Decrypting…' : 'Compare'}
        </button>
        <button type="button" onClick={onClose} className={`${BTN} h-9 border-transparent hover:border-transparent`}>
          Cancel
        </button>
      </div>
      <p id="compare-note" role={compare.status === 'error' ? 'alert' : undefined} className={`mt-2 text-[12px] ${compare.status === 'error' ? 'text-(--sev-critical)' : 'text-ink-subtle'}`}>
        {compare.status === 'error' ? compare.error : 'It’s decrypted here in your browser, like this one.'}
      </p>
    </form>
  )
}

function OwnerPanel({ onDelete }) {
  const [step, setStep] = useState('idle')
  const [error, setError] = useState('')
  const busy = step === 'busy'

  const run = async () => {
    setStep('busy')
    setError('')
    try {
      await onDelete()
    } catch (problem) {
      setError(errorState(problem).message)
      setStep('idle')
    }
  }

  return (
    <section aria-labelledby="owner-title" className={`${WRAP} print:hidden`}>
      <div className="flex flex-col gap-4 border-t border-line py-8 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <h2 id="owner-title" className="text-[13.5px] font-medium text-ink-strong">
            Delete this report
          </h2>
          <p className="mt-1 max-w-[56ch] text-[12.5px] leading-relaxed text-ink-subtle">
            Removes it from blxr.net for everyone who has the link. Your link can delete it, so share the one from Copy link instead.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-[12.5px] text-(--sev-critical)">
              {error}
            </p>
          )}
        </div>
        {step === 'idle' ? (
          <button type="button" onClick={() => setStep('confirm')} className={`${BTN} self-start sm:self-auto`}>
            Delete report
          </button>
        ) : (
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setStep('idle')} disabled={busy} className={BTN}>
              Cancel
            </button>
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className={`${BTN} border-(--sev-critical)/40 text-(--sev-critical) hover:border-(--sev-critical) hover:text-(--sev-critical)`}
            >
              {busy ? 'Deleting…' : 'Delete for everyone'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export function ReportView({ summary, expiresAt, report, link, focus, onDeleted }) {
  const { findings, counts } = summary
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const [statuses, setStatus] = useStatuses(link?.id)
  const [compare, setCompare] = useState({ status: 'closed', input: '' })
  const [newOnly, setNewOnly] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [jump, setJump] = useState(null)
  const [mac] = useState(() => typeof navigator !== 'undefined' && /Macintosh/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1))
  const search = useRef(null)

  const total = findings.length
  const categories = categoriesOf(findings)
  const added = compare.status === 'ready' ? compare.result.added : null
  const visible = findings.filter(
    (finding) =>
      (filter === 'all' || finding.severity === filter) &&
      (!category || finding.category === category) &&
      matchesQuery(finding, query) &&
      (!newOnly || added?.has(finding.key)),
  )
  const list = printing ? findings : visible
  const allOpen = list.length > 0 && list.every((finding) => open.has(finding.key))
  const resolved = findings.filter((finding) => statuses[finding.ref]).length
  const urgent = findings.filter((finding) => (finding.severity === 'critical' || finding.severity === 'high') && !statuses[finding.ref]).slice(0, 3)
  const filtered = filter !== 'all' || category || query.trim() || newOnly
  const rescan = mac ? rescanHref(summary) : null
  const scanned = formatWhen(summary.finishedAt)
  const expires = formatWhen(expiresAt)

  const toggle = (key) =>
    setOpen((previous) => {
      const next = new Set(previous)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const toggleAll = () =>
    setOpen((previous) => {
      const next = new Set(previous)
      for (const finding of list) {
        if (allOpen) next.delete(finding.key)
        else next.add(finding.key)
      }
      return next
    })

  const clearFilters = () => {
    setFilter('all')
    setCategory('')
    setQuery('')
    setNewOnly(false)
  }

  const reveal = (ref) => {
    const target = findings.find((finding) => finding.ref === ref)
    if (!target) return
    clearFilters()
    setOpen((previous) => new Set(previous).add(target.key))
    setJump({ ref })
  }

  const onFocus = useEffectEvent((ref) => reveal(ref))

  useEffect(() => {
    if (focus) onFocus(focus.ref)
  }, [focus])

  useEffect(() => {
    if (!jump) return
    const row = document.getElementById(`finding-${jump.ref}`)
    if (!row) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    row.querySelector('button[aria-expanded]')?.focus({ preventScroll: true })
  }, [jump])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (!search.current) return
      event.preventDefault()
      search.current.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done, { once: true })
    window.print()
    return () => window.removeEventListener('afterprint', done)
  }, [printing])

  const exportAs = (kind) => {
    if (kind === 'pdf') setPrinting(true)
    else if (kind === 'md') download(exportName(summary, 'md'), 'text/markdown;charset=utf-8', reportMarkdown(summary, statuses))
    else if (kind === 'csv') download(exportName(summary, 'csv'), 'text/csv;charset=utf-8', reportCsv(summary, statuses))
    else if (kind === 'json' && report) download(exportName(summary, 'json'), 'application/json', `${JSON.stringify(report, null, 2)}\n`)
  }

  const closeCompare = () => {
    setCompare({ status: 'closed', input: '' })
    setNewOnly(false)
  }

  const runCompare = async () => {
    const other = linkFromText(compare.input)
    const fail = (error) => setCompare((current) => ({ ...current, status: 'error', error }))
    if (!other) return fail('That doesn’t look like a report link. It should end in #id=…&key=…')
    if (link && other.id === link.id) return fail('That’s this report. Paste the link of a different scan.')
    setCompare((current) => ({ ...current, status: 'loading', error: '' }))
    try {
      const { report: earlier } = await loadReport(other, reportApiBase(window.location.search))
      const previous = summarize(earlier)
      setCompare((current) => ({
        ...current,
        status: 'ready',
        result: compareFindings(findings, previous.findings),
        when: formatWhen(previous.finishedAt),
        host: previous.host,
        sameHost: previous.host === summary.host,
      }))
    } catch (error) {
      fail(errorState(error).message)
    }
  }

  return (
    <>
      <section aria-labelledby="report-title" className={`${WRAP} rise relative z-20 pt-16 pb-10 print:pt-0`}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 id="report-title" className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink-strong [overflow-wrap:anywhere] sm:text-[30px]">
              {summary.host || 'Untitled scan'}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-subtle">
              {summary.scan.replaceAll(' · ', ' · ')}
              {scanned && (
                <>
                  <span aria-hidden="true">{' · '}</span>
                  <time dateTime={summary.finishedAt}>{scanned}</time>
                </>
              )}
            </p>
            {summary.gradeReason && <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">{summary.gradeReason}</p>}
          </div>
          <Grade grade={summary.grade} severity={summary.gradeSeverity} />
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2 print:hidden">
          <ExportMenu onPick={exportAs} hasJson={Boolean(report)} />
          <CopyButton value={() => fixPrompt(summary, statuses)} label="Copy AI prompt to fix everything in this report" className={BTN}>
            Copy AI prompt
          </CopyButton>
          <button
            type="button"
            aria-expanded={compare.status !== 'closed'}
            onClick={() => (compare.status === 'closed' ? setCompare({ status: 'open', input: '' }) : closeCompare())}
            className={BTN}
          >
            Compare
          </button>
          {link && (
            <CopyButton value={() => shareUrl(link)} label="Copy a link to this report" className={BTN}>
              Copy link
            </CopyButton>
          )}
          {rescan && (
            <a href={rescan} title="Opens WebScanner on your Mac with this site filled in" className={BTN}>
              Scan again
              <ArrowIcon className="-mr-1 h-3.5 w-3.5 text-ink-faint" />
            </a>
          )}
        </div>

        {compare.status !== 'closed' && (
          <ComparePanel
            compare={compare}
            onInput={(input) => setCompare((current) => ({ ...current, input, status: current.status === 'error' ? 'open' : current.status }))}
            onSubmit={runCompare}
            onClose={closeCompare}
            newOnly={newOnly}
            onNewOnly={() => setNewOnly((value) => !value)}
          />
        )}
      </section>

      <div style={{ '--d': '40ms' }} className={`${WRAP} rise`}>
        <Overview summary={summary} resolved={resolved} />
        {total > 3 && urgent.length > 0 && <FixFirst findings={urgent} onJump={reveal} />}
      </div>

      <div style={{ '--d': '80ms' }} className={`${WRAP} rise mt-12`}>
        {total > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2 pb-2 print:hidden">
              <div className="relative min-w-[12rem] flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                <input
                  ref={search}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search findings"
                  placeholder="Search findings"
                  className={`${INPUT} pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden`}
                />
                {!query && (
                  <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 font-sans text-[11px] leading-4 text-ink-faint sm:block">
                    /
                  </kbd>
                )}
              </div>
              {categories.length > 1 && (
                <div className="relative">
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    aria-label="Filter by category"
                    className={`${INPUT} w-auto max-w-[15rem] cursor-pointer appearance-none pr-8 ${category ? '' : 'text-ink-secondary'}`}
                  >
                    <option value="">All categories</option>
                    {categories.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name} ({item.count})
                      </option>
                    ))}
                  </select>
                  <Chevron className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                </div>
              )}
              <button type="button" onClick={toggleAll} disabled={!list.length} className={`${BTN} h-9`}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
            <div
              role="group"
              aria-label="Filter findings by severity"
              className="flex gap-6 overflow-x-auto border-b border-line pr-6 [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,#000_80%,transparent)] print:hidden [&::-webkit-scrollbar]:hidden"
            >
              <Tab label="All" count={total} active={filter === 'all'} onClick={() => setFilter('all')} />
              {SEVERITIES.filter((severity) => counts[severity] > 0).map((severity) => (
                <Tab
                  key={severity}
                  label={SEVERITY_LABEL[severity]}
                  count={counts[severity]}
                  severity={severity}
                  active={filter === severity}
                  onClick={() => setFilter((current) => (current === severity ? 'all' : severity))}
                />
              ))}
            </div>
            {list.length > 0 ? (
              <ul aria-label="Findings" className="divide-y divide-line print:border-t print:border-line">
                {list.map((finding) => (
                  <FindingRow
                    key={finding.key}
                    finding={finding}
                    open={open.has(finding.key)}
                    onToggle={() => toggle(finding.key)}
                    status={statuses[finding.ref]}
                    onStatus={setStatus}
                    isNew={Boolean(added?.has(finding.key))}
                    summary={summary}
                    link={link}
                  />
                ))}
              </ul>
            ) : (
              <div className="py-12">
                <p className="text-[14px] font-medium text-ink-strong">No findings match.</p>
                {filtered && (
                  <button type="button" onClick={clearFilters} className={`mt-3 ${BTN}`}>
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="border-t border-line py-14">
            <p className="text-[15px] font-medium text-ink-strong">All clear.</p>
            <p className="mt-1.5 max-w-[50ch] text-[13.5px] leading-relaxed text-ink-muted [overflow-wrap:anywhere]">
              The scan finished without flagging anything
              {summary.host && (
                <>
                  {' on '}
                  <span className="font-mono text-[12.5px] text-ink-secondary">{summary.host}</span>
                </>
              )}
              .
            </p>
          </div>
        )}
      </div>

      <div className="h-16 shrink-0" />

      {link?.del && onDeleted && <OwnerPanel onDelete={() => deleteReport(link, reportApiBase(window.location.search)).then(onDeleted)} />}

      <Footer>
        {expires && ` Link expires ${expires}.`} Generated by {summary.generator}. For authorized security testing only.
      </Footer>
    </>
  )
}

export default function ReportPage() {
  const [state, setState] = useReport()

  useEffect(() => {
    document.title = state.status === 'ready' ? state.summary.title : DEFAULT_TITLE
  }, [state])

  let content
  if (state.status === 'ready') {
    content = (
      <ReportView
        key={state.id}
        summary={state.summary}
        expiresAt={state.expiresAt}
        report={state.report}
        link={state.link}
        focus={state.focus}
        onDeleted={() => setState({ status: 'deleted' })}
      />
    )
  } else if (state.status === 'deleted') content = <State {...DELETED_STATE} />
  else if (state.status === 'incomplete') content = <State {...INCOMPLETE_STATE} />
  else if (state.status === 'error') content = <State title={state.title} message={state.message} />
  else content = <State {...LOADING_STATE} busy />

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <TopBar />
      <main aria-busy={state.status === 'loading'} className="flex min-w-0 flex-1 flex-col">
        {content}
      </main>
    </div>
  )
}
