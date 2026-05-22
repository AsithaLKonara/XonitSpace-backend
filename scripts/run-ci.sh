#!/bin/bash
set -euo pipefail

echo "================================================"
echo "🚀 XONIT SPACE CI GATE INITIALIZATION"
echo "================================================"

if [ -z "${CI_MODE:-}" ]; then
  echo "❌ FAIL: CI_MODE must be set to 'EXTERNAL' or 'SELF_CONTAINED'."
  exit 1
fi

if [ "$CI_MODE" = "SELF_CONTAINED" ]; then
  echo "Bootstrapping isolated infrastructure..."
  docker-compose -f docker-compose.test.yml up -d
fi

# Run the strict production gate
echo "Executing Node.js Production Gate..."
set +e
npx ts-node --transpile-only scripts/production-gate.ts
EXIT_CODE=$?
set -e

if [ "$CI_MODE" = "SELF_CONTAINED" ]; then
  echo "Tearing down ephemeral infrastructure..."
  docker-compose -f docker-compose.test.yml down -v
  
  # Prune to avoid phantom DB state leaks and volume locks
  docker system prune -f || true
  sleep 2
fi

# Pass the final exit code back to CI
exit $EXIT_CODE
