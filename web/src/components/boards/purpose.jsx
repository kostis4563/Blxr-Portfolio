import { useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { BTN_BARE, CAPS, INPUT } from './ui'
import {
  FACT_FIELDS,
  PURPOSES,
  factChips,
  keyFields,
  prettyLink,
  purposeOf,
  restFields,
  strayFacts,
} from '../../lib/boards'

export function PurposePicker({ value, disabled, onPick }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {PURPOSES.map((purpose) => {
        const on = purpose.id === value
        return (
          <button
            key={purpose.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onPick(purpose.id)}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              on ? 'border-line-strong bg-surface-raised' : 'border-line bg-surface hover:border-line-strong'
            }`}
          >
            <Icon name={purpose.icon} className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${on ? 'text-ink-strong' : 'text-ink-faint'}`} />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium text-ink-strong">{purpose.label}</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-subtle">{purpose.blurb}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const HOSTED = { host: 'example.com or 10.0.0.4', port: '30120', link: 'https://…' }

function Cell({ field, value, disabled, onSet }) {
  const id = `fact-${field.id}`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={CAPS}>
          {field.label}
        </label>
        {field.key && <span className="text-[10px] text-ink-faint">shown on the board</span>}
      </div>
      {field.kind === 'pick' ? (
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onSet(field.id, event.target.value)}
          className={`${INPUT} cursor-pointer appearance-none bg-[length:12px] bg-[right_0.6rem_center] bg-no-repeat pr-8`}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          }}
        >
          <option value="">Not set</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          value={value}
          disabled={disabled}
          type={field.kind === 'day' ? 'date' : 'text'}
          inputMode={field.kind === 'port' ? 'numeric' : undefined}
          maxLength={field.kind === 'link' ? 400 : 160}
          placeholder={field.hint || HOSTED[field.kind] || ''}
          onChange={(event) => onSet(field.id, event.target.value)}
          className={INPUT}
        />
      )}
      {field.hint && field.kind !== 'pick' && <p className="text-[11px] text-ink-faint">{field.hint}</p>}
    </div>
  )
}

function Stray({ keys, disabled, onDrop }) {
  if (!keys.length) return null
  return (
    <div className="rounded-xl border border-line bg-surface-raised/50 p-3">
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        This board still carries {keys.length === 1 ? 'a detail' : 'details'} from a purpose it no longer has:{' '}
        <span className="text-ink-strong">{keys.map((key) => FACT_FIELDS[key]?.label || key).join(', ')}</span>.
      </p>
      <button type="button" disabled={disabled} onClick={onDrop} className={`${BTN_BARE} -ml-2.5 mt-1.5 text-red-500 hover:text-red-400`}>
        <Icon name="trash" className="h-3.5 w-3.5" />
        Drop {keys.length === 1 ? 'it' : 'them'}
      </button>
    </div>
  )
}

export function FactSheet({ purpose: purposeId, facts, disabled, onSet, onDropStray }) {
  const purpose = purposeOf(purposeId)
  const [more, setMore] = useState(false)
  const rest = restFields(purpose)
  const stray = strayFacts(purpose, facts)

  if (!purpose.fields.length) {
    return (
      <p className="text-[13px] text-ink-muted">
        A personal board keeps no extra details — just the name, the colour and the cards.
        {stray.length > 0 && <> </>}
        {stray.length > 0 && <Stray keys={stray} disabled={disabled} onDrop={onDropStray} />}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {keyFields(purpose).map((field) => (
          <Cell key={field.id} field={field} value={facts?.[field.id] ?? ''} disabled={disabled} onSet={onSet} />
        ))}
      </div>

      {rest.length > 0 && (
        <div>
          <button type="button" onClick={() => setMore((held) => !held)} className={`${BTN_BARE} -ml-2.5`}>
            <Icon name={more ? 'chevronDown' : 'chevronRight'} className="h-3.5 w-3.5" />
            {more ? 'Fewer details' : `${rest.length} more ${rest.length === 1 ? 'detail' : 'details'}`}
          </button>
          {more && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {rest.map((field) => (
                <Cell key={field.id} field={field} value={facts?.[field.id] ?? ''} disabled={disabled} onSet={onSet} />
              ))}
            </div>
          )}
        </div>
      )}

      <Stray keys={stray} disabled={disabled} onDrop={onDropStray} />
    </div>
  )
}

export function PurposeMark({ board, className = '' }) {
  const purpose = purposeOf(board?.purpose)
  if (purpose.id === 'personal') return null
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] text-ink-faint ${className}`}>
      <Icon name={purpose.icon} className="h-3 w-3" />
      {purpose.label}
    </span>
  )
}

function FactChip({ chip }) {
  const [copied, setCopied] = useState(false)
  const { field, value, text } = chip

  if (field.kind === 'link') {
    const href = value.includes('://') ? value : `https://${value}`
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        title={value}
        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-subtle transition-colors hover:border-line-strong hover:text-ink-strong"
      >
        <Icon name="link" className="h-3 w-3 shrink-0" />
        <span className="truncate">{prettyLink(value)}</span>
        <Icon name="arrowUpRight" className="h-3 w-3 shrink-0 opacity-60" />
      </a>
    )
  }

  const copyable = ['host', 'port'].includes(field.kind) || field.id === 'guild'
  if (!copyable) {
    return (
      <span title={field.label} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-subtle">
        <span className="shrink-0 text-ink-faint">{field.label}</span>
        <span className="truncate text-ink-secondary">{text}</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      title={`Copy ${field.label.toLowerCase()}`}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1400)
          },
          () => {},
        )
      }}
      className="inline-flex max-w-[240px] cursor-pointer items-center gap-1.5 rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle transition-colors hover:border-line-strong hover:text-ink-strong"
    >
      <Icon name={copied ? 'check' : 'copy'} className={`h-3 w-3 shrink-0 ${copied ? 'text-green-500' : ''}`} />
      <span className="truncate">{text}</span>
    </button>
  )
}

export function FactStrip({ board, onMore }) {
  const purpose = purposeOf(board?.purpose)
  const chips = factChips(purpose, board?.facts)
  if (purpose.id === 'personal' && !chips.length) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-ink-subtle">
        <Icon name={purpose.icon} className="h-3 w-3" />
        {purpose.label}
      </span>
      {chips.map((chip) => (
        <FactChip key={chip.field.id} chip={chip} />
      ))}
      {onMore && (
        <button type="button" onClick={onMore} className={`${BTN_BARE} h-7 px-1.5 text-[11.5px]`}>
          {chips.length ? 'Edit details' : 'Add details'}
        </button>
      )}
    </div>
  )
}
