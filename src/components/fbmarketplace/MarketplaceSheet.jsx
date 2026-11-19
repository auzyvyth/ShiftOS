// Post to Facebook Marketplace (MKT-1, 2026-11-20). A checklist, not a robot:
// Drevo prepares every field, the seller copies them into Marketplace's own
// form and presses Publish. Nothing logs into Facebook or posts for them (that
// breaks Meta's terms and gets the seller's account restricted).
// Portalled with scroll lock + useModalHistory (overlay rules 1, 2, 5).
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useModalHistory } from '../../hooks/useModalHistory';
import { marketplaceFields, MARKETPLACE_CREATE_URL } from '../../utils/marketplaceListing';
import { premiumDark as P } from '../../theme/tokens';

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function Row({ label, value, multiline, copied, onCopy }) {
  return (
    <div style={{ background: P.raised, borderRadius: P.radius.row, padding: '10px 12px', display: 'flex', gap: 10, alignItems: multiline ? 'flex-start' : 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, color: P.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 14, color: value ? P.text : P.textMuted, whiteSpace: multiline ? 'pre-wrap' : 'nowrap', overflow: multiline ? 'visible' : 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word' }}>
          {value || 'Not set on this car'}
        </p>
      </div>
      <button onClick={onCopy} disabled={!value} aria-label={`Copy ${label}`}
        style={{ flexShrink: 0, height: 34, padding: '0 12px', borderRadius: P.radius.pill, border: 'none', background: P.card, color: copied ? P.up : P.text, cursor: value ? 'pointer' : 'default', opacity: value ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit' }}>
        {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function MarketplaceSheet({ car, seller, onClose, onDownloadPhotos }) {
  useModalHistory(true, onClose);
  const f = useMemo(() => marketplaceFields(car, { slug: seller?.slug }), [car, seller?.slug]);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const copy = async (key, text) => {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } else toast.error("Couldn't copy. Press and hold the text to copy it.");
  };

  const openMarketplace = async () => {
    await copy('description', f.description);
    window.open(MARKETPLACE_CREATE_URL, '_blank', 'noopener');
  };

  const hasPhotos = Array.isArray(car?.images) && car.images.length > 0;
  const step = (n, text) => (
    <p style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 700, color: P.text }}>
      <span style={{ color: P.textMuted, marginRight: 6 }}>{n}.</span>{text}
    </p>
  );

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: '94dvh', overflowY: 'auto', background: P.card, color: P.text, borderRadius: `${P.radius.card}px ${P.radius.card}px 0 0`, fontFamily: 'var(--xd-font-body)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: P.card, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Post to Facebook Marketplace</p>
            <p style={{ margin: 0, fontSize: 12, color: P.textSec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: P.raised, color: P.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '0 16px 20px' }}>
          <p style={{ margin: 0, fontSize: 12.5, color: P.textSec, lineHeight: 1.5 }}>
            Facebook only lets you post from your own account, so you press Publish yourself. This keeps your account safe.
          </p>

          {step(1, 'Save the photos')}
          <button onClick={() => onDownloadPhotos?.(car)} disabled={!hasPhotos}
            style={{ width: '100%', height: 44, borderRadius: P.radius.row, border: 'none', background: P.raised, color: P.text, cursor: hasPhotos ? 'pointer' : 'default', opacity: hasPhotos ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit' }}>
            <Download size={15} /> {hasPhotos ? `Save ${car.images.length} photo${car.images.length === 1 ? '' : 's'}` : 'No photos on this car'}
          </button>

          {step(2, 'Copy the details into the form')}
          <div style={{ display: 'grid', gap: 8 }}>
            <Row label="Price (RM)" value={f.price} copied={copied === 'price'} onCopy={() => copy('price', f.price)} />
            <Row label="Year" value={f.year} copied={copied === 'year'} onCopy={() => copy('year', f.year)} />
            <Row label="Make" value={f.make} copied={copied === 'make'} onCopy={() => copy('make', f.make)} />
            <Row label="Model" value={f.model} copied={copied === 'model'} onCopy={() => copy('model', f.model)} />
            <Row label="Mileage (km)" value={f.mileage} copied={copied === 'mileage'} onCopy={() => copy('mileage', f.mileage)} />
            <Row label="Description" value={f.description} multiline copied={copied === 'description'} onCopy={() => copy('description', f.description)} />
          </div>

          {step(3, 'Open Marketplace and publish')}
          <button className="lk-red" onClick={openMarketplace}
            style={{ width: '100%', height: 48, borderRadius: P.radius.pill, border: 'none', color: P.onAccent, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit' }}>
            <ExternalLink size={16} /> Copy description and open Marketplace
          </button>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: P.textMuted, lineHeight: 1.5 }}>
            Choose "Vehicle for sale", add the photos, paste the description, then press Publish. Buyers who message you there are new leads: add them in Leads.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
