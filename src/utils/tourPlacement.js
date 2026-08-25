// Place the tour card so it NEVER covers the element it is pointing at.
// Tries each side of the target, preferring the one with the most free space,
// and falls back to the roomiest side (clamped into the viewport) when the card
// fits nowhere. Returns fixed-position coords plus which edge the arrow is on.
// The old version had one hardcoded branch per surface and a guessed 220px card
// height, so a tall card ran off screen and the desktop card always landed on
// the content column next to the sidebar.
export function placeTourCard(target, size, vw, vh) {
 const GAP = 12, EDGE = 8;
 const { w, h } = size;
 if (!target) {
 return { style: { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: w }, arrow: null };
 }
 const space = {
 right: vw - target.right - GAP - EDGE,
 left: target.left - GAP - EDGE,
 bottom: vh - target.bottom - GAP - EDGE,
 top: target.top - GAP - EDGE,
 };
 const need = { right: w, left: w, bottom: h, top: h };
 const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
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

 // Arrow sits on the card edge facing the target, lined up with the target's
 // centre where the card is long enough to reach it.
 const arrow = side === "right" || side === "left"
 ? { side, offset: clamp(target.top + target.height / 2 - top - 8, 12, Math.max(12, h - 28)) }
 : { side, offset: clamp(target.left + target.width / 2 - left - 8, 12, Math.max(12, w - 28)) };
 return { style: { position: "fixed", top, left, width: w }, arrow };
}