import React, { useEffect, useRef, useState } from 'react';

// HERO-PREVIEW (owner, 2026-11-26: "make sure the preview in dashboard gets the same result it
// would on the page, desktop & mobile"). The seller's REAL page (/s/<slug>?heroPreview=1) in a
// frame at a real phone or desktop width, scaled down to fit. The unsaved photo + settings are
// posted into it (SalesmanProfilePage listens only to its own-origin parent), so what shows here
// is what buyers get: same code, same CSS, same breakpoints. It replaced the hand-drawn HeroPreview,
// which used its own sizes and drifted from the page.

const VIEWS = {
  phone: { w: 390, h: 760, maxW: 300 },
  desktop: { w: 1366, h: 768, maxW: 10000 },
};

export default function PagePreviewFrame({ slug, view = 'phone', url, cut, frame }) {
  const v = VIEWS[view] || VIEWS.phone;
  const boxRef = useRef(null);
  const frameRef = useRef(null);
  const [boxW, setBoxW] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The page says when it is listening; until then a message would be lost.
  useEffect(() => {
    setReady(false);
    const on = (e) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type === 'xd-hero-preview-ready') setReady(true);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [view, slug]);

  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage({ type: 'xd-hero-preview', url: url || null, cut: !!cut, frame }, window.location.origin);
  }, [ready, url, cut, frame]);

  const w = Math.min(boxW || v.maxW, v.maxW);
  const scale = w / v.w;
  return (
    <div ref={boxRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div aria-label={view === 'phone' ? 'Phone preview of your page' : 'Desktop preview of your page'}
        style={{ position: 'relative', width: w, height: v.h * scale, overflow: 'hidden', borderRadius: view === 'phone' ? 22 : 12,
          background: '#fff', boxShadow: '0 0 0 1px rgba(255,255,255,.12)' }}>
        {slug && boxW > 0 && (
          <iframe key={`${view}-${slug}`} ref={frameRef} title="Your page" src={`/s/${encodeURIComponent(slug)}?heroPreview=1`} tabIndex={-1}
            style={{ width: v.w, height: v.h, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none', display: 'block' }} />
        )}
        {(!ready || !slug) && (
          <span role="status" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0d10', color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 600 }}>
            Loading your page...
          </span>
        )}
      </div>
    </div>
  );
}
