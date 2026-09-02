import { useEffect, useRef, useState } from 'react'

const GLYPHS = {
  0: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
}

const DIGITS = 3
const ROWS = 7
const GLYPH_COLS = 5

const COLS = DIGITS * GLYPH_COLS + (DIGITS - 1)

const CELLS = (() => {
  const cells = []
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {

      cells.push({ col, row, i: col * 2 + row })
    }
  }
  return cells
})()

function isOn(figure, col, row) {
  const digit = Math.floor(col / (GLYPH_COLS + 1))
  const colInGlyph = col % (GLYPH_COLS + 1)
  if (colInGlyph === GLYPH_COLS) return false
  const glyph = GLYPHS[figure[digit]]
  return Boolean(glyph && glyph[row][colInGlyph] === '#')
}

const GLOW_RADIUS = 3.2

const RIPPLE_SPEED = 9
const RIPPLE_BAND = 1.6
const RIPPLE_LIFE = 900

const GLINT_EVERY = [4000, 9000]

const LIFE_TICK = 150
const LIFE_GENERATIONS = 30

function nextGeneration(alive) {
  const next = new Array(alive.length)
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      let n = 0
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (!dc && !dr) continue
          const c = col + dc
          const r = row + dr
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS && alive[c * ROWS + r]) n++
        }
      }
      const k = col * ROWS + row
      next[k] = alive[k] ? n === 2 || n === 3 : n === 3
    }
  }
  return next
}

export default function NotFoundMatrix({ figure = '404', className = '' }) {
  const gridRef = useRef(null)
  const [life, setLife] = useState(null)
  const lifeRef = useRef(null)

  useEffect(() => {
    const zone = gridRef.current?.parentElement
    if (!zone) return
    let timer = 0
    const stop = () => {
      window.clearInterval(timer)
      timer = 0
      lifeRef.current = null
      setLife(null)
    }
    const onDoubleClick = () => {
      if (timer) return
      let alive = CELLS.map((c) => isOn(figure, c.col, c.row))
      let generation = 0
      lifeRef.current = alive
      setLife(alive)
      timer = window.setInterval(() => {
        const next = nextGeneration(alive)
        generation += 1
        const changed = next.some((v, k) => v !== alive[k])
        const any = next.some(Boolean)
        alive = next
        lifeRef.current = alive
        setLife(alive)
        if (!changed || !any || generation >= LIFE_GENERATIONS) {
          window.clearInterval(timer)
          timer = 0
          timer = window.setTimeout(stop, any ? 700 : 300)
        }
      }, LIFE_TICK)
    }
    zone.addEventListener('dblclick', onDoubleClick)
    return () => {
      zone.removeEventListener('dblclick', onDoubleClick)
      window.clearInterval(timer)
      window.clearTimeout(timer)
    }
  }, [figure])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const cells = Array.from(grid.children)

    const zone = grid.parentElement
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let frame = 0
    let hover = null
    let ripples = []

    const paint = (now) => {
      frame = 0
      const rect = grid.getBoundingClientRect()
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0
      const pitchX = (rect.width + gap) / COLS
      const pitchY = (rect.height + gap) / ROWS
      const radius = GLOW_RADIUS * pitchX

      ripples = ripples.filter((r) => now - r.born < RIPPLE_LIFE)

      for (let k = 0; k < cells.length; k++) {
        const { col, row } = CELLS[k]
        const cx = rect.left + col * pitchX + (pitchX - gap) / 2
        const cy = rect.top + row * pitchY + (pitchY - gap) / 2
        let lit = 0
        if (hover) {
          const d = Math.hypot(hover.x - cx, hover.y - cy)

          if (d < radius) lit = (1 - d / radius) ** 1.6
        }
        for (const r of ripples) {
          const age = (now - r.born) / 1000
          const ring = age * RIPPLE_SPEED * pitchX
          const band = RIPPLE_BAND * pitchX
          const d = Math.abs(Math.hypot(r.x - cx, r.y - cy) - ring)
          if (d < band) {
            const fade = 1 - (now - r.born) / RIPPLE_LIFE
            lit = Math.max(lit, (1 - d / band) * fade)
          }
        }
        cells[k].style.setProperty('--lit', lit.toFixed(3))
      }

      if (ripples.length) frame = requestAnimationFrame(paint)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }

    const onMove = (e) => {

      if (e.pointerType && e.pointerType !== 'mouse') return
      hover = { x: e.clientX, y: e.clientY }
      schedule()
    }
    const onLeave = () => {
      hover = null
      schedule()
    }
    const onDown = (e) => {
      if (reduced) return
      ripples.push({ x: e.clientX, y: e.clientY, born: performance.now() })
      schedule()
    }

    let glint = 0
    const scheduleGlint = () => {
      const [min, max] = GLINT_EVERY
      glint = window.setTimeout(() => {
        const on = cells.filter((c) => c.classList.contains('is-on'))
        const cell = on[Math.floor(Math.random() * on.length)]
        if (cell && !hover) {
          cell.style.setProperty('--lit', '0.85')
          window.setTimeout(() => cell.style.setProperty('--lit', '0'), 140)
        }
        scheduleGlint()
      }, min + Math.random() * (max - min))
    }
    if (!reduced) scheduleGlint()

    zone.addEventListener('pointermove', onMove)
    zone.addEventListener('pointerleave', onLeave)
    zone.addEventListener('pointerdown', onDown)
    return () => {
      zone.removeEventListener('pointermove', onMove)
      zone.removeEventListener('pointerleave', onLeave)
      zone.removeEventListener('pointerdown', onDown)
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(glint)
    }
  }, [])

  return (

    <div className={`nf-zone w-[calc(100%+3rem)] -mx-6 -mt-6 p-6 select-none ${className}`}>
      <div
        ref={gridRef}
        role="img"
        aria-label={figure}

        dir="ltr"
        className={life ? 'nf-grid is-life' : 'nf-grid'}

        style={{
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          gridAutoFlow: 'column',
        }}
      >
        {CELLS.map((cell, k) => (
          <span
            key={k}
            aria-hidden="true"
            className={(life ? life[k] : isOn(figure, cell.col, cell.row)) ? 'nf-cell is-on' : 'nf-cell'}
            style={{ '--i': cell.i, '--c': cell.col }}
          />
        ))}
      </div>
    </div>
  )
}
