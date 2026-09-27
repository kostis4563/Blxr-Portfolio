const GROUND = 0.88
const unit = (width, height) => Math.min(width * 0.014, height * 0.011)
const BURST = 10
const EYE = 4
const DISTANCE = 170

const TAU = Math.PI * 2
const SPRITE = 64
const SHADES = 48
const VARIANTS = 4

const RAMP = [
  [-1, [214, 208, 202]],
  [-0.6, [170, 160, 153]],
  [-0.3, [133, 117, 107]],
  [0, [102, 78, 66]],
  [0.15, [122, 56, 38]],
  [0.3, [180, 64, 30]],
  [0.45, [232, 98, 36]],
  [0.6, [255, 152, 58]],
  [0.75, [255, 204, 112]],
  [0.88, [255, 236, 180]],
  [1, [255, 252, 242]],
]

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value))
const between = (low, high) => low + Math.random() * (high - low)
const smooth = (from, to, t) => {
  const x = clamp((t - from) / (to - from))
  return x * x * (3 - 2 * x)
}

function ramp(heat) {
  const h = clamp(heat, -1, 1)
  let i = 1
  while (RAMP[i][0] < h) i++
  const [from, low] = RAMP[i - 1]
  const [to, high] = RAMP[i]
  const mix = (h - from) / (to - from)
  return low.map((channel, c) => Math.round(channel + (high[c] - channel) * mix))
}

const rgba = ([r, g, b], alpha, gain = 1) =>
  `rgba(${Math.min(255, Math.round(r * gain))},${Math.min(255, Math.round(g * gain))},${Math.min(255, Math.round(b * gain))},${alpha})`

const shadeOf = (heat) => Math.round(((clamp(heat, -1, 1) + 1) / 2) * (SHADES - 1))

const LUMPS = Array.from({ length: VARIANTS }, () => [
  { x: 0.5, y: 0.52, r: 0.34, alpha: 0.6 },
  ...Array.from({ length: 16 }, () => {
    const angle = Math.random() * TAU
    const reach = Math.sqrt(Math.random()) * 0.22
    return {
      x: 0.5 + Math.cos(angle) * reach,
      y: 0.5 + Math.sin(angle) * reach * 0.85,
      r: 0.08 + Math.random() * 0.12,
      alpha: 0.45,
    }
  }),
])

const sprites = new Map()
let warmed = 0

function puff(shade, variant) {
  const key = shade * VARIANTS + variant
  let image = sprites.get(key)
  if (image) return image
  image = document.createElement('canvas')
  image.width = image.height = SPRITE
  const g = image.getContext('2d')
  const color = ramp((shade / (SHADES - 1)) * 2 - 1)
  for (const { x, y, r, alpha } of LUMPS[variant]) {
    const [px, py, radius] = [x * SPRITE, y * SPRITE, r * SPRITE]
    const fill = g.createRadialGradient(px - radius * 0.2, py - radius * 0.3, radius * 0.1, px, py, radius)
    fill.addColorStop(0, rgba(color, alpha, 1.06))
    fill.addColorStop(0.4, rgba(color, alpha * 0.8))
    fill.addColorStop(0.75, rgba(color, alpha * 0.3, 0.92))
    fill.addColorStop(1, rgba(color, 0, 0.88))
    g.fillStyle = fill
    g.beginPath()
    g.arc(px, py, radius, 0, TAU)
    g.fill()
  }
  sprites.set(key, image)
  return image
}

function glow(shade) {
  const key = -1 - shade
  let image = sprites.get(key)
  if (image) return image
  image = document.createElement('canvas')
  image.width = image.height = SPRITE
  const g = image.getContext('2d')
  const color = ramp((shade / (SHADES - 1)) * 2 - 1)
  const fill = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2)
  fill.addColorStop(0, rgba(color, 1))
  fill.addColorStop(0.4, rgba(color, 0.35))
  fill.addColorStop(1, rgba(color, 0))
  g.fillStyle = fill
  g.fillRect(0, 0, SPRITE, SPRITE)
  sprites.set(key, image)
  return image
}

function warm(budget) {
  for (let n = 0; n < budget && warmed < SHADES * VARIANTS; n++, warmed++) {
    puff(Math.floor(warmed / VARIANTS), warmed % VARIANTS)
  }
}

const rise = (t) => BURST + 27 * (1 - Math.exp(-t / 2.4)) + 0.5 * t
const ring = (t) => 15 * (1 - Math.exp(-((t / 2.2) ** 1.5)))
const tube = (t) => 7 * (1 - Math.exp(-t / 0.12)) + 5 * (1 - Math.exp(-t / 2))
const flat = (t) => 0.62 + 0.38 * Math.exp(-((t / 1.8) ** 2))
const roll = (t) => 2.6 * (1 - Math.exp(-t / 2.8)) + 0.05 * t
const fire = (t) => Math.exp(-t / 2.4)
const aged = (t) => clamp((t - 2) / 5)

function capPuffs() {
  return Array.from({ length: 260 }, () => {
    const reach = 0.3 + 0.7 * Math.sqrt(Math.random())
    return {
      phi: Math.random() * TAU,
      theta: Math.random() * TAU,
      reach,
      base: between(6.5, 10),
      shade: between(-0.06, 0.06),
      variant: Math.floor(Math.random() * VARIANTS),
      cooling: between(0.7, 1.3) + (1 - reach) ** 1.5 * 3.5,
      boil: between(0.8, 1.6),
      phase: Math.random() * TAU,
    }
  })
}

function stemPuffs() {
  return Array.from({ length: 90 }, () => {
    const period = between(2.1, 2.9)
    return {
      phi: Math.random() * TAU,
      from: between(3, 9),
      extra: between(0, 1.5),
      period,
      start: 0.3 + Math.random() * period,
      variant: Math.floor(Math.random() * VARIANTS),
    }
  })
}

function dustPuffs() {
  return Array.from({ length: 80 }, () => ({
    phi: Math.random() * TAU,
    start: between(0.1, 0.45),
    pace: between(0.8, 1.6),
    reach: 10 + 62 * Math.random() ** 0.8,
    lift: between(0.5, 4),
    grow: between(6, 12),
    tone: between(0.45, 0.75),
    variant: Math.floor(Math.random() * VARIANTS),
  }))
}

function ringPuffs() {
  return [1.4, 2.4].flatMap((start, n) => {
    const height = rise(start) * (0.55 + n * 0.08)
    return Array.from({ length: 40 }, (_, i) => ({
      phi: ((i + Math.random() * 0.6) / 40) * TAU,
      start,
      height,
      reach: 12 + n * 5,
      variant: Math.floor(Math.random() * VARIANTS),
    }))
  })
}

function streaks() {
  return Array.from({ length: 40 }, () => ({
    angle: -Math.PI + between(0.1, Math.PI - 0.1),
    delay: between(0, 0.25),
    width: between(1, 2.6),
  }))
}

function ashFlakes() {
  return Array.from({ length: 90 }, () => ({
    x: Math.random(),
    y: between(-0.1, 0.5),
    fall: between(0.03, 0.08),
    sway: between(0.6, 1.4),
    drift: between(1, 3),
    phase: Math.random() * TAU,
    size: between(1, 2.6),
    start: between(2.2, 5.5),
    ember: Math.random() < 0.3,
  }))
}

export function mushroomCloud(canvas, { detonateAt, shock }) {
  const ctx = canvas?.getContext('2d')
  if (!ctx) return

  const cap = capPuffs()
  const stem = stemPuffs()
  const dust = dustPuffs()
  const rings = ringPuffs()
  const puffs = [...cap, ...stem, ...dust, ...rings]
  const debris = streaks()
  const ash = ashFlakes()

  let width = 0
  let height = 0
  let u = 0
  let cx = 0
  let groundY = 0
  let horizon = 0

  function place(p, X, Y, Z) {
    const k = DISTANCE / (DISTANCE - Z)
    p.x = cx + X * u * k
    p.y = horizon - (Y - EYE) * u * k
    p.z = Z
    return k
  }

  function update(t) {
    const top = rise(t)
    const across = ring(t)
    const thick = tube(t)
    const turned = roll(t)
    const heatLeft = fire(t)
    const grey = aged(t)
    const squat = flat(t)

    for (const p of cap) {
      const theta = p.theta - turned
      const r = thick * p.reach
      const out = across + r * Math.cos(theta)
      const rolled = r * Math.sin(theta) * squat
      const k = place(p, out * Math.cos(p.phi), top + rolled + Math.sin(t * p.boil + p.phase) * 0.35, out * Math.sin(p.phi))
      const heat = Math.exp(-t / p.cooling)
      const lit = clamp((rolled / (thick * squat) + 1) / 2)
      p.heat = heat - (1 - heat) * (0.12 + 0.62 * lit ** 1.5 + 0.22 * grey + p.shade)
      p.size = p.base * (0.35 + 0.65 * Math.min(1, thick / 9)) * u * k
      p.squash = 1
      p.alpha = Math.min(1, t / 0.05)
    }

    const capBottom = top - thick * squat * 0.7
    for (const p of stem) {
      const since = t - p.start
      if (since < 0) {
        p.alpha = 0
        continue
      }
      const age = since % p.period
      const climb = 1 - Math.exp(-age / 1.1)
      const spread = 1.6 + (p.from - 1.6) * Math.exp(-age / 0.5) + climb ** 6 * 5
      const k = place(p, spread * Math.cos(p.phi), 0.3 + climb * capBottom, spread * Math.sin(p.phi))
      const heat = heatLeft * climb ** 3 * 0.75
      p.heat = heat - (1 - heat) * (0.25 + 0.4 * grey)
      p.size = (4.4 + 3.6 * climb + p.extra) * u * k
      p.squash = 1
      p.alpha = clamp(Math.min(age / 0.3, (p.period - age) / (p.period * 0.2))) * (1 - 0.35 * grey)
    }

    for (const p of dust) {
      const age = t - p.start
      if (age < 0) {
        p.alpha = 0
        continue
      }
      const out = 1 - Math.exp(-age / p.pace)
      const spread = 2 + out * p.reach
      const k = place(p, spread * Math.cos(p.phi), 0.8 + out * p.lift, spread * Math.sin(p.phi))
      const heat = heatLeft * (1 - out) * 0.6
      p.heat = heat - (1 - heat) * p.tone
      p.size = (3 + out * p.grow) * u * k
      p.squash = 0.5 + out * 0.15
      p.alpha = Math.min(1, age / 0.25) * (0.75 - 0.3 * grey)
    }

    for (const p of rings) {
      const age = t - p.start
      if (age < 0 || age > 2.8) {
        p.alpha = 0
        continue
      }
      const spread = 4 + (1 - Math.exp(-age / 0.8)) * p.reach
      const k = place(p, spread * Math.cos(p.phi), p.height + age * 0.9, spread * Math.sin(p.phi))
      p.heat = -0.95
      p.size = (3.4 + 3.2 * (age / 2.8)) * u * k
      p.squash = 0.45
      p.alpha = Math.sin((Math.PI * age) / 2.8) * 0.42
    }

    puffs.sort((a, b) => a.z - b.z)
  }

  function draw(t) {
    const burstY = horizon - (rise(t) - EYE) * u
    const heatLeft = fire(t)
    const diagonal = Math.hypot(width, height)

    const dim = smooth(1.2, 5, t) * 0.3
    if (dim > 0) {
      const sky = ctx.createLinearGradient(0, 0, 0, groundY)
      sky.addColorStop(0, `rgba(34,22,16,${dim})`)
      sky.addColorStop(1, 'rgba(34,22,16,0)')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, groundY)
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, width, groundY)
    ctx.clip()

    if (t < shock + 0.15) {
      const reach = Math.max(1, diagonal * clamp(t / shock) ** 0.75)
      const strength = 0.3 * (1 - smooth(shock - 0.1, shock + 0.15, t))
      const front = ctx.createRadialGradient(cx, burstY, reach * 0.9, cx, burstY, reach)
      front.addColorStop(0, 'rgba(255,246,230,0)')
      front.addColorStop(0.85, `rgba(255,246,230,${strength})`)
      front.addColorStop(1, 'rgba(255,246,230,0)')
      ctx.fillStyle = front
      ctx.fillRect(0, 0, width, groundY)
    }

    if (t > 0.08 && t < 0.9) {
      const life = (t - 0.08) / 0.82
      const radius = (tube(t) * 1.5 + 24 * life) * u
      const shell = ctx.createRadialGradient(cx, burstY, radius * 0.55, cx, burstY, radius)
      shell.addColorStop(0, 'rgba(250,250,255,0)')
      shell.addColorStop(0.8, `rgba(250,250,255,${Math.sin(Math.PI * life) * 0.45})`)
      shell.addColorStop(1, 'rgba(250,250,255,0)')
      ctx.fillStyle = shell
      ctx.fillRect(cx - radius, burstY - radius, radius * 2, radius * 2)
    }
    ctx.restore()

    ctx.globalCompositeOperation = 'lighter'
    const lit = heatLeft ** 1.3 * 0.55
    if (lit > 0.01) {
      ctx.save()
      ctx.translate(cx, groundY)
      ctx.scale(1, 0.16)
      const floor = ctx.createRadialGradient(0, 0, 0, 0, 0, 45 * u)
      floor.addColorStop(0, `rgba(255,150,70,${lit})`)
      floor.addColorStop(1, 'rgba(255,150,70,0)')
      ctx.fillStyle = floor
      ctx.fillRect(-45 * u, -45 * u, 90 * u, 90 * u)
      ctx.restore()
    }
    ctx.globalCompositeOperation = 'source-over'

    for (const p of puffs) {
      if (p.alpha <= 0.01) continue
      const w = p.size
      const h = p.size * p.squash
      ctx.globalAlpha = p.alpha
      ctx.drawImage(puff(shadeOf(p.heat), p.variant), p.x - w / 2, p.y - h / 2, w, h)
    }

    ctx.globalCompositeOperation = 'lighter'
    for (const p of puffs) {
      if (p.alpha <= 0.01 || p.heat <= 0.3) continue
      const w = p.size * 1.6
      ctx.globalAlpha = ((p.heat - 0.3) / 0.7) ** 1.2 * 0.5 * p.alpha
      ctx.drawImage(glow(shadeOf(p.heat)), p.x - w / 2, p.y - w / 2, w, w)
    }
    ctx.globalAlpha = 1

    const core = heatLeft ** 1.5
    if (core > 0.01) {
      const radius = tube(t) * 2.4 * u
      const color = ramp(0.35 + heatLeft * 0.65)
      const light = ctx.createRadialGradient(cx, burstY, 0, cx, burstY, radius)
      light.addColorStop(0, rgba(color, 0.85 * core))
      light.addColorStop(0.35, rgba(color, 0.35 * core))
      light.addColorStop(1, rgba(color, 0))
      ctx.fillStyle = light
      ctx.fillRect(cx - radius, burstY - radius, radius * 2, radius * 2)
    }
    ctx.globalCompositeOperation = 'source-over'

    if (t > shock && t < shock + 1.1) {
      ctx.lineCap = 'round'
      for (const p of debris) {
        const s = t - shock - p.delay
        if (s <= 0) continue
        const travel = (s / 0.6) ** 2 * diagonal
        const tail = travel * 0.3
        ctx.strokeStyle = `rgba(222,204,178,${0.5 * clamp(1 - s / 0.8)})`
        ctx.lineWidth = (p.width * u) / 10
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(p.angle) * (travel - tail), burstY + Math.sin(p.angle) * (travel - tail))
        ctx.lineTo(cx + Math.cos(p.angle) * travel, burstY + Math.sin(p.angle) * travel)
        ctx.stroke()
      }
    }

    for (const ember of [false, true]) {
      ctx.globalCompositeOperation = ember ? 'lighter' : 'source-over'
      for (const p of ash) {
        const age = t - p.start
        if (age <= 0 || p.ember !== ember) continue
        const x = p.x * width + Math.sin(age * p.sway + p.phase) * p.drift * u
        const y = (p.y + age * p.fall) * height
        const fade = Math.min(1, age / 0.6)
        const size = (p.size * u) / 10
        if (ember) {
          const flicker = 0.55 + 0.45 * Math.sin(age * 9 + p.phase)
          ctx.fillStyle = `rgba(255,${Math.round(120 + flicker * 70)},60,${fade * flicker})`
        } else {
          ctx.fillStyle = `rgba(74,66,60,${fade * 0.8})`
        }
        ctx.fillRect(x, y, size, size)
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  function frame(now) {
    if (!canvas.isConnected) return
    requestAnimationFrame(frame)
    if (canvas.clientWidth !== width || canvas.clientHeight !== height) {
      width = canvas.width = canvas.clientWidth
      height = canvas.height = canvas.clientHeight
      u = unit(width, height)
      cx = width / 2
      groundY = height * GROUND
      horizon = groundY - EYE * u
    }
    ctx.clearRect(0, 0, width, height)
    const t = (now - detonateAt) / 1000
    if (t < 0) {
      warm(12)
      return
    }
    update(t)
    draw(t)
  }
  requestAnimationFrame(frame)
}
