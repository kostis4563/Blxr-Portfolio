import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import {
  BTN_BARE,
  BTN_QUIET,
  BTN_SOLID,
  INPUT,
  Menu,
  MenuItem,
  MenuLabel,
  MenuLine,
  Dot,
  Note,
  Progress,
  Tag,
  Sheet,
  StoredImage,
} from './ui'
import { NoteEditor, NoteSheet, NotesBody } from './notes'
import { WhenField } from './when-picker'
import Viewer from './viewer'
import { DUE_TONE, LIMITS, ago, dueState, sizeWords } from '../../lib/boards'
import { clock } from '../../lib/boards-when'
import { FILES_MAX, FILE_TYPES, isImage, readAttachment } from '../../lib/boards-files'
import { downloadFile } from '../../lib/boards-api'

const ACTIVITY = {
  created: 'made this card',
  moved: 'moved it to another column',
  attached: 'attached a file',
  transferred: 'moved it from another board',
  copied: 'copied it from another card',
}

function Fold({ label, icon, count, children, start = false, show = false }) {
  const [open, setOpen] = useState(start || show)
  return (
    <section className="border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((held) => !held)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 text-left"
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <Icon name={icon} className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          <span className="text-[12px] font-medium text-ink-strong">{label}</span>
          {count > 0 && <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">{count}</span>}
        </button>
      </div>
      {open && <div className="mt-2">{children}</div>}
    </section>
  )
}

function LabelPicker({ board, card, canWrite, actions }) {
  const worn = card.labels || []
  const labels = board.labels || []

  return (
    <Menu
      label="Labels"
      width="w-64"
      trigger={({ toggle }) => (
        <button type="button" disabled={!canWrite} onClick={toggle} className={BTN_QUIET}>
          <Icon name="tag" className="h-3.5 w-3.5" />
          Labels
        </button>
      )}
    >
      {labels.length === 0 && <p className="px-2.5 py-3 text-[12.5px] text-ink-muted">No labels on this board yet. Add some from board settings.</p>}
      {labels.map((label) => (
        <MenuItem
          key={label.id}
          keepOpen
          checked={worn.includes(label.id)}
          onClick={() =>
            actions.card.set(card, {
              labels: worn.includes(label.id) ? worn.filter((id) => id !== label.id) : [...worn, label.id],
            })
          }
        >
          <span className="flex items-center gap-2">
            <Dot colour={label.colour} />
            <span className="truncate">{label.name}</span>
          </span>
        </MenuItem>
      ))}
    </Menu>
  )
}

function Checklist({ card, canWrite, actions }) {
  const steps = card.checklist || []
  const ticked = steps.filter((step) => step.done).length
  const [adding, setAdding] = useState('')
  const [editing, setEditing] = useState(null)
  const field = useRef(null)

  const add = () => {
    const cleaned = adding.trim()
    if (!cleaned) return
    actions.card.step.add(card, cleaned)
    setAdding('')
    field.current?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      {steps.length > 0 && (
        <div className="flex items-center gap-2.5">
          <span className="flex-1">
            <Progress done={ticked} total={steps.length} />
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
            {ticked}/{steps.length}
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-0.5">
        {steps.map((step, index) => (
          <li key={step.id} className="group/step flex items-start gap-2 rounded-md px-1 py-1 transition-colors hover:bg-surface-hover">
            <button
              type="button"
              role="checkbox"
              aria-checked={step.done}
              disabled={!canWrite}
              onClick={() => actions.card.step.set(card, step.id, { done: !step.done })}
              className="mt-px shrink-0 cursor-pointer disabled:cursor-default"
            >
              <Icon name={step.done ? 'squareCheck' : 'square'} className={`h-4 w-4 ${step.done ? 'text-ink-strong' : 'text-ink-faint'}`} />
            </button>

            {editing === step.id ? (
              <input
                autoFocus
                defaultValue={step.text}
                maxLength={LIMITS.step}
                onBlur={(event) => {
                  const next = event.target.value.trim()
                  setEditing(null)
                  if (next && next !== step.text) actions.card.step.set(card, step.id, { text: next })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') setEditing(null)
                }}
                className={`${INPUT} h-7 flex-1`}
              />
            ) : (
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => setEditing(step.id)}
                className={`min-w-0 flex-1 cursor-text text-left text-[13px] leading-snug disabled:cursor-default ${step.done ? 'text-ink-faint line-through' : 'text-ink'}`}
              >
                {step.text}
              </button>
            )}

            {canWrite && editing !== step.id && (
              <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/step:opacity-100 max-sm:opacity-100">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => actions.card.step.move(card, step.id, index - 1)}
                  className="cursor-pointer rounded p-0.5 text-ink-faint hover:text-ink-strong disabled:opacity-30"
                >
                  <Icon name="chevronsUpDown" className="h-3 w-3" />
                </button>
                <button type="button" aria-label="Remove step" onClick={() => actions.card.step.remove(card, step.id)} className="cursor-pointer rounded p-0.5 text-ink-faint hover:text-red-500">
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {canWrite && steps.length < LIMITS.steps && (
        <div className="flex items-center gap-2">
          <input
            ref={field}
            value={adding}
            maxLength={LIMITS.step}
            placeholder="Add a step"
            onChange={(event) => setAdding(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
            className={`${INPUT} h-7 flex-1`}
          />
          <button type="button" disabled={!adding.trim()} onClick={add} className={`${BTN_QUIET} h-7`}>
            Add
          </button>
        </div>
      )}
    </div>
  )
}

function Comments({ card, canWrite, actions }) {
  const comments = card.comments || []
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(null)

  const send = () => {
    const cleaned = draft.trim()
    if (!cleaned) return
    actions.card.comment.add(card, cleaned)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-3">
      {canWrite && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-2">
          <textarea
            rows={2}
            value={draft}
            maxLength={LIMITS.comment}
            placeholder="Leave a note for later…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                send()
              }
            }}
            className="w-full resize-y bg-transparent text-[13px] leading-relaxed text-ink-strong outline-none placeholder:text-ink-faint"
          />
          <div className="flex items-center gap-2">
            <button type="button" disabled={!draft.trim()} onClick={send} className={BTN_SOLID}>
              Comment
            </button>
            <span className="ml-auto text-[10.5px] text-ink-faint">⌘↵ to post</span>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {[...comments].reverse().map((entry) => (
          <li key={entry.id} className="group/note rounded-lg border border-line bg-surface-raised/40 p-2.5">
            {editing === entry.id ? (
              <textarea
                autoFocus
                rows={3}
                defaultValue={entry.body}
                maxLength={LIMITS.comment}
                onBlur={(event) => {
                  const next = event.target.value.trim()
                  setEditing(null)
                  if (next && next !== entry.body) actions.card.comment.edit(card, entry.id, next)
                }}
                onKeyDown={(event) => event.key === 'Escape' && setEditing(null)}
                className="w-full resize-y bg-transparent text-[13px] leading-relaxed text-ink-strong outline-none"
              />
            ) : (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{entry.body}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-faint">
              <span title={clock(Date.parse(entry.at))}>{ago(entry.at, actions.now)}</span>
              {entry.edited && <span>· edited</span>}
              {canWrite && editing !== entry.id && (
                <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover/note:opacity-100 max-sm:opacity-100">
                  <button type="button" onClick={() => setEditing(entry.id)} className="cursor-pointer hover:text-ink-strong">
                    Edit
                  </button>
                  <button type="button" onClick={() => actions.card.comment.remove(card, entry.id)} className="cursor-pointer hover:text-red-500">
                    Delete
                  </button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!comments.length && !canWrite && <p className="text-[12.5px] text-ink-faint">Nothing said yet.</p>}
    </div>
  )
}

function Links({ card, canWrite, actions }) {
  const links = card.links || []
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  const add = () => {
    const cleanUrl = url.trim()
    if (!cleanUrl) return
    const full = cleanUrl.includes('://') ? cleanUrl : `https://${cleanUrl}`
    actions.card.link.add(card, label.trim() || full.replace(/^https?:\/\//, '').slice(0, LIMITS.linkLabel), full)
    setLabel('')
    setUrl('')
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {links.map((entry) => (
          <li key={entry.id} className="group/link flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-surface-hover">
            <Icon name="link" className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
            <a href={entry.url} target="_blank" rel="noreferrer noopener" title={entry.url} className="min-w-0 flex-1 truncate text-[12.5px] text-ink-strong underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-ink-strong">
              {entry.label}
            </a>
            {canWrite && (
              <button
                type="button"
                aria-label={`Remove ${entry.label}`}
                onClick={() => actions.card.link.remove(card, entry.id)}
                className="shrink-0 cursor-pointer rounded p-0.5 text-ink-faint opacity-0 transition-opacity hover:text-red-500 group-hover/link:opacity-100 max-sm:opacity-100"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canWrite && links.length < LIMITS.links && (
        <div className="flex flex-wrap items-center gap-2">
          <input value={label} maxLength={LIMITS.linkLabel} placeholder="Label (optional)" onChange={(event) => setLabel(event.target.value)} className={`${INPUT} h-7 w-[150px]`} />
          <input
            value={url}
            maxLength={LIMITS.linkUrl}
            placeholder="https://…"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
            className={`${INPUT} h-7 min-w-[160px] flex-1`}
          />
          <button type="button" disabled={!url.trim()} onClick={add} className={`${BTN_QUIET} h-7`}>
            Add
          </button>
        </div>
      )}
    </div>
  )
}

function Files({ card, canWrite, actions, onView }) {
  const files = card.files || []
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [over, setOver] = useState(false)
  const field = useRef(null)

  const take = useCallback(
    async (list) => {
      const picked = [...(list || [])].slice(0, FILES_MAX - files.length)
      if (!picked.length) return
      setError(null)
      setBusy(true)
      try {
        let held = card
        for (const file of picked) {
          held = await actions.card.file.add(held, await readAttachment(file))
        }
      } catch (failure) {
        setError(failure.message)
      } finally {
        setBusy(false)
      }
    },
    [actions.card.file, card, files.length],
  )

  useEffect(() => {
    if (!canWrite) return undefined
    const onPaste = (event) => {
      const items = [...(event.clipboardData?.items || [])].filter((item) => item.kind === 'file')
      if (!items.length) return
      const picked = items.map((item) => item.getAsFile()).filter(Boolean)
      if (picked.length) {
        event.preventDefault()
        take(picked)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [canWrite, take])

  const full = files.length >= FILES_MAX

  return (
    <div
      onDragOver={(event) => {
        if (!canWrite || full) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!canWrite || full) return
        event.preventDefault()
        setOver(false)
        take(event.dataTransfer.files)
      }}
      className={`flex flex-col gap-2 rounded-lg ${over ? 'outline-2 outline-dashed outline-offset-4 outline-ink-strong/40' : ''}`}
    >
      {error && <Note tone="error" onDismiss={() => setError(null)}>{error}</Note>}

      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((entry) => (
            <li key={entry.id} className="group/file relative overflow-hidden rounded-lg border border-line bg-surface">
              <button
                type="button"
                onClick={() => (isImage(entry) ? onView(entry.id) : downloadFile(entry))}
                className="block w-full cursor-pointer text-left"
              >
                {isImage(entry) ? (
                  <StoredImage path={entry.thumb || entry.path} alt={entry.name} className="h-24 w-full object-cover" />
                ) : (
                  <span className="grid h-24 w-full place-items-center bg-surface-raised text-ink-faint">
                    <Icon name="file" className="h-7 w-7" />
                  </span>
                )}
                <span className="block px-2 py-1.5">
                  <span className="block truncate text-[11.5px] text-ink">{entry.name}</span>
                  <span className="block text-[10.5px] text-ink-faint">{sizeWords(entry.bytes)}</span>
                </span>
              </button>
              {canWrite && (
                <span className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover/file:opacity-100 max-sm:opacity-100">
                  <button type="button" aria-label={`Download ${entry.name}`} onClick={() => downloadFile(entry)} className="cursor-pointer rounded border border-line bg-surface/90 p-1 text-ink-muted hover:text-ink-strong">
                    <Icon name="download" className="h-3 w-3" />
                  </button>
                  <button type="button" aria-label={`Remove ${entry.name}`} onClick={() => actions.card.file.remove(card, entry.id)} className="cursor-pointer rounded border border-line bg-surface/90 p-1 text-ink-muted hover:text-red-500">
                    <Icon name="trash" className="h-3 w-3" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <>
          <button type="button" disabled={busy || full} onClick={() => field.current?.click()} className={BTN_QUIET}>
            <Icon name={busy ? 'refresh' : 'upload'} className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Uploading…' : full ? `${FILES_MAX} files is the limit` : 'Attach a file'}
          </button>
          <p className="text-[11px] text-ink-faint">Drop files here, paste a screenshot, or pick one. Images, GIFs and PDFs up to 4 MB — anything larger is resized where it can be.</p>
          <input ref={field} type="file" multiple accept={FILE_TYPES.join(',')} className="sr-only" onChange={(event) => take(event.target.files)} />
        </>
      )}
    </div>
  )
}

export default function CardDialog({ board, card, cards, canWrite, actions, error, onClose, onSend }) {
  const [title, setTitle] = useState(card.title)
  const [notes, setNotes] = useState(card.notes || '')
  const [writing, setWriting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    setTitle(card.title)
    setNotes(card.notes || '')
    setWriting(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  const column = board.lists.find((list) => list.id === card.list_id)
  const labels = (board.labels || []).filter((label) => (card.labels || []).includes(label.id))
  const due = dueState(card, actions.now)
  const shots = (card.files || []).filter(isImage)
  const viewingAt = viewing ? shots.findIndex((entry) => entry.id === viewing) : -1

  const rank = useMemo(() => {
    const row = cards
      .filter((entry) => entry.list_id === card.list_id && Boolean(entry.archived) === Boolean(card.archived))
      .sort((a, b) => a.position - b.position)
    return row.findIndex((entry) => entry.id === card.id) + 1
  }, [cards, card.id, card.list_id, card.archived])

  const commitTitle = () => {
    const cleaned = title.trim()
    if (!cleaned) {
      setTitle(card.title)
      return
    }
    if (cleaned !== card.title) actions.card.set(card, { title: cleaned })
  }

  return (
    <>
      <Sheet
        size="lg"
        onClose={onClose}
        busy={actions.busy}
        head={
          shots.length > 0 ? (
            <button type="button" onClick={() => setViewing(shots[0].id)} className="block h-40 w-full cursor-zoom-in overflow-hidden border-b border-line">
              <StoredImage path={shots[0].path} alt="" className="h-full w-full object-cover" />
            </button>
          ) : null
        }
        title={
          canWrite ? (
            <textarea
              rows={1}
              value={title}
              maxLength={LIMITS.title}
              aria-label="Card title"
              onChange={(event) => setTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  setTitle(card.title)
                  event.currentTarget.blur()
                }
              }}
              className="w-full resize-none bg-transparent text-[15px] font-semibold leading-snug tracking-tight text-ink-strong outline-none"
            />
          ) : (
            card.title
          )
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tabular-nums">#{card.seq}</span>
            <span>·</span>
            <span>
              {column?.name || 'Loose'}
              {rank > 0 && <span className="text-ink-faint"> · {rank}</span>}
            </span>
            {card.archived && <Tag>Archived</Tag>}
            {card.done && <Tag tone="strong">Done</Tag>}
            {due && !card.done && (
              <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${DUE_TONE[due.tone]}`}>
                <Icon name="clock" className="h-3 w-3" />
                {due.tone === 'late' ? `Overdue — ${due.label}` : due.label}
              </span>
            )}
          </span>
        }
        footer={
          <>
            {canWrite && (
              <Menu
                label="More"
                align="start"
                trigger={({ toggle }) => (
                  <button type="button" aria-haspopup="menu" onClick={toggle} className={BTN_QUIET}>
                    <Icon name="dots" className="h-3.5 w-3.5" />
                    More
                  </button>
                )}
              >
                <MenuLabel>Move</MenuLabel>
                {board.lists
                  .filter((list) => list.id !== card.list_id)
                  .map((list) => (
                    <MenuItem
                      key={list.id}
                      icon="arrowRight"
                      onClick={() =>
                        actions.card.move(
                          card,
                          list.id,
                          cards.filter((entry) => entry.list_id === list.id).length,
                          cards.filter((entry) => entry.list_id === list.id),
                          list.done ? true : undefined,
                        )
                      }
                    >
                      {list.name}
                    </MenuItem>
                  ))}
                <MenuLine />
                <MenuItem icon="copy" onClick={() => actions.card.duplicate(card)}>
                  Duplicate card
                </MenuItem>
                <MenuItem icon="send" onClick={() => onSend(card.id)}>
                  Move to another board…
                </MenuItem>
                <MenuItem icon="archive" onClick={() => actions.card.set(card, { archived: !card.archived })}>
                  {card.archived ? 'Restore from archive' : 'Archive card'}
                </MenuItem>
                <MenuLine />
                <MenuItem
                  icon="trash"
                  tone="danger"
                  onClick={() => {
                    actions.card.remove(card)
                    onClose()
                  }}
                >
                  Delete card
                </MenuItem>
              </Menu>
            )}
            <span className="flex-1" />
            {canWrite && (
              <button type="button" onClick={() => actions.card.set(card, { done: !card.done })} className={card.done ? BTN_QUIET : BTN_SOLID}>
                <Icon name={card.done ? 'circle' : 'check'} className="h-3.5 w-3.5" />
                {card.done ? 'Mark unfinished' : 'Mark done'}
              </button>
            )}
            <button type="button" onClick={onClose} className={BTN_QUIET}>
              Close
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && <Note tone="error">{error}</Note>}

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-full sm:w-[240px]">
              <WhenField value={card.due} now={actions.now} disabled={!canWrite} done={card.done} board={board} onChange={(iso) => actions.card.set(card, { due: iso })} />
            </span>
            <LabelPicker board={board} card={card} canWrite={canWrite} actions={actions} />
            {labels.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {labels.map((label) => (
                  <span key={label.id} className="inline-flex items-center gap-1.5 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-secondary">
                    <Dot colour={label.colour} className="h-1.5 w-1.5" />
                    {label.name}
                    {canWrite && (
                      <button
                        type="button"
                        aria-label={`Remove ${label.name}`}
                        onClick={() => actions.card.set(card, { labels: card.labels.filter((id) => id !== label.id) })}
                        className="cursor-pointer opacity-60 hover:opacity-100"
                      >
                        <Icon name="x" className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
              </span>
            )}
          </div>

          <section>
            {writing ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-end">
                  <button type="button" onClick={() => setExpanded(true)} className={`${BTN_BARE} h-7`}>
                    <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
                    Bigger, with preview
                  </button>
                </div>
                <NoteEditor
                  value={notes}
                  disabled={actions.busy}
                  autoFocus
                  onChange={setNotes}
                  onCancel={() => {
                    setNotes(card.notes || '')
                    setWriting(false)
                  }}
                  onDone={() => {
                    setWriting(false)
                    if (notes !== (card.notes || '')) actions.card.set(card, { notes })
                  }}
                />
              </div>
            ) : card.notes ? (
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => setWriting(true)}
                className="w-full cursor-text rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-line hover:bg-surface-raised/40 disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent"
              >
                <NotesBody text={card.notes} />
              </button>
            ) : (
              canWrite && (
                <button type="button" onClick={() => setWriting(true)} className={`${BTN_BARE} -ml-2.5`}>
                  <Icon name="book" className="h-3.5 w-3.5" />
                  Add notes
                </button>
              )
            )}
          </section>

          <Fold label="Checklist" icon="listTodo" count={(card.checklist || []).length} show={(card.checklist || []).length > 0}>
            <Checklist card={card} canWrite={canWrite} actions={actions} />
          </Fold>

          <Fold label="Files" icon="paperclip" count={(card.files || []).length} show={(card.files || []).length > 0}>
            <Files card={card} canWrite={canWrite} actions={actions} onView={setViewing} />
          </Fold>

          <Fold label="Links" icon="link" count={(card.links || []).length} show={(card.links || []).length > 0}>
            <Links card={card} canWrite={canWrite} actions={actions} />
          </Fold>

          <Fold label="Comments" icon="message" count={(card.comments || []).length} start>
            <Comments card={card} canWrite={canWrite} actions={actions} />
          </Fold>

          <Fold label="History" icon="history" count={(card.activity || []).length}>
            <ul className="flex flex-col gap-1.5">
              {[...(card.activity || [])].reverse().map((entry, index) => (
                <li key={index} className="flex items-baseline gap-2 text-[12px] text-ink-muted">
                  <span className="shrink-0 tabular-nums text-ink-faint" title={clock(Date.parse(entry.at))}>
                    {ago(entry.at, actions.now)}
                  </span>
                  <span>{ACTIVITY[entry.what] || entry.what}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] text-ink-faint">
              Made {ago(card.created_at, actions.now)}
              {card.completed_at ? ` · finished ${ago(card.completed_at, actions.now)}` : ''}
              {card.updated_at ? ` · last touched ${ago(card.updated_at, actions.now)}` : ''}. The last {LIMITS.activity} entries are kept.
            </p>
          </Fold>
        </div>
      </Sheet>

      {expanded && (
        <NoteSheet
          title={card.title}
          value={notes}
          busy={actions.busy}
          onChange={setNotes}
          onClose={() => setExpanded(false)}
          onSave={() => {
            setExpanded(false)
            setWriting(false)
            if (notes !== (card.notes || '')) actions.card.set(card, { notes })
          }}
        />
      )}

      {viewingAt >= 0 && (
        <Viewer
          files={shots}
          at={viewingAt}
          onStep={(step) => setViewing(shots[(viewingAt + step + shots.length) % shots.length].id)}
          onClose={() => setViewing(null)}
          onDownload={downloadFile}
        />
      )}
    </>
  )
}
