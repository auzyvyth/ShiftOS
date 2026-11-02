// node make-audio.cjs -> public/audio/mix-<lang>.wav
// Builds the cue list from the SAME timeline + recorded taps the picture uses, then runs score.py.
const fs = require('fs');
const { execFileSync } = require('child_process');
const TL = { hook: [0, 4.6], calc: [4.6, 9.8], budget: [9.8, 15.4], leads: [15.4, 21.0], stats: [21.0, 24.4], studio: [24.4, 30.4], posters: [30.4, 35.0], page: [35.0, 40.6], devices: [40.6, 42.7], cta: [42.7, 47.5] };
const DUR = 47.5;
// keep in step with src/lib.js TL (checked below)
const lib = fs.readFileSync('src/lib.js', 'utf8');
for (const [k, [a, b]] of Object.entries(TL)) {
  const m = lib.match(new RegExp(`\\b${k}: \\[([\\d.]+), ([\\d.]+)\\]`));
  if (!m || +m[1] !== a || +m[2] !== b) throw new Error(`timeline drift: ${k}`);
}
const OV = 0.3, OVERLAP = ['leads', 'stats', 'studio', 'posters', 'page', 'devices'];
// overlapped scenes run OV ahead: shift their slot start so cues follow the picture
for (const k of OVERLAP) TL[k] = [TL[k][0] - OV, TL[k][1]];
const words = { ms: { hook: 5, calc: 4, budget: 5, leads: 4, stats: 4, studio: 4, posters: 4, page: 3, devices: 3 }, en: { hook: 5, calc: 5, budget: 5, leads: 4, stats: 4, studio: 5, posters: 4, page: 3, devices: 3 } };
const startOf = { calc: 4.75, budget: TL.budget[0] + 0.15, leads: TL.leads[0] + 0.1, stats: TL.stats[0] + 0.1, studio: TL.studio[0] + 0.1, posters: TL.posters[0] + 0.1, page: TL.page[0] + 0.1, devices: TL.devices[0] + 0.05 };
fs.mkdirSync('public/audio', { recursive: true });
for (const lang of ['ms', 'en']) {
  const ev = [];
  const e = (t, type, x = {}) => ev.push({ t: +t.toFixed(3), type, ...x });
  e(0.25, 'pop', { g: 1 }); e(0.32, 'pop', { g: 1 });
  for (const [k, at] of Object.entries(startOf)) for (let i = 0; i < words[lang][k]; i++) e(at + i * 0.065, 'pop', { g: 0.6 });
  const calc = JSON.parse(fs.readFileSync(`src/calc-${lang}.clicks.json`)).clicks;
  calc.forEach((c) => { e(c.t, 'click'); e(c.t + 0.02, 'tick'); });
  [1.0, 1.3, 1.6, 1.9, 2.2].forEach((t) => e(t, 'key', { g: 0.7, pan: -0.4 }));
  e(2.45, 'ding'); e(3.95, 'crumple'); e(4.05, 'whoosh');
  const bud = JSON.parse(fs.readFileSync(`src/budget-${lang}.clicks.json`)).clicks;
  const bt = (takeT) => TL.budget[0] + (takeT - 0.3) / 1.3;
  bud.forEach((c) => e(bt(c.t), 'click'));
  [[0.8, 4], [4.7, 5], [6.3, 4]].forEach(([s, n]) => { for (let i = 0; i < n; i++) e(bt(s + 0.05 + i * 0.09), 'key', { g: 0.6 }); });
  e(bt(5.3), 'tick'); e(bt(6.9), 'tick');
  for (const k of ['budget', 'leads', 'stats', 'studio', 'posters', 'page', 'devices']) e(TL[k][0] - 0.12, k === 'budget' ? 'swish' : 'whoosh');
  [0.5, 1.0, 1.5, 3.6, 4.0, 4.4, 4.8].forEach((h, i) => e(TL.leads[0] + h, 'hop', { n: i }));
  e(TL.leads[0] + 1.9, 'chime'); e(TL.leads[0] + 2.4, 'chime'); e(TL.leads[0] + 4.85, 'win');
  e(TL.stats[0] + 0.3, 'pop', { g: 0.8 }); e(TL.stats[0] + 0.45, 'pop', { g: 0.8 }); e(TL.stats[0] + 0.5, 'tick'); e(TL.stats[0] + 1.1, 'tick');
  e(TL.studio[0] + 0.7, 'pop', { g: 0.6 }); e(TL.studio[0] + 1.0, 'click'); e(TL.studio[0] + 1.0, 'scan');
  e(TL.studio[0] + 2.3, 'pop', { g: 0.6 }); e(TL.studio[0] + 2.6, 'click'); e(TL.studio[0] + 2.65, 'swish'); e(TL.studio[0] + 3.2, 'sparkle'); e(TL.studio[0] + 3.45, 'pop', { g: 0.8 });
  e(TL.posters[0] + 0.1, 'swish'); e(TL.posters[0] + 0.5, 'swish');
  for (let i = 0; i < 25; i++) e(TL.page[0] + 0.25 + i * 0.048, 'key', { g: 0.45 });
  e(TL.page[0] + 1.85, 'swish'); e(TL.page[0] + 3.1, 'swish');
  e(TL.devices[0] + 0.05, 'pop', { g: 0.7 }); e(TL.devices[0] + 0.25, 'pop', { g: 0.7 });
  e(TL.cta[0], 'impact'); e(TL.cta[0] + 1.1, 'pop', { g: 0.8 }); e(TL.cta[0] + 1.5, 'pop', { g: 0.6 });
  const data = { dur: DUR, ev: ev.sort((a, b) => a.t - b.t), silence: [TL.cta[0] - 0.35, TL.cta[0]], cta: TL.cta[0],
    risers: [[2.6, 1.4], [TL.budget[0] - 1.2, 1.2], [TL.leads[0] + 3.0, 1.8], [TL.studio[0] - 1.2, 1.2], [TL.cta[0] - 2.0, 1.65]],
    arps: [[TL.leads[0], TL.stats[1]], [TL.studio[0], TL.posters[1]], [TL.page[0], TL.cta[0] - 0.4]] };
  fs.writeFileSync(`public/audio/events-${lang}.json`, JSON.stringify(data));
  execFileSync('python3', ['score.py', `public/audio/events-${lang}.json`, `public/audio/mix-${lang}.wav`], { stdio: 'inherit' });
}
