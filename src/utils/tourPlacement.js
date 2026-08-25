// Placement + scrolling for the product tour.
//
// Two rules the tour kept breaking, both visible on the "Join a Dealership"
// step: the card must never sit on top of the thing the step describes, and the
// page must actually bring that thing into view. The previous version floated
// the card on whichever side had room -- on a phone that is always on top of the
// content -- and leaned on scrollIntoView, which fights the route's own anchor
// scroll and clamps at the end of the document, so the last section on Settings
// stayed pinned to the bottom edge half-under the nav.
//
// The model now: the viewport is split into a BAND (where the step's target must
// land) and the card's own lane. On mobile the card is docked in a fixed strip
// above the bottom nav, so it owns the bottom and the band is everything above
// it. On desktop there is room beside the target, so the card keeps floating and
// the band is just the comfortable middle of the screen.

export const MOBILE_NAV_H = 60; // fixed bottom nav on the salesman panels
const GAP = 12; // card <-> target, card <-> nav
const EDGE = 8; // card <-> viewport edge

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

// Top edge of the docked (mobile) card: a fixed strip just above the bottom nav,
// in the same place on every step, so it can never land on the highlight.
export function dockedCardTop(vh, cardH, navH = MOBILE_NAV_H) {
  return Math.max(EDGE, vh - navH - GAP - cardH);
}

// The slice of the viewport a step's target is allowed to occupy.
export function tourBand(vh, { dock = false, cardH = 0, navH = MOBILE_NAV_H } = {}) {
  if (!dock) return { top: 24, bottom: Math.max(24, vh - 24) };
  return { top: EDGE, bottom: Math.max(EDGE, dockedCardTop(vh, cardH, navH) - GAP) };
}

// How far to scroll so `rect` sits inside `band`: centred when it fits, top
// aligned when it is taller than the band. Positive means scroll the page down.
export function tourScrollDelta(rect, band) {
  const bandH = Math.max(0, band.bottom - band.top);
  if (rect.height >= bandH) return Math.round(rect.top - band.top);
  return Math.round(rect.top - (band.top + (bandH - rect.height) / 2));
}

// Returns fixed-position coords for the card plus which edge its arrow sits on.
// `arrow.side` is where the CARD is relative to the target, so the arrow renders
// on the opposite edge and points back at it.
export function placeTourCard(target, size, vw, vh, opts = {}) {
  const { dock = false, navH = MOBILE_NAV_H } = opts;
  const { w, h } = size;
  if (!target) {
    return { style: { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: w }, arrow: null };
  }

  if (dock) {
    const top = dockedCardTop(vh, h, navH);
    const left = clamp(Math.round((vw - w) / 2), EDGE, Math.max(EDGE, vw - w - EDGE));
    const offset = clamp(target.left + target.width / 2 - left - 8, 12, Math.max(12, w - 28));
    // Nav buttons sit under the card (arrow points down), content sits above it
    // (arrow points up). A target the card can't clear gets no arrow rather than
    // one aimed at itself.
    const arrow = target.top >= top + h ? { side: "top", offset }
      : target.bottom <= top ? { side: "bottom", offset }
        : null;
    return { style: { position: "fixed", top, left, width: w }, arrow };
  }

  const space = {
    right: vw - target.right - GAP - EDGE,
    left: target.left - GAP - EDGE,
    bottom: vh - target.bottom - GAP - EDGE,
    top: target.top - GAP - EDGE,
  };
  const need = { right: w, left: w, bottom: h, top: h };
  const sides = ["right", "left", "bottom", "top"].sort(
    (a, b) => (space[b] - need[b]) - (space[a] - need[a]),
  );
  const side = sides.find((sd) => space[sd] >= need[sd]) || sides[0];

  let top, left;
  if (side === "right" || side === "left") {
    left = side === "right" ? target.right + GAP : target.left - GAP - w;
    top = clamp(target.top + target.height / 2 - h / 2, EDGE, Math.max(EDGE, vh - h - EDGE));
  } else {
    top = side === "bottom" ? target.bottom + GAP : target.top - GAP - h;
    left = clamp(target.left + target.width / 2 - w / 2, EDGE, Math.max(EDGE, vw - w - EDGE));
  }
  left = clamp(left, EDGE, Math.max(EDGE, vw - w - EDGE));
  top = clamp(top, EDGE, Math.max(EDGE, vh - h - EDGE));

  const arrow = side === "right" || side === "left"
    ? { side, offset: clamp(target.top + target.height / 2 - top - 8, 12, Math.max(12, h - 28)) }
    : { side, offset: clamp(target.left + target.width / 2 - left - 8, 12, Math.max(12, w - 28)) };
  return { style: { position: "fixed", top, left, width: w }, arrow };
}
