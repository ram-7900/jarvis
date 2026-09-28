"""Reads Claude's final reply on stdin, speaks a short Jarvis summary of it.
Stop hook: reads last_assistant_message from the hook JSON on stdin. JARVIS_DRY=1 prints instead of playing."""
import array, json, math, os, re, subprocess, sys, tempfile, textwrap, wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from dotenv import load_dotenv
from agno.agent import Agent
from agno.models.groq import Groq
import groq

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
PID = Path(tempfile.gettempdir()) / "jarvis.pid"
STOP = f"Get-Content '{PID}' -EA 0 | % {{ Stop-Process -Id $_ -Force -EA 0 }}"
sys.stdout.reconfigure(encoding="utf-8")  # hook stdout is cp1252; Groq sends curly quotes
VOICE = "daniel"  # Orpheus voices: autumn, diana, hannah, austin, daniel, troy


def orpheus(text, out):
    """Speak text with Groq Orpheus (200 chars max per call), sentences in parallel, joined into one WAV."""
    chunks = [c for s in re.split(r"(?<=[.!?])\s+", text) for c in textwrap.wrap(s, 190)]
    say = lambda c: groq.Groq().audio.speech.create(
        model="canopylabs/orpheus-v1-english", voice=VOICE, input=c, response_format="wav").read()
    with ThreadPoolExecutor() as pool:  # Groq streams WAV with 0xFFFFFFFF sizes; keep only the PCM
        pcm = array.array("h", b"".join(b[b.find(b"data") + 8:] for b in pool.map(say, chunks)))
    g = 3 / (max(map(abs, pcm)) or 1)  # soft limiter, same as DRIVE = 3 in voice.mjs: loud but clean
    pcm = array.array("h", (int(32400 * math.tanh(g * v) / math.tanh(3)) for v in pcm))
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(24000)
        w.writeframes(pcm.tobytes())

agent = Agent(
    model=Groq(id=os.getenv("JARVIS_GROQ_MODEL", "openai/gpt-oss-120b")),
    instructions="You are JARVIS from Iron Man: a polished British AI butler, loyal, dry and quietly sarcastic. "
    "Starting with 'Sir,', tell the user in a few natural spoken sentences what this coding assistant reply means: "
    "what was done and why it matters, what it needs from them (say about what), or what it is blocked on. "
    "Now and then add a light, deadpan jab, especially for trivial tasks, repeated failures or long waits. "
    "Plain speech only, no code, paths or markdown. You may start a sentence with one vocal tag "
    "such as [dry], [sarcastic] or [professionally].",
)

try:
    line = agent.run(json.load(sys.stdin)["last_assistant_message"][-2000:]).content
    wav = Path(tempfile.gettempdir()) / "jarvis.wav"
    subprocess.run(["powershell", "-c", STOP])  # a new line interrupts the old one
    try:
        orpheus(line, wav)
    except Exception:  # Windows voice if Groq TTS fails
        subprocess.run(["node", ROOT / "scripts/voice.mjs", re.sub(r"\[\w+\]", "", line), wav], check=True)
except Exception:
    line, wav = "fallback", ROOT / "sounds/completed.wav"

print(line)
if not os.getenv("JARVIS_DRY"):
    player = subprocess.Popen(["powershell", "-c", f"(New-Object Media.SoundPlayer '{wav}').PlaySync()"])
    PID.write_text(str(player.pid))
    player.wait()
