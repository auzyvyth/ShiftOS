// Acting on every word (owner, 2026-11-22: "the details is in the expressions on every word").
// A script line carries tags in braces right before the word they land on:
//   'Completely {squint}{grin}standard {armOut}supercar'
// A tag changes the face/arms from that word on, until the next tag or the end of the line.
// Lip-sync comes from the voice track's loudness, not a timer.
import { execFileSync } from 'node:child_process';

const EYES = ['neutral', 'happy', 'shock', 'sly', 'suspicious', 'angry', 'cry', 'dizzy', 'stars', 'wink', 'nervous', 'up', 'side', 'squint', 'blink'];
const MOUTHS = ['closed', 'grin', 'frown', 'wavy', 'scream', 'smirk', 'wail', 'grimace', 'o'];
const ARMS = {
  armDown: { armL: 10, armR: -10, pointR: false }, armOut: { armR: -95, pointR: false }, armUp: { armR: -165, pointR: false },
  point: { armR: -95, pointR: true }, pointUp: { armR: -165, pointR: true }, bothUp: { armL: 160, armR: -160, pointR: false },
  shrug: { armL: 60, armR: -60, pointR: false }, leftOut: { armL: 95 }, headHands: { armL: 168, armR: -168, pointR: false },
};
const FLAGS = ['sweat', 'tears', 'blush', 'vein', 'shades'];

export function tagToPose(tag) {
  if (EYES.includes(tag)) return { eyes: tag };
  if (MOUTHS.includes(tag)) return { mouth: tag };
  if (ARMS[tag]) return ARMS[tag];
  if (FLAGS.includes(tag)) return { [tag]: true };
  if (tag.startsWith('no')) return { [tag.slice(2).toLowerCase()]: false };
  if (tag === 'red') return { tint: true };
  if (tag === 'green') return { tint: 'green' };
  throw new Error(`unknown acting tag {${tag}}`);
}

// 'a {armOut}dead {shock}battery!' -> { text: 'a dead battery!', marks: [{at: 0.13, pose}, ...] } (at = 0..1 of the line)
export function parseLine(src) {
  const marks = []; let text = '';
  const re = /\{(\w+)\}/g; let last = 0, m;
  while ((m = re.exec(src))) { text += src.slice(last, m.index); marks.push({ pos: text.length, pose: tagToPose(m[1]) }); last = re.lastIndex; }
  text += src.slice(last);
  const len = Math.max(text.length, 1);
  return { text, marks: marks.map((k) => ({ at: k.pos / len, pose: k.pose })) };
}

// Pose at time t for a line spoken from s to e: base, then every mark whose word has started.
export function actAt(line, s, e, t, base = {}) {
  const p = { ...base }; const k = (t - s) / Math.max(e - s, 0.01);
  for (const m of line.marks) if (k >= m.at) Object.assign(p, m.pose);
  return p;
}

// Loudness per video frame (0..1, normalised to the loud end of the track).
export function loudness(file, fps = 30) {
  const sr = 24000, per = sr / fps;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 's16le', '-'], { maxBuffer: 1 << 29 });
  const n = Math.floor(raw.length / 2 / per), out = new Float32Array(n);
  for (let f = 0; f < n; f++) { let sum = 0; for (let i = 0; i < per; i++) { const v = raw.readInt16LE((f * per + i) * 2) / 32768; sum += v * v; } out[f] = Math.sqrt(sum / per); }
  const sorted = [...out].sort((a, b) => a - b), top = sorted[Math.floor(n * 0.97)] || 1;
  return out.map((v) => Math.min(v / top, 1));
}

// Mouth from loudness: quiet = the face's own mouth, speaking = open, loud = wide.
export function lipMouth(level, resting) {
  if (['scream', 'wail'].includes(resting)) return resting;
  if (level < 0.12) return resting === 'o' ? 'o' : resting || 'closed';
  return level > 0.62 ? 'o' : 'talk';
}
