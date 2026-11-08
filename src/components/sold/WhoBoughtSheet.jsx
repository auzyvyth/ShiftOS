import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, UserPlus, ChevronRight } from 'lucide-react';
import { premiumDark as PD } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';

// "Sold" picked from a car's status menu (SOLD-1, 2026-11-02). It used to only
// flip the car's status, so the sale had no customer record, no handover steps
// and no renewal reminders: 6 seller cars were sold that way. Now the seller
// says who bought it, and the pick goes through the normal win (the won
// trigger does the rest). "Sold elsewhere" keeps the old status-only path for
// a car sold off the platform. Shared by Lite and Premium (both dark).
export default function WhoBoughtSheet({ car, leads, onPickLead, onAddBuyer, onSoldElsewhere, onClose }) {
  const { t } = useTranslation();
  useModalHistory(true, onClose);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const carName = [car?.year, car?.brand, car?.model, car?.variant].filter(Boolean).join(' ');
  const row = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
    background: PD.raised, border: 'none', borderRadius: PD.radius.row, padding: '12px 14px',
    color: PD.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, marginBottom: 8,
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('soldPick.title')}
        style={{ width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', background: PD.card, borderRadius: `${PD.radius.card}px ${PD.radius.card}px 0 0`, padding: '20px 16px calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
          <p style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 700, color: PD.text }}>{t('soldPick.title')}</p>
          <button onClick={onClose} aria-label={t('soldPick.cancel')} style={{ background: 'none', border: 'none', color: PD.textMuted, cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: PD.textSec, lineHeight: 1.5 }}>{t('soldPick.sub', { car: carName })}</p>

        {leads.length === 0 && <p style={{ margin: '0 0 12px', fontSize: 13, color: PD.textMuted }}>{t('soldPick.noLeads')}</p>}
        {leads.map((l) => (
          <button key={l.id} onClick={() => onPickLead(l)} style={row}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.buyer_name || t('soldPick.unnamed')}</span>
              <span style={{ display: 'block', fontSize: 12, color: PD.textMuted }}>{t(`soldPick.stage.${l.stage}`, { defaultValue: l.stage })}</span>
            </span>
            <ChevronRight size={16} color={PD.textMuted} />
          </button>
        ))}

        <button onClick={onAddBuyer} style={{ ...row, color: PD.text }}>
          <UserPlus size={16} color={PD.textSec} />
          <span style={{ flex: 1 }}>{t('soldPick.addBuyer')}</span>
        </button>
        <button onClick={onSoldElsewhere} style={{ ...row, background: 'none', color: PD.textSec, fontSize: 13, justifyContent: 'center', marginBottom: 0 }}>
          {t('soldPick.elsewhere')}
        </button>
      </div>
    </div>,
    document.body,
  );
}

// One line on a lead whose car was sold to another buyer, with its two actions.
export function CarSoldLine({ onOffer, onLost, text }) {
  const { t } = useTranslation();
  const btn = { fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: PD.radius.pill, border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div style={{ background: PD.raised, borderRadius: PD.radius.row, padding: '9px 12px', marginBottom: 12 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: PD.text, lineHeight: 1.45 }}>{text || t('soldPick.carSoldLine')}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onOffer} className="lk-red" style={{ ...btn, color: PD.onAccent }}>{t('soldPick.offerAnother')}</button>
        <button onClick={onLost} style={{ ...btn, background: 'transparent', color: PD.textSec }}>{t('soldPick.markLost')}</button>
      </div>
    </div>
  );
}
