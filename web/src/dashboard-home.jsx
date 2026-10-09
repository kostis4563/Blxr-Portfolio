import { useEffect, useMemo, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { BoardMark, Dot, Progress, CAPS } from './components/boards/ui'
import { Bone } from './components/skeleton'
import { CommentPin, EditedAgo, FrameLabel, GridToggle, Inspect } from './components/figma'
import { dayWords, gapWords } from './lib/boards-when'
import { ago, plural } from './lib/boards'
import * as api from './lib/boards-api'
import { fetchMyProfile } from './lib/profiles'
import { useNotifications, isUnread } from './lib/notifications'
import { openPalette, isMacLike } from './lib/palette'
import { link, dashboardPath, navigate, profilePath } from './lib/router'
import { toast } from './lib/figma'

const FRAME = 'relative border border-dashed border-line'
const PANEL_HEAD = 'flex items-center gap-2 border-b border-dashed border-line px-4 py-3'
const ROW = 'flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover'

function greeting(hour) {
  if (hour < 5) return 'Up late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function Panel({ frame, title, count, action, children, className = '' }) {
  return (
    <section className={`${FRAME} bg-surface ${className}`}>
      <FrameLabel className="left-0 -top-5">{frame}</FrameLabel>
      <div className={PANEL_HEAD}>
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-strong">{title}</h2>
        {count !== undefined && <span className="text-[11.5px] tabular-nums text-ink-subtle">{count}</span>}
        <span className="flex-1" />
        {action}
      </div>
      {children}
    </section>
  )
}

const More = ({ to, children = 'View all' }) => (
  <a {...link(dashboardPath(to))} className="group inline-flex items-center gap-1 text-[12px] text-ink-muted transition-colors hover:text-ink-strong">
    {children}
    <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
  </a>
)

const Quiet = ({ children }) => <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">{children}</p>

const Rows = ({ n = 3 }) =>
  Array.from({ length: n }, (_, i) => (
    <div key={i} className="flex items-center gap-3 px-4 py-3">
      <Bone className="h-5 w-5" />
      <Bone className="h-2.5 flex-1" />
      <Bone className="h-2.5 w-12" />
    </div>
  ))

function Week({ rows }) {
  const days = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const from = new Date(start)
      from.setDate(start.getDate() + i)
      const to = new Date(from)
      to.setDate(from.getDate() + 1)
      const count = (rows || []).filter((row) => {
        const at = Date.parse(row.due)
        return at >= from && at < to
      }).length
      return { key: i, label: i === 0 ? 'Today' : from.toLocaleDateString(undefined, { weekday: 'short' }), count }
    })
  }, [rows])
  const peak = Math.max(1, ...days.map((d) => d.count))
  const late = (rows || []).filter((row) => Date.parse(row.due) < Date.now()).length

  return (
    <div className="border-b border-dashed border-line px-4 pb-3 pt-4">
      <div className="flex h-16 items-end gap-1.5" role="img" aria-label={`Cards due over the next 7 days: ${days.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
        {days.map((d) => (
          <div key={d.key} className="group/bar flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] tabular-nums text-ink-faint opacity-0 transition-opacity group-hover/bar:opacity-100">{d.count}</span>
            <span
              className={`w-full rounded-[3px] transition-[height] duration-700 ease-out ${
                d.key === 0 ? 'bg-[#0d99ff]' : d.count ? 'bg-ink-strong/25 group-hover/bar:bg-ink-strong/45' : 'bg-line'
              }`}
              style={{ height: rows ? `${Math.max(3, (d.count / peak) * 44)}px` : '3px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {days.map((d) => (
          <span key={d.key} className={`flex-1 text-center text-[10px] ${d.key === 0 ? 'font-medium text-[#0d99ff]' : 'text-ink-faint'}`}>
            {d.label}
          </span>
        ))}
      </div>
      {late > 0 && <p className="mt-2 text-[11px] text-red-500">+ {plural(late, 'card')} already overdue</p>}
    </div>
  )
}

function Toolbar({ guest, handle }) {
  const actions = [
    { id: 'board', icon: 'plus', label: 'New board', to: dashboardPath('boards') },
    !guest && { id: 'message', icon: 'send', label: 'Message', to: dashboardPath('messages') },
    !guest && { id: 'profile', icon: 'pencil', label: 'Edit profile', to: dashboardPath('profile') },
    !guest && handle && { id: 'public', icon: 'eye', label: 'View my page', to: profilePath(handle) },
    { id: 'settings', icon: 'settings', label: 'Settings', to: dashboardPath('settings') },
  ].filter(Boolean)

  return (
    <section className="relative">
      <FrameLabel className="left-0 -top-5">Actions</FrameLabel>
      <div role="toolbar" aria-label="Quick actions" className="flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)]">
        {actions.map((a, i) => (
          <span key={a.id} className="flex items-center">
            {i > 0 && <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-line" />}
            <a
              {...link(a.to)}
              className="group/tool relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-ink-secondary outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:bg-surface-hover"
            >
              <Icon name={a.icon} className="h-3.5 w-3.5 text-ink-subtle transition-colors group-hover/tool:text-[#0d99ff]" />
              {a.label}
            </a>
          </span>
        ))}
      </div>
    </section>
  )
}

function Agenda({ rows }) {
  const now = Date.now()
  if (!rows) return <Rows />
  if (!rows.length) return <Quiet>Nothing due in the next two weeks. Enjoy the quiet.</Quiet>
  return (
    <ul>
      {rows.slice(0, 6).map((row) => {
        const at = Date.parse(row.due)
        const tone = at < now ? 'text-red-500' : at - now < 48 * 3600000 ? 'text-amber-500' : 'text-ink-subtle'
        return (
          <li key={row.card_id}>
            <button type="button" onClick={() => navigate(dashboardPath(`boards/${row.board_id}/${row.card_id}`))} className={ROW}>
              <Dot colour={row.colour} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-secondary">{row.title}</span>
              <span className="hidden shrink-0 text-[11px] text-ink-faint sm:block">{row.board_name}</span>
              <span className={`shrink-0 text-[11.5px] tabular-nums ${tone}`} title={gapWords(at, now)}>
                {dayWords(at, now)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function RecentBoards({ boards }) {
  const now = Date.now()
  if (!boards) return <Rows />
  if (!boards.length) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-[12.5px] text-ink-muted">No boards yet.</p>
        <a {...link(dashboardPath('boards'))} className="mt-2 inline-block text-[12.5px] font-medium text-ink-strong underline decoration-line underline-offset-4 hover:decoration-line-strong">
          Make your first one
        </a>
      </div>
    )
  }
  return (
    <ul>
      {boards.slice(0, 5).map((board) => (
        <li key={board.id}>
          <button type="button" onClick={() => navigate(dashboardPath(`boards/${board.id}`))} className={ROW}>
            <BoardMark board={board} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[12.5px] font-medium text-ink-strong">{board.name}</span>
                {board.pinned && <Icon name="pushpin" className="h-3 w-3 shrink-0 text-ink-faint" />}
              </span>
              <span className="mt-1.5 block max-w-[220px]">
                <Progress done={board.counts.done} total={board.counts.cards} />
              </span>
            </span>
            <span className="shrink-0 text-right text-[11px] tabular-nums text-ink-subtle">
              <span className="block">{board.counts.done}/{board.counts.cards}</span>
              <span className="block text-ink-faint">{ago(board.updated_at, now)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Activity() {
  const feed = useNotifications()
  const now = Date.now()
  if (feed.items === null) return <Rows n={4} />
  if (!feed.items.length) return <Quiet>{feed.failed ? 'Activity could not be loaded.' : 'No activity in the last two weeks.'}</Quiet>
  return (
    <ol className="relative py-1">
      <span aria-hidden="true" className="absolute bottom-4 left-[23px] top-4 border-l border-dashed border-line" />
      {feed.items.slice(0, 6).map((n) => {
        const fresh = isUnread(n, feed)
        return (
          <li key={n.id}>
            <a {...link(dashboardPath(n.path))} className={`${ROW} relative`}>
              <span aria-hidden="true" className={`relative z-[1] h-[9px] w-[9px] shrink-0 rounded-full ring-4 ring-surface ${fresh ? 'bg-[#0d99ff]' : 'bg-line-strong'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[12.5px] ${fresh ? 'font-medium text-ink-strong' : 'text-ink-secondary'}`}>{n.title}</span>
                {n.body && <span className="block truncate text-[11.5px] text-ink-muted">{n.body}</span>}
              </span>
              <time dateTime={new Date(n.at).toISOString()} className="shrink-0 text-[11px] text-ink-subtle">{ago(n.at, now)}</time>
            </a>
          </li>
        )
      })}
    </ol>
  )
}

const PROFILE_STEPS = [
  { id: 'handle', label: 'Claim a handle', done: (p) => Boolean(p.handle) },
  { id: 'avatar', label: 'Add a photo', done: (p) => Boolean(p.avatar) },
  { id: 'headline', label: 'Write a headline', done: (p) => Boolean(p.headline) },
  { id: 'bio', label: 'Tell people about you', done: (p) => Boolean(p.bio) },
  { id: 'links', label: 'Add a link', done: (p) => (p.links || []).length > 0 },
  { id: 'public', label: 'Make it public', done: (p) => p.visibility === 'public' },
]

function ProfileProgress({ profile }) {
  if (profile === undefined) return <Rows n={3} />
  const held = profile || {}
  const steps = PROFILE_STEPS.map((step) => ({ ...step, ok: step.done(held) }))
  const done = steps.filter((s) => s.ok).length
  const share = Math.round((done / steps.length) * 100)
  const r = 22
  const c = 2 * Math.PI * r

  return (
    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <Inspect size="56 × 56">
        <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" role="img" aria-label={`Profile ${share}% complete`}>
          <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" className="stroke-line" />
          <circle
            cx="28"
            cy="28"
            r={r}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - done / steps.length)}
            className="stroke-ink-strong transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
      </Inspect>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink-strong">
          <span className="font-semibold tabular-nums">{share}%</span> of your public page is set up
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {steps.map((step) => (
            <li
              key={step.id}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                step.ok ? 'border-line text-ink-faint line-through' : 'border-line-strong text-ink-secondary'
              }`}
            >
              {step.ok && <Icon name="check" className="h-3 w-3" />}
              {step.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Shortcuts() {
  const [mod, setMod] = useState('⌘')
  useEffect(() => setMod(isMacLike() ? '⌘' : 'Ctrl'), [])
  const keys = [
    { keys: [mod, 'K'], label: 'Search everything', run: openPalette },
    { keys: [mod, 'B'], label: 'Collapse the sidebar' },
    { keys: ['⇧', 'G'], label: 'Layout grid' },
    { keys: ['Esc'], label: 'Close menus and dialogs' },
  ]
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2">
      {keys.map((k) => (
        <li key={k.label} className="border-b border-dashed border-line last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0">
          <button
            type="button"
            onClick={k.run || (() => toast(k.label, k.keys.join(' ')))}
            className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-[12.5px] text-ink-secondary transition-colors hover:bg-surface-hover"
          >
            {k.label}
            <span className="flex gap-1">
              {k.keys.map((key) => (
                <kbd key={key} className="min-w-[22px] rounded-md border border-line bg-bg px-1.5 py-0.5 text-center font-sans text-[11px] text-ink-subtle">
                  {key}
                </kbd>
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function DashboardHome({ user, guest }) {
  const [boards, setBoards] = useState(null)
  const [agenda, setAgenda] = useState(null)
  const [profile, setProfile] = useState(undefined)
  const [now] = useState(() => new Date())

  useEffect(() => {
    let alive = true
    api.fetchBoards(false).then((next) => alive && setBoards(next), () => alive && setBoards([]))
    api.fetchAgenda(14).then((next) => alive && setAgenda(next), () => alive && setAgenda([]))
    if (!guest) fetchMyProfile(user.id).then((next) => alive && setProfile(next), () => alive && setProfile(null))
    return () => {
      alive = false
    }
  }, [user.id, guest])

  const totals = useMemo(() => {
    if (!boards) return null
    return boards.reduce(
      (sum, b) => ({
        cards: sum.cards + b.counts.cards,
        done: sum.done + b.counts.done,
        overdue: sum.overdue + b.counts.overdue,
        soon: sum.soon + b.counts.soon,
      }),
      { cards: 0, done: 0, overdue: 0, soon: 0 },
    )
  }, [boards])

  const first = user.name.split(' ')[0]
  const open = totals ? totals.cards - totals.done : null
  const date = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col gap-10 pt-5 animate-rise-in">
      <section className={`${FRAME} px-5 py-6 sm:px-7`}>
        <FrameLabel className="left-0 -top-5">Overview</FrameLabel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Inspect size="56 × 56">
              {user.avatar ? (
                <img src={user.avatar} alt="" width="56" height="56" draggable={false} className="h-14 w-14 rounded-[16px] object-cover" />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-surface-raised text-[20px] font-semibold text-ink-strong">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </Inspect>
            <div className="min-w-0">
              <p className="text-[12px] text-ink-subtle">{date}</p>
              <h1 className="mt-0.5 flex items-center gap-2 text-[20px] font-semibold leading-tight tracking-tight text-ink-strong">
                {greeting(now.getHours())}, {first}
                <CommentPin
                  name="Kostis"
                  initial="K"
                  time="now"
                  text={guest ? 'Claim your account to keep your boards for good.' : 'Press ⌘K anywhere to jump around.'}
                />
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GridToggle className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[9px] border border-line bg-surface px-2.5 text-ink-muted transition-colors hover:border-line-strong hover:text-ink-strong aria-pressed:border-[#0d99ff] aria-pressed:text-[#0d99ff]" />
            <a
              {...link(dashboardPath('boards'))}
              data-component="Button / Primary"
              className="project-cta group inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-surface-inverted pl-3 pr-2.5 text-[12.5px] font-medium text-ink-on-inverted outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
            >
              Open boards
              <span className="project-arrow inline-block" aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <p className="mt-5 max-w-[60ch] text-[13.5px] leading-[1.6] text-ink-muted">
          {totals === null
            ? 'Pulling your boards together…'
            : totals.overdue > 0
              ? `${plural(totals.overdue, 'card')} slipped past due. Start there, then work through the ${open} still open.`
              : open > 0
                ? `${plural(open, 'card')} open across ${plural(boards.length, 'board')}, and nothing overdue. Nice.`
                : 'Every card is done. Time to start something new.'}
        </p>
      </section>

      <Toolbar guest={guest} handle={profile?.handle} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel frame="Agenda" title="Coming up" count={agenda?.length || undefined} action={<More to="boards" />}>
          <Week rows={agenda} />
          <Agenda rows={agenda} />
        </Panel>
        <Panel frame="Boards" title="Recently touched" count={boards?.length || undefined} action={<More to="boards" />}>
          <RecentBoards boards={boards} />
        </Panel>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel frame="Activity" title="Recent activity" action={<span className={CAPS}>14 days</span>}>
          <Activity />
        </Panel>
        <div className="flex flex-col gap-10">
          {!guest && (
            <Panel frame="Profile" title="Your public page" action={<More to="profile">Edit</More>}>
              <ProfileProgress profile={profile} />
            </Panel>
          )}
          <Panel frame="Shortcuts" title="Keyboard">
            <Shortcuts />
          </Panel>
        </div>
      </div>

      <p className="flex items-center text-[11.5px] text-ink-faint">
        <span>blxr / Dashboard</span>
        <EditedAgo />
      </p>
    </div>
  )
}
