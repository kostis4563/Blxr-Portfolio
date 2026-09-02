#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"
DRY_RUN="${DRY_RUN:-0}"

WEB_ROOT=/var/www/blxr
SERVER_ROOT=/opt/blxr-search
UNIT=/etc/systemd/system/blxr-search.service
NGINX_SITE=/etc/nginx/sites-available/blxr
NGINX_SNIPPET=/etc/nginx/snippets/blxr-security-headers.conf
NGINX_HINTS_SNIPPET=/etc/nginx/snippets/blxr-early-hints.conf
NGINX_CF_SNIPPET=/etc/nginx/snippets/blxr-cloudflare-realip.conf

run() {
  if [[ "$DRY_RUN" == "1" ]]; then printf '  [dry-run] %s\n' "$*"; else "$@"; fi
}
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

need_root() {
  if [[ $EUID -ne 0 && "$DRY_RUN" != "1" ]]; then
    echo "error: '$TARGET' needs root (writes to $SERVER_ROOT / /etc)." >&2
    exit 1
  fi
}

deploy_web() {
  step "Building frontend"
  ( cd "$ROOT" && npm run build )

  step "Syncing web/dist/ -> $WEB_ROOT"
  run rsync -a --delete --exclude '.well-known' "$ROOT/web/dist/" "$WEB_ROOT/"

  check_csp_hashes
  check_early_hints
}

check_csp_hashes() {
  local hashes_file="$ROOT/web/csp-script-hashes.txt"
  [[ -f "$hashes_file" && -f "$NGINX_SNIPPET" ]] || return 0

  local missing=0 hash
  for hash in $(tr -d "'" < "$hashes_file"); do
    grep -qF "$hash" "$NGINX_SNIPPET" || missing=1
  done

  if [[ "$missing" == "1" ]]; then
    printf '\n\033[1;33m!! the deployed CSP does not list every inline script in this build.\033[0m\n'
    printf '   The pre-paint theme script will be blocked, and light-theme visitors\n'
    printf '   will see a flash of the dark palette. Fix with:\n\n'
    printf '       bash deploy/deploy.sh nginx\n\n'
  fi
}

check_early_hints() {
  local hints_file="$ROOT/web/early-hints.conf"
  [[ -f "$hints_file" && -f "$NGINX_HINTS_SNIPPET" ]] || return 0
  cmp -s "$hints_file" "$NGINX_HINTS_SNIPPET" && return 0

  printf '\n\033[1;33m!! the deployed Early Hints name a different build than this one.\033[0m\n'
  printf '   nginx is advertising asset URLs that no longer exist, so every\n'
  printf '   visitor pays for a 404 per hinted file. Fix with:\n\n'
  printf '       bash deploy/deploy.sh nginx\n\n'
}

deploy_server() {
  need_root
  step "Installing server -> $SERVER_ROOT"
  run install -D -m 0644 "$ROOT/server/src/server.mjs" "$SERVER_ROOT/server.mjs"

  step "Installing systemd unit"
  run install -m 0644 "$ROOT/server/deploy/blxr-search.service" "$UNIT"
  run systemctl daemon-reload
  run systemctl restart blxr-search

  run sleep 1
  step "Health check"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  [dry-run] curl -fsS http://127.0.0.1:8899/api/music/health"
  else
    curl -fsS http://127.0.0.1:8899/api/music/health && echo
  fi
}

deploy_nginx() {
  need_root
  step "Installing nginx config"
  run install -m 0644 "$ROOT/deploy/nginx/blxr.conf" "$NGINX_SITE"
  run install -m 0644 "$ROOT/deploy/nginx/cloudflare-realip.conf" "$NGINX_CF_SNIPPET"

  local hashes_file="$ROOT/web/csp-script-hashes.txt"
  if [[ ! -f "$hashes_file" ]]; then
    echo "error: $hashes_file is missing — run 'npm run build' before deploying nginx." >&2
    echo "       (the CSP needs the inline-script hashes from that build)" >&2
    exit 1
  fi
  local hashes
  hashes="$(cat "$hashes_file")"
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '  [dry-run] install security-headers snippet with %s hash(es)\n' "$(wc -w <<< "$hashes")"
  else
    sed "s|{{SCRIPT_HASHES}}|$hashes|" "$ROOT/deploy/nginx/blxr-security-headers.conf" \
      > "$NGINX_SNIPPET"
    chmod 0644 "$NGINX_SNIPPET"
  fi

  local hints_file="$ROOT/web/early-hints.conf"
  if [[ ! -f "$hints_file" ]]; then
    echo "error: $hints_file is missing — run 'npm run build' before deploying nginx." >&2
    echo "       (nginx includes it from the .html location and will fail to start" >&2
    echo "        without it, which is deliberate: silently serving no Early Hints" >&2
    echo "        is the failure that goes unnoticed for months)" >&2
    exit 1
  fi
  run install -m 0644 "$hints_file" "$NGINX_HINTS_SNIPPET"

  step "Testing nginx config"
  run nginx -t
  run systemctl reload nginx
}

case "$TARGET" in
  web)    deploy_web ;;
  server) deploy_server ;;
  nginx)  deploy_nginx ;;
  all)    deploy_web; deploy_server; deploy_nginx ;;
  *) echo "usage: $0 [all|web|server|nginx]" >&2; exit 2 ;;
esac

step "Done."
