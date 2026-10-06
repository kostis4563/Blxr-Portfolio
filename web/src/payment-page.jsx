import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, HOME_PATH, CONTACT_PATH } from './lib/router'
import { PAYMENT_INTRO, PAYMENT_METHODS } from './lib/payment'

const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]'

const tintStyle = (tint) => (tint ? { '--tint-d': tint.dark, '--tint-l': tint.light } : undefined)

const BARS = Array.from('BLXR.NET/PAYMENT', (char, i) => [1 + (char.charCodeAt(0) % 3), 1 + ((char.charCodeAt(0) + i) % 2)]).flat()

function Mark({ path, className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} shrink-0 fill-current`}>
      <path d={path} />
    </svg>
  )
}

function Line({ method, index }) {
  return (
    <li
      style={{ ...tintStyle(method.tint), animationDelay: `${520 + index * 70}ms` }}
      className="pay-tint group/line -mx-2 rounded-md px-2 py-1.5 transition-colors duration-200 hover:bg-surface-hover/70 animate-rise-in"
    >
      <div className="flex items-center gap-2.5">
        <span className={`text-ink-subtle transition-[color,transform] duration-300 ${EASE} group-hover/line:scale-110 group-hover/line:text-[var(--tint)]`}>
          <Mark path={method.path} className="h-3.5 w-3.5" />
        </span>
        <span className="text-ink-strong">{method.name}</span>
        <span aria-hidden="true" className="receipt-leader min-w-4 flex-1 self-end mb-[5px]" />
        <span className="text-ink-subtle uppercase transition-colors duration-200 group-hover/line:text-ink-secondary">{method.tag}</span>
      </div>
      {method.coins && (
        <ul aria-label="Coins" className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-6 text-[10.5px] text-ink-faint">
          {method.coins.map((coin) => (
            <li key={coin.symbol} style={tintStyle(coin.tint)} className="pay-tint inline-flex items-center gap-1">
              <span className="transition-colors duration-300 group-hover/line:text-[var(--tint)]">
                <Mark path={coin.path} className="h-3 w-3" />
              </span>
              {coin.symbol}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Receipt() {
  return (
    <div className="receipt-shadow">
      <article className="receipt bg-surface-raised px-6 pt-7 pb-10 font-mono text-[12px] leading-relaxed text-ink sm:px-8">
        <header className="text-center">
          <p className="text-[10.5px] tracking-[0.3em] text-ink-subtle">BLXR.NET</p>
          <h1 className="mt-2 font-bagus text-[30px] leading-none tracking-[-0.01em] text-ink-strong">Accepted</h1>
          <p className="mt-2.5 text-[11px] text-ink-subtle">{PAYMENT_INTRO}</p>
        </header>

        <div aria-hidden="true" className="my-5 border-t border-dashed border-line-strong" />

        <ol>
          {PAYMENT_METHODS.map((method, i) => (
            <Line key={method.id} method={method} index={i} />
          ))}
        </ol>

        <div aria-hidden="true" className="my-5 border-t border-dashed border-line-strong" />

        <dl className="flex flex-col gap-1 text-[11.5px]">
          <div className="flex justify-between">
            <dt className="text-ink-subtle">METHODS</dt>
            <dd className="tabular-nums text-ink-strong">{PAYMENT_METHODS.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-subtle">TOTAL</dt>
            <dd className="text-ink-strong">AGREED FIRST</dd>
          </div>
        </dl>

        <div aria-hidden="true" className="mt-7 flex h-10 items-stretch justify-center gap-[2px] opacity-70">
          {BARS.map((w, i) => (
            <span key={i} className={i % 2 ? 'bg-transparent' : 'bg-ink-strong'} style={{ width: `${w}px` }} />
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] tracking-[0.3em] text-ink-faint">THANK YOU</p>
      </article>
    </div>
  )
}

export default function PaymentPage({ theme, onToggleTheme }) {
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

      <main className="w-full max-w-[960px] mx-auto flex flex-col items-center min-h-screen pt-14 border-x border-dashed border-line bg-bg px-5">
        <div className="w-full max-w-[380px] pt-16 pb-16 sm:pt-24">
          <p className="mb-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-subtle animate-rise-in">/ payment</p>

          <div aria-hidden="true" className="relative z-10 mx-auto h-2.5 w-[calc(100%+20px)] -translate-x-[10px] rounded-full border border-line-strong bg-surface shadow-[inset_0_2px_3px_var(--shadow-cast)]" />
          <div className="receipt-slot -mt-1.5 px-2 pb-6">
            <div className="receipt-print">
              <Receipt />
            </div>
          </div>

          <div className="mt-4 text-center animate-rise-in" style={{ animationDelay: '1100ms' }}>
            <a
              {...link(CONTACT_PATH)}
              className="group inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink-secondary outline-none transition-[color,border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface-hover hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <span>Ask for the details</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
