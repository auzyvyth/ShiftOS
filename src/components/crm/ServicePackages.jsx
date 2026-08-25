import React, { useState } from 'react';
import { CalendarCheck2, Plus, RotateCcw } from 'lucide-react';
import { packageStatus } from '../../hooks/useServicePackages';

// One customer's prepaid service packages. Rendered by BOTH Customers tabs (the
// light dealer dashboard and the dark salesman panel) off the same hook, so the
// two can't drift the way the old copy-pasted "add package / log visit" pair did.
//
// What changed and why:
//   - The package is PICKED from the dealer's catalogue (dealer_products), not
//     typed as free text. The catalogue already existed and is used; typing the
//     same names again meant the two could never be reconciled.
//   - A visit is a dated row with an undo, not an integer someone increments.
//     "When did he last come in?" is now answerable, and a misclick is fixable.
//   - Expiry is shown. valid_months/expires_at existed in the table but nothing
//     surfaced them, so a package could quietly expire with visits unused.

const PALETTES = {
  light: {
    surface: '#fff', fill: '#f9fafb', border: '#e5e7eb', line: '#f3f4f6',
    text: '#111827', sub: '#6b7280', dim: '#9ca3af',
    accent: '#dc2626', track: '#e5e7eb',
    ok: '#15803d', warn: '#b45309', danger: '#dc2626',
  },
  dark: {
    surface: '#0d1117', fill: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.07)',
    line: 'rgba(255,255,255,0.05)',
    text: '#f1f5f9', sub: '#94a3b8', dim: '#64748b',
    accent: '#dc2626', track: 'rgba(255,255,255,0.08)',
    ok: '#4ade80', warn: '#fbbf24', danger: '#f87171',
  },
};

const STATUS_HUE = { active: 'sub', expiring: 'warn', expired: 'danger', used: 'ok' };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const today = () => new Date().toISOString().slice(0, 10);

export default function ServicePackages({
  customer, packages = [], visits = {}, products = [],
  onAdd, onLogVisit, onUndoVisit, theme = 'light',
}) {
  const P = PALETTES[theme] || PALETTES.light;
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ product_id: '', package_name: '', total_visits: 3, valid_months: 12, sold_price: '' });
  const [logFor, setLogFor] = useState(null);          // package id being logged
  const [logForm, setLogForm] = useState({ visited_on: today(), notes: '' });
  const [historyFor, setHistoryFor] = useState(null);  // package id whose visits are shown

  const inputSx = {
    background: P.fill, border: `1px solid ${P.border}`, borderRadius: 6,
    padding: '6px 9px', color: P.text, fontSize: 12, outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
  const btn = (bg, color, extra = {}) => ({
    fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
    fontFamily: 'inherit', background: bg, color, border: '1px solid transparent', ...extra,
  });

  // Picking from the catalogue fills the name and price; "Custom" keeps the old
  // free-text escape hatch so a dealer with an empty catalogue isn't blocked.
  const pickProduct = (id) => {
    const p = products.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      product_id: id,
      package_name: p ? p.name : '',
      sold_price: p && p.selling_price != null ? String(p.selling_price) : f.sold_price,
    }));
  };

  const submitAdd = async () => {
    if (!form.package_name.trim()) return;
    setSaving(true);
    await onAdd?.(customer, form);
    setSaving(false);
    setAdding(false);
    setForm({ product_id: '', package_name: '', total_visits: 3, valid_months: 12, sold_price: '' });
  };

  const submitVisit = async (pkg) => {
    await onLogVisit?.(pkg, logForm);
    setLogFor(null);
    setLogForm({ visited_on: today(), notes: '' });
  };

  return (
    <div style={{ marginTop: 10 }}>
      {packages.map((pkg) => {
        const st = packageStatus(pkg);
        const hue = P[STATUS_HUE[st.key]] || P.sub;
        const pct = pkg.total_visits ? Math.min(100, (pkg.used_visits / pkg.total_visits) * 100) : 0;
        const rows = visits[pkg.id] || [];
        const last = rows[0];
        return (
          <div key={pkg.id} style={{ padding: '9px 0', borderTop: `1px solid ${P.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: P.text }}>{pkg.package_name}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: hue }}>{st.label}</span>
                </div>
                <div style={{ height: 4, borderRadius: 99, background: P.track, marginTop: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: st.key === 'used' ? P.ok : P.accent }} />
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 10.5, color: P.dim }}>
                  {pkg.used_visits}/{pkg.total_visits} used
                  {pkg.expires_at ? ` · valid to ${fmtDate(pkg.expires_at)}` : ''}
                  {last ? ` · last visit ${fmtDate(last.visited_on)}` : ' · no visits yet'}
                </p>
              </div>
              {st.left > 0 && (
                <button onClick={() => { setLogFor(logFor === pkg.id ? null : pkg.id); setLogForm({ visited_on: today(), notes: '' }); }}
                  style={btn(P.fill, P.text, { border: `1px solid ${P.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 })}>
                  <CalendarCheck2 size={12} /> Log visit
                </button>
              )}
            </div>

            {logFor === pkg.id && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="date" value={logForm.visited_on} max={today()}
                  onChange={(e) => setLogForm((f) => ({ ...f, visited_on: e.target.value }))}
                  style={{ ...inputSx, width: 140 }} />
                <input value={logForm.notes} placeholder="What was done (optional)"
                  onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
                  style={{ ...inputSx, flex: '1 1 150px', minWidth: 0 }} />
                <button onClick={() => submitVisit(pkg)} style={btn(P.accent, '#fff')}>Save</button>
                <button onClick={() => setLogFor(null)} style={btn('transparent', P.sub, { border: `1px solid ${P.border}` })}>Cancel</button>
              </div>
            )}

            {rows.length > 0 && (
              <button onClick={() => setHistoryFor(historyFor === pkg.id ? null : pkg.id)}
                style={{ marginTop: 6, fontSize: 10.5, fontWeight: 600, color: P.sub, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                {historyFor === pkg.id ? 'Hide visits' : `${rows.length} visit${rows.length === 1 ? '' : 's'} logged`}
              </button>
            )}

            {historyFor === pkg.id && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rows.map((v) => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: P.fill }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: P.text, flexShrink: 0 }}>{fmtDate(v.visited_on)}</span>
                    <span style={{ fontSize: 11, color: P.sub, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || '—'}</span>
                    {/* Undo: the whole reason a visit is a row and not a counter. */}
                    <button onClick={() => onUndoVisit?.(v)} title="Remove this visit"
                      style={{ background: 'transparent', border: 'none', color: P.dim, cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0 }}>
                      <RotateCcw size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {products.length > 0 && (
            <select value={form.product_id} onChange={(e) => pickProduct(e.target.value)}
              style={{ ...inputSx, flex: '1 1 100%', cursor: 'pointer' }}>
              <option value="">Pick from your catalogue…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.selling_price != null ? ` · RM ${Number(p.selling_price).toLocaleString()}` : ''}</option>
              ))}
              <option value="custom">Custom (type a name)</option>
            </select>
          )}
          <input value={form.package_name} onChange={(e) => setForm((f) => ({ ...f, package_name: e.target.value }))}
            placeholder="Package name" style={{ ...inputSx, flex: '1 1 140px', minWidth: 0 }} />
          <input type="number" min="1" value={form.total_visits} onChange={(e) => setForm((f) => ({ ...f, total_visits: e.target.value }))}
            title="Number of visits included" placeholder="Visits" style={{ ...inputSx, width: 64 }} />
          <input type="number" min="1" value={form.valid_months} onChange={(e) => setForm((f) => ({ ...f, valid_months: e.target.value }))}
            title="Valid for how many months" placeholder="Months" style={{ ...inputSx, width: 70 }} />
          <input type="number" value={form.sold_price} onChange={(e) => setForm((f) => ({ ...f, sold_price: e.target.value }))}
            placeholder="RM price" style={{ ...inputSx, width: 88 }} />
          <button onClick={submitAdd} disabled={saving || !form.package_name.trim()}
            style={btn(P.accent, '#fff', { opacity: saving || !form.package_name.trim() ? 0.5 : 1 })}>Save</button>
          <button onClick={() => setAdding(false)} style={btn('transparent', P.sub, { border: `1px solid ${P.border}` })}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: P.accent, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={12} /> Add service package
        </button>
      )}
    </div>
  );
}
