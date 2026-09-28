"""Reads Claude's final reply on stdin, speaks a short Jarvis summary of it.
Usage: echo "Done. Tests pass." | uv run agent/jarvis.py   (JARVIS_DRY=1 prints instead)"""
import os, subprocess, sys, tempfile
from pathlib import Path
from dotenv import load_dotenv
from agno.agent import Agent
from agno.models.groq import Groq

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

agent = Agent(
    model=Groq(id=os.getenv("JARVIS_GROQ_MODEL", "openai/gpt-oss-120b")),
    instructions="You are Jarvis. In one sentence of at most 20 words, starting with 'Sir,', tell the user "
    "what this coding assistant reply means: done, needs their approval or answer, or blocked and why. "
    "Plain speech only, no code, paths or markdown.",
)

try:
    line = agent.run(sys.stdin.read()[-2000:]).content
    wav = Path(tempfile.gettempdir()) / "jarvis.wav"
    subprocess.run(["node", ROOT / "scripts/voice.mjs", line, wav], check=True)
except Exception:
    line, wav = "fallback", ROOT / "sounds/completed.wav"

if os.getenv("JARVIS_DRY"):
    print(line)
else:
    subprocess.run(["powershell", "-c", f"(New-Object Media.SoundPlayer '{wav}').PlaySync()"])
