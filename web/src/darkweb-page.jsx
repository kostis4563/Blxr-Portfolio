import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { still, jump, CELL, DitherSky, Notch, ThemeButton, HeroTrace, Stop, FrameLabel, useReveal } from './components/focus-kit'
import './darkweb.css'
import { CommandButton } from './components/command-button'
import { CommentPin, Inspect } from './components/figma'
import LiveSelect from './components/live-select'
import ScrambleText from './components/scramble-text'
import { Icon } from './components/icon'
import { link, HOME_PATH, BLOG_PATH, SECURITY_PATH, TERMINAL_PATH } from './lib/router'
import { CONTACT_EMAIL } from './lib/profile'
import { checkOnion, onionParts, typo } from './lib/onion'
import {
  DARKWEB_UPDATED,
  STATS,
  STATS_SOURCE,
  SECTIONS,
  LAYERS,
  LAYERS_NOTE,
  CIRCUITS,
  SEES,
  ONION_EXAMPLES,
  ONION_PARTS,
  USES,
  HISTORY,
  MYTHS,
  SAFETY,
  TOR_DOWNLOAD,
  SOURCES,
} from './lib/darkweb'

const STEP_MS = 4200
const NOISE = 'abcdefghijklmnopqrstuvwxyz234567'
const SKY_SEED = 20261023
const NAV = [
  ['layers', 'Layers'],
  ['tor', 'Tor'],
  ['onion', '.onion'],
  ['myths', 'Myths'],
]
const ROUTE = ['You', 'Guard', 'Middle', 'Exit', 'Site']
const PROMISES = ['Free and open source', 'Legal almost everywhere', 'Made by a nonprofit']

const MAX_DEPTH = 4000
const RINGS = [1, 0.74, 0.5]
const CORE = 0.24

const ORBIT_TAGS = [
  { ring: 1, angle: -112, label: 'Layer 1', note: 'The guard peels it' },
  { ring: 0.74, angle: -38, label: 'Layer 2', note: 'The middle peels it' },
  { ring: 0.5, angle: 16, label: 'Layer 3', note: 'The exit peels it' },
  { ring: CORE, angle: 90, label: 'Your request', note: 'Inside all three', core: true },
].map((tag) => ({
  ...tag,
  x: Math.round(tag.ring * Math.cos((tag.angle * Math.PI) / 180) * 1000) / 1000,
  y: Math.round(tag.ring * Math.sin((tag.angle * Math.PI) / 180) * 1000) / 1000,
}))

const onionField = (layout) => (t, gw, gh) => {
  const { cx, cy, r } = layout(gw * CELL, gh * CELL, gw, gh)
  const rings = RINGS.map((k, i) => r * k * (1 + 0.014 * Math.sin(t * 0.8 + i * 2.1)))
  const core = r * CORE
  const band = Math.max(1, r * 0.022)
  const edge = rings[0] + band * 3
  const wave = r * (1.25 - ((t * 0.14) % 1.45))
  const spread = r * 0.05
  return (gx, gy, n) => {
    const dx = gx - cx
    const dy = gy - cy
    const d = Math.sqrt(dx * dx + dy * dy)
    const sky = (0.78 - (gy / gh) * 0.55) * 0.42 + (n - 0.5) * 1.1 + 0.04
    if (d >= edge) return wave > 0 ? sky + 0.12 * Math.exp(-(((d - wave) / spread) ** 2)) : sky
    let v = 0.12 + (n - 0.5) * 0.5
    let depth = 0
    for (const ring of rings) {
      const e = (d - ring) / band
      v += 0.62 * Math.exp(-e * e)
      if (d < ring) depth++
    }
    v += depth * 0.07
    if (d < core) v += 0.36
    if (wave > 0) v += 0.2 * Math.exp(-(((d - wave) / spread) ** 2))
    return v
  }
}

const HERO_FIELD = onionField((w, h, gw, gh) =>
  w >= 1085 ? { cx: gw * 0.76, cy: gh * 0.5, r: Math.min(gh * 0.36, gw * 0.2) } : { cx: gw * 0.5, cy: gh * 1.02, r: Math.min(gw * 0.5, gh * 0.4) },
)
const CTA_FIELD = onionField((w, h, gw, gh) => ({ cx: gw * 0.5, cy: gh * 0.55, r: Math.min(gh * 0.42, gw * 0.3) }))

const pad = (n) => String(n).padStart(2, '0')
const sectionIndex = (id) => SECTIONS.findIndex((s) => s.id === id) + 1

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
  } catch {
    return iso
  }
}

function Cipher({ text, play = 0 }) {
  const [shown, setShown] = useState(text)
  const last = useRef({ text, play })

  useEffect(() => {
    const changed = last.current.text !== text || last.current.play !== play
    last.current = { text, play }
    if (!changed || still()) {
      setShown(text)
      return
    }
    let frame = 0
    const start = performance.now()
    const duration = Math.min(320 + text.length * 4, 1100)
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const settled = Math.floor(p * text.length)
      const noise = Array.from(text.slice(settled), (c) => (c === ' ' ? ' ' : NOISE[(Math.random() * NOISE.length) | 0])).join('')
      setShown(text.slice(0, settled) + noise)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, play])

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </>
  )
}

function OnionGlyph({ className = '' }) {
  return (
    <svg className={`dw-glyph ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path className="dw-glyph-sprout" d="M12 4.6V2.4M12 4.2c.5-1.3 1.7-2 3.1-2" />
      <path className="dw-glyph-layer" style={{ '--i': 0 }} d="M12 4.6C9 8 4.5 10 4.5 14.6a7.5 7.5 0 0 0 15 0C19.5 10 15 8 12 4.6Z" />
      <path className="dw-glyph-layer" style={{ '--i': 1 }} d="M12 8.4c-2 2.2-4.5 3.6-4.5 6.6a4.5 4.5 0 0 0 9 0c0-3-2.5-4.4-4.5-6.6Z" />
      <path className="dw-glyph-core" d="M12 12c-.9 1.1-2 1.9-2 3.2a2 2 0 0 0 4 0c0-1.3-1.1-2.1-2-3.2Z" />
    </svg>
  )
}

function OnionMark() {
  const [peeling, setPeeling] = useState(false)
  return (
    <span
      className="dw-mark"
      data-peeling={peeling || undefined}
      onPointerEnter={() => setPeeling(true)}
      onAnimationEnd={(event) => {
        if (event.target.classList.contains('dw-glyph-core')) setPeeling(false)
      }}
      aria-hidden="true"
    >
      <OnionGlyph />
    </span>
  )
}

function SectionHead({ id, at, label, title, rest, lede, children }) {
  return (
    <div className="fl-head" data-reveal>
      <p className="dw-head-meta">
        <FrameLabel>{label}</FrameLabel>
        <span className="dw-head-rule" aria-hidden="true" />
        <span className="dw-head-index">
          {pad(sectionIndex(at))} <span aria-hidden="true">/</span>
          <span className="sr-only">of</span> {pad(SECTIONS.length)}
        </span>
      </p>
      <h2 id={id} className="fl-h2">
        <span>
          {title}
          <Stop />
        </span>{' '}
        <span>
          <span className="dw-redact">
            {rest}
            <Stop />
          </span>
        </span>
      </h2>
      {lede && <p className="fl-head-lede">{lede}</p>}
      {children}
    </div>
  )
}

function Cell({ as: Tag = 'article', label, title, visual, children }) {
  return (
    <Tag className="fl-cell">
      {visual && <div className="fl-cell-visual">{visual}</div>}
      <FrameLabel>{label}</FrameLabel>
      <h3 className="fl-h3">{title}</h3>
      <p className="fl-cell-text">{children}</p>
    </Tag>
  )
}

function Lights() {
  return (
    <span className="dw-lights" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

function Band() {
  return (
    <div className="fl-band">
      <div className="fl-rule" />
      <div className="fl-rule" />
    </div>
  )
}

function Orbit() {
  return (
    <div className="dw-orbit" aria-hidden="true">
      {ORBIT_TAGS.map((tag, i) => (
        <span key={tag.label} className="dw-orbit-pin" data-core={tag.core || undefined} style={{ '--x': tag.x, '--y': tag.y, '--i': i }}>
          <span className="dw-orbit-tag">
            <b>{tag.label}</b>
            <small>{tag.note}</small>
          </span>
        </span>
      ))}
    </div>
  )
}

function DepthRail() {
  const [view, setView] = useState({ p: 0, at: -1, on: false })

  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      let at = -1
      SECTIONS.forEach((s, i) => {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) at = i
      })
      const cta = document.getElementById('dw-cta')
      const on = at >= 0 && (!cta || cta.getBoundingClientRect().top > window.innerHeight * 0.55)
      setView((prev) => (prev.p === p && prev.at === at && prev.on === on ? prev : { p, at, on }))
    }
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', queue, { passive: true })
    window.addEventListener('resize', queue)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', queue)
      window.removeEventListener('resize', queue)
    }
  }, [])

  const depth = Math.round((view.p * MAX_DEPTH) / 10) * 10
  return (
    <nav className="dw-rail" data-on={view.on || undefined} aria-label="Sections">
      <p className="dw-rail-depth" aria-hidden="true">
        {depth ? `−${depth.toLocaleString('en-US')}` : '0'} m
      </p>
      <ol className="dw-rail-track" style={{ '--p': view.p }}>
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <a {...jump(s.id)} aria-current={i === view.at ? 'location' : undefined} tabIndex={view.on ? undefined : -1}>
              <span>{s.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Hero({ theme, onToggleTheme, onPresent, presentRef }) {
  const host = useRef(null)
  return (
    <section className="fl-hero" id="top" aria-labelledby="dw-title">
      <div className="fl-hero-card" ref={host}>
        <div className="fl-sky" aria-hidden="true">
          <DitherSky hostRef={host} theme={theme} seed={SKY_SEED} field={HERO_FIELD} />
          <div className="fl-sky-grid" />
          <div className="fl-sky-shade" />
        </div>

        <Orbit />

        <div className="fl-hero-copy">
          <h1 id="dw-title" className="fl-h1">
            <span>
              The <ScrambleText text="Dark Web" alt=".onion" />
              <Stop />
            </span>{' '}
            <span>
              Without the Hype
              <Stop />
            </span>
          </h1>
          <p className="fl-lede">
            It’s the part of the internet a normal browser can’t open. Not a place, not one website and not mostly crime: a set of
            networks built to hide <LiveSelect name="Kostis">who’s talking to whom</LiveSelect>. Here’s how it actually works.
          </p>
          <div className="fl-actions">
            <a {...jump('layers')} className="fl-get">
              <Icon name="arrowDown" className="fl-get-apple dw-get-icon" strokeWidth={2.2} />
              <span className="fl-get-text">
                <span className="fl-get-kicker">Start reading</span>
                <span className="fl-get-title">How it works</span>
              </span>
            </a>
            <a {...jump('onion')} className="fl-ghost-btn dw-hero-ghost">
              <Icon name="key" className="h-4 w-4" />
              Check an onion address
            </a>
          </div>
          <p className="fl-download-meta">
            {SECTIONS.length} sections · Updated <time dateTime={DARKWEB_UPDATED}>{formatDate(DARKWEB_UPDATED)}</time>
          </p>
          <p className="fl-download-note">
            Nothing on this page links into the dark web. The onion addresses below are text to take apart, not links to follow.
          </p>
        </div>

        <HeroTrace hostRef={host} theme={theme} />

        <Notch className="fl-notch-logo">
          <a {...jump('top')} className="fl-notch-home" aria-label="The dark web, back to top">
            <OnionMark />
          </a>
        </Notch>

        <Notch className="fl-notch-nav">
          {NAV.map(([id, label]) => (
            <a key={id} {...jump(id)} className="fl-nav-link fl-nav-section">
              {label}
            </a>
          ))}
          <button type="button" ref={presentRef} className="dw-present" onClick={onPresent} title="Present this page as slides">
            <Icon name="presentation" className="h-3.5 w-3.5" />
            Present
          </button>
          <CommandButton className="fl-nav-link dw-nav-cmd" />
          <a {...link(HOME_PATH)} className="fl-nav-link">
            <span className="fl-nav-wide">kostis.wtf</span>
            <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
          </a>
          <ThemeButton theme={theme} onToggle={onToggleTheme} />
        </Notch>

        <Notch side="bottom" className="dw-notch-route">
          <ol className="dw-route" aria-hidden="true">
            {ROUTE.map((hop, i) => (
              <li key={hop} style={{ '--i': i }}>
                <i />
                {hop}
              </li>
            ))}
          </ol>
        </Notch>
      </div>
    </section>
  )
}

function CountSection() {
  return (
    <section className="fl-section fl-wrap" aria-labelledby="dw-count-title">
      <div className="fl-count dw-count" data-reveal>
        <p className="fl-count-ghost" aria-hidden="true">
          {STATS[0].value}
        </p>
        <h2 id="dw-count-title" className="fl-count-title">
          Over three million people use Tor every day<Stop />{' '}
          <span>
            Most of them are just reading ordinary websites, privately<Stop />
          </span>
        </h2>
      </div>
      <dl className="fl-grid fl-specs dw-stats" data-reveal>
        {STATS.map((s) => (
          <div key={s.term} className="fl-cell fl-spec">
            <dt>{s.term}</dt>
            <dd>
              {s.value}
              <span>{s.label}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="dw-source" data-reveal>
        Source: {STATS_SOURCE}
      </p>
    </section>
  )
}

function LayerVisual({ id }) {
  if (id === 'surface') {
    return (
      <div className="dw-mini" aria-hidden="true">
        <span className="dw-field">
          <Icon name="search" className="h-3.5 w-3.5" />
          what is tor
        </span>
        <span className="dw-result">
          <b>Tor (network)</b>
          <small>wikipedia.org</small>
        </span>
        <span className="dw-result">
          <b>Kostis</b>
          <small>kostis.wtf</small>
        </span>
      </div>
    )
  }
  if (id === 'deep') {
    return (
      <div className="dw-mini" aria-hidden="true">
        <span className="dw-mini-head">
          <Icon name="lock" className="h-3.5 w-3.5" />
          Sign in to continue
        </span>
        <span className="dw-field">you@mail.com</span>
        <span className="dw-field dw-field-live">
          ••••••••
          <i className="dw-caret" />
        </span>
      </div>
    )
  }
  return (
    <div className="dw-mini" aria-hidden="true">
      <span className="dw-url">
        <OnionGlyph />
        <span>{ONION_EXAMPLES[0].address}.onion</span>
      </span>
      <span className="dw-opens">
        <i className="fl-dot" data-tone="critical" />
        Chrome
        <em>Can’t open it</em>
      </span>
      <span className="dw-opens">
        <i className="fl-dot" data-tone="info" />
        Tor Browser
        <em>Opens</em>
      </span>
    </div>
  )
}

function Layers() {
  return (
    <section id="layers" className="fl-section fl-wrap" aria-labelledby="dw-layers-title">
      <SectionHead
        id="dw-layers-title"
        at="layers"
        label="Layers"
        title="Surface, deep, dark"
        rest="Each one harder to reach"
        lede="People say “dark web” when they mean three very different things. Only the last one needs special software."
      />
      <ol className="fl-grid dw-strata" data-reveal>
        {LAYERS.map((layer, i) => (
          <li key={layer.id} className="fl-cell dw-stratum" data-layer={layer.id} style={{ '--depth': i }}>
            <div className="dw-stratum-gauge">
              <span className="dw-stratum-depth">{layer.depth}</span>
              <FrameLabel>{layer.reach}</FrameLabel>
            </div>
            <div className="fl-cell-visual dw-stratum-visual">
              <LayerVisual id={layer.id} />
            </div>
            <div className="dw-stratum-copy">
              <h3 className="fl-h3">{layer.name}</h3>
              <p className="fl-cell-text">{layer.text}</p>
              <ul className="dw-tags" aria-label={`${layer.name} examples`}>
                {layer.examples.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <div className="dw-callout" data-reveal>
        <Icon name="info" className="dw-callout-icon" />
        <p>{LAYERS_NOTE}</p>
        <CommentPin name="Kostis" initial="K" text="Every iceberg meme gets this one wrong." time="now" className="dw-callout-pin" />
      </div>
    </section>
  )
}

const NODE_ICON = { you: 'user', site: 'globe', service: 'lock', rendezvous: 'link' }

function seesLabel(node) {
  if (node.id === 'you') return 'What your browser knows'
  if (node.id === 'site') return 'What the website sees'
  return `What the ${node.label.toLowerCase()} relay sees`
}

function seesValue(value) {
  if (value === 'https') return 'Only without HTTPS'
  return value ? 'Yes' : 'No'
}

function SeesRow({ label, value }) {
  const tone = value === true ? 'yes' : value === false ? 'no' : 'maybe'
  return (
    <li className="dw-sees-row" data-value={tone}>
      <span>{label}</span>
      <span className="dw-sees-value">
        <i className="fl-dot" data-tone={tone === 'yes' ? 'critical' : tone === 'no' ? 'info' : 'high'} />
        {seesValue(value)}
      </span>
    </li>
  )
}

function Circuit() {
  const [mode, setMode] = useState('web')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [touched, setTouched] = useState(false)
  const stageRef = useRef(null)

  const circuit = CIRCUITS[mode]
  const { nodes, steps } = circuit
  const current = steps[step]
  const lit = (i) => (current.lit ? current.lit.includes(i) : i < current.at)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || touched || still() || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting), { threshold: 0.5 })
    io.observe(stage)
    return () => io.disconnect()
  }, [touched])

  useEffect(() => {
    if (!playing) return
    const id = setTimeout(() => setStep((s) => (s + 1) % steps.length), STEP_MS)
    return () => clearTimeout(id)
  }, [playing, step, steps.length])

  const take = () => {
    setTouched(true)
    setPlaying(false)
  }
  const go = (to) => {
    take()
    setStep((to + steps.length) % steps.length)
  }
  const switchMode = (next) => {
    if (next === mode) return
    setMode(next)
    setStep(0)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(step + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(step - 1)
    }
  }

  return (
    <section id="tor" className="fl-section fl-wrap" aria-labelledby="dw-tor-title">
      <SectionHead
        id="dw-tor-title"
        at="tor"
        label="Onion routing"
        title="How Tor hides you"
        rest="No relay knows both ends"
        lede="Tor doesn’t make you invisible. It splits the job of knowing about you across three strangers, so none of them knows enough on their own."
      />

      <div className="dw-win dw-lab" data-reveal>
        <div className="dw-win-bar">
          <Lights />
          <div className="dw-seg" role="group" aria-label="What you’re connecting to">
            {Object.entries(CIRCUITS).map(([id, c]) => (
              <button key={id} type="button" className="dw-chip" aria-pressed={mode === id} onClick={() => switchMode(id)}>
                {c.label}
              </button>
            ))}
          </div>
          <span className="dw-status" data-on={playing || undefined}>
            <i />
            {playing ? 'Playing' : 'Paused'}
          </span>
        </div>
        <div className="fl-rule" />

        <div ref={stageRef} className="dw-stage" data-mode={mode} style={{ '--n': nodes.length, '--at': current.at }} aria-hidden="true">
          <div className="dw-lane">
            {mode === 'web' ? (
              <span className="dw-packet" data-layers={current.layers}>
                <span className="dw-ring" data-ring="1" />
                <span className="dw-ring" data-ring="2" />
                <span className="dw-ring" data-ring="3" />
                <span className="dw-core" />
              </span>
            ) : (
              <span className="dw-beacon">
                <Icon name="key" className="h-4 w-4" />
              </span>
            )}
          </div>
          <div className="dw-track">
            {nodes.slice(1).map((node, i) => (
              <span key={node.id} className="dw-wire" style={{ '--i': i }} data-lit={lit(i) || undefined} />
            ))}
          </div>
          <ol className="dw-nodes">
            {nodes.map((node, i) => (
              <li key={node.id} className="dw-node" data-state={i === current.at ? 'active' : lit(i) || lit(i - 1) ? 'lit' : undefined}>
                <span className="dw-node-dot">{NODE_ICON[node.id] ? <Icon name={NODE_ICON[node.id]} className="dw-node-icon" /> : <i />}</span>
                <span className="dw-node-label">
                  <span className="dw-full">{node.label}</span>
                  <span className="dw-short">{node.short}</span>
                </span>
                <span className="dw-node-role">{node.role}</span>
              </li>
            ))}
          </ol>
        </div>

        <Band />

        <div className="dw-readout">
          <div aria-live={playing ? 'off' : 'polite'}>
            <p className="dw-step-count">
              Step {step + 1} <span aria-hidden="true">/</span>
              <span className="sr-only">of</span> {steps.length}
            </p>
            <h3 className="fl-h3 dw-step-title">
              <Cipher text={current.title} />
            </h3>
            <p className="fl-cell-text">{current.text}</p>
          </div>
          <div className="dw-sees">
            <FrameLabel>{current.sees ? seesLabel(nodes[current.at]) : 'Who knows where the server is'}</FrameLabel>
            <ul>
              {current.sees ? (
                SEES.map((s) => <SeesRow key={s.id} label={s.label} value={current.sees[s.id]} />)
              ) : (
                <>
                  <SeesRow label="You" value={false} />
                  <SeesRow label="Any relay" value={false} />
                  <SeesRow label="Only the server" value={true} />
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="fl-rule" />
        <div className="dw-controls" onKeyDown={onKey}>
          <button type="button" className="dw-round" onClick={() => go(step - 1)} aria-label="Previous step">
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="dw-pill dw-play"
            onClick={() => {
              setTouched(true)
              setPlaying((p) => !p)
            }}
          >
            <Icon name={playing ? 'pause' : 'play'} className="h-3.5 w-3.5" />
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="dw-round" onClick={() => go(step + 1)} aria-label="Next step">
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
          <ol className="dw-pips">
            {steps.map((s, i) => (
              <li key={i}>
                <button type="button" className="dw-pip" aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)} />
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="dw-callout" data-reveal>
        <Icon name="repeat" className="dw-callout-icon" />
        <p>
          Tor builds a fresh circuit every ten minutes or so, and gives every site you visit its own, so your tabs can’t be tied together
          by sharing relays.
        </p>
      </div>
    </section>
  )
}

function messageFor(result) {
  switch (result.status) {
    case 'valid':
      return 'Valid v3 address. The checksum matches the key.'
    case 'checksum':
      return 'The checksum doesn’t match the key: a typo, or a made-up address.'
    case 'v2':
      return 'That’s an old 16-character v2 address. Those stopped working in 2021.'
    case 'length':
      return `A v3 address is exactly 56 characters. This one has ${result.length}.`
    case 'charset':
      return 'Onion addresses only use the letters a–z and the digits 2–7.'
    case 'version':
      return `This one claims to be version ${result.version}, but only version 3 exists.`
    default:
      return 'Paste an address to take it apart.'
  }
}

function verdictTone(status) {
  if (status === 'valid') return 'info'
  if (status === 'empty') return undefined
  return 'critical'
}

function OnionInspector() {
  const [value, setValue] = useState(ONION_EXAMPLES[0].address)
  const [focus, setFocus] = useState(null)
  const [flip, setFlip] = useState(null)
  const result = checkOnion(value)
  const parts = ['valid', 'checksum', 'version'].includes(result.status) ? onionParts(result.address) : null
  const good = result.status === 'valid'
  const flipped = flip?.address === result.address ? flip.at : -1

  const makeTypo = () => {
    const next = typo(result.address)
    setFlip({ address: next, at: [...next].findIndex((c, i) => c !== result.address[i]) })
    setValue(next)
  }

  const hover = (kind) => ({
    onMouseEnter: () => setFocus(kind),
    onMouseLeave: () => setFocus(null),
    onFocus: () => setFocus(kind),
    onBlur: () => setFocus(null),
  })

  return (
    <section id="onion" className="fl-section fl-wrap" aria-labelledby="dw-onion-title">
      <div className="fl-try dw-try">
        <div>
          <SectionHead
            id="dw-onion-title"
            at="onion"
            label="Anatomy"
            title="What’s in a .onion address"
            rest="It’s a key, not a name"
            lede="Onion addresses look like keyboard mash because they are a cryptographic key. There’s no DNS and no registrar: the address itself proves which server you reached."
          />
          <ul className="dw-legend" data-reveal>
            {Object.entries(ONION_PARTS).map(([kind, part]) => (
              <li key={kind} data-kind={kind} tabIndex={0} {...hover(kind)}>
                <span className="dw-legend-swatch" aria-hidden="true" />
                <span>
                  <span className="dw-legend-label">{part.label}</span>
                  <span className="dw-legend-text">{part.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="fl-try-stage" data-reveal>
          <div className="dw-win dw-inspector">
            <div className="dw-win-bar">
              <Lights />
              <span className="dw-win-title">Onion inspector</span>
              <span className="dw-status" data-good={good || undefined}>
                <i />
                {good ? 'Checksum OK' : result.status === 'empty' ? 'Waiting' : 'Not valid'}
              </span>
            </div>
            <div className="fl-rule" />
            <div className="dw-win-body">
              <FrameLabel>Try one</FrameLabel>
              <div className="dw-examples">
                {ONION_EXAMPLES.map((ex) => (
                  <button key={ex.label} type="button" className="dw-chip" aria-pressed={result.address === ex.address} onClick={() => setValue(ex.address)}>
                    {ex.label}
                  </button>
                ))}
                <button type="button" className="dw-chip dw-chip-warn" disabled={!parts} onClick={makeTypo}>
                  <Icon name="zap" className="h-3 w-3" />
                  Make a typo
                </button>
              </div>

              <label className="dw-input-wrap">
                <span className="sr-only">Onion address to inspect</span>
                <input
                  className="dw-input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  placeholder="paste an address…"
                />
                <span className="dw-input-suffix" aria-hidden="true">
                  .onion
                </span>
              </label>

              <div className="dw-address" data-focus={focus ?? undefined} aria-hidden="true">
                {parts ? (
                  <Inspect size={`${result.address.length} characters`}>
                    {parts.map((part) => (
                      <span key={part.kind} className="dw-part" data-kind={part.kind}>
                        {part.kind === 'key' && flipped >= 0 ? (
                          <>
                            {part.text.slice(0, flipped)}
                            <mark className="dw-flip">{part.text[flipped]}</mark>
                            {part.text.slice(flipped + 1)}
                          </>
                        ) : (
                          part.text
                        )}
                      </span>
                    ))}
                    <span className="dw-part-tld">.onion</span>
                  </Inspect>
                ) : (
                  <span className="dw-part-empty">{result.address || '—'}</span>
                )}
              </div>

              <p className="dw-verdict" data-tone={verdictTone(result.status)} role="status">
                <i className="fl-dot" data-tone={verdictTone(result.status)} />
                <span>{messageFor(result)}</span>
              </p>
            </div>
            {result.checksum && (
              <>
                <Band />
                <dl className="dw-hexes">
                  <div>
                    <dt>Key</dt>
                    <dd>{result.key.slice(0, 16)}…</dd>
                  </div>
                  <div>
                    <dt>Checksum in address</dt>
                    <dd>{result.checksum}</dd>
                  </div>
                  <div>
                    <dt>Checksum of key</dt>
                    <dd data-match={good ? 'yes' : 'no'}>{result.expected}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="fl-grid fl-cells dw-pair" data-reveal>
        <Cell
          label="Vanity"
          title="The readable start was brute-forced"
          visual={
            <div className="dw-mini" aria-hidden="true">
              {ONION_EXAMPLES.filter((ex) => ex.vanity).map((ex) => (
                <span key={ex.label} className="dw-url dw-vanity">
                  <span>
                    <mark>{ex.vanity}</mark>
                    {ex.address.slice(ex.vanity.length)}.onion
                  </span>
                </span>
              ))}
            </div>
          }
        >
          See how the BBC’s, DuckDuckGo’s and Facebook’s addresses start with their names? They generated keys by the million until one happened to begin
          that way. The rest of it can’t be chosen.
        </Cell>
        <Cell
          label="Phishing"
          title="Valid doesn’t mean safe"
          visual={
            <div className="dw-mini" aria-hidden="true">
              <span className="dw-opens">
                <i className="fl-dot" data-tone="info" />
                Checksum
                <em>Passes</em>
              </span>
              <span className="dw-opens">
                <i className="fl-dot" data-tone="critical" />
                Whose key
                <em>Anyone’s</em>
              </span>
            </div>
          }
        >
          A valid checksum only proves nobody mistyped it. Phishing clones are perfectly valid addresses too. They’re just someone
          else’s key.
        </Cell>
      </div>
    </section>
  )
}

function Uses() {
  return (
    <section id="inside" className="fl-section fl-wrap" aria-labelledby="dw-inside-title">
      <SectionHead
        id="dw-inside-title"
        at="inside"
        label="What’s there"
        title="Both reputations are earned"
        rest="Same tool, both sides"
        lede="The same privacy that protects a reporter’s source protects a drug market. That’s the uncomfortable part, and there’s no version of Tor that only works for the good guys."
      />
      {Object.entries(USES).map(([tone, group]) => (
        <div key={tone} className="dw-uses" data-reveal>
          <p className="dw-uses-head">
            <i className="fl-dot" data-tone={tone === 'good' ? 'info' : 'critical'} />
            {group.title}
          </p>
          <div className="fl-grid fl-cells fl-four">
            {group.items.map((item, i) => (
              <article key={item.title} className="fl-cell">
                <FrameLabel>{String(i + 1).padStart(2, '0')}</FrameLabel>
                <h3 className="fl-h3">{item.title}</h3>
                <p className="fl-cell-text">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

const osOf = (ua) =>
  /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Something rare'

function browserOf(ua) {
  const found = [
    ['Edge', /Edg\/(\d+)/],
    ['Opera', /OPR\/(\d+)/],
    ['Firefox', /Firefox\/(\d+)/],
    ['Chrome', /Chrome\/(\d+)/],
    ['Safari', /Version\/(\d+).*Safari/],
  ].find(([, re]) => re.test(ua))
  return found ? `${found[0]} ${found[1].exec(ua)[1]}` : 'Something rare'
}

const clockIn = (timeZone) => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone })

function readFingerprint() {
  const nav = window.navigator
  const ua = nav.userAgent || ''
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
  const w = window.innerWidth
  const h = window.innerHeight
  const box = `${Math.max(200, Math.floor(w / 200) * 200)}×${Math.max(100, Math.floor(h / 100) * 100)}`
  return [
    { label: 'IP address', yours: 'Sent with every request', tor: 'A Tor exit relay’s' },
    { label: 'Time zone', yours: zone, tor: 'UTC' },
    { label: 'Local time', yours: clockIn(zone), tor: clockIn('UTC'), clock: true },
    { label: 'Languages', yours: (nav.languages?.length ? nav.languages : [nav.language]).join(', '), tor: 'en-US' },
    { label: 'Browser', yours: browserOf(ua), tor: 'Firefox ESR, like every Tor user' },
    { label: 'System', yours: osOf(ua), tor: 'Only the OS family' },
    { label: 'Window', yours: `${w}×${h}`, tor: `≈ ${box}, rounded` },
    { label: 'Screen', yours: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio || 1}x`, tor: 'Same as the window' },
    { label: 'CPU threads', yours: String(nav.hardwareConcurrency || 'Hidden'), tor: 'Same for everyone' },
    { label: 'Theme', yours: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'Dark mode' : 'Light mode', tor: 'Same for everyone' },
  ]
}

const PLACEHOLDER_ROWS = ['IP address', 'Time zone', 'Local time', 'Languages', 'Browser', 'System', 'Window', 'Screen', 'CPU threads', 'Theme']
const readPlaceholder = () => PLACEHOLDER_ROWS.map((label) => ({ label, yours: '…', tor: '…', clock: label === 'Local time' }))

function Fingerprint() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    const read = () => {
      try {
        setRows(readFingerprint())
      } catch {
        setRows([])
      }
    }
    read()
    const id = setInterval(read, 1000)
    window.addEventListener('resize', read)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', read)
    }
  }, [])

  return (
    <section id="fingerprint" className="fl-section fl-wrap" aria-labelledby="dw-fingerprint-title">
      <SectionHead
        id="dw-fingerprint-title"
        at="fingerprint"
        label="Fingerprint"
        title="What every site already knows"
        rest="This is yours, live"
        lede="Hiding your IP isn’t enough. Your browser describes itself to every site it opens, and the details together can be enough to pick you out of a crowd."
      />
      <div className="fl-grid dw-fp" data-reveal>
        <div className="dw-fp-head" aria-hidden="true">
          <span />
          <span>
            <i className="fl-dot" data-tone="live" />
            You, right now
          </span>
          <span>
            <OnionGlyph />
            You, in Tor Browser
          </span>
        </div>
        <dl className="dw-fp-rows">
          {(rows ?? readPlaceholder()).map((row) => (
            <div key={row.label} className="dw-fp-row">
              <dt>{row.label}</dt>
              <dd className="dw-fp-yours">
                <span className="dw-fp-tag">You</span>
                {row.clock ? row.yours : <Cipher text={row.yours} />}
              </dd>
              <dd className="dw-fp-tor">
                <span className="dw-fp-tag">Tor</span>
                {row.tor}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="dw-source" data-reveal>
        <Icon name="lock" className="h-3.5 w-3.5" />
        Read by your own browser, on this page. None of it is sent anywhere.
      </p>
      <div className="dw-callout" data-reveal>
        <Icon name="eye" className="dw-callout-icon" />
        <p>
          Tor Browser’s real trick isn’t hiding you, it’s making millions of people look exactly the same. That’s why the advice is never
          to install add-ons or resize things to taste: every tweak makes you a little more unique.
        </p>
      </div>
    </section>
  )
}

function History() {
  return (
    <section id="history" className="fl-section fl-wrap" aria-labelledby="dw-history-title">
      <div className="fl-faq">
        <div className="fl-faq-side">
          <SectionHead
            id="dw-history-title"
            at="history"
            label="Timeline"
            title="From a Navy lab"
            rest="To your laptop"
            lede="The strangest thing about the dark web’s history is who started it."
          />
          <p className="dw-key" data-reveal>
            <i className="fl-dot" data-tone="critical" />
            Takedowns
          </p>
        </div>
        <ol className="dw-timeline" data-reveal>
          {HISTORY.map((item) => (
            <li key={`${item.year}-${item.title}`}>
              <span className="dw-year">
                <i className="fl-dot" data-tone={item.takedown ? 'critical' : undefined} />
                {item.year}
              </span>
              <div>
                <h3 className="dw-event-title">
                  {item.title}
                  {item.takedown && <span className="sr-only"> (takedown)</span>}
                </h3>
                <p className="dw-event-text">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Myth({ myth, truth }) {
  const [opens, setOpens] = useState(0)

  return (
    <details
      className="fl-faq-item dw-myth"
      onToggle={(e) => {
        if (e.currentTarget.open) setOpens((n) => n + 1)
      }}
    >
      <summary>
        <span>
          <span className="dw-myth-tag">Myth</span>
          {myth}
        </span>
        <span className="fl-faq-icon" aria-hidden="true">
          <Icon name="plus" className="h-4 w-4" strokeWidth={2} />
        </span>
      </summary>
      <p>
        <span className="dw-myth-tag" data-truth="">
          Reality
        </span>
        <Cipher text={truth} play={opens} />
      </p>
    </details>
  )
}

function Myths() {
  return (
    <section id="myths" className="fl-section fl-wrap" aria-labelledby="dw-myths-title">
      <div className="fl-faq">
        <div className="fl-faq-side">
          <SectionHead id="dw-myths-title" at="myths" label="Myths" title="Things people get wrong" rest="Tap one to decrypt it" />
          <p className="fl-faq-mail" data-reveal>
            Heard another one? <a href={`mailto:${CONTACT_EMAIL}`}>Email me</a>
          </p>
        </div>
        <div className="fl-faq-list" data-reveal>
          {MYTHS.map((m) => (
            <Myth key={m.myth} myth={m.myth} truth={m.truth} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Safety() {
  return (
    <section id="safety" className="fl-section fl-wrap" aria-labelledby="dw-safety-title">
      <SectionHead
        id="dw-safety-title"
        at="safety"
        label="Safety"
        title="Looking around"
        rest="Without getting burned"
        lede="Opening Tor Browser is legal almost everywhere and won’t put a target on you. The risks are the ordinary internet’s, just sharper."
      />
      <ol className="fl-grid fl-cells" data-reveal>
        {SAFETY.map((tip, i) => (
          <Cell key={tip.title} as="li" label={`Rule ${i + 1}`} title={tip.title}>
            {tip.text}
          </Cell>
        ))}
      </ol>
    </section>
  )
}

function FinalCta({ theme }) {
  const host = useRef(null)
  return (
    <section id="dw-cta" className="fl-cta" aria-labelledby="dw-cta-title">
      <div className="fl-cta-card" ref={host} data-reveal>
        <div className="fl-sky" aria-hidden="true">
          <DitherSky hostRef={host} theme={theme} seed={SKY_SEED + 1} field={CTA_FIELD} />
          <div className="fl-sky-grid" />
          <div className="fl-cta-shade" />
        </div>
        <div className="fl-cta-copy">
          <h2 id="dw-cta-title" className="fl-h2">
            <span>
              Stay curious
              <Stop />
            </span>{' '}
            <span>
              Start at the source
              <Stop />
            </span>
          </h2>
          <p className="fl-cta-lede">Tor Browser is free, and the Tor Project is the only place you should download it from.</p>
          <div className="fl-actions">
            <a href={TOR_DOWNLOAD} target="_blank" rel="noopener noreferrer" className="fl-get">
              <OnionGlyph className="fl-get-apple" />
              <span className="fl-get-text">
                <span className="fl-get-kicker">Download from</span>
                <span className="fl-get-title">torproject.org</span>
              </span>
            </a>
          </div>
          <ul className="fl-promises">
            {PROMISES.map((item) => (
              <li key={item}>
                <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <HeroTrace hostRef={host} theme={theme} />
        <Notch className="fl-notch-icon">
          <span className="fl-notch-home">
            <OnionMark />
          </span>
        </Notch>
      </div>
    </section>
  )
}

const FOOT_COLUMNS = [
  { title: 'This page', links: SECTIONS.map((s) => ({ label: s.label, jump: s.id })) },
  {
    title: 'kostis.wtf',
    links: [
      { label: 'Home', to: HOME_PATH },
      { label: 'Blog', to: BLOG_PATH },
      { label: 'Security policy', to: SECURITY_PATH },
      { label: 'Terminal', to: TERMINAL_PATH },
    ],
  },
  { title: 'Sources', links: SOURCES.map((s) => ({ label: s.label, href: s.href, external: true })) },
]

function footLink(item) {
  if (item.jump) return jump(item.jump)
  if (item.to) return link(item.to)
  return { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
}

function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="fl-foot">
      <div className="fl-wrap">
        <div className="fl-rule" />
        <div className="fl-foot-top">
          <div className="fl-foot-brand">
            <a {...jump('top')} className="fl-foot-app">
              <span className="dw-foot-icon">
                <OnionGlyph />
              </span>
              <span>
                <span className="fl-foot-name">The dark web, explained</span>
                <span className="fl-foot-ver">
                  Updated <time dateTime={DARKWEB_UPDATED}>{formatDate(DARKWEB_UPDATED)}</time>
                </span>
              </span>
            </a>
            <p>An explainer on Tor, onion services and the deep web. Written in Athens by blxr.</p>
          </div>
          <div className="fl-foot-cols">
            {FOOT_COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p>{column.title}</p>
                <ul>
                  {column.links.map((item) => (
                    <li key={item.label}>
                      <a {...footLink(item)}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="fl-foot-bar">
          <p>© {year} Kostis · Athens, Greece</p>
          <p>Not affiliated with the Tor Project. Tor is a trademark of The Tor Project, Inc.</p>
        </div>
      </div>
      <p className="fl-foot-mark" aria-hidden="true">
        Dark web
      </p>
    </footer>
  )
}

const SLIDES = ['Intro', 'By the numbers', ...SECTIONS.map((s) => s.label), 'Get Tor Browser']
const SHOW_KEYS = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  PageDown: 'next',
  ArrowLeft: 'prev',
  ArrowUp: 'prev',
  PageUp: 'prev',
  Home: 'first',
  End: 'last',
  f: 'full',
  F: 'full',
  Escape: 'exit',
}
const LEAVE_MS = 220
const IDLE_MS = 2500

function fitOf(el) {
  const bleed = el.matches('.fl-hero, .fl-cta')
  const room = bleed ? 0 : 56
  const fit = Math.min(bleed ? 1 : 1.25, (window.innerHeight - room * 2) / el.offsetHeight, (window.innerWidth - room) / el.offsetWidth)
  return String(Math.round(fit * 1000) / 1000)
}

function Show({ rootRef, onExit }) {
  const [at, setAt] = useState(0)
  const [full, setFull] = useState(() => Boolean(document.fullscreenElement))
  const target = useRef(0)
  const shown = useRef(0)
  const leaving = useRef(false)
  const timers = useRef({})
  const exitRef = useRef(onExit)
  exitRef.current = onExit
  const last = SLIDES.length - 1

  const slides = useCallback(() => [...(rootRef.current?.querySelector(':scope > main')?.children ?? [])], [rootRef])

  const go = useCallback(
    (to) => {
      const next = Math.max(0, Math.min(last, to))
      if (next === target.current) return
      target.current = next
      if (still()) {
        setAt(next)
        return
      }
      if (timers.current.leave) return
      const el = slides()[shown.current]
      if (el) el.dataset.leaving = ''
      timers.current.leave = setTimeout(() => {
        timers.current.leave = 0
        if (el) delete el.dataset.leaving
        setAt(target.current)
      }, LEAVE_MS)
    },
    [last, slides],
  )

  const toggleFull = useCallback(() => {
    try {
      if (document.fullscreenElement) {
        leaving.current = true
        document.exitFullscreen?.()?.catch?.(() => {})
      } else {
        document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch?.(() => {})
      }
    } catch {
    }
  }, [])

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      leaving.current = true
      document.exitFullscreen?.()?.catch?.(() => {})
    }
    exitRef.current(shown.current)
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    const el = slides()[at]
    if (!root || !el) return undefined
    shown.current = at
    const items = root.dataset.reveal === 'on' ? [...el.querySelectorAll('[data-reveal]')] : []
    items.forEach((item, i) => {
      delete item.dataset.shown
      item.style.setProperty('--k', i)
    })
    el.dataset.current = ''
    const fit = () => el.style.setProperty('--fit', fitOf(el))
    fit()
    const sizes = new ResizeObserver(fit)
    sizes.observe(el)
    window.addEventListener('resize', fit)
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        for (const item of items) item.dataset.shown = ''
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      sizes.disconnect()
      window.removeEventListener('resize', fit)
      delete el.dataset.current
      el.style.removeProperty('--fit')
      for (const item of items) {
        item.dataset.shown = ''
        item.style.removeProperty('--k')
      }
    }
  }, [at, rootRef, slides])

  useEffect(() => {
    const root = rootRef.current
    const held = timers.current
    let from = null
    const poke = () => {
      delete root.dataset.idle
      clearTimeout(held.idle)
      held.idle = setTimeout(() => {
        root.dataset.idle = ''
      }, IDLE_MS)
    }
    const down = (event) => {
      poke()
      from = event.pointerType === 'mouse' || event.target.closest('input, textarea, .dw-controls') ? null : { x: event.clientX, y: event.clientY }
    }
    const up = (event) => {
      if (!from) return
      const dx = event.clientX - from.x
      const dy = event.clientY - from.y
      from = null
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(target.current + (dx < 0 ? 1 : -1))
    }
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const node = event.target
      if (node.closest?.('input, textarea, select, [contenteditable="true"], .dw-controls')) return
      const action = SHOW_KEYS[event.key] ?? (event.key === ' ' && !node.closest?.('a, button, summary') ? (event.shiftKey ? 'prev' : 'next') : null)
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      if (action === 'next') go(target.current + 1)
      else if (action === 'prev') go(target.current - 1)
      else if (action === 'first') go(0)
      else if (action === 'last') go(last)
      else if (action === 'full') toggleFull()
      else exit()
    }
    const onFull = () => {
      const now = Boolean(document.fullscreenElement)
      setFull(now)
      if (!now && !leaving.current) exitRef.current(shown.current)
      leaving.current = false
    }
    setFull(Boolean(document.fullscreenElement))
    let lock = null
    navigator.wakeLock
      ?.request?.('screen')
      .then((granted) => {
        lock = granted
      })
      .catch(() => {})
    poke()
    root.addEventListener('pointermove', poke)
    root.addEventListener('pointerdown', down)
    root.addEventListener('pointerup', up)
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('fullscreenchange', onFull)
    return () => {
      clearTimeout(held.idle)
      clearTimeout(held.leave)
      held.leave = 0
      delete root.dataset.idle
      for (const el of root.querySelectorAll(':scope > main > [data-leaving]')) delete el.dataset.leaving
      lock?.release?.().catch?.(() => {})
      root.removeEventListener('pointermove', poke)
      root.removeEventListener('pointerdown', down)
      root.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('fullscreenchange', onFull)
    }
  }, [rootRef, go, toggleFull, exit, last])

  return (
    <div className="dw-show-bar" role="toolbar" aria-label="Presentation">
      <button type="button" className="dw-round" onClick={() => go(target.current - 1)} disabled={at === 0} aria-label="Previous slide">
        <Icon name="chevronLeft" className="h-4 w-4" />
      </button>
      <ol className="dw-pips">
        {SLIDES.map((label, i) => (
          <li key={label}>
            <button type="button" className="dw-pip" aria-label={`Slide ${i + 1}: ${label}`} aria-current={i === at ? 'step' : undefined} onClick={() => go(i)} />
          </li>
        ))}
      </ol>
      <button type="button" className="dw-round" onClick={() => go(target.current + 1)} disabled={at === last} aria-label="Next slide">
        <Icon name="chevronRight" className="h-4 w-4" />
      </button>
      <p className="dw-show-count" aria-live="polite">
        <b>{pad(at + 1)}</b> / {pad(SLIDES.length)}
        <span>{SLIDES[at]}</span>
      </p>
      <button type="button" className="dw-round" onClick={toggleFull} aria-label={full ? 'Leave full screen' : 'Full screen'} aria-pressed={full}>
        <Icon name="maximize" className="h-4 w-4" />
      </button>
      <button type="button" className="dw-pill dw-show-exit" onClick={exit}>
        <Icon name="x" className="h-3.5 w-3.5" />
        Exit
      </button>
    </div>
  )
}

export default function DarkwebPage({ theme = 'dark', onToggleTheme }) {
  const root = useRef(null)
  const presentRef = useRef(null)
  const landing = useRef(null)
  const [presenting, setPresenting] = useState(false)
  useReveal(root)

  useLayoutEffect(() => {
    if (presenting || landing.current === null) return
    root.current?.querySelector(':scope > main')?.children[landing.current]?.scrollIntoView({ block: 'start', behavior: 'instant' })
    landing.current = null
    presentRef.current?.focus({ preventScroll: true })
  }, [presenting])

  const present = () => {
    try {
      document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch?.(() => {})
    } catch {
    }
    setPresenting(true)
  }

  const stopPresenting = useCallback((at) => {
    landing.current = at
    setPresenting(false)
  }, [])

  return (
    <div ref={root} className="fl dw" data-show={presenting || undefined}>
      <DepthRail />
      <main>
        <Hero theme={theme} onToggleTheme={onToggleTheme} onPresent={present} presentRef={presentRef} />
        <CountSection />
        <Layers />
        <Circuit />
        <OnionInspector />
        <Uses />
        <Fingerprint />
        <History />
        <Myths />
        <Safety />
        <FinalCta theme={theme} />
      </main>
      <Footer />
      {presenting && <Show rootRef={root} onExit={stopPresenting} />}
    </div>
  )
}
