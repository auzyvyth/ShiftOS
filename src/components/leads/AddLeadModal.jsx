import React, { useState, useEffect } from 'react';
import { X, UserPlus, Search } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { INCOME_OPTIONS, EMPLOYMENT_OPTIONS, SOURCE_CONFIG, STAGE_ORDER, STAGE_CONFIG } from '../../lib/leadsHelpers';

const inp = "w-full bg-white/[0.05] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/10 transition-all";
const sel = inp + " appearance-none";

const EMPTY = {
  buyer_name:     '',
  phone:          '',
  lead_source:    '',
  car_listing_id: '',
  employment_type:'',
  income_bracket: '',
  notes:          '',
  assigned_to:    '',
  stage:          'new',
  follow_up_date: '',
};

export default function AddLeadModal({ onClose, onAdd, teamMembers = [] }) {
  const [form, setForm]       = useState(EMPTY);
  const [cars, setCars]       = useState([]);
  const [carSearch, setCarSearch] = useState('');
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState({});

  // Load dealer's active listings
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('car_listings')
        .select('id, brand, model, year, variant, selling_price')
        .eq('dealer_id', user.id)
        .neq('status', 'sold')
        .order('brand');
      setCars(data || []);
    }
    load();
  }, []);

  const filtered = cars.filter(c => {
    const q = carSearch.toLowerCase();
    return !q || [c.brand, c.model, c.year?.toString(), c.variant].join(' ').toLowerCase().includes(q);
  });

  function set(k, v) {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.buyer_name.trim()) e.buyer_name  = 'Required';
    if (!form.phone.trim())      e.phone        = 'Required';
    if (!form.lead_source)       e.lead_source  = 'Required';
    return e;
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        buyer_name:     form.buyer_name.trim(),
        phone:          form.phone.trim(),
        lead_source:    form.lead_source,
        stage:          form.stage || 'new',
        car_listing_id: form.car_listing_id || null,
        employment_type:form.employment_type || null,
        income_bracket: form.income_bracket  || null,
        assigned_to:    form.assigned_to     || null,
        notes:          form.notes.trim()    || null,
        follow_up_date: form.follow_up_date  || null,
      };
      await onAdd(payload);
      onClose();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-xl overflow-hidden"
        style={{ background: 'rgba(11,11,15,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 0 1px rgba(220,38,38,0.07), 0 32px 64px rgba(0,0,0,0.72)', fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent 8%,rgba(220,38,38,0.55) 38%,rgba(56,189,248,0.38) 68%,transparent 92%)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.18)' }}>
              <UserPlus className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Add Lead</h3>
              <p className="text-xs text-gray-600">New buyer enquiry</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Buyer name */}
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Buyer Name <span className="text-red-500">*</span></label>
            <input
              value={form.buyer_name}
              onChange={e => set('buyer_name', e.target.value)}
              className={`${inp} ${errors.buyer_name ? 'border-red-500/50' : ''}`}
              placeholder="e.g. Ahmad Faiz"
            />
            {errors.buyer_name && <p className="text-xs text-red-400 mt-1">{errors.buyer_name}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Phone Number <span className="text-red-500">*</span></label>
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              className={`${inp} ${errors.phone ? 'border-red-500/50' : ''}`}
              placeholder="01X-XXXXXXX"
              type="tel"
            />
            {errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone}</p>}
          </div>

          {/* Source + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Lead Source <span className="text-red-500">*</span></label>
              <select
                value={form.lead_source}
                onChange={e => set('lead_source', e.target.value)}
                className={`${sel} ${errors.lead_source ? 'border-red-500/50' : ''}`}
              >
                <option value="" disabled>Select…</option>
                {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              {errors.lead_source && <p className="text-xs text-red-400 mt-1">{errors.lead_source}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Initial Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)} className={sel}>
                {STAGE_ORDER.map(s => (
                  <option key={s} value={s}>{STAGE_CONFIG[s]?.emoji} {STAGE_CONFIG[s]?.label || s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Car of interest */}
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Car of Interest</label>
            <div className="relative mb-1.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
              <input
                value={carSearch}
                onChange={e => setCarSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 rounded-lg bg-white/[0.04] border border-white/10 focus:outline-none focus:border-red-600/40"
                placeholder="Search brand, model…"
              />
            </div>
            <select
              value={form.car_listing_id}
              onChange={e => set('car_listing_id', e.target.value)}
              className={sel}
              size={filtered.length > 0 ? Math.min(filtered.length + 1, 5) : 2}
            >
              <option value="">— No specific car —</option>
              {filtered.map(c => (
                <option key={c.id} value={c.id}>
                  {c.year} {c.brand} {c.model}{c.variant ? ` ${c.variant}` : ''}{c.selling_price ? ` · RM ${c.selling_price.toLocaleString()}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Follow-up date */}
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Follow-up Date (optional)</label>
            <input
              type="datetime-local"
              value={form.follow_up_date}
              onChange={e => set('follow_up_date', e.target.value)}
              className={inp}
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Employment + Income */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Employment</label>
              <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)} className={sel}>
                <option value="">—</option>
                {EMPLOYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Monthly Income</label>
              <select value={form.income_bracket} onChange={e => set('income_bracket', e.target.value)} className={sel}>
                <option value="">—</option>
                {INCOME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Assign to */}
          {teamMembers.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Assign To</label>
              <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className={sel}>
                <option value="">— Unassigned —</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Any additional context…"
              className={inp + " resize-none"}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white font-semibold disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 2px 10px rgba(220,38,38,0.28)' }}
          >
            {saving ? 'Adding…' : 'Add Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
