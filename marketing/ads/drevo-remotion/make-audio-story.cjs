// node make-audio-story.cjs -> public/audio/story-<lang>.wav
// Cues from the SAME timing file the picture reads (src/live/story.json) and the moments set in
// src/live/LiveStory.jsx (words, comment cards, the cell, the beam, the tap, the cuts between captures).
const fs = require('fs');
const { execFileSync } = require('child_process');
const T = JSON.parse(fs.readFileSync('src/live/story.json', 'utf8'));
const S = {}; for (const [k, at, len] of T.scenes) S[k] = { at, end: at + len };
fs.mkdirSync('public/audio', { recursive: true });
for (const lang of ['ms', 'en']) {
  const ev = [];
  const e = (t, type, x = {}) => ev.push({ t: +t.toFixed(3), type, ...x });
  for (const k of Object.keys(S)) if (k !== 'live') e(S[k].at - 0.03, k === 'excel' || k === 'cta' ? 'impact' : 'whoosh', { g: 0.6 });   // every beat is a hard cut
  e(0.02, 'impact', { g: 0.5 }); e(0.35, 'pop', { g: 0.6 });
  for (let i = 0; i < 3; i++) e(0.7 + i * 0.28, 'pop', { g: 0.8 });                         // the three comments
  e(S.excel.at + 0.15, 'tick'); e(S.excel.at + 0.5, 'click'); e(S.excel.at + 0.95, 'tick'); // the lone cell, "that's all"
  e(S.lead.at + 0.4, 'pop', { g: 0.7 }); e(S.lead.at + 0.75, 'ding'); e(S.lead.at + 0.8, 'pop', { g: 0.8 });   // the lead lands
  e(S.free.at + 0.12, 'pop', { g: 0.8 }); e(S.free.at + 1.0, 'pop', { g: 0.6 }); e(S.free.at + 1.5, 'click'); e(S.free.at + 1.52, 'tick');
  e(S.rebate.at + 0.12, 'pop', { g: 0.8 }); e(S.rebate.at + 1.0, 'click'); e(S.rebate.at + 1.02, 'tick'); e(S.rebate.at + 2.0, 'click'); e(S.rebate.at + 2.02, 'tick');
  e(S.viewer.at + 0.12, 'pop', { g: 0.8 }); e(S.viewer.at + 1.3, 'chime'); e(S.viewer.at + 1.0, 'pop', { g: 0.6 });
  e(S.cta.at + 0.45, 'pop', { g: 0.6 }); e(S.cta.at + 0.8, 'pop', { g: 1 }); e(S.cta.at + 1.2, 'pop', { g: 0.8 });
  const data = { dur: T.dur, ev: ev.sort((a, b) => a.t - b.t), silence: [S.cta.at - 0.3, S.cta.at], cta: S.cta.at,
    risers: [[S.lead.at - 1.2, 1.2], [S.free.at - 1.0, 1.0], [S.cta.at - 1.8, 1.5]],
    breath: [S.excel.at, S.excel.end], ducks: [],
    arps: [[S.free.at, S.rebate.at], [S.rebate.at, S.viewer.at], [S.viewer.at, S.cta.at - 0.4]] };
  fs.writeFileSync(`public/audio/story-events-${lang}.json`, JSON.stringify(data));
  execFileSync('python3', ['score.py', `public/audio/story-events-${lang}.json`, `public/audio/story-${lang}.wav`], { stdio: 'inherit' });
}
