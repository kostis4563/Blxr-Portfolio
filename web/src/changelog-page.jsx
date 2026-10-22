import { useEffect, useMemo, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { link, HOME_PATH, PROJECTS_PATH, STATUS_PATH } from './lib/router'
import { relativeTime, absoluteTime } from './lib/reviews'
import { GITHUB_URL, GITHUB_USERNAME } from './lib/profile'
import {
  fetchChangelog,
  describeError,
  groupChangelog,
  timelineOf,
  monthOf,
  sizeOf,
  kindCounts,
  dayHeading,
  rangeHeading,
  monthHeading,
  shortDateOf,
  dateOf,
  timeOf,
  formatLines,
  spanDays,
  commitUrl,
  CHANGELOG_INTRO,
  KINDS,
  PAGE_DAYS,
} from './lib/changelog'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'

const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

const BUTTON = `inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface-raised px-4 text-[13px] font-medium text-ink-secondary transition-colors duration-200 hover:border-line-strong hover:text-ink-strong ${RING}`

const ROW = 'grid grid-cols-1 gap-3 border-t border-dashed border-line first:border-t-0 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-6'

const CSS = `
.changelog-ui{--added:#10b981;--fixed:#f59e0b;--changed:#818cf8;--removed:#f87171;--security:#c084fc}
:root[data-theme='light'] .changelog-ui{--added:#047857;--fixed:#b45309;--changed:#4f46e5;--removed:#b91c1c;--security:#7e22ce}
.kind-ink[data-kind=added]{color:var(--added)}
.kind-ink[data-kind=fixed]{color:var(--fixed)}
.kind-ink[data-kind=changed]{color:var(--changed)}
.kind-ink[data-kind=removed]{color:var(--removed)}
.kind-ink[data-kind=security]{color:var(--security)}
.kind-dot{background:var(--color-line-strong)}
.kind-dot[data-kind=added]{background:var(--added)}
.kind-dot[data-kind=fixed]{background:var(--fixed)}
.kind-dot[data-kind=changed]{background:var(--changed)}
.kind-dot[data-kind=removed]{background:var(--removed)}
.kind-dot[data-kind=security]{background:var(--security)}
`

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.id, k.label]))

const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

function useChangelog() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchChangelog({ signal: controller.signal })
      .then((next) => {
        setData(next)
        setNow(Date.now())
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err)
      })
    return () => controller.abort()
  }, [attempt])

  const retry = () => {
    setError(null)
    setAttempt((n) => n + 1)
  }

  return { data, error, now, retry }
}

function Breakdown({ counts }) {
  return (
    <ul aria-label="Changes by kind" className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-muted animate-rise-in" style={{ animationDelay: '180ms' }}>
      {KINDS.filter((k) => counts[k.id]).map((k) => (
        <li key={k.id} className="inline-flex items-center gap-2">
          <span aria-hidden="true" data-kind={k.id} className="kind-dot h-2 w-2 rounded-full" />
          <span className="font-medium tabular-nums text-ink-secondary">{counts[k.id]}</span>
          <span>{k.label.toLowerCase()}</span>
        </li>
      ))}
    </ul>
  )
}

function CommitLink({ repo, sha }) {
  return (
    <a
      href={commitUrl(repo, sha)}
      target="_blank"
      rel="noreferrer"
      aria-label={`Commit ${sha.slice(0, 7)} on GitHub (opens in a new tab)`}
      className={`group/sha inline-flex items-center gap-0.5 rounded transition-colors duration-200 hover:text-ink-strong ${RING}`}
    >
      <span>{sha.slice(0, 7)}</span>
      <span aria-hidden="true" className="transition-transform duration-200 group-hover/sha:translate-x-0.5 group-hover/sha:-translate-y-0.5">↗</span>
    </a>
  )
}

function Entry({ entry, repo }) {
  return (
    <li className="relative">
      <span aria-hidden="true" data-kind={entry.kind} className="kind-dot absolute -left-[21px] top-[5px] h-[9px] w-[9px] rounded-full ring-4 ring-bg" />
      <p className="break-words text-[14px] leading-snug text-ink-strong">{entry.text}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-ink-subtle">
        <span data-kind={entry.kind} className="kind-ink text-[10.5px] uppercase tracking-wider">{KIND_LABEL[entry.kind]}</span>
        <CommitLink repo={repo} sha={entry.sha} />
        {(entry.additions > 0 || entry.deletions > 0) && (
          <span className="inline-flex gap-1.5 tabular-nums" aria-label={`${entry.additions} lines added, ${entry.deletions} removed`}>
            {entry.additions > 0 && <span data-kind="added" className="kind-ink">+{formatLines(entry.additions)}</span>}
            {entry.deletions > 0 && <span data-kind="removed" className="kind-ink">−{formatLines(entry.deletions)}</span>}
          </span>
        )}
        <time dateTime={entry.date} title={absoluteTime(entry.date)}>{timeOf(entry.date)}</time>
      </p>
    </li>
  )
}

function Untitled({ commits, repos, label, showRepo, withDate }) {
  return (
    <details className="group/quiet">
      <summary className={`inline-flex cursor-pointer list-none items-center gap-1 rounded text-[12.5px] text-ink-subtle transition-colors duration-200 hover:text-ink-strong [&::-webkit-details-marker]:hidden ${RING}`}>
        <span>{label}</span>
        <Icon name="chevronRight" className="h-3.5 w-3.5 transition-transform duration-200 group-open/quiet:rotate-90" strokeWidth={2} />
      </summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {commits.map((commit) => (
          <li key={commit.sha} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-ink-subtle">
            <span className="text-ink-muted">“{commit.message}”</span>
            {showRepo && <span>{commit.repo}</span>}
            <CommitLink repo={repos.get(commit.repo)} sha={commit.sha} />
            <time dateTime={commit.date} title={absoluteTime(commit.date)}>
              {withDate ? `${shortDateOf(commit.date)}, ${timeOf(commit.date)}` : timeOf(commit.date)}
            </time>
          </li>
        ))}
      </ul>
    </details>
  )
}

function RepoGroup({ group, repos, showRepo }) {
  const repo = repos.get(group.repo)
  return (
    <div className="min-w-0">
      {showRepo && (
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          className={`group/repo mb-3 inline-flex items-center gap-2 rounded text-[12.5px] font-medium text-ink-secondary transition-colors duration-200 hover:text-ink-strong ${RING}`}
        >
          <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full border border-line-strong" style={repo.language?.color ? { background: repo.language.color, borderColor: repo.language.color } : undefined} />
          <span>{repo.name}</span>
          <span aria-hidden="true" className="text-ink-faint transition-transform duration-200 group-hover/repo:translate-x-0.5 group-hover/repo:-translate-y-0.5">↗</span>
        </a>
      )}
      <ul className="ml-1 flex flex-col gap-4 border-l border-line pl-4">
        {group.entries.map((entry) => (
          <Entry key={entry.sha} entry={entry} repo={repo} />
        ))}
        {group.quiet.length > 0 && (
          <li className="relative">
            <span aria-hidden="true" className="absolute -left-[20px] top-[6px] h-[7px] w-[7px] rounded-full border border-line-strong bg-bg" />
            <Untitled
              commits={group.quiet}
              repos={repos}
              label={group.entries.length ? `+ ${plural(group.quiet.length, 'untitled commit', 'untitled commits')}` : plural(group.quiet.length, 'untitled commit', 'untitled commits')}
            />
          </li>
        )}
      </ul>
    </div>
  )
}

function DayRow({ item, repos, showRepo, now }) {
  return (
    <li className={`${ROW} py-6`}>
      <h3 className={`${KICKER} tracking-[0.14em] sm:sticky sm:top-20 sm:self-start sm:pt-0.5`}>
        <time dateTime={item.day}>{dayHeading(item.day, now)}</time>
      </h3>
      <div className="flex min-w-0 flex-col gap-6">
        {item.groups.map((group) => (
          <RepoGroup key={group.repo} group={group} repos={repos} showRepo={showRepo} />
        ))}
      </div>
    </li>
  )
}

function QuietRow({ item, repos, showRepo, now }) {
  const names = [...new Set(item.commits.map((c) => c.repo))]
  return (
    <li className={`${ROW} py-3.5`}>
      <h3 className={`${KICKER} tracking-[0.14em] text-ink-faint sm:pt-0.5`}>
        <time dateTime={item.to}>{rangeHeading(item.from, item.to, now)}</time>
      </h3>
      <Untitled
        commits={item.commits}
        repos={repos}
        showRepo={showRepo}
        withDate={item.from !== item.to}
        label={`${plural(item.commits.length, 'untitled commit', 'untitled commits')}${showRepo ? ` · ${names.join(', ')}` : ''}`}
      />
    </li>
  )
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="w-full">
      <div className="h-4 w-32 rounded skeleton" />
      <div className="mt-3 border-t border-line" />
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${ROW} py-6`}>
          <div className="h-3 w-20 rounded skeleton" />
          <div className="ml-1 flex flex-col gap-5 border-l border-line pl-4">
            {[0, 1].map((j) => (
              <div key={j}>
                <div className="h-3.5 w-3/4 rounded skeleton" />
                <div className="mt-2 h-2.5 w-40 rounded skeleton" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Failed({ error, onRetry }) {
  return (
    <section role="alert" className="flex w-full flex-col gap-4 rounded-2xl border border-line bg-surface-raised px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted">
          <Icon name="alert" className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold tracking-tight text-ink-strong">The changelog did not load</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">{describeError(error)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onRetry} className={BUTTON}>
          <Icon name="refresh" className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Try again</span>
        </button>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={BUTTON}>
          <span>GitHub</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  )
}

function Timeline({ data, repos, now }) {
  const [shown, setShown] = useState(PAGE_DAYS)
  const days = useMemo(() => groupChangelog(data.commits), [data])
  const items = useMemo(() => timelineOf(days), [days])
  const monthChanges = useMemo(() => {
    const totals = new Map()
    for (const day of days) totals.set(day.day.slice(0, 7), (totals.get(day.day.slice(0, 7)) || 0) + day.changes)
    return totals
  }, [days])
  const showRepo = data.repos.length > 1

  if (!items.length) {
    return <p className="w-full border-t border-dashed border-line pt-5 text-[13px] text-ink-muted">No public commits in this window yet.</p>
  }

  const months = []
  for (const item of items.slice(0, shown)) {
    if (months.at(-1)?.month !== monthOf(item)) months.push({ month: monthOf(item), items: [] })
    months.at(-1).items.push(item)
  }
  const left = items.slice(shown).reduce((n, item) => n + sizeOf(item), 0)

  return (
    <div className="flex w-full flex-col gap-12 animate-rise-in" style={{ animationDelay: '240ms' }}>
      {months.map(({ month, items: monthItems }) => {
        const changes = monthChanges.get(month) || 0
        return (
          <section key={month} aria-labelledby={`month-${month}`} className="w-full">
            <h2 id={`month-${month}`} className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink-strong">{monthHeading(month)}</span>
              <span className="font-mono text-[11px] text-ink-subtle">{changes ? plural(changes, 'change', 'changes') : 'quiet month'}</span>
            </h2>
            <ol className="flex flex-col">
              {monthItems.map((item) =>
                item.type === 'day'
                  ? <DayRow key={item.day} item={item} repos={repos} showRepo={showRepo} now={now ?? Date.now()} />
                  : <QuietRow key={`q-${item.to}`} item={item} repos={repos} showRepo={showRepo} now={now ?? Date.now()} />,
              )}
            </ol>
          </section>
        )
      })}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-dashed border-line pt-6">
        {left > 0 ? (
          <button type="button" onClick={() => setShown((n) => n + PAGE_DAYS)} className={BUTTON}>
            <span>Show older</span>
            <span className="font-mono text-[11px] text-ink-subtle">{plural(left, 'commit', 'commits')} left</span>
          </button>
        ) : (
          <p className="text-[13px] text-ink-muted">
            That is everything since <time dateTime={data.since}>{dateOf(data.since)}</time>. Older history lives on{' '}
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={`rounded underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:text-ink-strong ${RING}`}>
              GitHub
            </a>
            .
          </p>
        )}
      </div>
    </div>
  )
}

export default function ChangelogPage({ theme, onToggleTheme }) {
  const { data, error, now, retry } = useChangelog()

  const repos = useMemo(() => new Map((data?.repos ?? []).map((r) => [r.name, r])), [data])
  const counts = useMemo(() => (data ? kindCounts(data.commits) : null), [data])
  const days = data?.since ? spanDays(data.since, now ?? Date.now()) : null

  return (
    <div className="changelog-ui min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <style>{CSS}</style>
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

      <main className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-20 flex flex-col items-start gap-8 min-h-screen bg-bg">
        <div className="w-full flex flex-col gap-3 text-left sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[580px]">
            <p className={`${KICKER} mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 animate-rise-in`}>
              <span>/ changelog</span>
              <span aria-hidden="true">·</span>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={`rounded normal-case tracking-normal transition-colors duration-200 hover:text-ink-strong ${RING}`}>
                github.com/{GITHUB_USERNAME} ↗
              </a>
            </p>
            <h1 className="text-[32px] sm:text-[36px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-2 animate-rise-in" style={{ animationDelay: '60ms' }}>
              Changelog
            </h1>
            <p className="text-[14.5px] sm:text-[15px] text-ink-muted font-normal leading-relaxed animate-rise-in" style={{ animationDelay: '120ms' }}>
              {CHANGELOG_INTRO}
            </p>
          </div>
          {data?.fetchedAt && (
            <dl aria-live="polite" className="flex shrink-0 flex-col gap-1 text-[12px] text-ink-subtle sm:items-end animate-rise-in">
              <div className="flex items-center gap-2">
                <dt className="font-mono uppercase tracking-wider text-[10.5px]">Synced</dt>
                <dd>
                  <time dateTime={data.fetchedAt} title={absoluteTime(data.fetchedAt)}>
                    {relativeTime(data.fetchedAt, now ?? Date.now())}
                  </time>
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="sr-only">Covers</dt>
                <dd>
                  {plural(data.commits.length, 'commit', 'commits')} · {plural(data.repos.length, 'repo', 'repos')}
                  {days ? ` · ${plural(days, 'day', 'days')}` : ''}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {error && !data && <Failed error={error} onRetry={retry} />}

        {data && data.commits.length > 0 && <Breakdown counts={counts} />}

        {data ? <Timeline data={data} repos={repos} now={now} /> : !error && <Skeleton />}

        <footer className="w-full max-w-[640px] border-t border-dashed border-line pt-7">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            How this works: every ten minutes the kostis.wtf server asks GitHub for the default branch of each public repository I own (forks aside) and keeps the last six months. Merges and bot commits (Dependabot and friends) are left out, private repositories never leave the server, and commits whose message is a single word or a stray dot are tucked away as untitled instead of hidden. The Added / Fixed / Changed labels are read from the wording of each message, so the odd one lands in the wrong pile.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(PROJECTS_PATH)} className={FOOT_LINK}>
              <span>The projects</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(STATUS_PATH)} className={FOOT_LINK}>
              <span>Is it up?</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={FOOT_LINK}>
              <span>Everything on GitHub</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
