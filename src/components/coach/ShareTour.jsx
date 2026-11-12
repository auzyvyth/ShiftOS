import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from '../../hooks/useModalHistory';
import { coachCopy } from './coachCopy';
import { placeTourCard } from '../../utils/tourPlacement';

// "Show me how" (COACH-1, owner 2026-10-31): a car with no views for 2+ days.
// The panel switches to Listings, then this rings that car's Share / Link
// button (`data-share-car="<id>"`) and waits for the seller to TAP it, the
// same action-step idea as the Premium poster intro. Step 2 says where to
// post. It never presses anything for them, and never posts anything.
// mode: 'share' = Premium's Share button (share sheet on a phone),
//       'copy'  = Lite's Link button (copies the link).
// Responsive (2026-11-01): taps outside the ringed button are BLOCKED (four
// panes around the hole), so a stray tap on the dimmed card can no longer open
// the car pop-up over the button and leave the ring pointing at nothing. The
// bubble is measured and placed by the product tour's own `placeTourCard`, so
// it sits beside the button and inside the screen on a phone and on desktop.
const FIND_MS = 6000;
const PAD = 6;

export default function ShareTour({ carId, mode = 'share', lang, onClose }) {
  const copy = coachCopy(lang).tour;
  const [rect, setRect] = useState(null);
  const [step, setStep] = useState(1);
  const targetRef = useRef(null);
  const bubbleRef = useRef(null);
  const [bubble, setBubble] = useState({ w: 340, h: 110 });
  const sel = `[data-share-car="${carId}"]`;

  useModalHistory(true, onClose);

  // Find the button (the Listings tab renders a moment after the switch),
  // bring it into view, then follow it on every frame.
  useEffect(() => {
    let raf = 0;
    let stop = false;
    const started = Date.now();
    const find = () => {
      if (stop) return;
      const el = document.querySelector(sel);
      if (!el) {
        if (Date.now() - started > FIND_MS) { onClose(); return; }
        raf = requestAnimationFrame(find);
        return;
      }
      targetRef.current = el;
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      const track = () => {
        if (stop) return;
        const el2 = targetRef.current;
        // The list can re-render and swap the node: look it up again.
        if (!el2 || !el2.isConnected) targetRef.current = document.querySelector(sel);
        const r = targetRef.current?.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (r && r.width > 0) {
          setRect((p) => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height && p.vw === vw && p.vh === vh
            ? p : { top: r.top, left: r.left, width: r.width, height: r.height, vw, vh }));
        }
        raf = requestAnimationFrame(track);
      };
      track();
    };
    find();
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // The seller's own tap on the ringed button moves the tour on. Nothing is
  // blocked or pressed for them: the button does exactly what it always does.
  useEffect(() => {
    if (step !== 1) return undefined;
    const onTap = (e) => { if (e.target.closest?.(sel)) setTimeout(() => setStep(2), 500); };
    document.addEventListener('click', onTap, true);
    return () => document.removeEventListener('click', onTap, true);
  }, [step, sel]);

  // Measure the bubble after every render (its height follows the text and
  // the screen width), then place it from the real size.
  useEffect(() => {
    const b = bubbleRef.current;
    if (!b) return;
    const w = b.offsetWidth;
    const h = b.offsetHeight;
    if (w !== bubble.w || h !== bubble.h) setBubble({ w, h });
  });

  if (!rect && step === 1) return null;
  const pad = PAD;
  const hole = rect && {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  };
  const bubbleW = rect ? Math.min(340, rect.vw - 32) : 340;
  const placed = rect && placeTourCard(
    { ...hole, right: hole.left + hole.width, bottom: hole.top + hole.height },
    { w: bubbleW, h: bubble.h }, rect.vw, rect.vh,
  );
  // Four panes around the hole catch every tap that is not on the button.
  const block = { position: 'fixed', pointerEvents: 'auto', background: 'transparent' };
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 10040, pointerEvents: 'none', fontFamily: "var(--xd-font-body, 'Outfit', system-ui, sans-serif)" }}>
      {step === 1 && rect && (
        <>
          <div style={{
            position: 'fixed', top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2,
            borderRadius: 14, boxShadow: '0 0 0 3px #dc2626, 0 0 0 9999px rgba(0,0,0,0.55)', pointerEvents: 'none',
          }} />
          <div style={{ ...block, top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }} onClick={stop} />
          <div style={{ ...block, top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} onClick={stop} />
          <div style={{ ...block, top: hole.top, height: hole.height, left: 0, width: Math.max(0, hole.left) }} onClick={stop} />
          <div style={{ ...block, top: hole.top, height: hole.height, left: hole.left + hole.width, right: 0 }} onClick={stop} />
          <div ref={bubbleRef} style={{ ...S.bubble, ...placed.style, width: bubbleW, transform: 'none', pointerEvents: 'auto' }}>
            <p style={S.text}>{mode === 'copy' ? copy.step1Copy : copy.step1Share}</p>
            <button type="button" style={S.ghost} onClick={onClose}>{copy.skip}</button>
          </div>
        </>
      )}
      {step === 2 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
          <div style={{ ...S.bubble, position: 'static', transform: 'none', marginBottom: 24 }}>
            <p style={S.text}>{copy.step2}</p>
            <button type="button" style={S.primary} onClick={onClose}>{copy.done}</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

const S = {
  bubble: {
    position: 'fixed', left: '50%', transform: 'translateX(-50%)', width: 'min(340px, calc(100vw - 32px))',
    background: '#111318', color: '#f2f4f7', borderRadius: 16, padding: '14px 16px', boxSizing: 'border-box',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
  },
  text: { margin: '0 0 12px', fontSize: 14, lineHeight: 1.5 },
  ghost: { height: 34, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#f2f4f7', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  primary: { width: '100%', height: 42, borderRadius: 999, border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
