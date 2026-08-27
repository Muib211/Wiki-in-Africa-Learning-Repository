#!/usr/bin/env bash
# Harvest fresh data from the Wiki In Africa Wikibase, then tell the running
# Flask app to reload it into memory. Meant to be run on a schedule (see
# README.md for the Toolforge job setup) rather than by hand.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

APP_URL="${APP_URL:-http://localhost:5000}"

# Activate the venv so `python3` can find requests, flask, etc. -- job
# containers start with a bare system Python otherwise, which is what
# caused "ModuleNotFoundError: No module named 'requests'" the first time.
source "$HOME/www/python/venv/bin/activate"

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
