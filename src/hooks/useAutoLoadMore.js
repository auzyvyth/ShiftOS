import { useEffect, useRef } from "react";

// Infinite scroll for the car grids (owner, 2026-11-22: "no button, load the next 50 by itself,
// and say it when it truly ends"). Returns a ref for the line under the grid: when its top comes
// within `margin` px of the bottom of the screen, OR it is already above the screen (a hard
// flick jumped past it into the footer), `onLoadMore` runs once. It re-arms after each load and
// never fires while a load is running, on an error, or when there is nothing left.
// A scroll check, not an IntersectionObserver: an observer misses a jump from below the screen
// to above it (both "not intersecting"), and the grid then never grows.
export function useAutoLoadMore({ hasMore, busy, onLoadMore, margin = 900 }) {
  const ref = useRef(null);
  const cb = useRef(onLoadMore);
  cb.current = onLoadMore;
  useEffect(() => {
    if (!hasMore || busy || typeof window === "undefined") return;
    let fired = false;
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = ref.current;
      if (fired || !el) return;
      if (el.getBoundingClientRect().top < window.innerHeight + margin) {
        fired = true;
        cb.current?.();
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    check(); // already near the end (a short page, or the batch did not fill the screen)
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hasMore, busy, margin]);
  return ref;
}
