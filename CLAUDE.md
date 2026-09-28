# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository contains [BRD.md](BRD.md), the business requirements for **Jarvis**, a Claude Code plugin, plus the voice pipeline and a summary agent. The plugin itself (hooks, `/jarvis` command, marketplace manifest) does not exist yet. BRD.md is the source of truth; requirement IDs (FR-n, NFR-n, AC-n) are referenced from it.

## Commands

```
uv sync                                          # install Python deps (agno, groq) into .venv
node scripts/generate-sounds.mjs                 # regenerate the fixed cues in sounds/ (Windows only)
node scripts/voice.mjs "Sir, hello." out.wav     # render any line in the Jarvis voice (Windows only)
echo "Done. Tests pass." | uv run agent/jarvis.py              # summarize, speak and play
echo "Should I continue?" | JARVIS_DRY=1 uv run agent/jarvis.py # print cue and line, no sound
```

There are no automated tests yet. `JARVIS_DRY=1` is the way to check classification.

## Voice and agent

- [scripts/voice.mjs](scripts/voice.mjs) renders text with the Windows built-in voice (System.Speech via PowerShell), then applies a light ring-modulator, comb, doubling, room reverb and soft limiter in pure Node. The effect and volume are the constants at the top. It exports `voiceWav(text)` and has a CLI.
- [scripts/generate-sounds.mjs](scripts/generate-sounds.mjs) uses `voiceWav` to write the three fixed cues. The WAV files are committed, so other platforms only play them.
- [agent/jarvis.py](agent/jarvis.py) reads Claude's final reply on stdin and sends only the last 2000 characters to a Groq model through an agno `Agent` with `output_schema=Spoken` (cue plus a short "Sir, ..." line). It renders the line with `scripts/voice.mjs` and plays it. With no `GROQ_API_KEY`, or on any failure, it falls back to a keyword guess and the fixed WAV. It never raises.
- Config comes from the environment or a git-ignored `.env` in the repo root (see [.env.example](.env.example)): `GROQ_API_KEY`, optional `JARVIS_GROQ_MODEL`.
- The agent goes beyond the BRD: it adds Python dependencies (NFR-3), network calls that send reply text to Groq (NFR-4), and spoken status (listed as future work). The fixed-WAV fallback keeps the BRD behaviour when the agent is off.

## What Jarvis does

Jarvis plays one of three sound cues when Claude Code finishes a turn, so the user can work in other windows:

- **needs action**: a permission request (Notification hook), or a final reply that ends by asking the user something
- **blocked**: a final reply that says Claude is blocked, stuck, waiting on someone, or cannot proceed
- **task completed**: any other finished turn, including one with no reply text

## Architecture (as specified)

- **One repo is both the marketplace and the plugin** (FR-19). Install flow: `/plugin marketplace add <repo>` then `/plugin install jarvis@jarvis`.
- **Hooks drive everything.** The Stop hook classifies the finished turn. The Notification hook plays needs action for permission requests but must stay silent on the idle "waiting for your input" notification, which would repeat a cue already played (FR-6). Paths resolve through `${CLAUDE_PLUGIN_ROOT}`.
- **Classification** reads only the tail of the transcript (NFR-5) and inspects the last part of Claude's final reply (FR-7). Blocked wins over needs action (FR-8). Exactly one cue per turn (FR-5). Claude Code has no "blocked" event, so blocked is a keyword guess; keep the keyword lists in one place so they are easy to extend.
- **Control** is a `/jarvis` command with `on`, `off`, `status`, `test`. On/off state must persist across restarts and defaults to on (FR-13, FR-14). `test` plays all three cues in order and reports which are custom.
- **Sounds**: `sounds/needs-action.wav`, `sounds/completed.wav`, `sounds/blocked.wav` are used when present, read at play time so no reinstall is needed (FR-17). When a file is missing, fall back to a distinct system sound per cue; on Linux the fallback is the terminal bell. Custom sounds must be `.wav` because the Windows built-in player does not play mp3.
- **Playback per OS**: PowerShell on Windows, `afplay` on macOS, `paplay` on Linux.

## Hard constraints

- The hook must return immediately; play sound in a detached process (NFR-1).
- Any failure (unreadable transcript, missing player, bad payload) must be silent and must never break Claude Code (NFR-2). A missing or unreadable transcript plays task completed (AC-10).
- Node only, with no npm dependencies (NFR-3), and no network access or telemetry (NFR-4), except in the optional summary agent.
- `JARVIS_DRY=1` prints the chosen cue instead of playing it (NFR-7). Use it for testing classification without sound; acceptance criteria AC-1 to AC-6 and AC-10 are meant to be verified this way.

## Out of scope for this version

Visual or desktop notifications, per-project or per-session toggles, volume control, quiet hours, and subagent cues. Do not add these unless asked; they are listed as future work in BRD.md section 10.
