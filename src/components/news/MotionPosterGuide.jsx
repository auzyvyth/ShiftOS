import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// "Show me" walkthrough for Moving poster (NEWS-2). Which step shows is read
// from the screen: the furthest target that exists wins, so closing the menu or
// the sheet steps back by itself. The ring ignores taps: the seller taps the
// real button.
const STEPS = [
  { target: '[data-tour-id="motion-download"]', n: 3 },
  { target: '[data-tour-id="lst-motion"]', n: 2 },
  { target: '[data-tour-id="lst-more"]', n: 1 },
];

const COPY = {
  en: {
    of: (n) => `Step ${n} of 3`, skip: 'Skip', done: 'Got it',
    1: ['Tap ···', 'Pick a car, then tap the three dots.'],
    2: ['Open it', 'Tap Moving poster.'],
    3: ['Get your video', 'Pick a design, check the price and deposit, then tap Download video.'],
  },
  ms: {
    of: (n) => `Langkah ${n} daripada 3`, skip: 'Langkau', done: 'Faham',
    1: ['Tekan ···', 'Pilih kereta, kemudian tekan tiga titik.'],
    2: ['Buka', 'Tekan Poster bergerak.'],
    3: ['Dapatkan video', 'Pilih design, semak harga dan deposit, kemudian tekan Download video.'],
  },
};

const NAV_H = 76; // phone bottom nav + a gap

export default function MotionPosterGuide({ onClose }) {
  const [spot, setSpot] = useState(null); // { n, top, left, width, height }
  const [cardH, setCardH] = useState(170);
  const cardRef = useRef(null);
  const scrolled = useRef(0);
  const { i18n } = useTranslation();
  const c = COPY[String(i18n?.language || 'en').startsWith('ms') ? 'ms' : 'en'];

  // Polled: targets mount late (lazy tab, lazy sheet) and move with any scroll.
  useEffect(() => {
    const read = () => {
      let next = null;
      for (const s of STEPS) {
        const el = document.querySelector(s.target);
        const r = el?.getBoundingClientRect();
        if (!r || !r.width || !r.height) continue;
        if (scrolled.current !== s.n) { scrolled.current = s.n; el.scrollIntoView({ block: 'center' }); }
        const now = el.getBoundingClientRect();
        next = { n: s.n, top: Math.round(now.top), left: Math.round(now.left), width: Math.round(now.width), height: Math.round(now.height) };
        break;
      }
      setSpot((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    read();
    const id = setInterval(read, 150);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h && h !== cardH) setCardH(h);
  });

  if (!spot) return null;
  const [head, body] = c[spot.n];
  const below = spot.top + spot.height + 14;
  const top = below + cardH <= window.innerHeight - NAV_H ? below : Math.max(8, spot.top - cardH - 14);
  const width = Math.min(340, window.innerWidth - 24);
  const left = Math.max(12, Math.min(spot.left + spot.width / 2 - width / 2, window.innerWidth - width - 12));

  return createPortal(
    <div style={{ fontFamily: 'var(--xd-font-body)' }}>
      <div aria-hidden="true" style={{ position: 'fixed', zIndex: 10020, pointerEvents: 'none', top: spot.top - 5, left: spot.left - 5, width: spot.width + 10, height: spot.height + 10, boxSizing: 'border-box', borderRadius: 14, border: '2px solid #dc2626', boxShadow: '0 0 0 9999px rgba(0,0,0,.55)' }} />
      <div ref={cardRef} role="status" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
        style={{ position: 'fixed', zIndex: 10021, top, left, width, boxSizing: 'border-box', background: '#181b21', color: '#f4f5f7', borderRadius: 16, padding: '14px 16px', boxShadow: '0 16px 40px rgba(0,0,0,.55)' }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,245,247,.6)' }}>{c.of(spot.n)}</p>
        <p style={{ margin: '4px 0', fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, lineHeight: 1 }}>{head}</p>
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.45, color: 'rgba(244,245,247,.8)' }}>{body}</p>
        <button type="button" onClick={onClose}
          style={{ width: '100%', minHeight: 44, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff', background: spot.n === 3 ? '#dc2626' : 'rgba(255,255,255,.08)' }}>
          {spot.n === 3 ? c.done : c.skip}
        </button>
      </div>
    </div>,
    document.body,
  );
}
