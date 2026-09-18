import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { BTN_QUIET, Empty, Note } from './components/boards/ui'
import Thread from './components/messages/thread'
import Inbox from './components/messages/inbox'
import { InboxSkeleton, ThreadSkeleton } from './components/messages/ui'
import { Bone, Loading } from './components/skeleton'
import { inboxUnread, readHash } from './lib/messages'
import * as api from './lib/messages-api'
import { refreshUnread, setUnread } from './lib/messages-unread'
import { dashboardPath, navigate } from './lib/router'

const HEIGHT = 'h-[calc(100dvh-56px-48px)] min-h-[480px] sm:h-[calc(100dvh-56px-64px)]'
const CARD = 'rounded-xl border border-line bg-surface'

function Heading({ title, blurb, aside, hidden }) {
  return (
    <div className={`mb-5 flex-wrap items-end justify-between gap-x-6 gap-y-3 animate-rise-in ${hidden ? 'hidden md:flex' : 'flex'}`}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-strong">{title}</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-muted">{blurb}</p>
      </div>
      {aside}
    </div>
  )
}

function OwnerInbox({ uid, threadId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const pending = useRef(null)

  const load = useCallback(async () => {
    try {
      setRows(await api.fetchInbox())
      setError(null)
    } catch (failure) {
      setError(failure.message)
    }
  }, [])

  const reload = useCallback(() => {
    clearTimeout(pending.current)
    pending.current = setTimeout(load, 250)
  }, [load])

  useEffect(() => {
    load()
    const room = api.lobby(true, { onMessage: reload, onThread: reload })
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 30_000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      room.leave()
      clearInterval(timer)
      clearTimeout(pending.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, reload])

  useEffect(() => {
    if (rows) setUnread(inboxUnread(rows))
  }, [rows])

  const open = useCallback((id) => navigate(dashboardPath(id ? `messages/${id}` : 'messages')), [])
  const active = useMemo(() => (rows || []).find((row) => row.id === threadId) || null, [rows, threadId])

  useEffect(() => {
    if (rows && threadId && !active) open(null)
  }, [rows, threadId, active, open])

  const unread = rows ? inboxUnread(rows) : 0

  return (
    <div className={`flex flex-col ${HEIGHT}`}>
      <Heading
        title="Messages"
        blurb={rows === null ? 'Every conversation people have opened with you.' : unread ? `${unread} unread across ${rows.length} conversation${rows.length === 1 ? '' : 's'}.` : `${rows.length} conversation${rows.length === 1 ? '' : 's'}, all read.`}
        hidden={Boolean(active)}
      />

      {error && (
        <div className="mb-3">
          <Note tone="error" onDismiss={() => setError(null)}>
            {error}
          </Note>
        </div>
      )}

      <div className={`${CARD} flex min-h-0 flex-1 overflow-hidden`}>
        <aside className={`w-full shrink-0 md:w-[320px] md:border-r md:border-line ${active ? 'hidden md:block' : ''}`}>
          {rows === null ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-14 shrink-0 items-center border-b border-line px-3"><Bone className="h-7 w-full rounded-lg" /></div>
              <InboxSkeleton />
            </div>
          ) : (
            <Inbox rows={rows} activeId={threadId} onOpen={open} />
          )}
        </aside>

        <section className={`min-w-0 flex-1 ${active ? '' : 'hidden md:block'}`}>
          {active ? (
            <Thread
              key={active.id}
              thread={active}
              them={active}
              owner
              uid={uid}
              onBack={() => open(null)}
              onDeleted={() => {
                open(null)
                load()
              }}
              onSeen={(id) => setRows((current) => (current || []).map((row) => (row.id === id ? { ...row, unread: 0 } : row)))}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <Icon name="message" className="h-5 w-5 text-ink-faint" />
              <p className="text-[13px] font-semibold tracking-tight text-ink-strong">{rows?.length ? 'Pick a conversation' : 'Your inbox'}</p>
              <p className="max-w-[280px] text-[12px] leading-relaxed text-ink-muted">
                {rows?.length ? 'Open one on the left to read and reply.' : 'Anyone with an account can write to you from here. Their messages land on the left.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MemberThread({ uid }) {
  const [thread, setThread] = useState(null)
  const [owner, setOwner] = useState(null)
  const [online, setOnline] = useState(false)
  const [error, setError] = useState(null)
  const [gone, setGone] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([api.openThread(), api.fetchOwner()]).then(
      ([row, who]) => {
        if (!alive) return
        setThread(row)
        setOwner(who)
      },
      (failure) => alive && setError(failure.message),
    )
    return () => {
      alive = false
    }
  }, [gone])

  useEffect(() => {
    const room = api.lobby(false, { onOwnerHere: setOnline })
    return () => room.leave()
  }, [])

  const them = owner || { name: 'The owner', avatar: null, handle: null }

  return (
    <div className={`flex flex-col ${HEIGHT}`}>
      <Heading title="Messages" blurb={`A direct line to ${them.name}. Only the two of you can read it.`} />

      {error && (
        <div className="mb-3">
          <Note tone="error" onDismiss={() => setError(null)}>
            {error}
          </Note>
        </div>
      )}

      <div className={`${CARD} flex min-h-0 flex-1 overflow-hidden`}>
        {thread ? (
          <div className="min-w-0 flex-1">
            <Thread key={thread.id} thread={thread} them={them} owner={false} uid={uid} online={online} onDeleted={() => setGone((held) => held + 1)} />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            {!error && (
              <>
                <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4"><Bone className="h-8 w-8 rounded-full" /><Bone className="h-3 w-28" /></div>
                <div className="min-h-0 flex-1"><ThreadSkeleton /></div>
                <div className="shrink-0 border-t border-line p-3"><Bone className="h-9 w-full rounded-lg" /></div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardMessages({ hash, user }) {
  const [role, setRole] = useState(null)
  const [setup, setSetup] = useState(false)
  const [error, setError] = useState(null)
  const { thread } = readHash(hash)

  const decide = useCallback(() => {
    setSetup(false)
    setError(null)
    api.amOwner().then(
      (owner) => setRole(owner ? 'owner' : 'member'),
      (failure) => {
        if (failure.setup) setSetup(true)
        else setError(failure.message)
      },
    )
  }, [])

  useEffect(() => {
    decide()
    refreshUnread()
  }, [decide])

  if (setup) {
    return (
      <>
        <Heading title="Messages" blurb="A private line between every account and you." />
        <Empty
          icon="alert"
          title="Messages are not set up on this project yet"
          body="They keep their data in two Postgres tables and a storage bucket. Open the Supabase SQL editor, paste deploy/supabase/messages.sql and run it — then reload this page."
          action={
            <button type="button" onClick={decide} className={BTN_QUIET}>
              <Icon name="refresh" className="h-3.5 w-3.5" />
              Try again
            </button>
          }
        />
      </>
    )
  }

  if (error) {
    return (
      <>
        <Heading title="Messages" blurb="A private line between every account and you." />
        <Note tone="error">{error}</Note>
      </>
    )
  }

  if (!role) {
    return (
      <div className={`flex flex-col ${HEIGHT}`}>
        <Heading title="Messages" blurb="A private line between your account and the owner." />
        <Loading label="Opening messages" className={`${CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4"><Bone className="h-8 w-8 rounded-full" /><Bone className="h-3 w-28" /></div>
          <div className="min-h-0 flex-1"><ThreadSkeleton /></div>
          <div className="shrink-0 border-t border-line p-3"><Bone className="h-9 w-full rounded-lg" /></div>
        </Loading>
      </div>
    )
  }

  return role === 'owner' ? <OwnerInbox uid={user.id} threadId={thread} /> : <MemberThread uid={user.id} />
}
