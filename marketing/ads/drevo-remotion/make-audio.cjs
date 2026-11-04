// node make-audio.cjs -> public/audio/mix-<lang>.wav
// Builds the cue list from the SAME timeline + recorded taps the picture uses, then runs score.py.
const fs = require('fs');
const { execFileSync } = require('child_process');
// the SAME timeline the picture uses (src/timeline.json -> src/lib.js builds it the same way)
const T = JSON.parse(fs.readFileSync('src/timeline.json', 'utf8'));
const TL = {}, CARDS = {};
let at = 0;
for (const [k, len, card] of T.scenes) { if (card) { CARDS[k] = [at, at + T.card]; at += T.card; } TL[k] = [at, at + len]; at += len; }
const DUR = +at.toFixed(3);
// a scene's clock starts `pre` early (under its card): cue its events from where its clock starts
const CLK = {}; for (const [k, , , pre = 0] of T.scenes) CLK[k] = TL[k][0] - pre;
const words = { ms: { hook: 5, calc: 4, budget: 5, leads: 4, stats: 6, coach: 5, studio: 4, posters: 4, page: 3, devices: 3 }, en: { hook: 5, calc: 5, budget: 5, leads: 4, stats: 7, coach: 7, studio: 5, posters: 4, page: 3, devices: 3 } };
const startOf = { calc: 4.75, budget: CLK.budget + 0.15, leads: CLK.leads + 0.1, stats: CLK.stats + 0.1, coach: CLK.coach + 0.1, studio: CLK.studio + 0.1, posters: CLK.posters + 0.1, page: CLK.page + 0.1, devices: CLK.devices + 0.05 };
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
  const bt = (takeT) => CLK.budget + (takeT - 0.3) / 1.3;
  bud.forEach((c) => e(bt(c.t), 'click'));
  [[0.8, 4], [4.7, 5], [6.3, 4]].forEach(([s, n]) => { for (let i = 0; i < n; i++) e(bt(s + 0.05 + i * 0.09), 'key', { g: 0.6 }); });
  e(bt(5.3), 'tick'); e(bt(6.9), 'tick');
  // chapter cards: a hit on the cut in, the topic word slams, a swish as the scene cuts in
  for (const [k, [a, b]] of Object.entries(CARDS)) { e(a - 0.04, 'strike', { card: 1 }); e(a, 'impact', { g: 0.55, card: 1 }); e(a + 0.05, 'pop', { g: 1, card: 1 }); e(b, 'swish', { card: 1 }); }
  [0.5, 1.0, 1.5, 3.6, 4.0, 4.4, 4.8].forEach((h, i) => e(CLK.leads + h, 'hop', { n: i }));
  e(CLK.leads + 1.9, 'chime'); e(CLK.leads + 2.4, 'chime'); e(CLK.leads + 4.85, 'win');
  e(CLK.stats + 0.3, 'pop', { g: 0.8 }); e(CLK.stats + 0.42, 'pop', { g: 0.8 }); e(CLK.stats + 0.54, 'pop', { g: 0.8 }); e(CLK.stats + 0.5, 'tick'); e(CLK.stats + 1.1, 'tick');
  [0.15, 0.45, 0.75].forEach((a) => e(CLK.coach + a, 'pop', { g: 0.8 })); e(CLK.coach + 2.3, 'click'); e(CLK.coach + 2.32, 'tick');
  e(CLK.studio + 0.7, 'pop', { g: 0.6 }); e(CLK.studio + 1.0, 'click'); e(CLK.studio + 1.0, 'scan');
  e(CLK.studio + 2.3, 'pop', { g: 0.6 }); e(CLK.studio + 2.6, 'click'); e(CLK.studio + 2.65, 'swish'); e(CLK.studio + 3.2, 'sparkle'); e(CLK.studio + 3.45, 'pop', { g: 0.8 });
  e(CLK.posters + 0.1, 'swish'); e(CLK.posters + 0.5, 'swish');
  for (let i = 0; i < 25; i++) e(CLK.page + 0.25 + i * 0.048, 'key', { g: 0.45 });
  e(CLK.page + 1.85, 'swish'); e(CLK.page + 3.1, 'swish');
  e(CLK.devices + 0.05, 'pop', { g: 0.7 }); e(CLK.devices + 0.25, 'pop', { g: 0.7 });
  e(TL.cta[0], 'impact'); e(TL.cta[0] + 1.1, 'pop', { g: 0.8 }); e(TL.cta[0] + 1.5, 'pop', { g: 0.6 });
  // what a scene does under its card is not seen, so it is not heard either
  const hidden = (x) => !x.card && Object.values(CARDS).some(([a, b]) => x.t >= a - 0.05 && x.t < b);
  for (let i = ev.length - 1; i >= 0; i--) if (hidden(ev[i])) ev.splice(i, 1);
  const data = { dur: DUR, ev: ev.sort((a, b) => a.t - b.t), silence: [TL.cta[0] - 0.35, TL.cta[0]], cta: TL.cta[0],
    risers: [[2.6, 1.4], [CARDS.budget[0] - 1.2, 1.2], [TL.leads[0] + 3.0, 1.8], [CARDS.studio[0] - 1.2, 1.2], [TL.cta[0] - 2.0, 1.65]],
    breath: TL.stats, ducks: Object.values(CARDS),
    arps: [[TL.leads[0], TL.stats[1]], [TL.studio[0], TL.posters[1]], [TL.page[0], TL.cta[0] - 0.4]] };
  fs.writeFileSync(`public/audio/events-${lang}.json`, JSON.stringify(data));
  execFileSync('python3', ['score.py', `public/audio/events-${lang}.json`, `public/audio/mix-${lang}.wav`], { stdio: 'inherit' });
}
