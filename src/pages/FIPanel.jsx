import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, ChevronUp, Plus, X, TrendingUp,
  CreditCard, DollarSign, Clock, CheckCircle2, XCircle, Banknote,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import FinancingCalculator from '../components/FinancingCalculator';
import { toast } from 'sonner';

const ACCENT = '#a855f7';

const MY_BANKS = [
  'Maybank', 'CIMB', 'Public Bank', 'RHB', 'AmBank',
  'Hong Leong Bank', 'AEON Credit', 'BSN', 'MBSB Bank',
  'ELK-Desa', 'Bank Islam', 'Bank Rakyat', 'Alliance Bank', 'Affin Bank',
];
const TENURES = [12, 24, 36, 48, 60, 72, 84, 96, 108];
const HP_STATUS = {
  pending:   { label: 'Pending',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)' },
  approved:  { label: 'Approved',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)' },
  rejected:  { label: 'Rejected',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)' },
  disbursed: { label: 'Disbursed', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)' },
};
const STAGE_LABEL = {
  negotiation: 'Negotiation', closing: 'Closing',
  won: 'Won', closed_won: 'Closed Won', pending: 'Pending',
};

// EIR (reducing balance) instalment — HPAA 2026 compliant
function calcEIR(principal, annualRatePct, months) {
  const r = (annualRatePct / 100) / 12;
  if (!r || !months || !principal) return 0;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}
function fmtRM(n) {
  return 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function daysSince(ts) {
  return Math.floor((Date.now() - new Date(ts)) / 86400000);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 18, height: 18, color }} />
      </div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#f3f4f6', margin: 0 }}>{value}</p>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color, margin: '2px 0 0', fontWeight: 600 }}>{sub}</p>}
      </div>
    </div>
  );
}

function HPStatusBadge({ status }) {
  const s = HP_STATUS[status] || HP_STATUS.pending;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.label}
    </span>
  );
}

function HPSubmissionRow({ row, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [rejectReason, setRejectReason] = useState(row.rejection_reason || '');
  const [saving, setSaving] = useState(false);
  const days = daysSince(row.submitted_at);

  const handleSave = async () => {
    setSaving(true);
    const patch = { status, updated_at: new Date().toISOString() };
    if (status === 'rejected') patch.rejection_reason = rejectReason;
    if (status === 'approved' && !row.approved_at) patch.approved_at = new Date().toISOString();
    if (status === 'disbursed' && !row.disbursed_at) patch.disbursed_at = new Date().toISOString();
    const { error } = await supabase.from('deal_financing').update(patch).eq('id', row.id);
    if (error) { toast.error('Update failed'); } else { onUpdate({ ...row, ...patch }); setEditing(false); toast.success('Status updated'); }
    setSaving(false);
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', minWidth: 80 }}>{row.bank_name}</span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{fmtRM(row.loan_amount)}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{row.tenure_months}m</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{fmtRM(row.monthly_install)}/mo</span>
        <span style={{ fontSize: 11, color: days > 5 ? '#ef4444' : '#6b7280' }}>{days}d ago</span>
        <HPStatusBadge status={row.status} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setEditing(e => !e)} style={{ fontSize: 11, color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            Update
          </button>
          <button onClick={() => onDelete(row.id)} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
            <X style={{ width: 10, height: 10 }} />
          </button>
        </div>
      </div>
      {row.rejection_reason && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Reason: {row.rejection_reason}</p>}
      {row.notes && <p style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{row.notes}</p>}
      {editing && (
        <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {Object.entries(HP_STATUS).map(([k, v]) => (
              <button key={k} onClick={() => setStatus(k)} style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', background: status === k ? v.bg : 'none', border: `1px solid ${status === k ? v.border : 'rgba(255,255,255,0.08)'}`, color: status === k ? v.color : '#6b7280' }}>
                {v.label}
              </button>
            ))}
          </div>
          {status === 'rejected' && (
            <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (DSR, CCRIS, etc.)" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', color: 'white', fontSize: 12, marginBottom: 8 }} />
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '7px', borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '7px', borderRadius: 6, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddHPForm({ leadId, listingId, dealerId, carPrice, onAdd, onClose }) {
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState(carPrice ? String(Math.round(carPrice * 0.9)) : '');
  const [tenure, setTenure] = useState(84);
  const [rate, setRate] = useState(3.5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const instalment = useMemo(() => calcEIR(Number(amount), rate, tenure), [amount, rate, tenure]);
  const margin = carPrice && amount ? ((Number(amount) / carPrice) * 100).toFixed(1) : null;

  const handleSubmit = async () => {
    if (!bank || !amount || Number(amount) <= 0) { toast.error('Bank and loan amount required'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('deal_financing').insert({
      dealer_id: dealerId, lead_id: leadId, listing_id: listingId || null,
      bank_name: bank, loan_amount: Number(amount), tenure_months: tenure,
      annual_rate_pct: rate, monthly_install: Math.round(instalment),
      margin_pct: margin ? Number(margin) : null,
      notes: notes.trim() || null, submitted_at: new Date().toISOString(),
    }).select().single();
    if (error) { toast.error('Failed to add'); } else { onAdd(data); onClose(); toast.success('HP submission added'); }
    setSaving(false);
  };

  const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: 'white', fontSize: 13, outline: 'none' };

  return (
    <div style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 10, padding: 14, marginTop: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>New HP Submission</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <select value={bank} onChange={e => setBank(e.target.value)} style={{ ...inp, appearance: 'none' }}>
          <option value="">— Select bank —</option>
          {MY_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Loan amount" type="number" style={inp} />
        <select value={tenure} onChange={e => setTenure(Number(e.target.value))} style={{ ...inp, appearance: 'none' }}>
          {TENURES.map(t => <option key={t} value={t}>{t} months ({(t/12).toFixed(0)}yr)</option>)}
        </select>
        <div style={{ position: 'relative' }}>
          <input value={rate} onChange={e => setRate(Number(e.target.value))} placeholder="Rate % p.a." type="number" step="0.1" style={{ ...inp, paddingRight: 32 }} />
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#4b5563' }}>%</span>
        </div>
      </div>
      {instalment > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, padding: '8px 10px', background: 'rgba(168,85,247,0.06)', borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: '#c084fc' }}>EIR instalment: <strong>{fmtRM(instalment)}/mo</strong></span>
          {margin && <span style={{ fontSize: 12, color: '#9ca3af' }}>Margin: {margin}%</span>}
        </div>
      )}
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" style={{ ...inp, marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSubmit} disabled={saving || !bank} style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (saving || !bank) ? 0.5 : 1 }}>
          {saving ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

function DealCard({ deal, catalog, hpRows, onHPAdd, onHPUpdate, onHPDelete, dealerId, commissionRate }) {
  const [hpOpen, setHpOpen] = useState(false);
  const [addHPOpen, setAddHPOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({ product_id: '', sold_price: '' });
  const [addingProduct, setAddingProduct] = useState(false);
  const [products, setProducts] = useState(deal.deal_products || []);

  const car = deal.car_listing;
  const fiGross = products.reduce((s, p) => s + (Number(p.sold_price) - Number(p.dealer_products?.cost_price || 0)), 0);
  const myCommission = fiGross * (commissionRate || 0);

  const handleAddProduct = async () => {
    if (!productForm.product_id || !productForm.sold_price) return;
    setAddingProduct(true);
    const { data, error } = await supabase.from('deal_products').insert({
      dealer_id: dealerId, lead_id: deal.id,
      listing_id: deal.car_listing_id || null,
      product_id: productForm.product_id,
      sold_price: Number(productForm.sold_price),
    }).select('id, sold_price, product_id, dealer_products(name, category, cost_price)').single();
    if (error) toast.error('Failed');
    else { setProducts(p => [...p, data]); setProductForm({ product_id: '', sold_price: '' }); setAddProductOpen(false); toast.success('Added'); }
    setAddingProduct(false);
  };
  const handleRemoveProduct = async (id) => {
    await supabase.from('deal_products').delete().eq('id', id);
    setProducts(p => p.filter(x => x.id !== id));
  };

  const pendingHP = hpRows.filter(r => r.status === 'pending').length;
  const latestHP = hpRows[0];

  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
      {/* Deal header */}
      <div style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {car?.images?.[0] ? (
          <img src={car.images[0]} alt="" style={{ width: 72, height: 54, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 72, height: 54, borderRadius: 8, background: 'rgba(168,85,247,0.1)', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#f3f4f6', margin: '0 0 2px' }}>{deal.buyer_name || 'Unknown Buyer'}</p>
          {car && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{car.year} {car.brand} {car.model} · {fmtRM(car.selling_price)}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT, background: `${ACCENT}15`, border: `1px solid ${ACCENT}25`, borderRadius: 20, padding: '2px 8px' }}>
              {STAGE_LABEL[deal.stage] || deal.stage}
            </span>
            {latestHP && <HPStatusBadge status={latestHP.status} />}
            {pendingHP > 0 && <span style={{ fontSize: 10, color: '#f59e0b' }}>{pendingHP} pending bank</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: fiGross > 0 ? '#34d399' : '#4b5563', margin: 0 }}>{fmtRM(fiGross)}</p>
          <p style={{ fontSize: 10, color: '#4b5563', margin: '2px 0 0' }}>F&I gross</p>
          {myCommission > 0 && <p style={{ fontSize: 11, color: ACCENT, margin: '2px 0 0', fontWeight: 600 }}>+{fmtRM(myCommission)}</p>}
        </div>
      </div>

      {/* Products table */}
      {products.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '8px 16px' }}>
          {products.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ flex: 1, fontSize: 12, color: '#e5e7eb' }}>{p.dealer_products?.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#f3f4f6' }}>{fmtRM(p.sold_price)}</span>
              <span style={{ fontSize: 11, color: '#22c55e' }}>+{fmtRM(Number(p.sold_price) - Number(p.dealer_products?.cost_price || 0))}</span>
              <button onClick={() => handleRemoveProduct(p.id)} style={{ color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <X style={{ width: 11, height: 11 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions bar */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
        <button
          onClick={() => { setAddProductOpen(v => !v); setAddHPOpen(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#a855f7', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}
        >
          <Plus style={{ width: 11, height: 11 }} /> Add Product
        </button>
        <button
          onClick={() => { setHpOpen(v => !v); setAddHPOpen(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#60a5fa', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}
        >
          <CreditCard style={{ width: 11, height: 11 }} /> HP {hpRows.length > 0 ? `(${hpRows.length})` : ''}
          {hpOpen ? <ChevronUp style={{ width: 10, height: 10 }} /> : <ChevronDown style={{ width: 10, height: 10 }} />}
        </button>
      </div>

      {/* Add product form */}
      {addProductOpen && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={productForm.product_id}
              onChange={e => {
                const sel = catalog.find(c => c.id === e.target.value);
                setProductForm({ product_id: e.target.value, sold_price: sel ? String(sel.selling_price) : '' });
              }}
              style={{ flex: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: 'white', fontSize: 12, appearance: 'none' }}
            >
              <option value="">— Select product —</option>
              {catalog.map(p => <option key={p.id} value={p.id}>{p.name} — {fmtRM(p.selling_price)}</option>)}
            </select>
            <input
              value={productForm.sold_price}
              onChange={e => setProductForm(f => ({ ...f, sold_price: e.target.value }))}
              placeholder="Price"
              type="number"
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: 'white', fontSize: 12 }}
            />
            <button
              onClick={handleAddProduct}
              disabled={addingProduct || !productForm.product_id}
              style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!productForm.product_id || addingProduct) ? 0.5 : 1 }}
            >
              {addingProduct ? '…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* HP submissions */}
      {hpOpen && (
        <div style={{ padding: '0 16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ paddingTop: 10 }}>
            {hpRows.length === 0 ? (
              <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 8 }}>No HP submissions yet.</p>
            ) : (
              hpRows.map(row => (
                <HPSubmissionRow
                  key={row.id} row={row}
                  onUpdate={updated => onHPUpdate(deal.id, updated)}
                  onDelete={id => onHPDelete(deal.id, id)}
                />
              ))
            )}
            {!addHPOpen && (
              <button
                onClick={() => setAddHPOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#60a5fa', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', width: '100%', justifyContent: 'center', marginTop: 4 }}
              >
                <Plus style={{ width: 11, height: 11 }} /> Add Bank Submission
              </button>
            )}
            {addHPOpen && (
              <AddHPForm
                leadId={deal.id}
                listingId={deal.car_listing_id}
                dealerId={dealerId}
                carPrice={car?.selling_price}
                onAdd={row => onHPAdd(deal.id, row)}
                onClose={() => setAddHPOpen(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bank Scorecard ────────────────────────────────────────────────────────────
function BankScorecard({ rows }) {
  const [open, setOpen] = useState(false);
  const banks = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (!r.bank_name) return;
      if (!map[r.bank_name]) map[r.bank_name] = { total: 0, approved: 0, rejected: 0, daysSum: 0, daysCount: 0 };
      const b = map[r.bank_name];
      b.total++;
      const isApproved = r.status === 'approved' || r.status === 'disbursed';
      if (isApproved) {
        b.approved++;
        if (r.approved_at && r.submitted_at) {
          b.daysSum += Math.max(0, Math.floor((new Date(r.approved_at) - new Date(r.submitted_at)) / 86400000));
          b.daysCount++;
        }
      }
      if (r.status === 'rejected') {
        b.rejected++;
        if (r.updated_at && r.submitted_at) {
          b.daysSum += Math.max(0, Math.floor((new Date(r.updated_at) - new Date(r.submitted_at)) / 86400000));
          b.daysCount++;
        }
      }
    });
    return Object.entries(map).map(([name, b]) => ({
      name,
      total: b.total,
      approved: b.approved,
      rejected: b.rejected,
      pending: b.total - b.approved - b.rejected,
      approvalRate: b.total > 0 ? Math.round((b.approved / b.total) * 100) : 0,
      avgDays: b.daysCount > 0 ? Math.round(b.daysSum / b.daysCount) : null,
    })).sort((a, b) => b.approvalRate - a.approvalRate);
  }, [rows]);

  if (banks.length === 0) return null;

  return (
    <div style={{ marginBottom: 20, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: ACCENT }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Bank Performance Scorecard</span>
        {open ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Bank','Total','Approved','Rejected','Pending','Approval %','Avg Days'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Bank' ? 'left' : 'right', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {banks.map(b => (
                <tr key={b.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 10px', color: '#e5e7eb', fontWeight: 600 }}>{b.name}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#9ca3af' }}>{b.total}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{b.approved}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#ef4444' }}>{b.rejected}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#f59e0b' }}>{b.pending}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: b.approvalRate >= 60 ? '#22c55e' : b.approvalRate >= 30 ? '#f59e0b' : '#ef4444' }}>
                      {b.approvalRate}%
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#9ca3af' }}>{b.avgDays != null ? `${b.avgDays}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── HP Board Tab ─────────────────────────────────────────────────────────────
function HPBoardTab({ dealerId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!dealerId) return;
    supabase
      .from('deal_financing')
      .select('*, lead:leads(buyer_name, phone, car_listing:car_listings(brand, model, year))')
      .eq('dealer_id', dealerId)
      .order('submitted_at', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false); });
  }, [dealerId]);

  const handleUpdate = async (id, patch) => {
    const { error } = await supabase.from('deal_financing').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter);

  const counts = useMemo(() => ({
    pending: rows.filter(r => r.status === 'pending').length,
    approved: rows.filter(r => r.status === 'approved').length,
    rejected: rows.filter(r => r.status === 'rejected').length,
    disbursed: rows.filter(r => r.status === 'disbursed').length,
  }), [rows]);

  if (loading) return <p style={{ color: '#4b5563', fontSize: 13, padding: 24 }}>Loading HP board…</p>;

  return (
    <div>
      <BankScorecard rows={rows} />
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['all', 'All', '#6b7280'], ...Object.entries(HP_STATUS).map(([k, v]) => [k, v.label, v.color])].map(([k, label, color]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            style={{
              fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              background: filter === k ? `${color}15` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === k ? `${color}30` : 'rgba(255,255,255,0.07)'}`,
              color: filter === k ? color : '#6b7280',
            }}
          >
            {label} {k !== 'all' ? `(${counts[k] || 0})` : `(${rows.length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#4b5563', fontSize: 13 }}>No submissions{filter !== 'all' ? ` with status "${filter}"` : ''}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(row => {
            const days = daysSince(row.submitted_at);
            const overdue = row.status === 'pending' && days > 5;
            const car = row.lead?.car_listing;
            return (
              <div
                key={row.id}
                style={{
                  background: overdue ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${overdue ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 12, padding: '14px 16px',
                  display: 'grid', gridTemplateColumns: '140px 1fr auto auto auto auto', gap: 16, alignItems: 'center',
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>{row.bank_name}</p>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{new Date(row.submitted_at).toLocaleDateString('en-MY')}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: '#d1d5db', margin: 0 }}>{row.lead?.buyer_name}</p>
                  {car && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{car.year} {car.brand} {car.model}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>{fmtRM(row.loan_amount)}</p>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{row.tenure_months}m</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{fmtRM(row.monthly_install)}/mo</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: overdue ? '#ef4444' : '#6b7280', fontWeight: overdue ? 700 : 400, margin: 0 }}>{days}d</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <HPStatusBadge status={row.status} />
                  {row.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleUpdate(row.id, { status: 'approved', approved_at: new Date().toISOString() })}
                        style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', cursor: 'pointer' }}
                      >Approve</button>
                      <button
                        onClick={() => handleUpdate(row.id, { status: 'rejected' })}
                        style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer' }}
                      >Reject</button>
                    </div>
                  )}
                  {row.status === 'approved' && (
                    <button
                      onClick={() => handleUpdate(row.id, { status: 'disbursed', disbursed_at: new Date().toISOString() })}
                      style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', cursor: 'pointer' }}
                    >Mark Disbursed</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main FIPanel ─────────────────────────────────────────────────────────────
export default function FIPanel() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('deals');
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // Data
  const [deals, setDeals] = useState([]);
  const [hpMap, setHpMap] = useState({});  // { lead_id: [deal_financing rows] }
  const [catalog, setCatalog] = useState([]);

  const dealerId = profile?.dealer_id;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { navigate('/login'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
      if (!p || p.role !== 'fi_officer') { navigate('/login'); return; }
      setProfile(p);
      setLoading(false);

      const loadNotifs = () =>
        supabase.from('salesman_notifications').select('*').eq('salesman_id', p.id)
          .order('created_at', { ascending: false }).limit(20)
          .then(({ data: d }) => setNotifications(d || []));
      loadNotifs();
      const ch = supabase.channel('fi_notifs_' + p.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'salesman_notifications', filter: `salesman_id=eq.${p.id}` }, loadNotifs)
        .subscribe();
      return () => supabase.removeChannel(ch);
    });
  }, [navigate]);

  useEffect(() => {
    if (!dealerId) return;
    const did = dealerId;

    // Leads in active F&I stages with products + car
    supabase.from('leads')
      .select('id, buyer_name, phone, stage, car_listing_id, created_at, car_listing:car_listings(id, brand, model, year, selling_price, images), deal_products(id, sold_price, product_id, dealer_products(name, category, cost_price))')
      .eq('dealer_id', did)
      .in('stage', ['negotiation', 'closing', 'won', 'closed_won', 'pending'])
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDeals(data || []));

    // All HP submissions for this dealer
    supabase.from('deal_financing').select('*').eq('dealer_id', did).order('submitted_at', { ascending: false })
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(row => {
          if (!map[row.lead_id]) map[row.lead_id] = [];
          map[row.lead_id].push(row);
        });
        setHpMap(map);
      });

    // Product catalog
    supabase.from('dealer_products').select('id, name, category, selling_price, cost_price')
      .eq('dealer_id', did).eq('is_active', true).order('name')
      .then(({ data }) => setCatalog(data || []));
  }, [dealerId]);

  // Stats — this month's F&I gross
  const stats = useMemo(() => {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const allProducts = deals.flatMap(d => d.deal_products || []);
    const gross = allProducts.reduce((s, p) => s + (Number(p.sold_price) - Number(p.dealer_products?.cost_price || 0)), 0);
    const commission = gross * (profile?.commission_rate || 0);
    const activeDeals = deals.filter(d => d.stage === 'negotiation' || d.stage === 'closing').length;
    const pendingHP = Object.values(hpMap).flat().filter(r => r.status === 'pending').length;
    return { gross, commission, activeDeals, pendingHP };
  }, [deals, hpMap, profile]);

  const handleHPAdd = (leadId, row) => setHpMap(m => ({ ...m, [leadId]: [row, ...(m[leadId] || [])] }));
  const handleHPUpdate = (leadId, updated) => setHpMap(m => ({ ...m, [leadId]: (m[leadId] || []).map(r => r.id === updated.id ? updated : r) }));
  const handleHPDelete = async (leadId, id) => {
    await supabase.from('deal_financing').delete().eq('id', id);
    setHpMap(m => ({ ...m, [leadId]: (m[leadId] || []).filter(r => r.id !== id) }));
  };

  const NAV = [
    { id: 'deals', label: 'Deals' },
    { id: 'hp', label: 'HP Board' },
    { id: 'calculator', label: 'Calculator' },
    { id: 'documents', label: 'Documents' },
  ];

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#05070e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#6b7280', fontFamily: "'DM Sans',sans-serif" }}>Loading...</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#05070e', fontFamily: "'DM Sans',sans-serif", color: '#f0f2f5' }}>

      {/* Header */}
      <header style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} />
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: ACCENT }}>F&amp;I PANEL</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280' }}>{profile?.full_name}</span>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setNotifOpen(p => !p)} style={{ position: 'relative', padding: 6, borderRadius: 8, background: notifications.some(n => !n.is_read) ? 'rgba(168,85,247,0.1)' : 'transparent', border: notifications.some(n => !n.is_read) ? '1px solid rgba(168,85,247,0.25)' : '1px solid transparent', color: notifications.some(n => !n.is_read) ? '#c084fc' : '#6b7280', cursor: 'pointer', display: 'flex' }}>
            <Bell style={{ width: 16, height: 16 }} />
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, background: ACCENT, color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #05070e' }}>
                {Math.min(notifications.filter(n => !n.is_read).length, 9)}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, width: 300, maxHeight: 380, overflowY: 'auto', background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>Notifications</span>
                </div>
                {notifications.length === 0
                  ? <p style={{ fontSize: 13, color: '#4b5563', padding: '20px', textAlign: 'center' }}>No messages yet</p>
                  : notifications.map(n => (
                    <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: n.is_read ? 'transparent' : 'rgba(168,85,247,0.04)' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: '0 0 2px' }}>{n.title || 'Message'}</p>
                      <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{n.body}</p>
                    </div>
                  ))
                }
              </div>
            </>
          )}
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => navigate('/login'))} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Logout</button>
      </header>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', display: 'flex', gap: 0 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setActiveNav(n.id)} style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: activeNav === n.id ? `2px solid ${ACCENT}` : '2px solid transparent', color: activeNav === n.id ? ACCENT : '#6b7280', fontSize: 13, fontWeight: activeNav === n.id ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.15s' }}>
            {n.label}
          </button>
        ))}
      </nav>

      {/* Main */}
      <main style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>

        {activeNav === 'deals' && (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              <StatCard icon={TrendingUp}    label="F&I Gross (active deals)" value={fmtRM(stats.gross)}       color="#a855f7" />
              <StatCard icon={DollarSign}    label="My Commission"             value={fmtRM(stats.commission)}  color="#34d399" />
              <StatCard icon={Banknote}      label="Active Deals"              value={stats.activeDeals}        color="#60a5fa" />
              <StatCard icon={Clock}         label="Pending HP Submissions"    value={stats.pendingHP}          color={stats.pendingHP > 0 ? '#f59e0b' : '#4b5563'} />
            </div>

            {deals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#4b5563', fontSize: 13 }}>
                No active deals in negotiation or closing stages.
              </div>
            ) : (
              deals.map(deal => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  catalog={catalog}
                  hpRows={hpMap[deal.id] || []}
                  dealerId={dealerId}
                  commissionRate={profile?.commission_rate || 0}
                  onHPAdd={handleHPAdd}
                  onHPUpdate={handleHPUpdate}
                  onHPDelete={handleHPDelete}
                />
              ))
            )}
          </>
        )}

        {activeNav === 'hp' && <HPBoardTab dealerId={dealerId} />}

        {activeNav === 'calculator' && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24 }}>
            <p style={{ fontSize: 11, color: ACCENT, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
              EIR Financing Calculator (HPAA 2026)
            </p>
            <FinancingCalculator />
          </div>
        )}

        {activeNav === 'documents' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {['Sales Agreement', 'Deposit Receipt', 'Handover Checklist', 'Loan Application'].map(s => (
              <div key={s} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 11, color: ACCENT, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>{s}</p>
                <div style={{ height: 60, background: 'rgba(255,255,255,0.02)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, color: '#1f2937' }}>Coming soon</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
