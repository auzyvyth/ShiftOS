import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isSeeThroughPhoto, cdnImg } from '../../../utils/img';
import { seeThroughBox } from '../../../utils/seeThrough';

// CAR-RING (owner, 2026-11-26): the business card's top band. ONE brand's cars (the seller picks it
// in Settings > Your photo, saved as `hb` on the hero link; none picked = the brand with the most) go
// round a turntable, THREE on show at a time, the front one named at the top centre.
// - Only real cut-outs (corners see-through, any of a car's first 4 photos): a photo with a background
//   turning reads as a broken box.
// - Every car is cropped to its own outline (seeThroughBox) and drawn at the SAME width, standing on
//   the SAME floor line, so the tyres land on one spot whatever empty margin the photo had (owner).
// - Movement is one continuous angle: a car's slot offset k maps to a point on the circle (sin for
//   across, cos for depth), so every car travels the same arc. A car grows as it reaches the front
//   (scaled from its tyres, so the landing never moves) and is lit brighter; no lift.
// Paused while hovered or the tab is hidden; under reduced motion it only turns on a tap.

const MAX_CARS = 24;
const STEP_MS = 3400;
const TURN_MS = 1100;
const SLOT_DEG = 58;     // angle between neighbours on the turntable
const SHOW = 1.5;        // slots either side still visible (1 = the side cars, fading out by 1.5)
const SIDE_SCALE = 0.6;  // a side car's size; it grows to full size as it reaches the front (owner, 2026-11-26: "needs to grow bigger")
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const brandKeyOf = (b) => String(b || '').trim().toLowerCase();

// Every cut-out car the seller has, one per brand + model, newest first: { id, brand, model, url, box }.
export function useRingCars(listings) {
  const cands = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const c of Array.isArray(listings) ? listings : []) {
      const key = `${c.brand}|${c.model}`.toLowerCase();
      if (seen.has(key)) continue;
      const urls = (Array.isArray(c.images) ? c.images : []).slice(0, 4).filter(isSeeThroughPhoto);
      if (!urls.length) continue;
      seen.add(key);
      out.push({ id: c.id, brand: c.brand || '', model: c.model || '', urls });
    }
    return out.slice(0, MAX_CARS);
  }, [listings]);
  const key = cands.map((c) => c.urls.join(',')).join('|');
  const [cars, setCars] = useState(null);
  useEffect(() => {
    let off = false;
    (async () => {
      const found = await Promise.all(cands.map(async (c) => {
        for (const u of c.urls) {
          const box = await seeThroughBox(u);
          if (box) return { id: c.id, brand: c.brand, model: c.model, url: u, box };
        }
        return null;
      }));
      if (!off) setCars(found.filter(Boolean));
    })();
    return () => { off = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return cars; // null while checking
}

// Brands that have cut-out cars, most cars first: [{ brand, key, count }].
export function ringBrands(cars) {
  const m = new Map();
  for (const c of cars || []) {
    const k = brandKeyOf(c.brand);
    if (!k) continue;
    const e = m.get(k) || { brand: c.brand, key: k, count: 0 };
    e.count += 1;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

// The cars of the picked brand; an unknown or empty pick = the brand with the most.
export function ringCarsFor(cars, brand) {
  const brands = ringBrands(cars);
  if (!brands.length) return [];
  const k = brands.some((b) => b.key === brandKeyOf(brand)) ? brandKeyOf(brand) : brands[0].key;
  return cars.filter((c) => brandKeyOf(c.brand) === k);
}

// The ring's own styles, so the page and the Settings preview draw the same thing. The page sizes it
// for desktop with `.aph-band .cring...` rules; `small` is the Settings preview.
const CSS = `
.cring { position: relative; container-type: inline-size; --spread: 41cqw; --car-w: 50cqw; --under: 44px; padding: 58px 0 0; }
.cring-label { position: relative; z-index: 200; display: grid; justify-items: center; gap: 2px; text-align: center; color: #fff; pointer-events: none; animation: cringIn .45s ease-out both; }
.cring-label span { font: 500 11px/1 var(--xd-font-body); letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.6); }
.cring-label b { font: 400 30px/1 'Bebas Neue', sans-serif; letter-spacing: .02em; white-space: nowrap; }
@keyframes cringIn { from { opacity: 0; translate: 0 6px; } to { opacity: 1; translate: 0 0; } }
/* The stage is exactly as tall as the tallest car at full size, plus the floor margin under it. */
.cring-stage { position: relative; margin-top: 10px; height: calc(var(--car-w) * var(--ratio, .5) + var(--under, 26px)); }
.cring-floor { position: absolute; left: 50%; bottom: 0; width: 100%; height: calc(var(--under, 26px) * 2.6); translate: -50% 0; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, rgba(255,255,255,.10), rgba(255,255,255,.03) 55%, rgba(255,255,255,0)); }
.cring-car { position: absolute; left: 50%; bottom: var(--under, 26px); width: var(--car-w); padding: 0; border: 0; background: none; cursor: pointer; transform-origin: 50% 100%; will-change: transform, opacity; -webkit-tap-highlight-color: transparent; filter: brightness(var(--lit, 1)); }
.cring-crop { position: relative; display: block; width: 100%; overflow: hidden; }
.cring-crop img { position: absolute; max-width: none; pointer-events: none; }
/* One contact shadow under every car, at the shared floor line: the tyres land on it. */
.cring-shadow { position: absolute; left: 6%; right: 6%; bottom: -7px; height: 14px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.65), rgba(0,0,0,0)); }
.cring--sm { padding-top: 10px; --under: 30px; }
.cring--sm .cring-label span { font-size: 8px; }
.cring--sm .cring-label b { font-size: 18px; }
.cring--sm .cring-stage { margin-top: 4px; }
.cring--sm .cring-shadow { bottom: -4px; height: 8px; }
@media (prefers-reduced-motion: reduce) { .cring-label { animation: none; } }
`;

export default function CarRing({ cars, small = false }) {
  const n = cars.length;
  const sig = cars.map((c) => c.id).join(','); // the ring restarts only when the cars change, not on every parent render
  const itemRefs = useRef([]);
  const rot = useRef(0);
  const anim = useRef(0);
  const hover = useRef(false);
  const [front, setFront] = useState(0);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const place = (r) => {
    for (let i = 0; i < n; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      let k = ((((i - r) % n) + n) % n);       // 0..n
      if (k > n / 2) k -= n;                    // -n/2..n/2, the shortest way to the front
      const th = (k * SLOT_DEG * Math.PI) / 180;
      const x = Math.sin(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, th)));
      const depth = (Math.cos(Math.min(Math.PI / 2, Math.abs(th))) + 1) / 2; // 1 front .. .5 at the side
      const fade = Math.abs(k) <= 1 ? 1 : Math.max(0, (SHOW - Math.abs(k)) / (SHOW - 1));
      const sc = SIDE_SCALE + (1 - SIDE_SCALE) * ((depth - 0.5) * 2); // grows from the tyres: the landing never moves
      el.style.transform = `translateX(-50%) translateX(calc(${x.toFixed(4)} * var(--spread))) scale(${sc.toFixed(4)})`;
      el.style.zIndex = String(Math.round(depth * 100));
      el.style.opacity = fade.toFixed(3);
      el.style.visibility = fade > 0 ? 'visible' : 'hidden';
      el.style.setProperty('--lit', (0.35 + 0.65 * ((depth - 0.5) * 2)).toFixed(3));
    }
  };

  const turnTo = (target) => {
    cancelAnimationFrame(anim.current);
    const from = rot.current;
    const t0 = performance.now();
    const dur = reduced ? 0 : TURN_MS * Math.min(2, Math.max(1, Math.abs(target - from)));
    const tick = (now) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      rot.current = from + (target - from) * ease(t);
      place(rot.current);
      if (t < 1) anim.current = requestAnimationFrame(tick);
    };
    anim.current = requestAnimationFrame(tick);
    setFront(((Math.round(target) % n) + n) % n);
  };

  useEffect(() => { cancelAnimationFrame(anim.current); rot.current = 0; place(0); setFront(0); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (n < 2 || reduced) return undefined;
    const id = setInterval(() => {
      if (hover.current || document.hidden) return;
      turnTo(Math.round(rot.current) + 1);
    }, STEP_MS);
    return () => { clearInterval(id); cancelAnimationFrame(anim.current); };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const bring = (i) => {
    const cur = Math.round(rot.current);
    let delta = (((i - cur) % n) + n) % n;
    if (delta > n / 2) delta -= n;
    if (delta) turnTo(cur + delta);
  };

  const car = cars[front];
  // Height of the tallest car per unit of width, so the stage fits the cars and nothing more.
  const ratio = Math.max(0.3, ...cars.map((c) => c.box.h / Math.max(0.01, c.box.w * c.box.ar)));
  return (
    <div className={`cring keep-alpha${small ? ' cring--sm' : ''}`} onPointerEnter={() => { hover.current = true; }} onPointerLeave={() => { hover.current = false; }}>
      <style>{CSS}</style>
      <div className="cring-label" key={car?.id} aria-live="polite">
        <span>{car?.brand}</span>
        <b>{car?.model}</b>
      </div>
      <div className="cring-stage" style={{ '--ratio': ratio.toFixed(4) }}>
      <div className="cring-floor" aria-hidden="true" />
      {cars.map((c, i) => {
        const b = c.box;
        return (
          <button key={c.id} type="button" ref={(el) => { itemRefs.current[i] = el; }} className="cring-car"
            onClick={() => bring(i)} aria-label={`${c.brand} ${c.model}`} tabIndex={i === front ? 0 : -1}>
            <span className="cring-shadow" aria-hidden="true" />
            {/* The crop: a box the shape of the car itself; the photo inside is moved and sized so
                only the car shows. Its bottom edge IS the tyres, on the shared floor line. */}
            <span className="cring-crop" style={{ aspectRatio: `${(b.w * b.ar).toFixed(4)} / ${b.h.toFixed(4)}` }}>
              <img src={cdnImg(c.url, 720, 82)} alt="" draggable={false} decoding="async"
                style={{ width: `${(100 / b.w).toFixed(3)}%`, height: `${(100 / b.h).toFixed(3)}%`, left: `${(-b.x / b.w * 100).toFixed(3)}%`, top: `${(-b.y / b.h * 100).toFixed(3)}%` }} />
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
