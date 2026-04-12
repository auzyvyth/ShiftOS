import React, { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X,
  Tag, TrendingUp, DollarSign, Users, Package,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'protection',   label: 'Protection Film',    color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.2)'  },
  { value: 'window_tint',  label: 'Window Tint',        color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',   border: 'rgba(56,189,248,0.2)'   },
  { value: 'warranty',     label: 'Extended Warranty',  color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.2)'   },
  { value: 'insurance',    label: 'Insurance',          color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.2)'   },
  { value: 'road_tax',     label: 'Road Tax',           color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.2)'   },
  { value: 'service',      label: 'Service Package',    color: '#67e8f9', bg: 'rgba(103,232,249,0.1)',  border: 'rgba(103,232,249,0.2)'  },
  { value: 'accessories',  label: 'Accessories',        color: '#f472b6', bg: 'rgba(244,114,182,0.1)',  border: 'rgba(244,114,182,0.2)'  },
  { value: 'workshop',     label: 'Workshop',           color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.2)'  },
  { value: 'other',        label: 'Other',              color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.2)'  },
];

const SEEDS = [
  { name: 'Paint Protection Film', category: 'protection',  selling_price: 800,  cost_price: 400  },
  { name: 'Window Tint',           category: 'window_tint', selling_price: 350,  cost_price: 150  },
  { name: 'Extended Warranty 1yr', category: 'warranty',    selling_price: 600,  cost_price: 250  },
  { name: 'Insurance Referral',    category: 'insurance',   selling_price: 200,  cost_price: 0    },
];

const EMPTY_FORM = { name: '', category: 'protection', cost_price: '', selling_price: '', description: '', is_active: true };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtRM = (n) => n == null ? '—' : `RM ${Number(n).toLocaleString('en-MY', { minimumFractionDigits: 0 })}`;
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); };
const catCfg = (v) => CATEGORIES.find(c => c.value === v) || CATEGORIES[CATEGORIES.length - 1];

function marginPct(sell, cost) {
  if (!sell) return null;
  return (((Number(sell) - (Number(cost) || 0)) / Number(sell)) * 100).toFixed(1);
}
function marginColor(pct) {
  if (pct == null) return '#6b7280';
  if (pct >= 40) return '#4ade80';
  if (pct >= 20) return '#fbbf24';
  return '#f87171';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skel({ h = 'h-12', w = 'w-full' }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: 'rgba(255,255,255,0.05)' }} />;
}

// ─── Category badge ───────────────────────────────────────────────────────────
function CatBadge({ category }) {
  const cfg = catCfg(category);
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ServicesPage({ userId }) {
  // ── Product catalogue state ────────────────────────────────────────────────
  const [products, setProducts]     = useState([]);
  const [prodLoading, setProdLoading] = useState(true);
  const [panelOpen, setPanelOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);

  // ── Revenue summary state ──────────────────────────────────────────────────
  const [summary, setSummary]         = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [recentRows, setRecentRows]   = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // ── Fetch products ─────────────────────────────────────────────────────────
  const fetchProducts = async () => {
    if (!userId) return;
    setProdLoading(true);
    const { data } = await supabase
      .from('dealer_products')
      .select('*')
      .eq('dealer_id', userId)
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setProdLoading(false);
  };

  // ── Fetch revenue summary ──────────────────────────────────────────────────
  const fetchSummary = async () => {
    if (!userId) return;
    setSummaryLoading(true);
    const monthStart = startOfMonth();

    const { data: addonRows } = await supabase
      .from('deal_products')
      .select('id, sold_price, lead_id, product_id, dealer_products(name)')
      .eq('dealer_id', userId)
      .gte('created_at', monthStart);

    const { count: wonCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('dealer_id', userId)
      .in('stage', ['won', 'closed_won'])
      .gte('updated_at', monthStart);

    const rows = addonRows || [];
    const totalRevenue = rows.reduce((s, r) => s + Number(r.sold_price), 0);
    const uniqueLeads  = new Set(rows.filter(r => r.lead_id).map(r => r.lead_id));
    const avgPerDeal   = uniqueLeads.size > 0 ? Math.round(totalRevenue / uniqueLeads.size) : null;
    const attachRate   = wonCount > 0 ? Math.round((uniqueLeads.size / wonCount) * 100) : null;

    const productCount = {};
    rows.forEach(r => {
      const name = r.dealer_products?.name || 'Unknown';
      productCount[name] = (productCount[name] || 0) + 1;
    });
    const topProducts = Object.entries(productCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

    setSummary({ totalRevenue, avgPerDeal, attachRate, uniqueLeadCount: uniqueLeads.size, topProducts });
    setSummaryLoading(false);
  };

  // ── Fetch recent deal_products ─────────────────────────────────────────────
  const fetchRecent = async () => {
    if (!userId) return;
    setRecentLoading(true);
    const { data } = await supabase
      .from('deal_products')
      .select('id, sold_price, created_at, dealer_products(name), leads(buyer_name, car_listing_id)')
      .eq('dealer_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentRows(data || []);
    setRecentLoading(false);
  };

  useEffect(() => {
    fetchProducts();
    fetchSummary();
    fetchRecent();
  }, [userId]);

  // ── Panel helpers ──────────────────────────────────────────────────────────
  const openAdd = (prefill = null) => {
    setForm(prefill ? { ...EMPTY_FORM, ...prefill, cost_price: String(prefill.cost_price), selling_price: String(prefill.selling_price) } : EMPTY_FORM);
    setEditTarget(null);
    setPanelOpen(true);
  };
  const openEdit = (p) => {
    setForm({ name: p.name, category: p.category, cost_price: String(p.cost_price ?? ''), selling_price: String(p.selling_price), description: p.description || '', is_active: p.is_active });
    setEditTarget(p);
    setPanelOpen(true);
  };
  const closePanel = () => { setPanelOpen(false); setEditTarget(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.selling_price) { toast.error('Name and selling price are required'); return; }
    setSaving(true);
    const payload = {
      dealer_id:     userId,
      name:          form.name.trim(),
      category:      form.category,
      cost_price:    Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price),
      description:   form.description.trim() || null,
      is_active:     form.is_active,
      updated_at:    new Date().toISOString(),
    };
    try {
      if (editTarget) {
        await supabase.from('dealer_products').update(payload).eq('id', editTarget.id);
      } else {
        await supabase.from('dealer_products').insert(payload);
      }
      await fetchProducts();
      closePanel();
      toast.success(editTarget ? 'Product updated' : 'Product added');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await supabase.from('dealer_products').delete().eq('id', id);
    setProducts(p => p.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  const handleToggle = async (p) => {
    const updated = { is_active: !p.is_active };
    await supabase.from('dealer_products').update(updated).eq('id', p.id);
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, ...updated } : x));
  };

  const seedProduct = (seed) => openAdd(seed);

  const inp = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 6, padding: '9px 13px', color: 'white', fontSize: 13,
    fontFamily: "'DM Sans',sans-serif", outline: 'none', boxSizing: 'border-box',
    appearance: 'none',
  };

  const mPct = marginPct(form.selling_price, form.cost_price);

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", width: '100%', padding: '24px 24px 48px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 30, letterSpacing: '0.06em', color: '#f8fafc', lineHeight: 1, margin: 0 }}>
          Services & Add-ons
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Manage your product catalogue and track aftermarket revenue</p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* ── Left column: Catalogue (60%) ── */}
        <div style={{ flex: '1 1 55%', minWidth: 300 }}>
          <div
            className="rounded-lg"
            style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.055)', overflow: 'hidden' }}
          >
            {/* Catalogue header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>Your Add-ons & Services</p>
              <button
                onClick={() => openAdd()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(220,38,38,0.25)' }}
              >
                <Plus style={{ width: 13, height: 13 }} />Add Product
              </button>
            </div>

            {/* Product list */}
            <div style={{ padding: 14 }}>
              {prodLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => <Skel key={i} h="h-16" />)}
                </div>
              ) : products.length === 0 ? (
                /* Empty state — seed suggestions */
                <div>
                  <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 12 }}>No products yet. Click a suggestion to add it quickly:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {SEEDS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => seedProduct(s)}
                        style={{
                          textAlign: 'left', padding: 14, borderRadius: 8,
                          background: 'rgba(255,255,255,0.025)',
                          border: '1px dashed rgba(255,255,255,0.12)',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(220,38,38,0.35)'; e.currentTarget.style.background = 'rgba(220,38,38,0.04)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', margin: '0 0 4px' }}>{s.name}</p>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>RM {s.selling_price.toLocaleString()} sell · RM {s.cost_price.toLocaleString()} cost</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {products.map(p => {
                    const pct = marginPct(p.selling_price, p.cost_price);
                    return (
                      <div
                        key={p.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        {/* Left info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{p.name}</span>
                            <CatBadge category={p.category} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: '#4b5563' }}>Cost: {fmtRM(p.cost_price)}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>Sell: {fmtRM(p.selling_price)}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: marginColor(pct) }}>
                              {pct != null ? `${pct}%` : '—'} margin
                            </span>
                          </div>
                        </div>
                        {/* Right controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <button onClick={() => handleToggle(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                            {p.is_active
                              ? <ToggleRight style={{ width: 22, height: 22, color: '#4ade80' }} />
                              : <ToggleLeft  style={{ width: 22, height: 22, color: '#4b5563' }} />}
                          </button>
                          <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', display: 'flex', padding: 2 }}>
                            <Pencil style={{ width: 14, height: 14 }} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', display: 'flex', padding: 2 }}>
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column: Revenue Summary (40%) ── */}
        <div style={{ flex: '1 1 36%', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Revenue metrics card */}
          <div
            className="rounded-lg"
            style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.055)', overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>This Month</p>
            </div>
            <div style={{ padding: 14 }}>
              {summaryLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3].map(i => <Skel key={i} h="h-10" />)}
                </div>
              ) : (
                <>
                  {/* Big revenue number */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Add-on Revenue MTD</p>
                    <p style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 32, color: '#f8fafc', lineHeight: 1, margin: 0 }}>
                      {fmtRM(summary?.totalRevenue)}
                    </p>
                  </div>
                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', margin: '0 0 4px' }}>Deals w/ Add-ons</p>
                      <p style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: '#f8fafc', margin: 0 }}>{summary?.uniqueLeadCount ?? '—'}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', margin: '0 0 4px' }}>Avg per Deal</p>
                      <p style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: '#f8fafc', margin: 0 }}>{summary?.avgPerDeal != null ? fmtRM(summary.avgPerDeal) : '—'}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)', gridColumn: '1 / -1' }}>
                      <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', margin: '0 0 4px' }}>Attachment Rate</p>
                      <p style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, margin: 0, color: summary?.attachRate != null ? (summary.attachRate >= 20 ? '#4ade80' : '#fbbf24') : '#6b7280' }}>
                        {summary?.attachRate != null ? `${summary.attachRate}%` : '—'}
                      </p>
                      <p style={{ fontSize: 10, color: '#4b5563', margin: '2px 0 0' }}>of won leads this month</p>
                    </div>
                  </div>
                  {/* Top products */}
                  {summary?.topProducts?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 8px' }}>Top Products</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {summary.topProducts.map(([name, count], i) => (
                          <span
                            key={name}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                              background: i === 0 ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${i === 0 ? 'rgba(220,38,38,0.25)' : 'rgba(255,255,255,0.1)'}`,
                              color: i === 0 ? '#fca5a5' : '#9ca3af',
                            }}
                          >
                            {name} × {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Recent transactions table */}
          <div
            className="rounded-lg"
            style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.055)', overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>Recent Sales</p>
            </div>
            <div style={{ padding: '0 0 4px' }}>
              {recentLoading ? (
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3].map(i => <Skel key={i} h="h-8" />)}
                </div>
              ) : recentRows.length === 0 ? (
                <p style={{ fontSize: 12, color: '#4b5563', padding: '16px 18px' }}>No add-ons sold yet.</p>
              ) : (
                <>
                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 72px', gap: 8, padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)' }}>
                    {['Date', 'Lead', 'Product', 'Price'].map(h => (
                      <span key={h} style={{ fontSize: 9, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
                    ))}
                  </div>
                  {recentRows.map((r, i) => (
                    <div
                      key={r.id}
                      style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 72px', gap: 8, padding: '9px 14px', alignItems: 'center', borderBottom: i < recentRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    >
                      <span style={{ fontSize: 11, color: '#4b5563' }}>{fmtDate(r.created_at)}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.leads?.buyer_name || '—'}</span>
                      <span style={{ fontSize: 12, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{r.dealer_products?.name || '—'}</span>
                      <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, textAlign: 'right' }}>RM {Number(r.sold_price).toLocaleString()}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Add / Edit slide-out panel ── */}
      {panelOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
            onClick={closePanel}
          />
          {/* Panel */}
          <div
            style={{
              position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 50,
              width: 'min(400px, 100vw)',
              background: 'linear-gradient(155deg,#0d0d14 0%,#0a0a0f 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              fontFamily: "'DM Sans',sans-serif",
              animation: 'svcSlide 0.2s ease',
            }}
          >
            <style>{`@keyframes svcSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(220,38,38,0.5) 40%,rgba(56,189,248,0.3) 70%,transparent)' }} />

            {/* Panel header */}
            <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0 }}>{editTarget ? 'Edit Product' : 'Add Product'}</p>
              <button onClick={closePanel} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Paint Protection Film" style={inp} />
              </div>

              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Category *</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Prices */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Cost Price (RM)</label>
                  <input type="number" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))} placeholder="0" style={inp} min="0" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Selling Price (RM) *</label>
                  <input type="number" value={form.selling_price} onChange={e => setForm(p => ({ ...p, selling_price: e.target.value }))} placeholder="0" style={inp} min="0" />
                </div>
              </div>

              {/* Live margin preview */}
              {form.selling_price && (
                <p style={{ fontSize: 12, fontWeight: 600, color: marginColor(mPct), margin: '-8px 0 0' }}>
                  Margin: {mPct}%
                </p>
              )}

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Short description…" rows={3} style={{ ...inp, resize: 'vertical' }} />
              </div>

              {/* Active toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>Active</span>
                <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {form.is_active
                    ? <ToggleRight style={{ width: 26, height: 26, color: '#4ade80' }} />
                    : <ToggleLeft  style={{ width: 26, height: 26, color: '#4b5563' }} />}
                </button>
              </div>
            </div>

            {/* Panel footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ width: '100%', padding: '11px', borderRadius: 8, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
