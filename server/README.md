# @blxr/server — music search proxy

Backend behind `/api/` on blxr.net. Fans search out across public mirrors,
caches results, gives the frontend one stable shape.

Zero npm dependencies — `node:http`, `node:fs`, `node:path`, `node:crypto` only.
<<<<<<< Updated upstream
Two files: `server.mjs` (everything) and `moderation.mjs` (the review
blocklist, see [Reviews](#reviews)).
=======
Four files: `server.mjs` (everything), `moderation.mjs` (the review
blocklist, see [Reviews](#reviews)), `mail.mjs` (the one email the app
sends itself, see [Account mail](#account-mail)) and `log.mjs` (the event
log behind Dashboard → Logs, see [Log](#log)).
>>>>>>> Stashed changes

## Running it

```bash
npm start --workspace server     # or: node server/src/server.mjs
```

Listens on `127.0.0.1:8899`. No credentials needed — see `.env.example`.

## API

All routes `GET` except `/api/hit`, `POST /api/vitals` and
`POST /api/logs/client`; `/api/vitals` and `/api/reviews` answer both verbs,
`/api/reviews/<id>` takes `PATCH`, `/api/logs` takes `GET` and `DELETE`, and
the owner routes under `/api/reviews/panel` and `/api/reviews/invites` take
what the [panel](#review-panel) section lists. Anything else: `405`. Errors:
`{ "error": "..." }` with `400` (bad review), `401` (no panel session),
`403` (not your review, edit window over), `404` (unknown path), `410` (invite
link used or expired), `429` (review rate limit, panel login lockout), `502`
(every upstream failed) or `503` (`/api/music/top` still resolving a cold
chart, `Retry-After: 15`; reviews paused; or the review store is full).

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
| `503` | `paused` | submissions paused from the panel |
| `503` | `full` | 1000 reviews stored; nothing new until some are removed |

Reviews are public the moment they're accepted unless **Require approval** is
on in the panel, in which case they're stored `pending` and only the writer
(matched by cookie) sees their own card until it's approved.

With `invite` (a token from an invite link, below) the rate limit is skipped
and the invite is marked used; a used, expired or unknown token answers
`410 invite_used` / `invite_expired` / `invite_not_found`.

### `PATCH /api/reviews/<id>`
Same body and validation as `POST`. Allowed only from the browser that
posted the review (the `blxr_rv` cookie or the `device` token must match)
and only within **15 minutes** of `at`; otherwise `403 not_yours` /
`403 edit_window`. Answers `200 { "item": {…} }` with `editedAt` set.

### Review panel — `/api/reviews/panel…`
Backs Dashboard → Review panel on the owner's own session. Every route
accepts `Authorization: Bearer <supabase access token>` when the token's
account has the email in `SITE_OWNER_EMAIL` (defaults to `STATS_OWNER_EMAIL`;
checked against `SUPABASE_URL/auth/v1/user`, cached a minute per token).
Unauthenticated calls answer `401`.

- `GET /panel` → `{ reviews, invites, settings, stats }`. `reviews` is every
  record including hidden and pending ones, minus the hashes.
- `PATCH /panel/reviews/<id>` with any of `name`, `role`, `rating`, `text`
  (validated like a submission, sets `editedAt`), `hidden`, `pinned`,
  `pending: false` (approve), `reply` (string; empty removes it).
- `DELETE /panel/reviews/<id>` → `204`, permanent.
- `PUT /panel/settings` `{ paused, approval, blockedTerms: [] }`, stored in
  `$STATE_DIRECTORY/review-settings.json`. Blocked terms merge with
  `BLOCKED_TERMS` from `moderation.mjs`.

That is the same bearer rule Dashboard → Logs uses.

### `POST /api/logs/client`
Browser error reports from `web/src/lib/report-errors.js`. Body
`{ "message", "kind"?, "stack"?, "path"?, "detail"? }`; `kind` is `error`
(default), `rejection`, `resource` or `console`. Always `204`, body ignored
past 8 KB, at most 40 reports per address per 10 minutes (the address is
hashed for the cap and not kept). Lands in the log as source `client`.

### `GET /api/logs?levels=<l,l>&sources=<s,s>&status=<c>&since=<ms>&q=<text>&limit=<n>&before=<id>`
Dashboard → Logs. Owner only — the `Authorization: Bearer` rule above;
`401` otherwise, `503 logs_disabled` while `SITE_OWNER_EMAIL` is unset. `levels` is any of
`error`, `warn`, `info` (comma-separated; `level` works too); `sources` any
of `server`, `api`, `client`, `upstream`, `github`, `auth`, `reviews`,
`mail`; `status` an HTTP code or a class (`4xx`, `5xx`); `since` a time in
ms (events whose last occurrence is older are skipped); `q` a substring over
message, path, code, stack and detail; `limit` 0–500 (default 200),
`before` pages by id. Everything is optional and combines.

```json
{ "items": [ { "id": 41, "at": "2026-09-17T18:04:11.000Z", "last": "…", "count": 3,
               "level": "warn", "source": "api", "message": "404 not_found",
               "method": "GET", "path": "/api/nope", "status": 404, "code": "not_found",
               "stack": "…", "detail": "…", "client": "Chrome on macOS" } ],
  "matched": 120,
  "facets": { "levels": { "error": 4 }, "sources": { "api": 9 }, "statuses": { "4xx": 6, "5xx": 2 } },
  "summary": { "total": 380, "byLevel": {}, "bySource": {}, "recent": { "error": 2, "warn": 9, "info": 30, "api": 11, "client": 1 }, "lastError": "…", "oldest": "…" },
  "system": { "process": {}, "features": {}, "state": {}, "caches": {}, "mirrors": [], "reviews": {}, "chart": {} },
  "now": "…" }
```

`facets` counts what the `since` window holds by level, source and status
class, before the other filters — the numbers on the filter chips.
`system` is what the System page shows: node version, uptime and memory;
which features the env enables (booleans only, never values); the state
files with sizes; cache sizes; every search mirror and whether it is
currently skipped.

`DELETE /api/logs` (same auth) empties the log and answers `{ "removed": n }`.

### Invite links — `/api/reviews/invites`
Same owner auth as the panel (`Authorization: Bearer`).

- `POST` `{ "name", "role"?, "text"?, "rating"?, "days"? }` → `201 { "invite" }`
  with a 32-hex `token`. The link is `https://blxr.net/reviews?invite=<token>`.
  `rating` (1–5, default 5) and `days` (1–30, default 4) shape the automatic
  review.
- `GET` → every invite with `status`: `pending`, `used` (`reviewId` set),
  `auto` or `expired`.
- `DELETE /api/reviews/invites/<token>` → `204`, or `409 already_used`.
- `GET /api/reviews/invites/<token>` is **public** and returns only
  `{ name, role, status, expiresAt }`; the page uses it to prefill the form.

If an invite hasn't been used when it expires, the hourly sweep (also run at
startup) posts a review under the invite's `name` and `role` with the chosen
`rating`, using `text` if set or "Rated without leaving a written review."
otherwise, flagged `auto: true` in the API. Invited submissions skip approval
and the rate limit.

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

The panel in the dashboard hides, deletes, pins, edits and replies. Removing
by source still works and survives anything the panel does:

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
reviews in `reviews.json`, invite links in `review-invites.json`, the event
log in `logs.json`. All flushed every 30s and on `SIGTERM`/`SIGINT`;
hits and vitals pruned to the last 90 days per write, reviews kept
indefinitely. Corrupt/missing file starts from zero.

All saved from one `saveAll()` in the signal handler (the first listener to
call `process.exit()` ends the process, so a second handler for the same
signal never runs). Anything added later that persists to disk goes in
`saveAll()`, next to `saveHits()`, `saveVitals()`, `saveReviews()`,
`saveInvites()` and `saveLog()`.

## Log

`log.mjs` keeps the last 3,000 events in memory and in `logs.json`. What
goes in:

- every answer with status ≥ 400, from the `json()` helper — `warn` for 4xx,
  `error` for 5xx, with method, path (never the query string), status and
  the `error` code (source `api`);
- exceptions: the request handler's catch, `uncaughtException` (logged,
  state saved, then the process still exits so systemd restarts it) and
  `unhandledRejection` (logged, process kept) — with the stack (`server`);
- search mirrors being put on cooldown, the top-chart warm-up failing
  (`upstream`); GitHub GraphQL failures, rejected token, rate limits
  (`github`); owner authorization failures, account deletions
  (`auth`); reviews posted, invites auto-posted, moderation removals
  (`reviews`); Resend refusing a mail (`mail`); browser reports (`client`);
  start and stop (`server`).

The same event again within a minute (same level, source, message, path,
status and code) bumps `count` and `last` on the existing entry instead of
adding one, so a scanner hammering a 404 is one line. Nothing identifying
is stored: no addresses, tokens, query strings or bodies; browser reports
carry a `describeClient()` summary like "Chrome on macOS" at most.

## Deploy

`deploy/blxr-search.service` is the systemd unit; keep the box's copy
identical. See [`../deploy/README.md`](../deploy/README.md).
