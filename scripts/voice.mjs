// Renders text as a Jarvis voice WAV: Windows built-in voice (System.Speech), then a light
// robot effect in pure Node. Rendering needs Windows; the WAV files play everywhere.
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
// Effect settings. Aim: a human voice with a light synthetic sheen, like an AI assistant.
// Raise RING_MIX and COMB_FEEDBACK for more robot; lower them for more human.
const RING_HZ = 90; // ring modulator carrier; lower is more "Dalek"
const RING_MIX = 0.07; // 0 = clean voice, 1 = fully ring-modulated
const COMB_MS = 3.5; // short metallic resonance
const COMB_FEEDBACK = 0.18;
const DOUBLE_MS = 14; // delayed copy that thickens the voice, like a speaker in a helmet
const DOUBLE_MIX = 0.15;
const ROOM_MIX = 0.07; // small room reverb so it sounds present, not dry

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
    y[i] = x[i] * (1 - RING_MIX) + ring * RING_MIX * 1.4;
  }
  // Feedback comb filter gives a light metallic body.
  const d = Math.round((COMB_MS / 1000) * RATE);
  for (let i = d; i < y.length; i++) y[i] += y[i - d] * COMB_FEEDBACK;
  // Doubling: add a delayed copy of the voice.
  const dd = Math.round((DOUBLE_MS / 1000) * RATE);
  for (let i = y.length - 1; i >= dd; i--) y[i] += y[i - dd] * DOUBLE_MIX;
  const out = room(y);
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  return out.map((v) => v / max);
}

// Small Schroeder reverb: parallel combs, then series allpasses.
function room(dry) {
  const tail = Math.floor(0.4 * RATE);
  const x = new Float64Array(dry.length + tail);
  x.set(dry);
  const combs = [1116, 1188, 1277, 1356].map((d) => ({ d, b: new Float64Array(d), i: 0 }));
  const aps = [556, 441].map((d) => ({ d, b: new Float64Array(d), i: 0 }));
  const out = new Float64Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let wet = 0;
    for (const c of combs) {
      const v = c.b[c.i];
      c.b[c.i] = x[n] + v * 0.7;
      c.i = (c.i + 1) % c.d;
      wet += v;
    }
    wet /= combs.length;
    for (const a of aps) {
      const v = a.b[a.i];
      const w = wet + v * 0.5;
      a.b[a.i] = w;
      a.i = (a.i + 1) % a.d;
      wet = v - w * 0.5;
    }
    out[n] = x[n] * (1 - ROOM_MIX) + wet * ROOM_MIX;
  }
  return out;
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
    return toWav(trim(robotize(speak(text, tmp))));
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
