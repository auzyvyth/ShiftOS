import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import {
  Wrench, Megaphone, ShieldCheck,
  X, Plus, Trash2, UserCheck, Clock,
} from 'lucide-react';
import { useModalHistory } from '../../hooks/useModalHistory';
import { carPnl } from '../../utils/carPnl';
import { premiumLight as PL } from '../../theme/tokens';

const rm = (n) => 'RM ' + Math.round(Number(n) || 0).toLocaleString();
const fmtD = (d) => { try { return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } };
const ago = (d) => { if (!d) return '—'; const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return days <= 0 ? 'today' : days === 1 ? '1d ago' : `${days}d ago`; };

const AD_CHANNELS = [
  { v: 'mudah', l: 'Mudah' }, { v: 'carlist', l: 'Carlist' }, { v: 'facebook', l: 'Facebook' },
  { v: 'tiktok', l: 'TikTok' }, { v: 'instagram', l: 'Instagram' }, { v: 'other', l: 'Other' },
];
const ENC_OPTS = [
  { v: 'clear', l: 'Clear title', c: '#16a34a' },
  { v: 'under_hp', l: 'Under HP', c: '#dc2626' },
  { v: 'unknown', l: 'Not verified', c: '#d97706' },
];
const encCfg = (v) => ENC_OPTS.find((o) => o.v === v) || ENC_OPTS[2];

// premiumLight (2026-11-12): grey block, no border, quiet icon; the title says what it is.
const Section = ({ icon: Icon, title, right, children }) => (
  <div style={{ background: PL.raised, borderRadius: PL.radius.row, padding: 14, marginBottom: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon style={{ width: 14, height: 14, color: PL.textMuted }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: PL.textSec, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const inp = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', background: '#fff', boxSizing: 'border-box', color: '#111827' };

// Tool editor modal — portals above the drawer; explicit Save (no real-time writes).
function ToolModal({ title, onClose, children, footer }) {
  useModalHistory(true, onClose);
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', fontFamily: "system-ui,sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}><X style={{ width: 18, height: 18 }} /></button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export default function OwnerCarPanel({ listing, userId, salesmenById = {}, tool, setTool, onStatusChange, statusUpdating, onMarkSold }) {
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState(null);
  const [recon, setRecon] = useState([]);
  const [ads, setAds] = useState([]);
  const [addons, setAddons] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [costCfg, setCostCfg] = useState(null);
  const [creating, setCreating] = useState(false);

  // tool form state
  const [costForm, setCostForm] = useState({ purchase_price: '', recon_cost: '' });
  const [compForm, setCompForm] = useState({ puspakom_b5_date: '', puspakom_b7_date: '', encumbrance_status: 'unknown' });
  const [reconForm, setReconForm] = useState({ title: '', cost: '' });
  const [adForm, setAdForm] = useState({ channel: 'mudah', amount: '' });
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState(null);

  const close = () => setTool && setTool(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase
      .from('stock_units').select('*')
      .eq('listing_id', listing.id).eq('dealer_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    setUnit(u || null);
    // Buyer traffic (views, enquiries, saves) moved to the pop-up's Analytics button (2026-11-12).
    const [rcfg, dp, pst] = await Promise.all([
      supabase.from('dealer_cost_settings').select('*').eq('dealer_id', userId).maybeSingle(),
      supabase.from('deal_products').select('sold_price, dealer_products(name, cost_price)').eq('listing_id', listing.id).eq('dealer_id', userId),
      supabase.from('post_sale_tasks').select('step_key, status, cost').eq('listing_id', listing.id).eq('dealer_id', userId),
    ]);
    setCostCfg(rcfg.data || null);
    setAddons(dp.data || []);
    setTasks(pst.data || []);
    if (u) {
      const [rj, ad] = await Promise.all([
        supabase.from('recon_jobs').select('*').eq('stock_unit_id', u.id).order('created_at', { ascending: false }),
        supabase.from('ad_spend').select('*').eq('stock_unit_id', u.id).order('spent_at', { ascending: false }),
      ]);
      setRecon(rj.data || []);
      setAds(ad.data || []);
    } else { setRecon([]); setAds([]); }
    setLoading(false);
  }, [listing.id, userId]);

  useEffect(() => { load(); }, [load]);

  // Seed the relevant tool form whenever a tool opens.
  useEffect(() => {
    if (!unit) return;
    if (tool === 'prices') setCostForm({ purchase_price: String(unit.purchase_price || ''), recon_cost: String(unit.recon_cost || '') });
    if (tool === 'compliance') setCompForm({ puspakom_b5_date: unit.puspakom_b5_date || '', puspakom_b7_date: unit.puspakom_b7_date || '', encumbrance_status: unit.encumbrance_status || 'unknown' });
    if (tool === 'activity') {
      setActivity(null);
      // Merge the stock_unit's and the linked car_listing's events so the timeline
      // shows the full story (creation + price/status from the listing, cost/sold/
      // compliance from the stock unit), not just half of it.
      supabase.from('activity_log').select('summary, actor_name, actor_role, action, created_at')
        .in('record_id', [unit.id, listing.id].filter(Boolean)).order('created_at', { ascending: false }).limit(40)
        .then(({ data }) => setActivity(data || []));
    }
  }, [tool, unit, listing.id]);

  const createUnit = async () => {
    setCreating(true);
    const { data, error } = await supabase.from('stock_units').insert({
      dealer_id: userId, listing_id: listing.id,
      status: listing.status === 'sold' ? 'sold' : 'in_stock',
      purchase_price: 0, asking_price: listing.selling_price || 0, encumbrance_status: 'unknown',
    }).select().single();
    setCreating(false);
    if (error) { toast.error('Could not create cost record'); return; }
    setUnit(data);
    toast.success('Cost record created');
  };

  // ---- P&L: the ONE engine (src/utils/carPnl.js), counted from the day the car was added ----
  const pnl = unit ? carPnl({
    purchase: unit.purchase_price,
    reconEstimate: unit.recon_cost,
    reconJobs: recon,
    servicesCost: listing.included_services_cost,
    commission: listing.commission_amount,
    // The handover checklist exists only after the win; until then transfer costs are estimated.
    handoverCost: tasks.length ? tasks.filter((t) => t.status !== 'na').reduce((sum, t) => sum + (Number(t.cost) || 0), 0) : null,
    adSpend: ads.reduce((sum, a) => sum + (Number(a.amount) || 0), 0),
    addonRevenue: addons.reduce((sum, a) => sum + (Number(a.sold_price) || 0), 0),
    addonCost: addons.reduce((sum, a) => sum + (Number(a.dealer_products?.cost_price) || 0), 0),
    asking: listing.selling_price || unit.asking_price,
    soldPrice: unit.sold_price || listing.sold_price,
    isSold: unit.status === 'sold' || listing.status === 'sold',
    startDate: unit.purchase_date || unit.created_at || listing.created_at,
    soldDate: unit.sold_date || listing.sold_date || listing.sold_at,
    engineCc: listing.engine_cc || unit.engine_cc,
    warrantyMonths: listing.warranty_months,
    cfg: costCfg || {},
  }) : null;

  // ---- tool actions ----
  const saveCost = async () => {
    setSaving(true);
    const patch = { purchase_price: Number(costForm.purchase_price) || 0, recon_cost: Number(costForm.recon_cost) || 0 };
    const { error } = await supabase.from('stock_units').update(patch).eq('id', unit.id).eq('dealer_id', userId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    setUnit((p) => ({ ...p, ...patch }));
    toast.success('Cost updated'); close();
  };

  const saveComp = async () => {
    setSaving(true);
    const patch = {
      puspakom_b5_date: compForm.puspakom_b5_date || null,
      puspakom_b7_date: compForm.puspakom_b7_date || null,
      encumbrance_status: compForm.encumbrance_status,
    };
    const { error } = await supabase.from('stock_units').update(patch).eq('id', unit.id).eq('dealer_id', userId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    setUnit((p) => ({ ...p, ...patch }));
    toast.success('Compliance updated'); close();
  };

  const addRecon = async () => {
    if (!reconForm.title.trim()) { toast.error('Enter a job title'); return; }
    const { data, error } = await supabase.from('recon_jobs').insert({
      dealer_id: userId, stock_unit_id: unit.id, title: reconForm.title.trim(),
      category: 'other', cost: reconForm.cost ? Number(reconForm.cost) : null, status: 'pending',
    }).select().single();
    if (error) { toast.error('Failed to add'); return; }
    setRecon((p) => [data, ...p]); setReconForm({ title: '', cost: '' });
  };
  const delRecon = async (id) => {
    const { error } = await supabase.from('recon_jobs').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    setRecon((p) => p.filter((j) => j.id !== id));
  };
  const addAd = async () => {
    if (!adForm.amount || Number(adForm.amount) <= 0) { toast.error('Enter an amount'); return; }
    const { data, error } = await supabase.from('ad_spend').insert({
      dealer_id: userId, stock_unit_id: unit.id, listing_id: listing.id,
      channel: adForm.channel, amount: Number(adForm.amount), spent_at: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (error) { toast.error('Failed to add'); return; }
    setAds((p) => [data, ...p]); setAdForm({ channel: 'mudah', amount: '' });
  };
  const delAd = async (id) => {
    const { error } = await supabase.from('ad_spend').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    setAds((p) => p.filter((a) => a.id !== id));
  };

  if (loading) return <p style={{ fontSize: 13, color: '#6b7280', padding: '20px 0', textAlign: 'center' }}>Loading owner detail…</p>;

  if (!unit) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>No cost record exists for this car yet.</p>
        <button onClick={createUnit} disabled={creating} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: creating ? 0.6 : 1 }}>
          {creating ? 'Creating…' : 'Create cost record'}
        </button>
      </div>
    );
  }

  // status / attribution
  const closer = listing.assigned_to ? salesmenById[listing.assigned_to] : null;
  const reservedBy = listing.reserved_by ? salesmenById[listing.reserved_by] : null;
  const status = listing.status || 'available';
  const statusCfg = { available: { l: 'Available', c: '#16a34a' }, reserved: { l: 'Reserved', c: '#d97706' }, sold: { l: 'Sold', c: '#6b7280' }, unpublished: { l: 'Unpublished', c: '#6b7280' } }[status] || { l: status, c: '#6b7280' };

  // verdict: one plain sentence, from the engine's numbers only.
  const v = pnl;
  const loss = v.net < 0;
  const thin = !loss && v.margin != null && v.margin < 5;
  const signed = (x) => `${x < 0 ? '− ' : '+'}${rm(Math.abs(x))}`;
  const perDay = Math.round(v.perDay.total);
  const verdict = v.isSold
    ? `${loss ? 'Lost' : 'Made'} ${rm(Math.abs(v.net))} on this car after ${v.days ?? '?'} days.`
    : loss
      ? `Losing ${rm(Math.abs(v.net))} if it sells at the asking price today. Break-even is ${rm(v.breakeven)}.`
      : v.daysUntilZero != null
        ? `${rm(v.net)} profit if it sells today. Holding eats it in ${v.daysUntilZero} more day${v.daysUntilZero === 1 ? '' : 's'}.`
        : `${rm(v.net)} profit if it sells at the asking price today.`;

  const reconTotal = recon.reduce((s, j) => s + (Number(j.cost) || 0), 0);
  const adTotal = ads.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const enc = encCfg(unit.encumbrance_status || 'unknown');

  const Badge = ({ ok, label, color }) => (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: ok ? `${color}15` : 'rgba(100,116,139,0.08)', border: `1px solid ${ok ? `${color}40` : 'rgba(100,116,139,0.18)'}`, color: ok ? color : '#94a3b8' }}>{label}</span>
  );
  return (
    <div>
      {/* Identity */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        {listing.images?.[0]
          ? <img src={listing.images[0]} alt="" style={{ width: 92, height: 66, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #e5e7eb' }} />
          : <div style={{ width: 92, height: 66, borderRadius: 10, background: '#f3f4f6', border: '1px solid #e5e7eb', flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.brand} {listing.model}</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{[listing.year, listing.variant, listing.plate_number].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      </div>
      {/* Live meter (owner, 2026-11-12): counted from the day the car was added, moves every day. */}
      <div style={{ background: PL.raised, borderRadius: PL.radius.row, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: PL.textMuted }}>
          {v.isSold ? 'Final result' : 'If it sells at the asking price today'}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: loss ? PL.accentText : PL.up, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{signed(v.net)}</div>
        <div style={{ fontSize: 13, color: thin || loss ? PL.accentText : PL.textSec, marginTop: 4, lineHeight: 1.45 }}>{verdict}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 12 }}>
          {[
            [v.isSold ? 'Days held' : 'Days on lot', v.days == null ? '—' : `${v.days}d`],
            [v.isSold ? 'Margin' : 'Costs / day', v.isSold ? (v.margin == null ? '—' : `${v.margin.toFixed(1)}%`) : (perDay > 0 ? rm(perDay) : '—')],
            [v.isSold ? 'Total cost' : 'Break-even', rm(v.isSold ? v.costTotal : v.breakeven)],
          ].map(([k, val]) => (
            <div key={k} style={{ background: PL.card, borderRadius: 10, padding: '8px 10px', minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: PL.textMuted, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: PL.text, marginTop: 2, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{val}</div>
            </div>
          ))}
        </div>
        {!v.isSold && v.projections.length > 0 && perDay > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: PL.textMuted, marginBottom: 4 }}>If it is still here in</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
              {v.projections.map((p) => (
                <div key={p.days} style={{ fontSize: 12.5, color: PL.textSec }}>
                  <span style={{ color: PL.textMuted }}>{p.days} days </span>
                  <span style={{ fontWeight: 700, color: p.net < 0 ? PL.accentText : PL.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{signed(p.net)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {perDay === 0 && !v.isSold && (
          <div style={{ fontSize: 12, color: PL.textMuted, marginTop: 10 }}>Holding cost is not counted yet. Set floor-plan rate or monthly overhead in Settings, Costs.</div>
        )}
        {!v.startKnown && <div style={{ fontSize: 12, color: PL.textMuted, marginTop: 6 }}>No start date on this car, so days and holding are not counted.</div>}
      </div>

      {/* Every cost so far, one list. Estimates say so; holding grows daily until the sale. */}
      <div style={{ background: PL.raised, borderRadius: PL.radius.row, padding: '4px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13 }}>
          <span style={{ color: PL.textSec }}>{v.isSold ? 'Sold for' : 'Asking price'}</span>
          <span style={{ fontWeight: 700, color: PL.text, fontVariantNumeric: 'tabular-nums' }}>{rm(v.revenue)}</span>
        </div>
        {v.lines.filter((l) => l.val > 0 || l.key === 'purchase' || l.key === 'holding').map((l) => (
          <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: `1px solid ${PL.line}`, fontSize: 13 }}>
            <span style={{ color: PL.textSec }}>
              {l.label}
              {l.kind === 'estimate' && <span style={{ color: PL.textMuted }}> · estimate</span>}
              {l.kind === 'accruing' && !v.isSold && perDay > 0 && <span style={{ color: PL.textMuted }}> · +{rm(perDay)}/day</span>}
            </span>
            <span style={{ color: PL.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>− {rm(l.val)}</span>
          </div>
        ))}
        {(v.back !== 0 || addons.length > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: `1px solid ${PL.line}`, fontSize: 13 }}>
            <span style={{ color: PL.textSec }}>Add-ons sold ({addons.length}), after their cost</span>
            <span style={{ color: v.back >= 0 ? PL.up : PL.accentText, fontVariantNumeric: 'tabular-nums' }}>{signed(v.back)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderTop: `1px solid ${PL.line}`, fontSize: 14, fontWeight: 800 }}>
          <span style={{ color: PL.text }}>{v.isSold ? 'Profit' : 'Profit if sold today'}</span>
          <span style={{ color: loss ? PL.accentText : PL.up, fontVariantNumeric: 'tabular-nums' }}>{signed(v.net)}</span>
        </div>
      </div>

      {/* ---------- READ-ONLY VIEW ---------- */}
      <Section icon={UserCheck} title="Status & Attribution">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {onStatusChange ? (
            <select value={status} onChange={(e) => { const val = e.target.value; if (val === 'sold') { onMarkSold && onMarkSold(); } else { onStatusChange(val); } }} disabled={statusUpdating}
              style={{ fontSize: 12, fontWeight: 700, padding: '4px 26px 4px 9px', borderRadius: 6, border: `1px solid ${statusCfg.c}40`, background: `${statusCfg.c}12`, color: statusCfg.c, cursor: statusUpdating ? 'wait' : 'pointer', appearance: 'none', backgroundImage: 'none', outline: 'none' }}>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold — record sale…</option>
              <option value="unpublished">Unpublished</option>
            </select>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.c, background: `${statusCfg.c}15`, border: `1px solid ${statusCfg.c}30`, borderRadius: 6, padding: '3px 10px' }}>{statusCfg.l}</span>
          )}
          {status === 'sold' && (unit.sold_date || listing.sold_date) && <span style={{ fontSize: 12, color: '#6b7280' }}>on {fmtD(unit.sold_date || listing.sold_date)}</span>}
          {status === 'sold' && (unit.sold_price || listing.sold_price) > 0 && <span style={{ fontSize: 12, color: '#111827', fontWeight: 600 }}>{rm(unit.sold_price || listing.sold_price)}</span>}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {status === 'sold'
            ? <span>Closed by <b>{closer?.full_name || 'Dealer (house deal)'}</b></span>
            : closer
              ? <span>Locked to <b>{closer.full_name}</b> (exclusive)</span>
              : <span style={{ color: '#9ca3af' }}>Open — any salesman can sell this</span>}
          {status === 'reserved' && reservedBy && <span>Reserved by <b>{reservedBy.full_name}</b></span>}
        </div>
      </Section>

      <Section icon={Wrench} title="Recon Jobs" right={<span style={{ fontSize: 12, fontWeight: 700, color: PL.text }}>{rm(reconTotal)}</span>}>
        {recon.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No recon work logged.</p> : recon.map((j) => (
          <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${PL.line}` }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</p>
              <p style={{ fontSize: 10, color: '#9ca3af', margin: '1px 0 0', textTransform: 'capitalize' }}>{(j.status || 'pending').replace('_', ' ')}{j.vendor ? ` · ${j.vendor}` : ''}</p>
            </div>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, flexShrink: 0 }}>{j.cost ? rm(j.cost) : '—'}</span>
          </div>
        ))}
      </Section>

      <Section icon={Megaphone} title="Advertising Spend" right={<span style={{ fontSize: 12, fontWeight: 700, color: PL.text }}>{rm(adTotal)}</span>}>
        {ads.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No ad spend logged.</p> : ads.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${PL.line}` }}>
            <div>
              <p style={{ fontSize: 12, color: '#111827', margin: 0, textTransform: 'capitalize' }}>{a.channel}</p>
              {a.spent_at && <p style={{ fontSize: 10, color: '#9ca3af', margin: '1px 0 0' }}>{fmtD(a.spent_at)}</p>}
            </div>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{rm(a.amount)}</span>
          </div>
        ))}
      </Section>

      <Section icon={ShieldCheck} title="Compliance">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Badge ok={!!unit.puspakom_b5_date} color="#16a34a" label={unit.puspakom_b5_date ? `B5 · ${fmtD(unit.puspakom_b5_date)}` : 'B5 not logged'} />
          <Badge ok={!!unit.puspakom_b7_date} color="#16a34a" label={unit.puspakom_b7_date ? `B7 · ${fmtD(unit.puspakom_b7_date)}` : 'B7 not logged'} />
          <Badge ok={(unit.encumbrance_status || 'unknown') !== 'unknown'} color={enc.c} label={enc.l} />
        </div>
      </Section>

      {/* ---------- TOOL MODALS (opened from the side panel) ---------- */}
      {tool === 'prices' && (
        <ToolModal title="Edit Costs" onClose={close} footer={
          <>
            <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveCost} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }>
          {[['Purchase Price', 'purchase_price'], ['Recon Estimate', 'recon_cost']].map(([l, k]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>{l} (RM)</label>
              <input type="number" value={costForm[k]} onChange={(e) => setCostForm((p) => ({ ...p, [k]: e.target.value }))} style={inp} />
            </div>
          ))}
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0', lineHeight: 1.4 }}>Sale price is set on the listing — use “Adjust Price” or the full edit form.</p>
        </ToolModal>
      )}

      {tool === 'compliance' && (
        <ToolModal title="Compliance" onClose={close} footer={
          <>
            <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveComp} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>PUSPAKOM B5 (chassis &amp; body)</label>
            <input type="date" value={compForm.puspakom_b5_date} onChange={(e) => setCompForm((p) => ({ ...p, puspakom_b5_date: e.target.value }))} style={inp} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>PUSPAKOM B7 (roadworthiness)</label>
            <input type="date" value={compForm.puspakom_b7_date} onChange={(e) => setCompForm((p) => ({ ...p, puspakom_b7_date: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>Encumbrance</label>
            <select value={compForm.encumbrance_status} onChange={(e) => setCompForm((p) => ({ ...p, encumbrance_status: e.target.value }))} style={inp}>
              {ENC_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </ToolModal>
      )}

      {tool === 'recon' && (
        <ToolModal title="Recon Jobs" onClose={close} footer={
          <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        }>
          {recon.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 10px' }}>No recon work logged yet.</p>}
          {recon.map((j) => (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${PL.line}` }}>
              <p style={{ fontSize: 12.5, color: '#111827', margin: 0 }}>{j.title}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, color: '#374151', fontWeight: 600 }}>{j.cost ? rm(j.cost) : '—'}</span>
                <button onClick={() => delRecon(j.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2 }}><Trash2 style={{ width: 13, height: 13 }} /></button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <input placeholder="Job (e.g. polish)" value={reconForm.title} onChange={(e) => setReconForm((p) => ({ ...p, title: e.target.value }))} style={{ ...inp, flex: 2 }} />
            <input type="number" placeholder="RM" value={reconForm.cost} onChange={(e) => setReconForm((p) => ({ ...p, cost: e.target.value }))} style={{ ...inp, flex: 1 }} />
            <button onClick={addRecon} style={{ background: '#d97706', border: 'none', color: '#fff', borderRadius: 7, padding: '0 12px', cursor: 'pointer' }}><Plus style={{ width: 15, height: 15 }} /></button>
          </div>
        </ToolModal>
      )}

      {tool === 'ad' && (
        <ToolModal title="Advertising Spend" onClose={close} footer={
          <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        }>
          {ads.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 10px' }}>No ad spend logged yet.</p>}
          {ads.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${PL.line}` }}>
              <p style={{ fontSize: 12.5, color: '#111827', margin: 0, textTransform: 'capitalize' }}>{a.channel}{a.spent_at ? ` · ${fmtD(a.spent_at)}` : ''}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, color: '#374151', fontWeight: 600 }}>{rm(a.amount)}</span>
                <button onClick={() => delAd(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2 }}><Trash2 style={{ width: 13, height: 13 }} /></button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <select value={adForm.channel} onChange={(e) => setAdForm((p) => ({ ...p, channel: e.target.value }))} style={{ ...inp, flex: 2 }}>
              {AD_CHANNELS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
            <input type="number" placeholder="RM" value={adForm.amount} onChange={(e) => setAdForm((p) => ({ ...p, amount: e.target.value }))} style={{ ...inp, flex: 1 }} />
            <button onClick={addAd} style={{ background: '#db2777', border: 'none', color: '#fff', borderRadius: 7, padding: '0 12px', cursor: 'pointer' }}><Plus style={{ width: 15, height: 15 }} /></button>
          </div>
        </ToolModal>
      )}

      {tool === 'activity' && (
        <ToolModal title="Activity History" onClose={close} footer={
          <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
        }>
          {activity === null ? <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>Loading…</p>
            : activity.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>No history recorded for this unit.</p>
              : activity.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderBottom: `1px solid ${PL.line}` }}>
                  <Clock style={{ width: 12, height: 12, color: '#9ca3af', marginTop: 3, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12.5, color: '#111827', margin: 0 }}>{log.summary || log.action}</p>
                    <p style={{ fontSize: 10.5, color: '#9ca3af', margin: '2px 0 0' }}>{log.actor_name || 'System'}{log.actor_role ? ` · ${log.actor_role}` : ''} · {new Date(log.created_at).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
        </ToolModal>
      )}
    </div>
  );
}
