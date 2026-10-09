import { useState } from 'react'
import {
  LEVELS,
  CORE_GRADES,
  MAX_OFFERS,
  levelsOf,
  corePoints,
  diplomaResult,
  checkOffer,
  emptySlots,
  newOfferId,
} from '../../lib/ib'
import { TEXT_BUTTON, TONE_TEXT, Choice, Rating, SubjectSearch, plural } from './ui'

const LEVEL_NAMES = { SL: 'Standard level', HL: 'Higher level' }

const slotName =(slot) => slot.subject?.short ?? `Subject ${slot.index + 1}`

function SlotRow({ slot, onChange, onOpenSubject }) {
  const { index, subject, level, manual, fromMarks, grade } = slot
  const available = subject ? levelsOf(subject) : LEVELS
  const id = `ib-slot-${index}`

  let note = null
  if (manual === null && fromMarks) note = fromMarks.complete ? 'From your marks.' : 'From your marks so far.'
  else if (manual !== null && fromMarks && fromMarks.grade !== manual) note = `Your marks point to a ${fromMarks.grade}.`

  return (
    <li className="border-b border-line py-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_3rem]">
        <div className="col-span-2 sm:col-span-1">
          <SubjectSearch
            id={id}
            label={`Subject ${index + 1}`}
            hideLabel
            size="sm"
            subject={subject}
            emptyText={`Subject ${index + 1}`}
            onPick={(subjectId) => onChange({ subject: subjectId })}
          />
        </div>
        <Choice
          label={`Subject ${index + 1} level`}
          className="pb-2 text-[14px]"
          value={level}
          onChange={(next) => onChange({ level: next })}
          options={['HL', 'SL'].map((value) => ({ value, label: value, name: LEVEL_NAMES[value], disabled: !available.includes(value) }))}
        />
        <div className="text-right">
          <label htmlFor={`${id}-grade`} className="sr-only">
            Subject {index + 1} grade
          </label>
          <input
            id={`${id}-grade`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            placeholder={fromMarks ? String(fromMarks.grade) : '–'}
            value={slot.raw}
            onChange={(event) => onChange({ grade: event.target.value.replace(/[^1-7]/g, '').slice(-1) })}
            className={`w-10 border-b border-transparent bg-transparent pb-1 text-right text-[28px] font-semibold leading-none tabular-nums tracking-tight text-ink-strong outline-none transition-colors duration-200 focus:border-ink-strong ${
              fromMarks ? 'placeholder:text-ink-muted' : 'placeholder:text-ink-faint/50'
            }`}
          />
        </div>
      </div>

      {subject && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] text-ink-subtle">
          {grade && <Rating grade={grade} />}
          {note && <span>{note}</span>}
          {note && manual !== null && (
            <button type="button" onClick={() => onChange({ grade: '' })} className={TEXT_BUTTON}>
              Use it
            </button>
          )}
          <button type="button" onClick={() => onOpenSubject(subject.id, level)} className={TEXT_BUTTON}>
            {fromMarks ? 'Edit marks' : 'Work it out from marks'}
          </button>
        </div>
      )}
    </li>
  )
}

function CoreRow({ label, value, onChange }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-b border-line py-5">
      <p className="text-[15px] text-ink-strong">{label}</p>
      <Choice
        label={`${label} grade`}
        clearable
        className="gap-x-5 text-[15px]"
        value={value}
        onChange={onChange}
        options={CORE_GRADES.map((grade) => ({ value: grade, label: grade }))}
      />
    </div>
  )
}

function Total({ diploma, core }) {
  const started = diploma.graded > 0 || core
  let detail = 'Add your subjects and grades above.'
  if (started) {
    detail = `${diploma.subjectTotal} from ${diploma.graded} of 6 subjects, ${
      core ? `plus ${plural(core.points, 'core point')}.` : 'core not counted yet.'
    }`
  }

  return (
    <section aria-label="Diploma total" className="mt-16">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0 pb-2">
          <p className="text-[13px] text-ink-subtle">{diploma.complete ? 'Diploma total' : 'Projected diploma total'}</p>
          <p aria-live="polite" className="mt-2 text-[15px] leading-[1.6] text-ink-secondary">
            {detail}
          </p>
        </div>
        <p className={`shrink-0 text-[64px] font-semibold leading-[0.85] tabular-nums tracking-tight ${started ? 'text-ink-strong' : 'text-ink-faint/50'}`}>
          {started ? diploma.total : '–'}
          <span className="ml-1 text-[18px] font-normal tracking-normal text-ink-faint">/45</span>
        </p>
      </div>

      <div className="mt-8 border-t border-line pt-6 text-[14px] leading-[1.6]">
        {diploma.failures.length > 0 ? (
          <>
            <p className={TONE_TEXT.weak}>Fails the diploma</p>
            <ul className="mt-2 space-y-1 text-ink-secondary">
              {diploma.failures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
          </>
        ) : diploma.passes ? (
          <p>
            <span className={TONE_TEXT.great}>Passes</span>
            <span className="text-ink-secondary"> every diploma condition. CAS also has to be complete.</span>
          </p>
        ) : (
          <p className="text-ink-subtle">Fill in all six grades, TOK and the EE to check the pass conditions.</p>
        )}
        {diploma.graded > 0 && (
          <p className="mt-3 text-[13px] tabular-nums text-ink-subtle">
            {diploma.hlPoints} at HL (12 needed), {diploma.slPoints} at SL ({diploma.slNeeded} needed)
          </p>
        )}
      </div>
    </section>
  )
}

function offerStatus(check) {
  if (check.state === 'empty') return <span className="text-ink-subtle">Add the points and HL grades it asks for.</span>
  if (check.state === 'invalid') return <span className={TONE_TEXT.weak}>Points go up to 45, and HL grades are digits from 1 to 7, like 766.</span>
  if (check.state === 'fails') return <span className={TONE_TEXT.weak}>Your diploma doesn't pass yet.</span>
  if (check.state === 'meets') return <span className={TONE_TEXT.great}>You meet this offer.</span>
  if (check.state === 'onTrack') {
    return (
      <>
        <span className={TONE_TEXT.good}>On track</span>
        <span className="text-ink-subtle"> so far. Fill in every grade to be sure.</span>
      </>
    )
  }
  const parts = check.gaps.map((gap) => {
    if (gap.kind === 'points') return `${plural(gap.need - gap.has, 'point')} short (${gap.has} of ${gap.need})`
    if (gap.kind === 'hl') return `${gap.name} needs a ${gap.need}, it's a ${gap.has}`
    return `needs another HL ${gap.need}`
  })
  return (
    <>
      <span className={TONE_TEXT.weak}>Short</span>
      <span className="text-ink-secondary">, {parts.join(', ')}.</span>
    </>
  )
}

function OfferRow({ offer, check, autoFocus, onChange, onRemove }) {
  const id = `ib-offer-${offer.id}`
  return (
    <li className="border-b border-line py-5">
      <div className="flex items-baseline gap-4 sm:gap-6">
        <label htmlFor={`${id}-name`} className="sr-only">University</label>
        <input
          id={`${id}-name`}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder="University"
          maxLength={60}
          value={offer.name}
          onChange={(event) => onChange({ name: event.target.value })}
          className="min-w-0 flex-1 border-b border-line-strong bg-transparent pb-1 text-[15px] text-ink-strong outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-ink-strong"
        />
        <div className="flex shrink-0 items-baseline gap-1.5 text-[15px] tabular-nums">
          <label htmlFor={`${id}-points`} className="sr-only">Points needed</label>
          <input
            id={`${id}-points`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="–"
            maxLength={2}
            value={offer.points}
            onChange={(event) => onChange({ points: event.target.value.replace(/\D/g, '') })}
            className="w-8 border-b border-line-strong bg-transparent pb-1 text-right text-ink-strong outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-ink-strong"
          />
          <span className="text-[13px] text-ink-faint">pts</span>
        </div>
        <div className="flex shrink-0 items-baseline gap-1.5 text-[15px] tabular-nums">
          <label htmlFor={`${id}-hl`} className="sr-only">HL grades needed, like 766</label>
          <input
            id={`${id}-hl`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="–"
            maxLength={12}
            value={offer.hl}
            onChange={(event) => onChange({ hl: event.target.value.replace(/[^\d ,]/g, '') })}
            className="w-12 border-b border-line-strong bg-transparent pb-1 text-right text-ink-strong outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-ink-strong"
          />
          <span className="text-[13px] text-ink-faint">HL</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-4 text-[13px]">
        <p aria-live="polite">{offerStatus(check)}</p>
        <button type="button" onClick={onRemove} aria-label={`Remove ${offer.name || 'this offer'}`} className={`${TEXT_BUTTON} shrink-0`}>
          Remove
        </button>
      </div>
    </li>
  )
}

export default function DiplomaView({ state, setState, slots, onOpenSubject }) {
  const [added, setAdded] = useState(null)
  const core = corePoints(state.tok, state.ee)
  const named = slots.map((slot) => ({ name: slotName(slot), level: slot.level, grade: slot.grade }))
  const diploma = diplomaResult(named, core)
  const hasAnything = state.slots.some((slot) => slot.subject || slot.grade) || state.tok || state.ee

  const setSlot = (index, patch) =>
    setState((s) => ({ ...s, slots: s.slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)) }))

  const setOffer = (id, patch) =>
    setState((s) => ({ ...s, offers: s.offers.map((offer) => (offer.id === id ? { ...offer, ...patch } : offer)) }))

  const addOffer = () => {
    const id = newOfferId()
    setAdded(id)
    setState((s) => ({ ...s, offers: [...s.offers, { id, name: '', points: '', hl: '' }] }))
  }

  let coreLine = <span className="text-ink-subtle">Pick both grades to see your bonus points.</span>
  if (core?.fails) coreLine = <span className={TONE_TEXT.weak}>An E in either one fails the diploma.</span>
  else if (core) {
    coreLine = (
      <span className="text-ink-secondary">
        TOK {state.tok} with an EE {state.ee} gives {plural(core.points, 'bonus point')}.
      </span>
    )
  }

  return (
    <>
      <div className="mt-10">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <p className="text-[13px] text-ink-subtle">Subjects</p>
          <button
            type="button"
            disabled={!hasAnything}
            onClick={() => setState((s) => ({ ...s, slots: emptySlots(), tok: '', ee: '' }))}
            className={TEXT_BUTTON}
          >
            Clear
          </button>
        </div>
        <ul>
          {slots.map((slot) => (
            <SlotRow key={slot.index} slot={slot} onChange={(patch) => setSlot(slot.index, patch)} onOpenSubject={onOpenSubject} />
          ))}
        </ul>
      </div>

      <section aria-label="Core" className="mt-14">
        <p className="border-b border-line pb-3 text-[13px] text-ink-subtle">Core</p>
        <CoreRow label="Theory of Knowledge" value={state.tok} onChange={(tok) => setState((s) => ({ ...s, tok }))} />
        <CoreRow label="Extended Essay" value={state.ee} onChange={(ee) => setState((s) => ({ ...s, ee }))} />
        <p aria-live="polite" className="mt-3 text-[13px]">
          {coreLine}
        </p>
      </section>

      <Total diploma={diploma} core={core} />

      <section aria-label="University offers" className="mt-16">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <p className="text-[13px] text-ink-subtle">University offers</p>
          <button type="button" onClick={addOffer} disabled={state.offers.length >= MAX_OFFERS} className={TEXT_BUTTON}>
            Add offer
          </button>
        </div>
        {state.offers.length === 0 && (
          <p className="py-5 text-[13px] leading-[1.6] text-ink-subtle">
            Add an offer like 38 points with 766 at HL to see if your grades meet it.
          </p>
        )}
        <ul>
          {state.offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              autoFocus={offer.id === added}
              check={checkOffer(offer, named, diploma)}
              onChange={(patch) => setOffer(offer.id, patch)}
              onRemove={() => setState((s) => ({ ...s, offers: s.offers.filter((o) => o.id !== offer.id) }))}
            />
          ))}
        </ul>
      </section>
    </>
  )
}
