import http from 'node:http'
import crypto from 'node:crypto'

const PORT = 8888
const REDIRECT = `http://127.0.0.1:${PORT}/callback`
const SCOPES = ['user-read-currently-playing', 'user-read-recently-played', 'user-top-read']

const id = (process.env.SPOTIFY_CLIENT_ID || '').trim()
const secret = (process.env.SPOTIFY_CLIENT_SECRET || '').trim()
if (!id || !secret) {
  console.error(`Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first:

  1. https://developer.spotify.com/dashboard → Create app (Web API)
  2. Add the redirect URI ${REDIRECT}
  3. SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-token.mjs`)
  process.exit(1)
}

const state = crypto.randomBytes(16).toString('hex')
const authorize = new URL('https://accounts.spotify.com/authorize')
authorize.search = new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES.join(' '), state }).toString()

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT)
  if (url.pathname !== '/callback') {
    res.writeHead(404).end()
    return
  }
  const done = (status, text) => {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }).end(text)
    server.close()
  }
  if (url.searchParams.get('state') !== state) return done(400, 'State mismatch — run the script again.')
  if (url.searchParams.get('error')) return done(400, `Spotify said: ${url.searchParams.get('error')}`)

  const token = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: REDIRECT }).toString(),
  })
  const body = await token.json().catch(() => null)
  if (!token.ok || !body?.refresh_token) {
    console.error('Token exchange failed:', token.status, body)
    return done(502, 'Token exchange failed — see the terminal.')
  }

  console.log(`
Refresh token (scopes: ${body.scope}):

${body.refresh_token}

Add three repo secrets, then push to main:

  gh secret set BLXR_SPOTIFY_CLIENT_ID
  gh secret set BLXR_SPOTIFY_CLIENT_SECRET
  gh secret set BLXR_SPOTIFY_REFRESH_TOKEN

For local runs put the same three SPOTIFY_* values in server/.env.`)
  done(200, 'Done — the refresh token is in your terminal. You can close this tab.')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Open this URL, sign in and accept:\n\n${authorize}\n`)
})
