"""Jarvis summary agent.

Reads Claude's final reply on stdin, asks a Groq model (through agno) for the cue and
a short spoken line, renders the line in the Jarvis voice and plays it.

Falls back to the fixed WAV in sounds/ when there is no GROQ_API_KEY, the model call
fails, or voice rendering fails. Never raises: a failed cue must not break Claude Code.

Usage:
  echo "Done. All tests pass." | uv run agent/jarvis.py
  JARVIS_DRY=1 uv run agent/jarvis.py < reply.txt   # print cue and line, play nothing
"""

from __future__ import annotations

import os
import platform
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
SOUNDS = ROOT / "sounds"
VOICE = ROOT / "scripts" / "voice.mjs"

# Only the end of the reply is sent: it states what happens next, and it keeps the
# request small and fast.
TAIL_CHARS = 2000

Cue = Literal["needs-action", "completed", "blocked"]

FIXED_LINES: dict[str, str] = {
    "needs-action": "Sir, I am waiting for your approval.",
    "completed": "Sir, the task is complete.",
    "blocked": "Sir, I am blocked. I need your help.",
}

BLOCKED_WORDS = re.compile(
    r"\b(blocked|stuck|can(?:no|')t proceed|unable to (?:continue|proceed)|waiting (?:on|for) (?:you|someone)"
    r"|need(?:s)? (?:you|your) to|failed to)\b",
    re.I,
)


class Spoken(BaseModel):
    cue: Cue = Field(
        description="blocked if the assistant cannot continue without outside help; "
        "needs-action if it ends by asking the user a question or for approval; "
        "otherwise completed"
    )
    line: str = Field(description="One or two short sentences to speak aloud, starting with 'Sir,'")


INSTRUCTIONS = [
    "You are Jarvis, a calm, loyal AI butler. You read the end of a coding assistant's reply "
    "and tell your user, out loud, what happened.",
    "Start the line with 'Sir,'. Use 25 words at most. It will be spoken by a text-to-speech voice.",
    "Say what was done, or what is needed from the user, in plain spoken English.",
    "Never read out code, file paths, URLs, commands, version numbers or markdown. Describe them instead.",
    "If the reply is blocked, say what it is blocked on. If it asks a question, say what the question is about.",
    "Blocked wins over needs-action when both apply.",
]


def load_env() -> None:
    """Load GROQ_API_KEY and JARVIS_* from ROOT/.env without extra dependencies."""
    env = ROOT / ".env"
    if not env.is_file():
        return
    for raw in env.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def guess_cue(text: str) -> str:
    """Keyword fallback used when the model is unavailable."""
    tail = text[-600:]
    if BLOCKED_WORDS.search(tail):
        return "blocked"
    if tail.rstrip().endswith("?"):
        return "needs-action"
    return "completed"


def summarize(text: str) -> Spoken:
    from agno.agent import Agent
    from agno.models.groq import Groq

    model_id = os.environ.get("JARVIS_GROQ_MODEL")
    agent = Agent(
        model=Groq(id=model_id) if model_id else Groq(),
        instructions=INSTRUCTIONS,
        output_schema=Spoken,
        markdown=False,
    )
    result = agent.run(f"Assistant reply (end only):\n\n{text[-TAIL_CHARS:]}")
    spoken = result.content
    if not isinstance(spoken, Spoken):
        raise ValueError(f"unexpected model output: {spoken!r}")
    return spoken


def render(line: str) -> Path:
    out = Path(tempfile.gettempdir()) / "jarvis-cue.wav"
    subprocess.run(["node", str(VOICE), line, str(out)], check=True, capture_output=True, timeout=30)
    return out


def play(wav: Path) -> None:
    system = platform.system()
    if system == "Windows":
        cmd = ["powershell", "-NoProfile", "-Command", f"(New-Object Media.SoundPlayer '{wav}').PlaySync()"]
    elif system == "Darwin":
        cmd = ["afplay", str(wav)]
    else:
        cmd = ["paplay", str(wav)]
    subprocess.run(cmd, check=False, capture_output=True, timeout=60)


def main() -> None:
    load_env()
    text = sys.stdin.read().strip()
    dry = os.environ.get("JARVIS_DRY") == "1"

    cue = guess_cue(text) if text else "completed"
    line = FIXED_LINES[cue]
    source = "fixed"
    if text and os.environ.get("GROQ_API_KEY"):
        try:
            spoken = summarize(text)
            cue, line, source = spoken.cue, spoken.line, "groq"
        except Exception as err:  # noqa: BLE001 - any failure falls back to the fixed cue
            if dry:
                print(f"agent failed, using fixed cue: {err}", file=sys.stderr)

    if dry:
        print(f"{cue} ({source}): {line}")
        return

    wav = SOUNDS / f"{cue}.wav"
    if source == "groq":
        try:
            wav = render(line)
        except Exception:  # noqa: BLE001 - fall back to the fixed WAV
            pass
    if wav.is_file():
        play(wav)


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001 - never break Claude Code
        pass
