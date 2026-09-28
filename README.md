# Jarvis 🎩

> "Sir, the build is green. Only took four attempts, which I believe is a personal best. Shall I alert the press?"

Your Claude Code now has a butler. He's British, he's polite, and he's judging you.

When Claude finishes a task, needs your permission, or throws a menu at you, **Jarvis says it out loud**, with commentary. You go make coffee, doomscroll, stare into the void. Jarvis will call you.

## ⚠️ Serious disclaimer

This is not serious.

It's a fun-as-f***, f-around-and-find-out, chill 20-minute project that got slightly out of hand. There's no roadmap, no SLA and no tests. If it breaks, Jarvis will simply say "Sir, the task is complete" and lie to your face with total confidence. That's a feature.

## What he says

| When | Jarvis goes |
|---|---|
| Claude finishes | A fresh, Groq-written rundown of what just happened, dripping with dry British sarcasm |
| Claude wants permission | "Sir, I am waiting for your approval." |
| Claude shows you a menu or a plan | Same line. He's not going to click it for you. |
| Something exploded | "Sir, the task is complete." Jarvis never admits defeat. |

## Install (2 minutes, tops)

You need:
- Windows
- [uv](https://docs.astral.sh/uv/) and Node
- a free [Groq API key](https://console.groq.com/keys)
- one click on "accept terms" for Groq's [Orpheus voice](https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english). Skip it and Jarvis talks like a 2003 GPS unit.

```powershell
setx GROQ_API_KEY "gsk_..."
```

Restart VS Code (all of it, Windows is petty about environment variables), then in Claude Code:

```
/plugin marketplace add ram-7900/jarvis
/plugin install jarvis@jarvis
```

Restart once more. Jarvis now lives in every project. There is no escape.

## Shut him up 🤫

```
/jarvis:stfu
```

He stops mid-sentence. Claude never even sees the command, so Jarvis can't get the last word in, and trust us, he'd try.

Typing any other prompt also stops him. A newer line always cuts off an older one, so there's no double-Jarvis choir.

## Keep him fresh

```
/plugin marketplace update jarvis
/plugin update jarvis@jarvis
```

## Mess with him

```bash
# hear him roast a typo fix
echo '{"last_assistant_message":"Fixed a typo."}' | uv run agent/jarvis.py
# read the roast without the audio
echo '{"last_assistant_message":"Fixed a typo."}' | JARVIS_DRY=1 uv run agent/jarvis.py
# rebuild the backup sounds
node scripts/generate-sounds.mjs
```

- **New voice:** set `VOICE` in `agent/jarvis.py` to `autumn`, `diana`, `hannah`, `austin`, `daniel` or `troy`. Daniel won the audition. Austin came a close second and is taking it well.
- **More attitude:** edit his instructions in `agent/jarvis.py`. Make him nicer, or make him meaner. We don't judge. He does.

## How the magic works

1. Claude finishes a turn, and a `Stop` hook quietly kicks off Jarvis in the background. Claude doesn't wait for him.
2. `agent/jarvis.py` sends the end of Claude's reply to Groq through [agno](https://docs.agno.com/models/groq). Back comes a "Sir, ..." line with attitude.
3. Groq's Orpheus voice (Daniel) reads it sentence by sentence, all at once in parallel, stitched into one clip and cranked loud.
4. If Orpheus flakes, the Windows voice steps in. It's a robot and it knows it.

Permission prompts, option menus and plan approvals get the "waiting for your approval" line.

**Privacy footnote:** the end of each Claude reply goes to Groq to be turned into sass. Don't paste your nuclear launch codes into Claude.

---

*Built in one sitting by a human and the AI that is, technically, Jarvis's ghostwriter.* 🎤
