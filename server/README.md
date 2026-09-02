# @blxr/server — music search proxy

Backend behind `/api/` on blxr.net. Fans search out across public mirrors,
caches results, gives the frontend one stable shape.

Zero npm dependencies — `node:http`, `node:fs`, `node:path` only.

## Running it

```bash
npm start --workspace server     # or: node server/src/server.mjs
```

Listens on `127.0.0.1:8899`. No credentials needed — see `.env.example`.

## API

All routes `GET` except `/api/hit` and `POST /api/vitals`; `/api/vitals`
answers both verbs. Anything else: `405`. Errors: `{ "error": "..." }` with
`404` (unknown path) or `502` (every upstream failed).

Consumed by `web/src/lib/api.js` (music/hit routes) and
`web/src/lib/github.js` (contributions route, which also owns the
third-party fallback). Change a param or response shape here and update
those files.

### `GET /api/music/health`
```json
{ "ok": true, "source": "youtube" }
```

### `GET /api/music/search?q=<query>&limit=<n>`
`q` trimmed, capped at 120 chars; under 2 chars returns an empty list.
`limit` clamped 1-20 (default 12).

```json
{ "items": [ { "videoId": "...", "title": "...", "subtitle": "...",
               "art": "https://i.ytimg.com/...", "duration": 213, "views": 1234567 } ] }
```

`duration <= 0` rows dropped (livestreams/malformed). Cached 60s per
`q+limit`, 200 entries max.

### `GET /api/music/top?country=<cc>&limit=<n>`
`country` 2-letter code (default `us`), `limit` clamped 1-15 (default 10).
Search shape plus chart fields, including `movement` for week-over-week
arrows. Cached 6 hours.

### `POST /api/hit`
Body `{ "path": "/projects" }`. Records one page view, answers `204` with no
body (sent via `sendBeacon`).

### `GET /api/hits`
```json
{ "total": 1234, "today": { "/": 12, "/projects": 3 }, "days": 47 }
```

### `POST /api/vitals`
Body: one measurement or a batch:

```json
[{ "m": "LCP", "v": 1840 }, { "m": "CLS", "v": 0.02 }, { "m": "INP", "v": 96 }]
```

`m` is one of `LCP`, `INP`, `CLS`, `FCP`, `TTFB`; invalid/negative/absurd `v`
dropped. Answers `204`. Sent by `web/src/lib/vitals.js` once per visit, on
page hide.

### `GET /api/vitals?days=<n>`
Field data, default last 7 days (max 90).

```json
{ "window": 7, "days": 7, "metrics": {
  "LCP": { "samples": 412, "mean": 1620, "worst": 8100,
           "good": 380, "needsImprovement": 21, "poor": 11,
           "goodShare": 0.92, "pass": true } } }
```

`pass`: Core Web Vitals rule, >=75% of visits in the good bucket.

Aggregated only: each `(day, metric)` keeps a count, sum and the three
verdict buckets. No per-visit rows.

### `GET /api/github/contributions?user=<login>&y=last|YYYY`
`user` must be a valid GitHub login (`400 bad_user` otherwise); `y` is
`last` (rolling 12 months, default) or a four-digit year from 2008
(`400 bad_year`).

```json
{ "contributions": [ { "date": "2026-07-15", "count": 69 } ],
  "total": { "lastYear": 708 } }
```

Cached 30 minutes per `(user, year)`.

**With `GITHUB_TOKEN` set**, reads GitHub's official GraphQL API (needs
`read:user` for private contributions). Without it, proxies a public mirror.
Token stays server-side. A GraphQL failure falls through to the mirror.

## Hit counter

One integer per `(date, path)`. No IP, user agent, referrer, cookie, or
identifier stored. Counts loads, not visitors.

- No consent banner needed — no personal data.
- Client honours Do Not Track / Global Privacy Control (`web/src/lib/api.js`).
- Not tamper-proof (`curl` can inflate it) — treat as a signal, not a
  measurement.
- Unknown paths, and anything past 60 distinct paths/day, collapse into
  `other`.

## Upstreams

| Purpose | Source |
| --- | --- |
| Search | Piped mirrors (`pipedapi.kavin.rocks`, `adminforge.de`, `leptons.xyz`, `api.piped.private.coffee`) |
| Search fallback | Invidious (`yewtu.be`, `inv.nadeko.net`, `invidious.f5.si`) |
| Top chart | `rss.applemarketingtools.com` |
| Artwork | `i.ytimg.com` |
| Contributions | `api.github.com` (GraphQL, only with `GITHUB_TOKEN`) |
| Contributions fallback | `github-contributions-api.jogruber.de` |

All keyless and public. Playback itself doesn't go through here — browser
loads YouTube's IFrame API directly (`web/src/lib/youtube-engine.js`).

## State

Chart-rank history: `$STATE_DIRECTORY/chart-history.json`
(`/var/lib/blxr-search/` under systemd). Cold start has no baseline,
`movement` is `null`.

View counts in `hits.json`, Core Web Vitals histograms in `vitals.json`.
Both flushed every 30s and on `SIGTERM`/`SIGINT`, pruned to last 90 days per
write. Corrupt/missing file starts from zero.

Both saved from one signal handler (the first listener to call
`process.exit()` ends the process, so a second handler for the same signal
never runs). Anything added later that persists to disk goes in that same
handler, next to `saveHits()` and `saveVitals()`.

## Deploy

`deploy/blxr-search.service` is the systemd unit; keep the box's copy
identical. See [`../deploy/README.md`](../deploy/README.md).
