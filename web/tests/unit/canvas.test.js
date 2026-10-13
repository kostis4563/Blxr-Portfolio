import { describe, test, expect } from 'vitest'
import { fitFrames, CANVAS_FIT } from '../../src/lib/figma.js'

const home = [
  { width: 960, height: 560 },
  { width: 960, height: 1100 },
  { width: 960, height: 330 },
]

const inside = (frame, viewport) =>
  frame.x >= CANVAS_FIT.side - 0.01 &&
  frame.y >= CANVAS_FIT.top - 0.01 &&
  frame.x + frame.width <= viewport.width - CANVAS_FIT.side + 0.01 &&
  frame.y + frame.height <= viewport.height - CANVAS_FIT.bottom + 0.01

describe('fitFrames', () => {
  test('lays the sections out in a row on a wide screen', () => {
    const viewport = { width: 1440, height: 900 }
    const fit = fitFrames(home, viewport)
    expect(fit.columns).toBe(3)
    expect(new Set(fit.frames.map((f) => f.y)).size).toBe(1)
    expect(fit.frames[1].x - (fit.frames[0].x + fit.frames[0].width)).toBeCloseTo(CANVAS_FIT.gap)
    for (const frame of fit.frames) expect(inside(frame, viewport)).toBe(true)
  })

  test('wraps into a grid on a phone', () => {
    const viewport = { width: 390, height: 844 }
    const phone = [
      { width: 390, height: 700 },
      { width: 390, height: 1400 },
      { width: 390, height: 600 },
    ]
    const fit = fitFrames(phone, viewport)
    expect(fit.columns).toBe(2)
    expect(fit.frames[2].x).toBeCloseTo(fit.frames[0].x)
    expect(fit.frames[2].y).toBeGreaterThan(fit.frames[1].y + fit.frames[1].height)
    for (const frame of fit.frames) expect(inside(frame, viewport)).toBe(true)
  })

  test('keeps frames at their real proportions', () => {
    const fit = fitFrames(home, { width: 1280, height: 720 })
    fit.frames.forEach((frame, i) => {
      expect(frame.width / frame.height).toBeCloseTo(home[i].width / home[i].height)
      expect(frame.width).toBeCloseTo(home[i].width * fit.scale)
    })
  })

  test('never zooms past the cap on a huge screen', () => {
    const fit = fitFrames(home, { width: 5120, height: 2880 })
    expect(fit.scale).toBe(CANVAS_FIT.maxScale)
  })

  test('centres the layout horizontally', () => {
    const viewport = { width: 1440, height: 900 }
    const fit = fitFrames(home, viewport)
    const left = fit.frames[0].x
    const right = viewport.width - (fit.frames[2].x + fit.frames[2].width)
    expect(left).toBeCloseTo(right)
  })

  test('handles a page with no frames', () => {
    expect(fitFrames([], { width: 800, height: 600 })).toEqual({ scale: 1, columns: 0, frames: [] })
  })
})
