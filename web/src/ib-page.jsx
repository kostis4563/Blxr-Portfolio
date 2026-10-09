import { useEffect, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { TEXT_BUTTON, Choice, Rating, SubjectSearch, fmt, plural } from './components/ib/ui'
import DiplomaView from './components/ib/diploma'
import { link, navigate, HOME_PATH, CV_PATH, USES_PATH, CONTACT_PATH, IB_PATH } from './lib/router'
import {
  IB_STORAGE_KEY,
  DEFAULT_SUBJECT,
  DIPLOMA_WARNINGS,
  SESSIONS,
  findSubject,
  levelsOf,
  effectiveLevel,
  readEntry,
  markResult,
  gradeRanges,
  gradeForPercent,
  gradeFromMarks,
  subjectResult,
  neededOnRest,
  rawCuts,
  parseNumber,
  parseGrade,
  cutsFor,
  criteriaTotal,
  cleanEntries,
  cleanCuts,
  cleanSlots,
  cleanOffers,
  cleanCore,
  emptySlots,
  encodeShare,
  decodeShare,
} from './lib/ib'

const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

const LEVEL_NAMES = { SL: 'Standard level', HL: 'Higher level' }
const SESSION_NAMES = { may: 'May', nov: 'November' }
const SHARE_PREFIX = '#share='

const EMPTY_STATE = {
  view: 'subject',
  subject: DEFAULT_SUBJECT,
  level: 'HL',
  session: 'may',
  marks: {},
  custom: {},
  slots: emptySlots(),
  tok: '',
  ee: '',
  offers: [],
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function migrateCustom(custom) {
  return Object.fromEntries(
    Object.entries(cleanCuts(custom)).map(([k, cuts]) => [/^(may|nov):/.test(k) ? k : `may:${k}`, cuts]),
  )
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(IB_STORAGE_KEY) || 'null')
    if (!isObject(saved)) return EMPTY_STATE
    return {
      view: saved.view === 'diploma' ? 'diploma' : 'subject',
      subject: findSubject(saved.subject) ? saved.subject : DEFAULT_SUBJECT,
      level: saved.level === 'SL' ? 'SL' : 'HL',
      session: SESSIONS.includes(saved.session) ? saved.session : 'may',
      marks: isObject(saved.marks) ? Object.fromEntries(Object.entries(saved.marks).map(([k, v]) => [k, cleanEntries(v)])) : {},
      custom: migrateCustom(saved.custom),
      slots: cleanSlots(saved.slots),
      tok: cleanCore(saved.tok),
      ee: cleanCore(saved.ee),
      offers: cleanOffers(saved.offers),
    }
  } catch {
    return EMPTY_STATE
  }
}

function saveState(state) {
  try {
    localStorage.setItem(IB_STORAGE_KEY, JSON.stringify(state))
  } catch {
  }
}

function readSharedHash() {
  const hash = window.location.hash
  return hash.startsWith(SHARE_PREFIX) ? decodeShare(hash.slice(SHARE_PREFIX.length)) : null
}

function applyShared(own, shared) {
  if (shared.view === 'diploma') {
    return {
      ...own,
      view: 'diploma',
      slots: cleanSlots(shared.slots),
      tok: cleanCore(shared.tok),
      ee: cleanCore(shared.ee),
      offers: cleanOffers(shared.offers),
    }
  }
  const subject = findSubject(shared.subject)
  if (!subject) return null
  const level = effectiveLevel(subject, shared.level)
  const session = SESSIONS.includes(shared.session) ? shared.session : 'may'
  const key = `${subject.id}:${level}`
  const prefix = `${session}:${key}:`
  const custom = Object.fromEntries(Object.entries(own.custom).filter(([k]) => !k.startsWith(prefix)))
  for (const [id, cuts] of Object.entries(cleanCuts(shared.custom))) custom[prefix + id] = cuts
  return {
    ...own,
    view: 'subject',
    subject: subject.id,
    level,
    session,
    marks: { ...own.marks, [key]: cleanEntries(shared.marks) },
    custom,
  }
}

function useIbState() {
  const [state, setState] = useState(EMPTY_STATE)
  const [loaded, setLoaded] = useState(false)
  const [shared, setShared] = useState(null)

  useEffect(() => {
    const own = loadState()
    const incoming = readSharedHash()
    const merged = incoming ? applyShared(own, incoming) : null
    if (window.location.hash.startsWith(SHARE_PREFIX)) navigate(IB_PATH, { replace: true })
    setState(merged ?? own)
    setShared(merged ? merged.view : null)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded && !shared) saveState(state)
  }, [loaded, shared, state])

  return {
    state,
    setState,
    shared,
    keepShared: () => setShared(null),
    dropShared: () => {
      setState(loadState())
      setShared(null)
    },
  }
}

function distance(result) {
  if (!result.next) return result.above === 0 ? 'right on the 7 line.' : `${plural(result.above, 'mark')} clear of the 7 line.`
  return `${plural(result.next.need, 'more mark')} for a ${result.next.grade}.`
}

function focusNextMark(event) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  const all = [...document.querySelectorAll('[data-ib-mark]')]
  const next = all[all.indexOf(event.currentTarget) + 1]
  if (next) next.focus()
  else event.currentTarget.blur()
}

function Criteria({ component, entry, onPatch }) {
  const values = entry?.criteria ?? {}
  const sum = criteriaTotal(component.criteria, values)

  const change = (id, value) => {
    const criteria = { ...values, [id]: value }
    const next = criteriaTotal(component.criteria, criteria)
    onPatch({ criteria, mark: next.filled ? String(next.total) : '' })
  }

  return (
    <div className="mt-4 border-l border-line pl-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-2.5 text-[13px]">
        {component.criteria.map((c) => {
          const n = parseNumber(values[c.id])
          const inputId = `ib-${component.id}-crit-${c.id}`
          return (
            <div key={c.id} className="contents">
              <label htmlFor={inputId} className="text-ink-muted">
                {c.name}
              </label>
              <div className="flex items-baseline gap-1 tabular-nums">
                <input
                  id={inputId}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="–"
                  value={values[c.id] ?? ''}
                  onChange={(event) => change(c.id, event.target.value)}
                  className={`w-9 border-b bg-transparent pb-0.5 text-right text-ink-strong outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-ink-strong ${
                    n !== null && n > c.max ? 'border-red-400' : 'border-line-strong'
                  }`}
                />
                <span className="w-7 text-ink-faint">/{c.max}</span>
              </div>
            </div>
          )
        })}
      </div>
      {sum.over && <p className="mt-3 text-[13px] text-red-400">One of these is above its maximum.</p>}
    </div>
  )
}

function PaperRow({ component, entry, cuts, onPatch }) {
  const [criteriaOpen, setCriteriaOpen] = useState(null)
  const read = readEntry(entry, component.outOf)
  const total = read.outOf ?? component.outOf
  const ranges = gradeRanges(cuts, total)
  const result = read.state === 'ok' ? markResult(read.mark, read.outOf, cuts) : null
  const bad = read.state === 'tooHigh' || read.state === 'badTotal'
  const id = `ib-${component.id}`
  const hasCriteria = Object.values(entry?.criteria ?? {}).some(Boolean)
  const showCriteria = component.criteria && (criteriaOpen ?? hasCriteria)

  return (
    <li className="border-b border-line py-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_3rem] items-center gap-x-4 sm:gap-x-8">
        <div className="min-w-0">
          <p className="text-[15px] text-ink-strong">{component.name}</p>
          <p className="mt-1 text-[13px] text-ink-subtle">
            <span className="whitespace-nowrap">{component.weight}% of the grade,</span>{' '}
            <span className="whitespace-nowrap">7 from {ranges[0].from}</span>
          </p>
        </div>

        <div className="flex items-baseline gap-2 text-[17px] tabular-nums">
          <label htmlFor={`${id}-mark`} className="sr-only">{component.name} mark</label>
          <input
            id={`${id}-mark`}
            data-ib-mark=""
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="–"
            value={entry?.mark ?? ''}
            onChange={(event) => onPatch({ mark: event.target.value })}
            onKeyDown={focusNextMark}
            className={`w-14 border-b bg-transparent pb-1 text-right text-ink-strong outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-ink-strong ${read.state === 'tooHigh' ? 'border-red-400' : 'border-line-strong'}`}
          />
          <span aria-hidden="true" className="text-ink-faint">/</span>
          <label htmlFor={`${id}-total`} className="sr-only">{component.name} out of</label>
          <input
            id={`${id}-total`}
            inputMode="numeric"
            autoComplete="off"
            placeholder={String(component.outOf)}
            value={entry?.outOf ?? String(component.outOf)}
            onChange={(event) => onPatch({ outOf: event.target.value })}
            className={`w-12 border-b bg-transparent pb-1 text-ink-muted outline-none transition-colors duration-200 focus:border-ink-strong ${read.state === 'badTotal' ? 'border-red-400' : 'border-transparent'}`}
          />
        </div>

        <span className={`text-right text-[28px] font-semibold leading-none tabular-nums tracking-tight ${result ? 'text-ink-strong' : 'text-ink-faint/50'}`}>
          {result?.grade ?? '–'}
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <p aria-live="polite" className="min-h-[1.25rem] text-[13px] text-ink-muted">
          {result && (
            <>
              <span className="sr-only">{component.name}: grade {result.grade}. </span>
              <Rating grade={result.grade} />, {distance(result)}
            </>
          )}
          {bad && (
            <span className="text-red-400">
              {read.state === 'tooHigh' ? `That's more than ${fmt(read.outOf)}, the most this paper gives.` : 'The total has to be a number above 0.'}
            </span>
          )}
        </p>
        {component.criteria && (
          <button
            type="button"
            aria-expanded={Boolean(showCriteria)}
            onClick={() => setCriteriaOpen(!showCriteria)}
            className={`${TEXT_BUTTON} shrink-0`}
          >
            {showCriteria ? 'Hide criteria' : 'By criteria'}
          </button>
        )}
      </div>

      {showCriteria && <Criteria component={component} entry={entry} onPatch={onPatch} />}
    </li>
  )
}

function Summary({ components, entries, overall }) {
  const result = subjectResult(components, entries)
  const grade = result.pct === null ? null : gradeForPercent(result.pct, overall)
  const needs = result.complete ? [] : neededOnRest(result, overall)
  const filled = components.length - result.missing.length
  const warning = result.complete && grade ? DIPLOMA_WARNINGS[grade] : null

  let detail = 'Enter a mark above to see your subject grade.'
  if (grade && !result.complete) detail = `${fmt(result.pct)}% weighted, from ${filled} of ${components.length} papers.`
  else if (grade && grade < 7) detail = `${fmt(result.pct)}% weighted, ${fmt(overall[grade - 1] - result.pct)} points short of a ${grade + 1}.`
  else if (grade) detail = `${fmt(result.pct)}% weighted, ${fmt(result.pct - overall[5])} points clear of the 7 line.`

  return (
    <section aria-label="Subject grade" className="mt-16">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0 pb-2">
          <p className="text-[13px] text-ink-subtle">{result.complete ? 'Subject grade' : 'Projected subject grade'}</p>
          <p aria-live="polite" className="mt-2 text-[15px] leading-[1.6] text-ink-secondary">
            {grade && (
              <>
                <Rating grade={grade} />.{' '}
              </>
            )}
            {detail}
          </p>
        </div>
        <span className={`text-[64px] font-semibold leading-[0.85] tabular-nums tracking-tight ${grade ? 'text-ink-strong' : 'text-ink-faint/50'}`}>
          {grade ?? '–'}
        </span>
      </div>

      {warning && <p className="mt-6 text-[13px] text-red-400">{warning}</p>}

      {needs.length > 0 && (
        <div className="mt-10 border-t border-line pt-6">
          <p className="text-[13px] text-ink-subtle">
            What you need on {result.missing.map((c) => c.name).join(' and ')}
          </p>
          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-8 gap-y-2.5 text-[14px] tabular-nums">
            {[...needs].reverse().map((row) => (
              <div key={row.grade} className="contents">
                <dt className="text-ink-muted">For a {row.grade}</dt>
                <dd className={row.state === 'open' ? 'text-ink-strong' : 'text-ink-subtle'}>
                  {row.state === 'locked' && 'Already secured'}
                  {row.state === 'out' && 'Out of reach'}
                  {row.state === 'open' &&
                    `${result.missing
                      .map((c) => {
                        const total = readEntry(entries[c.id], c.outOf).outOf ?? c.outOf
                        return `${Math.ceil((row.need * total) / 100 - 1e-9)}/${fmt(total)}`
                      })
                      .join(', ')}  (${fmt(row.need)}%)`}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}

function BoundaryRow({ label, total, cuts, unit, onCommit, editing }) {
  const [drafts, setDrafts] = useState({})
  const shown = unit === '%' ? cuts : rawCuts(cuts, total)
  const values = shown.map((value, i) => drafts[i] ?? String(value))
  const max = unit === '%' ? 100 : total
  const fits = (nums) => nums.every((n, i) => n !== null && n <= max && (i === 0 || n >= nums[i - 1]))
  const valid = fits(values.map(parseNumber))

  const change = (i, text) => {
    const next = { ...drafts, [i]: text }
    setDrafts(next)
    const nums = shown.map((value, j) => parseNumber(next[j] ?? String(value)))
    if (fits(nums)) onCommit(unit === '%' ? nums : nums.map((n) => (n / total) * 100))
  }

  return (
    <tr className="border-t border-line">
      <th scope="row" className="whitespace-nowrap py-3 pr-6 text-left text-[13px] font-normal text-ink-secondary">
        {label}
        <span className="ml-1.5 text-ink-faint">{unit === '%' ? '%' : `/${fmt(total)}`}</span>
      </th>
      {[...values].reverse().map((value, k) => {
        const i = values.length - 1 - k
        return (
          <td key={i} className="px-1 py-2 text-center text-[13px] tabular-nums text-ink-muted">
            {editing ? (
              <input
                aria-label={`${label}, grade ${i + 2} starts at`}
                inputMode="decimal"
                value={value}
                onChange={(event) => change(i, event.target.value)}
                onBlur={() => setDrafts({})}
                className={`w-10 border-b bg-transparent pb-0.5 text-center text-ink-strong outline-none focus:border-ink-strong ${valid ? 'border-line-strong' : 'border-red-400'}`}
              />
            ) : (
              value
            )}
          </td>
        )
      })}
      <td className="px-1 py-2 text-center text-[13px] tabular-nums text-ink-faint">0</td>
    </tr>
  )
}

function Boundaries({ components, entries, cutsOf, overall, session, customised, onCommit, onReset }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <button type="button" aria-expanded={open} onClick={() => setOpen((on) => !on)} className={TEXT_BUTTON}>
          {open ? 'Hide grade boundaries' : 'Show grade boundaries'}
        </button>
        {open && (
          <div className="flex items-baseline gap-5">
            {customised && (
              <button type="button" onClick={onReset} className={TEXT_BUTTON}>
                Reset to estimates
              </button>
            )}
            <button type="button" onClick={() => setEditing((on) => !on)} aria-pressed={editing} className={TEXT_BUTTON}>
              {editing ? 'Done' : 'Edit'}
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="animate-rise-in">
          <p className="mt-4 text-[13px] leading-[1.6] text-ink-subtle">
            The lowest mark for each grade in the {SESSION_NAMES[session]} session.{' '}
            {editing
              ? 'Type in the official numbers and every grade above updates.'
              : customised
                ? 'These are your own numbers.'
                : 'These are estimates. If you have the official ones, press edit and put them in.'}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="pb-2 text-left text-[12px] font-normal text-ink-faint">
                    <span className="sr-only">Component</span>
                  </th>
                  {[7, 6, 5, 4, 3, 2, 1].map((grade) => (
                    <th key={grade} scope="col" className="pb-2 text-center text-[15px] font-semibold leading-none tabular-nums text-ink-subtle">
                      {grade}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {components.map((component) => (
                  <BoundaryRow
                    key={component.id}
                    label={component.name}
                    total={readEntry(entries[component.id], component.outOf).outOf ?? component.outOf}
                    cuts={cutsOf(component.id, component.cuts)}
                    unit="marks"
                    editing={editing}
                    onCommit={(cuts) => onCommit(component.id, cuts)}
                  />
                ))}
                <BoundaryRow label="Subject" total={100} cuts={overall} unit="%" editing={editing} onCommit={(cuts) => onCommit('overall', cuts)} />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function SubjectView({ state, setState, subject, level, cutsIn }) {
  const key = `${subject.id}:${level}`
  const prefix = `${state.session}:${key}:`
  const { components, overall: defaultOverall } = subject.levels[level]
  const entries = state.marks[key] ?? {}
  const cutsOf = cutsIn(key)
  const overall = cutsOf('overall', defaultOverall)
  const customised = Object.keys(state.custom).some((k) => k.startsWith(prefix))
  const hasMarks = Object.values(entries).some((entry) => entry?.mark)

  const patchEntry = (id, patch) =>
    setState((s) => {
      const current = s.marks[key] ?? {}
      return { ...s, marks: { ...s.marks, [key]: { ...current, [id]: { ...current[id], ...patch } } } }
    })

  const commitCuts = (id, cuts) => setState((s) => ({ ...s, custom: { ...s.custom, [prefix + id]: cuts } }))

  const resetCuts = () =>
    setState((s) => ({ ...s, custom: Object.fromEntries(Object.entries(s.custom).filter(([k]) => !k.startsWith(prefix))) }))

  const clearMarks = () =>
    setState((s) => {
      const marks = { ...s.marks }
      delete marks[key]
      return { ...s, marks }
    })

  return (
    <>
      <div className="mt-10">
        <SubjectSearch id="ib-subject" label="Subject" subject={subject} shortcut onPick={(id) => setState((s) => ({ ...s, subject: id }))} />
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 text-[14px]">
          <Choice
            label="Level"
            value={level}
            onChange={(next) => setState((s) => ({ ...s, level: next }))}
            options={['HL', 'SL'].map((value) => ({ value, label: LEVEL_NAMES[value], disabled: !levelsOf(subject).includes(value) }))}
          />
          <Choice
            label="Exam session"
            value={state.session}
            onChange={(session) => setState((s) => ({ ...s, session }))}
            options={SESSIONS.map((value) => ({ value, label: SESSION_NAMES[value] }))}
          />
        </div>
      </div>

      <div className="mt-14">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <p className="text-[13px] text-ink-subtle">Papers</p>
          <button type="button" onClick={clearMarks} disabled={!hasMarks} className={TEXT_BUTTON}>
            Clear
          </button>
        </div>
        <ul>
          {components.map((component) => (
            <PaperRow
              key={`${key}:${component.id}`}
              component={component}
              entry={entries[component.id]}
              cuts={cutsOf(component.id, component.cuts)}
              onPatch={(patch) => patchEntry(component.id, patch)}
            />
          ))}
        </ul>
      </div>

      <Summary components={components} entries={entries} overall={overall} />

      <Boundaries
        key={prefix}
        components={components}
        entries={entries}
        cutsOf={cutsOf}
        overall={overall}
        session={state.session}
        customised={customised}
        onCommit={commitCuts}
        onReset={resetCuts}
      />
    </>
  )
}

function ViewBar({ view, onView, buildShare }) {
  const [status, setStatus] = useState('idle')
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (status !== 'copied') return undefined
    const timer = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(timer)
  }, [status])

  const copy = async () => {
    const next = `${window.location.origin}${IB_PATH}${SHARE_PREFIX}${encodeShare(buildShare())}`
    setUrl(next)
    try {
      await navigator.clipboard.writeText(next)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="mt-12">
      <div className="flex items-baseline justify-between gap-6 border-b border-line pb-3">
        <Choice
          label="Calculator"
          className="text-[15px]"
          value={view}
          onChange={onView}
          options={[
            { value: 'subject', label: 'Subject' },
            { value: 'diploma', label: 'Diploma' },
          ]}
        />
        <button type="button" onClick={copy} className={TEXT_BUTTON}>
          {status === 'copied' ? 'Link copied' : 'Copy link'}
        </button>
        <span aria-live="polite" className="sr-only">
          {status === 'copied' ? 'Link copied' : ''}
        </span>
      </div>
      {status === 'failed' && (
        <div className="mt-4 animate-rise-in">
          <label htmlFor="ib-share-url" className="text-[13px] text-ink-subtle">
            Copying didn't work here, so copy the link yourself.
          </label>
          <input
            id="ib-share-url"
            readOnly
            autoFocus
            value={url}
            onFocus={(event) => event.target.select()}
            className="mt-2 w-full border-b border-line-strong bg-transparent pb-1 text-[13px] text-ink-strong outline-none focus:border-ink-strong"
          />
        </div>
      )}
    </div>
  )
}

export default function IbPage({ theme, onToggleTheme }) {
  const { state, setState, shared, keepShared, dropShared } = useIbState()

  const subject = findSubject(state.subject) ?? findSubject(DEFAULT_SUBJECT)
  const level = effectiveLevel(subject, state.level)
  const cutsIn = (key) => (id, fallback) => cutsFor(state.custom, `${state.session}:${key}:${id}`, fallback)

  const slots = state.slots.map((slot, index) => {
    const slotSubject = findSubject(slot.subject)
    const slotLevel = slotSubject ? effectiveLevel(slotSubject, slot.level) : slot.level
    const key = slotSubject ? `${slotSubject.id}:${slotLevel}` : null
    const fromMarks = slotSubject ? gradeFromMarks(slotSubject, slotLevel, state.marks[key], cutsIn(key)) : null
    const manual = parseGrade(slot.grade)
    return { index, subject: slotSubject, level: slotLevel, raw: slot.grade, manual, fromMarks, grade: manual ?? fromMarks?.grade ?? null }
  })

  const buildShare = () => {
    if (state.view === 'diploma') {
      return {
        view: 'diploma',
        slots: slots.map((slot) => ({ subject: slot.subject?.id ?? null, level: slot.level, grade: slot.grade ? String(slot.grade) : '' })),
        tok: state.tok,
        ee: state.ee,
        offers: state.offers.map(({ name, points, hl }) => ({ name, points, hl })),
      }
    }
    const prefix = `${state.session}:${subject.id}:${level}:`
    return {
      view: 'subject',
      subject: subject.id,
      level,
      session: state.session,
      marks: state.marks[`${subject.id}:${level}`] ?? {},
      custom: Object.fromEntries(
        Object.entries(state.custom)
          .filter(([k]) => k.startsWith(prefix))
          .map(([k, cuts]) => [k.slice(prefix.length), cuts]),
      ),
    }
  }

  const openSubject = (subjectId, slotLevel) => {
    setState((s) => ({ ...s, view: 'subject', subject: subjectId, level: slotLevel }))
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-x border-dashed border-line top-0 flex items-center px-6 sm:px-10">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            <span>Back to Home</span>
          </a>
          <div className="flex items-center gap-4">
            <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors duration-200" />
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="text-ink-muted hover:text-ink-strong transition-colors duration-200"
            />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[960px] mx-auto flex flex-col min-h-screen pt-14 border-x border-dashed border-line bg-bg">
        <section className="px-6 pt-20 pb-16 sm:px-10 sm:pt-28 animate-rise-in">
          <div className="mx-auto max-w-[640px]">
            <h1 className="text-[32px] font-semibold leading-[1.1] tracking-tight text-ink-strong sm:text-[40px]">
              IB grade calculator
            </h1>
            <p className="mt-4 text-[15px] leading-[1.65] text-ink-muted">
              Turn paper marks into grades, add up your diploma points, and check them against your university offers.
            </p>

            {shared && (
              <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-y border-line py-4 text-[13px]">
                <p className="text-ink-secondary">
                  You're looking at a shared {shared === 'diploma' ? 'diploma' : 'result'}. It isn't saved here yet.
                </p>
                <div className="flex gap-5">
                  <button type="button" onClick={keepShared} className={TEXT_BUTTON}>
                    Keep it
                  </button>
                  <button type="button" onClick={dropShared} className={TEXT_BUTTON}>
                    Back to mine
                  </button>
                </div>
              </div>
            )}

            <ViewBar view={state.view} onView={(view) => setState((s) => ({ ...s, view }))} buildShare={buildShare} />

            {state.view === 'diploma' ? (
              <DiplomaView state={state} setState={setState} slots={slots} onOpenSubject={openSubject} />
            ) : (
              <SubjectView state={state} setState={setState} subject={subject} level={level} cutsIn={cutsIn} />
            )}

            <p className="mt-16 text-[12.5px] leading-[1.65] text-ink-faint">
              Boundaries are estimates from recent sessions and change every time, so treat each grade as a close guess. May
              and November keep their own boundaries, so you can enter the official numbers for each. Pass conditions follow
              the IB general regulations. Everything you enter stays in this browser unless you copy a link.
            </p>
          </div>
        </section>

        <footer className="mt-auto px-6 pb-10 pt-16 sm:px-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(CV_PATH)} className={FOOT_LINK}>
              <span>CV</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(USES_PATH)} className={FOOT_LINK}>
              <span>Uses</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(CONTACT_PATH)} className={FOOT_LINK}>
              <span>Contact</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
