import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import {
  AlertTriangle, TrendingUp, Wrench, Megaphone, ShieldCheck,
  Pencil, Check, X, Plus, Trash2, UserCheck,
} from 'lucide-react';

const rm = (n) => 'RM ' + Math.round(Number(n) || 0).toLocaleString();

const AD_CHANNELS = [
  { v: 'mudah', l: 'Mudah' }, { v: 'carlist', l: 'Carlist' }, { v: 'facebook', l: 'Facebook' },
  { v: 'tiktok', l: 'TikTok' }, { v: 'instagram', l: 'Instagram' }, { v: 'other', l: 'Other' },
];
const ENC_OPTS = [
  { v: 'clear', l: 'Clear title', c: '#16a34a' },
  { v: 'under_hp', l: 'Under HP', c: '#dc2626' },
  { v: 'unknown', l: 'Unknown', c: '#d97706' },
];

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

export default function OwnerCarPanel({ listing, userId, profile, salesmenById = {} }) {
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState(null);
  const [recon, setRecon] = useState([]);
  const [ads, setAds] = useState([]);
  const [addons, setAddons] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [costCfg, setCostCfg] = useState(null);
  const [creating, setCreating] = useState(false);

  // edit state
  const [editingCost, setEditingCost] = useState(false);
  const [costForm, setCostForm] = useState({ purchase_price: '', recon_cost: '', asking_price: '' });
  const [savingCost, setSavingCost] = useState(false);
  const [reconForm, setReconForm] = useState({ title: '', cost: '' });
  const [adForm, setAdForm] = useState({ channel: 'mudah', amount: '' });
  const [savingComp, setSavingComp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase
      .from('stock_units')
      .select('*')
      .eq('listing_id', listing.id)
      .eq('dealer_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setUnit(u || null);
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
    } else {
      setRecon([]); setAds([]);
    }
    setLoading(false);
  }, [listing.id, userId]);

  useEffect(() => { load(); }, [load]);

  const createUnit = async () => {
    setCreating(true);
    const { data, error } = await supabase.from('stock_units').insert({
      dealer_id: userId,
      listing_id: listing.id,
      status: listing.status === 'sold' ? 'sold' : 'in_stock',
      purchase_price: 0,
      asking_price: listing.selling_price || 0,
      encumbrance_status: 'unknown',
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
    const reconCost = Number(unit.recon_cost) || 0;
    const reconActual = recon.reduce((s, j) => s + (Number(j.cost) || 0), 0);
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
    return { purchasePrice, reconCost, reconActual, servicesCost, commission, handoverCost, adSpend, addonRevenue, addonCost, revenue, dailyHold, holdingDays, holdingCost, frontGross, backGross, netPnl, isSold };
  })();

  // ---- actions ----
  const saveCost = async () => {
    setSavingCost(true);
    const patch = {
      purchase_price: Number(costForm.purchase_price) || 0,
      recon_cost: Number(costForm.recon_cost) || 0,
      asking_price: Number(costForm.asking_price) || 0,
    };
    const { error } = await supabase.from('stock_units').update(patch).eq('id', unit.id).eq('dealer_id', userId);
    setSavingCost(false);
    if (error) { toast.error('Failed to save'); return; }
    setUnit((p) => ({ ...p, ...patch }));
    setEditingCost(false);
    toast.success('Cost updated');
  };

  const addRecon = async () => {
    if (!reconForm.title.trim()) { toast.error('Enter a job title'); return; }
    const { data, error } = await supabase.from('recon_jobs').insert({
      dealer_id: userId, stock_unit_id: unit.id, title: reconForm.title.trim(),
      category: 'other', cost: reconForm.cost ? Number(reconForm.cost) : null, status: 'pending',
    }).select().single();
    if (error) { toast.error('Failed to add'); return; }
    setRecon((p) => [data, ...p]);
    setReconForm({ title: '', cost: '' });
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
    setAds((p) => [data, ...p]);
    setAdForm({ channel: 'mudah', amount: '' });
  };
  const delAd = async (id) => {
    const { error } = await supabase.from('ad_spend').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    setAds((p) => p.filter((a) => a.id !== id));
  };

  const saveComp = async (patch) => {
    setSavingComp(true);
    const { error } = await supabase.from('stock_units').update(patch).eq('id', unit.id).eq('dealer_id', userId);
    setSavingComp(false);
    if (error) { toast.error('Update failed'); return; }
    setUnit((p) => ({ ...p, ...patch }));
  };

  const inp = { width: '100%', padding: '7px 9px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', background: '#fff', boxSizing: 'border-box', color: '#111827' };

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
  if (v.reconActual > v.reconCost) reasons.push(`recon overran the estimate by ${rm(v.reconActual - v.reconCost)}`);
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

  const Row = ({ label, val, neg }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: neg ? '#f87171' : '#111827', fontWeight: neg ? 400 : 600 }}>{neg ? '− ' : ''}{rm(val)}</span>
    </div>
  );

  return (
    <div>
      {/* Status & attribution */}
      <Section icon={UserCheck} title="Status & Attribution" color="#2563eb">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.c, background: `${statusCfg.c}15`, border: `1px solid ${statusCfg.c}30`, borderRadius: 6, padding: '3px 10px' }}>{statusCfg.l}</span>
          {status === 'sold' && (unit.sold_date || listing.sold_date) && <span style={{ fontSize: 12, color: '#6b7280' }}>on {new Date(unit.sold_date || listing.sold_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
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

      {/* Verdict + P&L */}
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

      {/* Cost basis */}
      <Section icon={Pencil} title="Cost Basis" color="#7c3aed" right={
        editingCost ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveCost} disabled={savingCost} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}><Check style={{ width: 12, height: 12 }} /></button>
            <button onClick={() => setEditingCost(false)} style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}><X style={{ width: 12, height: 12 }} /></button>
          </div>
        ) : (
          <button onClick={() => { setCostForm({ purchase_price: String(unit.purchase_price || ''), recon_cost: String(unit.recon_cost || ''), asking_price: String(unit.asking_price || '') }); setEditingCost(true); }} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Pencil style={{ width: 11, height: 11 }} />Edit</button>
        )
      }>
        {editingCost ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['Purchase', 'purchase_price'], ['Recon est.', 'recon_cost'], ['Asking', 'asking_price']].map(([l, k]) => (
              <div key={k}>
                <label style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</label>
                <input type="number" value={costForm[k]} onChange={(e) => setCostForm((p) => ({ ...p, [k]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['Purchase', unit.purchase_price], ['Recon est.', unit.recon_cost], ['Asking', unit.asking_price]].map(([l, val]) => (
              <div key={l}>
                <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{l}</p>
                <p style={{ fontSize: 13, color: '#111827', fontWeight: 600, margin: '2px 0 0' }}>{val ? rm(val) : '—'}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Recon jobs */}
      <Section icon={Wrench} title="Recon Jobs" color="#d97706" right={<span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>{rm(reconTotal)}</span>}>
        {recon.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 8px' }}>No recon work logged.</p>}
        {recon.map((j) => (
          <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</p>
              <p style={{ fontSize: 10, color: '#9ca3af', margin: '1px 0 0', textTransform: 'capitalize' }}>{(j.status || 'pending').replace('_', ' ')}{j.vendor ? ` · ${j.vendor}` : ''}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{j.cost ? rm(j.cost) : '—'}</span>
              <button onClick={() => delRecon(j.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2 }}><Trash2 style={{ width: 12, height: 12 }} /></button>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input placeholder="Job (e.g. polish)" value={reconForm.title} onChange={(e) => setReconForm((p) => ({ ...p, title: e.target.value }))} style={{ ...inp, flex: 2 }} />
          <input type="number" placeholder="RM" value={reconForm.cost} onChange={(e) => setReconForm((p) => ({ ...p, cost: e.target.value }))} style={{ ...inp, flex: 1 }} />
          <button onClick={addRecon} style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', color: '#d97706', borderRadius: 6, padding: '0 10px', cursor: 'pointer' }}><Plus style={{ width: 14, height: 14 }} /></button>
        </div>
      </Section>

      {/* Ad spend */}
      <Section icon={Megaphone} title="Advertising Spend" color="#db2777" right={<span style={{ fontSize: 12, fontWeight: 700, color: '#db2777' }}>{rm(adTotal)}</span>}>
        {ads.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 8px' }}>No ad spend logged.</p>}
        {ads.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <p style={{ fontSize: 12, color: '#111827', margin: 0, textTransform: 'capitalize' }}>{a.channel}</p>
              {a.spent_at && <p style={{ fontSize: 10, color: '#9ca3af', margin: '1px 0 0' }}>{new Date(a.spent_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{rm(a.amount)}</span>
              <button onClick={() => delAd(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2 }}><Trash2 style={{ width: 12, height: 12 }} /></button>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <select value={adForm.channel} onChange={(e) => setAdForm((p) => ({ ...p, channel: e.target.value }))} style={{ ...inp, flex: 2 }}>
            {AD_CHANNELS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
          <input type="number" placeholder="RM" value={adForm.amount} onChange={(e) => setAdForm((p) => ({ ...p, amount: e.target.value }))} style={{ ...inp, flex: 1 }} />
          <button onClick={addAd} style={{ background: 'rgba(219,39,119,0.1)', border: '1px solid rgba(219,39,119,0.3)', color: '#db2777', borderRadius: 6, padding: '0 10px', cursor: 'pointer' }}><Plus style={{ width: 14, height: 14 }} /></button>
        </div>
      </Section>

      {/* Compliance */}
      <Section icon={ShieldCheck} title="Compliance" color="#16a34a">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PUSPAKOM B5</label>
            <input type="date" value={unit.puspakom_b5_date || ''} onChange={(e) => saveComp({ puspakom_b5_date: e.target.value || null })} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PUSPAKOM B7</label>
            <input type="date" value={unit.puspakom_b7_date || ''} onChange={(e) => saveComp({ puspakom_b7_date: e.target.value || null })} style={inp} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Encumbrance</label>
            <select value={unit.encumbrance_status || 'unknown'} onChange={(e) => saveComp({ encumbrance_status: e.target.value })} style={inp}>
              {ENC_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </div>
        {savingComp && <p style={{ fontSize: 10, color: '#9ca3af', margin: '6px 0 0' }}>Saving…</p>}
      </Section>
    </div>
  );
}
