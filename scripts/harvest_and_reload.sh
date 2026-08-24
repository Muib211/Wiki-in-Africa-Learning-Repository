#!/usr/bin/env bash
# Harvest fresh data from the Wiki In Africa Wikibase, then tell the running
# Flask app to reload it into memory. Meant to be run on a schedule (see
# README.md for the Toolforge job setup) rather than by hand.
#
# Required environment variables:
#   APP_URL             Base URL of the running app, e.g.
#                        https://wikiinafrica-resources.toolforge.org
#   ADMIN_RELOAD_TOKEN   Must match the value app.py was started with.
#                        Leave both unset only for local development.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

APP_URL="${APP_URL:-http://localhost:5000}"

echo "[$(date -u +%FT%TZ)] Starting harvest..."
python3 harvest_wikiinafrica_resources.py --pretty

echo "[$(date -u +%FT%TZ)] Harvest complete. Triggering reload at ${APP_URL}/admin/reload ..."
if [ -n "${ADMIN_RELOAD_TOKEN:-}" ]; then
  curl -sf -X POST "${APP_URL}/admin/reload" -H "X-Admin-Token: ${ADMIN_RELOAD_TOKEN}"
else
  curl -sf -X POST "${APP_URL}/admin/reload"
fi

echo
echo "[$(date -u +%FT%TZ)] Done."
