import { useEffect, useRef, useState } from "react";

/*
 * Auto-hiding sticky header: hides when the reader scrolls DOWN, comes back the
 * moment they scroll UP even slightly. The pattern every mobile app uses — the
 * bar earns its vertical space only when you reach for it.
 *
 * Returns true when the header should be visible.
 *
 * `target` is the element that actually scrolls, and passing it matters more
 * than it looks. A page does NOT always scroll on window: Salesman Premium's
 * content column is a flex child with `overflowY: auto`, so window.scrollY
 * never moves there and a window-only listener never fires once — the header
 * simply sat still. Pass the scrolling node (a state-held element, not a plain
 * ref: a ref's .current does not re-run this effect when it fills in).
 *
 * Both the element and window are watched, and their offsets are summed. In
 * practice only one of the two ever moves — which one depends on the layout,
 * and on this page it differs between the mobile column and the desktop row —
 * so the sum tracks the real position without the caller having to know which.
 *
 * Three rules that keep it from feeling broken:
 *  - a small threshold, so 1px of scroll jitter (or an iOS rubber-band bounce)
 *    doesn't flap the bar in and out
 *  - always visible at the very top, whatever the last direction was
 *  - `locked` pins it visible: the mobile nav trigger lives in this bar, so it
 *    must never slide away while a drawer or overlay is open, and any scroll
 *    happening behind a scroll-locked overlay must not move it either
 *
 * The caller animates with `transform: translateY(-100%)`, not `display` —
 * hiding a sticky element by removing it from layout makes the page jump.
 */
export function useHideOnScroll({ threshold = 8, offset = 64, locked = false, target = null } = {}) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (locked) { setVisible(true); return; }

    // Accept an element or a ref, so either calling style works.
    const el = target && typeof target === "object" && "current" in target ? target.current : target;
    const readY = () => (el ? el.scrollTop : 0) + window.scrollY;

    lastY.current = readY();

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      // rAF: scroll fires far more often than the screen repaints, and this
      // only ever results in one class of visual change.
      window.requestAnimationFrame(() => {
        const y = readY();
        const dy = y - lastY.current;
        if (y <= offset) setVisible(true);                 // at the top, always shown
        else if (Math.abs(dy) > threshold) setVisible(dy < 0);
        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    if (el) el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (el) el.removeEventListener("scroll", onScroll);
    };
  }, [threshold, offset, locked, target]);

  return visible;
}

export default useHideOnScroll;
