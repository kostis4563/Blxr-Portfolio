import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url))
const PORT = Number(process.env.E2E_PORT) || 4174

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
}

const isFile = async (file) => (await stat(file).catch(() => null))?.isFile() ?? false

async function resolve(pathname) {
  if (/^\/@[a-z0-9_]{3,20}\/?$/.test(pathname)) return path.join(DIST, 'profile.html')
  const base = path.join(DIST, path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, ''))
  if (!base.startsWith(DIST.replace(/\/$/, ''))) return null
  for (const candidate of [base, `${base}.html`, path.join(base, 'index.html')]) {
    if (await isFile(candidate)) return candidate
  }
  return null
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  if (pathname.startsWith('/api/')) {
    res.writeHead(503, { 'content-type': 'application/json' })
    return res.end('{"error":"offline"}')
  }
  const file = await resolve(pathname)
  const served = file || path.join(DIST, '404.html')
  res.writeHead(file ? 200 : 404, { 'content-type': TYPES[path.extname(served)] || 'application/octet-stream' })
  res.end(req.method === 'HEAD' ? undefined : await readFile(served))
}).listen(PORT, '127.0.0.1', () => console.log(`e2e: serving ${DIST} on http://127.0.0.1:${PORT}`))
