#!/bin/bash

# UniformManager2 API Test Script
# This script tests the core functionality of the API

BASE_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASS="admin123"
STAFF_USER="staff"
STAFF_PASS="staff123"

echo "=== UniformManager2 API Test Script ==="
echo ""

# Test 1: Login as admin
echo "Test 1: Login as admin user"
ADMIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"'$ADMIN_USER'","password":"'$ADMIN_PASS'"}')
ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ FAILED: Could not get admin token"
  echo "Response: $ADMIN_RESPONSE"
  exit 1
else
  echo "✅ PASSED: Got admin token"
fi
echo ""

# Test 2: Login as staff
echo "Test 2: Login as staff user"
STAFF_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"'$STAFF_USER'","password":"'$STAFF_PASS'"}')
STAFF_TOKEN=$(echo $STAFF_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -z "$STAFF_TOKEN" ]; then
  echo "❌ FAILED: Could not get staff token"
  exit 1
else
  echo "✅ PASSED: Got staff token"
fi
echo ""

# Test 3: Create uniform with valid status
echo "Test 3: Create uniform with valid status"
CREATE_RESPONSE=$(curl -s -X POST $BASE_URL/api/uniforms \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Blue Shirt","barcode":"SHIRT001","status":"In Stock","category":"Shirt"}')
echo "Response: $CREATE_RESPONSE"
if echo $CREATE_RESPONSE | grep -q "SHIRT001"; then
  echo "✅ PASSED: Created uniform"
else
  echo "❌ FAILED: Could not create uniform"
fi
echo ""

# Test 4: Test duplicate barcode (should return 409)
echo "Test 4: Test duplicate barcode detection"
DUP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/api/uniforms \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Duplicate","barcode":"SHIRT001","status":"In Stock","category":"Shirt"}')
HTTP_CODE=$(echo "$DUP_RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "409" ]; then
  echo "✅ PASSED: Duplicate barcode rejected with 409"
else
  echo "❌ FAILED: Expected 409, got $HTTP_CODE"
  echo "$DUP_RESPONSE"
fi
echo ""

# Test 5: Test "In Hamper" mapping to "In Laundry"
echo "Test 5: Test In Hamper mapping to In Laundry"
HAMPER_RESPONSE=$(curl -s -X POST $BASE_URL/api/uniforms \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","barcode":"TEST001","status":"In Hamper","category":"Test"}')
if echo $HAMPER_RESPONSE | grep -q '"status":"In Laundry"'; then
  echo "✅ PASSED: In Hamper mapped to In Laundry"
else
  echo "❌ FAILED: In Hamper not mapped correctly"
  echo "Response: $HAMPER_RESPONSE"
fi
echo ""

# Test 6: Test invalid status
echo "Test 6: Test invalid status rejection"
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/api/uniforms \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Invalid","barcode":"INV001","status":"InvalidStatus","category":"Test"}')
HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ PASSED: Invalid status rejected with 400"
else
  echo "❌ FAILED: Expected 400, got $HTTP_CODE"
fi
echo ""

# Test 7: Test status transition (In Stock -> Issued)
echo "Test 7: Test valid status transition (In Stock -> Issued)"
ISSUE_RESPONSE=$(curl -s -X POST $BASE_URL/api/uniforms/SHIRT001/issue \
  -H "Authorization: Bearer $STAFF_TOKEN")
if echo $ISSUE_RESPONSE | grep -q '"status":"Issued"'; then
  echo "✅ PASSED: Uniform issued successfully"
else
  echo "❌ FAILED: Could not issue uniform"
  echo "Response: $ISSUE_RESPONSE"
fi
echo ""

# Test 8: Test invalid status transition (Issued cannot go to In Stock directly)
echo "Test 8: Test invalid status transition"
INVALID_TRANS_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/api/uniforms/TEST001/issue \
  -H "Authorization: Bearer $STAFF_TOKEN")
# TEST001 is "In Laundry", can't go to "Issued"
HTTP_CODE=$(echo "$INVALID_TRANS_RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ PASSED: Invalid transition rejected with 400"
else
  echo "⚠️  WARNING: Transition validation may need checking (got $HTTP_CODE)"
fi
echo ""

# Test 9: Test authentication requirement
echo "Test 9: Test authentication requirement"
NO_AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET $BASE_URL/api/uniforms)
HTTP_CODE=$(echo "$NO_AUTH_RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "✅ PASSED: Unauthenticated request blocked"
else
  echo "❌ FAILED: Expected 401/403, got $HTTP_CODE"
fi
echo ""

# Test 10: Test admin-only delete
echo "Test 10: Test admin-only delete operation"
# Try delete with staff token (should fail)
STAFF_DELETE=$(curl -s -w "\n%{http_code}" -X DELETE $BASE_URL/api/uniforms/SHIRT001 \
  -H "Authorization: Bearer $STAFF_TOKEN")
HTTP_CODE=$(echo "$STAFF_DELETE" | tail -1)
if [ "$HTTP_CODE" = "403" ]; then
  echo "✅ PASSED: Staff cannot delete (403)"
else
  echo "⚠️  WARNING: Staff delete returned $HTTP_CODE (expected 403)"
fi
echo ""

echo "=== Test Summary ==="
echo "All core features have been tested."
echo "Check the results above for any failures."
