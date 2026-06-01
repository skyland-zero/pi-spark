# Pi Spark

A curated package of [pi](https://pi.dev/) extensions.

## Extensions

- **Editor**: replaces the default editor with a compact working indicator and current model info.
- **Footer**: shows the session info, cost, and context usage in one line, followed by extension statuses.
- **Recap**: generates a short idle-session recap and exposes a `/recap` command for manual generation, inspired by [Claude Code's session recap](https://code.claude.com/docs/en/interactive-mode#session-recap).

![Screenshot](./assets/screenshot.png)

## Install

Install from git:

```bash
pi install git:github.com/zlliang/pi-spark
```

## Configure

Spark reads config from `~/.pi/agent/spark.json` and from the current project’s `.pi/spark.json`. Project config overrides matching global fields.

Example:

```json
{
  "editor": {
    "spinner": "dots"
  },
  "footer": false,
  "recap": {
    "idle": 180000,
    "provider": "openai-codex",
    "model": "gpt-5.4-mini",
    "thinkingLevel": "off"
  }
}
```

Notes:

- Set an extension key to `false` to disable it.
- The `editor.spinner` value can be `lights` or `dots`.
- The `recap.idle` value is in milliseconds and must be at least `5000`.
