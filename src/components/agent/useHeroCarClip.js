import { useEffect, useState } from 'react';
import { seeThroughBox } from '../../utils/seeThrough';

// HERO-CLIP (owner, 2026-11-26: "make the car the limit, anything below the car from the person
// image is hidden"). The seller's cut-out photo is cut off at the car's tyre line, so their body
// never shows under the car. The tyre line comes from the car photo's own outline
// (seeThroughBox: where its opaque pixels end), so empty margin under the car does not count.
// Returns a CSS clip-path for the person, or undefined. Re-measured on resize, image load and
// whenever the seller's size / position settings change (`deps`).
export function useHeroCarClip(meRef, carRef, carUrl, deps = []) {
  const [clip, setClip] = useState(undefined);
  useEffect(() => {
    if (!carUrl) { setClip(undefined); return undefined; }
    let off = false;
    let box = null;
    const measure = () => {
      const me = meRef.current;
      const car = carRef.current;
      if (off || !me || !car || !box) return;
      const cr = car.getBoundingClientRect();
      const mr = me.getBoundingClientRect();
      if (!cr.height || !mr.height) return;
      const tyre = cr.top + Math.min(1, box.y + box.h) * cr.height;
      const below = mr.bottom - tyre;
      // clip-path works in the element's own pixels, before its scale (the seller's size setting).
      const s = mr.height / Math.max(1, me.offsetHeight || mr.height);
      setClip(below > 0.5 ? `inset(0 0 ${(below / s).toFixed(1)}px 0)` : undefined);
    };
    seeThroughBox(carUrl).then((b) => { if (!off) { box = b || { y: 0, h: 1 }; measure(); } });
    const ro = new ResizeObserver(measure);
    const els = [meRef.current, carRef.current, meRef.current?.parentElement].filter(Boolean);
    els.forEach((e) => ro.observe(e));
    els.forEach((e) => e.addEventListener?.('load', measure));
    window.addEventListener('resize', measure);
    const t = setTimeout(measure, 400); // after the fonts settle the text column can move the photo
    return () => {
      off = true;
      clearTimeout(t);
      ro.disconnect();
      els.forEach((e) => e.removeEventListener?.('load', measure));
      window.removeEventListener('resize', measure);
    };
  }, [carUrl, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return clip;
}
