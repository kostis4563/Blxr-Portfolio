import { useEffect, useState } from 'react'

const TTL_MS = 10 * 60 * 1000

const RETRIES = 2
const RETRY_MS = 2500

const PROXY = '/api/weather'

const UPSTREAM =
  'https://api.open-meteo.com/v1/forecast?latitude=37.9838&longitude=23.7275&current=temperature_2m&timezone=Europe%2FAthens'

let cached = null
let inflight = null

async function get(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`weather ${res.status}`)
  return res.json()
}

function tempOf(data) {
  const tempC = Number(data?.tempC ?? data?.current?.temperature_2m)
  if (!Number.isFinite(tempC)) throw new Error('no temperature in the response')
  return tempC
}

async function load() {
  try {
    return tempOf(await get(PROXY))
  } catch (viaProxy) {
    try {
      return tempOf(await get(UPSTREAM))
    } catch (direct) {
      if (import.meta.env.DEV) console.warn(`[weather] ${PROXY}: ${viaProxy.message} — open-meteo: ${direct.message}`)
      throw direct
    }
  }
}

export function athensTemp() {
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.tempC)
  if (!inflight) {
    inflight = load()
      .then((tempC) => {
        cached = { at: Date.now(), tempC }
        return tempC
      })
      .catch(() => null)
      .finally(() => { inflight = null })
  }
  return inflight
}

export function useAthensTemp() {
  const [tempC, setTempC] = useState(() => (cached && Date.now() - cached.at < TTL_MS ? cached.tempC : null))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (tempC !== null || attempt > RETRIES) return
    let live = true
    let timer = 0

    const ask = () => {
      athensTemp().then((t) => {
        if (!live) return
        if (t !== null) setTempC(t)
        else timer = setTimeout(() => setAttempt((n) => n + 1), RETRY_MS * (attempt + 1))
      })
    }

    const idle = window.requestIdleCallback
      ? requestIdleCallback(ask, { timeout: 3000 })
      : setTimeout(ask, attempt ? 0 : 1200)

    return () => {
      live = false
      clearTimeout(timer)
      if (window.requestIdleCallback) cancelIdleCallback(idle)
      else clearTimeout(idle)
    }
  }, [attempt, tempC])

  useEffect(() => {
    if (tempC === null) return

    const refresh = () => { athensTemp().then((t) => { if (t !== null) setTempC(t) }) }
    const onShow = () => { if (!document.hidden) refresh() }

    const id = setInterval(onShow, TTL_MS)
    document.addEventListener('visibilitychange', onShow)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [tempC])

  return tempC
}
