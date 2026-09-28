# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Jarvis is a fun, casual Claude Code plugin: a sarcastic JARVIS voice speaks when Claude finishes or needs permission. See [README.md](README.md) for what it does and how to install it.

## Layout

- `.claude-plugin/`: the repo is both the marketplace and the plugin. The hooks are inline in `plugin.json`.
  - The Stop hook runs `agent/jarvis.py` async.
  - The Notification hook (matcher `permission_prompt`) and the PreToolUse hook (matcher `AskUserQuestion|ExitPlanMode`) play `sounds/needs-action.wav`.
- [agent/jarvis.py](agent/jarvis.py): an agno `Agent` on Groq. It reads `last_assistant_message` from the hook JSON on stdin and speaks a "Sir, ..." line.
- [scripts/voice.mjs](scripts/voice.mjs): Windows System.Speech plus a light robot effect in pure Node. [scripts/generate-sounds.mjs](scripts/generate-sounds.mjs) writes the fixed fallback WAVs.

## Commands

```
claude plugin validate .
echo '{"last_assistant_message":"Done."}' | JARVIS_DRY=1 uv run agent/jarvis.py   # print the line, no sound
node scripts/generate-sounds.mjs
```

## Rules

- Keep code minimal. Use the documented pattern from the official docs, and add nothing the task does not need.
- After any change to the plugin:
  1. Bump `version` in `.claude-plugin/plugin.json`.
  2. Commit and push.
  3. Run `claude plugin marketplace update jarvis` and `claude plugin update jarvis@jarvis`, so the installed copy stays current.
- `GROQ_API_KEY` comes from the user environment. `.env` is git-ignored and never committed.
- Hook commands run in Git Bash on Windows, where `${CLAUDE_PLUGIN_ROOT}` may be `/c/...`. `uv` accepts that path form. PowerShell does not, so the Notification hook wraps the path in `cygpath -w`.
