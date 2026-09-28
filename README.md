# Jarvis 🎩

> "Sir, the task is complete. I trust you'll notice the monumental improvement."

A Claude Code plugin that talks back. When Claude finishes, gets stuck, or wants your permission, a slightly-robotic, mildly-sarcastic JARVIS tells you out loud. Go make coffee. Jarvis will call you.

**What this is:** a fun, f-around-and-find-out, chill 20-minute project. No roadmap, no SLA, no tests. Vibes and one Groq call.

## What you'll hear

- **Done:** a fresh, Groq-written rundown of what Claude just did, a few sentences long, with the occasional deadpan jab.
- **Permission needed:** "Sir, I am waiting for your approval."
- **Anything broke:** "Sir, the task is complete." Jarvis never admits defeat.

## Install

You need Windows, [uv](https://docs.astral.sh/uv/), Node, and a free [Groq API key](https://console.groq.com/keys).

```powershell
setx GROQ_API_KEY "gsk_..."
```

Restart your terminal or VS Code, then in Claude Code:

```
/plugin marketplace add ram-7900/jarvis
/plugin install jarvis@jarvis
```

Restart Claude Code once more. Done. Jarvis is on in every project.

## Shut him up

Start typing your next prompt. Jarvis stops mid-sentence. A newer line also cuts off an older one.

## Update

```
/plugin marketplace update jarvis
/plugin update jarvis@jarvis
```

## Poke at it

```bash
# hear it
echo '{"last_assistant_message":"Fixed a typo."}' | uv run agent/jarvis.py
# just read it
echo '{"last_assistant_message":"Fixed a typo."}' | JARVIS_DRY=1 uv run agent/jarvis.py
# redo the fixed sounds
node scripts/generate-sounds.mjs
```

- **More robot, less butler:** tweak `RING_MIX` and friends at the top of `scripts/voice.mjs`.
- **More attitude:** edit the instructions in `agent/jarvis.py`.

## How it works

1. Claude finishes a turn, and the plugin's `Stop` hook fires in the background.
2. `agent/jarvis.py` sends the end of Claude's reply to Groq through [agno](https://docs.agno.com/models/groq), and gets back a "Sir, ..." line.
3. `scripts/voice.mjs` speaks it with the Windows voice, adds a little helmet-speaker shimmer, and plays it.

The approval line also plays when Claude asks for a permission, shows you an options menu, or wants a plan approved.

Heads-up: the end of each Claude reply goes to Groq to be summarized.
