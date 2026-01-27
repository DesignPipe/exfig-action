#!/usr/bin/env bash
# Test ExFig output parsing logic used in action.yml (lines 319-371)
# Run: ./scripts/test-parsing.sh
set -euo pipefail

PASSED=0
FAILED=0

pass() { echo "✓ $1"; ((PASSED++)) || true; }
fail() { echo "✗ $1"; ((FAILED++)) || true; }

# ============================================================
# Test 1: ASSETS_COUNT parsing
# ============================================================
echo "=== Test: assets_exported ==="

test_assets_count() {
  local INPUT="$1"
  local EXPECTED="$2"
  local RESULT
  # Matches lines like "✓ colors.yaml - 42 colors" and sums up numbers
  RESULT=$(echo "$INPUT" | grep -E '^✓.*- [0-9]+ ' 2>/dev/null \
    | grep -oE '[0-9]+' | awk '{sum+=$1} END {print sum+0}') || RESULT="0"
  RESULT="${RESULT:-0}"
  if [[ "$RESULT" == "$EXPECTED" ]]; then
    pass "assets='$EXPECTED' from: ${INPUT:0:50}..."
  else
    fail "Expected $EXPECTED, got $RESULT"
  fi
}

# Single config
test_assets_count "✓ colors.yaml - 42 colors exported" "42"

# Multiple configs (sum)
test_assets_count $'✓ colors.yaml - 10 colors\n✓ icons.yaml - 25 icons\n✓ images.yaml - 5 images' "40"

# Mixed with validated (should ignore validated)
test_assets_count $'✓ colors.yaml - 10 colors\n✓ cached.yaml - validated' "10"

# No matches
test_assets_count "Some random output" "0"

# Empty input
test_assets_count "" "0"

# ============================================================
# Test 2: VALIDATED_COUNT parsing
# ============================================================
echo ""
echo "=== Test: validated_count ==="

test_validated_count() {
  local INPUT="$1"
  local EXPECTED="$2"
  local RESULT
  # grep -c returns 0 even with no matches, but exits 1
  RESULT=$(echo "$INPUT" | grep -cE '^✓.*- validated' 2>/dev/null) || RESULT="0"
  RESULT="${RESULT:-0}"
  if [[ "$RESULT" == "$EXPECTED" ]]; then
    pass "validated=$EXPECTED"
  else
    fail "Expected $EXPECTED, got $RESULT"
  fi
}

test_validated_count "✓ colors.yaml - validated" "1"
test_validated_count $'✓ a.yaml - validated\n✓ b.yaml - validated\n✓ c.yaml - 10 icons' "2"
test_validated_count "✓ colors.yaml - 42 colors" "0"
test_validated_count "" "0"

# ============================================================
# Test 3: EXPORTED_CONFIGS count
# ============================================================
echo ""
echo "=== Test: exported_configs ==="

test_exported_configs() {
  local INPUT="$1"
  local EXPECTED="$2"
  local RESULT
  RESULT=$(echo "$INPUT" | grep -cE '^✓.*- [0-9]+ ' 2>/dev/null) || RESULT="0"
  RESULT="${RESULT:-0}"
  if [[ "$RESULT" == "$EXPECTED" ]]; then
    pass "exported_configs=$EXPECTED"
  else
    fail "Expected $EXPECTED, got $RESULT"
  fi
}

test_exported_configs "✓ colors.yaml - 42 colors" "1"
test_exported_configs $'✓ a.yaml - 10 colors\n✓ b.yaml - 20 icons' "2"
test_exported_configs $'✓ a.yaml - validated\n✓ b.yaml - validated' "0"
test_exported_configs "" "0"

# ============================================================
# Test 4: FAILED_COUNT parsing
# ============================================================
echo ""
echo "=== Test: failed_count ==="

test_failed_count() {
  local INPUT="$1"
  local EXPECTED="$2"
  local RESULT
  RESULT=$(echo "$INPUT" | grep -oE '[0-9]+ failed' 2>/dev/null | grep -oE '[0-9]+' | head -1) || RESULT=""
  if [[ -z "$RESULT" ]]; then RESULT="0"; fi
  if [[ "$RESULT" == "$EXPECTED" ]]; then
    pass "failed_count=$EXPECTED from: ${INPUT:0:50}"
  else
    fail "Expected $EXPECTED, got $RESULT"
  fi
}

test_failed_count "Batch complete: 2 succeeded, 1 failed" "1"
test_failed_count "Batch complete: 0 succeeded, 3 failed" "3"
test_failed_count "Batch complete: 5 succeeded, 0 failed" "0"
test_failed_count "All configs processed successfully" "0"
test_failed_count "" "0"

# ============================================================
# Test 5: ERROR_MESSAGE parsing + truncate
# ============================================================
echo ""
echo "=== Test: error_message ==="

test_error_message() {
  local INPUT="$1"
  local EXPECTED="$2"
  local RAW_ERROR ERROR_MESSAGE
  RAW_ERROR=$(echo "$INPUT" | grep -m1 '^✗' 2>/dev/null | sed 's/^✗ //') || RAW_ERROR=""
  ERROR_MESSAGE=$(echo "$RAW_ERROR" | head -1 | cut -c1-100)
  if [[ ${#RAW_ERROR} -gt 100 ]]; then
    ERROR_MESSAGE="${ERROR_MESSAGE}..."
  fi
  if [[ "$ERROR_MESSAGE" == "$EXPECTED" ]]; then
    pass "error_message matches"
  else
    fail "Expected '$EXPECTED', got '$ERROR_MESSAGE'"
  fi
}

# Simple error
test_error_message "✗ colors.yaml: Rate limited" "colors.yaml: Rate limited"

# Long error (truncate)
LONG_ERROR="✗ colors.yaml: This is a very long error message that definitely exceeds one hundred characters and should be truncated with ellipsis at the end"
test_error_message "$LONG_ERROR" "colors.yaml: This is a very long error message that definitely exceeds one hundred characters and sh..."

# Multiple errors (first only)
test_error_message $'✗ first.yaml: Error 1\n✗ second.yaml: Error 2' "first.yaml: Error 1"

# No error
test_error_message "✓ success.yaml - 10 colors" ""

# ============================================================
# Test 6: ERROR_CATEGORY classification
# ============================================================
echo ""
echo "=== Test: error_category ==="

categorize_error() {
  local RAW_ERROR="$1"
  local RAW_ERROR_LOWER ERROR_CATEGORY=""
  if [[ -n "$RAW_ERROR" ]]; then
    RAW_ERROR_LOWER=$(echo "$RAW_ERROR" | tr '[:upper:]' '[:lower:]')
    case "$RAW_ERROR_LOWER" in
      *"rate limit"*)       ERROR_CATEGORY="[RATE_LIMIT]" ;;
      *"timeout"*)          ERROR_CATEGORY="[TIMEOUT]" ;;
      *"authentication"*|*"token"*) ERROR_CATEGORY="[AUTH]" ;;
      *"access denied"*|*"forbidden"*) ERROR_CATEGORY="[FORBIDDEN]" ;;
      *"not found"*|*"404"*) ERROR_CATEGORY="[NOT_FOUND]" ;;
      *"connection"*|*"internet"*|*"dns"*|*"network"*) ERROR_CATEGORY="[NETWORK]" ;;
      *"server error"*|*"50"[0-9]*) ERROR_CATEGORY="[SERVER]" ;;
      *"invalid"*|*"config"*) ERROR_CATEGORY="[CONFIG]" ;;
      *)                    ERROR_CATEGORY="[ERROR]" ;;
    esac
  fi
  echo "$ERROR_CATEGORY"
}

test_category() {
  local INPUT="$1"
  local EXPECTED="$2"
  local RESULT
  RESULT=$(categorize_error "$INPUT")
  if [[ "$RESULT" == "$EXPECTED" ]]; then
    pass "$EXPECTED <- ${INPUT:0:40}"
  else
    fail "Expected $EXPECTED, got $RESULT for '$INPUT'"
  fi
}

test_category "Rate limited by Figma API" "[RATE_LIMIT]"
test_category "Request timeout after 30s" "[TIMEOUT]"
test_category "Authentication failed" "[AUTH]"
test_category "FIGMA_PERSONAL_TOKEN not set" "[AUTH]"
test_category "Access denied to file" "[FORBIDDEN]"
test_category "Forbidden: no permissions" "[FORBIDDEN]"
test_category "File not found: config.yaml" "[NOT_FOUND]"
test_category "Error 404: missing" "[NOT_FOUND]"
test_category "Connection lost" "[NETWORK]"
test_category "DNS lookup failed" "[NETWORK]"
test_category "No internet connection" "[NETWORK]"
test_category "Figma server error (502)" "[SERVER]"
test_category "Internal error 500" "[SERVER]"
test_category "Invalid config format" "[CONFIG]"
test_category "Config parse error" "[CONFIG]"
test_category "Something unexpected" "[ERROR]"
test_category "" ""

# ============================================================
# Summary
# ============================================================
echo ""
echo "========================================"
echo "Results: $PASSED passed, $FAILED failed"
echo "========================================"

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
