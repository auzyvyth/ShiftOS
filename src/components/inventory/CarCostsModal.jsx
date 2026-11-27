// The Stock tab's "Costs" pop-up (COSTS-1): the same cost list as the car pop-up's Owner tab
// (CarCostsCard + useCarCosts), for a stock record. Replaced the Stock tab's own Recon Jobs and
// Ad Spend pop-ups, which wrote the older recon_jobs / ad_spend tables.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';
import { useCarCosts, LEDGER_OFF_REASON } from '../../hooks/useCarCosts';
import { CarCostsCard, AddCostSheet } from './CarCostsCard';

export default function CarCostsModal({ dealerId, unit, carName, onClose, onChanged, onEditBuy }) {
  useModalHistory(true, onClose);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  const c = useCarCosts(dealerId, unit.id, { onChanged });
  const [sheet, setSheet] = useState(null); // null | { initial }
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(17,24,39,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Costs, ${carName}`} style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: PL.canvas, borderRadius: PL.radius.card, padding: 14, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: PL.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{carName}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', width: 34, height: 34, flexShrink: 0, border: 'none', borderRadius: 999, background: PL.card, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        {c.loading ? <p style={{ fontSize: 13, color: PL.textMuted, textAlign: 'center', padding: 20 }}>Loading costs…</p> : (
          <CarCostsCard unit={unit} rows={c.rows} failed={c.failed}
            onAdd={() => setSheet({ initial: null })} onEdit={(r) => setSheet({ initial: r })}
            onState={c.setState} onDelete={c.remove} onEditBuy={onEditBuy} />
        )}
      </div>
      {sheet && (
        <AddCostSheet carName={carName} payees={c.payees} initial={sheet.initial}
          disabledReason={c.ledgerLive ? null : LEDGER_OFF_REASON}
          onSave={async (row) => { if (sheet.initial) await c.edit(sheet.initial, row); else await c.add(row); setSheet(null); }}
          onClose={() => setSheet(null)} />
      )}
    </div>,
    document.body,
  );
}
