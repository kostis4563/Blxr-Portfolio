import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../dashboard-sidebar'
import { BTN_BARE, BTN_QUIET, BTN_RISK, CAPS, Menu, MenuItem, MenuLine, Note, Sheet } from '../boards/ui'
import { Face, Lightbox, ThreadSkeleton, TypingDots } from './ui'
import Bubble from './bubble'
import Composer from './composer'
import { TYPING_FOR, isImage, layout, mergeMessages, newestStamp, seenUpTo, toggleReaction, unreadIn } from '../../lib/messages'
import * as api from '../../lib/messages-api'
import { refreshUnread } from '../../lib/messages-unread'
import { profilePath } from '../../lib/router'
import { Sensitive } from '../sensitive'

const NEAR_BOTTOM = 96
const POLL_LIVE = 30_000
const POLL_FALLBACK = 8_000

const tmpId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function Divider({ label }) {
  return (
    <div className="my-3 flex items-center gap-3 px-4" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-line" />
      <span className={CAPS}>{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export default function Thread({ thread: given, them, owner, uid, online = false, onBack, onDeleted, onSeen }) {
  const threadId = given.id
  const [thread, setThread] = useState(given)
  const [messages, setMessages] = useState(null)
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [typingUntil, setTypingUntil] = useState(0)
  const [here, setHere] = useState(false)
  const [liveState, setLiveState] = useState('JOINING')
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [unsending, setUnsending] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [below, setBelow] = useState(0)
  const [flash, setFlash] = useState(null)
  const [landed, setLanded] = useState(0)

  const list = useRef(null)
  const composer = useRef(null)
  const stick = useRef(true)
  const channel = useRef(null)
  const held = useRef([])
  held.current = messages || []

  const mine = useCallback((message) => message.author === uid, [uid])

  useEffect(() => setThread(given), [given])

  const merge = useCallback((incoming) => {
    setMessages((current) => mergeMessages(current || [], Array.isArray(incoming) ? incoming : [incoming]))
  }, [])

  useEffect(() => {
    let alive = true
    setMessages(null)
    setError(null)
    setReplyTo(null)
    setEditing(null)
    setBelow(0)
    stick.current = true
    api.fetchMessages(threadId).then(
      ({ messages: rows, more: rest }) => {
        if (!alive) return
        setMessages(rows)
        setMore(rest)
      },
      (failure) => alive && setError(failure.message),
    )
    return () => {
      alive = false
    }
  }, [threadId])

  const loadMore = async () => {
    const oldest = held.current[0]
    if (!oldest || loadingMore) return
    setLoadingMore(true)
    const node = list.current
    const before = node ? node.scrollHeight - node.scrollTop : 0
    try {
      const { messages: rows, more: rest } = await api.fetchMessages(threadId, { before: oldest.created_at })
      merge(rows)
      setMore(rest)
      requestAnimationFrame(() => {
        if (node) node.scrollTop = node.scrollHeight - before
      })
    } catch (failure) {
      setError(failure.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const refresh = useCallback(async () => {
    if (document.visibilityState !== 'visible') return
    const since = newestStamp(held.current)
    try {
      const [rows, stamps] = await Promise.all([since ? api.fetchChanged(threadId, since) : api.fetchMessages(threadId).then((page) => page.messages), api.fetchThread(threadId)])
      if (rows.length) merge(rows)
      setThread(stamps)
    } catch (failure) {
      if (failure.status === 404) onDeleted?.()
    }
  }, [threadId, merge, onDeleted])

  useEffect(() => {
    const every = liveState === 'SUBSCRIBED' ? POLL_LIVE : POLL_FALLBACK
    const timer = setInterval(refresh, every)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh, liveState])

  useEffect(() => {
    const live = api.live(threadId, {
      onMessage: (row) => merge(row),
      onThread: (row) => setThread(row),
      onTyping: () => setTypingUntil(Date.now() + TYPING_FOR),
      onPresence: (others) => setHere(others.length > 0),
      onStatus: (status) => setLiveState(status),
    })
    channel.current = live
    return () => {
      live.leave()
      channel.current = null
      setHere(false)
      setLiveState('CLOSED')
    }
  }, [threadId, merge])

  useEffect(() => {
    if (!typingUntil) return undefined
    const timer = setTimeout(() => setTypingUntil(0), Math.max(0, typingUntil - Date.now()))
    return () => clearTimeout(timer)
  }, [typingUntil])

  const mySeenAt = owner ? thread.owner_seen_at : thread.member_seen_at
  const theirSeenAt = owner ? thread.member_seen_at : thread.owner_seen_at
  const unread = useMemo(() => (messages ? unreadIn(messages, mine, mySeenAt) : 0), [messages, mine, mySeenAt])

  useEffect(() => {
    if (!unread || document.visibilityState !== 'visible' || !stick.current) return undefined
    const timer = setTimeout(async () => {
      try {
        await api.markSeen(threadId)
        const now = new Date().toISOString()
        setThread((current) => ({ ...current, [owner ? 'owner_seen_at' : 'member_seen_at']: now }))
        onSeen?.(threadId)
        refreshUnread()
      } catch {
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [unread, threadId, owner, onSeen, messages, landed])

  const toBottom = useCallback((smooth = false) => {
    const node = list.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    stick.current = true
    setBelow(0)
  }, [])

  const onScroll = () => {
    const node = list.current
    if (!node) return
    const near = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM
    if (near && !stick.current) setLanded((held) => held + 1)
    stick.current = near
    if (near) setBelow(0)
  }

  const count = messages ? messages.length : 0
  const lastId = messages?.[count - 1]?.id
  const seenLast = useRef(null)
  useEffect(() => {
    if (!messages) return
    const grew = lastId !== seenLast.current
    seenLast.current = lastId
    if (stick.current) {
      toBottom()
    } else if (grew) {
      const last = messages[messages.length - 1]
      if (last && !mine(last) && !last.deleted_at) setBelow((held) => held + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, count])

  const onGrow = useCallback(() => {
    if (stick.current) toBottom()
  }, [toBottom])

  useEffect(() => {
    if (typingUntil && stick.current) toBottom()
  }, [typingUntil, toBottom])

  const jump = (id) => {
    const node = document.getElementById(`message-${id}`)
    if (!node) return
    node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlash(id)
    setTimeout(() => setFlash(null), 1200)
  }

  const send = async ({ body, files, replyTo: quoted }) => {
    const now = new Date().toISOString()
    const draft = {
      id: tmpId(),
      thread_id: threadId,
      author: uid,
      from_owner: owner,
      body,
      files,
      reply_to: quoted,
      reactions: {},
      edited_at: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      pending: true,
    }
    stick.current = true
    setMessages((current) => [...(current || []), draft])
    try {
      const row = await api.sendMessage(threadId, { body, files, replyTo: quoted })
      setMessages((current) => mergeMessages((current || []).filter((message) => message.id !== draft.id), [row]))
    } catch (failure) {
      setMessages((current) => (current || []).map((message) => (message.id === draft.id ? { ...message, pending: false, failed: true, error: failure.message } : message)))
      if (failure.setup) setError(failure.message)
    }
  }

  const retry = async (failed) => {
    setMessages((current) => (current || []).filter((message) => message.id !== failed.id))
    await send({ body: failed.body, files: failed.files, replyTo: failed.reply_to })
  }

  const edit = async (message, body) => {
    try {
      merge(await api.editMessage(message.id, body))
    } catch (failure) {
      setError(failure.message)
    }
  }

  const react = async (message, emoji) => {
    if (message.pending || message.failed) return
    const next = toggleReaction(message.reactions, emoji, uid)
    merge({ ...message, reactions: next, updated_at: new Date().toISOString() })
    try {
      merge(await api.reactMessage(message.id, next))
    } catch (failure) {
      merge({ ...message, updated_at: new Date().toISOString() })
      setError(failure.message)
    }
  }

  const unsend = async () => {
    const message = unsending
    if (!message) return
    setBusy(true)
    try {
      if (message.pending || message.failed) {
        setMessages((current) => (current || []).filter((held) => held.id !== message.id))
      } else {
        merge(await api.unsendMessage(message))
      }
      setUnsending(null)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      await api.deleteThread(threadId)
      setClearing(false)
      onDeleted?.()
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  const editLast = () => {
    const last = [...held.current].reverse().find((message) => mine(message) && !message.deleted_at && message.body && !message.pending && !message.failed)
    if (last) {
      setReplyTo(null)
      setEditing(last)
    }
  }

  const [dragging, setDragging] = useState(false)
  const drops = useRef(0)

  const rows = useMemo(() => (messages ? layout(messages, mine) : []), [messages, mine])
  const byId = useMemo(() => new Map((messages || []).map((message) => [message.id, message])), [messages])
  const seenId = useMemo(() => (messages ? seenUpTo(messages, mine, theirSeenAt) : null), [messages, mine, theirSeenAt])
  const lastMineId = useMemo(() => {
    for (let index = (messages || []).length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (mine(message) && !message.deleted_at) return message.id
    }
    return null
  }, [messages, mine])

  const typing = typingUntil > Date.now()
  const present = here || online
  const status = typing ? 'typing' : present ? 'Online' : owner ? them?.email || '' : them?.handle ? `@${them.handle}` : ''

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onDragEnter={(event) => {
        if (!event.dataTransfer?.types?.includes('Files')) return
        drops.current += 1
        setDragging(true)
      }}
      onDragLeave={() => {
        drops.current = Math.max(0, drops.current - 1)
        if (drops.current === 0) setDragging(false)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        drops.current = 0
        setDragging(false)
        composer.current?.addFiles(event.dataTransfer?.files)
      }}
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-3 sm:px-4">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back to the inbox" className={`${BTN_BARE} -ml-2 h-8 w-8 px-0 md:hidden`}>
            <Icon name="arrowLeft" className="h-4 w-4" />
          </button>
        )}
        <Face name={them?.name} avatar={them?.avatar} size={32} online={present} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold tracking-tight text-ink-strong">{them?.name || 'Conversation'}</p>
          <p className="flex min-h-[15px] items-center gap-1.5 truncate text-[11.5px] text-ink-subtle">
            {status === 'typing' ? (
              <>
                <TypingDots />
                <span>typing</span>
              </>
            ) : owner && status && status !== 'Online' ? (
              <Sensitive className="font-mono text-[11px]">{status}</Sensitive>
            ) : (
              <span className={status === 'Online' ? 'text-ink-muted' : 'font-mono text-[11px]'}>{status}</span>
            )}
          </p>
        </div>
        {(them?.handle || owner) && (
          <Menu
            label="Conversation"
            trigger={({ toggle, open }) => (
              <button type="button" onClick={toggle} aria-expanded={open} aria-label="More" className={`${BTN_BARE} h-8 w-8 px-0`}>
                <Icon name="dots" className="h-4 w-4" />
              </button>
            )}
          >
            {them?.handle && (
              <MenuItem icon="arrowUpRight" onClick={() => window.open(profilePath(them.handle), '_blank', 'noopener')}>
                Open profile
              </MenuItem>
            )}
            {owner && them?.email && (
              <MenuItem icon="copy" onClick={() => navigator.clipboard?.writeText(them.email).catch(() => {})}>
                Copy email
              </MenuItem>
            )}
            {owner && (
              <>
                <MenuLine />
                <MenuItem icon="trash" tone="danger" onClick={() => setClearing(true)}>
                  Clear conversation
                </MenuItem>
              </>
            )}
          </Menu>
        )}
      </div>

      {error && (
        <div className="px-3 pt-3 sm:px-4">
          <Note tone="error" onDismiss={() => setError(null)}>
            {error}
          </Note>
        </div>
      )}

      <div ref={list} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
        {messages === null ? (
          <ThreadSkeleton />
        ) : messages.filter((message) => !message.deleted_at).length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <Face name={them?.name} avatar={them?.avatar} size={56} />
            <div>
              <p className="text-[13.5px] font-semibold tracking-tight text-ink-strong">{them?.name || 'Conversation'}</p>
              <p className="mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-ink-muted">
                {owner ? 'Nothing here yet. What they write, and what you reply, will show up here.' : 'This is a private line. Only the two of you can read it — say hi.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {more && (
              <div className="flex justify-center pb-2">
                <button type="button" onClick={loadMore} disabled={loadingMore} className={`${BTN_QUIET} h-7 text-[11.5px]`}>
                  {loadingMore ? 'Loading…' : 'Earlier messages'}
                </button>
              </div>
            )}
            {rows.map((row) =>
              row.kind === 'day' ? (
                <Divider key={row.key} label={row.label} />
              ) : (
                <Bubble
                  key={row.key}
                  row={row}
                  uid={uid}
                  them={them}
                  quoted={row.message.reply_to ? byId.get(row.message.reply_to) || null : null}
                  receipt={row.mine && row.message.id === lastMineId ? (row.message.id === seenId ? 'seen' : 'sent') : null}
                  highlight={flash === row.message.id}
                  onReact={react}
                  onReply={(message) => {
                    setEditing(null)
                    setReplyTo(message)
                  }}
                  onEdit={(message) => {
                    setReplyTo(null)
                    setEditing(message)
                  }}
                  onUnsend={setUnsending}
                  onJump={jump}
                  onOpenImage={(message, at) => setLightbox({ files: (message.files || []).filter(isImage), at })}
                  onDownload={(file) => api.downloadFile(file).catch((failure) => setError(failure.message))}
                  onRetry={retry}
                  onGrow={onGrow}
                />
              ),
            )}
            {typing && (
              <div className="mt-2 flex items-end gap-2 px-3 sm:px-4">
                <Face name={them?.name} avatar={them?.avatar} size={28} />
                <span className="inline-flex h-8 items-center rounded-2xl rounded-bl-md border border-line bg-surface-raised px-3">
                  <TypingDots />
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {below > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[68px] flex justify-center">
          <button type="button" onClick={() => toBottom(true)} className={`${BTN_SOLID_PILL} pointer-events-auto`}>
            <Icon name="arrowDown" className="h-3.5 w-3.5" />
            {below === 1 ? '1 new message' : `${below} new messages`}
          </button>
        </div>
      )}

      <Composer
        ref={composer}
        threadId={threadId}
        them={them}
        disabled={messages === null}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSend={send}
        onEdit={edit}
        onTyping={() => channel.current?.typing()}
        onEditLast={editLast}
        onError={setError}
      />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-line-strong bg-surface/80 backdrop-blur-sm">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink-strong">
            <Icon name="paperclip" className="h-4 w-4" />
            Drop to attach
          </p>
        </div>
      )}

      {lightbox && (
        <Lightbox
          files={lightbox.files}
          at={lightbox.at}
          onStep={(step) => setLightbox((held) => ({ ...held, at: (held.at + step + held.files.length) % held.files.length }))}
          onClose={() => setLightbox(null)}
          onDownload={(file) => api.downloadFile(file).catch((failure) => setError(failure.message))}
        />
      )}

      {unsending && (
        <Sheet
          size="sm"
          title="Unsend this message?"
          subtitle="It disappears for both of you. Anything attached to it is removed as well."
          onClose={() => !busy && setUnsending(null)}
          busy={busy}
          footer={
            <>
              <button type="button" onClick={() => setUnsending(null)} disabled={busy} className={BTN_QUIET}>
                Keep it
              </button>
              <button type="button" onClick={unsend} disabled={busy} className={BTN_RISK}>
                Unsend
              </button>
            </>
          }
        >
          <p className="line-clamp-4 rounded-lg border border-line bg-surface-raised/50 px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
            {unsending.body || `${(unsending.files || []).length} file${(unsending.files || []).length === 1 ? '' : 's'}`}
          </p>
        </Sheet>
      )}

      {clearing && (
        <Sheet
          size="sm"
          title="Clear this conversation?"
          subtitle={`Every message with ${them?.name || 'them'} is deleted, on both sides, along with any files. They can start a new one at any time.`}
          onClose={() => !busy && setClearing(false)}
          busy={busy}
          footer={
            <>
              <button type="button" onClick={() => setClearing(false)} disabled={busy} className={BTN_QUIET}>
                Cancel
              </button>
              <button type="button" onClick={clear} disabled={busy} className={BTN_RISK}>
                Clear conversation
              </button>
            </>
          }
        />
      )}
    </div>
  )
}

const BTN_SOLID_PILL =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-ink-strong px-3 text-[12px] font-medium text-ink-inverse shadow-lg transition-opacity hover:opacity-90 animate-menu-in'
