#!/usr/bin/env bash
set -euo pipefail

# Full, reproducible setup for the FarsNews crawler using Docker Compose
# - Builds and starts services
# - Waits for Postgres and app health checks
# - Verifies required tables exist
# - Ensures webdrivers are installed
#
# Usage:
#   bash scripts/full-setup.sh            # uses docker-compose.yml
#   COMPOSE_FILE=docker-compose.ir.yml bash scripts/full-setup.sh  # for Iran-sanctioned servers

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE_PATH="${COMPOSE_FILE:-docker-compose.yml}"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[OK]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[1;31m[ERR ]\033[0m $*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    exit 1
  fi
}

require_cmd docker
require_cmd docker-compose || true

info "Using compose file: $COMPOSE_FILE_PATH"

# 1) Build and start services
info "Bringing down any existing stack..."
docker-compose -f "$COMPOSE_FILE_PATH" down || true

info "Building and starting services in detached mode..."
docker-compose -f "$COMPOSE_FILE_PATH" up --build -d

# 2) Wait for Postgres health
info "Waiting for Postgres to become healthy..."
PG_CONTAINER="farsnews_postgres"
retries=60
until docker ps --format '{{.Names}} {{.Status}}' | grep -q "^${PG_CONTAINER} .*healthy"; do
  ((retries--)) || { err "Postgres did not become healthy in time"; docker ps; exit 1; }
  sleep 2
  info "Waiting for ${PG_CONTAINER} health..."
done
ok "Postgres is healthy"

# 3) Wait for crawler health endpoint
info "Waiting for crawler health endpoint..."
CRAWLER_CONTAINER="farsnews-crawler"
CRAWLER_URL="http://localhost:3004/api/health"
retries=60
until docker exec "$CRAWLER_CONTAINER" wget -q -O- "$CRAWLER_URL" >/dev/null 2>&1; do
  ((retries--)) || { err "Crawler health endpoint did not respond in time"; docker logs "$CRAWLER_CONTAINER" --tail=200; exit 1; }
  sleep 2
  info "Waiting for crawler health..."
done
ok "Crawler health endpoint is responding"

# 4) Verify required tables exist
info "Verifying database schema..."
PSQL="docker exec -e PGPASSWORD=crawler_user $PG_CONTAINER psql -U crawler_user -d farsnews_crawler_spider_db -t -c"

required_tables=(
  "news_sources"
  "articles"
  "schedules"
  "crawl_history"
  "crawl_logs"
  "performance_metrics"
  "queue_jobs"
  "admin_users"
)

missing=()
for tbl in "${required_tables[@]}"; do
  if ! $PSQL "SELECT to_regclass('public.${tbl}');" | grep -q "public.${tbl}"; then
    missing+=("$tbl")
  fi
done

if ((${#missing[@]} > 0)); then
  err "Missing tables: ${missing[*]}"
  err "Database did not initialize correctly. Check Postgres logs and init SQL mounting."
  exit 1
fi
ok "All required tables exist"

# 5) Ensure webdrivers are installed and available
info "Ensuring Playwright Chromium is installed in the container..."
if ! docker exec "$CRAWLER_CONTAINER" npx playwright --version >/dev/null 2>&1; then
  warn "Playwright CLI not reporting version. Attempting installation..."
  docker exec "$CRAWLER_CONTAINER" bash -lc "npx playwright install chromium"
fi
ok "Playwright ready: $(docker exec "$CRAWLER_CONTAINER" npx playwright --version 2>/dev/null || echo 'unknown')"

# 6) Final diagnostics
ok "Setup completed successfully"

cat <<EOT

Endpoints:
- App:        http://localhost:3004
- Admin:      http://localhost:3004/admin
- PgAdmin:    http://localhost:8080 (admin@example.com / admin123)

Containers:
$(docker ps --format '  - {{.Names}}: {{.Status}}')

Tips:
- Use the Iran-optimized compose file: COMPOSE_FILE=docker-compose.ir.yml bash scripts/full-setup.sh
- View crawler logs: docker logs -f farsnews-crawler
- Stop stack:         docker-compose -f "$COMPOSE_FILE_PATH" down
EOT 