# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Jarvis is a just-for-fun Claude Code plugin: a sarcastic British butler (Groq Orpheus voice `daniel`) speaks when Claude finishes or needs you. See [README.md](README.md) for the pitch and install.

## Layout

- `.claude-plugin/`: the repo is both the marketplace and the plugin. The hooks are inline in `plugin.json`.
  - The Stop hook runs `agent/jarvis.py` async. The script writes its player PID to `%TEMP%/jarvis.pid`.
  - UserPromptSubmit has two hooks. An async one kills that PID, so any prompt interrupts Jarvis. A sync one, [scripts/stfu.sh](scripts/stfu.sh), exits 2 on `/jarvis:stfu` or `/stfu`, which erases the prompt so no turn runs and Jarvis has nothing to say. `commands/stfu.md` only exists for autocomplete.
  - The Notification hook (matcher `permission_prompt`) and the PreToolUse hook (matcher `AskUserQuestion|ExitPlanMode`) play `sounds/needs-action.wav`.
- [agent/jarvis.py](agent/jarvis.py): an agno `Agent` on Groq. It reads `last_assistant_message` from the hook JSON on stdin and writes a "Sir, ..." line. `orpheus()` speaks it with Groq `canopylabs/orpheus-v1-english`: 200 characters max per call, so it splits by sentence, calls in parallel, strips Groq's streaming WAV headers, soft-limits and writes one 24 kHz WAV. Falls back to `scripts/voice.mjs`.
- [scripts/voice.mjs](scripts/voice.mjs): fallback voice: Windows System.Speech, normalized and soft-limited in pure Node. [scripts/generate-sounds.mjs](scripts/generate-sounds.mjs) writes the fixed fallback WAVs.

## Commands

```
claude plugin validate .
echo '{"last_assistant_message":"Done."}' | JARVIS_DRY=1 uv run agent/jarvis.py   # print the line, no sound
node scripts/generate-sounds.mjs
```

## Rules

- Vibe: this project is not serious. Keep README, command descriptions and user-facing text funny, casual and a little cheeky. Keep CLAUDE.md accurate.
- Keep code minimal. Use the documented pattern from the official docs, and add nothing the task does not need.
- After any change to the plugin:
  1. Bump `version` in `.claude-plugin/plugin.json`.
  2. Commit and push.
  3. Run `claude plugin marketplace update jarvis` and `claude plugin update jarvis@jarvis`, so the installed copy stays current.
- `GROQ_API_KEY` comes from the user environment. `.env` is git-ignored and never committed.
- Hook commands run in Git Bash on Windows, where `${CLAUDE_PLUGIN_ROOT}` may be `/c/...`. `uv` accepts that path form. PowerShell does not, so the Notification hook wraps the path in `cygpath -w`.
