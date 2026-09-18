import { useEffect, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { BTN_QUIET, BTN_SOLID, BoardMark, CAPS, Note, Sheet } from './ui'
import { fetchBoard } from '../../lib/boards-api'
import { plural } from '../../lib/boards'

export default function MoveDialog({ boards, board, card, busy, onClose, onMove }) {
  const [target, setTarget] = useState(null)
  const [columns, setColumns] = useState(null)
  const [listId, setListId] = useState('')
  const [error, setError] = useState(null)

  const others = boards.filter((entry) => entry.id !== board.id && !entry.archived)

  useEffect(() => {
    if (!target) return undefined
    let live = true
    setColumns(null)
    setError(null)
    fetchBoard(target.id).then(
      (result) => {
        if (!live) return
        setColumns(result.board.lists)
        setListId(result.board.lists[0]?.id || '')
      },
      (failure) => live && setError(failure.message),
    )
    return () => {
      live = false
    }
  }, [target])

  return (
    <Sheet
      size="sm"
      title="Move to another board"
      subtitle={
        <>
          <span className="text-ink">{card.title}</span> leaves {board.name}. Its labels stay behind — they belong to this board.
        </>
      }
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="button" disabled={busy || !target || !listId} onClick={() => onMove(target.id, listId)} className={BTN_SOLID}>
            Move card
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Note tone="error">{error}</Note>}

        {others.length === 0 ? (
          <p className="text-[13px] text-ink-muted">There is nowhere else to put it — this is your only active board.</p>
        ) : (
          <>
            <ul className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
              {others.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-pressed={target?.id === entry.id}
                    onClick={() => setTarget(entry)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      target?.id === entry.id ? 'border-line-strong bg-surface-raised' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <BoardMark board={entry} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-ink-strong">{entry.name}</span>
                      <span className="block text-[11px] tabular-nums text-ink-faint">{plural(entry.counts.cards, 'card')}</span>
                    </span>
                    {target?.id === entry.id && <Icon name="check" className="h-4 w-4 shrink-0 text-ink-strong" />}
                  </button>
                </li>
              ))}
            </ul>

            {target && (
              <div className="flex flex-col gap-1.5">
                <span className={CAPS}>Which column</span>
                {columns === null ? (
                  <p className="text-[12.5px] text-ink-faint">Looking…</p>
                ) : columns.length === 0 ? (
                  <p className="text-[12.5px] text-amber-500">That board has no columns yet — add one there first.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {columns.map((column) => (
                      <button
                        key={column.id}
                        type="button"
                        aria-pressed={listId === column.id}
                        onClick={() => setListId(column.id)}
                        className={`h-7 cursor-pointer rounded-lg border px-2 text-[12px] transition-colors ${
                          listId === column.id ? 'border-line-strong bg-surface-raised text-ink-strong' : 'border-line text-ink-subtle hover:border-line-strong'
                        }`}
                      >
                        {column.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
