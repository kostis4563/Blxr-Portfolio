# @blxr/server — music search proxy

Backend behind `/api/` on blxr.net. Fans search out across public mirrors,
caches results, gives the frontend one stable shape.

Zero npm dependencies — `node:http`, `node:fs`, `node:path`, `node:crypto` only.
Two files: `server.mjs` (everything) and `moderation.mjs` (the review
blocklist, see [Reviews](#reviews)).

## Running it

```bash
npm start --workspace server     # or: node server/src/server.mjs
```

Listens on `127.0.0.1:8899`. No credentials needed — see `.env.example`.

## API

All routes `GET` except `/api/hit` and `POST /api/vitals`; `/api/vitals`
and `/api/reviews` answer both verbs. Anything else: `405`. Errors:
`{ "error": "..." }` with `400` (bad review), `404` (unknown path), `429`
(review rate limit), `502` (every upstream failed) or `503` (`/api/music/top`
still resolving a cold chart, `Retry-After: 15`; or the review store is full).

Consumed by `web/src/lib/api.js` (music/hit/reviews routes) and
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
arrows. Cached 6 hours; the default chart (`us`, 10) is resolved at startup
and re-resolved before it expires, so visitors normally never wait on it.
An expired entry is served as-is while it refreshes in the background. A
cold key (no entry at all) waits at most 12s — under nginx's 15s
`proxy_read_timeout` — then answers `503` and keeps resolving. Mirrors that
error are skipped for 5 minutes so one dead host can't stall every song.

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

### `GET /api/reviews`
Every published review, newest first. Never cached (`no-store`).

```json
{ "items": [ { "id": "k3j9x2ab", "name": "Maria Kosta", "role": "CTO, Delivo",
               "rating": 5, "text": "…", "at": "2026-09-13T18:11:13.701Z" } ],
  "total": 1 }
```

### `POST /api/reviews`
Body `{ "name", "role"?, "rating", "text", "device"?, "website"? }`. Limits: `name`
2–40 chars with at least one letter, `role` up to 60, `rating` integer 1–5,
`text` 20–600. Control characters are stripped, whitespace collapsed, blank
lines capped at one. Anything that looks like a link (`http://`, `www.`,
`something.com`) in any field is refused. `website` is a honeypot: a
non-empty value answers `201` with a plausible item and stores nothing.
`device` is a 32-hex token the browser generates once and keeps in
`localStorage`; anything else is ignored.

A successful post also sets `blxr_rv`, an `HttpOnly; SameSite=Strict` cookie
scoped to `/api/reviews`, valid 3 days.

Answers `201 { "item": {…} }` or:

| Status | `error` | Meaning |
| --- | --- | --- |
| `400` | `invalid` | `fields` lists what failed |
| `400` | `link` | a URL in name, role or text |
| `400` | `blocked` | matched `BLOCKED_TERMS` in `moderation.mjs` |
| `429` | `rate_limited` | same network, device or cookie within 3 days (`Retry-After` set) |
| `429` | `busy` | more than 30 reviews site-wide in the last hour |
| `503` | `full` | 1000 reviews stored; nothing new until some are removed |

Reviews are public the moment they're accepted. There is no approval queue
and no admin panel, on purpose.

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

## Reviews

Stored in `$STATE_DIRECTORY/reviews.json`, same flush/prune cycle as the
hit counter. Each record is the public shape plus up to three salted,
truncated SHA-256 hashes (`REVIEW_SALT` in the env, a fixed default
otherwise): `ipHash` of the submitting address, `deviceHash` of the
browser's `localStorage` token, `cookieHash` of the `blxr_rv` cookie. A new
submission is refused for **3 days** if *any* of the three matches a stored
review, so one person gets one review per network, per device, per browser
profile; clearing one signal isn't enough. The hashes are dropped from the
record on the first save after the window. No raw IPs, tokens or other
identifiers are kept.

The address comes from `X-Forwarded-For`, which nginx overwrites with the
real client address (`proxy_set_header X-Forwarded-For $remote_addr`, after
the Cloudflare real-ip snippet). The server only listens on loopback, so the
header can't be spoofed from outside.

### Removing a review

There is deliberately no UI for this. `src/moderation.mjs` is the whole
control surface:

1. Find the id. Every card on `/reviews` shows it as a faint `#xxxxxxxx`
   chip (click copies it), and it's in the `mailto:` subject when someone
   asks for their own review to be changed.
2. Add it to `REMOVED_REVIEWS` in `server/src/moderation.mjs`, commit.
3. `npm run deploy:server`. On restart the server drops matching records
   from `reviews.json`, logs how many, and never issues that id again.

`BLOCKED_TERMS` in the same file refuses new submissions containing any
listed term (case- and accent-insensitive substring match). It does not
retroactively remove anything.

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

View counts in `hits.json`, Core Web Vitals histograms in `vitals.json`,
reviews in `reviews.json`. All flushed every 30s and on `SIGTERM`/`SIGINT`;
hits and vitals pruned to the last 90 days per write, reviews kept
indefinitely. Corrupt/missing file starts from zero.

All saved from one signal handler (the first listener to call
`process.exit()` ends the process, so a second handler for the same signal
never runs). Anything added later that persists to disk goes in that same
handler, next to `saveHits()`, `saveVitals()` and `saveReviews()`.

## Deploy

`deploy/blxr-search.service` is the systemd unit; keep the box's copy
identical. See [`../deploy/README.md`](../deploy/README.md).
