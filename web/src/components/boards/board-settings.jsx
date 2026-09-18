import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { BTN_QUIET, BTN_RISK, BTN_SOLID, CAPS, Dot, INPUT, Note, Sheet, Swatch, TEXTAREA } from './ui'
import { FactSheet, PurposePicker } from './purpose'
import ArtField, { FocusPicker } from './art'
import {
  COLOURS,
  LIMITS,
  REMIND_STEPS_MAX,
  REMIND_UNITS,
  ago,
  joinWords,
  plural,
  purposeOf,
  remindOf,
  shortId,
  sortSteps,
  stepWords,
  tally,
} from '../../lib/boards'
import { fetchBin, purgeCard, undeleteCard } from '../../lib/boards-api'

const TABS = [
  { id: 'board', label: 'Board', icon: 'kanban' },
  { id: 'look', label: 'Look', icon: 'image' },
  { id: 'labels', label: 'Labels', icon: 'tag' },
  { id: 'remind', label: 'Reminders', icon: 'bell' },
  { id: 'bin', label: 'Bin', icon: 'trash' },
]

const Field = ({ label, hint, children, htmlFor }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className={CAPS}>
        {label}
      </label>
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </div>
    {children}
  </div>
)

const Block = ({ title, description, children }) => (
  <section className="flex flex-col gap-3 border-t border-line pt-4 first:border-0 first:pt-0">
    <div>
      <h3 className="text-[13px] font-semibold tracking-tight text-ink-strong">{title}</h3>
      {description && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{description}</p>}
    </div>
    {children}
  </section>
)

function LabelRow({ entry, used, disabled, onSave, onRemove }) {
  const [name, setName] = useState(entry.name)
  const [colour, setColour] = useState(entry.colour)
  const dirty = name.trim() !== entry.name || colour !== entry.colour

  useEffect(() => {
    setName(entry.name)
    setColour(entry.colour)
  }, [entry.id, entry.name, entry.colour])

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-secondary">
          <Dot colour={colour} className="h-1.5 w-1.5" />
          {name.trim() || 'Label'}
        </span>
        <input
          value={name}
          maxLength={LIMITS.labelName}
          aria-label="Label name"
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && dirty && name.trim() && onSave({ ...entry, name: name.trim(), colour })}
          className={`${INPUT} h-7 flex-1`}
        />
        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-faint" title={`${used} ${used === 1 ? 'card wears' : 'cards wear'} this`}>
          {used}
        </span>
        <button type="button" aria-label={`Delete ${entry.name}`} disabled={disabled} onClick={() => onRemove(entry)} className="shrink-0 cursor-pointer rounded p-1 text-ink-faint transition-colors hover:text-red-500 disabled:opacity-40">
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {COLOURS.map((entry_) => (
          <Swatch key={entry_.id} colour={entry_.id} active={colour === entry_.id} disabled={disabled} size="h-5 w-5" onPick={setColour} />
        ))}
        {dirty && (
          <button type="button" disabled={disabled || !name.trim()} onClick={() => onSave({ ...entry, name: name.trim(), colour })} className={`${BTN_SOLID} ml-auto h-7`}>
            Save
          </button>
        )}
      </div>
    </li>
  )
}

function Labels({ board, cards, disabled, actions }) {
  const [name, setName] = useState('')
  const [colour, setColour] = useState('violet')
  const labels = board.labels || []

  const usage = useMemo(() => {
    const counts = new Map()
    for (const card of cards) for (const id of card.labels || []) counts.set(id, (counts.get(id) || 0) + 1)
    return counts
  }, [cards])

  const add = () => {
    const cleaned = name.trim()
    if (!cleaned) return
    actions.label.set({ id: shortId(), name: cleaned, colour })
    setName('')
  }

  return (
    <div className="flex flex-col gap-4">
      <Block title="Labels" description="A handful of tags for sorting cards at a glance. They belong to this board — a card carried to another board leaves them behind.">
        {labels.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {labels.map((entry) => (
              <LabelRow
                key={entry.id}
                entry={entry}
                used={usage.get(entry.id) || 0}
                disabled={disabled}
                onSave={(next) => actions.label.set(next)}
                onRemove={(next) => actions.label.remove(next)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-ink-muted">No labels yet.</p>
        )}
      </Block>

      {labels.length < LIMITS.labels && (
        <Block title="Add a label">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              maxLength={LIMITS.labelName}
              placeholder="Label name"
              disabled={disabled}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && add()}
              className={`${INPUT} h-8 min-w-[160px] flex-1`}
            />
            <button type="button" disabled={disabled || !name.trim()} onClick={add} className={BTN_SOLID}>
              Add
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {COLOURS.map((entry) => (
              <Swatch key={entry.id} colour={entry.id} active={colour === entry.id} disabled={disabled} size="h-6 w-6" onPick={setColour} />
            ))}
          </div>
        </Block>
      )}
      {labels.length >= LIMITS.labels && <p className="text-[11.5px] text-ink-faint">{LIMITS.labels} labels is the most a board takes.</p>}
    </div>
  )
}

function Step({ step, side, disabled, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11.5px] text-ink-secondary">
      {stepWords(step)} {side}
      {!disabled && (
        <button type="button" aria-label={`Remove ${stepWords(step)} ${side}`} onClick={() => onRemove(step)} className="cursor-pointer text-ink-faint hover:text-red-500">
          <Icon name="x" className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

function Ladder({ steps, side, disabled, onChange }) {
  const [count, setCount] = useState('1')
  const [unit, setUnit] = useState('d')

  const add = () => {
    const read = Math.round(Number(count))
    if (!Number.isFinite(read) || read < 1 || read > 9999) return
    const next = sortSteps([...steps, `${read}${unit}`])
    if (next.length > REMIND_STEPS_MAX) return
    onChange(next)
    setCount('1')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.length ? steps.map((step) => <Step key={step} step={step} side={side} disabled={disabled} onRemove={(held) => onChange(steps.filter((entry) => entry !== held))} />) : <span className="text-[12.5px] text-ink-faint">Nothing {side === 'before' ? 'ahead of time' : 'afterwards'}.</span>}
      </div>
      {!disabled && steps.length < REMIND_STEPS_MAX && (
        <div className="flex items-center gap-2">
          <input type="number" min="1" max="9999" value={count} aria-label={`How long ${side}`} onChange={(event) => setCount(event.target.value)} className={`${INPUT} h-7 w-[72px]`} />
          <select value={unit} aria-label="Unit" onChange={(event) => setUnit(event.target.value)} className={`${INPUT} h-7 w-[104px] cursor-pointer`}>
            {REMIND_UNITS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <span className="text-[12px] text-ink-muted">{side}</span>
          <button type="button" onClick={add} className={`${BTN_QUIET} h-7`}>
            Add
          </button>
        </div>
      )}
    </div>
  )
}

function Reminders({ board, cards, disabled, actions }) {
  const remind = remindOf(board)
  const set = (patch) => actions.board.set({ remind: { ...remind, ...patch } })

  const chased = cards.filter((card) => card.due && !card.done && !card.archived).length
  const words = remind.on
    ? joinWords([
        remind.lead.length ? `${joinWords(remind.lead.map(stepWords))} before` : '',
        remind.late.length ? `${joinWords(remind.late.map(stepWords))} after` : '',
      ])
    : ''

  return (
    <div className="flex flex-col gap-4">
      <Block
        title="Chase due cards"
        description="A chased card shows up in the Coming up strip above your boards, ordered by how soon it is due and tinted once it slips."
      >
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={remind.on} disabled={disabled} onChange={(event) => set({ on: event.target.checked })} className="h-4 w-4 cursor-pointer accent-[var(--color-ink-strong)]" />
          <span className="text-[13px] text-ink">Remind me about cards on this board</span>
        </label>
        {remind.on && chased === 0 && <Note tone="info">Nothing on this board has a due date yet, so there is nothing to chase.</Note>}
        {remind.on && chased > 0 && <p className="text-[12.5px] text-ink-muted">{plural(chased, 'card')} with a due date would be chased {words || 'at the moment it falls due'}.</p>}
        {remind.on && remind.quiet && <Note tone="warn">Held out of Coming up, so nothing from this board will show there.</Note>}
      </Block>

      {remind.on && (
        <>
          <Block title="Ahead of time" description="How far in advance to raise it. Add more than one for a ladder.">
            <Ladder steps={remind.lead} side="before" disabled={disabled} onChange={(lead) => set({ lead })} />
          </Block>
          <Block title="After it slips" description="How long to keep bringing it back once it is overdue.">
            <Ladder steps={remind.late} side="after" disabled={disabled} onChange={(late) => set({ late })} />
          </Block>
          <Block title="Quiet for now" description="Keep the settings but leave this board out of the strip — useful while a board is parked.">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={remind.quiet} disabled={disabled} onChange={(event) => set({ quiet: event.target.checked })} className="h-4 w-4 cursor-pointer accent-[var(--color-ink-strong)]" />
              <span className="text-[13px] text-ink">Hold this board out of Coming up</span>
            </label>
          </Block>
        </>
      )}
    </div>
  )
}

function Bin({ board, onRestored, now }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    fetchBin(board.id).then(setRows, (failure) => setError(failure.message))
  }, [board.id])

  useEffect(load, [load])

  return (
    <Block title="Recently deleted" description="A deleted card is kept for a day before it goes for good. Bringing one back puts it where it was.">
      {error && <Note tone="error">{error}</Note>}
      {rows === null && <p className="text-[12.5px] text-ink-faint">Looking…</p>}
      {rows?.length === 0 && <p className="text-[12.5px] text-ink-muted">Nothing in the bin.</p>}
      {rows && rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map((card) => (
            <li key={card.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
              <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-faint">{card.seq}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-secondary">{card.title}</span>
              <span className="shrink-0 text-[11px] text-ink-faint">{ago(card.deleted_at, now)}</span>
              <button
                type="button"
                disabled={busy === card.id}
                onClick={async () => {
                  setBusy(card.id)
                  try {
                    await undeleteCard(card.id)
                    setRows((held) => held.filter((entry) => entry.id !== card.id))
                    onRestored()
                  } catch (failure) {
                    setError(failure.message)
                  } finally {
                    setBusy(null)
                  }
                }}
                className={`${BTN_QUIET} h-7`}
              >
                <Icon name="undo" className="h-3.5 w-3.5" />
                Restore
              </button>
              <button
                type="button"
                aria-label={`Delete ${card.title} for good`}
                disabled={busy === card.id}
                onClick={async () => {
                  setBusy(card.id)
                  try {
                    await purgeCard(card)
                    setRows((held) => held.filter((entry) => entry.id !== card.id))
                  } catch (failure) {
                    setError(failure.message)
                  } finally {
                    setBusy(null)
                  }
                }}
                className="shrink-0 cursor-pointer rounded p-1 text-ink-faint transition-colors hover:text-red-500"
              >
                <Icon name="trash" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

export default function BoardSettings({ board, cards, canWrite, actions, onClose, onDeleted, onRestored }) {
  const [tab, setTab] = useState('board')
  const [name, setName] = useState(board.name)
  const [note, setNote] = useState(board.note || '')
  const [facts, setFacts] = useState(board.facts || {})
  const [confirming, setConfirming] = useState(false)
  const [focusing, setFocusing] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setName(board.name)
    setNote(board.note || '')
    setFacts(board.facts || {})
  }, [board.id, board.name, board.note, board.facts])

  const counts = tally(cards, actions.now)
  const disabled = !canWrite || actions.busy

  const saveFacts = (next) => {
    setFacts(next)
    actions.board.set({ facts: Object.fromEntries(Object.entries(next).filter(([, value]) => String(value || '').trim())) })
  }

  if (confirming) {
    return (
      <Sheet
        size="sm"
        title="Delete this board?"
        subtitle={`${board.name} and all ${plural(counts.cards + counts.archived, 'card')} on it go for good, along with every file attached to them. This cannot be undone.`}
        onClose={() => setConfirming(false)}
        busy={actions.busy}
        footer={
          <>
            <button type="button" onClick={() => setConfirming(false)} className={BTN_QUIET}>
              Keep it
            </button>
            <button
              type="button"
              disabled={actions.busy}
              onClick={async () => {
                try {
                  await actions.board.remove()
                  onDeleted()
                } catch (failure) {
                  setError(failure.message)
                  setConfirming(false)
                }
              }}
              className={BTN_RISK}
            >
              Delete board
            </button>
          </>
        }
      >
        {error && <Note tone="error">{error}</Note>}
      </Sheet>
    )
  }

  return (
    <>
      <Sheet size="md" title={board.name} subtitle="Settings for this board." onClose={onClose} busy={actions.busy}>
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-current={tab === entry.id ? 'page' : undefined}
              onClick={() => setTab(entry.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-2.5 py-2 text-[12.5px] transition-colors ${
                tab === entry.id ? 'border-ink-strong font-medium text-ink-strong' : 'border-transparent text-ink-subtle hover:text-ink-strong'
              }`}
            >
              <Icon name={entry.icon} className="h-3.5 w-3.5" />
              {entry.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-3">
            <Note tone="error" onDismiss={() => setError(null)}>
              {error}
            </Note>
          </div>
        )}

        {tab === 'board' && (
          <div className="flex flex-col gap-4">
            <Block title="Name and description">
              <Field label="Name" htmlFor="board-name">
                <input
                  id="board-name"
                  value={name}
                  maxLength={LIMITS.name}
                  disabled={disabled}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => name.trim() && name.trim() !== board.name && actions.board.set({ name: name.trim() })}
                  className={INPUT}
                />
              </Field>
              <Field label="Description" hint={`${LIMITS.note - note.length} left`} htmlFor="board-note">
                <textarea
                  id="board-note"
                  value={note}
                  rows={2}
                  maxLength={LIMITS.note}
                  disabled={disabled}
                  placeholder="One line about what this board is for."
                  onChange={(event) => setNote(event.target.value)}
                  onBlur={() => note !== (board.note || '') && actions.board.set({ note })}
                  className={TEXTAREA}
                />
              </Field>
              <Field label="Colour">
                <div className="flex flex-wrap items-center gap-2">
                  {COLOURS.map((entry) => (
                    <Swatch key={entry.id} colour={entry.id} active={board.colour === entry.id} disabled={disabled} onPick={(colour) => actions.board.set({ colour })} />
                  ))}
                </div>
              </Field>
            </Block>

            <Block title="What this board is for" description="Pick a purpose and the board asks for the details that go with it.">
              <PurposePicker value={board.purpose} disabled={disabled} onPick={(purpose) => actions.board.set({ purpose })} />
            </Block>

            <Block title="Details">
              <FactSheet
                purpose={board.purpose}
                facts={facts}
                disabled={disabled}
                onSet={(key, value) => saveFacts({ ...facts, [key]: value })}
                onDropStray={() => {
                  const known = new Set(purposeOf(board.purpose).fields.map((field) => field.id))
                  saveFacts(Object.fromEntries(Object.entries(facts).filter(([key]) => known.has(key))))
                }}
              />
            </Block>

            <Block title="This board" description="Where it stands right now.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Cards', counts.cards],
                  ['Done', counts.done],
                  ['Overdue', counts.overdue],
                  ['Archived', counts.archived],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-line px-3 py-2">
                    <p className="font-mono text-[18px] font-semibold leading-none tabular-nums text-ink-strong">{value}</p>
                    <p className={`mt-1.5 ${CAPS}`}>{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] text-ink-faint">
                Made {ago(board.created_at, actions.now)} · last touched {ago(board.updated_at, actions.now)}.
              </p>
            </Block>

            <Block title="Danger zone" description="Archiving hides the board and freezes it. Deleting cannot be undone.">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={actions.busy} onClick={() => actions.board.set({ archived: !board.archived })} className={BTN_QUIET}>
                  <Icon name="archive" className="h-3.5 w-3.5" />
                  {board.archived ? 'Restore board' : 'Archive board'}
                </button>
                <button type="button" disabled={actions.busy} onClick={() => setConfirming(true)} className={BTN_RISK}>
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  Delete board
                </button>
              </div>
            </Block>
          </div>
        )}

        {tab === 'look' && (
          <div className="flex flex-col gap-4">
            <Block title="Logo" description="Sits beside the board name and on its tile.">
              <ArtField
                kind="logo"
                board={board}
                colour={board.colour}
                name={board.name}
                disabled={disabled}
                onPick={(result) => actions.board.art.set('logo', result)}
                onClear={() => actions.board.art.remove('logo')}
                onFocus={() => setFocusing('logo')}
              />
            </Block>
            <Block title="Banner" description="A wide strip across the top of the board.">
              <ArtField
                kind="banner"
                board={board}
                colour={board.colour}
                name={board.name}
                disabled={disabled}
                onPick={(result) => actions.board.art.set('banner', result)}
                onClear={() => actions.board.art.remove('banner')}
                onFocus={() => setFocusing('banner')}
              />
            </Block>
          </div>
        )}

        {tab === 'labels' && <Labels board={board} cards={cards} disabled={disabled} actions={actions} />}
        {tab === 'remind' && <Reminders board={board} cards={cards} disabled={disabled} actions={actions} />}
        {tab === 'bin' && <Bin board={board} now={actions.now} onRestored={onRestored} />}
      </Sheet>

      {focusing && (
        <FocusPicker
          board={board}
          kind={focusing}
          busy={actions.busy}
          onClose={() => setFocusing(null)}
          onSave={async (focus) => {
            await actions.board.art.place(focusing, focus)
            setFocusing(null)
          }}
        />
      )}
    </>
  )
}
