import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Search, Car, Check } from 'lucide-react';
import { premiumDark as PD } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';
import useVisualViewport from '../../hooks/useVisualViewport';
import { cdnImg } from '../../utils/img';

// Pick one of the seller's cars for a lead (SOLD-1, 2026-11-02). Shared by
// Lite and Premium for "Link a car" and "Offer another car".
// - Sized off the VISUAL viewport (useVisualViewport), so when the search box
//   opens the keyboard the list ends on top of it instead of behind it (three
//   cars were hidden under the keyboard).
// - A pick closes the sheet at once and the caller saves in the background:
//   waiting for the save left a sheet that looked like nothing happened, the
//   seller tapped 9 times, and that pile-up made the next win time out.
// - BROKER-2: `dealerCars` = the dealer cars on a broker's page, in their own group. Picking one
//   calls onPickDealer (it registers the buyer with that dealer; it never links the car to the lead,
//   the database refuses that so a broker cannot mark a dealer's car sold).
export default function CarPickerSheet({ title, subtitle, cars, linkedId, excludeSold = false, onPick, onClose, dealerCars = null, onPickDealer }) {
  const { t } = useTranslation();
  const vv = useVisualViewport();
  const [q, setQ] = useState('');
  useModalHistory(true, onClose);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(cars || [])]
      .filter((c) => !['archived', 'private'].includes(c.status) && !(excludeSold && c.status === 'sold'))
      .filter((c) => !needle || [c.year, c.brand, c.model, c.variant].filter(Boolean).join(' ').toLowerCase().includes(needle))
      // Available first: a sold car is rarely the answer but stays reachable to fix a mislink.
      .sort((a, b) => (a.status === 'sold' ? 1 : 0) - (b.status === 'sold' ? 1 : 0));
  }, [cars, q, excludeSold]);

  const dealerOptions = useMemo(() => {
    if (!dealerCars || !onPickDealer) return [];
    const needle = q.trim().toLowerCase();
    return dealerCars.filter((c) => !needle || `${c.title} ${c.dealerName || ''}`.toLowerCase().includes(needle));
  }, [dealerCars, onPickDealer, q]);

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', left: 0, right: 0, top: vv.offsetTop, height: vv.height, zIndex: 1100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        style={{ width: '100%', maxWidth: 480, maxHeight: Math.max(260, vv.height - 24), display: 'flex', flexDirection: 'column', background: PD.card, borderRadius: `${PD.radius.card}px ${PD.radius.card}px 0 0`, overflow: 'hidden', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 10px', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: PD.text }}>{title}</p>
            {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: PD.textSec, lineHeight: 1.4 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label={t('common.close', { defaultValue: 'Close' })} style={{ background: PD.raised, border: 'none', cursor: 'pointer', color: PD.textSec, borderRadius: 99, padding: 7, display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 16px 10px', padding: '10px 12px', background: PD.raised, borderRadius: PD.radius.row, flexShrink: 0 }}>
          <Search size={14} color={PD.textMuted} style={{ flexShrink: 0 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('carPicker.search')} enterKeyHint="search"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: PD.text, fontSize: 16, fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 8px calc(10px + env(safe-area-inset-bottom))' }}>
          {options.length === 0 && dealerOptions.length > 0 ? null : options.length === 0 ? (
            <p style={{ margin: 0, padding: '28px 16px', fontSize: 13, color: PD.textMuted, textAlign: 'center' }}>{(cars || []).length ? t('carPicker.noMatch') : t('carPicker.noCars')}</p>
          ) : options.map((c) => {
            const img = Array.isArray(c.images) ? c.images.find(Boolean) : null;
            const isLinked = linkedId === c.id;
            return (
              <button key={c.id} onClick={() => !isLinked && onPick(c)} disabled={isLinked}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 8px', background: isLinked ? PD.raised : 'transparent', border: 'none', borderRadius: PD.radius.row, cursor: isLinked ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 2 }}>
                {img
                  ? <img src={cdnImg(img, 160, 65)} alt="" style={{ width: 60, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: PD.raised }} />
                  : <div style={{ width: 60, height: 44, borderRadius: 8, flexShrink: 0, background: PD.raised, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car size={15} color={PD.textMuted} /></div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, color: PD.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[c.year, c.brand, c.model, c.variant].filter(Boolean).join(' ')}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: PD.textSec }}>
                    {c.selling_price ? `RM ${Number(c.selling_price).toLocaleString('en-MY')}` : t('carPicker.noPrice')}
                    {c.status === 'sold' ? ` · ${t('carPicker.sold')}` : ''}
                  </p>
                </div>
                {isLinked && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: PD.up, flexShrink: 0 }}><Check size={14} />{t('carPicker.linked')}</span>}
              </button>
            );
          })}
          {dealerOptions.length > 0 && (
            <>
              <p style={{ margin: '14px 8px 2px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PD.textMuted }}>{t('carPicker.dealerStock', { defaultValue: 'Dealer stock' })}</p>
              <p style={{ margin: '0 8px 6px', fontSize: 12, color: PD.textMuted, lineHeight: 1.4 }}>{t('carPicker.dealerStockSub', { defaultValue: "Picking one registers this buyer with the dealer. The dealer confirms the sale." })}</p>
              {dealerOptions.map((c) => (
                <button key={c.id} onClick={() => onPickDealer(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 8px', background: 'transparent', border: 'none', borderRadius: PD.radius.row, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 2 }}>
                  {c.image
                    ? <img src={cdnImg(c.image, 160, 65)} alt="" style={{ width: 60, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: PD.raised }} />
                    : <div style={{ width: 60, height: 44, borderRadius: 8, flexShrink: 0, background: PD.raised, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car size={15} color={PD.textMuted} /></div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, color: PD.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: PD.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.selling_price ? `RM ${Number(c.selling_price).toLocaleString('en-MY')}` : t('carPicker.noPrice')} · {c.dealerName}
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
