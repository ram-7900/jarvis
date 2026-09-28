// Generates the three default Jarvis cues as robot-voice WAV files in sounds/.
// Speech comes from the Windows built-in voice (System.Speech), then a robot effect
// is applied in pure Node. Generation needs Windows; the WAV files play everywhere.
// Run: node scripts/generate-sounds.mjs
import { writeFileSync, readFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const RATE = 44100;
const PEAK = 0.7;
const VOICE = "Microsoft David Desktop";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "sounds");

const CUES = {
  "needs-action": "Sir, I am waiting for your approval.",
  completed: "Sir, the task is complete.",
  blocked: "Sir, I am blocked. I need your help.",
};

// Robot effect settings.
const RING_HZ = 55; // ring modulator carrier; lower is more "Dalek"
const RING_MIX = 0.55; // 0 = clean voice, 1 = fully ring-modulated
const COMB_MS = 6; // short metallic resonance
const COMB_FEEDBACK = 0.55;
const CRUSH_BITS = 10; // mild bit reduction for a digital edge

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

function robotize(x) {
  const y = new Float64Array(x.length);
  // Ring modulation blended with the dry voice keeps words clear.
  for (let i = 0; i < x.length; i++) {
    const ring = x[i] * Math.sin((2 * Math.PI * RING_HZ * i) / RATE);
    y[i] = x[i] * (1 - RING_MIX) + ring * RING_MIX * 1.6;
  }
  // Feedback comb filter gives the hollow, metallic body.
  const d = Math.round((COMB_MS / 1000) * RATE);
  for (let i = d; i < y.length; i++) y[i] += y[i - d] * COMB_FEEDBACK;
  // Normalize, then bit-crush.
  let max = 0;
  for (const v of y) max = Math.max(max, Math.abs(v));
  const steps = 2 ** (CRUSH_BITS - 1);
  for (let i = 0; i < y.length; i++) y[i] = Math.round((y[i] / max) * steps) / steps;
  return y;
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
  samples.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * PEAK)) * 32767), 44 + i * 2));
  return b;
}

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "jarvis-"));
try {
  for (const [name, text] of Object.entries(CUES)) {
    const file = join(OUT, `${name}.wav`);
    writeFileSync(file, toWav(trim(robotize(speak(text, tmp)))));
    console.log(`wrote ${file}: "${text}"`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
