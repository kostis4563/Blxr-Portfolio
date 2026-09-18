import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { Picture } from './ui'
import { LIMITS, isImage, previewOf } from '../../lib/messages'
import { readAttachment, readableSize } from '../../lib/boards-files'
import * as api from '../../lib/messages-api'

const MAX_HEIGHT = 160

const ICON_BTN =
  'grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-subtle outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/25 disabled:cursor-not-allowed disabled:opacity-40'

function Pending({ file, onRemove }) {
  return (
    <span className="relative inline-flex shrink-0">
      {file.entry ? (
        isImage(file.entry) ? (
          <Picture path={file.entry.thumb || file.entry.path} alt={file.entry.name} className="h-14 w-14 rounded-lg border border-line object-cover" />
        ) : (
          <span className="flex h-14 max-w-[180px] items-center gap-2 rounded-lg border border-line bg-surface px-2.5">
            <Icon name="file" className="h-4 w-4 shrink-0 text-ink-subtle" />
            <span className="min-w-0">
              <span className="block truncate text-[11.5px] text-ink-strong">{file.entry.name}</span>
              <span className="block text-[10.5px] tabular-nums text-ink-faint">{readableSize(file.entry.bytes)}</span>
            </span>
          </span>
        )
      ) : (
        <span className="grid h-14 w-14 animate-pulse place-items-center rounded-lg border border-line bg-surface-raised">
          <Icon name="upload" className="h-4 w-4 text-ink-faint" />
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink-subtle shadow-sm hover:text-ink-strong"
      >
        <Icon name="x" className="h-3 w-3" />
      </button>
    </span>
  )
}

function Context({ icon, label, text, onClose }) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[12px]">
      <Icon name={icon} className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
      <span className="shrink-0 font-medium text-ink-strong">{label}</span>
      <span className="min-w-0 flex-1 truncate text-ink-muted">{text}</span>
      <button type="button" onClick={onClose} aria-label="Cancel" className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-ink-subtle hover:bg-surface-hover hover:text-ink-strong">
        <Icon name="x" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

const Composer = forwardRef(function Composer(
  { threadId, them, disabled, replyTo, editing, onCancelReply, onCancelEdit, onSend, onEdit, onTyping, onEditLast, onError },
  ref,
) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const field = useRef(null)
  const picker = useRef(null)
  const held = useRef([])
  useEffect(() => {
    held.current = files
  }, [files])

  useEffect(() => {
    if (editing) {
      setText(editing.body || '')
      setFiles([])
      requestAnimationFrame(() => {
        field.current?.focus()
        field.current?.setSelectionRange(field.current.value.length, field.current.value.length)
      })
    } else {
      setText('')
    }
  }, [editing])

  useEffect(() => {
    if (replyTo) field.current?.focus()
  }, [replyTo])

  useEffect(
    () => () => {
      held.current.forEach((file) => file.entry && api.discardFile(file.entry).catch(() => {}))
    },
    [],
  )

  useEffect(() => {
    const node = field.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(MAX_HEIGHT, node.scrollHeight)}px`
  }, [text])

  const addFiles = async (picked) => {
    const list = Array.from(picked || []).filter(Boolean)
    if (!list.length || editing) return
    const room = LIMITS.files - files.length
    if (room <= 0) {
      onError(`A message takes at most ${LIMITS.files} files.`)
      return
    }
    for (const file of list.slice(0, room)) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      setFiles((current) => [...current, { key, entry: null }])
      try {
        const prepared = await readAttachment(file)
        const entry = await api.uploadFile(threadId, prepared)
        setFiles((current) => (current.some((held) => held.key === key) ? current.map((held) => (held.key === key ? { key, entry } : held)) : current))
      } catch (failure) {
        setFiles((current) => current.filter((held) => held.key !== key))
        onError(failure.message)
      }
    }
    field.current?.focus()
  }

  const latest = useRef(addFiles)
  useEffect(() => {
    latest.current = addFiles
  })
  useImperativeHandle(ref, () => ({ addFiles: (picked) => latest.current(picked), focus: () => field.current?.focus() }), [])

  const removeFile = (key) => {
    const found = files.find((held) => held.key === key)
    setFiles((current) => current.filter((held) => held.key !== key))
    if (found?.entry) api.discardFile(found.entry).catch(() => {})
  }

  const uploading = files.some((file) => !file.entry)
  const body = text.trim()
  const ready = !disabled && !sending && !uploading && (body.length > 0 || files.length > 0) && body.length <= LIMITS.body

  const submit = async () => {
    if (!ready) return
    setSending(true)
    try {
      if (editing) {
        if (body !== editing.body) await onEdit(editing, body)
        onCancelEdit()
      } else {
        const entries = files.map((file) => file.entry)
        setText('')
        setFiles([])
        await onSend({ body, files: entries, replyTo: replyTo?.id || null })
        onCancelReply()
      }
    } finally {
      setSending(false)
      field.current?.focus()
    }
  }

  const onKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      if (editing) onCancelEdit()
      else if (replyTo) onCancelReply()
    } else if (event.key === 'ArrowUp' && !text && !files.length && !editing) {
      event.preventDefault()
      onEditLast()
    }
  }

  const left = LIMITS.body - text.length

  return (
    <div className="border-t border-line bg-surface">
      {editing && <Context icon="pencil" label="Editing" text="Escape to cancel, Enter to save." onClose={onCancelEdit} />}
      {!editing && replyTo && (
        <Context icon="reply" label={`Replying to ${replyTo.author === api.myId() ? 'yourself' : them?.name || 'them'}`} text={previewOf(replyTo)} onClose={onCancelReply} />
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-3 px-3 pt-3">
          {files.map((file) => (
            <Pending key={file.key} file={file} onRemove={() => removeFile(file.key)} />
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 p-2">
        <input
          ref={picker}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={disabled || Boolean(editing) || files.length >= LIMITS.files}
          aria-label="Attach a file"
          title="Attach a file"
          className={ICON_BTN}
        >
          <Icon name="paperclip" className="h-4 w-4" />
        </button>

        <textarea
          ref={field}
          rows={1}
          value={text}
          disabled={disabled}
          maxLength={LIMITS.body + 200}
          placeholder={editing ? 'Edit your message' : `Message ${them?.name || ''}`.trim()}
          aria-label="Message"
          onChange={(event) => {
            setText(event.target.value)
            if (event.target.value.trim()) onTyping?.()
          }}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const pasted = Array.from(event.clipboardData?.files || [])
            if (pasted.length) {
              event.preventDefault()
              addFiles(pasted)
            }
          }}
          className="max-h-[160px] min-h-[32px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] leading-[20px] text-ink-strong outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
        />

        {left < 200 && <span className={`self-center font-mono text-[10.5px] tabular-nums ${left < 0 ? 'text-red-500' : 'text-ink-faint'}`}>{left}</span>}

        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          aria-label={editing ? 'Save' : 'Send'}
          title={editing ? 'Save (Enter)' : 'Send (Enter)'}
          className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg outline-none transition-[background-color,color,opacity] focus-visible:ring-2 focus-visible:ring-ink-strong/25 disabled:cursor-not-allowed ${
            ready ? 'bg-ink-strong text-ink-inverse hover:opacity-90' : 'text-ink-faint'
          }`}
        >
          <Icon name={editing ? 'check' : 'send'} className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
})

export default Composer
