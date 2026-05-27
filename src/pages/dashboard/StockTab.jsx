import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import {
  X,
  Package,
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

const T = {
  card: {
    position: 'relative',
    background: 'linear-gradient(145deg, rgba(255,255,255,0.032), rgba(255,255,255,0.008))',
    border: '1px solid rgba(255,255,255,0.055)',
    backdropFilter: 'blur(12px)',
  },
  cardDark: {
    position: 'relative',
    background: 'rgba(8,10,18,0.95)',
    border: '1px solid rgba(255,255,255,0.055)',
  },
  divider: { borderBottom: '1px solid rgba(255,255,255,0.048)' },
  btnRed: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(29,78,216,0.95))',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};

const iCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all";

function Sparkline({ data = [], color = '#3b82f6', width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const gradId = `sg-${color.replace('#', '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gradId})`} />
    </svg>
  );
}

function bucketGPByMonth(units, months = 6) {
  const result = Array(months).fill(0);
  const now = new Date();
  units.forEach(u => {
    if (!u.sold_at || !u.sold_price) return;
    const d = new Date(u.sold_at);
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo >= 0 && monthsAgo < months) {
      const gp = (u.sold_price || 0) - (u.purchase_price || 0) - (u.recon_cost || 0);
      result[months - 1 - monthsAgo] += gp;
    }
  });
  return result;
}

function StockTab({ userId, listings }) {
  const navigate = useNavigate();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ listing_id: '', purchase_price: '', purchase_date: '', purchase_source: '', recon_cost: '', asking_price: '', notes: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [soldTarget, setSoldTarget] = useState(null);
  const [soldForm, setSoldForm] = useState({ sold_price: '', sold_date: '' });
  const [soldSaving, setSoldSaving] = useState(false);
  const [stockView, setStockView] = useState('available');

  const fetchUnits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stock_units')
      .select('*, car_listings(brand, model, year, plate_number, selling_price, purchase_price, recon_cost, gross_profit, days_in_stock, sold_price, sold_date, status)')
      .eq('dealer_id', userId)
      .order('created_at', { ascending: false });
    if (error) console.error('[StockTab] fetchUnits error:', error.message, error);
    setUnits(data || []);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchUnits(); }, [userId]);

  const daysInStock = (purchaseDate) => {
    if (!purchaseDate) return '—';
    return Math.floor((Date.now() - new Date(purchaseDate)) / 86400000);
  };

  const grossProfit = (u) => {
    if (!u.sold_price) return null;
    return (Number(u.sold_price) || 0) - (Number(u.purchase_price) || 0) - (Number(u.recon_cost) || 0);
  };

  const now = new Date();
  const activeUnits = units.filter(u => u.status !== 'sold');
  const soldUnits = units.filter(u => u.status === 'sold');

  const thisMonth = soldUnits.filter(u => {
    if (!u.sold_date) return false;
    const d = new Date(u.sold_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalGP = thisMonth.reduce((s, u) => s + (grossProfit(u) || 0), 0);
  const totalValue = activeUnits.reduce((s, u) => s + (Number(u.purchase_price) || 0), 0);
  const avgDays = activeUnits.length
    ? Math.round(activeUnits.reduce((s, u) => {
        if (!u.purchase_date) return s;
        return s + Math.floor((Date.now() - new Date(u.purchase_date)) / 86400000);
      }, 0) / activeUnits.length)
    : 0;
  const agingUnits = activeUnits.filter(u =>
    u.purchase_date && Math.floor((Date.now() - new Date(u.purchase_date)) / 86400000) > 60
  );
  const gpSparkData = bucketGPByMonth(units);

  const handleAdd = async () => {
    setAddSaving(true);
    await supabase.from('stock_units').insert({ ...addForm, dealer_id: userId, status: 'in_stock', purchase_price: Number(addForm.purchase_price) || 0, recon_cost: Number(addForm.recon_cost) || 0, asking_price: Number(addForm.asking_price) || 0 });
    setShowAdd(false);
    setAddForm({ listing_id: '', purchase_price: '', purchase_date: '', purchase_source: '', recon_cost: '', asking_price: '', notes: '' });
    setAddSaving(false);
    fetchUnits();
  };

  const handleMarkSold = async () => {
    setSoldSaving(true);
    const soldPrice = parseFloat(soldForm.sold_price);
    const payload = {
      status: 'sold',
      sold_date: soldForm.sold_date || new Date().toISOString().slice(0, 10),
      sold_price: isNaN(soldPrice) ? 0 : soldPrice,
    };
    const { error } = await supabase
      .from('stock_units')
      .update(payload)
      .eq('id', soldTarget.id)
      .eq('dealer_id', userId);
    if (error) {
      console.error('Mark sold error:', error.message);
      toast.error('Failed to mark as sold: ' + error.message);
      setSoldSaving(false);
      return;
    }
    setUnits(p => p.map(u => u.id === soldTarget.id ? { ...u, ...payload } : u));
    setSoldTarget(null);
    setSoldSaving(false);
  };

  const statusBadge = (s) => {
    const map = { in_stock: ['#34d399','rgba(52,211,153,0.12)'], sold: ['#9ca3af','rgba(156,163,175,0.1)'], reserved: ['#fbbf24','rgba(251,191,36,0.12)'] };
    const [color, bg] = map[s] || ['#9ca3af','rgba(255,255,255,0.05)'];
    return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, border: `1px solid ${color}33`, borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s?.replace('_',' ') || '—'}</span>;
  };

  const summaryCards = [
    { label: 'Total Units',          val: activeUnits.length,                  Icon: Package,       glow: 'rgba(103,232,249,0.13)',                                           grad: 'grad-cyan'                                                          },
    { label: 'Stock Value',          val: `RM ${totalValue.toLocaleString()}`,  Icon: Banknote,      glow: 'rgba(251,191,36,0.13)',                                            grad: 'grad-red'                                                           },
    { label: 'Avg Days in Stock',    val: avgDays,                              Icon: Clock,         glow: 'rgba(167,139,250,0.13)',                                           grad: avgDays > 60 ? 'grad-red' : avgDays > 30 ? 'grad-gold' : 'grad-purple' },
    { label: 'Gross Profit (month)', val: `RM ${totalGP.toLocaleString()}`,     Icon: TrendingUp,    glow: 'rgba(110,231,183,0.13)',                                           grad: totalGP > 0 ? 'grad-green' : 'grad-white', spark: gpSparkData, sparkColor: '#34d399' },
    { label: 'Sold This Month',      val: thisMonth.length,                     Icon: CheckCircle2,  glow: 'rgba(110,231,183,0.13)',                                           grad: 'grad-green'                                                         },
    { label: 'Aging Stock (60d+)',   val: agingUnits.length,                    Icon: AlertTriangle, glow: agingUnits.length > 0 ? 'rgba(248,113,113,0.18)' : 'rgba(255,255,255,0.04)', grad: agingUnits.length > 0 ? 'grad-red' : ''              },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        {summaryCards.map(({ label, val, Icon: Ic, glow, grad, spark, sparkColor }) => (
          <div key={label} className="stat-card card-top rounded-2xl overflow-hidden glass" style={{ position: 'relative' }}>
            {spark && (
              <div className="px-3.5 pt-3">
                <Sparkline data={spark} color={sparkColor || '#3b82f6'} width={120} height={32} />
              </div>
            )}
            <div className={spark ? 'p-3 sm:p-4 pt-2' : 'p-3 sm:p-4'}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">{label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: glow, boxShadow: `0 0 14px ${glow}` }}><Ic className="w-4 h-4 opacity-80" /></div>
              </div>
              <p className={`text-xl sm:text-2xl font-black leading-none tabular-nums ${grad || 'text-white'}`}>{val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={T.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Stock Units</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled title="CSV import coming soon" className="flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg opacity-40 cursor-not-allowed" style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}><Upload className="w-3.5 h-3.5" />Import Stock</button>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm font-semibold text-white px-3 py-1.5 rounded-lg" style={T.btnRed}><PlusCircle className="w-3.5 h-3.5" />Add Stock</button>
          </div>
        </div>
        {/* Available / Sold tab toggle */}
        <div style={{ display: 'flex', gap: 0, padding: '0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { id: 'available', label: 'Available', count: activeUnits.length },
            { id: 'sold',      label: 'Sold',      count: soldUnits.length   },
          ].map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setStockView(id)}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: 'none',
                color: stockView === id ? '#f3f4f6' : '#6b7280',
                borderBottom: stockView === id ? '2px solid #3b82f6' : '2px solid transparent',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              {label}
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: 10,
                background: stockView === id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                color: stockView === id ? '#93c5fd' : '#4b5563',
              }}>{count}</span>
            </button>
          ))}
        </div>
        <div className="table-wrap">
          {loading ? (
            <p className="text-gray-500 text-sm p-6">Loading...</p>
          ) : units.length === 0 ? (
            <p className="text-gray-600 text-sm p-6">No stock units yet.</p>
          ) : (() => {
            const displayUnits = stockView === 'available' ? activeUnits : soldUnits;
            const thStyle = { padding: '10px 14px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap' };
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans', sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {stockView === 'available'
                      ? ['Car', 'Purchase Price', 'Recon', 'Asking', 'Days', 'Gross Profit', 'Status', ''].map(h => <th key={h} style={thStyle}>{h}</th>)
                      : ['Car', 'Purchase Price', 'Recon', 'Days in Stock', 'Gross Profit', 'Status', 'Sold Price', 'Sold Date'].map(h => <th key={h} style={thStyle}>{h}</th>)
                    }
                  </tr>
                </thead>
                <tbody>
                  {displayUnits.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '24px 14px', color: '#4b5563', fontSize: 13 }}>No units in this view.</td></tr>
                  ) : displayUnits.map(u => {
                    const car = u.car_listings || { brand: u.brand, model: u.model, year: u.year, plate_number: u.registration_number };
                    const gp = grossProfit(u);
                    const days = u.purchase_date ? Math.floor((Date.now() - new Date(u.purchase_date)) / 86400000) : 0;
                    const isAging = u.status === 'in_stock' && days > 60;
                    return (
                      <tr key={u.id} title={isAging ? '60+ days in stock' : undefined} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isAging ? 'rgba(220,38,38,0.05)' : 'transparent' }} onMouseEnter={e => e.currentTarget.style.background = isAging ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = isAging ? 'rgba(220,38,38,0.05)' : 'transparent'}>
                        <td style={{ padding: '12px 14px', minWidth: 140 }}>
                          {car ? <><p style={{ fontSize: 13, color: '#f3f4f6', fontWeight: 500, margin: 0 }}>{car.brand} {car.model}</p><p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{car.year}{car.plate_number ? ` · ${car.plate_number}` : ''}</p></> : <span style={{ color: '#6b7280', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#f3f4f6', fontSize: 13, whiteSpace: 'nowrap' }}>RM {(Number(u.purchase_price)||0).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: 13, whiteSpace: 'nowrap' }}>RM {(Number(u.recon_cost)||0).toLocaleString()}</td>
                        {stockView === 'available' && (
                          <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: 13, whiteSpace: 'nowrap' }}>RM {(Number(u.asking_price)||0).toLocaleString()}</td>
                        )}
                        <td style={{ padding: '12px 14px', fontSize: 13 }}>
                          {isAging
                            ? <span style={{ color: '#93c5fd', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle style={{ width: 11, height: 11 }} />{days}d</span>
                            : <span style={{ color: '#9ca3af' }}>{u.purchase_date ? `${days}d` : '—'}</span>}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
                          {gp != null ? <span style={{ color: gp >= 0 ? '#34d399' : '#93c5fd', fontWeight: 600 }}>RM {gp.toLocaleString()}</span> : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>{statusBadge(u.status)}</td>
                        {stockView === 'available' ? (
                          <td style={{ padding: '12px 14px' }}>
                            <button onClick={() => { setSoldTarget(u); setSoldForm({ sold_price: '', sold_date: new Date().toISOString().slice(0, 10) }); }} style={{ fontSize: 11, color: '#93c5fd', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Mark Sold</button>
                          </td>
                        ) : (
                          <>
                            <td style={{ padding: '12px 14px', color: '#34d399', fontSize: 13, whiteSpace: 'nowrap', fontWeight: 600 }}>
                              RM {Number(u.sold_price || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: 12 }}>
                              {u.sold_date ? new Date(u.sold_date).toLocaleDateString('en-MY') : '—'}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>

      {/* Add Stock Modal */}
      {showAdd && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col" style={undefined}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white">Add Stock Unit</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Car Listing</label>
                <select value={addForm.listing_id} onChange={e => setAddForm(p => ({ ...p, listing_id: e.target.value }))} className={iCls} style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <option value="">Select listing...</option>
                  {listings.map(l => <option key={l.id} value={l.id}>{l.brand} {l.model} {l.year}{l.plate_number ? ` · ${l.plate_number}` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Purchase Price (RM)</label><input type="number" value={addForm.purchase_price} onChange={e => setAddForm(p => ({ ...p, purchase_price: e.target.value }))} placeholder="0" className={iCls} /></div>
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Purchase Date</label><input type="date" value={addForm.purchase_date} onChange={e => setAddForm(p => ({ ...p, purchase_date: e.target.value }))} className={iCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Recon Cost (RM)</label><input type="number" value={addForm.recon_cost} onChange={e => setAddForm(p => ({ ...p, recon_cost: e.target.value }))} placeholder="0" className={iCls} /></div>
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Asking Price (RM)</label><input type="number" value={addForm.asking_price} onChange={e => setAddForm(p => ({ ...p, asking_price: e.target.value }))} placeholder="0" className={iCls} /></div>
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Purchase Source</label><input type="text" value={addForm.purchase_source} onChange={e => setAddForm(p => ({ ...p, purchase_source: e.target.value }))} placeholder="e.g. Auction, Trade-in" className={iCls} /></div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Notes</label><textarea value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional notes..." className={taCls} /></div>
            </div>
            <div className="p-5 border-t border-white/[0.06] flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
              <button onClick={handleAdd} disabled={addSaving} className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>{addSaving ? 'Saving...' : 'Add Unit'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Sold Modal */}
      {soldTarget && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-sm" style={undefined}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white">Mark as Sold</h3>
              <button onClick={() => setSoldTarget(null)} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Sold Price (RM)</label><input type="number" value={soldForm.sold_price} onChange={e => setSoldForm(p => ({ ...p, sold_price: e.target.value }))} placeholder="0" className={iCls} /></div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Sold Date</label><input type="date" value={soldForm.sold_date} onChange={e => setSoldForm(p => ({ ...p, sold_date: e.target.value }))} className={iCls} /></div>
            </div>
            <div className="p-5 border-t border-white/[0.06] flex gap-3">
              <button onClick={() => setSoldTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
              <button onClick={handleMarkSold} disabled={soldSaving} className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>{soldSaving ? 'Saving...' : 'Confirm Sale'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockTab;
