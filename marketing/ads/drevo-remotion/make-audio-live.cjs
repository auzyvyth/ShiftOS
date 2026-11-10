// node make-audio-live.cjs -> public/audio/live-<lang>.wav
// Cues come from the SAME timing file the picture reads (src/live/timeline.json) and the
// moments set in src/live/Live.jsx (headline at, the push, the tap, the rings, the chips).
const fs = require('fs');
const { execFileSync } = require('child_process');
const T = JSON.parse(fs.readFileSync('src/live/timeline.json', 'utf8'));
const S = {}; for (const [k, at, len, card] of T.scenes) S[k] = { at, end: at + len, card };
const CARDS = T.scenes.filter((s) => s[3]).map(([, at]) => [at, at + T.card]);
const words = { ms: { hook: 6, free: 3, rebate: 4, lead: 6, viewer: 5 }, en: { hook: 8, free: 3, rebate: 5, lead: 7, viewer: 5 } };
const headAt = { hook: 0.05, free: 0.05, rebate: 0.85, lead: 0.85, viewer: 0.85 };
fs.mkdirSync('public/audio', { recursive: true });
for (const lang of ['ms', 'en']) {
  const ev = [];
  const e = (t, type, x = {}) => ev.push({ t: +t.toFixed(3), type, ...x });
  for (const [k, n] of Object.entries(words[lang])) for (let i = 0; i < n; i++) e(S[k].at + headAt[k] + i * 0.065, 'pop', { g: 0.6 });
  e(0.15, 'pop', { g: 0.8 });                                         // hook: the calculator rises
  e(1.0, 'ding'); e(1.05, 'pop', { g: 0.8 });                         // the lead notification lands
  e(S.free.at - 0.05, 'whoosh');                                      // one move into "free", no card
  e(S.free.at + 0.9, 'click'); e(S.free.at + 0.92, 'tick');           // tap 9 years, the monthly changes
  e(S.free.at + 1.2, 'pop', { g: 0.8 });                              // the "Free. No card." pill
  for (const [a, b] of CARDS) { e(a - 0.04, 'strike', { card: 1 }); e(a, 'impact', { g: 0.55, card: 1 }); e(a + 0.05, 'pop', { g: 1, card: 1 }); e(b, 'swish', { card: 1 }); }
  e(S.rebate.at + 1.5, 'tick'); e(S.rebate.at + 1.52, 'pop', { g: 0.6 });   // ring on Rebate
  e(S.rebate.at + 2.3, 'click'); e(S.rebate.at + 2.32, 'tick');             // NCD 45%
  for (let i = 0; i < 3; i++) e(S.lead.at + 1.3 + i * 0.35, 'pop', { g: 0.7 }); // the three steps
  e(S.lead.at + 2.5, 'ding'); e(S.lead.at + 2.55, 'pop', { g: 0.8 });       // the lead lands
  e(S.viewer.at + 1.4, 'chime'); e(S.viewer.at + 2.4, 'pop', { g: 0.8 });   // the answer, the Premium pill
  e(S.cta.at, 'impact'); e(S.cta.at + 1.1, 'pop', { g: 0.8 }); e(S.cta.at + 1.5, 'pop', { g: 0.6 });
  const hidden = (x) => !x.card && CARDS.some(([a, b]) => x.t >= a - 0.05 && x.t < b);
  for (let i = ev.length - 1; i >= 0; i--) if (hidden(ev[i])) ev.splice(i, 1);
  const data = { dur: T.dur, ev: ev.sort((a, b) => a.t - b.t), silence: [S.cta.at - 0.35, S.cta.at], cta: S.cta.at,
    risers: [[CARDS[0][0] - 1.2, 1.2], [CARDS[1][0] - 1.2, 1.2], [CARDS[2][0] - 1.2, 1.2], [S.cta.at - 2.0, 1.65]],
    breath: [S.free.at, S.free.end], ducks: CARDS,
    arps: [[CARDS[0][1], S.lead.at], [CARDS[1][1], S.viewer.at], [CARDS[2][1], S.cta.at - 0.4]] };
  fs.writeFileSync(`public/audio/live-events-${lang}.json`, JSON.stringify(data));
  execFileSync('python3', ['score.py', `public/audio/live-events-${lang}.json`, `public/audio/live-${lang}.wav`], { stdio: 'inherit' });
}
