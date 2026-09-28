// Generates the three fixed Jarvis cues in sounds/. These play when the summary agent
// is off, has no API key, or fails. Run on Windows: node scripts/generate-sounds.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { voiceWav } from "./voice.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "sounds");

const CUES = {
  "needs-action": "Sir, I am waiting for your approval.",
  completed: "Sir, the task is complete.",
  blocked: "Sir, I am blocked. I need your help.",
};

mkdirSync(OUT, { recursive: true });
for (const [name, text] of Object.entries(CUES)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, voiceWav(text));
  console.log(`wrote ${file}: "${text}"`);
}
