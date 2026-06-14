#!/usr/bin/env bash
#
# Measure the prompt-token size of a single `pi -p` request.
#
# Usage:
#   measure.sh <label> <provider> <model> [extra pi args...]
#
# Output (CSV):
#   label,provider,model,prompt,output
#
# Notes:
#   - prompt = input + cacheRead + cacheWrite of the FIRST assistant turn.
#     Anthropic routes the whole prompt into cacheWrite, so all three are summed.
#   - The request is stripped to built-ins only:
#       -ne  no extension discovery
#       -nc  no AGENTS.md / CLAUDE.md
#       -ns  no skills
#       -np  no prompt templates
#   - Add custom tools/extensions via extra args, e.g. `-e ./my-ext.ts`.

set -euo pipefail

label=$1
provider=$2
model=$3
shift 3

# Isolate each run in its own throwaway session directory.
session_dir="$(mktemp -d)/session"
mkdir -p "$session_dir"

# Trigger one minimal turn; ignore failures so jq can still report partial output.
pi -ne -nc -ns -np \
  --session-dir "$session_dir" \
  --provider "$provider" \
  --model "$model" \
  "$@" \
  -p "hi" >/dev/null 2>&1 || true

session_file=$(find "$session_dir" -name '*.jsonl' | head -1)

# Pull usage from the first assistant message and emit one CSV row.
jq -r \
  --arg label "$label" \
  --arg provider "$provider" \
  --arg model "$model" '
    select(.type == "message" and .message.role == "assistant")
    | .message.usage
    | [
        $label,
        $provider,
        $model,
        (.input + .cacheRead + .cacheWrite),
        .output
      ]
    | @csv
  ' "$session_file" | head -1
