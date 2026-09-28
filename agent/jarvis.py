"""Reads Claude's final reply on stdin, speaks a short Jarvis summary of it.
Stop hook: reads last_assistant_message from the hook JSON on stdin. JARVIS_DRY=1 prints instead of playing."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
from dotenv import load_dotenv
from agno.agent import Agent
from agno.models.groq import Groq

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
PID = Path(tempfile.gettempdir()) / "jarvis.pid"
STOP = f"Get-Content '{PID}' -EA 0 | % {{ Stop-Process -Id $_ -Force -EA 0 }}"
sys.stdout.reconfigure(encoding="utf-8")  # hook stdout is cp1252; Groq sends curly quotes

agent = Agent(
    model=Groq(id=os.getenv("JARVIS_GROQ_MODEL", "openai/gpt-oss-120b")),
    instructions="You are JARVIS from Iron Man: a polished British AI butler, loyal, dry and quietly sarcastic. "
    "Starting with 'Sir,', tell the user in a few natural spoken sentences what this coding assistant reply means: "
    "what was done and why it matters, what it needs from them (say about what), or what it is blocked on. "
    "Now and then add a light, deadpan jab, especially for trivial tasks, repeated failures or long waits. "
    "Plain speech only, no code, paths or markdown.",
)

try:
    line = agent.run(json.load(sys.stdin)["last_assistant_message"][-2000:]).content
    wav = Path(tempfile.gettempdir()) / "jarvis.wav"
    subprocess.run(["powershell", "-c", STOP])  # a new line interrupts the old one
    subprocess.run(["node", ROOT / "scripts/voice.mjs", line, wav], check=True)
except Exception:
    line, wav = "fallback", ROOT / "sounds/completed.wav"

print(line)
if not os.getenv("JARVIS_DRY"):
    player = subprocess.Popen(["powershell", "-c", f"(New-Object Media.SoundPlayer '{wav}').PlaySync()"])
    PID.write_text(str(player.pid))
    player.wait()
