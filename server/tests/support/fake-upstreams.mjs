import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DIR = process.env.FAKE_UPSTREAM_DIR
if (!DIR) throw new Error('fake-upstreams: FAKE_UPSTREAM_DIR is not set')

const SCENARIO_FILE = path.join(DIR, 'scenario.json')
const CALLS_FILE = path.join(DIR, 'calls.jsonl')

const scenario = () => {
  try {
    return JSON.parse(fs.readFileSync(SCENARIO_FILE, 'utf8'))
  } catch {
    return {}
  }
}

const reply = (status, body, headers = {}) =>
  new Response(body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

const networkDown = (url) => {
  const err = new TypeError('fetch failed')
  err.cause = new Error(`fake-upstreams: no route for ${url}`)
  return err
}

const videoIdFor = (q) => crypto.createHash('sha256').update(q).digest('base64url').slice(0, 11)

const jwtSub = (authorization) => {
  try {
    const token = String(authorization || '').replace(/^Bearer /, '')
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub
  } catch {
    return null
  }
}

async function piped(url, s) {
  const delay = s.pipedDelay?.[url.origin]
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
  const mode = s.piped?.[url.origin] ?? s.piped?.all ?? 'ok'
  if (mode === 'fail') return reply(503, { error: 'down' })
  if (mode === 'empty') return reply(200, { items: [] })
  const q = url.searchParams.get('q') || ''
  if (url.searchParams.get('filter') === 'videos' && s.chartSearch !== false) {
    return reply(200, {
      items: [
        { url: '/watch?v=LIVESTREAM1', title: 'live', uploaderName: 'x', duration: -1 },
        { url: '/watch?v=bad', title: 'bad id', uploaderName: 'x', duration: 100 },
        {
          url: `/watch?v=${videoIdFor(q)}`,
          title: `Topic Artist - ${q} (Official Music Video) [4K]`,
          uploaderName: 'Topic Artist - Topic',
          duration: 200,
          views: 1234,
        },
        {
          url: `/watch?v=${videoIdFor(`${q}#2`)}`,
          title: `${q} (Lyrics)`,
          uploaderName: 'Lyric Channel',
          duration: 180,
          views: 0,
        },
      ],
    })
  }
  return reply(200, { items: [] })
}

function invidious(url, s) {
  const mode = s.invidious ?? 'ok'
  if (mode === 'fail') return reply(502, 'bad gateway')
  const q = url.searchParams.get('q') || ''
  return reply(200, [
    { videoId: videoIdFor(`inv:${q}`), title: `${q} (Audio)`, author: 'Invidious Artist', lengthSeconds: 240, viewCount: 99 },
    { videoId: 'nope', title: 'bad', author: 'x', lengthSeconds: 10 },
  ])
}

function appleRss(url, s) {
  if (s.apple === 'fail') return reply(500, { error: 'rss down' })
  const count = Number(url.pathname.split('/').at(-2)) || 10
  const songs = s.appleSongs ?? Array.from({ length: 20 }, (_, i) => ({ name: `Song ${i + 1}`, artistName: `Artist ${i + 1}` }))
  return reply(200, { feed: { title: 'Top Songs: Test', updated: '2026-09-24T00:00:00Z', results: songs.slice(0, count) } })
}

function weather(s) {
  if (s.weather === 'fail') return reply(500, { error: true })
  if (s.weather === 'garbage') return reply(200, { current: { temperature_2m: 'hot' } })
  return reply(200, { current: { temperature_2m: 21.345, weather_code: 3 } })
}

function supabase(url, init, s) {
  const headers = new Headers(init?.headers)
  if (s.supabase === 'down') return reply(503, { message: 'down' })
  if (url.pathname === '/auth/v1/user') {
    const sub = jwtSub(headers.get('authorization'))
    const user = sub && s.users?.[sub]
    if (!user) return reply(401, { message: 'invalid JWT' })
    return reply(200, user)
  }
  const del = /^\/auth\/v1\/admin\/users\/([^/]+)$/.exec(url.pathname)
  if (del && (init?.method || 'GET') === 'DELETE') {
    if (headers.get('apikey') !== process.env.SUPABASE_SECRET_KEY) return reply(401, { message: 'bad key' })
    if (s.supabaseDelete === 'fail') return reply(500, { message: 'nope' })
    return reply(200, {})
  }
  return reply(404, { message: 'not found' })
}

function resend(init, s) {
  if (s.resend === 'fail') return reply(500, { message: 'resend down' })
  return reply(200, { id: 'email_123' })
}

function github(url, init, s) {
  if (s.github === 'unauthorized') return reply(401, { message: 'Bad credentials' })
  if (s.github === 'rate_limited') return reply(403, { message: 'rate limit' })
  if (url.pathname === '/user/emails') return reply(200, [{ email: 'owner@example.com', verified: true }, { email: 'unverified@example.com', verified: false }])
  if (url.pathname !== '/graphql') return reply(404, {})
  const { query } = JSON.parse(init.body)
  const gh = s.githubData || {}
  const login = gh.login || 'octo'

  if (query.includes('viewer')) return reply(200, { data: { viewer: { login, email: 'owner@example.com' } } })

  if (query.includes('contributionYears')) {
    const days = gh.calendar || [
      { date: '2026-09-20', contributionCount: 0 },
      { date: '2026-09-21', contributionCount: 2 },
      { date: '2026-09-22', contributionCount: 3 },
      { date: '2026-09-23', contributionCount: 1 },
    ]
    return reply(200, {
      data: {
        user: {
          id: 'U_1', login, name: 'Octo Cat', avatarUrl: 'https://avatars.example/octo', url: `https://github.com/${login}`, createdAt: '2015-01-01T00:00:00Z',
          bio: '', company: '', location: 'Athens',
          followers: { totalCount: 5 }, following: { totalCount: 2 }, pullRequests: { totalCount: 7 }, issues: { totalCount: 3 }, starredRepositories: { totalCount: 9 },
          repositories: { totalCount: 2, nodes: [{ stargazerCount: 4, forkCount: 1 }, { stargazerCount: 1, forkCount: 0 }] },
          contributionsCollection: {
            contributionYears: [2026, 2025],
            totalCommitContributions: 6, totalPullRequestContributions: 1, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, restrictedContributionsCount: 2,
            contributionCalendar: { totalContributions: 6, weeks: [{ contributionDays: days }] },
          },
        },
      },
    })
  }

  if (query.includes('commitContributionsByRepository')) {
    const years = [...query.matchAll(/y(\d{4}): contributionsCollection/g)].map((m) => m[1])
    const repo = (nameWithOwner, isPrivate, typename) => ({
      nameWithOwner, name: nameWithOwner.split('/')[1], url: `https://github.com/${nameWithOwner}`, isPrivate, isFork: false, isArchived: false,
      stargazerCount: 3, pushedAt: '2026-09-23T00:00:00Z', owner: { login: nameWithOwner.split('/')[0], avatarUrl: null, __typename: typename },
      primaryLanguage: { name: isPrivate ? 'Go' : 'JavaScript', color: '#f1e05a' }, defaultBranchRef: { name: 'main' },
    })
    const user = {}
    for (const y of years) {
      user[`y${y}`] = {
        totalCommitContributions: 3, restrictedContributionsCount: 1,
        commitContributionsByRepository: [
          { repository: repo(`${login}/public-repo`, false, 'User'), contributions: { totalCount: 2 } },
          { repository: repo('secret-org/private-repo', true, 'Organization'), contributions: { totalCount: 1 } },
        ],
      }
    }
    return reply(200, { data: { user } })
  }

  if (query.includes('history(')) {
    const data = {}
    for (const m of query.matchAll(/(r\d+): repository\(owner: "([^"]+)", name: "([^"]+)"\)/g)) {
      const [, alias, , name] = m
      const nodes = name === 'public-repo'
        ? [
            { committedDate: '2026-09-22T10:00:00Z', additions: 10, deletions: 2, changedFilesIfAvailable: 1 },
            { committedDate: '2026-09-23T11:00:00Z', additions: 5, deletions: 5, changedFilesIfAvailable: 2 },
          ]
        : [{ committedDate: '2026-09-21T09:00:00Z', additions: 100, deletions: 0, changedFilesIfAvailable: 4 }]
      data[alias] = { defaultBranchRef: { target: { history: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } } }
    }
    return reply(200, { data })
  }

  if (query.includes('contributionCalendar')) {
    return reply(200, {
      data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 3, weeks: [{ contributionDays: [{ date: '2026-09-23', contributionCount: 3 }] }] } } } },
    })
  }
  return reply(200, { data: null, errors: [{ type: 'NOT_FOUND', message: 'unknown query' }] })
}

function contributionsMirror(url, s) {
  if (s.mirror === 'fail') return reply(500, {})
  return reply(200, { contributions: [{ date: '2026-09-23', count: 4, level: 2 }], total: { lastYear: 4 } })
}

const DISCORD_USER = {
  id: '80351110224678912',
  username: 'nelly',
  global_name: 'Nelly',
  avatar: '8342729096ea3675442027381ff50dfe',
  banner: null,
  accent_color: 16711680,
  discriminator: '0',
  avatar_decoration_data: { asset: 'a_fed43ab12698df65902ba06727e20c0e' },
  primary_guild: { identity_enabled: true, identity_guild_id: '1234567890123456789', tag: 'TOOLONG', badge: '0123456789abcdef0123456789abcdef' },
}

function discord(url, s) {
  const id = url.pathname.split('/').at(-1)
  if (s.discord === 'not_found' || id === '11111111111111111') return reply(404, { message: 'Unknown User', code: 10013 })
  if (s.discord === 'rate_limited') return reply(429, { message: 'slow down' })
  if (s.discord === 'fail') return reply(500, {})
  const user = { ...DISCORD_USER, id }
  return url.hostname === 'japi.rest' ? reply(200, { data: user }) : reply(200, user)
}

globalThis.fetch = async function fakeFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' ? input : input.url)
  const s = scenario()
  fs.appendFileSync(
    CALLS_FILE,
    JSON.stringify({
      method: init.method || 'GET',
      url: url.href,
      headers: Object.fromEntries(new Headers(init.headers)),
      body: typeof init.body === 'string' ? init.body : undefined,
    }) + '\n',
  )
  if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError')

  const host = url.hostname
  if (s.offline) throw networkDown(url.href)
  if (/piped|pipedapi/.test(host)) return piped(url, s)
  if (['inv.nadeko.net', 'invidious.f5.si', 'yewtu.be'].includes(host)) return invidious(url, s)
  if (host === 'rss.marketingtools.apple.com') return appleRss(url, s)
  if (host === 'api.open-meteo.com') return weather(s)
  if (host === 'supabase.test') return supabase(url, init, s)
  if (host === 'api.resend.com') return resend(init, s)
  if (host === 'api.github.com') return github(url, init, s)
  if (host === 'github-contributions-api.jogruber.de') return contributionsMirror(url, s)
  if (host === 'discord.com' || host === 'japi.rest') return discord(url, s)
  throw networkDown(url.href)
}
