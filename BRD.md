# Jarvis — Business Requirements Document

| | |
|---|---|
| Product | Jarvis, a Claude Code plugin |
| Owner | Sriram Maruvada |
| Version | 0.1 (draft) |
| Date | 28 September 2026 |
| Distribution | Personal Claude Code marketplace, hosted in a git repository |

---

## 1. Problem

Claude Code runs long tasks. While it works, the user switches to other windows. There is no signal
when Claude finishes, needs a decision, or has stopped because something is in its way, so the user
either checks back repeatedly or loses time before noticing.

## 2. Goal

Tell the user, by sound alone, which of three states Claude has reached, so they can return only when
they are needed and know why before they look.

## 3. Users

| User | Need |
|---|---|
| Primary: a developer running Claude Code on their own machine | Know when to come back, without watching the terminal |
| Secondary: anyone installing from the marketplace | Install in two commands, change sounds without editing code |

## 4. Scope

### In scope

- Three sound cues: **needs action**, **task completed**, **blocked**
- A command to turn cues on and off, check status, and test them
- User-supplied sound files, with a default when none are supplied
- Windows, macOS and Linux
- Distribution as a marketplace plugin from a git repository

### Out of scope (this version)

- Visual or desktop notifications
- Spoken status (text-to-speech)
- Per-project or per-session on/off
- Volume control, quiet hours
- Cues for subagents
- Any network access or telemetry

---

## 5. Functional requirements

### 5.1 Cues

| ID | Requirement |
|---|---|
| FR-1 | Play **needs action** when Claude requests a permission |
| FR-2 | Play **needs action** when Claude's reply ends by asking the user something |
| FR-3 | Play **blocked** when Claude's reply says it is blocked, stuck, waiting on someone, or cannot proceed |
| FR-4 | Play **task completed** when Claude finishes a turn and neither FR-2 nor FR-3 applies |
| FR-5 | Play exactly one cue per finished turn |
| FR-6 | Stay silent on the idle "waiting for your input" notification, which otherwise repeats a cue already played |

### 5.2 Classification

| ID | Requirement |
|---|---|
| FR-7 | Decide the cue from the **last part** of Claude's final reply, since the ending states what happens next |
| FR-8 | Where a reply matches both, **blocked** wins over needs action |
| FR-9 | Where there is no reply text, play task completed |

### 5.3 Control

| ID | Requirement |
|---|---|
| FR-10 | `/jarvis on` and `/jarvis off` turn all cues on or off |
| FR-11 | `/jarvis status` reports whether cues are on |
| FR-12 | `/jarvis test` plays all three cues in order and says which are custom |
| FR-13 | The on/off state survives restarting Claude Code |
| FR-14 | Default state after install is **on** |

### 5.4 Sounds

| ID | Requirement |
|---|---|
| FR-15 | Use `sounds/needs-action.wav`, `sounds/completed.wav`, `sounds/blocked.wav` when present |
| FR-16 | Fall back to a distinct system sound per cue when a file is missing |
| FR-17 | Adding or replacing a sound needs no code change and no reinstall |

### 5.5 Distribution

| ID | Requirement |
|---|---|
| FR-18 | Installable with `/plugin marketplace add <repo>` then `/plugin install jarvis@jarvis` |
| FR-19 | The repository is both the marketplace and the plugin |

---

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Never slows Claude down.** The hook returns immediately; sound plays in a detached process |
| NFR-2 | **Never breaks Claude.** Any failure to read the transcript or play a sound is silent |
| NFR-3 | **No dependencies** beyond Node, which Claude Code already requires |
| NFR-4 | **No network access** and no data leaves the machine |
| NFR-5 | Reads only the tail of the transcript, so large sessions stay fast |
| NFR-6 | Works on Windows (PowerShell), macOS (`afplay`) and Linux (`paplay`) |
| NFR-7 | Testable without sound: `JARVIS_DRY=1` prints the cue instead of playing it |

---

## 7. Constraints and assumptions

- Claude Code has no "blocked" event. Blocked is inferred from wording, so it is a best guess.
- Custom sounds must be `.wav`. Windows' built-in player does not play mp3.
- On Linux without a custom file, the fallback is the terminal bell.
- The plugin relies on the Stop and Notification hooks and `${CLAUDE_PLUGIN_ROOT}`.

---

## 8. Acceptance criteria

| # | Given | Then |
|---|---|---|
| AC-1 | A turn ends with a finished task | Task completed plays once |
| AC-2 | A turn ends with a question | Needs action plays once |
| AC-3 | A turn ends saying it is blocked | Blocked plays once |
| AC-4 | Claude asks for a permission | Needs action plays |
| AC-5 | The idle notification fires after a turn | Nothing plays |
| AC-6 | `/jarvis off`, then a turn ends | Nothing plays |
| AC-7 | `/jarvis on` after a restart | Cues play again; state was remembered |
| AC-8 | No custom sounds present | Three distinct default sounds play |
| AC-9 | A custom `completed.wav` added | It plays, with no reinstall |
| AC-10 | The transcript is missing or unreadable | No error is shown; task completed plays |

AC-1 to AC-6 and AC-10 pass in dry-run tests today. AC-7 to AC-9 need a live install.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Wrong cue from unusual wording | Keyword lists are in one place and easy to extend; misfires are low cost |
| Noise during meetings | `/jarvis off` |
| Claude Code changes hook payloads | Failures are silent by design; fix in the plugin, users pull the update |

---

## 10. Future

In priority order, none committed:

1. Spoken status via the system voice, as an option alongside sounds
2. Per-project on/off
3. Quiet hours
4. User-configurable keywords for blocked and needs action
5. Desktop notification alongside the sound
 