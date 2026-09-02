#!/usr/bin/env bash
set -euo pipefail

OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cloudflare-realip.conf"

{
  curl -fsS https://www.cloudflare.com/ips-v4 | sed 's/^/set_real_ip_from /; s/$/;/'
  curl -fsS https://www.cloudflare.com/ips-v6 | sed 's/^/set_real_ip_from /; s/$/;/'
  echo
  echo "real_ip_header CF-Connecting-IP;"
} > "$OUT"

echo "wrote $OUT ($(grep -c set_real_ip_from "$OUT") ranges)"
