#!/usr/bin/env bash
# Lightweight benchmarking script: measures TTFB and total time for a URL
# Usage: ./scripts/bench.sh https://your-service/endpoint
URL=${1:-http://127.0.0.1:8000/}

curl -s -o /dev/null -w "TTFB:%{time_starttransfer}s Total:%{time_total}s\n" "$URL"
