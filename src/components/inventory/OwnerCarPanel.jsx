import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import {
  AlertTriangle, TrendingUp, Wrench, Megaphone, ShieldCheck,
  Pencil, X, Plus, Trash2, UserCheck, Clock,
} from 'lucide-react';

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

const Section = ({ icon: Icon, title, color, right, children }) => (
  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 12, background: '#fff' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon style={{ width: 14, height: 14, color: color || '#6b7280' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const inp = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', background: '#fff', boxSizing: 'border-box', color: '#111827' };

// Tool editor modal — portals above the drawer; explicit Save (no real-time writes).
function ToolModal({ title, onClose, children, footer }) {
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', fontFamily: "'DM Sans',sans-serif" }}>
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
  const [smCount, setSmCount] = useState(0);
  const [views, setViews] = useState(0);
  const [enquiries, setEnquiries] = useState(0);
  const [saves, setSaves] = useState(0);
  const [lastViewed, setLastViewed] = useState(null);
  const [creating, setCreating] = useState(false);

  // tool form state
  const [costForm, setCostForm] = useState({ purchase_price: '', recon_cost: '', asking_price: '' });
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
    const [rcfg, dp, pst, sl, av, enq, sv, lv] = await Promise.all([
      supabase.from('dealer_cost_settings').select('*').eq('dealer_id', userId).maybeSingle(),
      supabase.from('deal_products').select('sold_price, dealer_products(name, cost_price)').eq('listing_id', listing.id).eq('dealer_id', userId),
      supabase.from('post_sale_tasks').select('step_key, status, cost').eq('listing_id', listing.id).eq('dealer_id', userId),
      supabase.from('salesman_listings').select('id', { count: 'exact', head: true }).eq('listing_id', listing.id),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('car_id', listing.id).eq('event_type', 'car_view'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('car_listing_id', listing.id).eq('dealer_id', userId),
      supabase.rpc('count_listing_saves', { p_listing: listing.id }),
      supabase.from('analytics_events').select('created_at').eq('car_id', listing.id).eq('event_type', 'car_view').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setCostCfg(rcfg.data || null);
    setAddons(dp.data || []);
    setTasks(pst.data || []);
    setSmCount(sl.count || 0);
    setViews(av.count || 0);
    setEnquiries(enq.count || 0);
    setSaves(sv.data || 0);
    setLastViewed(lv.data?.created_at || null);
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
    if (tool === 'prices') setCostForm({ purchase_price: String(unit.purchase_price || ''), recon_cost: String(unit.recon_cost || ''), asking_price: String(unit.asking_price || '') });
    if (tool === 'compliance') setCompForm({ puspakom_b5_date: unit.puspakom_b5_date || '', puspakom_b7_date: unit.puspakom_b7_date || '', encumbrance_status: unit.encumbrance_status || 'unknown' });
    if (tool === 'activity') {
      setActivity(null);
      supabase.from('activity_log').select('summary, actor_name, actor_role, action, created_at')
        .eq('record_id', unit.id).order('created_at', { ascending: false }).limit(40)
        .then(({ data }) => setActivity(data || []));
    }
  }, [tool, unit]);

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

  // ---- P&L ----
  const pnl = (() => {
    if (!unit) return null;
    const purchasePrice = Number(unit.purchase_price) || 0;
    const reconEst = Number(unit.recon_cost) || 0;
    const reconActual = recon.reduce((s, j) => s + (Number(j.cost) || 0), 0);
    const reconCost = recon.length > 0 ? reconActual : reconEst;
    const servicesCost = Number(listing.included_services_cost) || 0;
    const commission = Number(listing.commission_amount) || 0;
    const handoverCost = tasks.filter((t) => t.status !== 'na').reduce((s, t) => s + (Number(t.cost) || 0), 0);
    const adSpend = ads.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const addonRevenue = addons.reduce((s, a) => s + (Number(a.sold_price) || 0), 0);
    const addonCost = addons.reduce((s, a) => s + (Number(a.dealer_products?.cost_price) || 0), 0);
    const isSold = unit.status === 'sold' || listing.status === 'sold';
    const revenue = Number(unit.sold_price) || Number(unit.asking_price) || Number(listing.selling_price) || 0;
    const cc = costCfg || {};
    let dailyHold = 0;
    if (Number(cc.floor_plan_rate) > 0 && purchasePrice > 0) dailyHold = purchasePrice * (Number(cc.floor_plan_rate) / 100) / 365;
    else if (Number(cc.monthly_overhead) > 0) dailyHold = Number(cc.monthly_overhead) / Math.max(1, Number(cc.avg_fleet_size) || 20) / 30;
    let holdingDays = 0;
    const start = unit.purchase_date || unit.created_at;
    if (start) {
      const end = isSold && unit.sold_date ? new Date(unit.sold_date) : new Date();
      holdingDays = Math.max(0, Math.floor((end - new Date(start)) / 86400000));
    }
    const holdingCost = Math.round(dailyHold * holdingDays);
    const frontGross = revenue - (purchasePrice + reconCost + servicesCost + commission + handoverCost + holdingCost + adSpend);
    const backGross = addonRevenue - addonCost;
    const netPnl = frontGross + backGross;
    return { purchasePrice, reconCost, reconEst, reconActual, servicesCost, commission, handoverCost, adSpend, addonRevenue, addonCost, revenue, dailyHold, holdingDays, holdingCost, frontGross, backGross, netPnl, isSold };
  })();

  // ---- tool actions ----
  const saveCost = async () => {
    setSaving(true);
    const patch = { purchase_price: Number(costForm.purchase_price) || 0, recon_cost: Number(costForm.recon_cost) || 0, asking_price: Number(costForm.asking_price) || 0 };
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

  // verdict
  const v = pnl;
  const marginPct = v.revenue > 0 ? (v.netPnl / v.revenue) * 100 : 0;
  const spread = v.revenue - v.purchasePrice;
  const spreadPct = v.purchasePrice > 0 ? (spread / v.purchasePrice) * 100 : 0;
  const loss = v.netPnl < 0;
  const thin = !loss && marginPct < 5;
  const reasons = [];
  if (v.holdingCost > 0 && (v.holdingDays > 60 || v.holdingCost >= Math.abs(v.netPnl) * 0.4)) reasons.push(`${rm(v.holdingCost)} carrying cost from ${v.holdingDays} days on the floor`);
  if (spread <= v.purchasePrice * 0.03) reasons.push(`only ${rm(spread)} markup over buy price (${spreadPct.toFixed(1)}%)`);
  if (v.reconEst > 0 && v.reconActual > v.reconEst) reasons.push(`recon overran the estimate by ${rm(v.reconActual - v.reconEst)}`);
  if (v.commission > 0 && v.commission >= Math.abs(v.netPnl) * 0.5) reasons.push(`${rm(v.commission)} sales commission`);
  if (v.adSpend > 0 && v.adSpend >= Math.abs(v.netPnl) * 0.4) reasons.push(`${rm(v.adSpend)} ad spend`);
  const tone = loss ? { bg: '#fef2f2', bd: '#fecaca', tx: '#b91c1c', ic: '#dc2626' }
    : thin ? { bg: '#fffbeb', bd: '#fde68a', tx: '#b45309', ic: '#d97706' }
      : { bg: '#f0fdf4', bd: '#bbf7d0', tx: '#15803d', ic: '#16a34a' };
  const headline = loss ? `Losing ${rm(Math.abs(v.netPnl))} on this unit` : `${thin ? 'Slim' : 'Healthy'} ${rm(v.netPnl)} profit · ${marginPct.toFixed(1)}% margin`;
  const body = reasons.length ? (loss ? 'Driven by ' : 'Watch: ') + reasons.join('; ') + '.'
    : loss ? 'Costs have eaten through the asking price — reprice up or trim reconditioning.'
      : `${rm(spread)} spread over buy price survives all costs.`;

  const reconTotal = recon.reduce((s, j) => s + (Number(j.cost) || 0), 0);
  const adTotal = ads.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const enc = encCfg(unit.encumbrance_status || 'unknown');

  const Row = ({ label, val, neg }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: neg ? '#f87171' : '#111827', fontWeight: neg ? 400 : 600 }}>{neg ? '− ' : ''}{rm(val)}</span>
    </div>
  );
  const Badge = ({ ok, label, color }) => (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: ok ? `${color}15` : 'rgba(100,116,139,0.08)', border: `1px solid ${ok ? `${color}40` : 'rgba(100,116,139,0.18)'}`, color: ok ? color : '#94a3b8' }}>{label}</span>
  );
  const Stat = ({ label, value, color }) => (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 11px', background: '#fff' }}>
      <p style={{ fontSize: 9.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: color || '#111827', margin: '3px 0 0', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  );
  const repsSelling = listing.assigned_to ? 1 : smCount;

  return (
    <div>
      {/* Identity + at-a-glance numbers */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        {listing.images?.[0]
          ? <img src={listing.images[0]} alt="" style={{ width: 92, height: 66, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #e5e7eb' }} />
          : <div style={{ width: 92, height: 66, borderRadius: 10, background: '#f3f4f6', border: '1px solid #e5e7eb', flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.brand} {listing.model}</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{[listing.year, listing.variant, listing.plate_number].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        <Stat label="Total Gross" value={`${v.netPnl < 0 ? '− ' : ''}${rm(Math.abs(v.netPnl))}`} color={v.netPnl >= 0 ? '#16a34a' : '#dc2626'} />
        <Stat label="Days on floor" value={`${v.holdingDays}d`} color={v.holdingDays > 60 ? '#dc2626' : '#111827'} />
        <Stat label="Reps selling" value={String(repsSelling)} color={repsSelling > 0 ? '#2563eb' : '#9ca3af'} />
        <Stat label="Asking" value={rm(unit.asking_price || listing.selling_price)} />
        <Stat label="Ad spend" value={rm(adTotal)} color={adTotal > 0 ? '#db2777' : '#111827'} />
        <Stat label="Car views" value={views.toLocaleString()} />
        <Stat label="Enquiries" value={enquiries.toLocaleString()} color={enquiries > 0 ? '#2563eb' : '#111827'} />
        <Stat label="Saves" value={saves.toLocaleString()} color={saves > 0 ? '#db2777' : '#111827'} />
        <Stat label="Last viewed" value={ago(lastViewed)} />
      </div>

      {/* ---------- READ-ONLY VIEW ---------- */}
      <Section icon={UserCheck} title="Status & Attribution" color="#2563eb">
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

      <Section icon={loss ? AlertTriangle : TrendingUp} title="Profit & Loss" color={tone.ic}>
        <div style={{ background: tone.bg, border: `1px solid ${tone.bd}`, borderRadius: 8, padding: '11px 12px', marginBottom: 12 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: tone.tx, margin: 0 }}>{headline}</p>
          <p style={{ fontSize: 12, color: tone.tx, opacity: 0.92, margin: '5px 0 0', lineHeight: 1.45 }}>{body}</p>
          {!v.isSold && <p style={{ fontSize: 10.5, color: '#9ca3af', margin: '6px 0 0' }}>Projection based on the current asking price.</p>}
        </div>
        <Row label={v.isSold ? 'Sale price' : 'Asking price'} val={v.revenue} />
        {v.purchasePrice > 0 && <Row label="Purchase price" val={v.purchasePrice} neg />}
        {v.reconCost > 0 && <Row label="Recon cost" val={v.reconCost} neg />}
        {v.servicesCost > 0 && <Row label="Included services" val={v.servicesCost} neg />}
        {v.commission > 0 && <Row label="Commission" val={v.commission} neg />}
        {v.handoverCost > 0 && <Row label="Handover processing" val={v.handoverCost} neg />}
        {v.adSpend > 0 && <Row label="Advertising" val={v.adSpend} neg />}
        {v.holdingCost > 0 && <Row label={`Holding (${v.holdingDays}d)`} val={v.holdingCost} neg />}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e5e7eb' }}>
          <span style={{ color: '#374151' }}>Front gross</span>
          <span style={{ color: v.frontGross >= 0 ? '#059669' : '#f87171' }}>{v.frontGross < 0 ? '− ' : ''}{rm(Math.abs(v.frontGross))}</span>
        </div>
        {(v.addonRevenue > 0 || v.addonCost > 0) && (
          <>
            <div style={{ marginTop: 8 }}>
              {v.addonRevenue > 0 && <Row label={`Add-ons sold (${addons.length})`} val={v.addonRevenue} />}
              {v.addonCost > 0 && <Row label="Add-on cost" val={v.addonCost} neg />}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginTop: 4, paddingTop: 6, borderTop: '1px dashed #e5e7eb' }}>
              <span style={{ color: '#374151' }}>Back gross</span>
              <span style={{ color: v.backGross >= 0 ? '#059669' : '#f87171' }}>{v.backGross < 0 ? '− ' : ''}{rm(Math.abs(v.backGross))}</span>
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Total Gross</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: v.netPnl >= 0 ? '#16a34a' : '#dc2626' }}>{v.netPnl < 0 ? '− ' : ''}{rm(Math.abs(v.netPnl))}</span>
        </div>
      </Section>

      <Section icon={Pencil} title="Cost Basis" color="#7c3aed">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[['Purchase', unit.purchase_price], ['Recon est.', unit.recon_cost], ['Asking', unit.asking_price]].map(([l, val]) => (
            <div key={l}>
              <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{l}</p>
              <p style={{ fontSize: 13, color: '#111827', fontWeight: 600, margin: '2px 0 0' }}>{val ? rm(val) : '—'}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Wrench} title="Recon Jobs" color="#d97706" right={<span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>{rm(reconTotal)}</span>}>
        {recon.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No recon work logged.</p> : recon.map((j) => (
          <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</p>
              <p style={{ fontSize: 10, color: '#9ca3af', margin: '1px 0 0', textTransform: 'capitalize' }}>{(j.status || 'pending').replace('_', ' ')}{j.vendor ? ` · ${j.vendor}` : ''}</p>
            </div>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, flexShrink: 0 }}>{j.cost ? rm(j.cost) : '—'}</span>
          </div>
        ))}
      </Section>

      <Section icon={Megaphone} title="Advertising Spend" color="#db2777" right={<span style={{ fontSize: 12, fontWeight: 700, color: '#db2777' }}>{rm(adTotal)}</span>}>
        {ads.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No ad spend logged.</p> : ads.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <p style={{ fontSize: 12, color: '#111827', margin: 0, textTransform: 'capitalize' }}>{a.channel}</p>
              {a.spent_at && <p style={{ fontSize: 10, color: '#9ca3af', margin: '1px 0 0' }}>{fmtD(a.spent_at)}</p>}
            </div>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{rm(a.amount)}</span>
          </div>
        ))}
      </Section>

      <Section icon={ShieldCheck} title="Compliance" color="#16a34a">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Badge ok={!!unit.puspakom_b5_date} color="#16a34a" label={unit.puspakom_b5_date ? `B5 · ${fmtD(unit.puspakom_b5_date)}` : 'B5 not logged'} />
          <Badge ok={!!unit.puspakom_b7_date} color="#16a34a" label={unit.puspakom_b7_date ? `B7 · ${fmtD(unit.puspakom_b7_date)}` : 'B7 not logged'} />
          <Badge ok={(unit.encumbrance_status || 'unknown') !== 'unknown'} color={enc.c} label={enc.l} />
        </div>
      </Section>

      {/* ---------- TOOL MODALS (opened from the side panel) ---------- */}
      {tool === 'prices' && (
        <ToolModal title="Edit Prices" onClose={close} footer={
          <>
            <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveCost} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }>
          {[['Purchase Price', 'purchase_price'], ['Recon Estimate', 'recon_cost'], ['Asking Price', 'asking_price']].map(([l, k]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>{l} (RM)</label>
              <input type="number" value={costForm[k]} onChange={(e) => setCostForm((p) => ({ ...p, [k]: e.target.value }))} style={inp} />
            </div>
          ))}
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
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
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
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
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
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
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
