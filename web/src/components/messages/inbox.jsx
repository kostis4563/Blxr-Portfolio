import { useMemo, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { Empty, SearchField } from '../boards/ui'
import { Face } from './ui'
import { inboxMatches, inboxTime, previewOf } from '../../lib/messages'

function Row({ row, active, onOpen }) {
  const unread = row.unread > 0
  const last = row.last_at
    ? previewOf({ body: row.last_body, files: row.last_files || 0 })
    : 'No messages yet'

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(row.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors ${
          active ? 'bg-surface-raised' : 'hover:bg-surface-hover'
        }`}
      >
        <Face name={row.name} avatar={row.avatar} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-[13px] ${unread ? 'font-semibold text-ink-strong' : 'font-medium text-ink-strong'}`}>{row.name}</span>
            {row.last_at && <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-faint">{inboxTime(row.last_at)}</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={`min-w-0 flex-1 truncate text-[12px] ${unread ? 'text-ink-secondary' : 'text-ink-subtle'}`}>
              {row.last_at && row.last_from_owner && <span className="text-ink-faint">You: </span>}
              {last}
            </span>
            {unread && (
              <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-ink-strong px-1.5 font-mono text-[10.5px] font-semibold tabular-nums text-ink-inverse">
                {row.unread > 99 ? '99+' : row.unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

export default function Inbox({ rows, activeId, onOpen }) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => rows.filter((row) => inboxMatches(row, query)), [rows, query])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
        <SearchField value={query} onChange={setQuery} placeholder="Search people" className="flex-1" />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <Icon name="inbox" className="h-5 w-5 text-ink-faint" />
          <p className="text-[13px] font-semibold tracking-tight text-ink-strong">Nobody has written yet</p>
          <p className="max-w-[240px] text-[12px] leading-relaxed text-ink-muted">Every account gets a private line to you. When someone uses theirs, it shows up here.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="p-3">
          <Empty icon="search" title="No one matches" body="Try a name, a handle or an email." />
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto overscroll-contain">
          {shown.map((row) => (
            <Row key={row.id} row={row} active={row.id === activeId} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </div>
  )
}
