#!/bin/bash

# Gate Pass Role-Based Testing Script
# Test API endpoints with different user roles

BASE_URL="http://localhost:8000/api"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==================== TEST DATA ====================

# You'll need to set these with actual tokens from your system
STUDENT_TOKEN=""
WARDEN_TOKEN=""
HEAD_WARDEN_TOKEN=""
SECURITY_TOKEN=""
ADMIN_TOKEN=""

# ==================== HELPER FUNCTIONS ====================

test_endpoint() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    local role=$5
    
    echo -e "${BLUE}Testing: ${role} - ${method} ${endpoint}${NC}"
    
    if [ -z "$token" ]; then
        echo -e "${YELLOW}⚠️  No token provided for ${role}${NC}"
        return
    fi
    
    if [ -n "$data" ]; then
        curl -X $method \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" 2>/dev/null | python3 -m json.tool
    else
        curl -X $method \
            -H "Authorization: Bearer $token" \
            "$BASE_URL$endpoint" 2>/dev/null | python3 -m json.tool
    fi
    
    echo -e "\n"
}

# ==================== TEST SCENARIOS ====================

echo -e "${YELLOW}========== GATE PASS ROLE-BASED ACCESS TESTS ==========${NC}\n"

# TEST 1: Student Creates Gate Pass
echo -e "${BLUE}TEST 1: Student Creates Gate Pass${NC}"
STUDENT_DATA='
{
    "pass_type": "day",
    "purpose": "Visit library for study",
    "destination": "City Central Library",
    "exit_date": "2025-02-17",
    "exit_time": "14:00",
    "expected_return_date": "2025-02-17",
    "expected_return_time": "16:00",
    "remarks": "Study session"
}
'
test_endpoint "POST" "/gate-passes/" "$STUDENT_TOKEN" "$STUDENT_DATA" "Student"

# TEST 2: List Gate Passes as Student (should see only own)
echo -e "${BLUE}TEST 2: Student Lists Gate Passes (Role-Filtered)${NC}"
test_endpoint "GET" "/gate-passes/?status=pending" "$STUDENT_TOKEN" "" "Student"

# TEST 3: List Gate Passes as Warden (should see building-specific)
echo -e "${BLUE}TEST 3: Warden Lists Gate Passes (Building-Filtered)${NC}"
test_endpoint "GET" "/gate-passes/?status=pending" "$WARDEN_TOKEN" "" "Warden"

# TEST 4: List Gate Passes as Head Warden (should see all)
echo -e "${BLUE}TEST 4: Head Warden Lists Gate Passes (All)${NC}"
test_endpoint "GET" "/gate-passes/?status=pending" "$HEAD_WARDEN_TOKEN" "" "Head Warden"

# TEST 5: Warden Approves Gate Pass
echo -e "${BLUE}TEST 5: Warden Approves Gate Pass${NC}"
APPROVE_DATA='
{
    "remarks": "Approved by warden"
}
'
# Replace {id} with actual gate pass ID
test_endpoint "POST" "/gate-passes/1/approve/" "$WARDEN_TOKEN" "$APPROVE_DATA" "Warden"

# TEST 6: Warden Rejects Gate Pass
echo -e "${BLUE}TEST 6: Warden Rejects Gate Pass${NC}"
REJECT_DATA='
{
    "remarks": "Cannot approve at this time"
}
'
test_endpoint "POST" "/gate-passes/2/reject/" "$WARDEN_TOKEN" "$REJECT_DATA" "Warden"

# TEST 7: Security Verifies (Check-In)
echo -e "${BLUE}TEST 7: Security Verifies Approved Pass (Check-In)${NC}"
VERIFY_DATA='
{
    "action": "check_in"
}
'
test_endpoint "POST" "/gate-passes/1/verify/" "$SECURITY_TOKEN" "$VERIFY_DATA" "Security"

# TEST 8: Student Cannot Approve (Permission Denied)
echo -e "${BLUE}TEST 8: Student Cannot Approve (Permission Denied)${NC}"
test_endpoint "POST" "/gate-passes/1/approve/" "$STUDENT_TOKEN" "$APPROVE_DATA" "Student"

# TEST 9: Admin Can Approve Any Pass
echo -e "${BLUE}TEST 9: Admin Can Approve Any Pass${NC}"
test_endpoint "POST" "/gate-passes/1/approve/" "$ADMIN_TOKEN" "$APPROVE_DATA" "Admin"

# TEST 10: Get Specific Gate Pass (Auth-based access)
echo -e "${BLUE}TEST 10: Get Specific Gate Pass${NC}"
test_endpoint "GET" "/gate-passes/1/" "$STUDENT_TOKEN" "" "Student"

echo -e "${GREEN}========== TESTS COMPLETE ==========${NC}"

# ==================== TOKEN GENERATION ====================

echo -e "\n${YELLOW}To get tokens, use the login endpoint:${NC}"
echo -e "\n${BLUE}curl -X POST http://localhost:8000/api/auth/login/ \\${NC}"
echo -e "${BLUE}  -H 'Content-Type: application/json' \\${NC}"
echo -e "${BLUE}  -d '{\"email\": \"student@example.com\", \"password\": \"password\"}'${NC}"

echo -e "\n${YELLOW}Then export tokens:${NC}"
echo -e "${BLUE}export STUDENT_TOKEN='<token_from_login>'${NC}"
echo -e "${BLUE}./test_gate_pass_roles.sh${NC}"

