import { Fragment, useEffect, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import SiteFooter from './components/site-footer'
import BottomBlur from './components/bottom-blur'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { Bone } from './components/skeleton'
import { link, dashboardPath, HOME_PATH } from './lib/router'
import { useAuth } from './lib/supabase'
import { isSiteOwner } from './lib/dashboard'
import { arrangeQuotes, paragraphsOf, formatQuoteDate, quoteNumber } from './lib/quote'
import { listQuotes, errorText } from './lib/quote-api'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const GUTTER = 'px-6 sm:px-10'
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50'
const QUIET_LINK = `rounded-sm transition-colors duration-200 hover:text-ink-strong ${FOCUS}`
const WORD_STAGGER = 90
const MORE_ID = 'more-quotes'

function Words({ text }) {
  return text.split(' ').map((word, i) => (
    <Fragment key={i}>
      {i > 0 && ' '}
      <span className="inline-block animate-fade-in-up" style={{ animationDelay: `${120 + i * WORD_STAGGER}ms` }}>
        {word}
      </span>
    </Fragment>
  ))
}

function Stamp({ label, iso }) {
  return (
    <span>
      {label} <time dateTime={iso}>{formatQuoteDate(iso)}</time>
    </span>
  )
}

function Dates({ quote, stacked = false, className = '' }) {
  return (
    <span className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${stacked ? 'sm:flex-col' : ''} ${className}`}>
      <Stamp label="Added" iso={quote.addedOn} />
      {quote.editedOn && (
        <>
          <span aria-hidden="true" className={stacked ? 'sm:hidden' : ''}>·</span>
          <Stamp label="Edited" iso={quote.editedOn} />
        </>
      )}
    </span>
  )
}

function EditLink({ quote }) {
  return (
    <a {...link(dashboardPath(`quotes/${quote.id}`))} className={`text-ink-faint ${QUIET_LINK}`}>
      Edit
    </a>
  )
}

function Explanation({ text, className = '' }) {
  return (
    <div className={`max-w-[60ch] space-y-5 text-ink-muted ${className}`}>
      {paragraphsOf(text).map((paragraph) => (
        <p key={paragraph} className="whitespace-pre-line">{paragraph}</p>
      ))}
    </div>
  )
}

function QuoteRow({ quote, owner }) {
  const number = quoteNumber(quote.number)
  return (
    <li id={quote.slug} className={`${GUTTER} grid scroll-mt-20 gap-y-5 border-b border-dashed border-line py-10 sm:grid-cols-[180px_1fr] sm:py-14`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11.5px] text-ink-faint sm:flex-col sm:gap-y-2">
        <a href={`#${quote.slug}`} aria-label={`Link to quote ${number}`} className={`text-ink-subtle ${QUIET_LINK}`}>
          No. {number}
        </a>
        <Dates quote={quote} stacked />
        {owner && <EditLink quote={quote} />}
      </div>

      <figure>
        <blockquote>
          <p className="relative max-w-[26ch] font-vergilia text-[26px] leading-[1.2] tracking-[-0.01em] text-ink-strong sm:text-[34px]">
            <span aria-hidden="true" className="absolute right-full pr-[0.12em] text-ink-faint">“</span>
            {quote.text}
          </p>
        </blockquote>
        <figcaption className="mt-5 flex items-center gap-3 font-mono text-[12.5px] text-ink-subtle">
          <span aria-hidden="true" className="h-px w-6 bg-line-strong" />
          <span>{quote.author}</span>
        </figcaption>
        {quote.explanation && <Explanation text={quote.explanation} className="mt-7 text-[15px] leading-[1.7]" />}
      </figure>
    </li>
  )
}

function Hero({ quote, owner }) {
  const captionDelay = 120 + quote.text.split(' ').length * WORD_STAGGER + 120
  return (
    <figure id={quote.slug} className="mt-10 scroll-mt-20 sm:mt-14">
      <span aria-hidden="true" className="block font-vergilia text-[88px] leading-[0.6] text-ink-faint sm:text-[120px] animate-fade-in-up">
        “
      </span>
      <blockquote className="mt-4">
        <h1 className="max-w-[14ch] font-vergilia text-[clamp(44px,9vw,96px)] leading-[1.02] tracking-[-0.02em] text-ink-strong">
          <Words text={quote.text} />
        </h1>
      </blockquote>
      <figcaption
        className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[13px] text-ink-subtle animate-fade-in-up"
        style={{ animationDelay: `${captionDelay}ms` }}
      >
        <span aria-hidden="true" className="h-px w-8 bg-line-strong" />
        <span>{quote.author}</span>
        <span aria-hidden="true" className="text-ink-faint">·</span>
        <Dates quote={quote} className="text-ink-faint" />
        {owner && (
          <>
            <span aria-hidden="true" className="text-ink-faint">·</span>
            <EditLink quote={quote} />
          </>
        )}
      </figcaption>
    </figure>
  )
}

function HeroSkeleton() {
  return (
    <div className="mt-10 sm:mt-14" aria-busy="true" aria-label="Loading quotes">
      <Bone className="h-12 w-14 rounded-md sm:h-16 sm:w-20" />
      <div className="mt-8 flex flex-col gap-4">
        <Bone className="h-12 w-[78%] rounded-lg sm:h-20" />
        <Bone className="h-12 w-[52%] rounded-lg sm:h-20" />
      </div>
      <Bone className="mt-10 h-3 w-48" />
    </div>
  )
}

function Blank({ children, action }) {
  return (
    <div className="mt-10 rounded-xl border border-dashed border-line px-6 py-14 text-center animate-rise-in sm:mt-14">
      <Icon name="flag" className="mx-auto h-5 w-5 text-ink-faint" />
      <p className="mx-auto mt-3 max-w-[40ch] text-[13.5px] leading-relaxed text-ink-muted">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export default function QuotePage({ theme, onToggleTheme }) {
  const { session } = useAuth()
  const owner = isSiteOwner(session?.user)
  const [state, setState] = useState({ status: 'loading', quotes: [], error: null })

  useEffect(() => {
    let cancelled = false
    listQuotes()
      .then((quotes) => { if (!cancelled) setState({ status: 'ready', quotes, error: null }) })
      .catch((error) => { if (!cancelled) setState({ status: 'error', quotes: [], error }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (state.status !== 'ready' || !window.location.hash) return
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
  }, [state.status])

  const { featured, more } = arrangeQuotes(state.quotes)

  const addLink = owner && (
    <a
      {...link(dashboardPath('quotes/new'))}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink-strong"
    >
      <Icon name="plus" className="h-3.5 w-3.5" /> Add a quote
    </a>
  )

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
        <section className={`${GUTTER} pt-16 pb-20 sm:pt-24 sm:pb-28`}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 animate-rise-in">
            <p className={KICKER}>/ quote</p>
            <div className="flex items-center gap-4">
              {more.length > 0 && (
                <a href={`#${MORE_ID}`} className={`group inline-flex items-center gap-1.5 font-mono text-[11.5px] text-ink-subtle ${QUIET_LINK}`}>
                  <span>{more.length} more</span>
                  <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-y-0.5">↓</span>
                </a>
              )}
              {addLink}
            </div>
          </div>

          {state.status === 'loading' && <HeroSkeleton />}
          {state.status === 'error' && <Blank>{errorText(state.error)}</Blank>}
          {state.status === 'ready' && !featured && <Blank action={addLink}>No quotes here yet. The first one is on its way.</Blank>}
          {featured && <Hero quote={featured} owner={owner} />}
        </section>

        {featured?.explanation && (
          <section className={`${GUTTER} grid gap-y-6 border-t border-dashed border-line py-16 sm:grid-cols-[180px_1fr] sm:py-20`}>
            <h2 className={KICKER}>What it means</h2>
            <Explanation text={featured.explanation} className="text-[15.5px] leading-[1.75]" />
          </section>
        )}

        {more.length > 0 && (
          <section id={MORE_ID} aria-labelledby={`${MORE_ID}-title`} className="scroll-mt-14 border-t border-dashed border-line">
            <div className={`${GUTTER} flex items-baseline justify-between gap-6 border-b border-dashed border-line py-6`}>
              <h2 id={`${MORE_ID}-title`} className={KICKER}>More quotes</h2>
              <span className="font-mono text-[11.5px] text-ink-faint">Newest first</span>
            </div>
            <ol>
              {more.map((quote) => (
                <QuoteRow key={quote.id} quote={quote} owner={owner} />
              ))}
            </ol>
          </section>
        )}

        <SiteFooter gutter={GUTTER} stripe className="mt-auto" />
      </main>

      <BottomBlur />
    </div>
  )
}
