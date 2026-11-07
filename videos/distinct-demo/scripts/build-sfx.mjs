// Builds the film's only sound track: assets/audio/distinct-sfx.wav.
// Every cue is tied to something that happens on screen. No music, no risers.
// Times mirror compositions/*.html. Run from the project root:
//   node scripts/build-sfx.mjs

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "assets", "audio", "distinct-sfx.wav");
const RATE = 48000;
const CHANNELS = 2;
const FILM_SECONDS = 60;
const MAX_PEAK_DB = -3;
const ONSET_RATIO = 0.1; // The attack starts where a sound first reaches 10% of its peak.
const TAIL_FADE_SECONDS = 0.35;

// Scene starts in the film, and marks inside browser.html.
const BROWSER = 10;
const CLOSING = 50;
const FAB_PRESS = BROWSER + 9.4;
const TOUR = BROWSER + 22;
const DEMO = BROWSER + 35.2;
const DOT_LANDS = 6 + 46 / 30; // Frame 46 of the 30 fps logo sting.

const TAB_COUNT = 15;
const TAB_START = 2.15;
const TAB_STEP = 0.105;

const CLICK_DB = -9;
const TICK_DB = -17;
const CHIP_DB = -14;

const tabClicks = Array.from({ length: TAB_COUNT }, (_, index) => ({
  at: TAB_START + index * TAB_STEP,
  sound: "key-press",
  db: -17 + index * 0.4 - (index % 3) * 1.5, // Grows as tabs pile up, with a little unevenness.
  note: `Rival tab ${index + 2} opens`,
}));

const clicks = (entries, db) => entries.map(([at, note]) => ({ at, sound: "click", db, note }));

const CUES = [
  ...tabClicks,
  { at: DOT_LANDS, sound: "pop", db: -7, note: "The aqua dot lands in the D" },
  ...clicks(
    [
      [BROWSER + 4.2, "Toolbar icon pressed"],
      [FAB_PRESS, "Round button pressed"],
      [TOUR + 2.2, "Competitor card pressed"],
      [TOUR + 4.407, "Competitor sheet closed"],
      [TOUR + 4.811, "Sites we left out pressed"],
      [TOUR + 6.622, "Left out sheet closed"],
      [TOUR + 7.027, "Recommended action pressed"],
      [TOUR + 9.229, "Sources pressed"],
      [BROWSER + 34.9, "Check now pressed"],
      [DEMO + 0.704, "Change pressed"],
      [DEMO + 2.03, "Propose test pressed"],
      [DEMO + 3.454, "Show on my page pressed"],
    ],
    CLICK_DB,
  ),
  ...clicks(
    [
      [FAB_PRESS + 1.53, "Step done: reading and market"],
      [FAB_PRESS + 2.85, "Step done: searching"],
      [FAB_PRESS + 6.24, "Step done: opening pages"],
      [BROWSER + 19.55, "Step done: report finished"],
    ],
    TICK_DB,
  ),
  { at: TOUR + 9.26, sound: "whoosh-short", db: -20, note: "Sources sheet slides up" },
  { at: BROWSER + 35.1, sound: "notification", db: -12, limit: 1.4, note: "Change is confirmed" },
  ...clicks(
    [
      [CLOSING + 1.05, "Chip: in-house marketers"],
      [CLOSING + 1.75, "Chip: freelancers"],
      [CLOSING + 2.45, "Chip: small store owners"],
    ],
    CHIP_DB,
  ),
  { at: CLOSING + 6.3, sound: "pop", db: -8, note: "3D logo lands. Silence after this." },
];

const decoded = new Map();

function decode(sound) {
  if (decoded.has(sound)) return decoded.get(sound);
  const file = join(ROOT, "assets", "sfx", `${sound}.mp3`);
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-f", "f32le", "-ac", String(CHANNELS), "-ar", String(RATE), "-"],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const peak = samples.reduce((top, value) => Math.max(top, Math.abs(value)), 0);
  const onsetIndex = samples.findIndex((value) => Math.abs(value) >= peak * ONSET_RATIO);
  const result = { samples, onset: Math.floor(onsetIndex / CHANNELS) };
  decoded.set(sound, result);
  return result;
}

function place(mix, cue) {
  const { samples, onset } = decode(cue.sound);
  const gain = 10 ** (cue.db / 20);
  const startFrame = Math.round(cue.at * RATE) - onset;
  if (startFrame < 0) throw new Error(`Cue starts before the film: ${cue.note}`);
  const available = samples.length / CHANNELS;
  const frames = cue.limit ? Math.min(available, Math.round((cue.limit) * RATE) + onset) : available;
  const fadeFrames = cue.limit ? Math.round(TAIL_FADE_SECONDS * RATE) : 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const left = frames - frame;
    const fade = fadeFrames && left < fadeFrames ? left / fadeFrames : 1;
    for (let channel = 0; channel < CHANNELS; channel += 1) {
      mix[(startFrame + frame) * CHANNELS + channel] += samples[frame * CHANNELS + channel] * gain * fade;
    }
  }
}

function toWav(mix) {
  const dataBytes = mix.length * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(CHANNELS, 22);
  wav.writeUInt32LE(RATE, 24);
  wav.writeUInt32LE(RATE * CHANNELS * 2, 28);
  wav.writeUInt16LE(CHANNELS * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataBytes, 40);
  mix.forEach((value, index) => {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + index * 2);
  });
  return wav;
}

const totalFrames = FILM_SECONDS * RATE;
const mix = new Float32Array(totalFrames * CHANNELS);
for (const cue of CUES) place(mix, cue);

const peak = mix.reduce((top, value) => Math.max(top, Math.abs(value)), 0);
const peakDb = 20 * Math.log10(peak);
if (peakDb > MAX_PEAK_DB) throw new Error(`Peak ${peakDb.toFixed(1)} dB is above ${MAX_PEAK_DB} dB.`);

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, toWav(mix));
console.log(`${CUES.length} cues, ${FILM_SECONDS} s, sample peak ${peakDb.toFixed(1)} dBFS -> ${OUTPUT}`);
