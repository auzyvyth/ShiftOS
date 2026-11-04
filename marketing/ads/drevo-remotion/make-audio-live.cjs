// node make-audio-live.cjs -> public/audio/live-<lang>.wav
// Cues from src/live/timeline.json and the moments in src/live/Live.jsx: headline word pops, the
// question bubble (0.15), the zoom rising (0.2), recorded taps inside each zoom (calc/budget clicks
// mapped through the scene's takeT), rings on the phone shots, the card, the pull-back, the CTA.
const fs = require('fs');
const { execFileSync } = require('child_process');
const T = JSON.parse(fs.readFileSync('src/live/timeline.json', 'utf8'));
const TL = {}, CARDS = {}, CLK = {};
let at = 0;
for (const [k, len, card, pre = 0] of T.scenes) { if (card) { CARDS[k] = [at, at + T.card]; at += T.card; } TL[k] = [at, at + len]; CLK[k] = at - pre; at += len; }
const DUR = +at.toFixed(3);
const words = { ms: { hook: 8, stakes: 5, clue1: 4, clue2: 3, clue3: 5, clue4: 5, clue5: 6, clue6: 6, answer: 6 },
                en: { hook: 10, stakes: 6, clue1: 6, clue2: 3, clue3: 6, clue4: 5, clue5: 6, clue6: 7, answer: 6 } };
const headAt = { answer: 0.9 };
// a clue's take: [take file, start, speed]; a recorded tap at take time c lands at (c - start) / speed
const takes = { clue1: ['calc', 0.6, 0.6], clue2: ['calc', 5.2, 0.6], clue4: ['calc', 2.5, 0.6], clue5: ['budget', 3.6, 1.2], answer: ['calc', 0.6, 1.3] };
fs.mkdirSync('public/audio', { recursive: true });
for (const lang of ['ms', 'en']) {
  const ev = [];
  const e = (t, type, x = {}) => ev.push({ t: +t.toFixed(3), type, ...x });
  for (const [k, n] of Object.entries(words[lang])) for (let i = 0; i < n; i++) e(CLK[k] + (headAt[k] ?? 0.05) + i * 0.065, 'pop', { g: 0.6 });
  e(CLK.hook + 0.6, 'whoosh');
  e(CLK.stakes + 0.3, 'swish'); e(CLK.stakes + 0.5, 'crumple');
  for (let n = 1; n <= 6; n++) { const k = `clue${n}`; e(CLK[k], 'swish'); e(CLK[k] + 0.15, 'ding', { g: 0.7 }); e(CLK[k] + 0.25, 'pop', { g: 0.7 }); }
  for (const [k, [file, start, speed]] of Object.entries(takes)) {
    const clicks = JSON.parse(fs.readFileSync(`src/${file}-${lang}.clicks.json`)).clicks;
    const end = TL[k][1] - CLK[k];
    clicks.forEach((c) => { const s = (c.t - start) / speed; if (s > 0.3 && s < end - 0.1) { e(CLK[k] + s, 'click'); e(CLK[k] + s + 0.02, 'tick'); } });
  }
  // rebate: screens swap at 1.3, ring at 1.7. Budget typing keys.
  e(CLK.clue3 + 1.3, 'click'); e(CLK.clue3 + 1.7, 'chime');
  for (let i = 0; i < 5; i++) e(CLK.clue5 + 0.35 + i * 0.08, 'key', { g: 0.5 });
  e(CLK.clue6 + 1.0, 'pop', { g: 0.6 }); e(CLK.clue6 + 1.2, 'pop', { g: 0.6 });
  for (const [a, b] of Object.values(CARDS)) { e(a - 0.04, 'strike', { card: 1 }); e(a, 'impact', { g: 0.6, card: 1 }); e(a + 0.05, 'pop', { g: 1, card: 1 }); e(b, 'swish', { card: 1 }); }
  e(CLK.answer + 0.15, 'whoosh'); e(CLK.answer + 1.1, 'win');
  e(TL.cta[0], 'impact'); e(TL.cta[0] + 0.2, 'pop', { g: 0.8 }); e(TL.cta[0] + 0.7, 'pop', { g: 0.9 }); e(TL.cta[0] + 1.0, 'pop', { g: 0.5 }); e(TL.cta[0] + 1.5, 'chime');
  const hidden = (x) => !x.card && Object.values(CARDS).some(([a, b]) => x.t >= a - 0.05 && x.t < b);
  for (let i = ev.length - 1; i >= 0; i--) if (hidden(ev[i])) ev.splice(i, 1);
  const data = { dur: DUR, ev: ev.sort((a, b) => a.t - b.t), silence: [CARDS.answer[0] - 0.35, CARDS.answer[0]], cta: TL.cta[0],
    risers: [[1.6, 1.4], [TL.clue3[0] - 1.2, 1.2], [CARDS.answer[0] - 2.0, 1.65], [TL.cta[0] - 1.2, 1.2]],
    breath: TL.stakes, ducks: Object.values(CARDS),
    arps: [[TL.clue1[0], TL.clue3[1]], [TL.clue4[0], TL.clue6[1] - 0.4], [TL.answer[0], TL.cta[1]]] };
  fs.writeFileSync(`public/audio/live-events-${lang}.json`, JSON.stringify(data));
  execFileSync('python3', ['score.py', `public/audio/live-events-${lang}.json`, `public/audio/live-${lang}.wav`], { stdio: 'inherit' });
}
