// node make-audio-intro.cjs -> public/audio/intro-<lang>.wav
// Cues come from the SAME timeline the picture reads (src/intro/timeline.json) and the moments
// set in src/intro/Intro.jsx (Contact tap 1.3 / ring 1.7, Report ring 1.2, CTA fields 0.9+i*0.18).
// Scenes reused from the Premium ad keep the cues make-audio.cjs gives them.
const fs = require('fs');
const { execFileSync } = require('child_process');
const T = JSON.parse(fs.readFileSync('src/intro/timeline.json', 'utf8'));
const TL = {}, CARDS = {}, CLK = {};
let at = 0;
for (const [k, len, card, pre = 0] of T.scenes) { if (card) { CARDS[k] = [at, at + T.card]; at += T.card; } TL[k] = [at, at + len]; CLK[k] = at - pre; at += len; }
const DUR = +at.toFixed(3);
const words = { ms: { calc: 4, budget: 5, contact: 5, page: 3, posters: 4, report: 4, stats: 6, sources: 4 },
                en: { calc: 5, budget: 5, contact: 7, page: 3, posters: 4, report: 6, stats: 7, sources: 5 } };
const startOf = { calc: 4.75, budget: CLK.budget + 0.15, contact: CLK.contact + 0.1, page: CLK.page + 0.1, posters: CLK.posters + 0.1,
  report: CLK.report + 0.1, stats: CLK.stats + 0.1, sources: CLK.sources + 0.1 };
fs.mkdirSync('public/audio', { recursive: true });
for (const lang of ['ms', 'en']) {
  const ev = [];
  const e = (t, type, x = {}) => ev.push({ t: +t.toFixed(3), type, ...x });
  e(0.25, 'pop', { g: 1 }); e(0.32, 'pop', { g: 1 });
  for (const [k, s] of Object.entries(startOf)) for (let i = 0; i < words[lang][k]; i++) e(s + i * 0.065, 'pop', { g: 0.6 });
  // hook + calculator (Premium ad cues)
  JSON.parse(fs.readFileSync(`src/calc-${lang}.clicks.json`)).clicks.forEach((c) => { e(c.t, 'click'); e(c.t + 0.02, 'tick'); });
  [1.0, 1.3, 1.6, 1.9, 2.2].forEach((t) => e(t, 'key', { g: 0.7, pan: -0.4 }));
  e(2.45, 'ding'); e(3.95, 'crumple'); e(4.05, 'whoosh');
  // budget (Premium ad cues)
  const bt = (takeT) => CLK.budget + (takeT - 0.3) / 1.3;
  JSON.parse(fs.readFileSync(`src/budget-${lang}.clicks.json`)).clicks.forEach((c) => e(bt(c.t), 'click'));
  [[0.8, 4], [4.7, 5], [6.3, 4]].forEach(([s, n]) => { for (let i = 0; i < n; i++) e(bt(s + 0.05 + i * 0.09), 'key', { g: 0.6 }); });
  e(bt(5.3), 'tick'); e(bt(6.9), 'tick');
  // chapter cards
  for (const [a, b] of Object.values(CARDS)) { e(a - 0.04, 'strike', { card: 1 }); e(a, 'impact', { g: 0.55, card: 1 }); e(a + 0.05, 'pop', { g: 1, card: 1 }); e(b, 'swish', { card: 1 }); }
  // contact: the tap shows the number, the banner is ringed
  e(CLK.contact + 0.3, 'swish'); e(CLK.contact + 1.3, 'click'); e(CLK.contact + 1.32, 'tick'); e(CLK.contact + 1.45, 'chime'); e(CLK.contact + 1.7, 'pop', { g: 0.7 });
  // page (Premium ad cues)
  for (let i = 0; i < 25; i++) e(CLK.page + 0.25 + i * 0.048, 'key', { g: 0.45 });
  e(CLK.page + 1.85, 'swish'); e(CLK.page + 3.1, 'swish');
  // posters (Premium ad cues)
  e(CLK.posters + 0.1, 'swish'); e(CLK.posters + 0.5, 'swish');
  // report: the screen rises, the tiles are ringed
  e(CLK.report + 0.3, 'swish'); e(CLK.report + 1.2, 'tick'); e(CLK.report + 1.22, 'pop', { g: 0.7 });
  // stats (Premium ad cues)
  e(CLK.stats + 0.3, 'pop', { g: 0.8 }); e(CLK.stats + 0.42, 'pop', { g: 0.8 }); e(CLK.stats + 0.54, 'pop', { g: 0.8 }); e(CLK.stats + 0.5, 'tick'); e(CLK.stats + 1.1, 'tick');
  // sources: the card rises
  e(CLK.sources + 0.3, 'swish'); e(CLK.sources + 0.7, 'pop', { g: 0.6 });
  // the ask: hit, two lines, four fields, the chip
  e(TL.cta[0], 'impact'); e(TL.cta[0] + 0.25, 'pop', { g: 0.8 }); e(TL.cta[0] + 0.7, 'pop', { g: 0.5 });
  for (let i = 0; i < 4; i++) e(TL.cta[0] + 0.9 + i * 0.18, 'pop', { g: 0.7 });
  e(TL.cta[0] + 1.9, 'chime');
  const hidden = (x) => !x.card && Object.values(CARDS).some(([a, b]) => x.t >= a - 0.05 && x.t < b);
  for (let i = ev.length - 1; i >= 0; i--) if (hidden(ev[i])) ev.splice(i, 1);
  const data = { dur: DUR, ev: ev.sort((a, b) => a.t - b.t), silence: [TL.cta[0] - 0.35, TL.cta[0]], cta: TL.cta[0],
    risers: [[2.6, 1.4], [CARDS.budget[0] - 1.2, 1.2], [CARDS.report[0] - 1.2, 1.2], [TL.cta[0] - 2.0, 1.65]],
    breath: TL.stats, ducks: Object.values(CARDS),
    arps: [[TL.contact[0], TL.posters[1]], [TL.report[0], TL.stats[1]], [TL.sources[0], TL.cta[0] - 0.4]] };
  fs.writeFileSync(`public/audio/intro-events-${lang}.json`, JSON.stringify(data));
  execFileSync('python3', ['score.py', `public/audio/intro-events-${lang}.json`, `public/audio/intro-${lang}.wav`], { stdio: 'inherit' });
}
