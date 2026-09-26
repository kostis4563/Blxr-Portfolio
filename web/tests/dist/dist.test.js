import { describe, test, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync, brotliDecompressSync, gzipSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { staticPaths, PROFILE_SHELL_FILE } from '../../src/lib/router.js'
import { metaFor } from '../../src/lib/seo.js'

const WEB = fileURLToPath(new URL('../..', import.meta.url))
const DIST = path.join(WEB, 'dist')
const read = (rel) => readFileSync(path.join(DIST, rel), 'utf8')
const has = (rel) => existsSync(path.join(DIST, rel))

function walk(dir, base = '') {
  return readdirSync(dir).flatMap((name) => {
    const rel = path.posix.join(base, name)
    return statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name), rel) : [rel]
  })
}

const PAGES = { ...Object.fromEntries(staticPaths().map((p) => [p, p === '/' ? 'index.html' : `${p.slice(1)}.html`])), '/404': '404.html', '/login': 'login.html', '/dashboard': 'dashboard.html', '/@': PROFILE_SHELL_FILE }
const SHELLS = new Set(['/dashboard', '/@'])
const SITE = 'https://blxr.net'

function served(url) {
  const clean = decodeURI(url.split('#')[0].split('?')[0])
  if (!clean || clean === '/') return true
  if (clean.startsWith('/api/')) return true
  if (/^\/@[a-z0-9_]{3,20}\/?$/.test(clean)) return true
  return has(clean.slice(1)) || has(`${clean.slice(1)}.html`)
}

let files
beforeAll(() => {
  if (!existsSync(path.join(DIST, 'index.html'))) throw new Error('web/dist is missing — run `npm run build` first')
  files = walk(DIST)
})

describe('pages', () => {
  test('every route is prerendered to the file nginx looks for', () => {
    for (const [route, file] of Object.entries(PAGES)) expect(has(file), `${route} → ${file}`).toBe(true)
  })

  describe.each(Object.entries(PAGES))('%s', (route, file) => {
    const html = () => read(file)

    test('document basics: doctype, lang, charset, viewport, one title and description', () => {
      const h = html()
      expect(h.trimStart().slice(0, 15).toLowerCase()).toBe('<!doctype html>')
      expect(h).toMatch(/<html lang="en" dir="ltr" data-entry>/)
      expect(h).toMatch(/<meta charset="utf-8"/i)
      expect(h).toMatch(/<meta name="viewport" content="[^"]*width=device-width/)
      expect(h.match(/<title>/g)).toHaveLength(1)
      expect(h.match(/<meta name="description"/g)).toHaveLength(1)
    })

    test('prerendered content (not an empty shell) for public pages', () => {
      const body = /<div id="root">([\s\S]*?)<\/div><!--email_on-->/.exec(html())?.[1] ?? ''
      if (SHELLS.has(route)) return
      expect(body.length).toBeGreaterThan(1000)
      expect(html().match(/<h1[\s>]/g), 'exactly one h1').toHaveLength(1)
    })

    test('no leaked placeholders in visible text', () => {
      const text = html().replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
      for (const junk of ['undefined', 'NaN', '[object Object]', 'null null']) expect(text, junk).not.toContain(junk)
    })

    test('CSP-safe markup: no inline handlers, no javascript: URLs', () => {
      expect(html()).not.toMatch(/\son[a-z]+=["']/i)
      expect(html()).not.toMatch(/(href|src|action)=["']\s*javascript:/i)
    })

    test('every local src/href/srcset resolves', () => {
      const h = html()
      const urls = [
        ...[...h.matchAll(/\s(?:src|href|poster)="(\/[^"]*)"/g)].map((m) => m[1]),
        ...[...h.matchAll(/\s(?:srcset|imagesrcset)="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0])).filter((u) => u.startsWith('/')),
        ...[...h.matchAll(/content="https:\/\/blxr\.net(\/[^"]+\.(?:png|webp|jpg))"/g)].map((m) => m[1]),
      ]
      expect(urls.filter((u) => !served(u))).toEqual([])
    })

    test('images have alt text; external new-tab links cannot reach window.opener', () => {
      const h = html()
      expect((h.match(/<img\b[^>]*>/g) || []).filter((tag) => !/\salt=/.test(tag))).toEqual([])
      expect((h.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []).filter((tag) => !/rel="[^"]*(noopener|noreferrer)/.test(tag))).toEqual([])
    })

    test('no duplicate element ids', () => {
      const ids = [...html().matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
    })

    test('canonical and robots agree with the route metadata', () => {
      const h = html()
      const { noindex } = metaFor(route)
      if (noindex || SHELLS.has(route) || route === '/404') return
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(h)?.[1]
      expect(canonical).toBe(`${SITE}${route}`)
    })
  })
})

describe('Content-Security-Policy hashes', () => {
  test('every inline executable script in every page has its hash listed', () => {
    const listed = new Set(readFileSync(path.join(WEB, 'csp-script-hashes.txt'), 'utf8').trim().split(/\s+/))
    const missing = []
    for (const file of files.filter((f) => f.endsWith('.html'))) {
      for (const [, attrs, body] of read(file).matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (/type=["']?application\/ld\+json/.test(attrs)) continue
        const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`
        if (!listed.has(hash)) missing.push(`${file}: ${hash}`)
      }
    }
    expect(missing).toEqual([])
    expect(listed.size).toBeGreaterThan(0)
  })

  test('JSON-LD blocks parse', () => {
    for (const file of files.filter((f) => f.endsWith('.html'))) {
      for (const [, json] of read(file).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        expect(() => JSON.parse(json), file).not.toThrow()
      }
    }
  })
})

describe('JavaScript and CSS', () => {
  test('every chunk import resolves to a file in dist/assets', () => {
    const missing = []
    for (const file of files.filter((f) => /^assets\/.*\.js$/.test(f))) {
      const code = read(file)
      for (const [, spec] of code.matchAll(/(?:import|from)\s*\(?\s*["'](\.{1,2}\/[^"']+\.js|\/assets\/[^"']+\.js)["']/g)) {
        const target = spec.startsWith('/') ? spec.slice(1) : path.posix.join(path.posix.dirname(file), spec)
        if (!has(target)) missing.push(`${file} → ${spec}`)
      }
    }
    expect(missing).toEqual([])
  })

  test('CSS url() references resolve', () => {
    const missing = []
    for (const file of files.filter((f) => f.endsWith('.css'))) {
      for (const [, url] of read(file).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
        if (/^(data:|https?:|#)/.test(url)) continue
        const target = url.startsWith('/') ? url.slice(1) : path.posix.join(path.posix.dirname(file), url)
        if (!has(target.split(/[?#]/)[0])) missing.push(`${file} → ${url}`)
      }
    }
    expect(missing).toEqual([])
  })

  test('no eval / new Function (the CSP has no unsafe-eval, so they would throw)', () => {
    for (const file of files.filter((f) => f.endsWith('.js'))) {
      expect(read(file), file).not.toMatch(/(^|[^.\w$])eval\(|new Function\(/)
    }
  })

  test('Early Hints only advertise files that exist in this build', () => {
    const hints = readFileSync(path.join(WEB, 'early-hints.conf'), 'utf8')
    const urls = [...hints.matchAll(/<(\/[^>]+)>/g)].map((m) => m[1])
    expect(urls.length).toBeGreaterThan(3)
    for (const url of urls) expect(has(url.slice(1)), url).toBe(true)
  })

  const entryAssets = () => [...read('index.html').matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])

  test('first-load budget: entry JS + CSS under 160 KB gzipped', () => {
    const total = entryAssets().reduce((sum, url) => sum + gzipSync(readFileSync(path.join(DIST, url))).length, 0)
    expect(total / 1024).toBeLessThan(160)
  })

  test('supabase-js is not part of the first load', () => {
    for (const url of entryAssets().filter((u) => u.endsWith('.js'))) {
      expect(read(url.slice(1)), url).not.toMatch(/GoTrueClient|RealtimeClient|PostgrestClient|supabase\.co\/auth/)
    }
    expect(files.some((f) => /^assets\/supabase-[\w-]+\.js$/.test(f)), 'a separate supabase chunk exists').toBe(true)
  })

  test('only the homepage preloads the weather, and as a low-priority fetch', () => {
    expect(read('index.html')).toContain('<link rel="preload" href="/api/weather" as="fetch" crossorigin="anonymous" fetchpriority="low" />')
    for (const file of files.filter((f) => f.endsWith('.html') && f !== 'index.html')) expect(read(file), file).not.toContain('/api/weather')
  })

  test('no lazy chunk over 150 KB gzipped', () => {
    for (const file of files.filter((f) => /^assets\/.*\.js$/.test(f))) {
      expect(gzipSync(readFileSync(path.join(DIST, file))).length / 1024, file).toBeLessThan(150)
    }
  })
})

describe('crawlers', () => {
  test('sitemap lists every indexable page once, on the apex, with valid lastmod', () => {
    const xml = read('sitemap.xml')
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(new Set(locs).size).toBe(locs.length)
    const expected = staticPaths().filter((p) => !metaFor(p).noindex).map((p) => `${SITE}${p}`)
    expect(locs.sort()).toEqual(expected.sort())
    for (const [, d] of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Date.parse(d)).toBeLessThanOrEqual(Date.now())
    }
  })

  test('robots.txt allows the site, blocks the API and points at the sitemap', () => {
    const robots = read('robots.txt')
    expect(robots).toMatch(/^Sitemap: https:\/\/blxr\.net\/sitemap\.xml$/m)
    expect(robots).toMatch(/^Disallow: \/api\/$/m)
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m)
  })

  test('web manifest is valid and its icons exist', () => {
    const manifest = JSON.parse(read('site.webmanifest'))
    for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) expect(manifest[key], key).toBeTruthy()
    for (const icon of manifest.icons) expect(has(icon.src.slice(1)), icon.src).toBe(true)
    expect(manifest.icons.some((i) => i.sizes === '512x512'), 'a 512px icon for installs').toBe(true)
  })
})

describe('what ships (and what must not)', () => {
  test('precompressed .gz/.br files decompress to exactly the original', () => {
    for (const file of files.filter((f) => /\.(gz|br)$/.test(f))) {
      const original = readFileSync(path.join(DIST, file.replace(/\.(gz|br)$/, '')))
      const packed = readFileSync(path.join(DIST, file))
      const unpacked = file.endsWith('.gz') ? gunzipSync(packed) : brotliDecompressSync(packed)
      expect(unpacked.equals(original), file).toBe(true)
    }
  })

  test('large text assets are precompressed', () => {
    const big = files.filter((f) => /\.(html|css|js|svg|xml|json)$/.test(f) && statSync(path.join(DIST, f)).size > 4096)
    expect(big.filter((f) => !files.includes(`${f}.gz`))).toEqual([])
  })

  test('no source maps, env files, SSR leftovers or dotfiles', () => {
    expect(files.filter((f) => /\.map$|(^|\/)\.env|(^|\/)\.[^/]+$|dist-ssr/.test(f))).toEqual([])
    expect(existsSync(path.join(WEB, 'dist-ssr')), 'prerender removes dist-ssr').toBe(false)
  })

  test('no server-side secrets in any shipped file', () => {
    const patterns = [/sb_secret_[A-Za-z0-9_-]{10,}/, /"role":"service_role"|cm9sZSI6InNlcnZpY2Vfcm9sZS/, /\bghp_[A-Za-z0-9]{36}\b/, /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}/]
    const hits = []
    for (const file of files.filter((f) => /\.(html|js|css|json|txt|xml|webmanifest)$/.test(f))) {
      const text = read(file)
      for (const re of patterns) if (re.test(text)) hits.push(`${file}: ${re}`)
    }
    expect(hits).toEqual([])
  })
})
