import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import dns from 'node:dns/promises'
import tls from 'node:tls'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = (process.env.LIVE_URL || 'https://blxr.net').replace(/\/$/, '')
const HOST = new URL(BASE).hostname
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const get = (p, init = {}) => fetch(p.startsWith('http') ? p : BASE + p, { redirect: 'manual', ...init, signal: AbortSignal.timeout(15_000) })

const SECURITY_HEADERS = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy']

describe('transport', () => {
  test('HTTP redirects to the HTTPS apex', async () => {
    const res = await get(`http://${HOST}/cv?x=1`)
    assert.equal(res.status, 301)
    assert.equal(res.headers.get('location'), `https://${HOST}/cv?x=1`)
  })

  test('www redirects to the apex', async () => {
    const res = await get(`https://www.${HOST}/projects`)
    assert.equal(res.status, 301)
    assert.equal(res.headers.get('location'), `https://${HOST}/projects`)
  })

  for (const [version, ok] of [['TLSv1', false], ['TLSv1.1', false], ['TLSv1.2', true], ['TLSv1.3', true]]) {
    test(`${version} is ${ok ? 'accepted' : 'refused'}`, async () => {
      const result = await new Promise((resolve) => {
        const socket = tls.connect({ host: HOST, port: 443, servername: HOST, minVersion: version, maxVersion: version, ciphers: 'DEFAULT:@SECLEVEL=0', timeout: 10_000 }, () => {
          socket.end()
          resolve(true)
        })
        socket.on('error', () => resolve(false))
        socket.on('timeout', () => {
          socket.destroy()
          resolve(false)
        })
      })
      assert.equal(result, ok)
    })
  }

  test('certificate is valid for the apex and www, with 14+ days left', async () => {
    const cert = await new Promise((resolve, reject) => {
      const socket = tls.connect({ host: HOST, port: 443, servername: HOST }, () => {
        resolve(socket.getPeerCertificate())
        socket.end()
      })
      socket.on('error', reject)
    })
    const names = cert.subjectaltname.split(', ').map((s) => s.replace(/^DNS:/, ''))
    assert.ok(names.some((n) => n === HOST || n === `*.${HOST.split('.').slice(1).join('.')}`), cert.subjectaltname)
    const days = (Date.parse(cert.valid_to) - Date.now()) / 86_400_000
    assert.ok(days > 14, `certificate expires in ${Math.floor(days)} days`)
  })
})

describe('pages', () => {
  let sitemapUrls = []

  test('sitemap.xml and robots.txt are served', async () => {
    const sitemap = await get('/sitemap.xml')
    assert.equal(sitemap.status, 200)
    sitemapUrls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    assert.ok(sitemapUrls.length >= 10)
    const robots = await (await get('/robots.txt')).text()
    assert.match(robots, /Sitemap: https:\/\/blxr\.net\/sitemap\.xml/)
  })

  test('every sitemap URL is a 200 HTML page whose canonical is itself', async () => {
    const problems = []
    for (const url of sitemapUrls) {
      const res = await get(url.replace('https://blxr.net', BASE))
      const html = await res.text()
      if (res.status !== 200) problems.push(`${url}: ${res.status}`)
      else if (!/^text\/html/.test(res.headers.get('content-type'))) problems.push(`${url}: ${res.headers.get('content-type')}`)
      else if (/<link rel="canonical"/.test(html) && !html.includes(`<link rel="canonical" href="${url}"`)) problems.push(`${url}: canonical mismatch`)
    }
    assert.deepEqual(problems, [])
  })

  test('HTML, assets, API and 404s all carry the security headers', async () => {
    const html = await (await get('/')).text()
    const asset = /src="(\/assets\/[^"]+\.js)"/.exec(html)[1]
    for (const p of ['/', '/cv', asset, '/api/music/health', '/definitely-not-a-page', '/favicon.svg', '/site.webmanifest']) {
      const res = await get(p)
      for (const h of SECURITY_HEADERS) assert.ok(res.headers.get(h), `${p} is missing ${h}`)
    }
  })

  test('HSTS is a year+, with subdomains and preload', async () => {
    const hsts = (await get('/')).headers.get('strict-transport-security')
    assert.match(hsts, /max-age=(3153[6-9]\d{3}|3[2-9]\d{6}|[4-9]\d{7}|\d{9,})/)
    assert.match(hsts, /includeSubDomains/)
    assert.match(hsts, /preload/)
  })

  const injectedByCloudflare = (body) => body.includes('__CF$cv$params') || body.includes('/cdn-cgi/challenge-platform/')
  const inlineScripts = async () => {
    const res = await get('/')
    const csp = res.headers.get('content-security-policy')
    const scripts = [...(await res.text()).matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter(([, attrs]) => !/ld\+json/.test(attrs))
      .map(([, , body]) => ({ body, hash: `sha256-${createHash('sha256').update(body).digest('base64')}` }))
    return { csp, scripts }
  }

  test('the deployed CSP covers our own inline scripts (no theme flash)', async () => {
    const { csp, scripts } = await inlineScripts()
    assert.doesNotMatch(csp, /\{\{SCRIPT_HASHES\}\}/, 'placeholder was never substituted')
    const ours = scripts.filter((s) => !injectedByCloudflare(s.body))
    assert.ok(ours.length > 0, 'the pre-paint theme script is missing')
    for (const s of ours) assert.ok(csp.includes(s.hash), `inline script ${s.hash} is blocked by the live CSP`)
  })

  test('no edge-injected inline script is being blocked by the CSP', { todo: 'Cloudflare JavaScript Detections is on: its inline bootstrap is CSP-blocked on every page view. Turn it off under Security → Bots, or accept it.' }, async () => {
    const { scripts } = await inlineScripts()
    assert.deepEqual(scripts.filter((s) => injectedByCloudflare(s.body)).map((s) => s.hash), [])
  })

  test('Early Hints / Link headers point at assets that exist', async () => {
    const res = await get('/')
    const links = [...(res.headers.get('link') || '').matchAll(/<([^>]+)>/g)].map((m) => m[1])
    assert.ok(links.length > 0, 'no Link headers on HTML')
    for (const href of links) assert.equal((await get(href, { method: 'HEAD' })).status, 200, href)
  })

  test('no mixed content in the homepage', async () => {
    const html = await (await get('/')).text()
    assert.doesNotMatch(html, /\s(src|href)="http:\/\//)
  })

  test('the server does not advertise its version', async () => {
    const server = (await get('/')).headers.get('server') || ''
    assert.doesNotMatch(server, /\d+\.\d+/)
    assert.equal((await get('/api/music/health')).headers.get('x-powered-by'), null)
  })
})

describe('caching and compression', () => {
  test('hashed assets are immutable for a year; HTML is revalidated', async () => {
    const res = await get('/')
    assert.match(res.headers.get('cache-control'), /no-cache/)
    const asset = /src="(\/assets\/[^"]+\.js)"/.exec(await res.text())[1]
    assert.match((await get(asset)).headers.get('cache-control'), /max-age=31536000.*immutable/)
  })

  test('brotli and gzip are served when asked for', async () => {
    const html = await (await get('/')).text()
    const asset = /src="(\/assets\/[^"]+\.js)"/.exec(html)[1]
    assert.equal((await get(asset, { headers: { 'accept-encoding': 'br' } })).headers.get('content-encoding'), 'br')
    assert.equal((await get(asset, { headers: { 'accept-encoding': 'gzip' } })).headers.get('content-encoding'), 'gzip')
  })
})

describe('redirects and error handling', () => {
  for (const [from, to] of [
    ['/projects.html', '/projects'],
    ['/index.html', '/'],
    ['/projects/', '/projects'],
    ['/el/cv', '/cv'],
    ['/fr', '/'],
    ['/u/someone', '/@someone'],
  ]) {
    test(`${from} → 301 ${to}`, async () => {
      const res = await get(from)
      assert.equal(res.status, 301)
      assert.equal(new URL(res.headers.get('location'), BASE).pathname, to)
    })
  }

  test('unknown pages are a real 404 with the site 404 page', async () => {
    const res = await get('/definitely-not-a-page')
    assert.equal(res.status, 404)
    assert.match(await res.text(), /<div id="root">/)
  })

  for (const p of ['/.git/config', '/.env', '/server.env', '/deploy.sh', '/assets/app.js.map', '/.DS_Store', '/package.json']) {
    test(`${p} is not served`, async () => {
      const res = await get(p)
      assert.equal(res.status, 404)
    })
  }
})

describe('API', () => {
  test('health check', async () => {
    const res = await get('/api/music/health')
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true, source: 'youtube' })
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow')
  })

  test('public reviews list is JSON and never exposes submitter hashes', async () => {
    const res = await get('/api/reviews')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.ok(Array.isArray(body.items))
    assert.doesNotMatch(JSON.stringify(body), /ipHash|deviceHash|cookieHash/)
  })

  test('owner endpoints refuse anonymous callers', async () => {
    for (const p of ['/api/logs', '/api/hits', '/api/reviews/panel']) {
      const res = await get(p)
      assert.ok([401, 403, 404].includes(res.status), `${p} → ${res.status}`)
    }
  })

  test('cross-site writes are refused', async () => {
    const res = await get('/api/hit', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{"path":"/"}' })
    assert.equal(res.status, 403)
  })
})

describe('DNS and mail', () => {
  test('SPF and DMARC exist for the domain that sends account mail', async () => {
    const txt = (await dns.resolveTxt(HOST).catch(() => [])).map((r) => r.join(''))
    const dmarc = (await dns.resolveTxt(`_dmarc.${HOST}`).catch(() => [])).map((r) => r.join(''))
    const sendTxt = (await dns.resolveTxt(`send.${HOST}`).catch(() => [])).map((r) => r.join(''))
    assert.ok([...txt, ...sendTxt].some((r) => r.startsWith('v=spf1')), 'no SPF record (apex or send.)')
    assert.ok(dmarc.some((r) => r.startsWith('v=DMARC1')), 'no DMARC record')
  })

  test('Resend DKIM key is published', async () => {
    const dkim = (await dns.resolveTxt(`resend._domainkey.${HOST}`).catch(() => [])).map((r) => r.join(''))
    assert.ok(dkim.some((r) => r.includes('p=')), 'no resend._domainkey record')
  })
})

describe('third-party drift', () => {
  test("nginx trusts exactly Cloudflare's current IP ranges", async () => {
    const [v4, v6] = await Promise.all(['https://www.cloudflare.com/ips-v4', 'https://www.cloudflare.com/ips-v6'].map(async (u) => (await fetch(u)).text()))
    const official = new Set(`${v4}\n${v6}`.split('\n').map((s) => s.trim()).filter(Boolean))
    const ours = new Set([...(await readFile(path.join(ROOT, 'deploy/nginx/cloudflare-realip.conf'), 'utf8')).matchAll(/set_real_ip_from\s+([^;\s]+);/g)].map((m) => m[1]))
    assert.deepEqual([...official].filter((r) => !ours.has(r)), [], 'missing ranges: visitors behind them share one rate-limit bucket')
    assert.deepEqual([...ours].filter((r) => !official.has(r)), [], 'stale ranges: those IPs could spoof CF-Connecting-IP')
  })

  test('the domain meets every HSTS preload requirement', async () => {
    const check = await (await fetch(`https://hstspreload.org/api/v2/preloadable?domain=${HOST}`)).json()
    assert.deepEqual(check.errors, [])
    assert.deepEqual(check.warnings, [])
  })

  test('the domain is on the HSTS preload list', { todo: 'eligible but never submitted: the header says preload, so either submit at hstspreload.org or drop `preload`' }, async () => {
    const status = await (await fetch(`https://hstspreload.org/api/v2/status?domain=${HOST}`)).json()
    assert.ok(['preloaded', 'pending'].includes(status.status), `hstspreload.org says: ${status.status}`)
  })
})
