#!/bin/bash
# =============================================================================
# measure_local.sh – Collect all 6 performance metrics locally
# =============================================================================
#
# USAGE (2-step):
#   Step 1 – Start backend in one terminal:
#             cd backend_django && python3 manage.py runserver 0.0.0.0:8000
#
#   Step 2 – Run this script in another terminal (from project root):
#             ./measure_local.sh
#
# No deployment needed. Works with SQLite (local) or Postgres.
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:8000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend_django"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║   SMG CampusCore – Local Performance Metrics Collector        ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Backend URL:${RESET} $BASE_URL"
echo -e "  ${BOLD}Time:${RESET}        $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── Step 0: Check backend is live ────────────────────────────────────────────
echo -e "${YELLOW}Checking backend...${RESET}"
if ! curl -sf --max-time 5 "$BASE_URL/api/health/" > /dev/null 2>&1; then
  echo ""
  echo -e "${RED}❌  Backend is NOT running at $BASE_URL${RESET}"
  echo ""
  echo "    Start it first (in another terminal):"
  echo "      cd backend_django"
  echo "      python3 manage.py runserver 0.0.0.0:8000"
  echo ""
  exit 1
fi
echo -e "${GREEN}✅  Backend is responding${RESET}"
echo ""

# ── Helper: measure TTFB (avg of N runs) ─────────────────────────────────────
measure_ttfb_ms() {
  local url="$1"
  local runs="${2:-3}"
  local total=0
  local i

  for i in $(seq 1 "$runs"); do
    result=$(curl -s --max-time 10 -w "%{time_starttransfer}" -o /dev/null "$url" 2>/dev/null || echo "0")
    ms=$(awk "BEGIN { printf \"%d\", $result * 1000 }")
    total=$(( total + ms ))
    sleep 0.2
  done

  echo $(( total / runs ))
}

# ── METRIC 1 – Warmup TTFB ───────────────────────────────────────────────────
echo -e "${BOLD}Measuring TTFB (3-run averages)...${RESET}"
echo ""

printf "  %-42s" "1. Warmup  /api/warmup/"
WARMUP_TTFB=$(measure_ttfb_ms "$BASE_URL/api/warmup/" 3)
echo -e "${GREEN}${WARMUP_TTFB}ms${RESET}"

# ── METRIC 2 – Cached endpoint (second hit of health = fastest path) ─────────
measure_ttfb_ms "$BASE_URL/api/health/" 1 > /dev/null 2>&1   # prime cache
printf "  %-42s" "2. Cached  /api/health/  (2nd hit)"
CACHED_TTFB=$(measure_ttfb_ms "$BASE_URL/api/health/" 3)
echo -e "${GREEN}${CACHED_TTFB}ms${RESET}"

# ── METRIC 3 – Uncached (authenticated endpoint returns 403 but costs work) ──
printf "  %-42s" "3. Uncached /api/notices/"
UNCACHED_TTFB=$(measure_ttfb_ms "$BASE_URL/api/notices/" 3)
echo -e "${GREEN}${UNCACHED_TTFB}ms${RESET}"

echo ""

# ── METRICS 4+5 – CPU & Memory of Django process ─────────────────────────────
echo -e "${BOLD}CPU & Memory...${RESET}"
echo ""

DJANGO_PID=$(pgrep -f "manage.py runserver" 2>/dev/null | head -1 || true)

if [[ -n "$DJANGO_PID" ]]; then
  CPU_PCT=$(ps -p "$DJANGO_PID" -o %cpu= 2>/dev/null | tr -d ' ' || echo "0")
  MEM_KB=$(ps  -p "$DJANGO_PID" -o rss=  2>/dev/null | tr -d ' ' || echo "0")
  MEM_MB=$(awk "BEGIN { printf \"%d\", $MEM_KB / 1024 }")
else
  CPU_PCT="N/A (backend not found via pgrep)"
  MEM_MB="N/A"
fi

echo -e "  4. CPU Usage:    ${GREEN}${CPU_PCT}%${RESET}  (PID: ${DJANGO_PID:-unknown})"
echo -e "  5. Memory Usage: ${GREEN}${MEM_MB}MB${RESET}  (RSS)"
echo ""

# ── METRIC 6 + query probe – via standalone Python script ────────────────────
echo -e "${BOLD}DB connections & query counts...${RESET}"
echo ""

PROBE_SCRIPT="$BACKEND_DIR/scripts/probe_queries.py"
if [[ -f "$PROBE_SCRIPT" ]]; then
  cd "$BACKEND_DIR"
  python3 "$PROBE_SCRIPT" 2>/dev/null | while IFS= read -r line; do
    echo "  $line"
  done
  cd "$SCRIPT_DIR"
else
  echo -e "  ${YELLOW}⚠️   probe_queries.py not found – skipping query counts${RESET}"
fi

echo ""

# ── Copy-paste ready block ────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════════════"
echo -e "${BOLD}📋 COPY-PASTE THIS INTO PERFORMANCE ITERATION MODE:${RESET}"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Warmup TTFB:            ${WARMUP_TTFB}ms"
echo "Cached Endpoint TTFB:   ${CACHED_TTFB}ms"
echo "Uncached Endpoint TTFB: ${UNCACHED_TTFB}ms"
echo "CPU Usage:              ${CPU_PCT}%"
echo "Memory Usage:           ${MEM_MB}MB"
echo "DB Connections Used:    (see DB output above)"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""
