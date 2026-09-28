# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository contains [BRD.md](BRD.md), the business requirements for **Jarvis**, a Claude Code plugin, plus the default sound cues. No plugin code, build, lint or test tooling exists yet.

The default cues in `sounds/` are robot-voice lines ("Sir, the task is complete." and so on). They are made from the Windows built-in voice with a ring-modulator, comb and bit-crush effect. Regenerate them on Windows with `node scripts/generate-sounds.mjs`; the WAV files are committed, so other platforms only play them. Change the spoken lines in `CUES` and the effect in the constants below it in [scripts/generate-sounds.mjs](scripts/generate-sounds.mjs). BRD.md is the source of truth; requirement IDs (FR-n, NFR-n, AC-n) are referenced from it. Update this file with real commands and layout once code lands.

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
- Node only, with no npm dependencies (NFR-3). No network access or telemetry (NFR-4).
- `JARVIS_DRY=1` prints the chosen cue instead of playing it (NFR-7). Use it for testing classification without sound; acceptance criteria AC-1 to AC-6 and AC-10 are meant to be verified this way.

## Out of scope for this version

Visual or desktop notifications, text-to-speech, per-project or per-session toggles, volume control, quiet hours, and subagent cues. Do not add these unless asked; they are listed as future work in BRD.md section 10.
