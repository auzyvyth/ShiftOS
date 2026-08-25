// Geometry guard for the product tour card. The tour used to place its card
// from a hardcoded branch per surface with a guessed 220px height, so on
// desktop it sat on top of the panel it was describing (worst case: the
// invite-code box on the 'Join a Dealership' step) and a tall card ran off
// screen. Rule under test: the card never overlaps its target and never
// leaves the viewport. Run with: npm run test:tour
import { placeTourCard } from '../src/utils/tourPlacement.js';

const rect = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h });
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
let fail = 0;
const check = (name, cond, extra = '') => { if (!cond) { console.log('FAIL', name, extra); fail++; } else console.log('ok  ', name); };

// 1. No target -> centred
const c = placeTourCard(null, { w: 300, h: 240 }, 1440, 800);
check('welcome centres', c.style.top === '50%' && c.arrow === null);

// 2/3/4/5. Never overlaps the target, always inside the viewport
const cases = [
  ['desktop sidebar item', rect(8, 120, 184, 34), 1440, 800],
  ['desktop settings nav (low)', rect(8, 520, 184, 34), 1440, 800],
  ['mobile bottom nav', rect(120, 740, 41, 60), 375, 800],
  ['bookings pill near top', rect(224, 90, 96, 30), 1440, 800],
  ['invite box mid-content', rect(224, 200, 640, 260), 1440, 800],
  ['short laptop, tall card', rect(8, 300, 184, 34), 1280, 620],
  ['mobile, full-width heading', rect(16, 60, 343, 26), 375, 700],
  ['target fills viewport', rect(0, 0, 1440, 800), 1440, 800],
];
for (const [name, target, vw, vh] of cases) {
  const h = 275, w = vw < 768 ? Math.min(320, vw - 32) : 300;
  const { style } = placeTourCard(target, { w, h }, vw, vh);
  const card = rect(style.left, style.top, w, h);
  const inView = card.left >= 0 && card.top >= 0 && card.right <= vw && card.bottom <= vh;
  check(`${name}: in viewport`, inView, JSON.stringify(card));
  // The last case deliberately has nowhere to go; everything else must clear the target.
  if (name !== 'target fills viewport') {
    check(`${name}: clears target`, !overlaps(card, target), JSON.stringify(card));
  }
}

// 6. Arrow offset stays on the card edge
const { style: st, arrow } = placeTourCard(rect(8, 120, 184, 34), { w: 300, h: 275 }, 1440, 800);
check('arrow on card edge', arrow.offset >= 12 && arrow.offset <= 275 - 28 && arrow.side === 'right', JSON.stringify({ st, arrow }));

console.log(fail ? `\n${fail} FAILURES` : '\nall passed');
process.exit(fail ? 1 : 0);
