import { useEffect, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { Menu } from '../boards/ui'
import { Face, Picture } from './ui'
import { REACTIONS, clockOf, fullTime, isImage, previewOf, reactionRows } from '../../lib/messages'
import { parseSealed } from '../../lib/messages-crypto'
import { readableSize } from '../../lib/boards-files'

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])/g

function Body({ text, mine }) {
  const parts = String(text || '').split(URL_RE)
  return (
    <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer noopener"
            className={`underline underline-offset-2 ${mine ? 'decoration-ink-inverse/50 hover:decoration-ink-inverse' : 'decoration-line-strong hover:decoration-ink-strong'}`}
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </span>
  )
}

const NOISE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const SCRAMBLE_MS = 520

const calm = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

function Scramble({ text }) {
  const [shown, setShown] = useState(() => (calm() ? text : ''))

  useEffect(() => {
    if (calm()) {
      setShown(text)
      return undefined
    }
    let frame = 0
    const start = performance.now()
    const tick = (now) => {
      const settled = Math.floor(Math.min(1, (now - start) / SCRAMBLE_MS) * text.length)
      let next = text.slice(0, settled)
      for (let index = settled; index < text.length; index += 1) next += NOISE[(Math.random() * NOISE.length) | 0]
      setShown(next)
      if (settled < text.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text])

  return shown
}

function Part({ label, value, mine, strong }) {
  return (
    <span className="grid grid-cols-[52px_minmax(0,1fr)] items-baseline gap-2">
      <span className={`text-[9.5px] font-semibold uppercase tracking-wider ${mine ? 'text-ink-inverse/50' : 'text-ink-faint'}`}>{label}</span>
      <span className={`font-mono text-[11px] leading-snug [overflow-wrap:anywhere] select-all ${strong ? '' : mine ? 'text-ink-inverse/70' : 'text-ink-subtle'}`}>
        <Scramble text={value} />
      </span>
    </span>
  )
}

function Envelope({ message, mine }) {
  const sealed = message.cipher ? parseSealed(message.cipher) : null
  const files = message.files || []
  const sealedFiles = files.filter((file) => file.enc).length
  const head = `mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider ${mine ? 'text-ink-inverse/60' : 'text-ink-faint'}`

  if (!sealed && !message.body && sealedFiles) {
    return (
      <span className={`flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider ${mine ? 'text-ink-inverse/60' : 'text-ink-faint'}`}>
        <Icon name="lock" className="h-3 w-3" />
        {sealedFiles === 1 ? 'Attachment' : `${sealedFiles} attachments`} stored as AES-256-GCM ciphertext
      </span>
    )
  }

  if (!sealed) {
    return (
      <span className="block min-w-0">
        <span className={head}>
          <Icon name="alert" className="h-3 w-3" />
          Sent before encryption was on
        </span>
        {message.body && <span className="block font-mono text-[11px] leading-snug [overflow-wrap:anywhere]">{message.body}</span>}
      </span>
    )
  }

  return (
    <span className="block min-w-0">
      <span className={head}>
        <Icon name="lock" className="h-3 w-3" />
        AES-256-GCM · what the server sees
      </span>
      <span className="flex flex-col gap-1">
        <Part label="nonce" value={sealed.nonce} mine={mine} />
        {sealed.cipher && <Part label="cipher" value={sealed.cipher} mine={mine} strong />}
        <Part label="tag" value={sealed.tag} mine={mine} />
      </span>
      {sealedFiles > 0 && (
        <span className={`mt-1.5 flex items-center gap-1.5 text-[10.5px] ${mine ? 'text-ink-inverse/60' : 'text-ink-faint'}`}>
          <Icon name="paperclip" className="h-3 w-3" />
          {sealedFiles === 1 ? 'The attachment is' : `All ${sealedFiles} attachments are`} encrypted too
        </span>
      )}
    </span>
  )
}

const ACTION = 'grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink-strong'

function Actions({ mine, raw, onRaw, onReact, onReply, onEdit, onUnsend }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm">
      <Menu
        align={mine ? 'end' : 'start'}
        width="w-auto"
        label="React"
        trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} aria-label="React" title="React" className={ACTION}>
            <Icon name="smile" className="h-3.5 w-3.5" />
          </button>
        )}
      >
        <div className="flex items-center gap-0.5 px-0.5">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-[17px] leading-none transition-transform hover:scale-125 hover:bg-surface-hover"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </Menu>
      <button
        type="button"
        onClick={onRaw}
        aria-pressed={raw}
        aria-label={raw ? 'Show decrypted' : 'View encrypted'}
        title={raw ? 'Show decrypted' : 'View encrypted'}
        className={`${ACTION} ${raw ? 'bg-surface-hover text-ink-strong' : ''}`}
      >
        <Icon name={raw ? 'eye' : 'lock'} className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onReply} aria-label="Reply" title="Reply" className={ACTION}>
        <Icon name="reply" className="h-3.5 w-3.5" />
      </button>
      {mine && onEdit && (
        <button type="button" onClick={onEdit} aria-label="Edit" title="Edit" className={ACTION}>
          <Icon name="pencil" className="h-3.5 w-3.5" />
        </button>
      )}
      {mine && (
        <button type="button" onClick={onUnsend} aria-label="Unsend" title="Unsend" className={`${ACTION} hover:text-red-500`}>
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function Quote({ quoted, who, mine, onJump }) {
  const gone = !quoted || quoted.deleted_at
  return (
    <button
      type="button"
      onClick={() => !gone && onJump(quoted.id)}
      disabled={gone}
      className={`mb-1 flex w-full cursor-pointer flex-col gap-0.5 border-l-2 pl-2 text-left disabled:cursor-default ${
        mine ? 'border-ink-inverse/40 text-ink-inverse/80' : 'border-line-strong text-ink-muted'
      }`}
    >
      <span className="text-[10.5px] font-medium uppercase tracking-wider opacity-80">{gone ? 'Reply' : who}</span>
      <span className="line-clamp-2 text-[12px] leading-snug">{gone ? 'That message was unsent.' : previewOf(quoted)}</span>
    </button>
  )
}

function Pictures({ files, mine, onOpen, onGrow }) {
  const single = files.length === 1
  return (
    <div className={`grid gap-1 ${single ? 'grid-cols-1' : 'grid-cols-2'} ${mine ? 'justify-items-end' : ''}`}>
      {files.map((file, index) => (
        <button
          key={file.id}
          type="button"
          onClick={() => onOpen(index)}
          className={`block cursor-zoom-in overflow-hidden rounded-xl border border-line bg-surface-raised ${single ? 'max-w-[280px]' : 'h-[140px] w-[140px]'}`}
          aria-label={`Open ${file.name}`}
        >
          <Picture
            path={file.thumb || file.path}
            sealed={file.enc}
            alt={file.name}
            onLoad={onGrow}
            className={single ? 'block max-h-[320px] min-h-[96px] w-auto min-w-[160px] max-w-full object-contain' : 'h-full w-full object-cover'}
          />
        </button>
      ))}
    </div>
  )
}

function Files({ files, onDownload }) {
  return (
    <div className="flex flex-col gap-1">
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => onDownload(file)}
          className="flex max-w-[280px] cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong"
        >
          <Icon name="file" className="h-4 w-4 shrink-0 text-ink-subtle" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] text-ink-strong">{file.name}</span>
            <span className="block text-[11px] tabular-nums text-ink-faint">{readableSize(file.bytes)}</span>
          </span>
          <Icon name="download" className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        </button>
      ))}
    </div>
  )
}

export default function Bubble({
  row,
  uid,
  them,
  quoted,
  receipt,
  highlight,
  rawAll = false,
  onReact,
  onReply,
  onEdit,
  onUnsend,
  onJump,
  onOpenImage,
  onDownload,
  onRetry,
  onGrow,
}) {
  const { message, mine, first, last } = row
  const pictures = (message.files || []).filter(isImage)
  const documents = (message.files || []).filter((file) => !isImage(file))
  const reactions = reactionRows(message.reactions, uid)
  const hasBody = Boolean(message.body)
  const broken = Boolean(message.broken)
  const pending = Boolean(message.pending)
  const failed = Boolean(message.failed)
  const [rawOne, setRawOne] = useState(null)
  const raw = !pending && !failed && (rawOne ?? rawAll)

  useEffect(() => setRawOne(null), [rawAll])
  useEffect(() => {
    onGrow?.()
  }, [raw, onGrow])

  const corners = mine
    ? `${first ? '' : 'rounded-tr-md'} ${last ? '' : 'rounded-br-md'}`
    : `${first ? '' : 'rounded-tl-md'} ${last ? '' : 'rounded-bl-md'}`

  return (
    <div
      id={`message-${message.id}`}
      data-message
      tabIndex={-1}
      className={`group relative flex items-end gap-2 px-3 outline-none sm:px-4 ${mine ? 'flex-row-reverse' : ''} ${first ? 'mt-2' : 'mt-0.5'} ${
        highlight ? 'animate-pulse' : ''
      } ${pending ? 'opacity-60' : ''}`}
    >
      {!mine && <span className="w-7 shrink-0">{last && <Face name={them?.name} avatar={them?.avatar} size={28} />}</span>}

      <div className={`flex min-w-0 max-w-[min(78%,560px)] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {pictures.length > 0 && <Pictures files={pictures} mine={mine} onOpen={(index) => onOpenImage(message, index)} onGrow={onGrow} />}
        {documents.length > 0 && <div className={pictures.length ? 'mt-1' : ''}><Files files={documents} onDownload={onDownload} /></div>}

        {(hasBody || broken || raw || message.reply_to) && (
          <div
            title={fullTime(message.created_at)}
            className={`${pictures.length || documents.length ? 'mt-1' : ''} rounded-2xl px-3 py-1.5 text-[13px] leading-relaxed ${corners} ${
              mine ? 'bg-ink-strong text-ink-inverse' : 'border border-line bg-surface-raised text-ink-strong'
            } ${raw ? 'max-w-[420px]' : ''}`}
          >
            {raw ? (
              <Envelope message={message} mine={mine} />
            ) : (
              <>
                {message.reply_to && <Quote quoted={quoted} who={quoted && quoted.author === uid ? 'You' : them?.name || 'Them'} mine={mine} onJump={onJump} />}
                {hasBody && <Body text={message.body} mine={mine} />}
                {broken && (
                  <span className={`flex items-center gap-1.5 italic ${mine ? 'text-ink-inverse/70' : 'text-ink-muted'}`} title={message.why || ''}>
                    <Icon name="lock" className="h-3.5 w-3.5 shrink-0 not-italic" />
                    {message.broken === 'tampered' ? 'Failed its integrity check — not shown' : 'Could not be decrypted'}
                  </span>
                )}
                {message.edited_at && <span className={`ml-1.5 text-[10.5px] ${mine ? 'text-ink-inverse/60' : 'text-ink-faint'}`}>edited</span>}
              </>
            )}
          </div>
        )}

        {reactions.length > 0 && (
          <div className={`-mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''} relative z-[1]`}>
            {reactions.map((held) => (
              <button
                key={held.emoji}
                type="button"
                onClick={() => onReact(message, held.emoji)}
                aria-pressed={held.mine}
                title={held.mine ? 'Remove your reaction' : 'React the same'}
                className={`inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border bg-surface px-1.5 text-[11px] tabular-nums transition-colors ${
                  held.mine ? 'border-line-strong text-ink-strong' : 'border-line text-ink-muted hover:border-line-strong'
                }`}
              >
                <span className="text-[12px] leading-none">{held.emoji}</span>
                {held.count > 1 && <span>{held.count}</span>}
              </button>
            ))}
          </div>
        )}

        {failed && (
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-red-500">
            <Icon name="alert" className="h-3 w-3" />
            Not sent
            <button type="button" onClick={() => onRetry(message)} className="cursor-pointer font-medium underline underline-offset-2">
              Try again
            </button>
          </p>
        )}
        {!failed && receipt && (
          <p className="mt-0.5 text-[10.5px] text-ink-faint">{receipt === 'seen' ? 'Seen' : pending ? 'Sending' : 'Sent'}</p>
        )}
      </div>

      {!pending && !failed && (
        <div className="flex shrink-0 items-center gap-2 self-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          <Actions
            mine={mine}
            raw={raw}
            onRaw={() => setRawOne(!raw)}
            onReact={(emoji) => onReact(message, emoji)}
            onReply={() => onReply(message)}
            onEdit={hasBody ? () => onEdit(message) : null}
            onUnsend={() => onUnsend(message)}
          />
          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] tabular-nums text-ink-faint">
            {message.secure && <Icon name="lock" className="h-2.5 w-2.5" />}
            {clockOf(message.created_at)}
          </span>
        </div>
      )}
    </div>
  )
}
