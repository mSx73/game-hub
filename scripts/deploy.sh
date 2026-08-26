#!/usr/bin/env bash
# Production deploy runbook script (Sprint Q).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> npm ci"
npm ci

echo "==> Tests"
npm test

echo "==> Spec + lint"
npm run check:spec
npm run lint

echo "==> Build web"
npm run build:web
npm run check:bundle

NGINX_CONF="/etc/nginx/sites-available/games-hub"
REPO_NGINX="$ROOT/infra/nginx-games-443.conf"

if [ -f "$NGINX_CONF" ]; then
  if ! diff -q "$REPO_NGINX" "$NGINX_CONF" >/dev/null 2>&1; then
    echo "WARNING: nginx config differs from repo — review before reload"
  fi
  sudo nginx -t
  sudo systemctl reload nginx || sudo nginx -s reload
fi

if command -v pm2 >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env || pm2 restart games-api games-ws
fi

if [ -f "$ROOT/scripts/verify-deploy.mjs" ]; then
  node "$ROOT/scripts/verify-deploy.mjs" || echo "Deploy verify failed — check manually"
fi

echo "Deploy complete."
