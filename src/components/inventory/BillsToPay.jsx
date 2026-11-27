// "Bills to pay" (COSTS-1, 2026-11-28): every OWED cost across the dealer's cars, oldest due first,
// with one-tap Mark paid. Lives at the top of Inventory > Stock & costs and shows only when
// something is owed (no empty card). Rows come from the same read as every money screen
// (lib/carCosts.js); the Stock tab passes them in.
import { useState } from 'react';
import { toast } from 'sonner';
import { Receipt } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';
import { updateCarCost } from '../../lib/carCosts';
import { billsToPay } from '../../utils/carCosts';

const rm = (n) => 'RM ' + Math.round(Number(n) || 0).toLocaleString('en-MY');
const fmtD = (d) => { try { return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }); } catch { return ''; } };
const SHOW = 5;

export default function BillsToPay({ rows, carName, onChanged }) {
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(null);
  const list = billsToPay(rows);
  if (!list.length) return null;
  const total = list.reduce((s, b) => s + b.amount, 0);
  const late = list.filter((b) => b.overdueDays > 0).length;
  const pay = async (b) => {
    setBusy(b.id);
    try { await updateCarCost(b.id, { state: 'paid' }); toast.success('Marked paid'); onChanged?.(); }
    catch { toast.error('Could not mark it paid'); }
    setBusy(null);
  };
  return (
    <div className="min-[900px]:max-w-[50%]" style={{ background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="pl-well" style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center' }}><Receipt size={15} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: PL.text }}>Bills to pay</div>
          <div style={{ fontSize: 12.5, color: late ? PL.accentText : PL.textMuted }}>
            {list.length} bill{list.length === 1 ? '' : 's'}{late ? `, ${late} overdue` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 800, color: PL.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rm(total)}</div>
      </div>
      {(all ? list : list.slice(0, SHOW)).map((b) => (
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: `1px solid ${PL.line}`, marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: PL.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}{b.payee ? ` · ${b.payee}` : ''}</div>
            <div style={{ fontSize: 12, color: PL.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {/* When it is due comes first: on a phone the end of this line is cut off. */}
              <span style={{ color: b.overdueDays > 0 ? PL.accentText : PL.textMuted, fontWeight: b.overdueDays > 0 ? 600 : 400 }}>
                {b.overdueDays > 0 ? `${b.overdueDays} day${b.overdueDays === 1 ? '' : 's'} overdue` : b.due ? `Due ${fmtD(b.due)}` : 'No due date'}
              </span> · {carName(b.unitId)}
            </div>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: PL.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rm(b.amount)}</div>
          <button type="button" onClick={() => pay(b)} disabled={busy === b.id} style={{ fontSize: 11.5, fontWeight: 700, border: 'none', borderRadius: 999, padding: '5px 10px', background: PL.text, color: '#fff', cursor: 'pointer', opacity: busy === b.id ? 0.6 : 1, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>Mark paid</button>
        </div>
      ))}
      {list.length > SHOW && (
        <button type="button" onClick={() => setAll((v) => !v)} style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 700, color: PL.textSec, cursor: 'pointer', fontFamily: 'inherit' }}>
          {all ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </div>
  );
}
