import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { Field, INPUT, TEXTAREA, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, Toggle, Modal, CopyButton } from './components/settings-ui'
import { Note, Empty, CARD, CAPS, Menu, MenuItem, MenuLabel, MenuLine, PointerMenu, InlineEdit, SaveMark, UndoBar } from './components/boards/ui'
import Slide from './components/presentations/slide'
import Presenter, { enterFullscreen } from './components/presentations/presenter'
import DeckPrint from './components/presentations/print'
import { navigate, dashboardPath, link } from './lib/router'
import {
  LIMITS,
  THEMES,
  TONES,
  TRANSITIONS,
  LAYOUTS,
  TEMPLATES,
  DEFAULT_THEME,
  DEFAULT_TITLE,
  layoutOf,
  themeOf,
  paletteOf,
  newSlide,
  duplicateSlide,
  moveSlide,
  sectionNumber,
  sectionTitle,
  slideLabel,
  sampleSlide,
  templateSlides,
  blankDeck,
  imagesOf,
  sortDecks,
  shareUrl,
  editedLabel,
  revealIn,
} from './lib/presentations'
import {
  listPresentations,
  createPresentation,
  savePresentation,
  copyPresentation,
  deletePresentation,
  setSharing,
  uploadSlideImage,
  removeSlideImages,
  errorText,
} from './lib/presentations-api'

const SECTION = 'presentations'
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function isTyping(target) {
  const tag = target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable)
}

const Thumb = memo(function Thumb({ slide, theme, index, part, section, numbers, className = '' }) {
  return (
    <span className={`pointer-events-none block ${className}`} inert>
      <Slide slide={slide} theme={theme} index={index} part={part} section={section} numbers={numbers} />
    </span>
  )
})

export default function DashboardPresentations({ hash }) {
  const sub = decodeURIComponent(hash.replace(/^#/, '').split('/')[1] || '')
  const [decks, setDecks] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showing, setShowing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDecks(await listPresentations())
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const upsert = useCallback((deck) => setDecks((list) => sortDecks([...(list || []).filter((held) => held.id !== deck.id), deck])), [])
  const drop = useCallback((id) => setDecks((list) => (list || []).filter((held) => held.id !== id)), [])

  const present = useCallback((deck, start = 0) => {
    enterFullscreen()
    setShowing({ deck, start })
  }, [])

  if (error && !decks) {
    return (
      <div className="flex flex-col gap-3">
        <Note tone="error">{errorText(error)}</Note>
        <div>
          <button type="button" className={BTN_SECONDARY} onClick={load}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      </div>
    )
  }
  if (!decks) return <ListSkeleton />

  if (sub) {
    const deck = decks.find((held) => held.id === sub)
    if (!deck) {
      return (
        <Empty
          icon="presentation"
          title="No presentation at that link"
          body="It may have been deleted, or it belongs to another account."
          action={<a {...link(dashboardPath(SECTION))} className={BTN_SECONDARY}>All presentations</a>}
        />
      )
    }
    return (
      <DeckEditor
        key={deck.id}
        deck={deck}
        onSaved={upsert}
        onCopied={(copy) => {
          upsert(copy)
          navigate(dashboardPath(`${SECTION}/${copy.id}`))
        }}
        onDeleted={(id) => {
          drop(id)
          navigate(dashboardPath(SECTION), { replace: true })
        }}
      />
    )
  }

  return (
    <>
      <DeckList decks={decks} loading={loading} onReload={load} onChanged={upsert} onDeleted={drop} onPresent={present} error={error} onDismiss={() => setError(null)} />
      {showing && <Presenter deck={showing.deck} start={showing.start} speaker onClose={() => setShowing(null)} />}
    </>
  )
}

function ListSkeleton() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <span className="block aspect-video animate-pulse rounded-xl bg-surface-hover" />
          <span className="mt-3 block h-3 w-2/3 rounded bg-surface-hover" />
          <span className="mt-2 block h-2.5 w-1/3 rounded bg-surface-hover" />
        </li>
      ))}
    </ul>
  )
}

function DeckList({ decks, loading, onReload, onChanged, onDeleted, onPresent, error, onDismiss }) {
  const [creating, setCreating] = useState(false)
  const [sharing, setSharingDeck] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const shared = decks.filter((deck) => deck.shareToken).length

  const copy = async (deck) => {
    setBusy(true)
    setFailure(null)
    try {
      onChanged(await copyPresentation(deck))
    } catch (err) {
      setFailure(err)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deletePresentation(removing)
      onDeleted(removing.id)
      setRemoving(null)
    } catch (err) {
      setFailure(err)
      setRemoving(null)
    } finally {
      setBusy(false)
    }
  }

  const newButton = (
    <button type="button" className={BTN_PRIMARY} onClick={() => setCreating(true)}>
      <Icon name="plus" className="h-3.5 w-3.5" /> New presentation
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {(error || failure) && <Note tone="error" onDismiss={() => { onDismiss(); setFailure(null) }}>{errorText(failure || error)}</Note>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-muted">
          {plural(decks.length, 'presentation')}
          {shared > 0 && <> · {shared} shared by link</>}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className={BTN_GHOST} onClick={onReload} disabled={loading} aria-label="Reload presentations">
            <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {newButton}
        </div>
      </div>

      {decks.length === 0 ? (
        <Empty
          icon="presentation"
          title="No presentations yet"
          body="Make slides here, present them full screen with speaker notes, and keep them private or share a link."
          action={newButton}
        />
      ) : (
        <ul className="grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              busy={busy}
              onPresent={() => onPresent(deck)}
              onShare={() => setSharingDeck(deck)}
              onCopy={() => copy(deck)}
              onDelete={() => setRemoving(deck)}
            />
          ))}
        </ul>
      )}

      {creating && <NewDeckDialog onClose={() => setCreating(false)} onCreated={(deck) => { onChanged(deck); navigate(dashboardPath(`${SECTION}/${deck.id}`)) }} />}

      {sharing && (
        <ShareDialog
          deck={decks.find((deck) => deck.id === sharing.id) || sharing}
          onClose={() => setSharingDeck(null)}
          onChanged={onChanged}
        />
      )}

      <Modal
        open={Boolean(removing)}
        tone="danger"
        busy={busy}
        title="Delete this presentation?"
        description={removing ? `“${removing.title}” and its ${plural(removing.slides.length, 'slide')} will be gone for good${removing.shareToken ? ', and its share link will stop working' : ''}.` : ''}
        onClose={() => setRemoving(null)}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setRemoving(null)} disabled={busy}>Cancel</button>
            <button type="button" className={BTN_DANGER} onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete presentation'}</button>
          </>
        }
      />
    </div>
  )
}

function DeckCard({ deck, busy, onPresent, onShare, onCopy, onDelete }) {
  const first = deck.slides[0]
  return (
    <li className="group relative min-w-0">
      <a {...link(dashboardPath(`${SECTION}/${deck.id}`))} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40 focus-visible:ring-offset-4 focus-visible:ring-offset-bg">
        <span className="relative block overflow-hidden rounded-xl ring-1 ring-line transition-shadow duration-300 group-hover:ring-ink-strong">
          <Thumb slide={first} theme={deck.theme} index={0} part={sectionNumber(deck.slides, 0)} section={sectionTitle(deck.slides, 0)} numbers={deck.numbers} />
          {deck.shareToken && (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm">
              <Icon name="link" className="h-3 w-3" /> Shared
            </span>
          )}
        </span>
        <span className="mt-3 block pr-[4.5rem]">
          <span className="block truncate text-[13.5px] font-medium text-ink-strong">{deck.title}</span>
          <span className="mt-0.5 block truncate text-[12px] text-ink-subtle">
            {plural(deck.slides.length, 'slide')} · {editedLabel(deck.updatedAt)}
          </span>
        </span>
      </a>
      <div className="absolute bottom-0 right-0 flex items-center gap-0.5">
        <button type="button" className={`${BTN_GHOST} h-8 w-8 px-0`} onClick={onPresent} aria-label={`Present ${deck.title}`} title="Present">
          <Icon name="play" className="h-3.5 w-3.5" />
        </button>
        <Menu
          label={`${deck.title} options`}
          trigger={({ toggle, label }) => (
            <button type="button" className={`${BTN_GHOST} h-8 w-8 px-0`} onClick={toggle} aria-label={label} disabled={busy}>
              <Icon name="dots" className="h-4 w-4" />
            </button>
          )}
        >
          <MenuItem icon="play" onClick={onPresent}>Present</MenuItem>
          <MenuItem icon={deck.shareToken ? 'link' : 'lock'} onClick={onShare}>{deck.shareToken ? 'Sharing…' : 'Share…'}</MenuItem>
          <MenuItem icon="copy" onClick={onCopy}>Duplicate</MenuItem>
          <MenuLine />
          <MenuItem icon="trash" tone="danger" onClick={onDelete}>Delete</MenuItem>
        </Menu>
      </div>
    </li>
  )
}

const ThemeTile = memo(function ThemeTile({ theme, active, onPick, sample = 'title' }) {
  const slide = sampleSlide(sample)
  return (
    <button
      type="button"
      onClick={() => onPick(theme.id)}
      aria-pressed={active}
      aria-label={`${theme.label} theme`}
      className="group block min-w-0 cursor-pointer text-left outline-none"
    >
      <span className={`block overflow-hidden rounded-lg ring-2 transition-shadow ${active ? 'ring-ink-strong' : 'ring-line group-hover:ring-ink-strong'}`}>
        <Thumb slide={slide} theme={theme.id} index={0} />
      </span>
      <span className={`mt-1.5 flex items-center gap-1.5 text-[11.5px] ${active ? 'text-ink-strong' : 'text-ink-muted'}`}>
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/10" style={{ background: theme.accent }} />
        {theme.label}
      </span>
    </button>
  )
})

function NewDeckDialog({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState('outline')
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const create = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const deck = await createPresentation({ ...blankDeck({ template, theme }), title: title.trim() || DEFAULT_TITLE })
      onClose()
      onCreated(deck)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      size="wide"
      busy={busy}
      title="New presentation"
      description="Pick a starting point and a look. You can change both later."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={BTN_PRIMARY} onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create presentation'}</button>
        </>
      }
    >
      <form className="flex flex-col gap-5 pb-1" onSubmit={(event) => { event.preventDefault(); create() }}>
        {error && <Note tone="error">{errorText(error)}</Note>}
        <Field label="Title" htmlFor="deck-title" hint={`${title.length}/${LIMITS.title}`}>
          <input id="deck-title" data-autofocus className={INPUT} value={title} maxLength={LIMITS.title} placeholder={DEFAULT_TITLE} onChange={(event) => setTitle(event.target.value)} />
        </Field>

        <div>
          <p className={CAPS}>Start from</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((option) => {
              const slides = templateSlides(option.id).slice(0, 3)
              const active = template === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTemplate(option.id)}
                  aria-pressed={active}
                  className={`flex cursor-pointer flex-col gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${active ? 'border-ink-strong bg-surface-raised' : 'border-line hover:border-line-strong'}`}
                >
                  <span className="relative block" style={{ aspectRatio: '5 / 2' }}>
                    {slides.map((slide, i) => (
                      <span
                        key={slide.id}
                        className="absolute top-0 w-3/5 overflow-hidden rounded-md shadow-lg ring-1 ring-line"
                        style={{ left: `${i * 21}%`, top: `${i * 8}px`, zIndex: slides.length - i }}
                      >
                        <Thumb slide={slide} theme={theme} index={i} />
                      </span>
                    ))}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-ink-strong">{option.label}</span>
                    <span className="block text-[12px] text-ink-muted">{option.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className={CAPS}>Theme</p>
          <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {THEMES.map((option) => (
              <ThemeTile key={option.id} theme={option} active={theme === option.id} onPick={setTheme} />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

function ShareDialog({ deck, onClose, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const url = deck.shareToken ? shareUrl(deck.shareToken) : ''

  const apply = async (on) => {
    setBusy(true)
    setError(null)
    try {
      const saved = await setSharing(deck.id, on)
      onChanged({ ...deck, shareToken: saved.shareToken, sharedAt: saved.sharedAt, updatedAt: saved.updatedAt })
      setConfirmReset(false)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      busy={busy}
      title={`Share “${deck.title}”`}
      description="Presentations are private: only you can see them. Turn on the link and anyone who has it can watch, no account needed."
      onClose={onClose}
      footer={<button type="button" className={BTN_PRIMARY} onClick={onClose} disabled={busy}>Done</button>}
    >
      <div className="flex flex-col gap-4">
        {error && <Note tone="error">{errorText(error)}</Note>}
        <div className={`${CARD} flex items-center gap-3 p-3`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${deck.shareToken ? 'bg-ink-strong text-ink-inverse' : 'bg-surface-hover text-ink-muted'}`}>
            <Icon name={deck.shareToken ? 'globe' : 'lock'} className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink-strong">{deck.shareToken ? 'Anyone with the link' : 'Private'}</p>
            <p className="text-[12px] text-ink-muted">{deck.shareToken ? 'Can watch the slides. Only you can edit.' : 'Only you, signed in, can open it.'}</p>
          </div>
          <Toggle checked={Boolean(deck.shareToken)} onChange={apply} disabled={busy} label="Share with a link" />
        </div>

        {deck.shareToken && (
          <div className="flex flex-col gap-2 animate-rise-in">
            <div className="flex items-center gap-1.5">
              <input readOnly value={url} aria-label="Share link" className={`${INPUT} min-w-0 font-mono text-[12px]`} onFocus={(event) => event.target.select()} />
              <CopyButton text={url} label="Copy link" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a href={url} target="_blank" rel="noreferrer" className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>
                Open as a viewer <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
              </a>
              {confirmReset ? (
                <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                  The old link stops working.
                  <button type="button" className={`${BTN_DANGER} h-7 px-2 text-[12px]`} onClick={() => apply(true)} disabled={busy}>Make a new link</button>
                  <button type="button" className={`${BTN_GHOST} h-7 px-2 text-[12px]`} onClick={() => setConfirmReset(false)} disabled={busy}>Keep</button>
                </span>
              ) : (
                <button type="button" className={`${BTN_GHOST} h-7 px-2 text-[12px]`} onClick={() => setConfirmReset(true)} disabled={busy}>
                  <Icon name="refresh" className="h-3.5 w-3.5" /> Reset link
                </button>
              )}
            </div>
          </div>
        )}

        <Note icon="lock">Speaker notes never leave your account. People with the link see the slides only, and turning the link off locks them out right away.</Note>
      </div>
    </Modal>
  )
}

const LayoutTile = memo(function LayoutTile({ layout, theme, active, onPick }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={() => onPick(layout.id)}
      title={layout.hint}
      className="group block min-w-0 cursor-pointer rounded-lg p-1 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover"
    >
      <span className={`block overflow-hidden rounded-md ring-2 ${active ? 'ring-ink-strong' : 'ring-line'}`}>
        <Thumb slide={sampleSlide(layout.id)} theme={theme} index={0} />
      </span>
      <span className={`mt-1 block truncate px-0.5 text-[11.5px] ${active ? 'font-medium text-ink-strong' : 'text-ink-muted'}`}>{layout.label}</span>
    </button>
  )
})

function LayoutGrid({ theme, current, onPick }) {
  return (
    <div className="grid grid-cols-2 gap-1 p-1 sm:grid-cols-4">
      {LAYOUTS.map((layout) => (
        <LayoutTile key={layout.id} layout={layout} theme={theme} active={layout.id === current} onPick={onPick} />
      ))}
    </div>
  )
}

function ToolButton({ icon, children, onClick, label, active, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={`inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink-strong/25 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-surface-hover text-ink-strong' : 'text-ink-muted hover:bg-surface-hover hover:text-ink-strong'
      }`}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </button>
  )
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-line" />

function SaveState({ save, onRetry }) {
  if (save.state === 'error') {
    return (
      <button type="button" onClick={onRetry} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[11.5px] text-red-500 hover:underline">
        <Icon name="alert" className="h-3 w-3" /> Not saved · Retry
      </button>
    )
  }
  if (save.state === 'dirty' || save.state === 'saving') return <SaveMark state="saving" />
  return <SaveMark state="saved" at={save.at} />
}

function DeckEditor({ deck: initial, onSaved, onCopied, onDeleted }) {
  const [deck, setDeck] = useState(initial)
  const [current, setCurrent] = useState(0)
  const [save, setSave] = useState({ state: 'saved', at: initial.updatedAt })
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [showing, setShowing] = useState(null)
  const [sharing, setSharingOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [undo, setUndo] = useState(null)
  const undoRef = useRef(null)
  const [menu, setMenu] = useState(null)
  const [drag, setDrag] = useState(null)
  const [altOpen, setAltOpen] = useState(false)

  const deckRef = useRef(initial)
  const pending = useRef({})
  const timer = useRef(0)
  const chain = useRef(Promise.resolve())
  const saved = useRef(onSaved)
  saved.current = onSaved
  const rail = useRef(null)
  const imageInput = useRef(null)

  const id = initial.id
  const slides = deck.slides
  const index = Math.min(current, slides.length - 1)
  const slide = slides[index]
  const layout = layoutOf(slide.layout)

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    chain.current = chain.current.then(async () => {
      const patch = pending.current
      if (!Object.keys(patch).length) return
      pending.current = {}
      setSave((held) => ({ ...held, state: 'saving' }))
      try {
        const row = await savePresentation(id, patch)
        const dirty = Object.keys(pending.current).length > 0
        setSave({ state: dirty ? 'dirty' : 'saved', at: row.updatedAt })
        saved.current({ ...deckRef.current, updatedAt: row.updatedAt })
      } catch (err) {
        pending.current = { ...patch, ...pending.current }
        setSave((held) => ({ ...held, state: 'error', error: err }))
      }
    })
    return chain.current
  }, [id])

  const apply = useCallback(
    (patch) => {
      deckRef.current = { ...deckRef.current, ...patch }
      setDeck(deckRef.current)
      pending.current = { ...pending.current, ...patch }
      setSave((held) => (held.state === 'saving' ? held : { ...held, state: 'dirty' }))
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, 700)
    },
    [flush],
  )

  const editSlides = useCallback((fn) => apply({ slides: fn(deckRef.current.slides) }), [apply])
  const editSlide = useCallback((slideId, patch) => editSlides((list) => list.map((held) => (held.id === slideId ? { ...held, ...patch } : held))), [editSlides])

  useEffect(() => {
    const onLeave = (event) => {
      if (Object.keys(pending.current).length) event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      clearTimeout(timer.current)
      if (Object.keys(pending.current).length) {
        const patch = pending.current
        pending.current = {}
        savePresentation(id, patch).catch(() => {})
        saved.current({ ...deckRef.current })
      }
    }
  }, [id])

  const forgetImage = useCallback((path) => {
    if (path && !imagesOf(deckRef.current.slides).includes(path)) removeSlideImages([path])
  }, [])

  const select = useCallback((at) => {
    setCurrent(Math.max(0, Math.min(deckRef.current.slides.length - 1, at)))
  }, [])

  useEffect(() => {
    revealIn(rail.current, rail.current?.querySelector(`[data-slide-index="${index}"]`))
  }, [index])

  const addSlide = useCallback(
    (layoutId, after = index) => {
      if (deckRef.current.slides.length >= LIMITS.slides) {
        setError({ message: `A presentation holds up to ${LIMITS.slides} slides.` })
        return
      }
      const fresh = newSlide(layoutId, { tone: 'theme' })
      editSlides((list) => [...list.slice(0, after + 1), fresh, ...list.slice(after + 1)])
      setCurrent(after + 1)
    },
    [editSlides, index],
  )

  const duplicate = useCallback(
    (at = index) => {
      if (deckRef.current.slides.length >= LIMITS.slides) {
        setError({ message: `A presentation holds up to ${LIMITS.slides} slides.` })
        return
      }
      editSlides((list) => [...list.slice(0, at + 1), duplicateSlide(list[at]), ...list.slice(at + 1)])
      setCurrent(at + 1)
    },
    [editSlides, index],
  )

  const move = useCallback(
    (from, to) => {
      editSlides((list) => moveSlide(list, from, to))
      setCurrent(Math.max(0, Math.min(deckRef.current.slides.length - 1, to)))
    },
    [editSlides],
  )

  const remove = useCallback(
    (at = index) => {
      const list = deckRef.current.slides
      if (list.length <= 1) return
      const gone = list[at]
      editSlides((held) => held.filter((_, i) => i !== at))
      setCurrent(Math.max(0, at - (at >= list.length - 1 ? 1 : 0)))
      if (undoRef.current?.slide.image) forgetImage(undoRef.current.slide.image.path)
      undoRef.current = { slide: gone, at }
      setUndo(undoRef.current)
    },
    [editSlides, forgetImage, index],
  )

  const restore = () => {
    if (!undo) return
    const { slide: back, at } = undo
    editSlides((list) => [...list.slice(0, at), back, ...list.slice(at)])
    setCurrent(at)
    undoRef.current = null
    setUndo(null)
  }

  const expireUndo = useCallback(() => {
    const held = undoRef.current
    undoRef.current = null
    setUndo(null)
    if (held?.slide.image) forgetImage(held.slide.image.path)
  }, [forgetImage])

  const upload = useCallback(
    async (slideId, file) => {
      setUploading(slideId)
      setError(null)
      try {
        const path = await uploadSlideImage(id, file)
        const before = deckRef.current.slides.find((held) => held.id === slideId)?.image
        editSlide(slideId, { image: { path, alt: '', fit: before?.fit || 'cover' } })
        if (before) forgetImage(before.path)
      } catch (err) {
        setError(err)
      } finally {
        setUploading(null)
      }
    },
    [id, editSlide, forgetImage],
  )

  const clearImage = useCallback(
    (slideId) => {
      const before = deckRef.current.slides.find((held) => held.id === slideId)?.image
      editSlide(slideId, { image: null })
      if (before) forgetImage(before.path)
    },
    [editSlide, forgetImage],
  )

  const present = useCallback((start = 0, speaker = false) => {
    enterFullscreen()
    setShowing({ start, speaker })
  }, [])

  const copyDeck = async () => {
    setBusy(true)
    setError(null)
    try {
      await flush()
      onCopied(await copyPresentation(deckRef.current))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const deleteDeck = async () => {
    setBusy(true)
    try {
      clearTimeout(timer.current)
      pending.current = {}
      await deletePresentation(deckRef.current)
      setConfirmDelete(false)
      onDeleted(id)
    } catch (err) {
      setError(err)
      setConfirmDelete(false)
      setBusy(false)
    }
  }

  const keys = useRef({})
  keys.current = { index, showing, remove, duplicate, present, select, flush, addSlide }
  useEffect(() => {
    const onKey = (event) => {
      const held = keys.current
      if (held.showing || isTyping(event.target) || document.querySelector('[role="dialog"], [role="menu"]')) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        held.flush()
      } else if (event.key === 'F5' || (mod && event.key === 'Enter')) {
        event.preventDefault()
        held.present(event.shiftKey ? held.index : 0)
      } else if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        held.duplicate()
      } else if (mod || event.altKey) {
        return
      } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault()
        held.select(held.index + 1)
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault()
        held.select(held.index - 1)
      } else if (event.key === 'Home') {
        held.select(0)
      } else if (event.key === 'End') {
        held.select(Infinity)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && (rail.current?.contains(event.target) || event.target === document.body)) {
        event.preventDefault()
        held.remove()
      } else if (event.key.toLowerCase() === 'n') {
        held.addSlide('bullets')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const dragOver = (event, at) => {
    if (drag === null) return
    event.preventDefault()
    const box = event.currentTarget.getBoundingClientRect()
    const vertical = rail.current && getComputedStyle(rail.current).flexDirection === 'column'
    const after = vertical ? event.clientY > box.top + box.height / 2 : event.clientX > box.left + box.width / 2
    setDrag((held) => (held && (held.over !== at || held.after !== after) ? { ...held, over: at, after } : held))
  }

  const dropAt = (event) => {
    event.preventDefault()
    if (!drag || drag.over === undefined) return setDrag(null)
    let to = drag.over + (drag.after ? 1 : 0)
    if (drag.from < to) to -= 1
    if (to !== drag.from) move(drag.from, to)
    setDrag(null)
  }

  const media = { uploading: uploading === slide.id, onFile: (file) => upload(slide.id, file), onRemove: () => clearImage(slide.id) }
  const theme = themeOf(deck.theme)

  return (
    <div className="flex flex-col gap-4 animate-rise-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <a {...link(dashboardPath(SECTION))} className={BTN_GHOST} aria-label="All presentations">
            <Icon name="arrowLeft" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Presentations</span>
          </a>
          <InlineEdit
            value={deck.title}
            onSave={(title) => apply({ title })}
            maxLength={LIMITS.title}
            ariaLabel="Rename presentation"
            className="max-w-[420px] text-[14px] font-semibold text-ink-strong"
          />
          <span className="hidden shrink-0 sm:inline-flex"><SaveState save={save} onRetry={flush} /></span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={() => setSharingOpen(true)} aria-label={deck.shareToken ? 'Shared, change sharing' : 'Share'}>
            <Icon name={deck.shareToken ? 'globe' : 'lock'} className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{deck.shareToken ? 'Shared' : 'Share'}</span>
          </button>
          <div className="deck-split inline-flex">
            <button type="button" className={BTN_PRIMARY} onClick={() => present(0)} title="Present from the start (F5)">
              <Icon name="play" className="h-3.5 w-3.5" /> Present
            </button>
            <Menu
              label="More ways to present"
              width="w-60"
              trigger={({ toggle, label }) => (
                <button type="button" className={BTN_PRIMARY} onClick={toggle} aria-label={label}>
                  <Icon name="chevronDown" className="h-3.5 w-3.5" />
                </button>
              )}
            >
              <MenuItem icon="play" onClick={() => present(0)}>From the start</MenuItem>
              <MenuItem icon="chevronRight" onClick={() => present(index)}>From slide {index + 1}</MenuItem>
              <MenuItem icon="message" onClick={() => present(index, true)}>Speaker view</MenuItem>
              <MenuLine />
              <MenuItem icon="download" onClick={() => setPrinting(true)}>Print or save as PDF</MenuItem>
            </Menu>
          </div>
          <Menu
            label="Presentation options"
            trigger={({ toggle, label }) => (
              <button type="button" className={`${BTN_GHOST} w-8 px-0`} onClick={toggle} aria-label={label} disabled={busy}>
                <Icon name="dots" className="h-4 w-4" />
              </button>
            )}
          >
            <MenuItem icon="copy" onClick={copyDeck}>Duplicate presentation</MenuItem>
            <MenuLine />
            <MenuItem icon="trash" tone="danger" onClick={() => setConfirmDelete(true)}>Delete presentation</MenuItem>
          </Menu>
        </div>
      </div>

      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}

      <div className="deck-editor">
        <aside aria-label="Slides" className="deck-rail-wrap min-w-0">
          <ol
            ref={rail}
            className="deck-rail"
            onDragOver={(event) => drag && event.preventDefault()}
            onDrop={dropAt}
          >
            {slides.map((item, i) => (
              <li
                key={item.id}
                data-slide-index={i}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', String(i + 1))
                  setDrag({ from: i })
                }}
                onDragEnd={() => setDrag(null)}
                onDragOver={(event) => dragOver(event, i)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  select(i)
                  setMenu({ at: { x: event.clientX, y: event.clientY }, index: i })
                }}
                data-dragging={drag?.from === i ? '' : undefined}
                data-drop={drag && drag.over === i ? (drag.after ? 'after' : 'before') : undefined}
                className="deck-rail-item group"
              >
                <span className={`hidden w-4 shrink-0 pt-0.5 text-right font-mono text-[10.5px] tabular-nums lg:block ${i === index ? 'text-ink-strong' : 'text-ink-faint'}`}>{i + 1}</span>
                <button
                  type="button"
                  onClick={() => select(i)}
                  aria-current={i === index ? 'true' : undefined}
                  aria-label={`Slide ${i + 1}: ${slideLabel(item)}`}
                  className={`relative block min-w-0 flex-1 cursor-pointer overflow-hidden rounded-md outline-none ring-2 transition-shadow focus-visible:ring-ink-strong/60 ${i === index ? 'ring-ink-strong' : 'ring-line hover:ring-line-strong'}`}
                >
                  <Thumb slide={item} theme={deck.theme} index={i} part={sectionNumber(slides, i)} section={sectionTitle(slides, i)} numbers={deck.numbers} />
                  {item.notes && (
                    <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded bg-black/60 text-white" title="Has speaker notes">
                      <Icon name="message" className="h-2.5 w-2.5" />
                    </span>
                  )}
                  <span className="absolute left-1.5 top-1 rounded bg-black/60 px-1 font-mono text-[9.5px] text-white lg:hidden">{i + 1}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Slide ${i + 1} options`}
                  onClick={(event) => {
                    const box = event.currentTarget.getBoundingClientRect()
                    select(i)
                    setMenu({ at: { x: box.left, y: box.bottom + 4 }, index: i })
                  }}
                  className="absolute right-1 top-1 grid h-5 w-5 cursor-pointer place-items-center rounded bg-black/60 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Icon name="dots" className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ol>
          <div className="deck-rail-add">
            <Menu
              label="New slide"
              align="start"
              width="deck-menu-wide"
              trigger={({ toggle, label }) => (
                <button type="button" onClick={toggle} aria-label={label} className={`${BTN_SECONDARY} w-full border-dashed`} disabled={slides.length >= LIMITS.slides}>
                  <Icon name="plus" className="h-3.5 w-3.5" /> New slide
                </button>
              )}
            >
              <MenuLabel>New slide after {index + 1}</MenuLabel>
              <LayoutGrid theme={deck.theme} current={null} onPick={(layoutId) => addSlide(layoutId)} />
            </Menu>
          </div>
        </aside>

        <section aria-label={`Slide ${index + 1}`} className="flex min-w-0 flex-col gap-3">
          <div role="toolbar" aria-label="Slide tools" className={`${CARD} flex items-center gap-0.5 overflow-x-auto p-1`}>
            <Menu
              label="New slide"
              align="start"
              width="deck-menu-wide"
              trigger={({ toggle, label }) => (
                <ToolButton icon="plus" onClick={toggle} label={label} disabled={slides.length >= LIMITS.slides}>
                  <span className="hidden sm:inline">New slide</span>
                </ToolButton>
              )}
            >
              <MenuLabel>New slide after {index + 1}</MenuLabel>
              <LayoutGrid theme={deck.theme} current={null} onPick={(layoutId) => addSlide(layoutId)} />
            </Menu>
            <Divider />
            <Menu
              label="Layout"
              align="start"
              width="deck-menu-wide"
              trigger={({ toggle, label }) => (
                <ToolButton icon="layout" onClick={toggle} label={label}>
                  <span className="hidden sm:inline">{layout.label}</span>
                  <Icon name="chevronDown" className="h-3 w-3 opacity-60" />
                </ToolButton>
              )}
            >
              <MenuLabel>Layout for slide {index + 1}</MenuLabel>
              <LayoutGrid theme={deck.theme} current={slide.layout} onPick={(layoutId) => editSlide(slide.id, { layout: layoutId })} />
            </Menu>
            <Menu
              label="Background"
              align="start"
              width="w-56"
              trigger={({ toggle, label }) => (
                <ToolButton icon="square" onClick={toggle} label={label}>
                  <span className="hidden sm:inline">{TONES.find((tone) => tone.id === slide.tone)?.label}</span>
                  <Icon name="chevronDown" className="h-3 w-3 opacity-60" />
                </ToolButton>
              )}
            >
              <MenuLabel>Background</MenuLabel>
              {TONES.map((tone) => {
                const palette = paletteOf(deck.theme, tone.id)
                return (
                  <button
                    key={tone.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={slide.tone === tone.id}
                    onClick={() => editSlide(slide.id, { tone: tone.id })}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-strong"
                  >
                    <span aria-hidden="true" className="grid h-5 w-7 shrink-0 place-items-center rounded ring-1 ring-inset ring-black/10" style={{ background: palette.paint, color: palette.ink }}>
                      <span className="h-1 w-3 rounded-full" style={{ background: palette.accent }} />
                    </span>
                    <span className="flex-1">{tone.label}</span>
                    {slide.tone === tone.id && <Icon name="check" className="h-3.5 w-3.5 text-ink-strong" />}
                  </button>
                )
              })}
            </Menu>
            {layout.aligns && (
              <>
                <ToolButton icon="alignLeft" label="Align left" active={slide.align === 'left'} onClick={() => editSlide(slide.id, { align: 'left' })} />
                <ToolButton icon="alignCenter" label="Align centre" active={slide.align === 'center'} onClick={() => editSlide(slide.id, { align: 'center' })} />
              </>
            )}
            {layout.image && (
              <>
                <Divider />
                <input
                  ref={imageInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) upload(slide.id, file)
                  }}
                />
                <ToolButton icon="image" label={slide.image ? 'Replace image' : 'Add an image'} onClick={() => imageInput.current?.click()} disabled={uploading === slide.id}>
                  <span className="hidden sm:inline">{uploading === slide.id ? 'Uploading…' : slide.image ? 'Replace' : 'Image'}</span>
                </ToolButton>
                {slide.image && (
                  <>
                    <ToolButton icon="maximize" label={slide.image.fit === 'contain' ? 'Fill the frame' : 'Fit the whole image'} onClick={() => editSlide(slide.id, { image: { ...slide.image, fit: slide.image.fit === 'contain' ? 'cover' : 'contain' } })}>
                      <span className="hidden sm:inline">{slide.image.fit === 'contain' ? 'Fit' : 'Fill'}</span>
                    </ToolButton>
                    <ToolButton icon="eye" label="Describe the image" active={Boolean(slide.image.alt)} onClick={() => setAltOpen(true)}>
                      <span className="hidden sm:inline">Alt</span>
                    </ToolButton>
                  </>
                )}
              </>
            )}
            <span className="flex-1" />
            <Menu
              label="Design"
              width="deck-menu"
              trigger={({ toggle, label }) => (
                <ToolButton icon="palette" onClick={toggle} label={label}>
                  <span className="hidden sm:inline">{theme.label}</span>
                  <Icon name="chevronDown" className="h-3 w-3 opacity-60" />
                </ToolButton>
              )}
            >
              <MenuLabel>Theme</MenuLabel>
              <div className="grid grid-cols-3 gap-2.5 p-2 sm:grid-cols-4" data-keep-open>
                {THEMES.map((option) => (
                  <ThemeTile key={option.id} theme={option} active={deck.theme === option.id} onPick={(themeId) => apply({ theme: themeId })} />
                ))}
              </div>
              <MenuLine />
              <MenuLabel>Transition</MenuLabel>
              {TRANSITIONS.map((option) => (
                <MenuItem key={option.id} keepOpen checked={deck.transition === option.id} onClick={() => apply({ transition: option.id })}>
                  {option.label}
                </MenuItem>
              ))}
              <MenuLine />
              <MenuItem icon="listTodo" keepOpen checked={deck.numbers} onClick={() => apply({ numbers: !deckRef.current.numbers })}>
                Slide numbers
              </MenuItem>
            </Menu>
          </div>

          <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-line">
            <Slide
              key={slide.id}
              slide={slide}
              theme={deck.theme}
              slides={slides}
              index={index}
              numbers={deck.numbers}
              edit
              media={media}
              onChange={(patch) => editSlide(slide.id, patch)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-[12px] text-ink-subtle">
            <span className="min-w-0 truncate">
              Slide {index + 1} of {slides.length} · {layout.label}
            </span>
            <span className="flex shrink-0 items-center gap-0.5">
              <span className="mr-1 sm:hidden"><SaveState save={save} onRetry={flush} /></span>
              <ToolButton icon="chevronLeft" label="Previous slide (↑)" onClick={() => select(index - 1)} disabled={index === 0} />
              <ToolButton icon="chevronRight" label="Next slide (↓)" onClick={() => select(index + 1)} disabled={index === slides.length - 1} />
              <span className="lg:hidden">
                <Menu
                  label="New slide"
                  width="deck-menu-wide"
                  trigger={({ toggle, label }) => <ToolButton icon="plus" onClick={toggle} label={label} />}
                >
                  <MenuLabel>New slide after {index + 1}</MenuLabel>
                  <LayoutGrid theme={deck.theme} current={null} onPick={(layoutId) => addSlide(layoutId)} />
                </Menu>
              </span>
            </span>
          </div>

          <Field label="Speaker notes" htmlFor="slide-notes" hint={slide.notes ? `${slide.notes.length}/${LIMITS.notes}` : 'only you see these, in speaker view'}>
            <textarea
              id="slide-notes"
              key={`notes-${slide.id}`}
              className={`${TEXTAREA} min-h-[96px]`}
              value={slide.notes}
              maxLength={LIMITS.notes}
              placeholder="What you want to say on this slide."
              onChange={(event) => editSlide(slide.id, { notes: event.target.value })}
            />
          </Field>

          <p className="hidden text-[11.5px] text-ink-faint lg:block">
            ↑ ↓ move between slides · N new slide · ⌘D duplicate · Delete removes · F5 presents, ⇧F5 from here · Drag slides on the left to reorder
          </p>
        </section>
      </div>

      {menu && (
        <PointerMenu at={menu.at} onClose={() => setMenu(null)}>
          <MenuItem icon="play" onClick={() => present(menu.index)}>Present from here</MenuItem>
          <MenuItem icon="copy" onClick={() => duplicate(menu.index)} disabled={slides.length >= LIMITS.slides}>Duplicate</MenuItem>
          <MenuItem icon="arrowUpRight" onClick={() => move(menu.index, menu.index - 1)} disabled={menu.index === 0}>Move up</MenuItem>
          <MenuItem icon="arrowDown" onClick={() => move(menu.index, menu.index + 1)} disabled={menu.index === slides.length - 1}>Move down</MenuItem>
          <MenuLine />
          <MenuItem icon="trash" tone="danger" onClick={() => remove(menu.index)} disabled={slides.length <= 1}>Delete slide</MenuItem>
        </PointerMenu>
      )}

      {undo && <UndoBar what={`Slide “${slideLabel(undo.slide)}” deleted`} onUndo={restore} onClose={expireUndo} />}

      {sharing && <ShareDialog deck={deck} onClose={() => setSharingOpen(false)} onChanged={(next) => {
        deckRef.current = { ...deckRef.current, shareToken: next.shareToken, sharedAt: next.sharedAt }
        setDeck(deckRef.current)
        onSaved({ ...deckRef.current, updatedAt: next.updatedAt })
      }} />}

      {altOpen && slide.image && (
        <AltDialog
          value={slide.image.alt}
          onClose={() => setAltOpen(false)}
          onSave={(alt) => {
            editSlide(slide.id, { image: { ...slide.image, alt } })
            setAltOpen(false)
          }}
        />
      )}

      {printing && <DeckPrint deck={deck} onDone={() => setPrinting(false)} />}

      {showing && (
        <Presenter
          deck={deck}
          start={showing.start}
          speaker
          speakerFirst={showing.speaker}
          onClose={(last) => {
            setShowing(null)
            select(last)
          }}
        />
      )}

      <Modal
        open={confirmDelete}
        tone="danger"
        busy={busy}
        title="Delete this presentation?"
        description={`“${deck.title}” and its ${plural(slides.length, 'slide')} will be gone for good${deck.shareToken ? ', and its share link will stop working' : ''}.`}
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
            <button type="button" className={BTN_DANGER} onClick={deleteDeck} disabled={busy}>{busy ? 'Deleting…' : 'Delete presentation'}</button>
          </>
        }
      />
    </div>
  )
}

function AltDialog({ value, onSave, onClose }) {
  const [draft, setDraft] = useState(value)
  return (
    <Modal
      open
      title="Describe the image"
      description="Screen readers read this out. One sentence on what the picture shows is plenty."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>Cancel</button>
          <button type="button" className={BTN_PRIMARY} onClick={() => onSave(draft.trim())}>Save</button>
        </>
      }
    >
      <form onSubmit={(event) => { event.preventDefault(); onSave(draft.trim()) }}>
        <Field label="Alt text" htmlFor="slide-alt" hint={`${draft.length}/${LIMITS.alt}`}>
          <input id="slide-alt" data-autofocus className={INPUT} value={draft} maxLength={LIMITS.alt} onChange={(event) => setDraft(event.target.value)} placeholder="A team standing around a whiteboard" />
        </Field>
      </form>
    </Modal>
  )
}
