import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Share2, Check } from 'lucide-react';
import { useModalHistory } from '../../hooks/useModalHistory';

/* Every photo of a car on one scrolling page, opened over the car page from
   the desktop gallery (owner, 2026-11-03: "it shows all the images, not one
   per click"). Rows of 2 then 3, repeating. Tapping a photo opens the zoom
   lightbox ON TOP of this page; Back / Esc close that first, then this.
   Mounted only while open, so it registers its own history entry. */

// Grid has 6 columns: a 2-photo row spans 3 each, a 3-photo row 2 each.
// The last, incomplete group is filled so no row has a hole.
export function photoSpans(n) {
  const spans = [];
  for (let start = 0; start < n; start += 5) {
    const r = Math.min(5, n - start);
    if (r === 5) spans.push(3, 3, 2, 2, 2);
    else if (r === 4) spans.push(3, 3, 3, 3);
    else if (r === 3) spans.push(3, 3, 6);
    else if (r === 2) spans.push(3, 3);
    else spans.push(6);
  }
  return spans;
}

export default function PhotoGallerySheet({
  images,
  title,
  price,
  startIdx = 0,
  photoSrc,          // (url, width) => resized url
  onImgError,        // (url) => onError handler
  onOpenPhoto,       // (index) => open the zoom lightbox
  onClose,
  lightboxOpen,      // Esc belongs to the lightbox while it is up
  save,              // ReactNode: the heart button
  onShare,
  shareCopied,
  onBook,            // null on the seller's own listing
  light = true,
}) {
  const scrollRef = useRef(null);
  useModalHistory(true, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !lightboxOpen) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, onClose]);

  // Opened from a small photo: start the page at that photo.
  useEffect(() => {
    if (!startIdx) return;
    const el = scrollRef.current?.querySelector(`[data-photo="${startIdx}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
  }, [startIdx]);

  const c = light
    ? { bg: '#ffffff', text: '#0F172A', sec: '#475569', border: 'rgba(15,23,42,0.08)', btn: '#ffffff', btnBorder: 'rgba(15,23,42,0.14)', cell: '#EEF1F5' }
    : { bg: '#080C14', text: '#ffffff', sec: 'rgba(255,255,255,0.65)', border: 'rgba(255,255,255,0.08)', btn: 'rgba(255,255,255,0.04)', btnBorder: 'rgba(255,255,255,0.16)', cell: '#111827' };
  const spans = photoSpans(images.length);
  const ghost = { display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 14px', borderRadius: 10, border: `1px solid ${c.btnBorder}`, background: c.btn, color: c.text, font: '600 13.5px var(--xd-font-body)', cursor: 'pointer' };

  return createPortal(
    <div className="pgs-root" role="dialog" aria-modal="true" aria-label={`${title} photos`}
      style={{ position: 'fixed', inset: 0, zIndex: 950, background: c.bg, display: 'flex', flexDirection: 'column', fontFamily: 'var(--xd-font-body)' }}>
      <style>{`
        .pgs-root { animation: pgs-up 260ms cubic-bezier(.2,.8,.2,1); }
        @keyframes pgs-up { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .pgs-root { animation: none; } }
        .pgs-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
        .pgs-cell { padding: 0; border: 0; margin: 0; cursor: zoom-in; overflow: hidden; display: block; aspect-ratio: 3 / 2; }
        .pgs-cell img { width: 100%; height: 100%; object-fit: cover; display: block; transition: filter 200ms ease; }
        @media (hover:hover) and (pointer:fine) { .pgs-cell:hover img { filter: brightness(1.06); } }
        @media (max-width: 700px) { .pgs-grid { grid-template-columns: 1fr; } .pgs-cell { grid-column: auto !important; } .pgs-hide-sm { display: none !important; } }
      `}</style>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderBottom: `1px solid ${c.border}` }}>
        <button type="button" onClick={onClose} style={{ ...ghost, border: 0, background: 'transparent', padding: '0 6px' }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="pgs-hide-sm" style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14.5, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
          <p style={{ margin: '1px 0 0', fontSize: 12.5, color: c.sec }}>{[price, `${images.length} photos`].filter(Boolean).join('  ·  ')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {onShare && (
            <button type="button" onClick={onShare} style={ghost} aria-label={shareCopied ? 'Link copied' : 'Share'}>
              {shareCopied ? <Check size={16} /> : <Share2 size={16} />} <span className="pgs-hide-sm">{shareCopied ? 'Copied' : 'Share'}</span>
            </button>
          )}
          {save && <span style={{ ...ghost, cursor: 'default' }}>{save}<span className="pgs-hide-sm">Save</span></span>}
          {onBook && (
            <button type="button" onClick={onBook}
              style={{ ...ghost, border: 0, background: '#dc2626', color: '#fff', padding: '0 18px' }}>
              Book a Viewing
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <div className="pgs-grid" style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 24px 48px' }}>
          {images.map((src, i) => (
            <button key={i} type="button" data-photo={i} className="pgs-cell"
              style={{ gridColumn: `span ${spans[i]}`, background: c.cell }}
              onClick={() => onOpenPhoto(i)} aria-label={`Open photo ${i + 1} of ${images.length}`}>
              <img src={photoSrc(src, spans[i] === 2 ? 640 : 1080)} alt={`${title} photo ${i + 1}`}
                loading={i < 5 ? 'eager' : 'lazy'} decoding="async" onError={onImgError?.(src)} />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
