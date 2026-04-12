#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend_django"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
COLLEGE_CODE="${COLLEGE_CODE:-SMG}"
TARGET_STUDENTS="${TARGET_STUDENTS:-100}"
RUN_TESTS="${RUN_TESTS:-1}"
RUN_TYPECHECK="${RUN_TYPECHECK:-1}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python"
fi

echo "============================================================"
echo " Full App Medium Cycle (Non-Destructive)"
echo " College: $COLLEGE_CODE"
echo " Target Students: $TARGET_STUDENTS"
echo " Python: $PYTHON_BIN"
echo "============================================================"

echo "[1/8] Django system check"
cd "$BACKEND_DIR"
"$PYTHON_BIN" manage.py check

echo "[2/8] RBAC seed"
"$PYTHON_BIN" manage.py seed_rbac

echo "[3/8] College module seed"
"$PYTHON_BIN" manage.py seed_college_modules --college "$COLLEGE_CODE"

echo "[4/8] Core role test users seed"
"$PYTHON_BIN" manage.py seed_test_users --college-code "$COLLEGE_CODE"

echo "[5/8] Ensure medium student volume"
CURRENT_STUDENTS=$("$PYTHON_BIN" manage.py shell -c "from apps.auth.models import User; from apps.colleges.models import College; c=College.objects.get(code='$COLLEGE_CODE'); print(User.objects.filter(role='student', is_active=True, college=c).count())")
if [[ "$CURRENT_STUDENTS" -lt "$TARGET_STUDENTS" ]]; then
  TO_CREATE=$((TARGET_STUDENTS - CURRENT_STUDENTS))
  echo "  Current: $CURRENT_STUDENTS, creating: $TO_CREATE"
  "$PYTHON_BIN" manage.py seed_bulk_students --college-code "$COLLEGE_CODE" --count "$TO_CREATE"
else
  echo "  Current: $CURRENT_STUDENTS, no additional students needed"
fi

echo "[6/8] Feature data seed"
"$PYTHON_BIN" manage.py seed_full_test_data --college-code "$COLLEGE_CODE" --student-count "$TARGET_STUDENTS"

echo "[7/8] Backend smoke + integration"
if [[ "$RUN_TESTS" == "1" ]]; then
  "$PYTHON_BIN" -m pytest tests/api tests/integration -q
else
  echo "  Skipped backend tests (RUN_TESTS=$RUN_TESTS)"
fi

echo "[8/8] Frontend strict typecheck"
if [[ "$RUN_TYPECHECK" == "1" ]]; then
  cd "$ROOT_DIR"
  npm run -s typecheck:strict:pilot
else
  echo "  Skipped frontend typecheck (RUN_TYPECHECK=$RUN_TYPECHECK)"
fi

echo "============================================================"
echo " Medium cycle completed successfully"
echo "============================================================"
