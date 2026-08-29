import { useEffect, useState } from "react";

// The size of the area actually visible on screen right now — what is left
// after the on-screen keyboard takes its half of the phone.
//
// Why this exists: `vh` (and `dvh`) measure the LAYOUT viewport, which does not
// shrink when the keyboard opens. A `position:fixed` sheet sized in `vh` stays
// full-height behind the keyboard, so its input ends up underneath it — and the
// browser then scrolls the whole fixed sheet upward to drag that input into
// view. That is the "text field is under the keyboard, and the entire popup
// jumps up when I tap it" bug, and no amount of `dvh` fixes it.
//
// `window.visualViewport` is the only thing that reports the real visible box.
// Size an overlay to it and the input sits naturally just above the keyboard,
// with nothing left for the browser to scroll.
//
// Returns { height, offsetTop }: the visible height, and how far the visual
// viewport has been pushed down the page (non-zero when iOS scrolls the page
// under a focused field). Both are plain numbers in CSS pixels.
export default function useVisualViewport() {
  const [box, setBox] = useState(() => ({
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    offsetTop: 0,
  }));

  useEffect(() => {
    const vv = window.visualViewport;
    // No visualViewport (older browsers) — innerHeight is the best available
    // answer and the layout falls back to what it did before.
    if (!vv) {
      const onResize = () => setBox({ height: window.innerHeight, offsetTop: 0 });
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    // The keyboard opening fires resize + scroll in a burst; coalesce to one
    // state write per frame so the sheet doesn't re-render per event.
    let frame = null;
    const sync = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setBox({ height: vv.height, offsetTop: vv.offsetTop });
      });
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  return box;
}
