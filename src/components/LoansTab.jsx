import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Plus, X, ChevronDown, Landmark, CheckCircle2, XCircle,
  Clock, Banknote, Download, Search, Filter,
} from 'lucide-react';

const BANKS = [
  'Maybank','CIMB','Public Bank','RHB Bank','Hong Leong Bank',
  'AmBank','Bank Islam','Bank Rakyat','BSN','MBSB Bank',
  'Affin Bank','Alliance Bank','Agro Bank','Other',
];

const STATUS_CFG = {
  pending:   { label: 'Pending',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  Icon: Clock },
  approved:  { label: 'Approved',  color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  Icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', Icon: XCircle },
  disbursed: { label: 'Disbursed', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.3)',  Icon: Banknote },
};

const EMPTY_FORM = {
  customer_name: '', bank_name: '', loan_amount: '',
  submission_date: new Date().toISOString().slice(0, 10),
  status: 'pending', commission_amount: '', notes: '',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  const Ic = cfg.Icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
    }}>
      <Ic size={11} /> {cfg.label}
    </span>
  );
}

export default function LoansTab({ userId, listings, salesmen }) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editId, setEditId] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchLoans = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('loan_submissions')
      .select('*, car_listings(brand, model, year), profiles(full_name)')
      .eq('dealer_id', userId)
      .order('submission_date', { ascending: false });
    setLoans(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  async function handleSave() {
    if (!form.customer_name.trim() || !form.bank_name) return;
    setSaving(true);
    const payload = {
      dealer_id: userId,
      customer_name: form.customer_name.trim(),
      bank_name: form.bank_name,
      loan_amount: form.loan_amount ? Number(form.loan_amount) : null,
      submission_date: form.submission_date || null,
      status: form.status,
      commission_amount: form.commission_amount ? Number(form.commission_amount) : null,
      notes: form.notes.trim() || null,
    };
    if (editId) {
      await supabase.from('loan_submissions').update(payload).eq('id', editId);
    } else {
      await supabase.from('loan_submissions').insert([payload]);
    }
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setSaving(false);
    fetchLoans();
  }

  function openEdit(loan) {
    setForm({
      customer_name: loan.customer_name || '',
      bank_name: loan.bank_name || '',
      loan_amount: loan.loan_amount ? String(loan.loan_amount) : '',
      submission_date: loan.submission_date || '',
      status: loan.status || 'pending',
      commission_amount: loan.commission_amount ? String(loan.commission_amount) : '',
      notes: loan.notes || '',
    });
    setEditId(loan.id);
    setShowForm(true);
  }

  async function updateStatus(id, status) {
    await supabase.from('loan_submissions').update({ status }).eq('id', id);
    setLoans(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this loan submission?')) return;
    await supabase.from('loan_submissions').delete().eq('id', id);
    setLoans(prev => prev.filter(l => l.id !== id));
  }

  function exportCSV() {
    const rows = [
      ['Customer', 'Bank', 'Loan Amount', 'Date', 'Status', 'Commission', 'Notes'],
      ...loans.map(l => [
        l.customer_name, l.bank_name,
        l.loan_amount || '', l.submission_date || '',
        l.status, l.commission_amount || '', l.notes || '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `loan-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const filtered = loans.filter(l => {
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || l.customer_name?.toLowerCase().includes(q) || l.bank_name?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // Summary stats
  const totalLoans = loans.length;
  const approved = loans.filter(l => l.status === 'approved').length;
  const pending = loans.filter(l => l.status === 'pending').length;
  const totalCommission = loans.filter(l => l.status === 'approved' || l.status === 'disbursed')
    .reduce((s, l) => s + (Number(l.commission_amount) || 0), 0);

  const T = {
    card: { background: 'rgba(15,20,35,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 },
    input: {
      width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#f9fafb',
      outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box',
    },
    label: { fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' },
  };

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#e5e7eb' }}>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Submissions', val: totalLoans, color: '#60a5fa' },
          { label: 'Approved', val: approved, color: '#4ade80' },
          { label: 'Pending', val: pending, color: '#fbbf24' },
          { label: 'Commission Earned', val: `RM ${totalCommission.toLocaleString()}`, color: '#34d399' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...T.card, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4b5563' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search customer or bank…"
            style={{ ...T.input, paddingLeft: 32 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          {['all', 'pending', 'approved', 'rejected', 'disbursed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{
                padding: '7px 12px', fontSize: 12, fontWeight: statusFilter === s ? 600 : 400,
                background: statusFilter === s ? 'rgba(220,38,38,0.15)' : 'none',
                color: statusFilter === s ? '#f87171' : '#6b7280',
                border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                textTransform: 'capitalize',
              }}
            >
              {s === 'all' ? 'All' : STATUS_CFG[s]?.label}
            </button>
          ))}
        </div>
        <button onClick={exportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          <Download size={13} /> Export
        </button>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          <Plus size={15} /> Log Submission
        </button>
      </div>

      {/* Add/Edit form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#0d1526', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f9fafb' }}>{editId ? 'Edit Submission' : 'Log Loan Submission'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={T.label}>Customer Name *</label>
                <input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Full name" style={T.input} />
              </div>
              <div>
                <label style={T.label}>Bank *</label>
                <select value={form.bank_name} onChange={e => set('bank_name', e.target.value)} style={{ ...T.input, appearance: 'none' }}>
                  <option value="">Select bank…</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={T.label}>Loan Amount (RM)</label>
                  <input type="number" value={form.loan_amount} onChange={e => set('loan_amount', e.target.value)} placeholder="e.g. 75000" style={T.input} min="0" />
                </div>
                <div>
                  <label style={T.label}>Submission Date</label>
                  <input type="date" value={form.submission_date} onChange={e => set('submission_date', e.target.value)} style={T.input} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={T.label}>Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...T.input, appearance: 'none' }}>
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={T.label}>Commission Earned (RM)</label>
                  <input type="number" value={form.commission_amount} onChange={e => set('commission_amount', e.target.value)} placeholder="e.g. 1500" style={T.input} min="0" />
                </div>
              </div>
              <div>
                <label style={T.label}>Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Bank branch, contact, conditions…" rows={2}
                  style={{ ...T.input, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setShowForm(false)}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#9ca3af', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving || !form.customer_name.trim() || !form.bank_name}
                  style={{ padding: '9px 20px', borderRadius: 8, background: !form.customer_name.trim() || !form.bank_name ? 'rgba(220,38,38,0.3)' : '#dc2626', border: 'none', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
                  {saving ? 'Saving…' : editId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ ...T.card, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Landmark size={32} style={{ color: '#1f2937', marginBottom: 12 }} />
            <p style={{ color: '#4b5563', fontSize: 14, margin: 0 }}>
              {loans.length === 0 ? 'No loan submissions yet. Log your first one.' : 'No results for this filter.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Customer', 'Bank', 'Loan Amount', 'Date', 'Status', 'Commission', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((loan, idx) => (
                  <tr key={loan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#f3f4f6', fontWeight: 500 }}>{loan.customer_name}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#9ca3af' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Landmark size={13} style={{ color: '#60a5fa' }} />
                        {loan.bank_name}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                      {loan.loan_amount ? `RM ${Number(loan.loan_amount).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {loan.submission_date ? new Date(loan.submission_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <select value={loan.status} onChange={e => updateStatus(loan.id, e.target.value)}
                        style={{ background: STATUS_CFG[loan.status]?.bg, border: `1px solid ${STATUS_CFG[loan.status]?.border}`, color: STATUS_CFG[loan.status]?.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', appearance: 'none' }}>
                        {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: loan.commission_amount ? '#4ade80' : '#374151', fontWeight: loan.commission_amount ? 600 : 400 }}>
                      {loan.commission_amount ? `RM ${Number(loan.commission_amount).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(loan)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(loan.id)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
