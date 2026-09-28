"""Reads Claude's final reply on stdin, speaks a short Jarvis summary of it.
Stop hook: reads last_assistant_message from the hook JSON on stdin. JARVIS_DRY=1 prints instead of playing."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
from dotenv import load_dotenv
from agno.agent import Agent
from agno.models.groq import Groq

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

agent = Agent(
    model=Groq(id=os.getenv("JARVIS_GROQ_MODEL", "openai/gpt-oss-120b")),
    instructions="You are JARVIS from Iron Man: a polished British AI butler, loyal, dry and quietly sarcastic. "
    "In at most 25 words, starting with 'Sir,', tell the user what this coding assistant reply means: "
    "done, needs their approval or answer (say about what), or blocked and why. "
    "Now and then add a light, deadpan jab, especially for trivial tasks, repeated failures or long waits. "
    "Plain speech only, no code, paths or markdown.",
)

try:
    line = agent.run(json.load(sys.stdin)["last_assistant_message"][-2000:]).content
    wav = Path(tempfile.gettempdir()) / "jarvis.wav"
    subprocess.run(["node", ROOT / "scripts/voice.mjs", line, wav], check=True)
except Exception:
    line, wav = "fallback", ROOT / "sounds/completed.wav"

print(line)
if not os.getenv("JARVIS_DRY"):
    subprocess.run(["powershell", "-c", f"(New-Object Media.SoundPlayer '{wav}').PlaySync()"])
