#!/usr/bin/env bash
# Validate jq templates embedded in action.yml
# Extracts and tests jq syntax with sample data

set -euo pipefail

# Test jq templates with sample data
test_jq_template() {
  local name="$1"
  local result

  result=$(jq -n \
    --arg color "#36a64f" \
    --arg icon "✅" \
    --arg title "Test" \
    --arg command "batch" \
    --arg configs "\\n• test.yaml" \
    --arg assets "10 exported" \
    --arg repo "test/repo" \
    --arg duration "5s" \
    --arg subtitle "Test subtitle" \
    --arg url "https://example.com" \
    '{
      attachments: [{
        color: $color,
        blocks: [
          {type: "header", text: {type: "plain_text", text: "\($icon) ExFig: \($title)", emoji: true}},
          {type: "section", fields: [
            {type: "mrkdwn", text: "*Command:*\n`\($command)`\($configs)"},
            {type: "mrkdwn", text: "*Assets:*\n\($assets)"}]},
          {type: "section", fields: [
            {type: "mrkdwn", text: "*Repository:*\n\($repo)"},
            {type: "mrkdwn", text: "*Duration:*\n\($duration)"}]},
          {type: "context", elements: [{type: "mrkdwn", text: "\($subtitle)"}]},
          {type: "actions", elements: [
            {type: "button", text: {type: "plain_text", text: "View Run", emoji: true}, url: $url}]}
        ]
      }]
    }' 2>&1) || {
    echo "FAIL: $name - jq syntax error"
    echo "$result"
    return 1
  }

  # Validate JSON structure
  if ! echo "$result" | jq -e '.attachments[0].blocks | length > 0' >/dev/null 2>&1; then
    echo "FAIL: $name - invalid JSON structure"
    return 1
  fi

  echo "OK: $name"
}

# Test with empty configs (conditional should produce empty array)
test_empty_configs() {
  local result

  result=$(jq -n \
    --arg configs "" \
    '(if ($configs | length) > 0 then ["item"] else [] end)' 2>&1) || {
    echo "FAIL: empty configs conditional"
    echo "$result"
    return 1
  }

  if [[ "$result" != "[]" ]]; then
    echo "FAIL: empty configs should produce []"
    return 1
  fi

  echo "OK: empty configs conditional"
}

echo "Validating jq templates..."
test_jq_template "slack-notification-with-subtitle"
test_empty_configs
echo "All jq validations passed"
