---
name: measuring-token-usage
description: Measures how many prompt tokens pi's built-in system prompt and tools cost, and how many a custom tool or extension adds. Use when estimating or budgeting token usage for pi sessions, tools, or extensions.
---

# Measuring Token Usage

Estimate the prompt-token cost of pi's built-in system prompt and tools, or any custom tool/extension, by triggering one real `pi -p` turn and reading the usage from its session file.

## Method

Run `uv run --script scripts/measure.py <label> <provider> <model> [extra pi args...]`. It strips the request to built-ins only (`-ne -nc -ns -np`), fires a one-token `hi` prompt, and prints CSV: `label,provider,model,prompt,output`.

```bash
# system prompt + built-in tools
uv run --script scripts/measure.py base openai-codex gpt-5.5

# system prompt only
uv run --script scripts/measure.py notools openai-codex gpt-5.5 -nt

# baseline + a custom extension
uv run --script scripts/measure.py tool openai-codex gpt-5.5 -e ./my-ext.ts
```

Derive: `built-in tools = base − notools`; `a custom tool/extension = (run with -e) − base`. Isolate one tool among several with `-xt <other-tool>`. Repeat across providers and average — counts differ a lot per provider (the schema is re-serialized per format).

## Caveats

- `prompt = input + cacheRead + cacheWrite` of the first turn. Anthropic routes the prompt into `cacheWrite`, so sum all three; never use `input` alone. (The script already does this.)
- Run baseline and tool runs from the **same cwd** — the system prompt embeds the working directory and its listing, so absolute counts shift by environment. An empty temp dir is cleanest; deltas stay valid as long as cwd matches.
- The system prompt also embeds OS and date, so absolute numbers drift slightly over time.
- A custom tool's cost includes its schema **and** any `promptSnippet`/`promptGuidelines` it injects — the delta captures all of it.
- Config-gated tools only register when enabled; check the extension's config defaults.

## Minimal test tool

To measure one tool's overhead, register a throwaway tool in a one-off extension and load it with `-e`:

```ts
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "echo_test",
    label: "Echo Test",
    description: "Throwaway tool to measure per-tool prompt-token cost. Echoes text back.",
    parameters: Type.Object({ text: Type.String({ description: "Text to echo back." }) }),
    execute: async (_id, params) => ({ content: [{ type: "text", text: String(params.text) }], details: {} }),
  });
}
```

## Current estimates

Prompt tokens from an empty cwd. Default built-in tools = `read, bash, edit, write` (4; `grep, find, ls` exist but are off by default).

| Model | System prompt | Built-in tools | Built-in total |
| --- | --- | --- | --- |
| Claude Opus 4.8 | 615 | 1561 | 2176 |
| GPT-5.5 | 386 | 737 | 1123 |
| DeepSeek V4 Flash | 406 | 1107 | 1513 |
| Kimi K2.6 | 397 | 708 | 1105 |
| **Average** | **~450** | **~1030** | **~1480** |

Rules of thumb: system prompt **~450**, the 4 default built-in tools **~1030** (**~260/tool**). Anthropic counts ~1.5–2× the others, so budget per-provider.

Last measured: pi 0.79.3, 2026-06-14.
