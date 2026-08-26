import { useEffect, useRef, useState } from "react";

/*
 * Auto-hiding sticky header: hides when the reader scrolls DOWN, comes back the
 * moment they scroll UP even slightly. The pattern every mobile app uses — the
 * bar earns its vertical space only when you reach for it.
 *
 * Returns true when the header should be visible.
 *
 * Three rules that keep it from feeling broken:
 *  - a small threshold, so 1px of scroll jitter (or an iOS rubber-band bounce)
 *    doesn't flap the bar in and out
 *  - always visible at the very top of the page, whatever the last direction was
 *  - `locked` pins it visible: the mobile nav trigger lives in this bar, so it
 *    must never slide away while a drawer or overlay is open, and any scroll
 *    happening behind a scroll-locked overlay must not move it either
 *
 * The caller animates with `transform: translateY(-100%)`, not `display` —
 * hiding a sticky element by removing it from layout makes the page jump.
 */
export function useHideOnScroll({ threshold = 8, offset = 64, locked = false } = {}) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (locked) { setVisible(true); return; }

    lastY.current = window.scrollY;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      // rAF: scroll fires far more often than the screen repaints, and this
      // only ever results in one class of visual change.
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;
        if (y <= offset) setVisible(true);                 // at the top, always shown
        else if (Math.abs(dy) > threshold) setVisible(dy < 0);
        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, offset, locked]);

  return visible;
}

export default useHideOnScroll;
