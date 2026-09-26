# Hero map (removed)

A faint street map of central Athens, drawn on a canvas behind the homepage
hero. On a mouse, hovering lit up the neighbourhood, municipality or landmark
under the cursor and the caption in the hero's top-right corner changed from
"Athens, Greece" to its name. On touch, a tap did the same and a second tap
turned it off. The data came from OpenStreetMap.

It was never committed. It lived only in the working tree until it was taken
out on 2026-09-24. This note keeps all of it (how it worked, and every line of
source as it was on that day), so it can be put back.

## Pieces

| File | What it was |
| :-- | :-- |
| `web/fetch-streets.js` | One-off script (not part of the build) that pulled roads, coastline, municipal boundaries and neighbourhood nodes from Overpass and wrote `athens-streets.json` |
| `web/src/lib/athens-streets.json` | The generated data (330 KB raw, ~95 KB gzipped). Not copied here; re-run `fetch-streets.js` to get it back |
| `web/src/lib/street-map.js` | Canvas renderer: decode, intro animation, hover glow |
| `web/src/components/hero-map.jsx` | React wrapper: lazy loading, pointer handling, theme, caption |
| `web/src/index.css` | `.hero-map` / `.hero-map-caption` layout and masks |
| `web/src/app.jsx` | Import, `<HeroMap theme={theme} />`, `relative isolate` on the hero section |
| `web/tests/dist/dist.test.js` | Budget: the data chunk under 100 KB gzipped |
| `README.md` | `fetch-streets.js` under "One-off tools" |

## How it worked

### Data (`fetch-streets.js` → `athens-streets.json`)

- **Origin**: the Acropolis (37.9715, 23.7257). Every coordinate is metres from
  it, x east and y south, projected with a flat equirectangular approximation.
- **Area**: 6 km west, 11.7 km east, 10.5 km north, 4 km south (Peristeri to
  Agia Paraskevi, Marousi to Nea Smyrni). That's as far as the hero ever showed.
- **One Overpass query** with two mirrors to fall back on:
  - `highway` motorway to pedestrian (and `_link`s), plus `natural=coastline`.
    Motorway/trunk/primary/secondary count as "major".
  - `boundary=administrative` relations at `admin_level` 7 (municipalities) and
    8 (the old municipalities merged ones are made of).
  - `place=suburb|quarter|neighbourhood` nodes. A neighbourhood only counts if
    it has a `wikidata` tag.
- **Lines**: clipped to the bounds (carried one point past the edge),
  Douglas-Peucker simplified at 20 m, quantized to 20 m units, joined end to
  end, then ordered greedily so each starts near where the previous one ended.
  Each line is `[kind, dx0, dy0, dx1, dy1, …]`, where every point is a delta from
  the one before it, across lines too. Kinds: 0 minor, 1 major, 2 coast.
- **Places**: a 50 m grid, row by row from the north-west corner, run-length
  coded as `[placeIndex, count, …]` with -1 meaning none. Each cell's name came
  from these rules, first match wins:
  1. A hand-picked landmark within its radius: Acropolis 200 m, Lycabettus
     400 m, Philopappou Hill 300 m.
  2. Otherwise, the old municipality (level 8) the cell is in, falling back to
     the municipality (level 7).
  3. Inside the City of Athens itself, the nearest notable neighbourhood node.
- **Names**: `name:en` or `sorting_name` where it's Latin. Otherwise the Greek
  name is transliterated the way street signs do it (ELOT 743, e.g. Ερμού →
  Ermou). A few names were overridden in `SAID` (Zografos → Zografou, Akropoli →
  Makrygianni, …).
- **Snapshot at removal**: data as of 2026-09-24T15:08:02Z. 16,439 lines, 45,459
  points, 115 places, grid 355 columns at x = -6000, y = -10500.

### Rendering (`street-map.js`)

- 28 px/km, with device pixel ratio capped at 2. The Acropolis sits at the
  `anchor()` fraction of the box.
- Streets are bucketed into one `Path2D` per kind per 0.5 km ring out from the
  Acropolis. The intro (1.8 s, ease-out) brings rings in from the centre, with
  3 rings fading at a time. Rings that are done get baked into an offscreen
  canvas, so each frame is one `drawImage` plus whatever is still arriving.
  Rings past the farthest visible corner (plus 4 for long streets reaching in)
  are never drawn.
- Stroke styles: minor 0.75 px at 1× alpha, major 1.25 px at 1.8×, coast
  1.25 px at 2.4×.
- Hover: a second set of paths (per place, per kind) is built lazily on the
  first hover. The lit place is re-stroked on top at 2.6× strength, fading in
  and out over 180 ms. One rAF loop drives both the intro and the fades, and it
  stops when idle.
- API: `createStreetMap(container, { streets, color, opacity, animate, anchor,
  onReadout })` → `{ resize, setPointer, tap, clearPointer, setColor, dispose }`.

### Component (`hero-map.jsx`)

- Skipped entirely when `navigator.connection.saveData` is set.
- The dynamic imports of `street-map.js` and the JSON start on mount. Building
  and drawing wait for `requestIdleCallback` (1.5 s timeout, `setTimeout` 200 ms
  fallback). Vite emitted the JSON as its own lazy chunk,
  `assets/athens-streets-*.js`.
- Colour came from `--color-ink-strong`, at opacity 0.13 in dark theme and 0.17
  in light. It was re-applied a frame after a theme change, because the theme
  attribute lands on `<html>` in the parent's effect.
- Reduced motion (the site's `data-motion="reduced"` or the media query) turned
  off the intro and the fades.
- Pointer events were listened for on the hero `<section>`, since the map
  itself is `pointer-events: none`. Mouse moves were rAF-throttled. Taps from
  touch and pen used `pointerup`, and a tap that turns into a scroll never fires
  one.
- `LAYOUT` mirrors the CSS masks. `x`/`y` place the Acropolis. `liveX`/`liveY`
  mark where the mask has faded the map out, and the pointer read nothing past
  them.
  - wide (≥1024px): Acropolis at 66% / 76%, live right of 55% and below 12%.
  - narrow: Acropolis at 62% / 45%, live right of 30% and below 15%.

### Layout (CSS)

- Narrow: an 18rem × 10.5rem box (at most 70% wide) in the top-right corner of
  the hero, beside the avatar and title. It's masked to fade in from the left,
  and in then out again top to bottom.
- Wide (≥1024px): fills the whole hero (`inset: 0`), masked to the right half
  (fading 50% → 78%) and below the top (8% → 40%).
- `z-index: -1` inside the section's `isolate` stacking context, so it sits
  under the text but above the page background.
- The caption was mono, 10.5px, `--color-ink-subtle`, with a text-shadow halo
  in `--color-bg` to lift it off the streets. It showed a boxicons location pin.

## Bringing it back

1. Recreate the files below at their paths.
2. `cd web && node fetch-streets.js` to regenerate `src/lib/athens-streets.json`.
   The data will be newer, so check the gzipped chunk is still under the 100 KB
   budget.
3. Re-add the CSS block, the `app.jsx` changes, the dist test and the README
   section.
4. OpenStreetMap's ODbL wants visible attribution wherever the map is shown.
   The attribution was in the data and the README but not on the page, so add
   it there if the map comes back.

## Source, as it was

### `web/src/components/hero-map.jsx`

```jsx
import { useEffect, useRef, useState } from 'react'

const OPACITY = { dark: 0.13, light: 0.17 }

// Mirrors .hero-map in index.css: wide screens get the map across the right of
// the hero, narrower ones a corner of it beside the avatar and title. `x` and `y`
// put the Acropolis in the box; left of `liveX` or above `liveY` the mask has
// faded the map out, so the pointer reads nothing there.
const WIDE = '(min-width: 1024px)'
const LAYOUT = {
  wide: { x: 0.66, y: 0.76, liveX: 0.55, liveY: 0.12 },
  narrow: { x: 0.62, y: 0.45, liveX: 0.3, liveY: 0.15 },
}

const prefersReducedMotion = () =>
  document.documentElement.dataset.motion === 'reduced' ||
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

const inkColor = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--color-ink-strong').trim() || '#ffffff'

// boxicons:location
const LocationIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 10c0-2.21-1.79-4-4-4s-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4m-6 0c0-1.1.9-2 2-2s2 .9 2 2s-.9 2-2 2s-2-.9-2-2" />
    <path d="M11.42 21.81c.17.12.38.19.58.19s.41-.06.58-.19c.3-.22 7.45-5.37 7.42-11.82c0-4.41-3.59-8-8-8s-8 3.59-8 8c-.03 6.44 7.12 11.6 7.42 11.82M12 4c3.31 0 6 2.69 6 6c.02 4.44-4.39 8.43-6 9.74c-1.61-1.31-6.02-5.29-6-9.74c0-3.31 2.69-6 6-6" />
  </svg>
)

// The streets of central Athens behind the hero, from OpenStreetMap.
// The drawing code and the street data start loading on mount; the map is
// built and drawn once the page is idle.
export default function HeroMap({ theme }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const [ready, setReady] = useState(false)
  const [readout, setReadout] = useState(null)

  useEffect(() => {
    const host = hostRef.current
    const wide = window.matchMedia?.(WIDE)
    // It is scenery, so it stays home when the visitor is saving data.
    if (!host || !wide || navigator.connection?.saveData) return
    const layout = () => (wide.matches ? LAYOUT.wide : LAYOUT.narrow)

    let cancelled = false
    let cleanup = () => {}

    // The download starts now; building and drawing wait for an idle moment.
    const loading = Promise.all([import('../lib/street-map'), import('../lib/athens-streets.json')])
    loading.catch(() => {})

    const mount = async () => {
      const [{ createStreetMap }, { default: streets }] = await loading
      if (cancelled) return

      const map = createStreetMap(host, {
        streets,
        color: inkColor(),
        opacity: OPACITY[themeRef.current] ?? OPACITY.dark,
        animate: !prefersReducedMotion(),
        anchor: layout,
        onReadout: setReadout,
      })
      mapRef.current = map
      setReady(true)

      const ro = new ResizeObserver(() => map.resize())
      ro.observe(host)

      // The pointer's spot on the map, or null where the map is faded out or not there.
      const spot = (event) => {
        const rect = host.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        const { liveX, liveY } = layout()
        return x >= rect.width * liveX && y >= rect.height * liveY && x < rect.width && y < rect.height ? [x, y] : null
      }

      // A mouse explores by hovering; a finger taps. A tap that turns into a
      // scroll is cancelled by the browser and never gets here.
      const section = host.parentElement
      let queued = null
      let frame = 0
      const onMove = (event) => {
        if (event.pointerType !== 'mouse') return
        queued = event
        if (frame) return
        frame = requestAnimationFrame(() => {
          frame = 0
          const at = spot(queued)
          if (at) map.setPointer(...at)
          else map.clearPointer()
        })
      }
      const onLeave = (event) => {
        if (event.pointerType !== 'mouse') return
        cancelAnimationFrame(frame)
        frame = 0
        map.clearPointer()
      }
      const onTap = (event) => {
        if (event.pointerType === 'mouse') return
        const at = spot(event)
        if (at) map.tap(...at)
        else map.clearPointer()
      }
      section.addEventListener('pointermove', onMove, { passive: true })
      section.addEventListener('pointerleave', onLeave)
      section.addEventListener('pointerup', onTap)

      cleanup = () => {
        ro.disconnect()
        cancelAnimationFrame(frame)
        section.removeEventListener('pointermove', onMove)
        section.removeEventListener('pointerleave', onLeave)
        section.removeEventListener('pointerup', onTap)
        map.dispose()
        mapRef.current = null
      }
    }

    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200))
    const cancelIdle = window.cancelIdleCallback ?? clearTimeout
    const handle = idle(() => { mount().catch(() => {}) }, { timeout: 1500 })

    return () => {
      cancelled = true
      cancelIdle(handle)
      cleanup()
    }
  }, [])

  useEffect(() => {
    // The theme lands on <html> in the parent's effect, after this one runs.
    const id = requestAnimationFrame(() => mapRef.current?.setColor(inkColor(), OPACITY[theme] ?? OPACITY.dark))
    return () => cancelAnimationFrame(id)
  }, [theme])

  return (
    <>
      <div ref={hostRef} aria-hidden="true" className="hero-map" />
      {ready && (
        <p aria-hidden="true" className="hero-map-caption">
          <LocationIcon />
          {readout ?? 'Athens, Greece'}
        </p>
      )}
    </>
  )
}
```

### `web/src/lib/street-map.js`

```js
// The streets of Athens on a 2D canvas, from OpenStreetMap (athens-streets.json,
// see fetch-streets.js). Coordinates are km from the Acropolis, x east and y south.

const PX_PER_KM = 28
const INTRO_MS = 1800
const RING_KM = 0.5 // the intro spreads out from the Acropolis ring by ring
const EDGE_RINGS = 3 // rings fading in at any moment
const FADE_MS = 180 // a place lighting up under the cursor, or going back
const GLOW = 2.6 // how much brighter a lit place is
const SPILL_RINGS = 4 // long streets reach in from rings past the canvas corners

// minor streets, major roads, coastline
const STYLE = [
  { width: 0.75, alpha: 1 },
  { width: 1.25, alpha: 1.8 },
  { width: 1.25, alpha: 2.4 },
]

// Every point is stored relative to the one before it, across lines too.
function decodeLines({ unitM, lines }) {
  const km = unitM / 1000
  let x = 0
  let y = 0
  return lines.map(([kind, ...deltas]) => {
    const pts = new Float32Array(deltas.length)
    for (let i = 0; i < deltas.length; i += 2) {
      x += deltas[i]
      y += deltas[i + 1]
      pts[i] = x * km
      pts[i + 1] = y * km
    }
    return { kind, pts }
  })
}

// The grid of places, one index into `names` per cell (-1 for none).
function decodePlaces({ cellM, x, y, cols, names, runs }) {
  let total = 0
  for (let i = 1; i < runs.length; i += 2) total += runs[i]
  const cells = new Int16Array(total)
  for (let i = 0, at = 0; i < runs.length; at += runs[i + 1], i += 2) cells.fill(runs[i], at, at + runs[i + 1])
  return { cellKm: cellM / 1000, x: x / 1000, y: y / 1000, cols, rows: total / cols, names, cells }
}

/**
 * Draws the map into a canvas inside `container`, with the Acropolis where
 * `anchor()` says, as fractions of its width and height. While the cursor is
 * over the map, or after a tap on it, the place under it (a neighbourhood,
 * suburb or landmark) lights up and `onReadout` gets its name; it gets null
 * once the cursor leaves.
 */
export function createStreetMap(container, { streets: data, color, opacity, animate, anchor, onReadout }) {
  const lines = decodeLines(data)
  const places = decodePlaces(data.places)

  const placeAt = (kx, ky) => {
    const col = Math.floor((kx - places.x) / places.cellKm)
    const row = Math.floor((ky - places.y) / places.cellKm)
    if (col < 0 || row < 0 || col >= places.cols || row >= places.rows) return -1
    return places.cells[row * places.cols + col]
  }

  // One path per kind per ring, so the intro can bring the city in from the
  // Acropolis outward without re-tracing anything.
  const paths = [[], [], []]
  let rings = 0
  for (const { kind, pts } of lines) {
    let open = -1
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ring = Math.floor(Math.hypot((pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2) / RING_KM)
      const path = (paths[kind][ring] ??= new Path2D())
      if (ring !== open) path.moveTo(pts[i], pts[i + 1])
      path.lineTo(pts[i + 2], pts[i + 3])
      open = ring
      rings = Math.max(rings, ring + 1)
    }
  }

  // The same streets again, one path per kind per place, built on first hover.
  let placePaths = null
  const buildPlacePaths = () => {
    placePaths = []
    for (const { kind, pts } of lines) {
      let open = -1
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const place = placeAt((pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2)
        if (place >= 0) {
          const path = ((placePaths[place] ??= [])[kind] ??= new Path2D())
          if (place !== open) path.moveTo(pts[i], pts[i + 1])
          path.lineTo(pts[i + 2], pts[i + 3])
        }
        open = place
      }
    }
  }

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  // Rings that have finished fading in live here, so a frame is one copy
  // plus whatever is still arriving.
  const base = document.createElement('canvas')
  const baseCtx = base.getContext('2d')

  const view = { dpr: 1, x: 0, y: 0, reach: 0, far: 0 }
  let ink = color
  let alpha = opacity
  let intro = animate ? 0 : 1
  let baked = 0
  let hover = -1
  let lit = [] // places lit up or fading back: { place, level }

  const prepare = (target) => {
    target.setTransform(1, 0, 0, 1, 0, 0)
    target.clearRect(0, 0, target.canvas.width, target.canvas.height)
    target.setTransform(PX_PER_KM * view.dpr, 0, 0, PX_PER_KM * view.dpr, view.x * view.dpr, view.y * view.dpr)
    target.strokeStyle = ink
    target.lineJoin = 'round'
  }

  const stroke = (target, kindPaths, strength) => {
    for (let kind = 0; kind < kindPaths.length; kind++) {
      const path = kindPaths[kind]
      if (!path) continue
      target.globalAlpha = Math.min(1, alpha * STYLE[kind].alpha * strength)
      target.lineWidth = STYLE[kind].width / PX_PER_KM
      target.stroke(path)
    }
  }
  const ring = (n) => paths.map((kindPaths) => kindPaths[n])

  const rebake = () => {
    prepare(baseCtx)
    for (let n = 0; n < baked; n++) stroke(baseCtx, ring(n), 1)
  }

  const draw = () => {
    // The intro paces itself to what is on screen; the rest lands at the end.
    const front = intro < 1 ? intro * (Math.min(view.reach, view.far) + EDGE_RINGS) : view.far + EDGE_RINGS
    while (baked < view.far && front - baked >= EDGE_RINGS) stroke(baseCtx, ring(baked++), 1)

    prepare(ctx)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.drawImage(base, 0, 0)
    ctx.setTransform(PX_PER_KM * view.dpr, 0, 0, PX_PER_KM * view.dpr, view.x * view.dpr, view.y * view.dpr)
    for (let n = baked; n < view.far && front > n; n++) stroke(ctx, ring(n), (front - n) / EDGE_RINGS)

    if (intro < 1) return
    for (const { place, level } of lit) stroke(ctx, placePaths[place] ?? [], GLOW * level)
  }

  const layout = () => {
    const { clientWidth: w, clientHeight: h } = container
    if (!w || !h) return false
    view.dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = base.width = Math.round(w * view.dpr)
    canvas.height = base.height = Math.round(h * view.dpr)
    const at = anchor()
    view.x = w * at.x
    view.y = h * at.y
    // Rings out to the farthest corner on the visible, right-hand side, and
    // out to the farthest corner at all: rings past that are never drawn.
    const rungs = (dx, dy) => Math.ceil(Math.hypot(dx, dy) / PX_PER_KM / RING_KM)
    view.reach = rungs(w - view.x, Math.max(view.y, h - view.y))
    view.far = Math.min(rings, rungs(Math.max(view.x, w - view.x), Math.max(view.y, h - view.y)) + SPILL_RINGS)
    rebake()
    return true
  }

  // One animation loop for the intro and for places fading in and out.
  let frame = 0
  let introStart = 0
  let last = 0
  const tick = (now) => {
    frame = 0
    const step = (last ? now - last : 16) / FADE_MS
    last = now
    if (intro < 1) {
      const t = Math.min((now - introStart) / INTRO_MS, 1)
      intro = 1 - (1 - t) * (1 - t)
    }
    let busy = intro < 1
    lit = lit.filter((entry) => {
      const target = entry.place === hover ? 1 : 0
      entry.level = target ? Math.min(1, entry.level + step) : Math.max(0, entry.level - step)
      if (entry.level !== target) busy = true
      return entry.level > 0 || target > 0
    })
    draw()
    if (busy) frame = requestAnimationFrame(tick)
    else last = 0
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(tick) }

  const setHover = (place) => {
    if (place === hover) return
    hover = place
    if (place >= 0 && !placePaths) buildPlacePaths()
    if (!animate) {
      lit = place >= 0 ? [{ place, level: 1 }] : []
      draw()
      return
    }
    if (place >= 0 && !lit.some((entry) => entry.place === place)) lit.push({ place, level: 0 })
    schedule()
  }

  if (layout()) {
    if (animate) {
      introStart = performance.now()
      schedule()
    } else {
      draw()
    }
  }

  let readout = null
  const show = (place) => {
    setHover(place)
    const name = place >= 0 ? places.names[place] : null
    if (name === readout) return
    readout = name
    onReadout?.(name)
  }
  const pointAt = (px, py) => placeAt((px - view.x) / PX_PER_KM, (py - view.y) / PX_PER_KM)

  return {
    resize: () => { if (layout()) draw() },
    setPointer: (px, py) => show(pointAt(px, py)),
    // Touch has no hover: a tap lights a place up, and a second tap puts it out.
    tap: (px, py) => {
      const place = pointAt(px, py)
      show(place === hover ? -1 : place)
    },
    clearPointer: () => show(-1),
    setColor: (nextColor, nextOpacity) => {
      ink = nextColor
      alpha = nextOpacity
      rebake()
      draw()
    },
    dispose: () => {
      cancelAnimationFrame(frame)
      canvas.remove()
    },
  }
}
```

### `web/fetch-streets.js`

```js
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Pulls the street network of Athens and the places it is made of from
// OpenStreetMap (Overpass API, no key) into src/lib/athens-streets.json, which
// the hero map draws. Positions are metres from the Acropolis, x east and y
// south, in UNIT_M steps.

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, 'src/lib/athens-streets.json')

const ORIGIN = { lat: 37.9715, lon: 23.7257 } // the Acropolis
// How far the data reaches from the Acropolis: out to Marousi in the north,
// Agia Paraskevi in the east, Peristeri in the west and Nea Smyrni in the
// south, which is as far as the hero shows (street-map.js places the view).
const REACH_KM = { west: 6, east: 11.7, north: 10.5, south: 4 }
// At the hero's 28 px/km a pixel is ~36 m, so 20 m steps and a 20 m
// simplification stay under a pixel and keep the file a third smaller.
const UNIT_M = 20
const SIMPLIFY_M = 20
const CELL_M = 50 // the places are stored as a grid of cells this size

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const ROADS = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian'
const MAJOR = /^(motorway|trunk|primary|secondary)/
const KIND = { minor: 0, major: 1, coast: 2 }

// Places are municipalities (Marousi, Chalandri), or the old municipalities a
// merged one is made of (Psychiko, Cholargos). The city of Athens itself is
// too big for one name, so inside it the nearest neighbourhood wins: suburbs
// and quarters, plus neighbourhoods notable enough for a Wikidata entry
// (Koukaki and Psyrri make it, a single hillside does not).
const CITY = 'Athens'
const NEIGHBOURHOODS = 'suburb|quarter|neighbourhood'
const notable = (tags) => tags.place !== 'neighbourhood' || Boolean(tags.wikidata)
// The hills everyone knows. Within its radius a landmark wins over the place around it.
const LANDMARKS = [
  { name: 'Acropolis', lat: 37.9715, lon: 23.7263, radiusM: 200 },
  { name: 'Lycabettus', lat: 37.9819, lon: 23.7432, radiusM: 400 },
  { name: 'Philopappou Hill', lat: 37.9675, lon: 23.7222, radiusM: 300 },
]
// Names as people say them, where OpenStreetMap's English differs.
const SAID = {
  Zografos: 'Zografou',
  Akropoli: 'Makrygianni', // the streets below the rock, not the rock
  'Plateia Vathis': 'Vathis Square',
  'Stathmos Larisis': 'Larissa Station',
}

// Greek to Latin the way the street signs do it (ELOT 743), so "Ερμού" reads "Ermou".
const LETTERS = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm',
  ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
}
const PAIRS = { ου: 'ou', γγ: 'ng', γκ: 'gk', γξ: 'nx', γχ: 'nch', μπ: 'mp', ντ: 'nt' }
const VOICELESS = new Set('θκξπστφχψ')

function latin(greek) {
  // Accents go; a diaeresis stays long enough to stop two vowels pairing up.
  // Numeral marks (Grigoriou E΄) go too, and a micro sign typed for μ is read as μ.
  const clean = greek.replace(/µ/g, 'μ').replace(/[ʹ΄᾽᾿ʹ’']/g, '')
  const chars = []
  for (const ch of clean.normalize('NFD')) {
    if (ch === '̈') { if (chars.length) chars[chars.length - 1].split = true; continue }
    if (/\p{M}/u.test(ch)) continue
    chars.push({ ch, lower: ch.toLowerCase(), split: false })
  }
  const isLetter = (c) => Boolean(c && LETTERS[c.lower])

  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const { ch, lower } = chars[i]
    const next = chars[i + 1]
    if (!LETTERS[lower]) { out += ch; continue }

    let text = LETTERS[lower]
    const pair = next && !next.split ? lower + next.lower : ''
    if (PAIRS[pair]) {
      const wordStart = !isLetter(chars[i - 1])
      text = wordStart && pair === 'μπ' ? 'b' : wordStart && pair === 'ντ' ? 'd' : PAIRS[pair]
      i++
    } else if (pair && 'αεη'.includes(lower) && next.lower === 'υ') {
      const after = chars[i + 2]
      text += !isLetter(after) || VOICELESS.has(after.lower) ? 'f' : 'v'
      i++
    }
    if (ch !== lower) {
      const shouting = next && next.ch !== next.lower
      text = shouting ? text.toUpperCase() : text[0].toUpperCase() + text.slice(1)
    }
    out += text
  }
  return out
}

const M_PER_DEG_LAT = 110570
const M_PER_DEG_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180)
const BOUNDS = {
  south: ORIGIN.lat - (REACH_KM.south * 1000) / M_PER_DEG_LAT,
  north: ORIGIN.lat + (REACH_KM.north * 1000) / M_PER_DEG_LAT,
  west: ORIGIN.lon - (REACH_KM.west * 1000) / M_PER_DEG_LON,
  east: ORIGIN.lon + (REACH_KM.east * 1000) / M_PER_DEG_LON,
}
const project = ({ lat, lon }) => [(lon - ORIGIN.lon) * M_PER_DEG_LON, (ORIGIN.lat - lat) * M_PER_DEG_LAT]
const inside = ({ lat, lon }) =>
  lat >= BOUNDS.south && lat <= BOUNDS.north && lon >= BOUNDS.west && lon <= BOUNDS.east

// The runs of a way inside BOUNDS, each carried one point past the edge.
function clip(geometry) {
  const runs = []
  let run = []
  for (let i = 0; i < geometry.length; i++) {
    const keep = inside(geometry[i]) || (i > 0 && inside(geometry[i - 1])) ||
      (i < geometry.length - 1 && inside(geometry[i + 1]))
    if (keep) run.push(project(geometry[i]))
    else if (run.length) { runs.push(run); run = [] }
  }
  if (run.length) runs.push(run)
  return runs.filter((r) => r.length > 1)
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

// Douglas-Peucker.
function simplify(points) {
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let far = 0
    let index = -1
    for (let i = a + 1; i < b; i++) {
      const d = distanceToSegment(points[i], points[a], points[b])
      if (d > far) { far = d; index = i }
    }
    if (far > SIMPLIFY_M) { keep[index] = 1; stack.push([a, index], [index, b]) }
  }
  return points.filter((_, i) => keep[i])
}

function quantize(points) {
  const out = []
  for (const [x, y] of points) {
    const p = [Math.round(x / UNIT_M), Math.round(y / UNIT_M)]
    const last = out[out.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p)
  }
  return out
}

// Joins lines that meet end to end, so a run of streets stores one start point.
function join(lines) {
  const key = (p) => `${p[0]},${p[1]}`
  const used = new Uint8Array(lines.length)
  const byEnd = new Map()
  const add = (k, i) => (byEnd.get(k) ?? byEnd.set(k, []).get(k)).push(i)
  lines.forEach((l, i) => { add(key(l[0]), i); add(key(l[l.length - 1]), i) })
  const take = (k) => {
    const list = byEnd.get(k) ?? []
    while (list.length) {
      const i = list.pop()
      if (!used[i]) { used[i] = 1; return lines[i] }
    }
    return null
  }

  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue
    used[i] = 1
    let line = lines[i]
    for (let next; (next = take(key(line[line.length - 1])));) {
      if (key(next[0]) !== key(line[line.length - 1])) next = next.slice().reverse()
      line = line.concat(next.slice(1))
    }
    for (let prev; (prev = take(key(line[0])));) {
      if (key(prev[prev.length - 1]) !== key(line[0])) prev = prev.slice().reverse()
      line = prev.concat(line.slice(1))
    }
    out.push(line)
  }
  return out
}

// Orders lines so each starts close to where the one before it ended. Stored
// relative to that end, a start point then takes a digit or two, not five.
function tour(lines) {
  const CELL = 20
  const cells = new Map()
  const key = (cx, cy) => `${cx},${cy}`
  lines.forEach((line, i) => {
    const k = key(Math.floor(line[0][0] / CELL), Math.floor(line[0][1] / CELL))
    ;(cells.get(k) ?? cells.set(k, []).get(k)).push(i)
  })
  const used = new Uint8Array(lines.length)
  const out = []
  let [x, y] = [0, 0]
  while (out.length < lines.length) {
    const cx = Math.floor(x / CELL)
    const cy = Math.floor(y / CELL)
    let best = -1
    let bestDistance = Infinity
    // Rings of cells outward, until no closer start can be left.
    for (let r = 0; best < 0 || (r - 1) * CELL <= bestDistance; r++) {
      for (let i = -r; i <= r; i++) {
        for (const [u, v] of [[i, -r], [i, r], [-r, i], [r, i]]) {
          for (const j of cells.get(key(cx + u, cy + v)) ?? []) {
            if (used[j]) continue
            const d = Math.hypot(lines[j][0][0] - x, lines[j][0][1] - y)
            if (d < bestDistance) { bestDistance = d; best = j }
          }
        }
      }
    }
    used[best] = 1
    out.push(lines[best])
    ;[x, y] = lines[best][lines[best].length - 1]
  }
  return out
}

// Even-odd over every ring, so holes stay holes.
function contains(rings, x, y) {
  let hit = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
    }
  }
  return hit
}

async function overpass(query) {
  for (const url of MIRRORS) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'blxr-portfolio fetch-streets.js' },
      body: new URLSearchParams({ data: query }),
    })
    if (res.ok) return res.json()
    console.warn(`  ${url} -> HTTP ${res.status}, trying the next mirror`)
  }
  throw new Error('every Overpass mirror refused the query')
}

const bbox = [BOUNDS.south, BOUNDS.west, BOUNDS.north, BOUNDS.east].map((d) => d.toFixed(5)).join(',')
const osm = await overpass(
  `[out:json][timeout:600];` +
  `(way[highway~"^(${ROADS})(_link)?$"](${bbox});way[natural=coastline](${bbox}););out tags geom qt;` +
  `rel[boundary=administrative][admin_level~"^(7|8)$"](${bbox});out geom qt;` +
  `node[place~"^(${NEIGHBOURHOODS})$"][name](${bbox});out qt;`,
)

// English names where OpenStreetMap has them (Pangrati, not Pagkrati), the
// street-sign spelling otherwise.
const said = (name) => SAID[name] ?? name
const inLatin = (name) => (name && !/\p{Script=Greek}/u.test(name) ? name : undefined)
const regions = osm.elements
  .filter((e) => e.type === 'relation')
  .map((rel) => {
    const english = inLatin(rel.tags.sorting_name) ??
      rel.tags['name:en']?.replace(/^Municipal(ity| Unit) of | Municipal Unit$/g, '')
    // Unsimplified, so neighbours share their borders exactly and no street
    // falls in a gap between them.
    const rings = join(rel.members
      .filter((m) => m.type === 'way' && m.geometry && m.role !== 'subarea')
      .map((m) => m.geometry.map(project)))
    const xs = rings.flat().map((p) => p[0])
    const ys = rings.flat().map((p) => p[1])
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    return { name: said(english ?? latin(rel.tags.name)), level: Number(rel.tags.admin_level), rings, box }
  })
  // Old municipalities first, so they win over the merged one around them.
  .sort((a, b) => b.level - a.level)
const city = regions.find((r) => r.level === 7 && r.name === CITY)
if (!city) throw new Error(`no municipality called ${CITY} in the data`)

const within = (region, x, y) =>
  x >= region.box[0] && y >= region.box[1] && x <= region.box[2] && y <= region.box[3] && contains(region.rings, x, y)
const neighbourhoods = osm.elements
  .filter((e) => e.type === 'node' && notable(e.tags))
  .map((node) => ({ name: said(node.tags['name:en'] ?? latin(node.tags.name)), at: project(node) }))
  .filter(({ at }) => within(city, ...at))
const landmarks = LANDMARKS.map((l) => ({ ...l, at: project(l) }))

function placeAt(x, y) {
  for (const l of landmarks) if (Math.hypot(l.at[0] - x, l.at[1] - y) <= l.radiusM) return l.name
  const region = regions.find((r) => within(r, x, y))
  if (region !== city) return region?.name ?? null
  let best = null
  let bestDistance = Infinity
  for (const n of neighbourhoods) {
    const d = Math.hypot(n.at[0] - x, n.at[1] - y)
    if (d < bestDistance) { bestDistance = d; best = n.name }
  }
  return best
}

// The places as a grid of CELL_M cells, row by row from the north-west corner,
// run-length coded as [place, count, place, count, ...] with -1 for none.
const [west, north] = project({ lat: BOUNDS.north, lon: BOUNDS.west })
const [east, south] = project({ lat: BOUNDS.south, lon: BOUNDS.east })
const cols = Math.ceil((east - west) / CELL_M)
const rows = Math.ceil((south - north) / CELL_M)
const names = []
const runs = []
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const name = placeAt(west + (col + 0.5) * CELL_M, north + (row + 0.5) * CELL_M)
    let place = name === null ? -1 : names.indexOf(name)
    if (name !== null && place < 0) place = names.push(name) - 1
    if (runs[runs.length - 2] === place) runs[runs.length - 1]++
    else runs.push(place, 1)
  }
}

const pieces = [[], [], []]
for (const way of osm.elements) {
  if (way.type !== 'way') continue
  const kind = way.tags.natural === 'coastline' ? KIND.coast : MAJOR.test(way.tags.highway) ? KIND.major : KIND.minor
  for (const run of clip(way.geometry)) {
    const line = quantize(simplify(run))
    if (line.length > 1) pieces[kind].push(line)
  }
}

// Each line is [kind, dx0, dy0, dx1, dy1, ...]: every point relative to the
// one before it, the first relative to where the previous line ended.
const lines = []
let pen = [0, 0]
pieces.forEach((group, kind) => {
  for (const line of tour(join(group))) {
    const flat = [kind]
    for (const point of line) {
      flat.push(point[0] - pen[0], point[1] - pen[1])
      pen = point
    }
    lines.push(flat)
  }
})

const json = JSON.stringify({
  source: `© OpenStreetMap contributors, ODbL. Data as of ${osm.osm3s?.timestamp_osm_base ?? 'unknown'}`,
  origin: 'Acropolis',
  unitM: UNIT_M,
  places: { cellM: CELL_M, x: Math.round(west), y: Math.round(north), cols, names, runs },
  lines,
})
await writeFile(outFile, json)

const points = lines.reduce((n, l) => n + (l.length - 1) / 2, 0)
console.log(`fetch-streets: ${lines.length} lines, ${points} points, ${names.length} places, ` +
  `${(json.length / 1024).toFixed(0)} KB -> ${outFile}`)
```

### `web/src/index.css`

Appended at the end of the file, after the `#cv` print rules:

```css
/* Street map of Athens behind the hero, masked so the text stays clean; hero-map.jsx mirrors
   where the Acropolis sits and where the fade starts. Narrow screens get a corner of it beside
   the avatar and title, ending where the paragraph starts and kept narrow enough that the western
   end of the map data falls where the mask has faded it out; wide ones the right of the hero. */
.hero-map {
  position: absolute;
  top: -2rem;
  right: 0;
  width: min(70%, 18rem);
  height: 10.5rem;
  z-index: -1;
  pointer-events: none;
  -webkit-mask-image:
    linear-gradient(to right, transparent, #000 50%),
    linear-gradient(to bottom, transparent, #000 30%, #000 50%, transparent);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(to right, transparent, #000 50%),
    linear-gradient(to bottom, transparent, #000 30%, #000 50%, transparent);
  mask-composite: intersect;
}

.hero-map canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.hero-map-caption {
  position: absolute;
  top: 0.25rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.3em;
  pointer-events: none;
  font-family: var(--font-mono);
  font-size: 10.5px;
  line-height: 1;
  white-space: nowrap;
  color: var(--color-ink-subtle);
  /* lifts it off the streets that run under it */
  text-shadow: 0 0 3px var(--color-bg), 0 0 8px var(--color-bg);
}

.hero-map-caption svg {
  flex-shrink: 0;
  font-size: 1.15em;
  filter: drop-shadow(0 0 2px var(--color-bg));
}

@media (min-width: 1024px) {
  .hero-map {
    inset: 0;
    width: auto;
    height: auto;
    -webkit-mask-image:
      linear-gradient(to right, transparent 50%, #000 78%),
      linear-gradient(to bottom, transparent 8%, #000 40%);
    mask-image:
      linear-gradient(to right, transparent 50%, #000 78%),
      linear-gradient(to bottom, transparent 8%, #000 40%);
  }
}
```

### `web/src/app.jsx`

```jsx
import HeroMap from './components/hero-map'
```

```jsx
        <section className="relative isolate flex flex-col items-start text-left w-[calc(100%+3rem)] border-b border-dashed border-line -mx-6 px-6 pb-12">

          <HeroMap theme={theme} />

          {}
          <img
```

Without the map, the section is
`flex flex-col items-start text-left w-[calc(100%+3rem)] border-b border-dashed border-line -mx-6 px-6 pb-12`.
The `relative isolate` was there only so the absolutely positioned,
`z-index: -1` map stayed inside the hero.

### `web/tests/dist/dist.test.js`

In the "performance budgets" block, after the supabase test:

```js
  test('the hero map data stays under 100 KB gzipped', () => {
    const map = files.find((f) => /^assets\/athens-streets-[\w-]+\.js$/.test(f))
    expect(map).toBeTruthy()
    expect(gzipSync(readFileSync(path.join(DIST, map))).length / 1024).toBeLessThan(100)
  })
```

### `README.md`

Under "One-off tools", the list read
`` `fetch-fonts.js` · `fetch-icons.js` · `fetch-streets.js` · `make-og-image.js` · `make-image-variants.js` ``
and this section came before `make-image-variants.js`:

````md
### fetch-streets.js

```bash
node fetch-streets.js
```

Rebuilds `src/lib/athens-streets.json`, the streets and coastline behind the
hero's map of Athens plus the places that light up on hover: municipalities
(Marousi, Chalandri), the old municipalities merged ones are made of
(Psychiko, Cholargos), neighbourhoods inside Athens itself (Kolonaki, Plaka)
and a few hand-picked `LANDMARKS`. It all comes out of OpenStreetMap via the
Overpass API. Run it to pick up newer map data, or to change the area
(`REACH_KM`), the landmarks or the spellings (`SAID`). The data is ©
OpenStreetMap contributors (ODbL).
````
