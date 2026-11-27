// The car's cost list (COSTS-1, owner approved the mockup 2026-11-27). Lives in the car pop-up's
// Owner · P&L tab (OwnerCarPanel). Two blocks: "Costs" = what the dealer typed (buy price, repairs,
// transport, ads...), each Paid / Owed / Estimate; "Worked out for you" = what carPnl() counts by
// itself (holding, transfer, admin, warranty, commission, services). Together they add up to the
// profit at the top. Rules: src/utils/carCosts.js. Reads and writes: src/lib/carCosts.js.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Car, Wrench, Truck, ClipboardCheck, Sparkles, Megaphone, Receipt, Calculator, Plus, Trash2, X, Check } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';
import { COST_KINDS, COST_STATES, checkCost, stateTotals, bucketOf } from '../../utils/carCosts';

const rm = (n) => 'RM ' + Math.round(Number(n) || 0).toLocaleString('en-MY');
const fmtD = (d) => { if (!d) return ''; try { return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }); } catch { return ''; } };
const KIND_ICON = { recon: Wrench, transport: Truck, inspection: ClipboardCheck, detailing: Sparkles, ads: Megaphone, other: Receipt };
const STATE_WORD = { paid: { w: 'Paid', c: PL.up }, owed: { w: 'Owed', c: PL.accentText }, estimate: { w: 'Estimate', c: PL.textMuted } };
const card = { background: PL.card, borderRadius: PL.radius.row, boxShadow: PL.shadow, padding: 14, marginBottom: 12 };
const eyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: PL.textMuted };
const num = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
// What carPnl counts by itself: shown apart from the typed costs so nobody mistakes them for bills.
const AUTO_KEYS = ['holding', 'services', 'commission', 'transfer', 'admin', 'warranty'];
const AUTO_HOW = {
  holding: (p) => (p.isSold ? 'Until the sale' : p.perDay.total > 0 ? `+${rm(p.perDay.total)} a day until it sells` : ''),
  transfer: (p) => (p.transferIsEstimate ? 'Estimate until the handover steps are done' : 'From the handover steps'),
  admin: () => 'From Settings, Costs',
  warranty: () => 'Set aside, not spent',
  services: () => 'Included with the car',
  commission: () => 'On the sale',
};

function Row({ icon: Icon, title, sub, amount, state, onPay, onDelete, onTap, busy }) {
  const st = STATE_WORD[state] || STATE_WORD.paid;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${PL.line}` }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: PL.raised, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={15} color={PL.textSec} /></span>
      <button type="button" onClick={onTap} disabled={!onTap} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: onTap ? 'pointer' : 'default', fontFamily: 'inherit' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: PL.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: PL.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </button>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: PL.text, ...num }}>{rm(amount)}</div>
        {onPay
          ? <button type="button" onClick={onPay} disabled={busy} style={{ marginTop: 3, fontSize: 11.5, fontWeight: 700, border: 'none', borderRadius: 999, padding: '4px 10px', background: PL.text, color: '#fff', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Mark paid</button>
          : <div style={{ fontSize: 11.5, fontWeight: 600, color: st.c, marginTop: 2 }}>{st.w}</div>}
      </div>
      {onDelete && (
        <button type="button" onClick={onDelete} disabled={busy} aria-label="Delete this cost" style={{ background: 'none', border: 'none', padding: 6, margin: '-6px -6px -6px 0', cursor: 'pointer', color: '#9ca3af', flexShrink: 0 }}><Trash2 size={14} /></button>
      )}
    </div>
  );
}

/**
 * unit: stock_units row. pnl: carPnl() result. rows: cost rows (shared shape, utils/carCosts.js).
 * Handlers return promises; the card shows its own busy state.
 */
export function CarCostsCard({ unit, pnl, rows, failed, onAdd, onPay, onDelete, onEditBuy }) {
  const [busy, setBusy] = useState(null);
  const run = async (id, fn) => { setBusy(id); try { await fn(); } finally { setBusy(null); } };
  const purchase = Number(unit.purchase_price) || 0;
  const repairs = rows.filter((r) => bucketOf(r.kind) === 'recon').reduce((s, r) => s + r.amount, 0);
  // The intake repair budget counts until real repairs pass it (one recon rule, utils/reconCost.js).
  const budgetLeft = Math.max(0, (Number(unit.recon_cost) || 0) - repairs);
  const totals = stateTotals(rows);
  totals.paid += purchase; totals.estimate += budgetLeft;
  const autoLines = pnl.lines.filter((l) => AUTO_KEYS.includes(l.key) && l.val > 0);
  const autoTotal = autoLines.reduce((s, l) => s + l.val, 0);
  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: PL.text }}>Costs</div>
          <button type="button" onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 999, padding: '8px 14px', background: PL.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}><Plus size={15} /> Add cost</button>
        </div>
        {failed && <div className="pl-note-bad" style={{ marginTop: 10, fontSize: 12.5 }}>Could not load this car's costs, so the profit above may be too high. Close and open the car again.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6, margin: '12px 0 4px' }}>
          {[['Paid', totals.paid, PL.text], ['Owed', totals.owed, totals.owed ? PL.accentText : PL.text], ['Estimated', totals.estimate, PL.text]].map(([k, v, c]) => (
            <div key={k} style={{ background: PL.raised, borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: PL.textMuted, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{rm(v)}</div>
            </div>
          ))}
        </div>
        <Row icon={Car} title="Bought the car" sub={[unit.purchase_source, fmtD(unit.purchase_date)].filter(Boolean).join(' · ') || 'Tap to set the buy price'}
          amount={purchase} state="paid" onTap={onEditBuy} />
        {budgetLeft > 0 && (
          <Row icon={Wrench} title="Repair budget, not used yet" sub="Set when the car came in. Tap to change." amount={budgetLeft} state="estimate" onTap={onEditBuy} />
        )}
        {rows.map((r) => (
          <Row key={`${r.source}:${r.id}`} icon={KIND_ICON[r.kind] || Receipt} title={r.label}
            sub={[r.payee, fmtD(r.date), r.state === 'owed' && r.due ? `due ${fmtD(r.due)}` : ''].filter(Boolean).join(' · ')}
            amount={r.amount} state={r.state} busy={busy === r.id}
            onPay={r.source === 'car_costs' && r.state === 'owed' ? () => run(r.id, () => onPay(r)) : null}
            onDelete={() => run(r.id, () => onDelete(r))} />
        ))}
        {rows.length === 0 && !failed && <div style={{ fontSize: 12.5, color: PL.textMuted, padding: '10px 0 2px', borderTop: `1px solid ${PL.line}` }}>Repairs, transport, inspection, ads: add each one here so the profit is real.</div>}
      </div>

      {autoLines.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Calculator size={14} color={PL.textMuted} />
            <span style={eyebrow}>Worked out for you</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: PL.text, ...num }}>{rm(autoTotal)}</span>
          </div>
          <div style={{ fontSize: 12, color: PL.textMuted, margin: '4px 0 2px' }}>Not bills. Counted so the profit is honest.</div>
          {autoLines.map((l) => (
            <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: `1px solid ${PL.line}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: PL.textSec }}>{l.label}</div>
                {AUTO_HOW[l.key]?.(pnl) && <div style={{ fontSize: 11.5, color: PL.textMuted }}>{AUTO_HOW[l.key](pnl)}</div>}
              </div>
              <div style={{ fontSize: 13, color: PL.text, ...num }}>{rm(l.val)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** The "Add a cost" pop-up. onSave(row) must throw on failure. */
export function AddCostSheet({ carName, payees = [], disabledReason, onSave, onClose }) {
  useModalHistory(true, onClose);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  const [f, setF] = useState({ kind: 'recon', label: '', amount: '', payee: '', state: 'paid', due: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const save = async () => {
    const c = checkCost(f);
    setErrors(c.errors);
    if (!c.ok || saving || disabledReason) return;
    setSaving(true);
    try { await onSave(c.row); } catch { setSaving(false); }
  };
  const chip = (on) => ({ border: 'none', borderRadius: 999, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: on ? PL.text : PL.raised, color: on ? '#fff' : PL.textSec, fontFamily: 'inherit' });
  const field = { width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 12, background: PL.raised, padding: '12px', fontSize: 16, color: PL.text, fontFamily: 'inherit', outline: 'none' };
  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: PL.textSec, margin: '14px 0 6px' };
  const err = (k) => errors[k] && <div style={{ fontSize: 12, color: PL.accentText, marginTop: 4 }}>{errors[k]}</div>;
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(17,24,39,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add a cost" style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: '20px 20px 0 0', padding: '16px 18px calc(18px + env(safe-area-inset-bottom))', boxShadow: PL.shadow, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: PL.text }}>Add a cost</div>
          <span style={{ fontSize: 12.5, color: PL.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{carName}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', width: 34, height: 34, flexShrink: 0, border: 'none', borderRadius: 999, background: PL.raised, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        {disabledReason && <div className="pl-note" style={{ marginTop: 12, fontSize: 12.5 }}>{disabledReason}</div>}
        <span style={label}>What for</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COST_KINDS.map((k) => <button type="button" key={k.key} onClick={() => set('kind')(k.key)} style={chip(f.kind === k.key)}>{k.label}</button>)}
        </div>
        {err('kind')}
        <label style={label} htmlFor="cc-label">What was it</label>
        <input id="cc-label" value={f.label} onChange={set('label')} maxLength={80} placeholder="e.g. 4 tyres, tow to the yard" style={field} />
        {err('label')}
        <label style={label} htmlFor="cc-amount">Amount</label>
        <div style={{ ...field, display: 'flex', gap: 6, alignItems: 'center', padding: '0 12px' }}>
          <span style={{ color: PL.textMuted, fontWeight: 700 }}>RM</span>
          <input id="cc-amount" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" style={{ ...field, padding: '12px 0', fontWeight: 700, fontSize: 18 }} />
        </div>
        {err('amount')}
        <label style={label} htmlFor="cc-payee">Paid to <span style={{ color: PL.textMuted, fontWeight: 500 }}>(optional)</span></label>
        <input id="cc-payee" list="cc-payees" value={f.payee} onChange={set('payee')} maxLength={80} placeholder="Workshop, supplier, person" style={field} />
        <datalist id="cc-payees">{payees.map((p) => <option key={p} value={p} />)}</datalist>
        <span style={label}>Where is this cost at?</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
          {COST_STATES.map((s) => (
            <button type="button" key={s.key} onClick={() => set('state')(s.key)} style={{ border: 'none', borderRadius: 12, padding: '10px 8px', cursor: 'pointer', textAlign: 'left', background: f.state === s.key ? PL.text : PL.raised, color: f.state === s.key ? '#fff' : PL.text, fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.label}</div><div style={{ fontSize: 11.5, opacity: 0.7 }}>{s.hint}</div>
            </button>
          ))}
        </div>
        {f.state === 'owed' && (
          <>
            <label style={label} htmlFor="cc-due">Due date <span style={{ color: PL.textMuted, fontWeight: 500 }}>(optional)</span></label>
            <input id="cc-due" type="date" value={f.due} onChange={set('due')} style={field} />
          </>
        )}
        <button type="button" onClick={save} disabled={saving || !!disabledReason} style={{ width: '100%', marginTop: 16, border: 'none', borderRadius: 14, padding: 14, background: PL.accent, color: '#fff', fontWeight: 800, fontSize: 15, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: saving || disabledReason ? 0.6 : 1, fontFamily: 'inherit' }}>
          <Check size={16} /> {saving ? 'Saving…' : 'Save cost'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
