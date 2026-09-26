import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => readFile(path.join(ROOT, p), 'utf8')

const conf = await read('deploy/nginx/blxr.conf')
const headers = await read('deploy/nginx/blxr-security-headers.conf')

function blocks(text, keyword) {
  const out = []
  const re = new RegExp(`^[ \\t]*(${keyword}\\b.*?)\\s*\\{[ \\t]*$`, 'gm')
  let m
  while ((m = re.exec(text))) {
    let depth = 1
    let quoted = false
    let i = re.lastIndex
    while (depth && i < text.length) {
      const c = text[i]
      if (c === '"') quoted = !quoted
      else if (!quoted && c === '{') depth += 1
      else if (!quoted && c === '}') depth -= 1
      i += 1
    }
    out.push({ head: m[1].trim(), body: text.slice(re.lastIndex, i - 1) })
  }
  return out
}

const csp = (() => {
  const value = /Content-Security-Policy "([^"]+)"/.exec(headers)[1]
  return Object.fromEntries(value.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [name, ...sources] = d.split(/\s+/)
    return [name, sources]
  }))
})()
const hostAllowed = (directive, url) => {
  const u = new URL(url)
  return (csp[directive] || csp['default-src']).some((s) => s === `${u.protocol}//${u.host}` || s === u.origin)
}

describe('server blocks', () => {
  const servers = blocks(conf, 'server')

  test('port 80 only redirects to the HTTPS apex (plus ACME)', () => {
    const plain = servers.find((s) => /listen 80;/.test(s.body))
    assert.match(plain.body, /return 301 https:\/\/blxr\.net\$request_uri;/)
    assert.match(plain.body, /location \/\.well-known\/acme-challenge\//)
  })

  test('www redirects to the apex over HTTPS', () => {
    const www = servers.find((s) => /server_name www\.blxr\.net;/.test(s.body))
    assert.match(www.body, /return 301 https:\/\/blxr\.net\$request_uri;/)
  })

  test('the main site hides its version, uses HTTP/2 and pulls in the security headers', () => {
    const main = servers.find((s) => /server_name blxr\.net;/.test(s.body))
    assert.match(main.body, /server_tokens off;/)
    assert.match(main.body, /listen 443 ssl http2;/)
    assert.match(main.body, /include \/etc\/nginx\/snippets\/blxr-security-headers\.conf;/)
    assert.match(main.body, /brotli_static on;/, 'compress.js writes .br files for this')
    assert.match(main.body, /gzip_static on;/)
  })
})

describe('locations', () => {
  const locations = blocks(conf, 'location')

  test('every location that sets a header re-includes the security headers', () => {
    const offenders = locations.filter((l) => /\badd_header\b/.test(l.body) && !/include \/etc\/nginx\/snippets\/blxr-security-headers\.conf;/.test(l.body))
    assert.deepEqual(offenders.map((l) => l.head), [])
  })

  test('.html pages advertise Early Hints and are revalidated', () => {
    const html = locations.find((l) => l.head === 'location ~* \\.html$')
    assert.match(html.body, /include \/etc\/nginx\/snippets\/blxr-early-hints\.conf;/)
    assert.match(html.body, /Cache-Control "no-cache"/)
  })

  test('hashed assets are cached for a year and immutable', () => {
    const assets = locations.find((l) => l.head === 'location ^~ /assets/')
    assert.match(assets.body, /max-age=31536000, immutable/)
  })

  test('dotfiles (except .well-known) and backup/secret-ish extensions are 404', () => {
    assert.ok(locations.some((l) => l.head === 'location ~ "/\\.(?!well-known/)"' && /return 404;/.test(l.body)))
    const ext = locations.find((l) => l.head.includes('env|map'))
    for (const e of ['env', 'map', 'bak', 'sql', 'sh', 'log', 'yml', 'toml']) assert.ok(new RegExp(ext.head.split('"')[1]).test(`/x.${e}`), e)
  })

  test('the API proxy sets the headers the server trusts', () => {
    const api = locations.find((l) => l.head === 'location /api/')
    assert.match(api.body, /proxy_set_header X-Forwarded-Proto https;/, 'drives the Secure cookie flag')
    assert.match(api.body, /proxy_set_header X-Forwarded-For (\$remote_addr|\$proxy_add_x_forwarded_for);/, 'the server keys rate limits on the last hop')
    assert.doesNotMatch(api.body, /\$http_x_forwarded_for/, 'never pass the client-supplied header through as-is')
    assert.match(api.body, /limit_req zone=blxr_api/)
    assert.match(api.body, /proxy_hide_header X-Powered-By;/)
  })

  test('legacy URL patterns redirect where the comments say', () => {
    const redirect = (url) => {
      for (const l of locations) {
        const m = /^location ~\*? "(.+)"$/.exec(l.head)
        if (!m) continue
        const hit = new RegExp(m[1]).exec(url)
        const ret = /return 301 (\S+);/.exec(l.body)
        if (hit && ret) return ret[1].replace(/\$(\d)/g, (_, k) => hit[Number(k)] ?? '').replace('$is_args$args', '')
      }
      return null
    }
    assert.equal(redirect('/projects/'), '/projects')
    assert.equal(redirect('/el/cv'), '/cv')
    assert.equal(redirect('/de'), '/')
    assert.equal(redirect('/u/some_user'), '/@some_user')
    assert.equal(redirect('/api/x/'), null, 'the API is left alone')
  })
})

describe('security headers', () => {
  test('HSTS: at least a year, subdomains, preload-ready', () => {
    const hsts = /Strict-Transport-Security "max-age=(\d+); includeSubDomains; preload"/.exec(headers)
    assert.ok(hsts && Number(hsts[1]) >= 31536000)
  })

  test('framing, sniffing, referrer, isolation and permissions are locked down', () => {
    assert.match(headers, /X-Frame-Options "DENY"/)
    assert.match(headers, /X-Content-Type-Options "nosniff"/)
    assert.match(headers, /Referrer-Policy "strict-origin-when-cross-origin"/)
    assert.match(headers, /Cross-Origin-Opener-Policy "same-origin"/)
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) assert.match(headers, new RegExp(`${feature}=\\(\\)`))
  })

  test('every header is sent on errors too (`always`)', () => {
    for (const line of headers.trim().split('\n')) assert.match(line, / always;$/, line.slice(0, 50))
  })
})

describe('Content-Security-Policy', () => {
  test('has the strict baseline directives', () => {
    assert.deepEqual(csp['default-src'], ["'self'"])
    assert.deepEqual(csp['object-src'], ["'none'"])
    assert.deepEqual(csp['base-uri'], ["'none'"])
    assert.deepEqual(csp['frame-ancestors'], ["'none'"])
    assert.deepEqual(csp['form-action'], ["'self'"])
    assert.ok('upgrade-insecure-requests' in csp)
  })

  test('scripts: no unsafe-inline/eval, inline scripts allowed only by build-time hash', () => {
    assert.ok(!csp['script-src'].includes("'unsafe-inline'"))
    assert.ok(!csp['script-src'].includes("'unsafe-eval'"))
    assert.equal(csp['script-src'].filter((s) => s === '{{SCRIPT_HASHES}}').length, 1, 'deploy.sh substitutes exactly one placeholder')
    for (const s of Object.values(csp).flat()) assert.notEqual(s, '*', 'no wildcard sources')
    for (const s of Object.values(csp).flat()) assert.ok(!s.startsWith('http:'), `insecure source ${s}`)
  })

  test('allows every origin the browser code fetches from', async () => {
    const libDir = path.join(ROOT, 'web/src/lib')
    const fetched = []
    for (const file of await readdir(libDir)) {
      if (!file.endsWith('.js')) continue
      const src = await readFile(path.join(libDir, file), 'utf8')
      if (!src.includes('fetch(')) continue
      for (const m of src.matchAll(/fetch\(\s*[`'](https:\/\/[^`'$/]+)/g)) fetched.push([file, m[1]])
      for (const m of src.matchAll(/^const [A-Z][A-Z0-9_]* =\s*\n?\s*['`](https:\/\/[^'`$]+)/gm)) fetched.push([file, m[1]])
    }
    assert.ok(fetched.length >= 3, `expected to find the known third-party fetches, found ${fetched.length}`)
    for (const [file, url] of fetched) assert.ok(hostAllowed('connect-src', url), `${file} fetches ${new URL(url).origin}, which connect-src blocks`)
  })

  test('allows the Supabase project the bundle is built against (REST + realtime + storage images)', async () => {
    const url = /^VITE_SUPABASE_URL=(.+)$/m.exec(await read('web/.env.production'))[1].trim()
    assert.ok(hostAllowed('connect-src', url))
    assert.ok(csp['connect-src'].includes(url.replace('https://', 'wss://')), 'realtime websocket')
    assert.ok(hostAllowed('img-src', url), 'avatars from storage')
  })

  test('allows the YouTube player the music widget embeds', () => {
    assert.ok(hostAllowed('script-src', 'https://www.youtube.com/iframe_api'))
    assert.ok(hostAllowed('frame-src', 'https://www.youtube.com/embed/x'))
    assert.ok(hostAllowed('img-src', 'https://i.ytimg.com/vi/x/mqdefault.jpg'), 'server-provided thumbnails')
  })
})

describe('Cloudflare real-IP', () => {
  test('trusts only well-formed Cloudflare CIDRs and reads CF-Connecting-IP', async () => {
    const cf = await read('deploy/nginx/cloudflare-realip.conf')
    const ranges = [...cf.matchAll(/set_real_ip_from\s+([^;\s]+);/g)].map((m) => m[1])
    assert.ok(ranges.length >= 20)
    for (const cidr of ranges) {
      const [ip, bits] = cidr.split('/')
      assert.ok(net.isIP(ip), cidr)
      assert.ok(Number(bits) >= 8 && Number(bits) <= (net.isIPv6(ip) ? 128 : 32), cidr)
    }
    assert.match(cf, /^real_ip_header CF-Connecting-IP;$/m)
    assert.doesNotMatch(cf, /set_real_ip_from (0\.0\.0\.0\/0|::\/0)/, 'never trust everyone')
  })
})
