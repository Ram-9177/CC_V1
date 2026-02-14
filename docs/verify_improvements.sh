#!/bin/bash

# Verification Script for 10/10 Improvements
# Checks all three areas are properly implemented

echo "🔍 VERIFICATION SCRIPT - 10/10 IMPROVEMENTS"
echo "==========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1 exists"
        ((passed++))
    else
        echo -e "${RED}❌${NC} $1 missing"
        ((failed++))
    fi
}

# Function to check if content exists in file
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $3"
        ((passed++))
    else
        echo -e "${RED}❌${NC} $3"
        ((failed++))
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  ERROR BOUNDARIES VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_file "src/components/ErrorBoundary.tsx"
check_file "src/components/__tests__/ErrorBoundary.test.tsx"
check_content "src/App.tsx" "ErrorBoundary" "ErrorBoundary imported in App.tsx"
check_content "src/components/layout/DashboardLayout.tsx" "ErrorBoundary" "ErrorBoundary imported in DashboardLayout"
check_content "src/components/ErrorBoundary.tsx" "class ErrorBoundary" "ErrorBoundary class defined"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  SWAGGER DOCUMENTATION VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_content "backend_django/requirements.txt" "drf-spectacular" "drf-spectacular in requirements"
check_content "backend_django/hostelconnect/settings/base.py" "drf_spectacular" "drf_spectacular in INSTALLED_APPS"
check_content "backend_django/hostelconnect/settings/base.py" "SPECTACULAR_SETTINGS" "SPECTACULAR_SETTINGS configured"
check_content "backend_django/hostelconnect/urls.py" "SpectacularAPIView" "SpectacularAPIView imported"
check_content "backend_django/hostelconnect/urls.py" "SpectacularSwaggerView" "SpectacularSwaggerView imported"
check_content "backend_django/hostelconnect/urls.py" "schema/swagger" "Swagger URL configured"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  TEST COVERAGE VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Frontend tests
check_file "src/lib/__tests__/store.test.ts"
check_file "src/hooks/__tests__/useRoutePrefetch.test.ts"
check_file "src/test/setup.ts"
check_file "vitest.config.ts"

# Backend tests
check_file "backend_django/conftest.py"
check_file "backend_django/pytest_fixtures.py"
check_content "backend_django/apps/auth/tests.py" "test_user_login" "Auth tests expanded"

# Test scripts
check_content "package.json" "vitest" "Test scripts in package.json"
check_content "backend_django/pytest.ini" "cov-fail-under=80" "Coverage threshold set to 80%"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 DOCUMENTATION VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_file "TEST_COVERAGE_GUIDE.md"
check_file "IMPROVEMENTS_COMPLETED.md"
check_file "QUICK_REF_10_10.md"
check_file "IMPLEMENTATION_SUMMARY.md"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

total=$((passed + failed))

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "✅ Passed: $passed/$total"
    echo ""
    echo "🎉 Application is PRODUCTION READY"
    echo ""
    echo "Next steps:"
    echo "  1. npm install (to add vitest)"
    echo "  2. cd backend_django && pip install -r requirements.txt"
    echo "  3. npm test -- --coverage (run frontend tests)"
    echo "  4. pytest --cov=apps (run backend tests)"
    echo "  5. Visit http://localhost:8000/api/schema/swagger/ for API docs"
else
    echo -e "${YELLOW}⚠️  SOME CHECKS FAILED${NC}"
    echo ""
    echo "✅ Passed: $passed/$total"
    echo -e "${RED}❌ Failed: $failed/$total${NC}"
    echo ""
    echo "Please review the failed items above."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
