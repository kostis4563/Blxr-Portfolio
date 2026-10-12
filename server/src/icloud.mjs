import { parseEvents } from './ical.mjs'

const TIMEOUT_MS = 20_000
const MULTIGET_BATCH = 100
const MULTIGET_CONCURRENCY = 4

const PRINCIPAL_BODY = '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>'
const HOME_BODY = '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>'
const CALENDARS_BODY =
  '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">' +
  '<d:prop><d:resourcetype/><d:displayname/><cs:getctag/><c:supported-calendar-component-set/></d:prop></d:propfind>'
const ETAGS_BODY = '<d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>'

export class CalDavError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

const ENTITIES = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }
function decode(raw) {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw)
  if (cdata) return cdata[1]
  return raw.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(lt|gt|quot|apos|amp));/gi, (_, dec, hex, name) =>
    dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : ENTITIES[name.toLowerCase()],
  )
}

const elementRe = (name, flags = 'i') => new RegExp(`<(?:[\\w.-]+:)?${name}(?=[\\s/>])[^>]*?(?:/>|>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}\\s*>)`, flags)
const inner = (xml, name) => {
  const m = elementRe(name).exec(xml || '')
  return m ? (m[1] ?? '') : null
}
const all = (xml, name) => [...(xml || '').matchAll(elementRe(name, 'gi'))].map((m) => m[1] ?? '')
const text = (xml, name) => {
  const raw = inner(xml, name)
  return raw === null ? null : decode(raw).trim()
}

function responses(xml) {
  return all(xml, 'response').map((body) => {
    const props = all(body, 'propstat')
      .filter((p) => /\s200\s/.test(` ${text(p, 'status') || ''} `))
      .map((p) => inner(p, 'prop') || '')
      .join('')
    return { href: text(body, 'href'), props }
  })
}

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

const keyOf = (href, base) => {
  const path = new URL(href, base).pathname
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

async function pool(items, size, run) {
  const out = []
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await run(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return out
}

export class CalDavClient {
  constructor({ root, email, password }) {
    this.root = root.endsWith('/') ? root : `${root}/`
    this.auth = `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`
    this.home = null
  }

  async dav(method, url, { depth, body, headers = {} } = {}) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method,
        headers: {
          authorization: this.auth,
          ...(depth === undefined ? {} : { depth: String(depth) }),
          ...(body && !headers['content-type'] ? { 'content-type': 'application/xml; charset=utf-8' } : {}),
          ...headers,
        },
        body,
        signal: ctrl.signal,
      })
      const payload = await res.text()
      if (res.status === 401) throw new CalDavError('auth', 401)
      if (!res.ok) throw new Error(`caldav ${method} ${new URL(url).pathname} ${res.status}`)
      return { url: res.url || String(url), body: payload, status: res.status }
    } finally {
      clearTimeout(timer)
    }
  }

  async calendarHome() {
    if (this.home) return this.home
    const root = await this.dav('PROPFIND', this.root, { depth: 0, body: PRINCIPAL_BODY })
    const principal = text(inner(responses(root.body)[0]?.props, 'current-user-principal'), 'href')
    if (!principal) throw new Error('caldav: no current-user-principal')
    const principalUrl = new URL(principal, root.url).href
    const found = await this.dav('PROPFIND', principalUrl, { depth: 0, body: HOME_BODY })
    const home = text(inner(responses(found.body)[0]?.props, 'calendar-home-set'), 'href')
    if (!home) throw new Error('caldav: no calendar-home-set')
    this.home = new URL(home, found.url).href
    return this.home
  }

  async calendars() {
    const home = await this.calendarHome()
    const { body, url } = await this.dav('PROPFIND', home, { depth: 1, body: CALENDARS_BODY })
    return responses(body)
      .filter(({ href, props }) => href && /<(?:[\w.-]+:)?calendar[\s/>]/i.test(inner(props, 'resourcetype') || ''))
      .filter(({ props }) => {
        const comps = [...(inner(props, 'supported-calendar-component-set') || '').matchAll(/name\s*=\s*"([A-Za-z]+)"/g)].map((m) => m[1].toUpperCase())
        return !comps.length || comps.includes('VEVENT')
      })
      .map(({ href, props }) => ({
        url: new URL(href, url).href,
        name: text(props, 'displayname') || decodeURIComponent(href.split('/').filter(Boolean).pop() || href),
        ctag: text(props, 'getctag') || null,
      }))
  }

  async etags(calendarUrl) {
    const { body, url } = await this.dav('PROPFIND', calendarUrl, { depth: 1, body: ETAGS_BODY })
    const self = keyOf(calendarUrl, calendarUrl)
    const out = new Map()
    for (const { href, props } of responses(body)) {
      if (!href || keyOf(href, url) === self || !/\.ics$/i.test(new URL(href, url).pathname)) continue
      out.set(keyOf(href, url), { href: new URL(href, url).href, etag: text(props, 'getetag') || '' })
    }
    return out
  }

  async multiget(calendarUrl, hrefs) {
    const batches = []
    for (let i = 0; i < hrefs.length; i += MULTIGET_BATCH) batches.push(hrefs.slice(i, i + MULTIGET_BATCH))
    const results = await pool(batches, MULTIGET_CONCURRENCY, async (batch) => {
      const body =
        '<c:calendar-multiget xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop>' +
        batch.map((href) => `<d:href>${escapeXml(new URL(href).pathname)}</d:href>`).join('') +
        '</c:calendar-multiget>'
      const res = await this.dav('REPORT', calendarUrl, { depth: 1, body })
      return responses(res.body)
        .filter(({ href, props }) => href && inner(props, 'calendar-data') !== null)
        .map(({ href, props }) => ({ key: keyOf(href, res.url), etag: text(props, 'getetag') || '', data: decode(inner(props, 'calendar-data')) }))
    })
    return results.flat()
  }

  async put(calendarUrl, uid, ics) {
    const base = calendarUrl.endsWith('/') ? calendarUrl : `${calendarUrl}/`
    const url = new URL(`${encodeURIComponent(uid)}.ics`, base).href
    await this.dav('PUT', url, { body: ics, headers: { 'content-type': 'text/calendar; charset=utf-8' } })
    return url
  }
}

export class CalendarMirror {
  constructor(client) {
    this.client = client
    this.calendars = new Map()
  }

  async sync() {
    const listed = await this.client.calendars()
    const seen = new Set()
    for (const cal of listed) {
      seen.add(cal.url)
      let mirror = this.calendars.get(cal.url)
      if (!mirror) {
        mirror = { url: cal.url, name: cal.name, ctag: null, items: new Map() }
        this.calendars.set(cal.url, mirror)
      }
      mirror.name = cal.name
      if (cal.ctag && cal.ctag === mirror.ctag) continue
      const etags = await this.client.etags(cal.url)
      for (const key of mirror.items.keys()) if (!etags.has(key)) mirror.items.delete(key)
      const stale = [...etags].filter(([key, { etag }]) => !etag || mirror.items.get(key)?.etag !== etag).map(([, { href }]) => href)
      for (const item of await this.client.multiget(cal.url, stale)) {
        mirror.items.set(item.key, { etag: item.etag || etags.get(item.key)?.etag || '', events: parseEvents(item.data) })
      }
      mirror.ctag = cal.ctag
    }
    for (const url of [...this.calendars.keys()]) if (!seen.has(url)) this.calendars.delete(url)
    return [...this.calendars.values()].map((c) => ({ url: c.url, name: c.name, events: [...c.items.values()].flatMap((item) => item.events) }))
  }
}
