// Change many cars at once (INV-BULK, owner 2026-11-10). The page owns the writes
// (bulkStatus / bulkPrice in DashboardPage.jsx); this file is the bar and the price sheet.
// "Sold" is deliberately NOT a bulk status: a sale goes through the won deal (the
// trigger makes the customer + handover), never a status write.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';

export const BULK_STATUSES = [
  { key: 'available',   label: 'Available' },
  { key: 'reserved',    label: 'Reserved' },
  { key: 'unpublished', label: 'Unpublished' },
];

const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: PL.radius.row, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' };

export function BulkBar({ count, total, busy, onSelectAll, onClear, onStatus, onPrice }) {
  const [menu, setMenu] = useState(false);
  if (!count) return null;
  return createPortal(
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9990, display: 'flex', justifyContent: 'center', padding: '0 12px calc(12px + env(safe-area-inset-bottom))', pointerEvents: 'none', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 640, background: PL.text, color: '#fff', borderRadius: 16, boxShadow: '0 10px 30px rgba(17,24,39,.35)', padding: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
        <div style={{ flex: '1 1 120px', minWidth: 0, paddingLeft: 6 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{count} selected</p>
          {count < total
            ? <button onClick={onSelectAll} style={{ background: 'none', border: 'none', padding: 0, color: '#d1d5db', fontSize: 12, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>Select all {total}</button>
            : <p style={{ margin: 0, fontSize: 12, color: '#d1d5db' }}>All cars in this list</p>}
        </div>
        <div style={{ position: 'relative' }}>
          <button disabled={busy} onClick={() => setMenu(m => !m)} style={{ ...btn, background: 'rgba(255,255,255,.12)', color: '#fff', opacity: busy ? .5 : 1 }}>Status</button>
          {menu && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, background: '#fff', borderRadius: 12, boxShadow: PL.shadow, padding: 6, minWidth: 170 }}>
              {BULK_STATUSES.map(s => (
                <button key={s.key} onClick={() => { setMenu(false); onStatus(s.key); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', fontSize: 13, fontWeight: 600, color: PL.text, background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => { e.currentTarget.style.background = PL.raised; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                  Mark {s.label.toLowerCase()}
                </button>
              ))}
              <p style={{ margin: '4px 10px 6px', fontSize: 11, color: PL.textMuted, lineHeight: 1.4 }}>Sold is one car at a time, so the buyer and handover are recorded.</p>
            </div>
          )}
        </div>
        <button disabled={busy} onClick={onPrice} style={{ ...btn, background: 'rgba(255,255,255,.12)', color: '#fff', opacity: busy ? .5 : 1 }}>Price</button>
        <button onClick={onClear} aria-label="Clear selection" style={{ ...btn, padding: 9, background: 'none', color: '#fff' }}><X style={{ width: 16, height: 16 }} /></button>
      </div>
    </div>,
    document.body,
  );
}

// New price for one car. Rounded to RM100, never below RM100.
export function bulkNewPrice(cur, { dir, unit, amount }) {
  const a = Number(amount) || 0;
  if (!cur || a <= 0) return cur;
  const delta = unit === 'pct' ? cur * a / 100 : a;
  const next = dir === 'down' ? cur - delta : cur + delta;
  return Math.max(100, Math.round(next / 100) * 100);
}

export function BulkPriceSheet({ open, cars, busy, onClose, onApply }) {
  useModalHistory(open, onClose);
  const [dir, setDir] = useState('down');
  const [unit, setUnit] = useState('rm');
  const [amount, setAmount] = useState('');
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  useEffect(() => { if (open) setAmount(''); }, [open]);
  const rule = { dir, unit, amount };
  const rows = useMemo(() => cars.map(c => {
    const cur = Number(c.selling_price || c.price) || 0;
    return { c, cur, next: bulkNewPrice(cur, rule) };
  }), [cars, dir, unit, amount]); // eslint-disable-line react-hooks/exhaustive-deps
  const tooBig = unit === 'pct' && Number(amount) >= 50;
  const changed = rows.filter(r => r.cur && r.next !== r.cur);
  if (!open) return null;
  const seg = (on) => ({ flex: 1, padding: '9px 10px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', background: on ? '#fff' : 'transparent', color: on ? PL.text : PL.textSec, boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none' });
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(17,24,39,.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div onClick={e => e.stopPropagation()} className="bp-sheet" style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <style>{`@media (min-width: 640px){ .bp-sheet{ border-radius: 20px !important; margin-bottom: 8vh; } }`}</style>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: PL.text }}>Change {cars.length} prices</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: PL.textSec }}>Rounded to the nearest RM100.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: PL.raised, border: 'none', borderRadius: 999, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: PL.text }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div style={{ display: 'flex', gap: 4, background: PL.raised, borderRadius: 999, padding: 4, marginTop: 16 }}>
          <button onClick={() => setDir('down')} style={seg(dir === 'down')}>Lower</button>
          <button onClick={() => setDir('up')} style={seg(dir === 'up')}>Raise</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input type="number" inputMode="decimal" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder={unit === 'pct' ? 'e.g. 3' : 'e.g. 2000'} autoFocus
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '11px 12px', fontSize: 16, color: PL.text, background: PL.raised, border: 'none', borderRadius: PL.radius.row, outline: 'none', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 4, background: PL.raised, borderRadius: 999, padding: 4, flexShrink: 0 }}>
            <button onClick={() => setUnit('rm')} style={{ ...seg(unit === 'rm'), flex: 'none', padding: '8px 12px' }}>RM</button>
            <button onClick={() => setUnit('pct')} style={{ ...seg(unit === 'pct'), flex: 'none', padding: '8px 12px' }}>%</button>
          </div>
        </div>
        {tooBig && <p style={{ margin: '8px 0 0', fontSize: 12, color: PL.accentText }}>That is half the price or more. Check the number.</p>}
        <div style={{ marginTop: 14, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {rows.map(({ c, cur, next }) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${PL.line}`, fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0, color: PL.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[c.year, c.brand, c.model].filter(Boolean).join(' ')}</span>
              <span style={{ color: PL.textMuted, fontVariantNumeric: 'tabular-nums' }}>RM {cur.toLocaleString('en-MY')}</span>
              <span style={{ color: next === cur ? PL.textMuted : PL.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 92, textAlign: 'right' }}>RM {next.toLocaleString('en-MY')}</span>
            </div>
          ))}
        </div>
        <button disabled={busy || !changed.length || tooBig} onClick={() => onApply(changed.map(r => ({ car: r.c, from: r.cur, to: r.next })))}
          style={{ marginTop: 14, width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#fff', background: PL.accent, border: 'none', borderRadius: PL.radius.row, cursor: busy || !changed.length || tooBig ? 'not-allowed' : 'pointer', opacity: busy || !changed.length || tooBig ? 0.5 : 1, fontFamily: 'inherit' }}>
          {busy ? 'Saving…' : changed.length ? `Change ${changed.length} price${changed.length === 1 ? '' : 's'}` : 'Enter an amount'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
