// node make-audio-renewals.cjs -> public/audio/renewals-<lang>.wav
// Cues come from the SAME timing file the picture reads (src/renewals/timeline.json) and the
// moments set in src/renewals/Renewals.jsx (headline at, pops, the ring, the tap).
const fs = require('fs');
const { execFileSync } = require('child_process');
const T = JSON.parse(fs.readFileSync('src/renewals/timeline.json', 'utf8'));
const S = {}; for (const [k, at, len, card] of T.scenes) S[k] = { at, end: at + len, card };
const CARDS = T.scenes.filter((s) => s[3]).map(([, at]) => [at, at + T.card]);
// words per headline (each word pops in), and when each headline starts (Renewals.jsx `at`)
const words = { ms: { hook: 6, forget: 4, dates: 4, remind: 6, next: 6 }, en: { hook: 7, forget: 4, dates: 5, remind: 5, next: 7 } };
const headAt = { hook: 0.05, forget: 0.05, dates: 0.85, remind: 0.85, next: 0.85 };
fs.mkdirSync('public/audio', { recursive: true });
for (const lang of ['ms', 'en']) {
  const ev = [];
  const e = (t, type, x = {}) => ev.push({ t: +t.toFixed(3), type, ...x });
  for (const [k, n] of Object.entries(words[lang])) for (let i = 0; i < n; i++) e(S[k].at + headAt[k] + i * 0.065, 'pop', { g: 0.6 });
  // hook: the notification lands
  e(0.5, 'ding'); e(0.55, 'pop', { g: 0.8 });
  // forget: a move with no card (same topic), the sticker line and the Coming up card rise
  e(S.forget.at - 0.05, 'whoosh'); e(S.forget.at + 0.3, 'pop', { g: 0.7 }); e(S.forget.at + 0.55, 'pop', { g: 0.8 });
  // chapter cards: hit on the cut in, the topic slams, a swish as the scene cuts in
  for (const [a, b] of CARDS) { e(a - 0.04, 'strike', { card: 1 }); e(a, 'impact', { g: 0.55, card: 1 }); e(a + 0.05, 'pop', { g: 1, card: 1 }); e(b, 'swish', { card: 1 }); }
  e(S.dates.at + 1.6, 'tick'); e(S.dates.at + 1.62, 'pop', { g: 0.6 });               // the ring on the expiry date
  e(S.remind.at + 2.0, 'click'); e(S.remind.at + 2.02, 'tick'); e(S.remind.at + 2.3, 'chime'); // tap Remind, the draft rises
  e(S.next.at + 1.5, 'tick'); e(S.next.at + 1.52, 'pop', { g: 0.6 });                  // the ring on Trade-up ready
  e(S.cta.at, 'impact'); e(S.cta.at + 1.1, 'pop', { g: 0.8 }); e(S.cta.at + 1.5, 'pop', { g: 0.6 });
  // what happens under a card is not seen, so it is not heard either
  const hidden = (x) => !x.card && CARDS.some(([a, b]) => x.t >= a - 0.05 && x.t < b);
  for (let i = ev.length - 1; i >= 0; i--) if (hidden(ev[i])) ev.splice(i, 1);
  const data = { dur: T.dur, ev: ev.sort((a, b) => a.t - b.t), silence: [S.cta.at - 0.35, S.cta.at], cta: S.cta.at,
    risers: [[2.8, 1.2], [CARDS[0][0] - 1.2, 1.2], [CARDS[1][0] - 1.2, 1.2], [S.cta.at - 2.0, 1.65]],
    breath: [S.forget.at, S.forget.end], ducks: CARDS,
    arps: [[CARDS[0][1], S.remind.at], [CARDS[1][1], S.next.at], [CARDS[2][1], S.cta.at - 0.4]] };
  fs.writeFileSync(`public/audio/renewals-events-${lang}.json`, JSON.stringify(data));
  execFileSync('python3', ['score.py', `public/audio/renewals-events-${lang}.json`, `public/audio/renewals-${lang}.wav`], { stdio: 'inherit' });
}
