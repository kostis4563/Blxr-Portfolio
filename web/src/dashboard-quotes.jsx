import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { Field, INPUT, TEXTAREA, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, Toggle, Modal } from './components/settings-ui'
import { Note, Empty, Tag, CARD } from './components/boards/ui'
import { navigate, dashboardPath, link, QUOTE_PATH } from './lib/router'
import {
  LIMITS,
  DEFAULT_AUTHOR,
  blankForm,
  formFrom,
  quoteFrom,
  wordsOf,
  problemsOf,
  slugify,
  uniqueSlug,
  todayIso,
  paragraphsOf,
  sortQuotes,
  arrangeQuotes,
  formatQuoteDate,
  quoteNumber,
} from './lib/quote'
import { listQuotes, saveQuote, deleteQuote, errorText } from './lib/quote-api'

const WORD_KEYS = ['text', 'author', 'explanation']
const newId = () => crypto.randomUUID()

function publicView(quotes) {
  const { all, featured } = arrangeQuotes(quotes.filter((quote) => quote.published))
  return { numbers: new Map(all.map((quote) => [quote.id, quote.number])), mainId: featured?.id ?? null }
}

export default function DashboardQuotes({ hash }) {
  const sub = decodeURIComponent(hash.replace(/^#/, '').split('/')[1] || '')
  const [quotes, setQuotes] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const draft = useRef(newId())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setQuotes(await listQuotes({ includeHidden: true }))
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onSaved = useCallback((quote) => {
    setQuotes((list) =>
      sortQuotes([
        ...(list || []).filter((q) => q.id !== quote.id).map((q) => (quote.featured && q.featured ? { ...q, featured: false } : q)),
        quote,
      ]),
    )
  }, [])

  const onDeleted = useCallback((id) => {
    setQuotes((list) => (list || []).filter((q) => q.id !== id))
    navigate(dashboardPath('quotes'), { replace: true })
  }, [])

  if (error && !quotes) {
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
  if (!quotes) return <ListSkeleton />

  if (sub) {
    const quote = sub === 'new' ? null : quotes.find((q) => q.id === sub)
    if (sub !== 'new' && sub !== draft.current && !quote) {
      return (
        <Empty
          icon="flag"
          title="No quote with that id"
          body="It may have been deleted."
          action={<a {...link(dashboardPath('quotes'))} className={BTN_SECONDARY}>All quotes</a>}
        />
      )
    }
    if (sub === 'new' && quotes.some((q) => q.id === draft.current)) draft.current = newId()
    const id = quote?.id ?? draft.current
    return <QuoteEditor key={id} id={id} quote={quote} quotes={quotes} onSaved={onSaved} onDeleted={onDeleted} />
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}
      <QuoteList quotes={quotes} loading={loading} onReload={load} />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className={`${CARD} divide-y divide-line overflow-hidden`} aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <span className="h-3 w-12 rounded bg-surface-hover" />
          <span className="h-3 flex-1 rounded bg-surface-hover" />
        </div>
      ))}
    </div>
  )
}

function QuoteList({ quotes, loading, onReload }) {
  const { numbers, mainId } = publicView(quotes)
  const hidden = quotes.length - numbers.size
  const newButton = (
    <a {...link(dashboardPath('quotes/new'))} className={BTN_PRIMARY}>
      <Icon name="plus" className="h-3.5 w-3.5" /> New quote
    </a>
  )
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-muted">
          {quotes.length} quote{quotes.length === 1 ? '' : 's'}
          {hidden > 0 && <> · {hidden} hidden</>}
        </p>
        <div className="flex items-center gap-2">
          <a href={QUOTE_PATH} target="_blank" rel="noreferrer" className={BTN_GHOST}>
            View page ↗
          </a>
          <button type="button" className={BTN_GHOST} onClick={onReload} disabled={loading} aria-label="Reload quotes">
            <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {newButton}
        </div>
      </div>

      {quotes.length === 0 ? (
        <Empty icon="flag" title="No quotes yet" body="Add a line you live by. It shows up on /quote as soon as you save it." action={newButton} />
      ) : (
        <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
          {quotes.map((quote) => {
            const number = numbers.get(quote.id)
            return (
              <li key={quote.id} className="group relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-hover/60">
                <span className="w-12 shrink-0 font-mono text-[11.5px] tabular-nums text-ink-faint">{number ? `No. ${quoteNumber(number)}` : '—'}</span>
                <div className="min-w-0 flex-1">
                  <a
                    {...link(dashboardPath(`quotes/${quote.id}`))}
                    className="block truncate font-vergilia text-[16px] text-ink-strong outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {quote.text}
                  </a>
                  <p className="truncate text-[12px] text-ink-subtle">
                    <span className="font-mono tabular-nums">
                      Added {formatQuoteDate(quote.addedOn)}
                      {quote.editedOn && <> · Edited {formatQuoteDate(quote.editedOn)}</>}
                    </span>
                    {quote.author !== DEFAULT_AUTHOR && <> · {quote.author}</>}
                  </p>
                </div>
                {quote.id === mainId && <Tag tone="strong">Main</Tag>}
                {!quote.published && <Tag tone="amber">Hidden</Tag>}
                {quote.explanation && (
                  <span className="hidden items-center gap-1 text-[11.5px] text-ink-subtle sm:inline-flex" title="Has a note">
                    <Icon name="message" className="h-3.5 w-3.5" /> Note
                  </span>
                )}
                <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function QuoteEditor({ id, quote, quotes, onSaved, onDeleted }) {
  const initial = useMemo(() => (quote ? formFrom(quote) : blankForm(todayIso())), [quote])
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(quote)
  const [slugTouched, setSlugTouched] = useState(Boolean(quote))
  const [editedTouched, setEditedTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const savedForm = saved ? formFrom(saved) : null
  const taken = quotes.filter((q) => q.id !== id).map((q) => q.slug)
  const currentMain = quotes.find((q) => q.featured && q.id !== id)
  const dirty = saved ? JSON.stringify(form) !== JSON.stringify(savedForm) : Boolean(form.text.trim())
  const problems = problemsOf(form, taken)
  const valid = Object.keys(problems).length === 0
  const shown = (key) => (showErrors ? problems[key] : null)

  const update = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch }
      if (!saved && !slugTouched && 'text' in patch) next.slug = uniqueSlug(slugify(next.text), taken)
      if (saved && !editedTouched && WORD_KEYS.some((key) => key in patch)) {
        next.editedOn = wordsOf(next) !== wordsOf(savedForm) ? todayIso() : savedForm.editedOn
      }
      return next
    })
    setJustSaved(false)
  }
  const set = (key) => (value) => update({ [key]: value })

  useEffect(() => {
    if (!dirty) return undefined
    const onLeave = (e) => { e.preventDefault() }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  const save = async () => {
    if (busy) return
    if (!valid) {
      setShowErrors(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await saveQuote(quoteFrom(id, form), { isNew: !saved })
      setSaved(next)
      setForm(formFrom(next))
      setSlugTouched(true)
      setEditedTouched(false)
      setShowErrors(false)
      setJustSaved(true)
      onSaved(next)
      if (!saved) navigate(dashboardPath(`quotes/${next.id}`), { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const remove = async () => {
    setBusy(true)
    try {
      await deleteQuote(id)
      setConfirmDelete(false)
      onDeleted(id)
    } catch (err) {
      setError(err)
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  const setEdited = (value) => {
    setEditedTouched(true)
    set('editedOn')(value)
  }

  const editedHint = form.editedOn ? (
    <button type="button" className="cursor-pointer hover:text-ink-strong" onClick={() => setEdited('')}>Clear</button>
  ) : (
    <button type="button" className="cursor-pointer hover:text-ink-strong" onClick={() => setEdited(todayIso())}>Today</button>
  )

  return (
    <div className="flex flex-col gap-5 animate-rise-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <a {...link(dashboardPath('quotes'))} className={BTN_GHOST} aria-label="All quotes">
            <Icon name="arrowLeft" className="h-3.5 w-3.5" /> Quotes
          </a>
          <span className="truncate text-[13px] text-ink-muted">{saved ? form.text || 'Untitled' : 'New quote'}</span>
          {dirty && !busy && <span className="shrink-0 text-[11.5px] text-ink-faint">· unsaved</span>}
          {justSaved && !dirty && <span className="shrink-0 text-[11.5px] text-emerald-500 animate-menu-in">· saved</span>}
        </div>
        <div className="flex items-center gap-2">
          {saved?.published && (
            <a href={`${QUOTE_PATH}#${saved.slug}`} target="_blank" rel="noreferrer" className={BTN_GHOST}>
              View ↗
            </a>
          )}
          {saved && (
            <button type="button" className={BTN_GHOST} onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Delete quote">
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" className={BTN_PRIMARY} onClick={save} disabled={busy || (saved && !dirty)} title="⌘S">
            {busy ? 'Saving…' : saved ? 'Save changes' : 'Add quote'}
          </button>
        </div>
      </div>

      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className={`${CARD} grid gap-4 p-4 sm:grid-cols-2 *:min-w-0`}>
          <Field label="Quote" htmlFor="quote-text" error={shown('text')} hint={`${form.text.length}/${LIMITS.text}`} className="sm:col-span-2">
            <textarea
              id="quote-text"
              className={`${TEXTAREA} min-h-[96px] font-vergilia text-[18px] leading-snug`}
              value={form.text}
              onChange={(e) => set('text')(e.target.value)}
              placeholder="True heroes never run."
              maxLength={LIMITS.text}
              aria-invalid={Boolean(shown('text'))}
              autoFocus={!quote}
            />
          </Field>

          <Field label="Said by" htmlFor="quote-author" error={shown('author')} hint={`empty shows ${DEFAULT_AUTHOR}`}>
            <input id="quote-author" className={INPUT} value={form.author} onChange={(e) => set('author')(e.target.value)} placeholder={DEFAULT_AUTHOR} maxLength={LIMITS.author} />
          </Field>
          <Field label="Link" htmlFor="quote-slug" error={shown('slug')} hint={slugTouched ? null : 'from the quote'}>
            <div className="flex min-w-0 items-center">
              <span className="shrink-0 pr-1.5 font-mono text-[12px] text-ink-faint">/quote#</span>
              <input
                id="quote-slug"
                className={`${INPUT} min-w-0 font-mono text-[12.5px]`}
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug')(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                }}
                placeholder="true-heroes-never-run"
                maxLength={LIMITS.slug}
                aria-invalid={Boolean(shown('slug'))}
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:col-span-2 *:min-w-0 [&_input]:min-w-0">
            <Field label="Added" htmlFor="quote-added" error={shown('addedOn')}>
              <input id="quote-added" type="date" className={INPUT} value={form.addedOn} onChange={(e) => set('addedOn')(e.target.value)} aria-invalid={Boolean(shown('addedOn'))} />
            </Field>
            <Field label="Edited" htmlFor="quote-edited" error={shown('editedOn')} hint={editedHint}>
              <input
                id="quote-edited"
                type="date"
                min={form.addedOn}
                className={INPUT}
                value={form.editedOn}
                onChange={(e) => setEdited(e.target.value)}
                aria-invalid={Boolean(shown('editedOn'))}
              />
            </Field>
            {saved && !editedTouched && (
              <p className="col-span-2 -mt-1 text-[11.5px] text-ink-faint">Changing the words sets Edited to today. Pick a date or clear it to keep your own.</p>
            )}
          </div>

          <Field label="What it means" htmlFor="quote-explanation" error={shown('explanation')} hint={`optional · ${form.explanation.length}/${LIMITS.explanation}`} className="sm:col-span-2">
            <textarea
              id="quote-explanation"
              className={`${TEXTAREA} min-h-[140px]`}
              value={form.explanation}
              onChange={(e) => set('explanation')(e.target.value)}
              placeholder="Why this line matters to you. Leave an empty line between paragraphs."
              maxLength={LIMITS.explanation}
            />
          </Field>

          <div className="flex items-center justify-between gap-4 sm:col-span-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink-strong">Main quote</p>
              <p className="text-[12px] text-ink-muted">
                {form.featured
                  ? 'Shown big at the top of /quote.'
                  : currentMain
                    ? `Turning this on moves “${currentMain.text}” down into the list.`
                    : 'Shown big at the top of /quote. Without one, the newest quote leads.'}
              </p>
            </div>
            <Toggle checked={form.featured} onChange={set('featured')} label="Make this the main quote" />
          </div>

          <div className="flex items-center justify-between gap-4 sm:col-span-2">
            <div>
              <p className="text-[13px] font-medium text-ink-strong">Show on /quote</p>
              <p className="text-[12px] text-ink-muted">Hidden quotes are only visible to you, here.</p>
            </div>
            <Toggle checked={form.published} onChange={set('published')} label="Show on the quote page" />
          </div>
        </div>

        <Preview form={form} />
      </div>

      <Modal
        open={confirmDelete}
        tone="danger"
        busy={busy}
        title="Delete this quote?"
        description={`“${form.text || 'Untitled'}” will be removed from /quote for good.`}
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
            <button type="button" className={BTN_DANGER} onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete quote'}</button>
          </>
        }
      />
    </div>
  )
}

function Preview({ form }) {
  const text = form.text.trim()
  const paragraphs = paragraphsOf(form.explanation)
  const where = !form.published ? 'Hidden' : form.featured ? 'Main quote' : 'In the list'
  return (
    <section aria-label="Preview" className={`${CARD} flex flex-col gap-5 p-5 lg:sticky lg:top-6`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-ink-subtle">Preview</p>
        <Tag tone={form.published ? 'neutral' : 'amber'}>{where}</Tag>
      </div>
      <div>
        <span aria-hidden="true" className="block font-vergilia text-[48px] leading-[0.6] text-ink-faint">“</span>
        <p className={`mt-3 break-words font-vergilia leading-[1.1] tracking-[-0.01em] ${form.featured ? 'text-[30px]' : 'text-[24px]'} ${text ? 'text-ink-strong' : 'text-ink-faint'}`}>
          {text || 'Your quote shows up here.'}
        </p>
        <p className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11.5px] text-ink-subtle">
          <span aria-hidden="true" className="h-px w-5 bg-line-strong" />
          <span>{form.author.trim() || DEFAULT_AUTHOR}</span>
          {form.addedOn && (
            <>
              <span aria-hidden="true" className="text-ink-faint">·</span>
              <span className="text-ink-faint">Added {formatQuoteDate(form.addedOn)}</span>
            </>
          )}
          {form.editedOn && form.editedOn >= form.addedOn && (
            <>
              <span aria-hidden="true" className="text-ink-faint">·</span>
              <span className="text-ink-faint">Edited {formatQuoteDate(form.editedOn)}</span>
            </>
          )}
        </p>
      </div>
      {paragraphs.length > 0 && (
        <div className="space-y-3 border-t border-dashed border-line pt-4 text-[13px] leading-relaxed text-ink-muted">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="whitespace-pre-line">{paragraph}</p>
          ))}
        </div>
      )}
    </section>
  )
}
