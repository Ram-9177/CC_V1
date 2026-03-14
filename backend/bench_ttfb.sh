#!/bin/bash
# =============================================================================
# bench_ttfb.sh – Time-To-First-Byte (TTFB) Performance Benchmark
# =============================================================================
#
# USAGE:
#   ./backend/bench_ttfb.sh [BASE_URL]
#
# ENVIRONMENT VARIABLES:
#   BASE_URL    Base URL of the deployed backend  (default: from env or arg)
#   THRESHOLD   Max acceptable TTFB in seconds     (default: 1.0)
#
# EXAMPLES:
#   # Test production Render deployment
#   BASE_URL=https://campuscore-api.onrender.com ./backend/bench_ttfb.sh
#
#   # Test locally (quick smoke test)
#   BASE_URL=http://localhost:8000 THRESHOLD=0.5 ./backend/bench_ttfb.sh
#
#   # Pass base URL as first argument
#   ./backend/bench_ttfb.sh https://campuscore-api.onrender.com
#
# CI NOTE:
#   Set BASE_URL as a GitHub Actions secret (RENDER_BACKEND_URL) to avoid
#   hardcoding the production URL in this file.
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
# BASE_URL: prefer env var, then first CLI arg, then fail with a clear message
BASE_URL="${BASE_URL:-${1:-}}"
THRESHOLD="${THRESHOLD:-1.0}"          # seconds – override via env
MAX_RETRIES="${MAX_RETRIES:-2}"        # retries per endpoint before marking fail
RETRY_DELAY="${RETRY_DELAY:-2}"        # seconds between retries

if [[ -z "$BASE_URL" ]]; then
  echo "❌  ERROR: BASE_URL is not set."
  echo "    Set the BASE_URL environment variable or pass it as the first argument."
  echo "    Example: BASE_URL=https://your-backend.onrender.com ./backend/bench_ttfb.sh"
  exit 1
fi

# Strip trailing slash for consistent URL construction
BASE_URL="${BASE_URL%/}"

# ── Endpoints to benchmark ────────────────────────────────────────────────────
# Format: "path|friendly_name"
ENDPOINTS=(
  "/api/health/|Health Check"
  "/api/|API Root"
  "/api/rooms/|Rooms List"
  "/api/notices/|Notices List"
  "/api/gate-passes/|Gate Passes"
)

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Utility: measure TTFB for a single URL ────────────────────────────────────
# Returns the time_starttransfer value from curl.
# On network error (non-zero exit) the function returns a non-zero exit code.
measure_ttfb() {
  local url="$1"
  curl \
    --silent \
    --max-time 15 \
    --write-out "%{time_starttransfer}" \
    --output /dev/null \
    --location \
    "$url"
}

# ── Utility: compare two floats using awk ─────────────────────────────────────
float_gt() {
  awk -v a="$1" -v b="$2" 'BEGIN { exit !(a > b) }'
}

# ── Pre-benchmark Warmup ──────────────────────────────────────────────────────
# Send an unmeasured foreground request to the health endpoint to absorb
# the heavy cold-start initialization penalty (Render container boot,
# Django ORM setup, DB connection pooling) before the 1.0s TTFB assertions begin.
echo ""
echo "⏳ Warming up the API securely (absorbing cold boot penalty)..."
# Use the aggressive warmup endpoint that touches DB + Cache + ORM
curl --silent --output /dev/null --location "${BASE_URL}/api/warmup/" || true
# Second hit as a safety gap for Render's free tier slow-provisioning
curl --silent --output /dev/null --location "${BASE_URL}/api/warmup/" || true
sleep 2

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║         SMG CampusCore ERP – TTFB Performance Benchmark       ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Base URL  :${RESET} $BASE_URL"
echo -e "  ${BOLD}Threshold :${RESET} ${THRESHOLD}s"
echo -e "  ${BOLD}Timestamp :${RESET} $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""
printf "%-35s %-12s %-10s %s\n" "Endpoint" "TTFB (s)" "Status" "Notes"
echo "────────────────────────────────────────────────────────────────────────"

# ── Main benchmark loop ────────────────────────────────────────────────────────
OVERALL_PASS=true
PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()    # stores formatted result lines for the summary

for entry in "${ENDPOINTS[@]}"; do
  # Split "path|name" on the pipe character
  IFS='|' read -r PATH_SUFFIX FRIENDLY_NAME <<< "$entry"
  FULL_URL="${BASE_URL}${PATH_SUFFIX}"

  SUCCESS=false
  TTFB=""
  ATTEMPT=0

  # ── Retry loop ──────────────────────────────────────────────────────────────
  while [[ $ATTEMPT -le $MAX_RETRIES ]]; do
    ATTEMPT=$(( ATTEMPT + 1 ))
    TTFB=$(measure_ttfb "$FULL_URL" 2>/dev/null) || {
      if [[ $ATTEMPT -gt $MAX_RETRIES ]]; then
        TTFB="ERROR"
        break
      fi
      sleep "$RETRY_DELAY"
      continue
    }
    SUCCESS=true
    break
  done

  # ── Evaluate result ─────────────────────────────────────────────────────────
  if [[ "$SUCCESS" == false || "$TTFB" == "ERROR" ]]; then
    STATUS_ICON="❌"
    STATUS_TEXT="FAIL"
    NOTES="Network error after ${MAX_RETRIES} retries"
    OVERALL_PASS=false
    FAIL_COUNT=$(( FAIL_COUNT + 1 ))
    COLOR="$RED"
    TTFB="N/A"
  elif float_gt "$TTFB" "$THRESHOLD"; then
    STATUS_ICON="❌"
    STATUS_TEXT="FAIL"
    NOTES="Exceeds ${THRESHOLD}s threshold"
    OVERALL_PASS=false
    FAIL_COUNT=$(( FAIL_COUNT + 1 ))
    COLOR="$RED"
  else
    STATUS_ICON="✅"
    STATUS_TEXT="PASS"
    NOTES=""
    PASS_COUNT=$(( PASS_COUNT + 1 ))
    COLOR="$GREEN"
  fi

  # Print structured row
  printf "${COLOR}%-35s %-12s %-10s %s${RESET}\n" \
    "$FRIENDLY_NAME ($PATH_SUFFIX)" \
    "$TTFB" \
    "${STATUS_ICON} ${STATUS_TEXT}" \
    "$NOTES"

  # Store for machine-readable summary
  RESULTS+=("$FRIENDLY_NAME|$TTFB|$STATUS_TEXT")
done

# ── Summary footer ─────────────────────────────────────────────────────────────
TOTAL=$(( PASS_COUNT + FAIL_COUNT ))
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo -e "  ${BOLD}Results:${RESET} ${GREEN}${PASS_COUNT} passed${RESET} / ${RED}${FAIL_COUNT} failed${RESET} out of ${TOTAL} endpoints"
echo -e "  ${BOLD}Threshold:${RESET} ${THRESHOLD}s per endpoint"
echo ""

# ── Exit code ─────────────────────────────────────────────────────────────────
if [[ "$OVERALL_PASS" == true ]]; then
  echo -e "${GREEN}${BOLD}✅  All endpoints within performance threshold. CI PASSED.${RESET}"
  echo ""
  exit 0
else
  echo -e "${RED}${BOLD}❌  Performance regression detected! One or more endpoints exceeded ${THRESHOLD}s TTFB.${RESET}"
  echo -e "${YELLOW}    ➜  Check Render cold-start times, DB query optimisation, or temporarily"
  echo -e "       disable this job by setting SKIP_PERF_BENCHMARK=true in CI env vars.${RESET}"
  echo ""
  exit 1
fi
