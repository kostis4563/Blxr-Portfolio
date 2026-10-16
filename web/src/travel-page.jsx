import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, HOME_PATH } from './lib/router'
import { MAP_WIDTH, MAP_HEIGHT, MAP_COUNTRIES } from './lib/travel-map'
import { VISITED, VISITED_NAMES, describeVisit } from './lib/travel'

const LABEL = `World map. Countries I have been to are white: ${VISITED.map(describeVisit).join(', ')}.`

export default function TravelPage({ theme, onToggleTheme }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 frame-bleed-b border-b border-x border-dashed border-line top-0 flex items-center px-6 sm:px-10">
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

      <main className="w-full max-w-[960px] mx-auto flex min-h-screen items-center pt-14 border-x border-dashed border-line bg-bg px-4 sm:px-8">
        <h1 className="sr-only">Travel</h1>
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label={LABEL} className="block h-auto w-full">
          {Object.entries(MAP_COUNTRIES).map(([name, d]) => (
            <path
              key={name}
              d={d}
              strokeWidth={0.6}
              strokeLinejoin="round"
              className={`stroke-bg ${VISITED_NAMES.has(name) ? 'fill-ink-strong' : 'fill-ink-faint/55'}`}
            />
          ))}
        </svg>
      </main>
    </div>
  )
}
