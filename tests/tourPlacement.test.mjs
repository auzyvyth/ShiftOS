// Geometry guard for the product tour. Two rules, both of which the tour has
// broken in front of a real user: the card never overlaps the element the step
// is describing, and the page scrolls that element into the space the card
// leaves free (above the docked card + bottom nav on mobile).
// Run with: npm run test:tour
import { placeTourCard, tourBand, tourScrollDelta, dockedCardTop, MOBILE_NAV_H } from '../src/utils/tourPlacement.js';

const rect = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h });
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
let fail = 0;
const check = (name, cond, extra = '') => { if (!cond) { console.log('FAIL', name, extra); fail++; } else console.log('ok  ', name); };

// 1. No target -> centred
const c = placeTourCard(null, { w: 300, h: 240 }, 1440, 800);
check('welcome centres', c.style.top === '50%' && c.arrow === null);

// 2. Desktop: card floats beside the target, never on it, never off screen
const desktop = [
  ['sidebar item', rect(8, 120, 184, 34), 1440, 800],
  ['settings nav (low)', rect(8, 520, 184, 34), 1440, 800],
  ['bookings pill near top', rect(224, 90, 96, 30), 1440, 800],
  ['invite box mid-content', rect(224, 200, 640, 260), 1440, 800],
  ['short laptop, tall card', rect(8, 300, 184, 34), 1280, 620],
  ['target fills viewport', rect(0, 0, 1440, 800), 1440, 800],
];
for (const [name, target, vw, vh] of desktop) {
  const h = 275, w = 300;
  const { style } = placeTourCard(target, { w, h }, vw, vh);
  const card = rect(style.left, style.top, w, h);
  check(`desktop ${name}: in viewport`, card.left >= 0 && card.top >= 0 && card.right <= vw && card.bottom <= vh, JSON.stringify(card));
  // The last case deliberately has nowhere to go; everything else must clear the target.
  if (name !== 'target fills viewport') check(`desktop ${name}: clears target`, !overlaps(card, target), JSON.stringify(card));
}

// 3. Mobile: the card is docked in the same strip above the nav on every step,
// and it never reaches down into the nav.
const mob = [[375, 812], [360, 640], [412, 915]];
for (const [vw, vh] of mob) {
  const h = 250, w = Math.min(320, vw - 32);
  const target = rect(120, vh - MOBILE_NAV_H, 41, MOBILE_NAV_H); // a bottom-nav button
  const { style, arrow } = placeTourCard(target, { w, h }, vw, vh, { dock: true });
  const card = rect(style.left, style.top, w, h);
  check(`mobile ${vw}x${vh}: docked above nav`, card.bottom <= vh - MOBILE_NAV_H, JSON.stringify(card));
  check(`mobile ${vw}x${vh}: clears nav button`, !overlaps(card, target));
  check(`mobile ${vw}x${vh}: arrow points down at nav`, arrow && arrow.side === 'top');
}

// 4. Mobile: an in-content target scrolled by tourScrollDelta lands in the band,
// clear of the card. This is the "Join a Dealership" case from the bug report:
// the invite box sat at the bottom of the document, under the card and the nav.
const vw = 375, vh = 812, cardH = 250;
const band = tourBand(vh, { dock: true, cardH });
check('mobile band ends above card', band.bottom <= dockedCardTop(vh, cardH));
for (const [name, target] of [
  ['invite box below the fold', rect(16, 1180, 343, 210)],
  ['invite box under the nav', rect(16, 760, 343, 210)],
  ['heading already on screen', rect(16, 60, 343, 26)],
  ['section taller than the band', rect(16, 900, 343, 900)],
]) {
  const moved = (() => { const d = tourScrollDelta(target, band); return rect(target.left, target.top - d, target.width, target.height); })();
  check(`mobile ${name}: target top inside band`, moved.top >= band.top - 1 && moved.top <= band.bottom, JSON.stringify(moved));
  const { style } = placeTourCard(moved, { w: 320, h: cardH }, vw, vh, { dock: true });
  const card = rect(style.left, style.top, 320, cardH);
  check(`mobile ${name}: card clears the visible part of the target`, card.top >= Math.min(moved.bottom, band.bottom), JSON.stringify({ card, moved }));
}

// 5. Desktop scroll: a target below the fold ends up in the middle of the screen
const dband = tourBand(800, { dock: false });
const dmoved = (() => { const t = rect(300, 1400, 600, 200); const d = tourScrollDelta(t, dband); return rect(t.left, t.top - d, t.width, t.height); })();
check('desktop scrolls target to mid screen', dmoved.top > 200 && dmoved.bottom < 600, JSON.stringify(dmoved));

// 6. Arrow offset stays on the card edge
const { arrow } = placeTourCard(rect(8, 120, 184, 34), { w: 300, h: 275 }, 1440, 800);
check('arrow on card edge', arrow.offset >= 12 && arrow.offset <= 275 - 28 && arrow.side === 'right', JSON.stringify(arrow));

console.log(fail ? `\n${fail} FAILURES` : '\nall passed');
process.exit(fail ? 1 : 0);
