import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isSeeThroughPhoto, cdnImg } from '../../../utils/img';
import { checkSeeThrough } from '../../../utils/seeThrough';

// CAR-RING (owner, 2026-11-26: "a roulette of car models, a 3d view of a spinning circle"):
// the business card's top band. The seller's cars stand on a turning ring; the one in front
// names itself (brand, then model) at the top centre. ONLY real cut-outs go on the ring (a
// photo with a background turning in 3D reads as a broken box), checked by their corners
// (checkSeeThrough), any of a car's first 4 photos. No cut-out at all = the caller draws the
// plain band. One step every STEP_MS; paused while hovered, while the tab is hidden, and
// never under reduced motion (a tap still turns it).

const MAX_CARS = 8;
const STEP_MS = 3200;
const TURN_MS = 950;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// The cut-out cars, one per brand + model, newest first.
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
    return out.slice(0, MAX_CARS * 2);
  }, [listings]);
  const key = cands.map((c) => c.urls.join(',')).join('|');
  const [cars, setCars] = useState(null);
  useEffect(() => {
    let off = false;
    (async () => {
      const found = [];
      for (const c of cands) {
        for (const u of c.urls) {
          if (await checkSeeThrough(u)) { found.push({ id: c.id, brand: c.brand, model: c.model, url: u }); break; }
        }
        if (found.length >= MAX_CARS) break;
      }
      if (!off) setCars(found);
    })();
    return () => { off = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return cars; // null while checking
}

export default function CarRing({ cars }) {
  const n = cars.length;
  const itemRefs = useRef([]);
  const rot = useRef(0);
  const anim = useRef(null);
  const hover = useRef(false);
  const [front, setFront] = useState(0);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const place = (r) => {
    for (let i = 0; i < n; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const th = ((i - r) / n) * Math.PI * 2;
      const z = Math.cos(th);               // 1 = front, -1 = back
      const d = (z + 1) / 2;                // 0..1
      const x = n === 1 ? 0 : Math.sin(th) * 39; // % of the band's width
      el.style.transform = `translate(-50%, 0) translateX(${x}cqw) translateY(${(1 - d) * -22}%) scale(${0.42 + 0.58 * d})`;
      el.style.zIndex = String(Math.round(d * 100));
      el.style.opacity = String(0.3 + 0.7 * d);
      el.style.filter = `brightness(${0.45 + 0.55 * d}) drop-shadow(0 ${14 * d}px ${16 * d}px rgba(0,0,0,${0.55 * d}))`;
    }
  };

  const turnTo = (target) => {
    cancelAnimationFrame(anim.current?.raf);
    const from = rot.current;
    const t0 = performance.now();
    const dur = reduced ? 0 : TURN_MS * Math.min(2, Math.max(1, Math.abs(target - from)));
    const tick = (now) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      rot.current = from + (target - from) * ease(t);
      place(rot.current);
      if (t < 1) anim.current = { raf: requestAnimationFrame(tick) };
    };
    anim.current = { raf: requestAnimationFrame(tick) };
    setFront(((Math.round(target) % n) + n) % n);
  };

  useEffect(() => { rot.current = 0; place(0); setFront(0); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (n < 2 || reduced) return undefined;
    const id = setInterval(() => {
      if (hover.current || document.hidden) return;
      turnTo(Math.round(rot.current) + 1);
    }, STEP_MS);
    return () => { clearInterval(id); cancelAnimationFrame(anim.current?.raf); };
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap a car: the shortest way round to bring it to the front.
  const bring = (i) => {
    const cur = Math.round(rot.current);
    let delta = (((i - cur) % n) + n) % n;
    if (delta > n / 2) delta -= n;
    if (delta) turnTo(cur + delta);
  };

  const car = cars[front];
  return (
    <div className="cring keep-alpha" onPointerEnter={() => { hover.current = true; }} onPointerLeave={() => { hover.current = false; }}>
      <div className="cring-label" key={car?.id} aria-live="polite">
        <span>{car?.brand}</span>
        <b>{car?.model}</b>
      </div>
      <div className="cring-floor" aria-hidden="true" />
      {cars.map((c, i) => (
        <button key={c.id} type="button" ref={(el) => { itemRefs.current[i] = el; }} className="cring-car"
          onClick={() => bring(i)} aria-label={`${c.brand} ${c.model}`} tabIndex={i === front ? 0 : -1}>
          <img src={cdnImg(c.url, 640, 80)} alt="" draggable={false} decoding="async" />
        </button>
      ))}
    </div>
  );
}

// Styles live with the page (SalesmanProfilePage .aph-band). Kept here for the reader:
// .cring is a size container (cqw), cars are absolutely placed from its bottom centre.
