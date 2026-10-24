#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a local disposable database ending in _test}"
: "${DATA_ENCRYPTION_KEY:?Set DATA_ENCRYPTION_KEY (base64 of 32 bytes)}"
: "${BACKEND_SERVICE_TOKEN:?Set BACKEND_SERVICE_TOKEN}"
: "${BETTER_AUTH_SECRET:?Set BETTER_AUTH_SECRET}"
: "${PRIVACY_CONTROLLER_NAME:?Set privacy notice values}"
: "${PRIVACY_CONTACT_EMAIL:?Set privacy notice values}"

node - "$TEST_DATABASE_URL" <<'NODE'
const u = new URL(process.argv[2]);
if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname) || !u.pathname.endsWith('_test')) {
  throw new Error('Refusing smoke test: TEST_DATABASE_URL must point at a local *_test database');
}
NODE

WEB_PORT="${SMOKE_WEB_PORT:-3300}"
BACKEND_PORT="${SMOKE_BACKEND_PORT:-8380}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
BASE_URL="http://127.0.0.1:${WEB_PORT}"
TEMP_DIR="$(mktemp -d)"
EMAIL_A="rust-smoke-$(date +%s)-a@example.test"
EMAIL_B="rust-smoke-$(date +%s)-b@example.test"
PASSWORD="Smoke-test-password-$(date +%s)!"
PID_BACKEND=""
PID_WEB=""

cleanup() {
  local status=$?
  set +e
  if [[ "$status" != 0 ]]; then
    [[ -f "$TEMP_DIR/backend.log" ]] && cat "$TEMP_DIR/backend.log" >&2
    [[ -f "$TEMP_DIR/web.log" ]] && cat "$TEMP_DIR/web.log" >&2
  fi
  for pair in "a:$EMAIL_A" "b:$EMAIL_B"; do
    jar="$TEMP_DIR/cookie-${pair%%:*}.txt"
    [[ -s "$jar" ]] && curl -sS -b "$jar" -H 'Origin: http://localhost' -H 'Content-Type: application/json' \
      --data "{\"password\":\"$PASSWORD\"}" "$BASE_URL/api/auth/delete-user" >/dev/null
  done
  [[ -n "$PID_WEB" ]] && kill "$PID_WEB" 2>/dev/null
  [[ -n "$PID_BACKEND" ]] && kill "$PID_BACKEND" 2>/dev/null
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT INT TERM

export DATABASE_URL="$TEST_DATABASE_URL" BACKEND_SERVICE_TOKEN DATA_ENCRYPTION_KEY
export BACKEND_BIND_ADDRESS="127.0.0.1:${BACKEND_PORT}"
pnpm --dir "$ROOT/cashflowkub" db:deploy

(cd "$ROOT" && cargo run --manifest-path backend/Cargo.toml) >"$TEMP_DIR/backend.log" 2>&1 &
PID_BACKEND=$!
BACKEND_URL="$BACKEND_URL" DATABASE_URL="$TEST_DATABASE_URL" BETTER_AUTH_URL="$BASE_URL" \
  BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" BACKEND_SERVICE_TOKEN="$BACKEND_SERVICE_TOKEN" \
  DATA_ENCRYPTION_KEY="$DATA_ENCRYPTION_KEY" PRIVACY_CONTROLLER_NAME="$PRIVACY_CONTROLLER_NAME" \
  PRIVACY_CONTACT_EMAIL="$PRIVACY_CONTACT_EMAIL" \
  pnpm --dir "$ROOT/cashflowkub" exec next dev --hostname 127.0.0.1 --port "$WEB_PORT" >"$TEMP_DIR/web.log" 2>&1 &
PID_WEB=$!

for _ in $(seq 1 60); do
  if ! kill -0 "$PID_BACKEND" 2>/dev/null; then cat "$TEMP_DIR/backend.log" >&2; exit 1; fi
  if ! kill -0 "$PID_WEB" 2>/dev/null; then cat "$TEMP_DIR/web.log" >&2; exit 1; fi
  curl -fsS "$BACKEND_URL/internal/health" >/dev/null 2>&1 && curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "$BACKEND_URL/internal/health" >/dev/null
curl -fsS "$BASE_URL/api/health" >/dev/null

signup() {
  local email="$1" jar="$2"
  curl -fsS -c "$jar" -H "Origin: $BASE_URL" -H 'Content-Type: application/json' \
    --data "{\"name\":\"Smoke test\",\"email\":\"$email\",\"password\":\"$PASSWORD\",\"privacyVersion\":\"2026-10-19\"}" \
    "$BASE_URL/api/auth/sign-up/email" >/dev/null
}
signup "$EMAIL_A" "$TEMP_DIR/cookie-a.txt"
signup "$EMAIL_B" "$TEMP_DIR/cookie-b.txt"

curl -fsS -b "$TEMP_DIR/cookie-a.txt" -H 'Content-Type: application/json' \
  --data '{"name":"Smoke account","balance":0}' "$BASE_URL/api/v1/accounts" >"$TEMP_DIR/create.json"
grep -q 'Smoke account' "$TEMP_DIR/create.json"
curl -fsS -b "$TEMP_DIR/cookie-b.txt" "$BASE_URL/api/v1/accounts" >"$TEMP_DIR/list.json"
if grep -q 'Smoke account' "$TEMP_DIR/list.json"; then
  echo 'Tenant isolation failed: second user saw the first user account' >&2
  exit 1
fi
STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "$BACKEND_URL/api/v1/accounts")"
[[ "$STATUS" == 401 ]] || { echo "Direct unauthenticated Rust call returned $STATUS, expected 401" >&2; exit 1; }

echo 'Rust backend smoke test passed: Next.js gateway, authenticated read/write, tenant isolation, and private service auth.'
