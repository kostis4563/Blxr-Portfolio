# Deploying blxr

The repo holds the source of truth; `/etc` and `/opt` on the box are install
targets, not places to edit directly.

```
repo                                  live box
web/dist/                        ->   /var/www/blxr/            (nginx root)
server/src/server.mjs            ->   /opt/blxr-search/server.mjs
server/src/moderation.mjs        ->   /opt/blxr-search/moderation.mjs
server/deploy/blxr-search.service -> /etc/systemd/system/blxr-search.service
deploy/nginx/blxr.conf           ->   /etc/nginx/sites-available/blxr
deploy/nginx/blxr-security-headers.conf -> /etc/nginx/snippets/...
```

## Deploy

```bash
npm run deploy            # everything
npm run deploy:web        # frontend only
npm run deploy:server     # backend only
DRY_RUN=1 npm run deploy  # show the plan, touch nothing
```

`deploy:web` builds first.

## Known traps

- **Nothing changed after deploy.** `index.html` is served `no-cache`
  (`blxr.conf`, `location ~* \.html$`), so a normal reload should pick up a
  new build. If not, check that block is still intact.
- **Security headers disappear.** Any `location` block with its own
  `add_header` drops every inherited header. `blxr.conf` re-includes the
  security-headers snippet in each such block; a new `add_header` anywhere
  needs the same treatment.
- **CSP hashes are generated, not hand-written.**
  `blxr-security-headers.conf` has a `{{SCRIPT_HASHES}}` placeholder;
  `prerender.js` writes `web/csp-script-hashes.txt`, `deploy.sh` substitutes
  it. `deploy.sh nginx` alone requires a prior `npm run build`. Only
  executable inline scripts are hashed (today: the pre-paint theme script in
  `index.html`); the per-page JSON-LD blocks never run and are skipped. A CSP
  violation for a script that isn't in the repo is Cloudflare injecting one —
  see the table below.
- **Deploy web + nginx together.** `blxr.conf` 404s missing files;
  `try_files $uri $uri.html` only works once the build's pages exist.
  `npm run deploy` runs both in the right order.
- **Old language prefixes 301 to the plain path.** The site used to be
  served under `/de/…`, `/el/…` and 30 other prefixes; those URLs may still be
  indexed, so `blxr.conf` folds them back. Check after any config edit:
  ```bash
  curl -sI https://blxr.net/de/ | head -1
  curl -sI https://blxr.net/en/projects | head -1
  curl -sI https://blxr.net/ar | head -1
  ```
- **`/api/` is rate-limited at the edge.** `blxr.conf` declares
  `limit_req_zone`/`limit_conn_zone` at the top of the file, which only
  works because `sites-enabled/*` is included from nginx's `http` block.
  `nginx -t` fails with *"limit_req_zone" directive is not allowed here* if
  that include ever moves. The finer per-route buckets live in the Node
  server (`server/README.md` → Security).
- **Dotfiles and `*.env|map|sql|…` under the web root answer 404** from
  `blxr.conf`, whatever lands there. `.well-known/` is the exception.
- **`/api/` must outrank the catch-all** — true today because nginx matches
  the longest prefix regardless of block order; would need attention if
  `/api/` ever became a regex location.
- **Compression is per-vhost.** Global `nginx.conf` only compresses
  `text/html`; the `gzip_types` list for JS/CSS lives in `blxr.conf`.
  ```bash
  curl -sI -H 'Accept-Encoding: gzip' https://blxr.net/assets/<app>.js | grep -i content-encoding
  ```

## Cloudflare

Live since 2026-08-14 (`curl -sI https://blxr.net/ | grep -i '^server'` ->
`cloudflare`). Needed because nginx 1.24 on Ubuntu has no QUIC module.

Setup:

1. Add `blxr.net` to Cloudflare, point the registrar at its nameservers.
2. `A blxr.net -> <box IP>`, `A www -> <same>`, proxy **on**.
3. SSL/TLS: **Full (strict)**.
4. Speed: HTTP/3 (QUIC) on (default).
5. `Always Use HTTPS` on. SSL/TLS -> Edge Certificates -> HSTS on as well,
   matching the origin header (12 months, includeSubDomains, preload).
   The origin's header never reaches anyone who gets the challenge below;
   Cloudflare's goes on the challenge page too, which is the page
   hstspreload.org's checker gets for `/`. Check:
   `curl -sI https://blxr.net/ | grep -i strict-transport` shows it even on
   the 403.
6. SSL/TLS -> Edge Certificates: **Minimum TLS Version 1.2**, TLS 1.3 on.
   The default is 1.0, and visitors only ever handshake with Cloudflare, so
   the origin's `options-ssl-nginx.conf` doesn't help here. Check:
   `openssl s_client -connect blxr.net:443 -tls1 -cipher 'DEFAULT:@SECLEVEL=0'`
   must fail.

External scanners hit the challenge below, so the CSP, missing HSTS, missing
`Cache-Control`, `server-timing` and 403 they report all describe
Cloudflare's challenge page, not ours. So does any "SSRF via `?url=`" hit:
`/` is a static file and nginx ignores the query.

Keep these **off** — they break this site:

| Feature | Why |
| --- | --- |
| Rocket Loader | Rewrites/injects inline `<script>`; CSP only allows inline scripts by sha256 hash. |
| Auto Minify (HTML) | Changes the bytes of the inline theme script, breaking its CSP hash. |
| Email Obfuscation | Same failure mode, different injected script. |
| Bot Fight Mode / JavaScript Detections (Security -> Bots, Security -> Settings) | Injects an inline `window.__CF$cv$params` script carrying the request's ray ID, so no hash can ever match it; the console shows a CSP violation on every page load and the detection never runs anyway. It also challenges GitHub-hosted runners on every path (assets and `/api/` included), and custom rules can't skip it, so `live-scan` gets nothing but 403s. Check: `curl -s https://blxr.net/nope.htm \| grep -c 'CF\$cv'` must print `0`. |

Brotli, Early Hints, edge caching: fine, worth having.

Web Analytics (the `static.cloudflareinsights.com/beacon.min.js` tag) is
also fine: it is an external script, so the CSP allows it by origin
(`script-src` for the tag, `connect-src https://cloudflareinsights.com` for
the RUM post). Turn it off in Cloudflare and both entries can go.

### Challenge before the site

Every visitor gets Cloudflare's own "Verify you are human" page before any
page loads. Security -> WAF -> Custom rules -> Create rule, action **Managed
Challenge**, expression (Edit expression):

```
ssl and (http.request.uri.path.extension eq "" or http.request.uri.path.extension eq "html") and not starts_with(http.request.uri.path, "/api/") and not starts_with(http.request.uri.path, "/.well-known/") and not cf.client.bot and not any(http.request.headers["x-blxr-scan"][*] eq "<BLXR_SCAN_TOKEN>")
```

- `ssl` leaves plain HTTP alone, so `http://` gets the `Always Use HTTPS`
  301 instead of a 403 challenge. Without it, hstspreload.org reports
  "No redirect from HTTP".
- Pages only (no extension, or `.html`). Assets, `robots.txt`, `sitemap.xml`,
  the manifest and the OG image stay open; once a visitor passes, the
  `cf_clearance` cookie covers the rest anyway.
- `/api/` is excluded: `fetch()` calls can't solve a challenge.
- `/.well-known/` is excluded: certbot's http-01 renewal must reach nginx.
- `cf.client.bot` lets verified crawlers and link-preview bots (Google,
  Discord, Slack, X) through, so search and embeds keep working.
- The challenge is its own page, not something injected into ours (unlike
  Bot Fight Mode above), so the CSP is unaffected.
- The `x-blxr-scan` clause lets deploy.yml's `live-scan` job through
  (`npm run test:live` and ZAP both send it). Its value is the
  `BLXR_SCAN_TOKEN` repo secret. Write the header name in lowercase:
  Cloudflare lowercases the keys of `http.request.headers`, so
  `["X-Blxr-Scan"]` never matches. That job runs on GitHub-hosted runners,
  so you can't exclude it by IP.
- The `curl` checks below get the challenge page (`cf-mitigated: challenge`)
  instead of ours unless they send `-H 'x-blxr-scan: <token>'`.

### Early Hints

Speed -> Optimization -> Early Hints (off by default, origin can't enable it
remotely). Origin side ships with every build: `prerender.js` writes
`web/early-hints.conf` from the build's render-blocking assets, `deploy.sh`
installs it, `blxr.conf` includes it from the `\.html$` location.

```bash
curl -sI https://blxr.net/ | grep -i '^link:'
curl -sI --http2 https://blxr.net/ | head -1   # 103 before the 200
```

If `deploy.sh web` warns the installed snippet names a different build: run
`deploy.sh nginx`.

The hints spell out `crossorigin=anonymous`. A bare `crossorigin` in a Link
header is not reliably read as anonymous, and a preload whose CORS mode
doesn't match the real fetch (the stylesheet `<link>` and `@font-face` both
fetch in CORS mode) is never matched to it: Chrome logs "preloaded using link
preload but not used" once for the 103 and once for the 200 Link header, and
downloads the file again.

Verify after any Cloudflare change:

```bash
curl -sI https://blxr.net/ | grep -i alt-svc
curl -sI https://blxr.net/ | grep -i content-security
curl -s https://blxr.net/ | grep -c rocket-loader   # must be 0
curl -sI https://blxr.net/assets/<hashed>.js | grep -i cf-cache-status
```

Real visitor IPs: `deploy/nginx/cloudflare-realip.conf` ->
`/etc/nginx/snippets/blxr-cloudflare-realip.conf`, trusted only from
Cloudflare's ranges. Regenerate with
`bash deploy/nginx/fetch-cloudflare-ips.sh` if Cloudflare changes them.

Not done: locking ufw to Cloudflare's ranges only — certbot's http-01
renewal needs the box reachable directly.

## DNS

Zone is on Cloudflare (`maya/norm.ns.cloudflare.com`); the registrar is
still GoDaddy.

1. DNSSEC: Cloudflare -> DNS -> Settings -> **Enable DNSSEC**, then paste the
   DS record it shows into GoDaddy -> domain -> DNS -> DNSSEC. Only ever
   enable it on Cloudflare's side: a DS record made anywhere else points at
   the wrong signing keys and the zone stops resolving entirely.
2. CAA: Cloudflare's Universal SSL CAs plus `letsencrypt.org` (certbot here
   uses http-01 via nginx/webroot). No `issuewild`: the Universal SSL
   certificate covers `*.blxr.net`.

```dns
blxr.net.  CAA  0 issue "letsencrypt.org"
blxr.net.  CAA  0 issue "pki.goog"
blxr.net.  CAA  0 issue "ssl.com"
blxr.net.  CAA  0 iodef "mailto:kostisnomikos@gmail.com"
```

### Mail

No MX record, no mail agent on the box. Outbound mail (account emails) goes
through Resend — DNS records and Supabase's SMTP form are in
[`supabase/README.md`](supabase/README.md); the one mail the Node server
sends itself needs `RESEND_API_KEY` in `/etc/blxr-search.env`. Contact is
still a `mailto:` link.

Resend's SPF lives on `send.blxr.net` (the Return-Path), and DMARC passes
on its DKIM (`resend._domainkey`, `d=blxr.net`), so the bare domain never
sends and needs its own SPF that says so. The DMARC record imported from
GoDaddy sends reports to GoDaddy (`onsecureserver.net`); point them back
here:

```dns
blxr.net.         TXT  "v=spf1 -all"
_dmarc.blxr.net.  TXT  "v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:kostisnomikos@gmail.com"
```

If mail is ever dropped again, the records for a domain that sends nothing
are:

```dns
blxr.net.                TXT  "v=spf1 -all"
*._domainkey.blxr.net.   TXT  "v=DKIM1; p="
_dmarc.blxr.net.         TXT  "v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:<your address>"
```

MTA-STS/TLS-RPT (receiving mail) and BIMI (needs a paid VMC) don't apply
here.

## Certificates

Certbot renews `blxr.net` automatically via `/.well-known/acme-challenge/`,
served over plain HTTP. `deploy.sh` excludes `.well-known` from the
`--delete` rsync.
