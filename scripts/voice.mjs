// Renders text as a Jarvis voice WAV: Windows built-in voice (System.Speech), then
// normalized and made loud in pure Node. Rendering needs Windows; the WAV files play everywhere.
// CLI: node scripts/voice.mjs "<text>" <out.wav>
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const RATE = 44100;
const PEAK = 0.99; // just under full scale
const DRIVE = 3; // soft-limiter drive; higher is louder on average but harsher
const VOICE = "Microsoft David Desktop";

const PS = `
param([string]$Text, [string]$Out, [string]$Voice)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $s.SelectVoice($Voice) } catch {}
$s.Rate = -1
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${RATE}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile($Out, $fmt)
$s.Speak($Text)
$s.Dispose()
`;

function speak(text, dir) {
  const script = join(dir, "speak.ps1");
  const out = join(dir, "speech.wav");
  writeFileSync(script, PS);
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Text", text, "-Out", out, "-Voice", VOICE]);
  return readWav(readFileSync(out));
}

// Reads 16-bit mono PCM, walking chunks so extra headers do not break it.
function readWav(b) {
  let p = 12;
  while (p < b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "data") {
      const n = size / 2;
      const s = new Float64Array(n);
      for (let i = 0; i < n; i++) s[i] = b.readInt16LE(p + 8 + i * 2) / 32768;
      return s;
    }
    p += 8 + size + (size % 2);
  }
  throw new Error("no data chunk");
}

function normalize(x) {
  let max = 0;
  for (const v of x) max = Math.max(max, Math.abs(v));
  return x.map((v) => v / max);
}

// Trim leading and trailing silence, then add 50 ms of padding each side.
function trim(x) {
  let a = 0;
  let b = x.length - 1;
  while (a < b && Math.abs(x[a]) < 0.01) a++;
  while (b > a && Math.abs(x[b]) < 0.01) b--;
  const pad = Math.floor(0.05 * RATE);
  const out = new Float64Array(b - a + 1 + pad * 2);
  out.set(x.subarray(a, b + 1), pad);
  return out;
}

function toWav(samples) {
  const data = samples.length * 2;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + data, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(data, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (Math.tanh(v * DRIVE) / Math.tanh(DRIVE)) * PEAK)) * 32767), 44 + i * 2));
  return b;
}

// Returns a WAV Buffer of the text spoken in the Jarvis voice.
export function voiceWav(text) {
  const tmp = mkdtempSync(join(tmpdir(), "jarvis-"));
  try {
    return toWav(trim(normalize(speak(text, tmp))));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [text, out] = process.argv.slice(2);
  if (!text || !out) {
    console.error("usage: node scripts/voice.mjs \"<text>\" <out.wav>");
    process.exit(2);
  }
  writeFileSync(out, voiceWav(text));
}
