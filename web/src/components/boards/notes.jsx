import { Fragment, createElement, useCallback, useRef, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { BTN_BARE, BTN_QUIET, BTN_SOLID, TEXTAREA, Sheet } from './ui'
import { LIMITS } from '../../lib/boards'

const LINK = /^\[([^\]\n]{1,80})\]\((https?:\/\/[^\s)]{1,300})\)/

const INLINE = [
  { mark: '**', tag: 'strong', className: 'font-semibold text-ink-strong' },
  { mark: '__', tag: 'u', className: 'underline decoration-ink-faint underline-offset-2' },
  { mark: '~~', tag: 's', className: 'text-ink-faint' },
  { mark: '*', tag: 'em', className: 'italic' },
  { mark: '_', tag: 'em', className: 'italic' },
  { mark: '`', tag: 'code', className: 'rounded border border-line bg-surface-raised px-1 py-[1px] font-mono text-[12px] text-ink-strong' },
]

export const MARKS = [
  { id: 'bold', label: 'Bold', icon: 'chevronsUpDown', wrap: '**', sample: 'bold', key: 'b', glyph: 'B' },
  { id: 'italic', label: 'Italic', wrap: '*', sample: 'italic', key: 'i', glyph: 'I' },
  { id: 'underline', label: 'Underline', wrap: '__', sample: 'underlined', key: 'u', glyph: 'U' },
  { id: 'strike', label: 'Crossed out', wrap: '~~', sample: 'gone', glyph: 'S' },
  { id: 'big', label: 'Heading', line: '# ', sample: 'Heading', glyph: 'H1' },
  { id: 'small', label: 'Subheading', line: '## ', sample: 'Heading', glyph: 'H2' },
  { id: 'bullets', label: 'Bullets', line: '- ', sample: 'Something', glyph: '•' },
  { id: 'numbers', label: 'Numbered', line: '1. ', sample: 'Something', glyph: '1.' },
  { id: 'quote', label: 'Quote', line: '> ', sample: 'Quoted', glyph: '\u201C\u201D' },
  { id: 'code', label: 'Code', wrap: '`', sample: 'code', glyph: '</>' },
  { id: 'link', label: 'Link', link: true, sample: 'the label', glyph: 'link' },
]

function inline(raw, depth = 0) {
  const nodes = []
  let plain = ''
  let index = 0
  let key = 0

  const flush = () => {
    if (plain) nodes.push(plain)
    plain = ''
  }

  while (index < raw.length) {
    const rest = raw.slice(index)
    const link = LINK.exec(rest)
    if (link) {
      flush()
      nodes.push(
        <a
          key={`l${key}`}
          href={link[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="text-ink-strong underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-ink-strong"
        >
          {link[1]}
        </a>,
      )
      key += 1
      index += link[0].length
      continue
    }

    const found =
      depth < 3
        ? INLINE.find((entry) => rest.startsWith(entry.mark) && rest.indexOf(entry.mark, entry.mark.length) > entry.mark.length)
        : undefined
    if (found) {
      const end = rest.indexOf(found.mark, found.mark.length)
      const inner = rest.slice(found.mark.length, end)
      flush()
      nodes.push(
        createElement(
          found.tag,
          { key: `m${key}`, className: found.className },
          found.tag === 'code' ? inner : inline(inner, depth + 1),
        ),
      )
      key += 1
      index += end + found.mark.length
      continue
    }

    plain += raw[index]
    index += 1
  }
  flush()
  return nodes
}

const BODY = 'text-[13px] leading-relaxed text-ink'

function paragraph(lines, key) {
  return (
    <p key={key} className={BODY}>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {inline(line)}
        </Fragment>
      ))}
    </p>
  )
}

export function renderNotes(text) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n')
  const blocks = []
  let held = []
  let kind = null
  let key = 0

  const close = () => {
    if (!held.length) {
      kind = null
      return
    }
    if (kind === 'bullets' || kind === 'numbers') {
      blocks.push(
        createElement(
          kind === 'bullets' ? 'ul' : 'ol',
          { key: `b${key}`, className: `ml-4 space-y-1 ${BODY} ${kind === 'bullets' ? 'list-disc' : 'list-decimal'}` },
          held.map((line, index) => (
            <li key={index} className="pl-1">
              {inline(line)}
            </li>
          )),
        ),
      )
    } else if (kind === 'quote') {
      blocks.push(
        <blockquote key={`b${key}`} className={`border-l-2 border-line-strong pl-3 italic text-ink-muted ${BODY}`}>
          {held.map((line, index) => (
            <Fragment key={index}>
              {index > 0 && <br />}
              {inline(line)}
            </Fragment>
          ))}
        </blockquote>,
      )
    } else {
      blocks.push(paragraph(held, `b${key}`))
    }
    key += 1
    held = []
    kind = null
  }

  const push = (next, line) => {
    if (kind !== next) close()
    kind = next
    held.push(line)
  }

  lines.forEach((raw) => {
    const line = raw.trimEnd()
    if (!line.trim()) {
      close()
      return
    }
    if (line.startsWith('# ')) {
      close()
      blocks.push(
        <h4 key={`b${key}`} className="text-[15px] font-semibold leading-snug tracking-tight text-ink-strong">
          {inline(line.slice(2))}
        </h4>,
      )
      key += 1
      return
    }
    if (line.startsWith('## ')) {
      close()
      blocks.push(
        <h5 key={`b${key}`} className="text-[13.5px] font-semibold leading-snug text-ink-strong">
          {inline(line.slice(3))}
        </h5>,
      )
      key += 1
      return
    }
    if (line.startsWith('> ')) return push('quote', line.slice(2))
    if (/^[-*] /.test(line)) return push('bullets', line.slice(2))
    if (/^\d+[.)] /.test(line)) return push('numbers', line.replace(/^\d+[.)] /, ''))
    return push('text', line)
  })
  close()
  return blocks
}

export function NotesBody({ text, className = '' }) {
  const blocks = renderNotes(text)
  if (!blocks.length) return null
  return <div className={`space-y-2.5 ${className}`}>{blocks}</div>
}

function place(node, next, from, to) {
  window.requestAnimationFrame(() => {
    node.focus()
    node.setSelectionRange(from, to)
  })
  return next
}

export function applyMark(node, mark, url) {
  const value = node.value
  const start = node.selectionStart ?? value.length
  const end = node.selectionEnd ?? start
  const chosen = value.slice(start, end)

  if (mark.link) {
    const label = chosen || mark.sample
    const target = url || 'https://'
    const made = `[${label}](${target})`
    const next = value.slice(0, start) + made + value.slice(end)
    const at = start + label.length + 3
    return place(node, next, at, at + target.length)
  }

  if (mark.line) {
    const head = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const tailAt = value.indexOf('\n', end)
    const tail = tailAt === -1 ? value.length : tailAt
    const body = value.slice(head, tail) || mark.sample
    const already = body.split('\n').every((line) => line.startsWith(mark.line))
    const lines = body
      .split('\n')
      .map((line) => (already ? line.slice(mark.line.length) : mark.line + line))
      .join('\n')
    const next = value.slice(0, head) + lines + value.slice(tail)
    return place(node, next, head, head + lines.length)
  }

  const body = chosen || mark.sample
  const wrapped = chosen.startsWith(mark.wrap) && chosen.endsWith(mark.wrap)
  if (wrapped && chosen.length > mark.wrap.length * 2) {
    const bare = chosen.slice(mark.wrap.length, -mark.wrap.length)
    const next = value.slice(0, start) + bare + value.slice(end)
    return place(node, next, start, start + bare.length)
  }
  const made = `${mark.wrap}${body}${mark.wrap}`
  const next = value.slice(0, start) + made + value.slice(end)
  const at = start + mark.wrap.length
  return place(node, next, at, at + body.length)
}

function Toolbar({ onFire, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line pb-2" role="toolbar" aria-label="Formatting">
      {MARKS.map((mark) => (
        <button
          key={mark.id}
          type="button"
          title={`${mark.label}${mark.key ? ` (⌘${mark.key.toUpperCase()})` : ''}`}
          aria-label={mark.label}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onFire(mark)}
          className="h-7 min-w-[28px] cursor-pointer rounded-md px-1.5 font-mono text-[11px] font-semibold text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mark.glyph}
        </button>
      ))}
    </div>
  )
}

export function NoteEditor({ value, disabled, onChange, onDone, onCancel, autoFocus }) {
  const box = useRef(null)
  const left = LIMITS.notes - (value ?? '').length

  const fire = useCallback(
    (mark) => {
      const node = box.current
      if (!node || disabled) return
      onChange(applyMark(node, mark))
    },
    [disabled, onChange],
  )

  const onKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      onDone?.()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel?.()
      return
    }
    if (!event.metaKey && !event.ctrlKey) return
    const mark = MARKS.find((entry) => entry.key === event.key.toLowerCase())
    if (mark) {
      event.preventDefault()
      fire(mark)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2.5">
      <Toolbar onFire={fire} disabled={disabled} />
      <textarea
        ref={box}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={LIMITS.notes}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="What is this about? **Bold**, `code`, - bullets and [links](https://…) all work."
        className={`${TEXTAREA} min-h-[140px] border-0 bg-transparent px-0 hover:border-0 focus:border-0`}
      />
      <div className="flex items-center justify-between gap-3">
        <span className={`font-mono text-[10.5px] tabular-nums ${left < 100 ? 'text-amber-500' : 'text-ink-faint'}`}>{left}</span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className={BTN_BARE}>
              Cancel
            </button>
          )}
          {onDone && (
            <button type="button" onClick={onDone} disabled={disabled} className={BTN_SOLID}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function NoteSheet({ title, value, onChange, onSave, onClose, busy }) {
  const [preview, setPreview] = useState(false)
  return (
    <Sheet
      title={title}
      subtitle="Markdown: **bold**, *italic*, `code`, # headings, - bullets, > quotes and [links](https://…)."
      size="lg"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={() => setPreview((held) => !held)} className={BTN_QUIET}>
            <Icon name={preview ? 'eyeOff' : 'eye'} className="h-3.5 w-3.5" />
            {preview ? 'Write' : 'Preview'}
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={busy} className={BTN_SOLID}>
            Save notes
          </button>
        </>
      }
    >
      {preview ? (
        <div className="min-h-[240px] rounded-xl border border-line bg-surface p-4">
          <NotesBody text={value} />
          {!value.trim() && <p className="text-[13px] text-ink-faint">Nothing to preview yet.</p>}
        </div>
      ) : (
        <NoteEditor value={value} onChange={onChange} disabled={busy} autoFocus />
      )}
    </Sheet>
  )
}
