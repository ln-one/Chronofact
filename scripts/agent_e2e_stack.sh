#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION="${CHRONOFACT_E2E_TMUX_SESSION:-chronofact-e2e}"
POSTGRES_CONTAINER="${CHRONOFACT_E2E_POSTGRES_CONTAINER:-chronofact-limora-postgres}"
POSTGRES_PORT="${CHRONOFACT_E2E_POSTGRES_PORT:-55432}"
LIMORA_PORT="${LIMORA_PORT:-3002}"
CHRONOFACT_API_PORT="${CHRONOFACT_API_PORT:-3001}"
CHRONOFACT_AGENT_PORT="${CHRONOFACT_AGENT_PORT:-3003}"
FRONTEND_PORT="${FRONTEND_PORT:-5176}"
FRONTEND_ORIGIN="http://127.0.0.1:${FRONTEND_PORT}"
LIMORA_URL="http://127.0.0.1:${LIMORA_PORT}"
CHRONOFACT_API_URL="http://127.0.0.1:${CHRONOFACT_API_PORT}"
CHRONOFACT_AGENT_URL="http://127.0.0.1:${CHRONOFACT_AGENT_PORT}"
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${POSTGRES_PORT}/limora"
CHRONESTIA_URL="${CHRONOFACT_CHRONESTIA_URL:-http://127.0.0.1:${CHRONESTIA_PORT:-8080}}"

usage() {
  cat <<EOF
Usage: $0 up|down|status|logs

Environment overrides:
  FRONTEND_PORT=${FRONTEND_PORT}
  LIMORA_PORT=${LIMORA_PORT}
  CHRONOFACT_API_PORT=${CHRONOFACT_API_PORT}
  CHRONOFACT_AGENT_PORT=${CHRONOFACT_AGENT_PORT}
  CHRONOFACT_E2E_POSTGRES_PORT=${POSTGRES_PORT}
  CHRONOFACT_E2E_WITH_CHRONESTIA=1
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "OK ${label}: ${url}"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for ${label}: ${url}" >&2
  return 1
}

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
    sleep 1
  fi
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill -9 $pids 2>/dev/null || true
  fi
}

start_postgres() {
  require_cmd docker
  docker info >/dev/null
  if docker ps -a --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
    docker start "$POSTGRES_CONTAINER" >/dev/null
  else
    docker run -d \
      --name "$POSTGRES_CONTAINER" \
      -e POSTGRES_USER=postgres \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=limora \
      -p "${POSTGRES_PORT}:5432" \
      postgres:16-alpine >/dev/null
  fi
  for _ in $(seq 1 60); do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U postgres -d limora >/dev/null 2>&1; then
      echo "OK Postgres: 127.0.0.1:${POSTGRES_PORT}"
      return 0
    fi
    sleep 1
  done
  docker logs "$POSTGRES_CONTAINER" >&2
  exit 1
}

start_chronestia_if_requested() {
  if [[ "${CHRONOFACT_E2E_WITH_CHRONESTIA:-1}" != "1" ]]; then
    echo "Chronestia disabled; Chronofact API will use local adapter."
    return 0
  fi

  if python3 "$ROOT_DIR/scripts/compose_smart.py" up -d chronestia >/dev/null 2>&1; then
    if wait_for_url "${CHRONESTIA_URL}/healthz" "Chronestia" 45; then
      export CHRONOFACT_CHRONESTIA_URL="$CHRONESTIA_URL"
      return 0
    fi
  fi

  echo "Chronestia unavailable; Chronofact API will use local adapter." >&2
  unset CHRONOFACT_CHRONESTIA_URL
}

up() {
  require_cmd tmux
  require_cmd npm
  require_cmd pnpm
  require_cmd curl
  require_cmd lsof

  mkdir -p "$ROOT_DIR/.cache/e2e-logs"
  start_postgres
  start_chronestia_if_requested

  DATABASE_URL="$DATABASE_URL" npm --prefix "$ROOT_DIR/services/limora" run prisma:push
  npm --prefix "$ROOT_DIR/services/limora" run build

  tmux kill-session -t "$SESSION" 2>/dev/null || true
  kill_port "$LIMORA_PORT"
  kill_port "$CHRONOFACT_API_PORT"
  kill_port "$CHRONOFACT_AGENT_PORT"
  kill_port "$FRONTEND_PORT"

  tmux new-session -d -s "$SESSION" -n limora \
    "cd '$ROOT_DIR/services/limora' && PORT='$LIMORA_PORT' DATABASE_URL='$DATABASE_URL' BETTER_AUTH_SECRET='chronofact-local-dev-secret-32bytes-minimum' LIMORA_PUBLIC_BASE_URL='$LIMORA_URL' BETTER_AUTH_URL='$LIMORA_URL' LIMORA_ALLOWED_HOSTS='127.0.0.1:${LIMORA_PORT},127.0.0.1,localhost:${LIMORA_PORT},localhost' LIMORA_TRUSTED_ORIGINS='$FRONTEND_ORIGIN,http://localhost:${FRONTEND_PORT},$CHRONOFACT_AGENT_URL,$CHRONOFACT_API_URL' LIMORA_COOKIE_MODE='local' LIMORA_RATE_LIMIT_ENABLED=false node dist/src/server.js"

  local api_env="PORT='$CHRONOFACT_API_PORT' CHRONOFACT_LIMORA_URL='$LIMORA_URL' CHRONOFACT_CORS_ORIGIN='$FRONTEND_ORIGIN'"
  if [[ -n "${CHRONOFACT_CHRONESTIA_URL:-}" ]]; then
    api_env="${api_env} CHRONOFACT_CHRONESTIA_URL='${CHRONOFACT_CHRONESTIA_URL}'"
  fi
  tmux new-window -t "$SESSION" -n api \
    "cd '$ROOT_DIR/services/chronofact-api' && $api_env npm start"

  tmux new-window -t "$SESSION" -n agent \
    "cd '$ROOT_DIR/services/chronofact-agent' && set -a && . ../../.env.local && set +a && PORT='$CHRONOFACT_AGENT_PORT' CHRONOFACT_API_URL='$CHRONOFACT_API_URL' CHRONOFACT_AGENT_LIMORA_URL='$LIMORA_URL' CHRONOFACT_AGENT_CORS_ORIGIN='$FRONTEND_ORIGIN' npm start"

  tmux new-window -t "$SESSION" -n frontend \
    "cd '$ROOT_DIR/services/frontend' && VITE_LIMORA_API_URL='$LIMORA_URL' VITE_CHRONOFACT_AGENT_API_URL='$CHRONOFACT_AGENT_URL' pnpm dev --host 127.0.0.1 --port '$FRONTEND_PORT'"

  wait_for_url "${LIMORA_URL}/health/live" "Limora"
  wait_for_url "${CHRONOFACT_API_URL}/health" "Chronofact API"
  wait_for_url "${CHRONOFACT_AGENT_URL}/health" "Chronofact Agent"
  wait_for_url "${FRONTEND_ORIGIN}/agent" "Frontend"

  echo
  echo "Chronofact E2E stack is running in tmux session '${SESSION}'."
  echo "Frontend: ${FRONTEND_ORIGIN}/agent"
  echo "Logs: tmux attach -t ${SESSION}"
}

down() {
  tmux kill-session -t "$SESSION" 2>/dev/null || true
  kill_port "$LIMORA_PORT"
  kill_port "$CHRONOFACT_API_PORT"
  kill_port "$CHRONOFACT_AGENT_PORT"
  kill_port "$FRONTEND_PORT"
  if [[ "${CHRONOFACT_E2E_STOP_POSTGRES:-0}" == "1" ]]; then
    docker rm -f "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [[ "${CHRONOFACT_E2E_STOP_CHRONESTIA:-0}" == "1" ]]; then
    python3 "$ROOT_DIR/scripts/compose_smart.py" down >/dev/null 2>&1 || true
  fi
  echo "Chronofact E2E stack stopped."
}

status() {
  tmux list-windows -t "$SESSION" 2>/dev/null || echo "tmux session '${SESSION}' is not running"
  lsof -nP \
    -iTCP:"$LIMORA_PORT" \
    -iTCP:"$CHRONOFACT_API_PORT" \
    -iTCP:"$CHRONOFACT_AGENT_PORT" \
    -iTCP:"$FRONTEND_PORT" \
    -sTCP:LISTEN 2>/dev/null || true
  docker ps --filter "name=${POSTGRES_CONTAINER}" --format '{{.Names}} {{.Status}} {{.Ports}}' 2>/dev/null || true
}

logs() {
  tmux attach -t "$SESSION"
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  status) status ;;
  logs) logs ;;
  *) usage; exit 1 ;;
esac
