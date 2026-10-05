import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRoutePath } from '../lib/router'
import { toast } from '../lib/figma'
import { reducedMotion } from '../lib/memes'
import {
  MAX_LENGTH,
  addComment,
  commentsOn,
  editComment,
  focusComment,
  removeComment,
  restoreComments,
  setResolved,
  shortAgo,
  startCommenting,
  stopCommenting,
  toggleCommentsHidden,
  useComments,
  useCommentsHidden,
  useCommentsPlacing,
  useFocusedComment,
} from '../lib/comments'
import { Toasts, isTyping, finePointer } from './figma'

const CARD_WIDTH = 264

const PATHS = {
  check: 'M4.5 12.75l5 5 10-10.5',
  reopen: 'M4 12a8 8 0 1 0 2.34-5.66M4 4v4h4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  edit: 'M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4z',
  close: 'M6 6l12 12M18 6L6 18',
}

function Glyph({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

function YouAvatar() {
  return (
    <span aria-hidden="true" className="fig-avatar cm-you">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="9.5" r="3.5" />
        <path d="M5.5 19.5c1.3-3 3.7-4.5 6.5-4.5s5.2 1.5 6.5 4.5" />
      </svg>
    </span>
  )
}

const docWidth = () => document.documentElement.clientWidth

function insideFixed(el) {
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).position === 'fixed') return true
  }
  return false
}

function capture(clientX, clientY) {
  const point = {
    x: (clientX + window.scrollX) / Math.max(docWidth(), 1),
    y: clientY + window.scrollY,
    anchor: null,
  }
  const target = document.elementFromPoint(clientX, clientY)
  if (!target || target.closest('.cm-layer') || insideFixed(target)) return point
  const host = target.closest('[id]:not(#root)')
  if (!host || host === document.body) return point
  const rect = host.getBoundingClientRect()
  if (rect.width < 1) return point
  point.anchor = { id: host.id, fx: (clientX - rect.left) / rect.width, dy: clientY - rect.top }
  return point
}

function resolve(spot) {
  const host = spot.anchor && document.getElementById(spot.anchor.id)
  if (host) {
    const rect = host.getBoundingClientRect()
    if (rect.width || rect.height) {
      return [rect.left + window.scrollX + spot.anchor.fx * rect.width, rect.top + window.scrollY + spot.anchor.dy]
    }
  }
  return [spot.x * docWidth(), spot.y]
}

function placeStyle(spot) {
  const [left, top] = resolve(spot)
  const width = docWidth()
  const x = Math.min(Math.max(left, 8), width - 38)
  const cardWidth = Math.min(CARD_WIDTH, width - 16)

  let card
  if (x + 40 + cardWidth <= width - 8) card = { left: 40, top: -30 }
  else if (x - 10 - cardWidth >= 8) card = { left: -10 - cardWidth, top: -30 }
  else card = { left: Math.min(Math.max(8, x - cardWidth / 2), width - 8 - cardWidth) - x, top: 8 }

  return {
    style: { left: x, top: Math.max(top, 36) },
    card: { ...card, width: cardWidth, transformOrigin: card.left < 0 ? 'top right' : 'top left' },
  }
}

function Composer({ spot, onDone }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const path = useRoutePath()
  const { style, card } = placeStyle(spot)

  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])

  const post = () => {
    const comment = addComment({ path, text, x: spot.x, y: spot.y, anchor: spot.anchor })
    onDone()
    if (comment) toast('Comment saved on this device', '', { label: 'Undo', run: () => removeComment(comment.id) })
  }

  return (
    <div className="cm-spot" style={style}>
      <span aria-hidden="true" className="cm-pin cm-pin-draft">
        <YouAvatar />
      </span>
      <div className="cm-card cm-composer" style={{ ...card, top: card.top - 4 }}>
        <textarea
          ref={ref}
          value={text}
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder="Add a comment"
          aria-label="New comment"
          spellCheck
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (!text.trim()) onDone() }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onDone()
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (text.trim()) post()
            }
          }}
        />
        <div className="cm-composer-foot">
          <span>Only saved in this browser</span>
          <button
            type="button"
            className="cm-send"
            aria-label="Post comment"
            disabled={!text.trim()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={post}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function Pin({ comment, number, open, onToggle, onClose }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(comment.text)
  const editRef = useRef(null)
  const wrapRef = useRef(null)
  const { style, card } = placeStyle(comment)

  useEffect(() => {
    if (!open) setEditing(false)
  }, [open])

  useLayoutEffect(() => {
    if (!editing) return
    const el = editRef.current
    el?.focus({ preventScroll: true })
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target) && !e.target.closest?.('.fig-toast-region')) onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, onClose])

  const startEdit = () => {
    setText(comment.text)
    setEditing(true)
  }

  const saveEdit = () => {
    setEditing(false)
    if (text.trim() === comment.text) return
    if (!text.trim()) remove()
    else editComment(comment.id, text)
  }

  const remove = () => {
    const removed = removeComment(comment.id)
    onClose()
    if (removed) toast('Comment deleted', '', { label: 'Undo', run: () => restoreComments([removed]) })
  }

  const toggleResolved = () => {
    setResolved(comment.id, !comment.resolved)
    toast(comment.resolved ? 'Comment reopened' : 'Comment resolved')
  }

  return (
    <div
      ref={wrapRef}
      className="cm-spot"
      style={style}
      data-open={open ? '' : undefined}
      data-resolved={comment.resolved ? '' : undefined}
    >
      <button
        type="button"
        className="cm-pin"
        aria-expanded={open}
        aria-label={`Comment ${number}${comment.resolved ? ', resolved' : ''}: ${comment.text}`}
        onClick={onToggle}
      >
        <span className="fig-avatar">{number}</span>
      </button>

      {open && (
        <div
          className="cm-card"
          style={card}
          role="dialog"
          aria-label={`Comment ${number}`}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            if (editing) setEditing(false)
            else onClose()
          }}
        >
          <div className="cm-head">
            <YouAvatar />
            <span className="cm-name">You</span>
            <time className="cm-time" dateTime={comment.at} title={new Date(comment.at).toLocaleString()}>
              {shortAgo(comment.at)}
              {comment.edited && ' · edited'}
            </time>
            <span className="cm-tools">
              <button type="button" className="cm-tool" onClick={toggleResolved} title={comment.resolved ? 'Reopen' : 'Resolve'} aria-label={comment.resolved ? 'Reopen' : 'Resolve'} aria-pressed={comment.resolved}>
                <Glyph name={comment.resolved ? 'reopen' : 'check'} />
              </button>
              {!editing && (
                <button type="button" className="cm-tool" onClick={startEdit} title="Edit" aria-label="Edit">
                  <Glyph name="edit" />
                </button>
              )}
              <button type="button" className="cm-tool" onClick={remove} title="Delete" aria-label="Delete">
                <Glyph name="trash" />
              </button>
              <button type="button" className="cm-tool" onClick={onClose} title="Close" aria-label="Close">
                <Glyph name="close" />
              </button>
            </span>
          </div>

          {editing ? (
            <textarea
              ref={editRef}
              className="cm-edit"
              value={text}
              rows={1}
              maxLength={MAX_LENGTH}
              aria-label="Edit comment"
              onChange={(e) => setText(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  saveEdit()
                }
              }}
            />
          ) : (
            <p className="cm-text" onDoubleClick={startEdit}>
              {comment.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function CommentLayer() {
  const path = useRoutePath()
  const all = useComments()
  const hidden = useCommentsHidden()
  const placing = useCommentsPlacing()
  const focusId = useFocusedComment()

  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [, setLayout] = useState(0)
  const pointer = useRef(null)

  const comments = useMemo(() => commentsOn(all, path), [all, path])
  const tracking = mounted && (comments.length > 0 || draft !== null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    setDraft(null)
    setOpenId(null)
  }, [path])

  useEffect(() => {
    const onMove = (e) => {
      if (e.pointerType === 'mouse') pointer.current = [e.clientX, e.clientY]
    }
    const onLeave = () => { pointer.current = null }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)

    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return
      if (e.key === '/') {
        e.preventDefault()
        setOpenId(null)
        if (pointer.current && finePointer()) {
          if (hidden) toggleCommentsHidden()
          setDraft(capture(...pointer.current))
        } else {
          startCommenting()
        }
      } else if (e.key === 'C' && e.shiftKey) {
        e.preventDefault()
        toggleCommentsHidden()
        toast(hidden ? 'Comments shown' : 'Comments hidden', '⇧C')
      } else if (e.key === 'Escape' && placing) {
        stopCommenting()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('keydown', onKey)
    }
  }, [hidden, placing])

  useEffect(() => {
    if (placing) toast('Click anywhere to leave a comment', 'esc')
  }, [placing])

  useEffect(() => {
    if (!tracking) return
    let frame = 0
    const bump = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setLayout((n) => n + 1))
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(bump)
    observer?.observe(document.body)
    window.addEventListener('resize', bump)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', bump)
    }
  }, [tracking])

  useEffect(() => {
    if (!focusId || !mounted) return
    const target = all.find((c) => c.id === focusId)
    if (!target) {
      focusComment(null)
      return
    }
    if (target.path !== path) return
    const timer = setTimeout(() => {
      focusComment(null)
      setOpenId(target.id)
      const [, top] = resolve(target)
      window.scrollTo({ top: Math.max(0, top - window.innerHeight / 3), behavior: reducedMotion() ? 'auto' : 'smooth' })
    }, 160)
    return () => clearTimeout(timer)
  }, [focusId, all, path, mounted])

  if (!mounted) return null

  const closeCard = () => setOpenId(null)

  return createPortal(
    <>
      <div className="cm-layer" role="region" aria-label="Your comments">
        {!hidden &&
          comments.map((comment, i) => (
            <Pin
              key={comment.id}
              comment={comment}
              number={i + 1}
              open={openId === comment.id}
              onToggle={() => setOpenId((id) => (id === comment.id ? null : comment.id))}
              onClose={closeCard}
            />
          ))}
        {draft && <Composer key={`${draft.x}:${draft.y}`} spot={draft} onDone={() => setDraft(null)} />}
      </div>

      {placing && (
        <div
          className="cm-placing"
          aria-hidden="true"
          onClick={(e) => {
            e.currentTarget.style.pointerEvents = 'none'
            stopCommenting()
            setOpenId(null)
            setDraft(capture(e.clientX, e.clientY))
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            stopCommenting()
          }}
        />
      )}

      <Toasts />
    </>,
    document.body
  )
}
