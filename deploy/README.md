# Deploying blxr

The repo holds the source of truth; `/etc` and `/opt` on the box are install
targets, not places to edit directly.

```
repo                                  live box
web/dist/                        ->   /var/www/blxr/            (nginx root)
server/src/server.mjs            ->   /opt/blxr-search/server.mjs
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
  it. `deploy.sh nginx` alone requires a prior `npm run build`.
- **Deploy web + nginx together.** `blxr.conf` 404s missing files;
  `try_files $uri $uri.html` only works once the build's pages exist.
  `npm run deploy` runs both in the right order.
- **`/de/` (trailing slash) and `/en/...` need explicit 301s** in
  `blxr.conf` — everything else resolves through `try_files`. Check after any
  config edit:
  ```bash
  curl -sI https://blxr.net/de/ | head -1
  curl -sI https://blxr.net/en/projects | head -1
  curl -s https://blxr.net/de | grep -o '<html[^>]*>'
  curl -s https://blxr.net/ar | grep -o '<html[^>]*>'
  ```
- **Build is ~1500 files** (13 routes x 32 languages, `.gz` + `.br` twins,
  ~32 MB). First deploy after a routing change moves a lot more files than
  usual.
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
5. `Always Use HTTPS` on. Origin already sends HSTS with `preload`.

Keep these **off** — they break this site:

| Feature | Why |
| --- | --- |
| Rocket Loader | Rewrites/injects inline `<script>`; CSP only allows inline scripts by sha256 hash. |
| Auto Minify (HTML) | Changes the bytes of the inline theme script, breaking its CSP hash. |
| Email Obfuscation | Same failure mode, different injected script. |

Brotli, Early Hints, edge caching: fine, worth having.

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

Zone is at GoDaddy (`ns37/ns38.domaincontrol.com`), moving to Cloudflare.

**Order matters:**

1. DNSSEC only after nameservers move to Cloudflare, and only enabled there.
   Enabling at GoDaddy first, then moving nameservers, publishes a DS record
   pointing at the wrong signing keys — the zone stops resolving entirely.
2. CAA only after Cloudflare is live, listing Cloudflare's current CAs plus
   `letsencrypt.org` (certbot here uses http-01 via nginx/webroot).

### Mail

No MX record, no mail agent on the box, nothing sends mail (contact is a
`mailto:` link). Correct records for a domain that sends nothing:

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
