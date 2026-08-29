import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cdnImg } from '../../utils/img';

const SLIDE_MS = 420;
// After a manual swipe, hold the auto-timer off for a while so the set the
// visitor just pulled into view doesn't slide away under them. Mirrors
// HeroCarousel.jsx's TOUCH_PAUSE.
const TOUCH_PAUSE = 15000;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const fmtPrice = (car) => {
  const p = Number(car.selling_price);
  return p > 0 ? 'RM ' + p.toLocaleString('en-MY') : 'P.O.R';
};

// One titled row of 3 car tiles (photo + price only) inside the marketplace
// hero, replacing the old "Browse by Budget" grid.
//
// Motion: three layers (prev / current / next) sit side by side inside one
// transformed group, so advancing slides the old set out while the new one
// comes in. Neighbours wrap around the pool, which is why looping past the
// last set still slides FORWARD instead of rewinding across the whole row.
// After each commit the group silently recentres on the new index with the
// transition off — the standard infinite-carousel recentre.
//
// Auto-advance still rides the CSS animationend timer (mirrors
// HeroCarousel.jsx: no setInterval, auto-throttles on hidden tabs). A pool of
// 3 or fewer never renders the timer — there's nothing new to cycle to.
export default function HeroCarRow({ eyebrow, title, cars, viewAllHref }) {
  const chunks = useMemo(() => chunk(cars, 3), [cars]);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(0);          // 0 idle | -1 → next | +1 → prev
  const [snapBack, setSnapBack] = useState(false);
  const [dragDx, setDragDx] = useState(null); // px while a finger is down
  const [animKey, setAnimKey] = useState(0);
  const [paused, setPaused] = useState(false);

  const stageRef = useRef(null);
  const touch = useRef(null);        // { x, y, locked } for the live gesture
  const suppressClick = useRef(false);
  const pauseTimer = useRef(null);
  const clickTimer = useRef(null);

  // Guards a stale index when the pool changes shape (e.g. row 1 flips from
  // 'all' to 'hot' and the new pool has fewer chunks).
  const len = chunks.length;
  const safeIdx = idx < len ? idx : 0;
  const at = (offset) => (len ? chunks[(safeIdx + offset + len) % len] : null);

  const restartTimer = () => setAnimKey((k) => k + 1);

  const commit = (d) => {
    if (len < 2 || dir !== 0) return;
    setSnapBack(false);
    setDragDx(null);
    setDir(d);
  };

  const settle = (e) => {
    // A tile's own hover transform transition bubbles up here — settling on
    // it would advance the row on hover.
    if (e && (e.target !== e.currentTarget || e.propertyName !== 'transform')) return;
    if (snapBack) { setSnapBack(false); return; }
    if (dir === 0) return;
    // -1 slid left, so the set that landed under the viewport is the NEXT one.
    setIdx((safeIdx + (dir === -1 ? 1 : -1) + len) % len);
    setDir(0);
    restartTimer();
  };

  const holdAuto = () => {
    clearTimeout(pauseTimer.current);
    setPaused(true);
    pauseTimer.current = setTimeout(() => setPaused(false), TOUCH_PAUSE);
  };

  /* ── Touch swipe. A gesture that reads as vertical is released back to the
     page so a normal scroll is never hijacked on mobile. ── */
  const onTouchStart = (e) => {
    if (len < 2 || dir !== 0) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, locked: false };
  };

  const onTouchMove = (e) => {
    const g = touch.current;
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (!g.locked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { touch.current = null; setDragDx(null); return; }
      g.locked = true;
      suppressClick.current = true;
    }
    setDragDx(dx);
  };

  const onTouchEnd = () => {
    const g = touch.current;
    touch.current = null;
    if (!g || !g.locked) { setDragDx(null); return; }
    const width = stageRef.current?.offsetWidth || 1;
    const dx = dragDx || 0;
    holdAuto();
    setDragDx(null);
    // The click that follows a lift-off is swallowed by onTileClick, but a
    // drag that ends on a gap produces none — release the latch on a timer so
    // it can't eat a genuine tap later.
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 400);
    if (Math.abs(dx) > Math.max(40, width * 0.25)) commit(dx < 0 ? -1 : 1);
    else setSnapBack(true);
  };

  // A finger that dragged the row must not also open the tile it lifted off.
  const onTileClick = (e) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    clearTimeout(clickTimer.current);
    e.preventDefault();
  };

  useEffect(() => () => {
    clearTimeout(pauseTimer.current);
    clearTimeout(clickTimer.current);
  }, []);

  const transform =
    dragDx !== null ? `translateX(${dragDx}px)` :
    dir !== 0       ? `translateX(${dir * 100}%)` :
    'translateX(0)';
  // Transition only while committing or snapping back — the recentre after a
  // commit has to be instant or the row visibly rewinds.
  const animating = dir !== 0 || snapBack;

  const layer = (offset, cls) => {
    const set = at(offset);
    if (!set) return null;
    return (
      <div className={`mp-carrow-layer ${cls}`}>
        <div className="mp-carrow-grid">
          {set.map((car) => (
            <Link
              key={car.id}
              to={`/showroom/${car.slug || car.id}`}
              className="mp-carrow-item"
              onClick={onTileClick}
              draggable={false}
            >
              <div className="mp-carrow-img" style={{ backgroundImage: `url(${cdnImg(car.images?.[0], 300, 65)})` }} />
              <span className="mp-carrow-price">{fmtPrice(car)}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minWidth: 0 }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(220,38,38,0.8)', fontFamily: "'Outfit',sans-serif" }}>{eyebrow}</p>
          <h3 style={{ margin: 0, fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(16px,1.6vw,20px)', color: '#ffffff', letterSpacing: '0.02em', lineHeight: 1 }}>{title}</h3>
        </div>
        {viewAllHref && (
          <Link
            to={viewAllHref}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}
          >
            View All <ArrowRight size={10} />
          </Link>
        )}
      </div>

      {len === 0 ? (
        <div style={{ padding: '18px 0', color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: "'Outfit',sans-serif" }}>
          No cars listed yet
        </div>
      ) : (
        <div
          ref={stageRef}
          className="mp-carrow-stage"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div
            className="mp-carrow-group"
            style={{ transform, transitionDuration: animating ? `${SLIDE_MS}ms` : '0ms' }}
            onTransitionEnd={settle}
          >
            {len > 1 && layer(-1, 'mp-carrow-prev')}
            {layer(0, 'mp-carrow-curr')}
            {len > 1 && layer(1, 'mp-carrow-next')}
          </div>
        </div>
      )}

      {len > 1 && (
        <div
          key={animKey}
          className="mp-carrow-progress"
          style={{ animationDuration: '5000ms', animationPlayState: paused || dir !== 0 ? 'paused' : 'running' }}
          onAnimationEnd={() => commit(-1)}
        />
      )}
    </div>
  );
}
