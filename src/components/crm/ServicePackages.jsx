import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck2, Plus, RotateCcw } from 'lucide-react';
import { packageStatus } from '../../hooks/useServicePackages';
import { AFTERCARE_PRESETS, AFTERCARE_CATEGORIES, nextVisitDue } from '../../utils/aftercare';
import { premiumDark as PD } from '../../theme/tokens';

// One customer's aftercare plans: the visits a seller promised the buyer after
// the sale (a free first service, oil changes, a care visit). Rendered by BOTH
// Customers tabs (the light dealer dashboard and the dark salesman panel) off
// the same hook, so the two can't drift.
//
// Stored in service_packages / service_visits, unchanged. What changed:
//   - It is framed as aftercare, with presets for what dealers actually give
//     (oil change, periodic service, care visit). It used to offer the whole
//     add-on catalogue, so the only plan ever made was "PPF satin, 3 visits":
//     a one-off coating nobody comes back for three times. Catalogue items are
//     still offered, but only the service / workshop kind (AFTERCARE_CATEGORIES).
//   - Every plan shows when the NEXT visit is due (utils/aftercare nextVisitDue),
//     which is what the Sold tab's "Coming up" list and "This week" call on.
//   - A visit is a dated row with an undo, not an integer someone increments.

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
  // Salesman Premium (SIMPLE-2): tone instead of borders, mint the only green,
  // red text for "due" (no amber). `solid` = picked chips and buttons are
  // filled pills, not outlined ones.
  premium: {
    surface: PD.card, fill: PD.raised, border: 'transparent', line: PD.line,
    text: PD.text, sub: PD.textSec, dim: PD.textMuted,
    accent: PD.accent, track: PD.hover,
    ok: PD.up, warn: PD.accentText, danger: PD.accentText, solid: true,
  },
};

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { product_id: '', package_name: '', total_visits: 2, valid_months: 12, sold_price: '' };

export default function ServicePackages({
  customer, packages = [], visits = {}, products = [],
  onAdd, onLogVisit, onUndoVisit, theme = 'light',
}) {
  const { t, i18n } = useTranslation();
  const P = PALETTES[theme] || PALETTES.light;
  const locale = i18n.language?.startsWith('ms') ? 'ms-MY' : 'en-MY';
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [picked, setPicked] = useState(null);          // preset key, product id or 'custom'
  const [logFor, setLogFor] = useState(null);          // package id being logged
  const [logForm, setLogForm] = useState({ visited_on: today(), notes: '' });
  const [historyFor, setHistoryFor] = useState(null);  // package id whose visits are shown

  const serviceProducts = products.filter((p) => AFTERCARE_CATEGORIES.includes(p.category));

  const inputSx = {
    // Premium inputs sit one step lighter than the add box they are in.
    background: P.solid ? PD.hover : P.fill, border: `1px solid ${P.border}`, borderRadius: P.solid ? 10 : 6,
    padding: '7px 9px', color: P.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box', width: '100%', ...(P.solid ? { colorScheme: 'dark' } : null),
  };
  const btn = (bg, color, extra = {}) => ({
    fontSize: 12, fontWeight: 700, padding: P.solid ? '7px 13px' : '6px 11px', borderRadius: P.solid ? 999 : 6, cursor: 'pointer',
    fontFamily: 'inherit', background: bg, color, border: '1px solid transparent', ...extra,
  });
  const chip = (on) => (P.solid ? {
    fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
    background: on ? P.accent : PD.hover, color: on ? '#fff' : P.sub, border: 'none',
  } : {
    fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
    background: on ? `${P.accent}1f` : 'transparent', color: on ? P.text : P.sub,
    border: `1px solid ${on ? `${P.accent}66` : P.border}`,
  });
  const label = { fontSize: 11, fontWeight: 600, color: P.sub, margin: '0 0 4px' };

  const presetName = (p) => t(`aftercare.presets.${p.key}`, { defaultValue: p.name });
  const pickPreset = (p) => { setPicked(p.key); setForm({ ...EMPTY_FORM, package_name: presetName(p), total_visits: p.visits, valid_months: p.months }); };
  const pickProduct = (p) => {
    setPicked(p.id);
    setForm((f) => ({ ...f, product_id: p.id, package_name: p.name, sold_price: p.selling_price != null ? String(p.selling_price) : '' }));
  };
  const pickCustom = () => { setPicked('custom'); setForm(EMPTY_FORM); };

  const close = () => { setAdding(false); setPicked(null); setForm(EMPTY_FORM); };
  const submitAdd = async () => {
    if (!form.package_name.trim()) return;
    setSaving(true);
    await onAdd?.(customer, form);
    setSaving(false);
    close();
  };

  const submitVisit = async (pkg) => {
    await onLogVisit?.(pkg, logForm);
    setLogFor(null);
    setLogForm({ visited_on: today(), notes: '' });
  };

  const statusLine = (pkg) => {
    const st = packageStatus(pkg);
    if (st.key === 'used') return { text: t('aftercare.allDone', { defaultValue: 'All visits done' }), hue: P.ok };
    if (st.key === 'expired') return { text: t('aftercare.ended', { n: st.left, defaultValue: 'Plan ended · {{n}} unused' }), hue: P.danger };
    const due = nextVisitDue(pkg);
    const days = due ? Math.round((new Date(due) - new Date()) / 86400000) : null;
    if (days !== null && days <= 0) return { text: t('aftercare.dueNow', { defaultValue: 'Next visit due now' }), hue: P.warn };
    if (days !== null && days <= 14) return { text: t('aftercare.dueIn', { n: days, defaultValue: 'Next visit in {{n}} days' }), hue: P.warn };
    return { text: t('aftercare.nextOn', { date: fmtDate(due), defaultValue: 'Next visit {{date}}' }), hue: P.sub };
  };

  return (
    <div>
      {packages.length === 0 && !adding && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: P.sub, lineHeight: 1.5 }}>
          {t('aftercare.empty', { defaultValue: 'No aftercare yet. A free first service or an oil change brings the buyer back to you, and back means the next car.' })}
        </p>
      )}

      {packages.map((pkg, i) => {
        const st = packageStatus(pkg);
        const line = statusLine(pkg);
        const rows = visits[pkg.id] || [];
        return (
          <div key={pkg.id} style={{ padding: '10px 0', borderTop: i ? `1px solid ${P.line}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: P.text }}>{pkg.package_name}</p>
                {/* One dot per visit: filled = done. Reads faster than a bar
                    when a plan has 1 to 4 visits, which is all of them. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', gap: 3 }}>
                    {Array.from({ length: Math.min(pkg.total_visits || 0, 12) }).map((_, k) => (
                      <span key={k} style={{ width: 7, height: 7, borderRadius: 99, background: k < pkg.used_visits ? P.ok : P.track }} />
                    ))}
                  </span>
                  <span style={{ fontSize: 11.5, color: P.sub }}>
                    {t('aftercare.visitsDone', { done: pkg.used_visits, total: pkg.total_visits, defaultValue: '{{done}} of {{total}} done' })}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: line.hue }}>· {line.text}</span>
                </div>
              </div>
              {st.left > 0 && st.key !== 'expired' && (
                <button onClick={() => { setLogFor(logFor === pkg.id ? null : pkg.id); setLogForm({ visited_on: today(), notes: '' }); }}
                  style={btn(P.fill, P.text, { border: `1px solid ${P.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 })}>
                  <CalendarCheck2 size={13} /> {t('aftercare.logVisit', { defaultValue: 'Log visit' })}
                </button>
              )}
            </div>

            {logFor === pkg.id && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="date" value={logForm.visited_on} max={today()}
                  onChange={(e) => setLogForm((f) => ({ ...f, visited_on: e.target.value }))}
                  style={{ ...inputSx, width: 150 }} />
                <input value={logForm.notes} placeholder={t('aftercare.whatWasDone', { defaultValue: 'What was done (optional)' })}
                  onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
                  style={{ ...inputSx, flex: '1 1 150px', width: 'auto', minWidth: 0 }} />
                <button onClick={() => submitVisit(pkg)} style={btn(P.accent, '#fff')}>{t('aftercare.save', { defaultValue: 'Save' })}</button>
                <button onClick={() => setLogFor(null)} style={btn('transparent', P.sub, { border: `1px solid ${P.border}` })}>{t('aftercare.cancel', { defaultValue: 'Cancel' })}</button>
              </div>
            )}

            {rows.length > 0 && (
              <button onClick={() => setHistoryFor(historyFor === pkg.id ? null : pkg.id)}
                style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: P.sub, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                {historyFor === pkg.id
                  ? t('aftercare.hideVisits', { defaultValue: 'Hide visits' })
                  : t('aftercare.lastVisit', { date: fmtDate(rows[0].visited_on), defaultValue: 'Last visit {{date}} · see all' })}
              </button>
            )}

            {historyFor === pkg.id && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rows.map((v) => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: P.fill }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: P.text, flexShrink: 0 }}>{fmtDate(v.visited_on)}</span>
                    <span style={{ fontSize: 11.5, color: P.sub, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || '-'}</span>
                    {/* Undo: the whole reason a visit is a row and not a counter. */}
                    <button onClick={() => onUndoVisit?.(v)} title={t('aftercare.removeVisit', { defaultValue: 'Remove this visit' })}
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
        <div style={{ marginTop: 8, padding: 12, borderRadius: P.solid ? 14 : 8, background: P.fill, border: `1px solid ${P.border}` }}>
          <p style={label}>{t('aftercare.whatPlan', { defaultValue: 'What are you giving this buyer?' })}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AFTERCARE_PRESETS.map((p) => (
              <button key={p.key} onClick={() => pickPreset(p)} style={chip(picked === p.key)}>{presetName(p)}</button>
            ))}
            {serviceProducts.map((p) => (
              <button key={p.id} onClick={() => pickProduct(p)} style={chip(picked === p.id)}>{p.name}</button>
            ))}
            <button onClick={pickCustom} style={chip(picked === 'custom')}>{t('aftercare.custom', { defaultValue: 'Something else' })}</button>
          </div>

          {picked && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={label}>{t('aftercare.name', { defaultValue: 'Name' })}</p>
                <input value={form.package_name} onChange={(e) => setForm((f) => ({ ...f, package_name: e.target.value }))}
                  placeholder={t('aftercare.namePh', { defaultValue: 'e.g. Free oil change' })} style={inputSx} />
              </div>
              <div>
                <p style={label}>{t('aftercare.visits', { defaultValue: 'Visits' })}</p>
                <input type="number" min="1" max="12" value={form.total_visits} onChange={(e) => setForm((f) => ({ ...f, total_visits: e.target.value }))} style={inputSx} />
              </div>
              <div>
                <p style={label}>{t('aftercare.months', { defaultValue: 'Over how many months' })}</p>
                <input type="number" min="1" max="60" value={form.valid_months} onChange={(e) => setForm((f) => ({ ...f, valid_months: e.target.value }))} style={inputSx} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={label}>{t('aftercare.price', { defaultValue: 'Price paid (RM), leave empty if free' })}</p>
                <input type="number" min="0" value={form.sold_price} onChange={(e) => setForm((f) => ({ ...f, sold_price: e.target.value }))} style={inputSx} />
              </div>
              {Number(form.total_visits) > 0 && Number(form.valid_months) > 0 && (
                <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 11.5, color: P.sub }}>
                  {t('aftercare.schedule', { every: Math.max(1, Math.round(Number(form.valid_months) / Number(form.total_visits))), defaultValue: 'One visit about every {{every}} months. Each one shows up in Coming up when it is due.' })}
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button onClick={submitAdd} disabled={saving || !form.package_name.trim()}
              style={btn(P.accent, '#fff', { opacity: saving || !form.package_name.trim() ? 0.5 : 1 })}>{t('aftercare.addPlan', { defaultValue: 'Add plan' })}</button>
            <button onClick={close} style={btn('transparent', P.sub, { border: `1px solid ${P.border}` })}>{t('aftercare.cancel', { defaultValue: 'Cancel' })}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: P.accent, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={13} /> {t('aftercare.add', { defaultValue: 'Add aftercare plan' })}
        </button>
      )}
    </div>
  );
}
