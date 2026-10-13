import { useState } from 'react'
import { Icon } from './icon'
import { CalendarAppIcon, Dot, Face, Handset, IslandFrame, IslandSheet } from './book-touches'
import { formatTime, shortDay, fullShortDay, daysUntil, whenWord } from '../lib/booking'
import { DAY_MINUTES, LABEL_MAX, REPEATS, dayLabel, dateLabel, minuteLabel, rangeLabel, repeatLabel, timeOptions } from '../lib/schedule'

const SOON_MS = 60 * 60_000

function countdown(ms, now) {
  const minutes = Math.max(1, Math.round((ms - now) / 60_000))
  return minutes >= 60 ? '1 h' : `${minutes} min`
}

export function ScheduleIsland({ mode, call, now, zone, twelve, note, onShow, onRetry, onClose, sheet }) {
  const at = (ms) => formatTime(ms, zone, twelve)
  let row = null
  let hit = null
  let live = false

  if (mode === 'loading') {
    row = (
      <>
        <Face />
        <span className="book-island-spin" />
      </>
    )
  } else if (mode === 'next' && call) {
    const start = Date.parse(call.start)
    const end = Date.parse(call.end)
    const going = now >= start && now < end
    const soon = !going && start - now < SOON_MS
    const first = call.name.split(/\s+/)[0]
    if ((going || soon) && call.video) {
      live = true
      row = (
        <>
          <Face live />
          <span className="flex flex-col gap-1 text-start">
            <span>{call.name}</span>
            <span className="book-island-dim tabular-nums">{going ? `Now · until ${at(end)}` : `In ${countdown(start, now)} · ${at(start)}`}</span>
          </span>
          <a href={call.video} target="_blank" rel="noopener noreferrer" aria-label={`Join the call with ${call.name}`} title="Join the call" className="book-island-btn ms-3" data-tone="go">
            <Handset />
          </a>
        </>
      )
    } else {
      const days = daysUntil(start, zone, now)
      hit = { label: `Show the next call, ${call.name}, ${fullShortDay(start, zone)} at ${at(start)}`, onClick: () => onShow(call) }
      row = (
        <>
          <Face live />
          <span className="book-island-dim max-[380px]:hidden">{going ? 'Now' : soon ? `In ${countdown(start, now)}` : 'Next'}</span>
          <span className="max-w-36 truncate">{first}</span>
          <span className="book-island-go">{going || soon ? at(start) : `${days <= 1 ? whenWord(start, zone, now) : shortDay(start, zone)} · ${at(start)}`}</span>
        </>
      )
    }
  } else if (mode === 'none' || mode === 'paused') {
    row = (
      <>
        <Dot tone={mode === 'paused' ? 'amber' : 'grey'} />
        <span>{mode === 'paused' ? 'Booking paused' : 'No calls booked'}</span>
      </>
    )
  } else if (mode === 'saving') {
    row = (
      <>
        <span>Saving</span>
        <span className="book-island-typing">
          <i />
          <i />
          <i />
        </span>
      </>
    )
  } else if (mode === 'saved' || mode === 'copied') {
    row = (
      <>
        <span className="book-island-check">
          <Icon name="check" className="h-3 w-3" strokeWidth={3} />
        </span>
        <span>{note || (mode === 'copied' ? 'Link copied' : 'Saved')}</span>
      </>
    )
  } else if (mode === 'error' || mode === 'conflict') {
    if (mode === 'error') hit = { label: 'Couldn’t save. Try again', onClick: onRetry }
    row = (
      <>
        <Icon name="alert" className="book-island-warn h-4 w-4" strokeWidth={2.2} />
        <span>{mode === 'error' ? 'Couldn’t save' : 'Changed in another tab'}</span>
        {mode === 'error' && <span className="book-island-go">Retry</span>}
      </>
    )
  } else if (mode === 'sheet' && sheet) {
    row = sheet
  }

  if (!row) return null

  return (
    <IslandFrame view={mode} sheet={mode === 'sheet'} live={live} hit={hit} onClose={onClose}>
      {row}
    </IslandFrame>
  )
}

function TimeSelect({ value, options, onChange, label, twelve }) {
  return (
    <span className="book-sheet-select">
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
        {options.map((m) => (
          <option key={m} value={m}>
            {minuteLabel(m, twelve)}
          </option>
        ))}
      </select>
      <Icon name="chevronsUpDown" className="h-3.5 w-3.5" />
    </span>
  )
}

function DateField({ value, min, onChange, label }) {
  const open = (e) => {
    try {
      e.currentTarget.showPicker()
    } catch {
      e.currentTarget.focus()
    }
  }
  return (
    <span className="book-sheet-pick">
      <span aria-hidden="true">{dayLabel(value)}</span>
      <Icon name="chevronsUpDown" className="h-3.5 w-3.5" />
      <input type="date" value={value} min={min} required aria-label={label} onChange={(e) => e.target.value && onChange(e.target.value)} onClick={open} />
    </span>
  )
}

const MODES = [
  { id: 'day', label: 'All day' },
  { id: 'time', label: 'Set hours' },
]

export function BlockSheet({ block, from, editing, today, twelve, modKey, clashesFor, onCancel, onSave, onDelete, onSkip }) {
  const [label, setLabel] = useState(block.label)
  const [date, setDate] = useState(block.date)
  const [allDay, setAllDay] = useState(block.start === null)
  const [start, setStart] = useState(block.start ?? 12 * 60)
  const [end, setEnd] = useState(block.end ?? 13 * 60)
  const [repeat, setRepeat] = useState(block.repeat)
  const [until, setUntil] = useState(block.until)

  const pickStart = (value) => {
    setStart(value)
    if (end <= value) setEnd(Math.min(value + 60, DAY_MINUTES))
  }
  const pickDate = (value) => {
    if (!value) return
    setDate(value)
    if (until && until < value) setUntil(value)
  }

  const next = {
    ...block,
    label: label.trim(),
    date,
    start: allDay ? null : start,
    end: allDay ? null : end,
    repeat,
    until: repeat === 'none' || !until ? null : until < date ? date : until,
    except: repeat === 'none' ? [] : block.except || [],
  }
  const clashes = clashesFor(next)
  const first = clashes[0]
  const go = editing ? 'Save' : allDay ? 'Block day' : 'Block time'
  const repeating = block.repeat !== 'none'

  return (
    <IslandSheet label={editing ? 'Edit blocked time' : 'Block time'} onCancel={onCancel} onSubmit={() => onSave(next)}>
      <div className="book-sheet-head">
        <CalendarAppIcon ms={Date.parse(`${date}T12:00:00Z`)} zone="UTC" />
        <span className="book-sheet-heading">
          <span className="book-sheet-name">
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={LABEL_MAX} placeholder="Blocked" aria-label="Name" autoComplete="off" spellCheck="false" />
            <Icon name="pencil" className="h-3.5 w-3.5" />
          </span>
          <span className="book-sheet-when">
            {repeat === 'none' ? dayLabel(date) : repeatLabel(repeat, date)} · {rangeLabel(next.start, next.end, twelve)}
          </span>
        </span>
        <button type="button" onClick={onCancel} aria-label="Close" className="book-sheet-x">
          <Icon name="x" className="h-3 w-3" strokeWidth={2.6} />
        </button>
      </div>

      <fieldset className="book-sheet-seg" style={{ '--i': allDay ? 0 : 1, '--n': 2 }}>
        <legend className="sr-only">Length</legend>
        <span className="book-sheet-thumb" aria-hidden="true" />
        {MODES.map((m) => (
          <label key={m.id}>
            <input type="radio" name="block-length" value={m.id} checked={allDay === (m.id === 'day')} onChange={() => setAllDay(m.id === 'day')} className="sr-only" />
            <span>{m.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="book-sheet-group">
        <div className="book-sheet-row">
          <span className="book-sheet-label">
            <Icon name="calendar" className="h-4 w-4" />
            {repeat === 'none' ? 'Date' : 'Starts'}
          </span>
          <DateField value={date} min={editing ? undefined : today} onChange={pickDate} label={repeat === 'none' ? 'Date' : 'First day'} />
        </div>
        {!allDay && (
          <div className="book-sheet-row">
            <span className="book-sheet-label">
              <Icon name="clock" className="h-4 w-4" />
              Time
            </span>
            <span className="book-sheet-time">
              <TimeSelect value={start} options={timeOptions(0, DAY_MINUTES - 15)} onChange={pickStart} label="From" twelve={twelve} />
              <span aria-hidden="true">–</span>
              <TimeSelect value={end} options={timeOptions(start + 15, DAY_MINUTES)} onChange={setEnd} label="To" twelve={twelve} />
            </span>
          </div>
        )}
        <label className="book-sheet-row">
          <span className="book-sheet-label">
            <Icon name="repeat" className="h-4 w-4" />
            Repeat
          </span>
          <span className="book-sheet-select">
            <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {repeatLabel(r, date)}
                </option>
              ))}
            </select>
            <Icon name="chevronsUpDown" className="h-3.5 w-3.5" />
          </span>
        </label>
        {repeat !== 'none' && (
          <div className="book-sheet-row">
            <span className="book-sheet-label">
              <Icon name="flag" className="h-4 w-4" />
              Ends
            </span>
            <span className="flex items-center gap-1">
              <span className="book-sheet-select">
                <select value={until ? 'on' : 'never'} onChange={(e) => setUntil(e.target.value === 'on' ? (until || date) : null)} aria-label="Ends">
                  <option value="never">Never</option>
                  <option value="on">On a date</option>
                </select>
                <Icon name="chevronsUpDown" className="h-3.5 w-3.5" />
              </span>
              {until && <DateField value={until < date ? date : until} min={date} onChange={setUntil} label="Last day" />}
            </span>
          </div>
        )}
      </div>

      <p className="book-sheet-hint" data-tone={first ? 'warn' : undefined}>
        {first
          ? `${first.name}’s call on ${dayLabel(first.key)} at ${minuteLabel(first.minute, twelve)} stays booked${clashes.length > 1 ? `, and ${clashes.length - 1} more` : ''}. Email to move it.`
          : 'Calls already booked stay put. Visitors just won’t see these times on /book.'}
      </p>

      {editing && (
        <div className="book-sheet-more">
          {repeating && from && (
            <button type="button" onClick={() => onSkip(from)} className="book-sheet-link">
              <Icon name="ban" className="h-3.5 w-3.5" strokeWidth={2} />
              Skip {dateLabel(from)} only
            </button>
          )}
          <button type="button" onClick={onDelete} className="book-sheet-link" data-tone="danger">
            <Icon name="trash" className="h-3.5 w-3.5" strokeWidth={2} />
            {repeating ? 'Delete every repeat' : 'Delete'}
          </button>
        </div>
      )}

      <div className="book-sheet-actions">
        <button type="button" onClick={onCancel} className="book-sheet-btn">
          Cancel
        </button>
        <button type="submit" className="book-sheet-btn" data-tone="go">
          <Icon name={editing ? 'check' : 'ban'} className="h-4 w-4" strokeWidth={2.2} />
          {go}
          <kbd aria-hidden="true" className="book-kbd">
            {modKey}↵
          </kbd>
        </button>
      </div>
    </IslandSheet>
  )
}
