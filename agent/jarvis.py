"""Reads Claude's final reply on stdin, speaks a short Jarvis summary of it.
Stop hook: reads last_assistant_message from the hook JSON on stdin. JARVIS_DRY=1 prints instead of playing."""
import array, io, json, math, os, subprocess, sys, tempfile, wave
from pathlib import Path
from dotenv import load_dotenv
from agno.agent import Agent
from agno.models.groq import Groq
from piper import PiperVoice

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
PID = Path(tempfile.gettempdir()) / "jarvis.pid"
STOP = f"Get-Content '{PID}' -EA 0 | % {{ Stop-Process -Id $_ -Force -EA 0 }}"
sys.stdout.reconfigure(encoding="utf-8")  # hook stdout is cp1252; Groq sends curly quotes
VOICE = "en_GB-northern_english_male-medium"  # any Piper voice: https://huggingface.co/rhasspy/piper-voices
VOICES = Path(os.getenv("CLAUDE_PLUGIN_DATA", ROOT / ".voices"))  # survives plugin updates


def speak(text, out):
    """Local Piper voice, downloaded once, then soft-limited so it is loud but clean."""
    model = VOICES / f"{VOICE}.onnx"
    if not model.exists():
        VOICES.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, "-m", "piper.download_voices", "--download-dir", VOICES, VOICE], check=True)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        PiperVoice.load(model).synthesize_wav(text, w)
    buf.seek(0)
    with wave.open(buf) as r:
        rate, pcm = r.getframerate(), array.array("h", r.readframes(r.getnframes()))
    g = 3 / (max(map(abs, pcm)) or 1)  # same as DRIVE = 3 in voice.mjs
    pcm = array.array("h", (int(32400 * math.tanh(g * v) / math.tanh(3)) for v in pcm))
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(rate)
        w.writeframes(pcm.tobytes())

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
    try:
        speak(line, wav)
    except Exception:  # Windows voice if Piper fails
        subprocess.run(["node", ROOT / "scripts/voice.mjs", line, wav], check=True)
except Exception:
    line, wav = "fallback", ROOT / "sounds/completed.wav"

print(line)
if not os.getenv("JARVIS_DRY"):
    player = subprocess.Popen(["powershell", "-c", f"(New-Object Media.SoundPlayer '{wav}').PlaySync()"])
    PID.write_text(str(player.pid))
    player.wait()
