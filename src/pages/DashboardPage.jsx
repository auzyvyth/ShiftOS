import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import CarForm from '../components/CarForm';
import TikTokGenerator from '../components/TikTokGenerator';
import {
  Car, PlusCircle, LogOut, Home, Trash2, X, TrendingUp, DollarSign,
  Eye, Menu, Building2, Clock, Users, Copy, Check, Link,
  UserPlus, ToggleLeft, ToggleRight, Video, Tag, Flame,
  BarChart2, Send, Bot, ChevronRight, AlertCircle, CheckCircle2,
  MessageSquare, MessageCircle, Phone,
} from 'lucide-react';

const SERVER_URL = 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1';

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  .grad-red    { background: linear-gradient(135deg,#f87171,#fb923c); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-cyan   { background: linear-gradient(135deg,#67e8f9,#38bdf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-green  { background: linear-gradient(135deg,#6ee7b7,#34d399); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-purple { background: linear-gradient(135deg,#d8b4fe,#a78bfa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-gold   { background: linear-gradient(135deg,#fde68a,#fbbf24); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-white  { background: linear-gradient(135deg,#f8fafc,#94a3b8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }

  .card-top::before { content:''; position:absolute; top:0; left:16px; right:16px; height:1px; background:linear-gradient(90deg,transparent,rgba(220,38,38,0.45) 35%,rgba(56,189,248,0.28) 65%,transparent); pointer-events:none; z-index:1; }
  .modal-top::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent 8%,rgba(220,38,38,0.55) 38%,rgba(56,189,248,0.38) 68%,transparent 92%); border-radius:16px 16px 0 0; pointer-events:none; z-index:2; }

  .nav-item { border-left:2px solid transparent; transition:all 0.15s; }
  .nav-item:hover:not(.nav-active) { background:rgba(255,255,255,0.04)!important; border-left-color:rgba(220,38,38,0.22); }
  .nav-active { background:linear-gradient(90deg,rgba(220,38,38,0.16),rgba(220,38,38,0.04))!important; border-left:2px solid #dc2626!important; }

  .stat-card { transition:transform 0.18s,box-shadow 0.18s; }
  .stat-card:hover { transform:translateY(-2px); box-shadow:0 14px 32px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.08); }

  .data-row { border-left:2px solid transparent; transition:background 0.12s,border-left-color 0.12s; }
  .data-row:hover { background:rgba(220,38,38,0.025)!important; border-left-color:rgba(220,38,38,0.3); }

  .badge-glow-red  { box-shadow:0 0 6px rgba(248,113,113,0.28); }
  .badge-glow-cyan { box-shadow:0 0 6px rgba(103,232,249,0.22); }
  .badge-glow-gold { box-shadow:0 0 6px rgba(251,191,36,0.22); }

  @keyframes hotpulse { 0%,100%{opacity:1}50%{opacity:.55} }
  .hot-glow { animation:hotpulse 2.2s ease-in-out infinite; }

  .discount-chip { transition:box-shadow 0.15s; }
  .discount-chip:hover { box-shadow:0 0 10px rgba(220,38,38,0.42); }

  .btn-shimmer { position:relative; overflow:hidden; }
  .btn-shimmer::after { content:''; position:absolute; top:0; left:-80%; width:50%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent); animation:shimmer 3s ease infinite; }
  @keyframes shimmer { to { left:150%; } }

  /* Mark as Sold button pulse on hover */
  .sold-btn:hover { background:rgba(34,197,94,0.15) !important; border-color:rgba(34,197,94,0.45) !important; color:#4ade80 !important; }

  ::-webkit-scrollbar { width:4px; height:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(220,38,38,0.22); border-radius:4px; }
  ::-webkit-scrollbar-thumb:hover { background:rgba(220,38,38,0.42); }
`;

const T = {
  card:    { position:'relative', background:'linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))', border:'1px solid rgba(255,255,255,0.07)' },
  cardDark:{ position:'relative', background:'rgba(255,255,255,0.022)', border:'1px solid rgba(255,255,255,0.065)' },
  modal:   { position:'relative', background:'rgba(11,11,15,0.98)', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 0 0 1px rgba(220,38,38,0.07), 0 32px 64px rgba(0,0,0,0.72)' },
  divider: { borderBottom:'1px solid rgba(255,255,255,0.05)' },
  btnRed:  { background:'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow:'0 2px 10px rgba(220,38,38,0.28)' },
};

function getListingAge(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt)) / 86400000);
}

function AgeBadge({ createdAt }) {
  const d = getListingAge(createdAt);
  if (d < 14) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 badge-glow-cyan"><Clock className="w-3 h-3" />{d===0?'Today':`${d}d`}</span>;
  if (d < 30) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 badge-glow-gold"><Clock className="w-3 h-3" />{d}d</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-400/10 text-red-400 border border-red-400/20 badge-glow-red"><Clock className="w-3 h-3" />{d}d</span>;
}

// ─── PriceEditModal ───────────────────────────────────────────────────────────
function PriceEditModal({ listing, onClose, onSave }) {
  const cur = listing.selling_price || 0;
  const orig = listing.original_price || null;
  const [np, setNp] = useState(String(cur));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const npv = parseFloat(np) || 0;
  const ref = orig || cur;
  const disc = ref > npv ? ref - npv : 0;
  const pct = ref > 0 ? (disc / ref) * 100 : 0;
  const isHot = pct >= 3, isUp = npv > cur, isReset = orig && npv >= orig;

  const handleSave = async () => {
    setErr(''); if (!npv || npv <= 0) { setErr('Enter a valid price'); return; }
    if (npv === cur) { onClose(); return; }
    setSaving(true);
    try {
      let payload = { selling_price: npv };
      if (isReset) payload.original_price = null;
      else if (!orig && npv < cur) payload.original_price = cur;
      const { data, error } = await supabase.from('car_listings').update(payload).eq('id', listing.id).select().single();
      if (error) throw error;
      onSave(data); onClose();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background:'rgba(0,0,0,0.78)' }}>
      <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden" style={T.modal}>
        <div className="flex items-center justify-between px-5 py-4" style={T.divider}>
          <div><h3 className="font-semibold text-white">Adjust Price</h3><p className="text-xs text-gray-500 mt-0.5">{listing.brand} {listing.model} {listing.variant||''}</p></div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 transition-colors"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Current price</span>
            <div className="flex items-center gap-2">
              {orig && <span className="text-gray-600 line-through text-xs">RM {orig.toLocaleString()}</span>}
              <span className="font-semibold grad-white">RM {cur.toLocaleString()}</span>
              {orig && <span className="text-red-400 text-xs font-medium bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">-{Math.round(((orig-cur)/orig)*100)}%</span>}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">New Selling Price (RM)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">RM</span>
              <input type="number" value={np} onChange={e=>{setNp(e.target.value);setErr('');}} min="0" autoFocus
                className="w-full pl-12 pr-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white text-lg font-semibold focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/15 transition-all"/>
            </div>
          </div>
          {npv>0 && npv!==cur && (
            <div className={`px-4 py-3 rounded-xl border text-sm ${isReset?'bg-cyan-500/10 border-cyan-500/20 text-cyan-400':isUp?'bg-amber-500/10 border-amber-500/20 text-amber-400':isHot?'bg-red-500/10 border-red-500/20 text-red-400':'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              {isReset && <p className="font-medium">Price raised — discount badge removed</p>}
              {!isReset&&isUp && <p className="font-medium">Price raised by RM {(npv-cur).toLocaleString()}</p>}
              {!isReset&&!isUp && <><div className="flex items-center gap-2 font-semibold">{isHot&&<Flame className="w-4 h-4"/>}<span>RM {disc.toLocaleString()} off ({pct.toFixed(1)}%)</span>{isHot&&<span className="text-xs font-normal">Hot Deal!</span>}</div><p className="text-xs opacity-70 mt-1">{!orig?'Original price locked automatically':'Original stays locked'}</p>{isHot&&<p className="text-xs opacity-70 mt-0.5">Moves to Hot Deals</p>}</>}
            </div>
          )}
          {err && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">⚠ {err}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all" style={{ border:'1px solid rgba(255,255,255,0.09)' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving||!npv||npv<=0} className="btn-shimmer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-40 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>
              {saving?<><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>:'Save Price'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MarkSoldModal ─────────────────────────────────────────────────────────────
function MarkSoldModal({ listing, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background:'rgba(0,0,0,0.78)' }}>
      <div className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md" style={T.modal}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white">Mark as Sold?</h3>
            <p className="text-gray-500 text-xs mt-0.5">{listing.brand} {listing.model} {listing.variant||''}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 transition-colors"><X className="w-5 h-5"/></button>
        </div>

        <div className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3" style={{ background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.18)' }}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-emerald-300 text-sm font-semibold">Sold count will update automatically</p>
            <p className="text-emerald-500/60 text-xs mt-0.5">This listing moves to "Sold" and the sold counter on the homepage and analytics updates in real-time.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="btn-shimmer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40"
            style={{ background:'linear-gradient(135deg,#16a34a,#15803d)', boxShadow:'0 2px 10px rgba(22,163,74,0.3)' }}>
            {loading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Marking…</> : <><CheckCircle2 className="w-4 h-4"/>Confirm Sold</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AnalyticsTab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ listings, profile }) {
  const [messages, setMessages] = useState([{ role:'assistant', content:`Hi! I'm your performance advisor. I can see your inventory and help with pricing, leads, and conversions. What would you like to know?` }]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { if (chatOpen) endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, chatOpen]);

  // Traffic analytics
  const [events,       setEvents]       = useState([]);
  const [eventsLoading,setEventsLoading]= useState(true);
  useEffect(() => {
    supabase.from('analytics_events').select('*').order('created_at',{ascending:false}).then(({data})=>{ setEvents(data||[]); setEventsLoading(false); });
  }, []);
  const totalClicks    = events.filter(e=>e.event_type==='link_visit'||e.event_type==='car_view').length;
  const totalEnquiries = events.filter(e=>e.event_type==='whatsapp_click'||e.event_type==='call_click').length;
  const totalWa        = events.filter(e=>e.event_type==='whatsapp_click').length;
  const totalCalls     = events.filter(e=>e.event_type==='call_click').length;
  // per-salesman rollup
  const bySlug = events.reduce((acc,e)=>{ if(!acc[e.salesman_slug])acc[e.salesman_slug]={clicks:0,enquiries:0}; if(e.event_type==='link_visit'||e.event_type==='car_view')acc[e.salesman_slug].clicks++; if(e.event_type==='whatsapp_click'||e.event_type==='call_click')acc[e.salesman_slug].enquiries++; return acc; },{});
  const topSalesmen = Object.entries(bySlug).sort((a,b)=>b[1].enquiries-a[1].enquiries);

  const total  = listings.length;
  const active = listings.filter(l=>(l.status||'active')==='active').length;
  const sold   = listings.filter(l=>l.status==='sold').length;
  const hot    = listings.filter(l=>{ const op=l.original_price,sp=l.selling_price; return op&&sp&&sp<=op*0.97; }).length;
  const avgAge = total ? Math.round(listings.reduce((s,l)=>s+getListingAge(l.created_at),0)/total) : 0;
  const stale  = listings.filter(l=>getListingAge(l.created_at)>=30&&(l.status||'active')==='active');

  const ctx = () => {
    const s = listings.slice(0,20).map(l=>`${l.brand} ${l.model}|RM${l.selling_price?.toLocaleString()}|${getListingAge(l.created_at)}d|${l.status||'active'}|${l.condition}|${l.mileage?l.mileage.toLocaleString()+'km':'-'}|${l.state||'-'}${l.original_price?`|was RM${l.original_price.toLocaleString()}`:''}` ).join('\n');
    return `AI performance advisor for ShiftOS, Malaysian car dealer SaaS.\nDealer: ${profile?.dealership||'Unknown'}. Total:${total} Active:${active} Sold:${sold} HotDeals:${hot} AvgAge:${avgAge}d Stale:${stale.length}\nListings:\n${s}\nBe concise, actionable. Under 200 words.`;
  };

  const send = async () => {
    if (!input.trim()||loading) return;
    const msg = input.trim(); setInput('');
    setMessages(p=>[...p,{role:'user',content:msg}]); setLoading(true);
    try {
      const history = [...messages.map(m=>({role:m.role,content:m.content})),{role:'user',content:msg}];
      const res = await fetch(`${SERVER_URL}/ai/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,system:ctx(),messages:history})});
      const data = await res.json();
      let reply = 'Could not generate a response.';
      if (Array.isArray(data?.content)) reply = data.content.find(b=>b.type==='text')?.text||reply;
      else if (data?.completion) reply = data.completion;
      setMessages(p=>[...p,{role:'assistant',content:reply}]);
    } catch { setMessages(p=>[...p,{role:'assistant',content:'Connection error. Try again.'}]); }
    setLoading(false);
  };

  const PROMPTS = ['Why aren\'t my listings converting?','Which car should I reprice?','Any I should remove?','How to write better listings?'];

  const kpis = [
    { label:'Active',    val:active,       sub:`of ${total} total`,     grad:'grad-cyan',   icon:<Car className="w-4 h-4"/>,        glow:'rgba(103,232,249,0.14)' },
    { label:'Sold',      val:sold,         sub:'all time',              grad:'grad-green',  icon:<CheckCircle2 className="w-4 h-4"/>, glow:'rgba(110,231,183,0.14)' },
    { label:'Hot Deals', val:hot,          sub:'≥3% off',               grad:hot>0?'grad-red':'', icon:<Flame className="w-4 h-4"/>, glow:hot>0?'rgba(248,113,113,0.18)':'rgba(255,255,255,0.03)' },
    { label:'Avg. Age',  val:`${avgAge}d`, sub:avgAge>=30?'⚠ Aging':'Healthy', grad:avgAge>=30?'grad-gold':'grad-white', icon:<Clock className="w-4 h-4"/>, glow:avgAge>=30?'rgba(251,191,36,0.14)':'rgba(255,255,255,0.03)' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(({label,val,sub,grad,icon,glow}) => (
          <div key={label} className="stat-card card-top rounded-xl p-4 overflow-hidden" style={T.card}>
            <div className="absolute inset-0 pointer-events-none" style={{ background:`radial-gradient(circle at 100% 0%, rgba(220,38,38,0.05) 0%, transparent 55%)` }}/>
            <div className="flex items-center justify-between mb-3 relative">
              <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">{label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:glow, boxShadow:`0 0 12px ${glow}` }}>{icon}</div>
            </div>
            <p className={`text-2xl sm:text-3xl font-black leading-none relative tabular-nums ${grad||'text-white'}`}>{val}</p>
            <p className="text-xs text-gray-700 mt-1.5 hidden sm:block relative">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Traffic KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Clicks',   val:totalClicks,    grad:'grad-cyan',   glow:'rgba(103,232,249,0.14)', icon:<Eye className="w-4 h-4"/> },
          { label:'Enquiries',      val:totalEnquiries, grad:'grad-gold',   glow:'rgba(251,191,36,0.14)',  icon:<MessageSquare className="w-4 h-4"/> },
          { label:'WhatsApp',       val:totalWa,        grad:'grad-green',  glow:'rgba(110,231,183,0.14)', icon:<MessageCircle className="w-4 h-4"/> },
          { label:'Call Clicks',    val:totalCalls,     grad:'grad-purple', glow:'rgba(216,180,254,0.14)', icon:<Phone className="w-4 h-4"/> },
        ].map(({label,val,grad,glow,icon})=>(
          <div key={label} className="stat-card card-top rounded-xl p-4 overflow-hidden" style={T.card}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">{label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:glow }}>{icon}</div>
            </div>
            {eventsLoading
              ? <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin"/>
              : <p className={`text-2xl sm:text-3xl font-black leading-none tabular-nums ${grad}`}>{val}</p>}
          </div>
        ))}
      </div>

      {/* ── Per-salesman leaderboard ── */}
      {topSalesmen.length > 0 && (
        <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
          <div className="flex items-center gap-2 p-4" style={T.divider}>
            <BarChart2 className="w-4 h-4 text-red-400"/>
            <p className="font-semibold text-white text-sm">Salesman Performance</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {topSalesmen.map(([slug,{clicks,enquiries}],i)=>(
              <div key={slug} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs text-gray-600 w-4 tabular-nums">{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">/{slug}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500"><span className="text-sky-400 font-semibold">{clicks}</span> clicks</span>
                    <span className="text-xs text-gray-500"><span className="text-amber-400 font-semibold">{enquiries}</span> enquiries</span>
                  </div>
                </div>
                {enquiries > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.2)', color:'#fbbf24' }}>🔥 Active</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {stale.length>0 && (
        <div className="rounded-xl p-4" style={{ background:'rgba(251,191,36,0.04)', border:'1px solid rgba(251,191,36,0.12)' }}>
          <div className="flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4 text-amber-400"/><p className="text-amber-300 text-sm font-semibold">{stale.length} listing{stale.length>1?'s':''} aging 30+ days</p></div>
          <div className="space-y-2">
            {stale.slice(0,5).map(l=>(
              <div key={l.id} className="flex items-center justify-between py-2" style={{ borderBottom:'1px solid rgba(251,191,36,0.07)' }}>
                <div className="flex items-center gap-3">
                  {l.images?.[0]?<img src={l.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-800 flex-shrink-0"/>:<div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0"/>}
                  <div><p className="text-white text-sm font-medium">{l.brand} {l.model}</p><p className="text-gray-500 text-xs">RM {l.selling_price?.toLocaleString()}</p></div>
                </div>
                <span className="text-amber-400 text-xs font-semibold bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 badge-glow-gold">{getListingAge(l.created_at)}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <div className="flex items-center justify-between p-4" style={T.divider}>
          <div><h2 className="font-semibold text-white text-sm">Listing Performance</h2><p className="text-xs text-gray-600 mt-0.5">Views & leads tracking activates once traffic is live</p></div>
        </div>
        {listings.length===0?<div className="p-12 text-center text-gray-600 text-sm">No listings to analyse yet</div>:(
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ background:'rgba(255,255,255,0.02)', boxShadow:'inset 0 -1px 0 rgba(220,38,38,0.2)' }}>{['Vehicle','Price','Age','Views','Leads','CVR','Status'].map((h,i)=><th key={i} className="px-4 py-3 text-gray-600 font-semibold text-xs uppercase tracking-widest text-left">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/[0.04]">
                {listings.map(l=>(
                  <tr key={l.id} className={`data-row ${getListingAge(l.created_at)>=30?'bg-amber-950/[0.08]':''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {l.images?.[0]?<img src={l.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-800 flex-shrink-0"/>:<div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0"/>}
                        <div className="min-w-0"><p className="font-medium text-white text-sm truncate">{l.brand} {l.model}</p><p className="text-gray-600 text-xs truncate">{l.variant||'—'}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold grad-white text-sm">RM {l.selling_price?.toLocaleString()||'—'}</td>
                    <td className="px-4 py-3"><AgeBadge createdAt={l.created_at}/></td>
                    <td className="px-4 py-3 text-gray-700 text-sm">—</td>
                    <td className="px-4 py-3 text-gray-700 text-sm">—</td>
                    <td className="px-4 py-3 text-gray-700 text-sm">—</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${(l.status||'active')==='active'?'bg-emerald-400/10 text-emerald-400 border-emerald-400/20 badge-glow-cyan':l.status==='reserved'?'bg-amber-400/10 text-amber-400 border-amber-400/20 badge-glow-gold':'bg-red-400/10 text-red-400 border-red-400/20 badge-glow-red'}`}>{l.status||'active'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <button onClick={()=>setChatOpen(v=>!v)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.18)', boxShadow:'0 0 12px rgba(220,38,38,0.12)' }}><Bot className="w-4 h-4 text-red-400"/></div>
            <div className="text-left"><p className="text-white text-sm font-semibold">AI Performance Advisor</p><p className="text-gray-600 text-xs mt-0.5">Ask anything about your inventory & performance</p></div>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${chatOpen?'rotate-90':''}`}/>
        </button>
        {chatOpen && (
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <div className="h-72 overflow-y-auto p-4 space-y-3">
              {messages.map((m,i)=>(
                <div key={i} className={`flex gap-2.5 ${m.role==='user'?'flex-row-reverse':''}`}>
                  {m.role==='assistant'&&<div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background:'rgba(220,38,38,0.12)', border:'1px solid rgba(220,38,38,0.18)' }}><Bot className="w-3 h-3 text-red-400"/></div>}
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role==='user'?'text-white rounded-tr-sm':'text-gray-300 rounded-tl-sm'}`}
                    style={m.role==='user'?{ background:'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow:'0 2px 8px rgba(220,38,38,0.22)' }:{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.06)' }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading&&(
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background:'rgba(220,38,38,0.12)', border:'1px solid rgba(220,38,38,0.18)' }}><Bot className="w-3 h-3 text-red-400"/></div>
                  <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.06)' }}><div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 bg-red-500/40 rounded-full animate-bounce" style={{ animationDelay:`${i*0.15}s` }}/>)}</div></div>
                </div>
              )}
              <div ref={endRef}/>
            </div>
            {messages.length===1&&<div className="px-4 pb-3 flex flex-wrap gap-2">{PROMPTS.map(p=><button key={p} onClick={()=>setInput(p)} className="text-xs px-3 py-1.5 rounded-full text-gray-400 hover:text-white transition-all" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>{p}</button>)}</div>}
            <div className="p-3 flex gap-2 items-end" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <textarea rows={1} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask about your listings, pricing, leads…" className="flex-1 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none resize-none transition-colors" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', maxHeight:'120px' }} onFocus={e=>e.target.style.borderColor='rgba(220,38,38,0.4)'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.08)'}/>
              <button onClick={send} disabled={loading||!input.trim()} className="btn-shimmer w-9 h-9 flex items-center justify-center disabled:opacity-30 rounded-xl flex-shrink-0" style={T.btnRed}><Send className="w-4 h-4 text-white"/></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TeamTab ──────────────────────────────────────────────────────────────────
function TeamTab({ managerDealership }) {
  const [salespeople,     setSalespeople]     = useState([]);
  const [loadingTeam,     setLoadingTeam]     = useState(true);
  const [teamError,       setTeamError]       = useState('');
  const [showAddForm,     setShowAddForm]     = useState(false);
  const [addLoading,      setAddLoading]      = useState(false);
  const [addError,        setAddError]        = useState('');
  const [addSuccess,      setAddSuccess]      = useState('');
  const [copiedId,        setCopiedId]        = useState(null);
  const [togglingId,      setTogglingId]      = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [phone,           setPhone]           = useState('');
  const [slug,            setSlug]            = useState('');
  const [tempPw,          setTempPw]          = useState('');
  // Live sold count for the dealership
  const [teamSoldCount,   setTeamSoldCount]   = useState(0);
  // Analytics per salesman slug: { [slug]: { clicks, enquiries } }
  const [analyticsMap,    setAnalyticsMap]    = useState({});

  const fetchAnalytics = async () => {
    const { data } = await supabase.from('analytics_events').select('salesman_slug,event_type');
    if (!data) return;
    const map = {};
    data.forEach(({ salesman_slug, event_type }) => {
      if (!map[salesman_slug]) map[salesman_slug] = { clicks: 0, enquiries: 0 };
      if (event_type === 'link_visit' || event_type === 'car_view') map[salesman_slug].clicks++;
      if (event_type === 'whatsapp_click' || event_type === 'call_click') map[salesman_slug].enquiries++;
    });
    setAnalyticsMap(map);
  };

  useEffect(()=>{ fetchTeam(); fetchAnalytics(); },[managerDealership]);

  // Fetch sold count for the dealership in real-time
  useEffect(()=>{
    if (!managerDealership) return;
    const fetchSold = async () => {
      const { count } = await supabase
        .from('car_listings')
        .select('id', { count:'exact', head:true })
        .eq('status','sold');
      setTeamSoldCount(count||0);
    };
    fetchSold();
    const ch = supabase.channel('team_sold')
      .on('postgres_changes',{event:'*',schema:'public',table:'car_listings'},fetchSold)
      .subscribe();
    return () => supabase.removeChannel(ch);
  },[managerDealership]);

  const fetchTeam = async () => {
    if (!managerDealership) { setSalespeople([]); setTeamError('Dealership profile missing.'); setLoadingTeam(false); return; }
    setLoadingTeam(true); setTeamError('');
    const { data, error } = await supabase.from('profiles').select('*').eq('role','salesman').eq('dealership',managerDealership).order('created_at',{ascending:false});
    if (error) { setTeamError(error.message||'Failed to load team.'); setSalespeople([]); }
    else setSalespeople(data||[]);
    setLoadingTeam(false);
  };

  const slugify = v => v.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
  const handleNameChange = v => { setName(v); setSlug(slugify(v.trim().split(/\s+/)[0])); };
  const resetForm = () => { setName(''); setEmail(''); setPhone(''); setSlug(''); setTempPw(''); setAddError(''); setAddSuccess(''); };

  const handleAdd = async () => {
    setAddError('');
    const n=name.trim(), e=email.trim().toLowerCase(), s=slug.trim(), p=phone.trim()||null;
    if (!managerDealership) { setAddError('Dealership required.'); return; }
    if (!n||!e||!s||!tempPw) { setAddError('All fields required.'); return; }
    if (tempPw.length<8) { setAddError('Password min 8 chars.'); return; }
    if (!/^[a-z0-9]+$/.test(s)) { setAddError('Slug: lowercase + numbers only.'); return; }
    setAddLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SERVER_URL}/invites`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token}`},body:JSON.stringify({full_name:n,email:e,phone:p,dealership:managerDealership,slug:s,password:tempPw})});
      const json = await res.json().catch(()=>({}));
      if (!res.ok) { setAddError(json.message||'Failed.'); setAddLoading(false); return; }
      setSalespeople(p=>[json.invite,...p]);
      setAddSuccess(`${n} added successfully.`);
      resetForm(); setShowAddForm(false);
    } catch { setAddError('Server unreachable.'); }
    setAddLoading(false);
  };

  const copyLink = s => { navigator.clipboard.writeText(`${window.location.origin}/cars?ref=${s.slug}`); setCopiedId(s.id); setTimeout(()=>setCopiedId(null),2000); };
  const toggleActive = async s => { setTogglingId(s.id); const {error}=await supabase.from('profiles').update({is_active:!s.is_active}).eq('id',s.id); if (!error) setSalespeople(p=>p.map(x=>x.id===s.id?{...x,is_active:!s.is_active}:x)); setTogglingId(null); };
  const deleteSalesman = async id => { const { data: { session } } = await supabase.auth.getSession(); const res=await fetch(`${SERVER_URL}/invites/${id}`,{method:'DELETE',headers:{'Authorization':`Bearer ${session?.access_token}`}}); if (res.ok) setSalespeople(p=>p.filter(x=>x.id!==id)); setDeleteConfirmId(null); };

  const activeCount   = salespeople.filter(s=>s.is_active!==false).length;
  const inactiveCount = salespeople.filter(s=>s.is_active===false).length;
  const activeRate    = salespeople.length ? Math.round((activeCount/salespeople.length)*100) : 0;

  const iCls = "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/10 transition-all";

  return (
    <div className="space-y-4">
      {/* Team sold count banner */}
      <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.15)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.2)' }}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
        </div>
        <div className="flex-1">
          <p className="text-emerald-300 text-sm font-semibold">{teamSoldCount} car{teamSoldCount!==1?'s':''} sold</p>
          <p className="text-emerald-600/60 text-xs">Live count · updates automatically when a listing is marked as sold</p>
        </div>
        <p className="text-3xl font-black grad-green tabular-nums">{teamSoldCount}</p>
      </div>

      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <div className="flex items-center justify-between gap-3 p-4" style={T.divider}>
          <div>
            <h2 className="font-semibold text-white">Salespeople</h2>
            <p className="text-xs text-gray-600 mt-0.5 hidden sm:block">{salespeople.length>0?`${activeCount} active · ${inactiveCount} inactive · ${activeRate}% active rate`:'Manage accounts, links, and status.'}</p>
          </div>
          <button onClick={()=>{setShowAddForm(true);resetForm();}} disabled={!managerDealership}
            className="btn-shimmer inline-flex items-center gap-2 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={T.btnRed}>
            <UserPlus className="w-4 h-4"/><span className="hidden sm:inline">Add Salesman</span><span className="sm:hidden">Add</span>
          </button>
        </div>

        {teamError && <div className="m-4 rounded-lg px-3 py-2.5 text-amber-300 text-xs" style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.14)' }}>⚠ {teamError}</div>}

        {loadingTeam ? (
          <div className="p-12 text-center text-gray-600 text-sm">Loading team...</div>
        ) : salespeople.length===0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background:'rgba(220,38,38,0.07)', border:'1px solid rgba(220,38,38,0.12)' }}><Users className="w-5 h-5 text-red-500/40"/></div>
            <p className="text-gray-600 text-sm mb-4">No salespeople added yet</p>
            <button onClick={()=>{setShowAddForm(true);resetForm();}} disabled={!managerDealership}
              className="btn-shimmer text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={T.btnRed}>Add your first salesman</button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {salespeople.map(s=>(
              <div key={s.id} className={`p-4 transition-colors ${s.is_active===false?'opacity-50':'hover:bg-white/[0.02]'}`}>
                <div className="flex items-start gap-3">
                  {s.avatar_url?<img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0"/>
                    :<div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background:'linear-gradient(135deg,#dc2626,#7c3aed)' }}>{(s.full_name||'S')[0].toUpperCase()}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-white truncate">{s.full_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${s.is_active!==false?'bg-emerald-400/10 text-emerald-400 border-emerald-400/20 badge-glow-cyan':'bg-white/5 text-gray-500 border-white/8'}`}>{s.is_active!==false?'Active':'Inactive'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-500">
                      <span className="truncate max-w-[200px]">{s.email}</span>
                      {s.phone&&<><span className="text-gray-700">·</span><span>{s.phone}</span></>}
                    </div>
                    {s.slug ? (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-400" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}><Link className="w-3 h-3 text-gray-600"/>/cars?ref=<span className="text-white font-medium">{s.slug}</span></div>
                        <button onClick={()=>copyLink(s)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white rounded-lg px-2 py-1.5 transition-all" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>
                          {copiedId===s.id?<><Check className="w-3 h-3 text-emerald-400"/><span className="text-emerald-400">Copied</span></>:<><Copy className="w-3 h-3"/>Copy</>}
                        </button>
                      </div>
                    ) : (
                      <div className="mb-3"><span className="text-xs text-amber-500/70 px-2.5 py-1.5 rounded-lg" style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.12)' }}>⚠ No slug — referral link unavailable</span></div>
                    )}
                    <div className="grid grid-cols-3 gap-2 max-w-xs">
                      {[[String(analyticsMap[s.slug]?.clicks||0),'Clicks'],[String(analyticsMap[s.slug]?.enquiries||0),'Enquiries'],[String(teamSoldCount),'Team Sales']].map(([v,lbl])=>(
                        <div key={lbl} className="rounded-lg px-2.5 py-2" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                          <p className={`text-sm font-bold ${lbl==='Team Sales'?'grad-green':lbl==='Enquiries'&&Number(v)>0?'grad-gold':'grad-white'}`}>{v}</p>
                          <p className="text-[10px] text-gray-600 mt-0.5">{lbl}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={()=>toggleActive(s)} disabled={togglingId===s.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white transition-all disabled:opacity-40"
                      style={{ border:'1px solid rgba(255,255,255,0.08)' }}>
                      {s.is_active!==false?<><ToggleRight className="w-3.5 h-3.5 text-emerald-400"/><span className="hidden sm:inline">Deactivate</span></>:<><ToggleLeft className="w-3.5 h-3.5 text-gray-600"/><span className="hidden sm:inline">Activate</span></>}
                    </button>
                    <button onClick={()=>setDeleteConfirmId(s.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-all" style={{ border:'1px solid rgba(220,38,38,0.18)' }}>
                      <Trash2 className="w-3.5 h-3.5"/><span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background:'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md" style={T.modal}>
            <div className="flex items-start justify-between mb-3">
              <div><h3 className="font-semibold text-white">Remove Salesman?</h3><p className="text-gray-500 text-xs mt-0.5">Deletes their account and referral link permanently.</p></div>
              <button onClick={()=>setDeleteConfirmId(null)} className="text-gray-500 hover:text-white p-1 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setDeleteConfirmId(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
              <button onClick={()=>deleteSalesman(deleteConfirmId)} className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background:'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col" style={T.modal}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={T.divider}>
              <div><h3 className="font-semibold text-white">Add Salesman</h3><p className="text-xs text-gray-500 mt-0.5">Create account and trackable referral link</p></div>
              <button onClick={()=>setShowAddForm(false)} className="text-gray-500 hover:text-white p-1 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {addSuccess ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.22)' }}><Check className="w-6 h-6 text-emerald-400"/></div>
                  <p className="text-emerald-400 font-semibold mb-1">Salesman added!</p>
                  <p className="text-gray-500 text-sm mb-6">{addSuccess}</p>
                  <div className="flex gap-3">
                    <button onClick={()=>setShowAddForm(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>Done</button>
                    <button onClick={resetForm} className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>Add Another</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Full Name *</label><input type="text" placeholder="Ahmad bin Abdullah" value={name} onChange={e=>handleNameChange(e.target.value)} autoComplete="off" className={iCls}/></div>
                    <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Email *</label><input type="email" placeholder="ahmad@autocity.my" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off" className={iCls}/></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Phone</label><input type="tel" placeholder="+60 12-345 6789" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="off" className={iCls}/></div>
                    <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Temp Password *</label><input type="text" placeholder="Min 8 characters" value={tempPw} onChange={e=>setTempPw(e.target.value)} autoComplete="off" className={iCls}/></div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Unique Slug *</label>
                    <div className="flex">
                      <span className="rounded-l-xl px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRight:'none' }}>/cars?ref=</span>
                      <input type="text" placeholder="ahmad" value={slug} onChange={e=>setSlug(slugify(e.target.value))} autoComplete="off" className="flex-1 rounded-r-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-red-600/50 transition-colors" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}/>
                    </div>
                    <p className="text-xs text-gray-700 mt-1">Auto-filled from first name. Lowercase + numbers only.</p>
                  </div>
                  {addError && <div className="rounded-xl px-3 py-2.5 text-red-400 text-xs" style={{ background:'rgba(220,38,38,0.07)', border:'1px solid rgba(220,38,38,0.18)' }}>⚠ {addError}</div>}
                  <div className="flex gap-3 pt-1">
                    <button onClick={()=>setShowAddForm(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
                    <button onClick={handleAdd} disabled={addLoading} className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40" style={T.btnRed}>{addLoading?'Creating...':'Add Salesman'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [listings,          setListings]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [activeTab,         setActiveTab]         = useState('listings');
  const [deleteId,          setDeleteId]          = useState(null);
  const [sidebarOpen,       setSidebarOpen]       = useState(false);
  const [tiktokListing,     setTiktokListing]     = useState(null);
  const [priceEditListing,  setPriceEditListing]  = useState(null);
  const [markSoldListing,   setMarkSoldListing]   = useState(null);  // ← NEW
  const [markSoldLoading,   setMarkSoldLoading]   = useState(false); // ← NEW
  const [profile,           setProfile]           = useState(null);
  const [updatingStatus,    setUpdatingStatus]    = useState(null);

  useEffect(() => {
    const s = document.createElement('style'); s.textContent = STYLES;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  useEffect(() => {
    document.title = t('dashboard.meta.title', { defaultValue: 'ShiftOS — Admin' });
  }, [t]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error||!data.session) { navigate('/login'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id',data.session.user.id).single();
      if (p) {
        if (p.role === 'salesman') { navigate('/salesman'); return; }
        if (!['dealer','superadmin','admin','manager'].includes(p.role)) { navigate('/login'); return; }
        setProfile(p);
      } else { navigate('/login'); return; }
    });
    supabase.from('car_listings').select('*').order('created_at',{ascending:false}).then(({data,error})=>{ setListings(error?[]:data||[]); setLoading(false); });
  }, [navigate]);

  useEffect(() => {
    const ch = supabase.channel('dash_listings')
      .on('postgres_changes',{event:'*',schema:'public',table:'car_listings'},payload=>{
        setListings(prev => {
          if (payload.eventType==='INSERT') return [payload.new,...prev];
          if (payload.eventType==='UPDATE') return prev.map(l=>l.id===payload.new.id?{...l,...payload.new}:l);
          if (payload.eventType==='DELETE') return prev.filter(l=>l.id!==payload.old.id);
          return prev;
        });
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const handleLogout    = async () => { await supabase.auth.signOut(); navigate('/login'); };
  const handleNew       = l => { setListings(p=>[l,...p]); setActiveTab('listings'); };
  const handleTabChange = t => { setActiveTab(t); setSidebarOpen(false); };
  const handleDelete    = async id => { const {error}=await supabase.from('car_listings').delete().eq('id',id); if (!error) setListings(p=>p.filter(l=>l.id!==id)); setDeleteId(null); };
  const handleStatus    = async (id, status) => { setUpdatingStatus(id); try { const {data,error}=await supabase.from('car_listings').update({status}).eq('id',id).select().single(); if (error) throw error; setListings(p=>p.map(l=>l.id===id?data:l)); } catch(e){console.error(e);} finally{setUpdatingStatus(null);} };
  const handlePriceSave = u => setListings(p=>p.map(l=>l.id===u.id?u:l));

  // ── Mark as Sold handler ──────────────────────────────────────────────────
  const handleMarkSold = async () => {
    if (!markSoldListing) return;
    setMarkSoldLoading(true);
    try {
      const { data, error } = await supabase
        .from('car_listings')
        .update({ status: 'sold' })
        .eq('id', markSoldListing.id)
        .select()
        .single();
      if (error) throw error;
      setListings(p => p.map(l => l.id === data.id ? data : l));
      setMarkSoldListing(null);
    } catch (e) { console.error(e); }
    setMarkSoldLoading(false);
  };

  const soldCount = listings.filter(l => l.status === 'sold').length;
  const totalVal  = listings.reduce((s,l)=>s+(l.selling_price||0),0);
  const avgPrice  = listings.length ? Math.round(totalVal/listings.length) : 0;
  const hotCount  = listings.filter(l=>l.original_price&&l.selling_price&&l.selling_price<=l.original_price*0.97).length;

  const STATUS = {
    active:   { label:'Active',   dot:'bg-emerald-400', cls:'bg-emerald-400/10 text-emerald-400 border-emerald-400/20 badge-glow-cyan', next:'reserved' },
    reserved: { label:'Reserved', dot:'bg-amber-400',   cls:'bg-amber-400/10 text-amber-400 border-amber-400/20 badge-glow-gold',        next:'sold' },
    sold:     { label:'Sold',     dot:'bg-red-400',     cls:'bg-red-400/10 text-red-400 border-red-400/20 badge-glow-red',               next:'active' },
  };

  const StatusBadge = ({ listing }) => {
    const s=listing.status||'active', cfg=STATUS[s]||STATUS.active, busy=updatingStatus===listing.id;
    return (
      <button onClick={()=>handleStatus(listing.id,cfg.next)} disabled={busy}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-all ${cfg.cls} ${busy?'opacity-50 cursor-wait':'hover:opacity-75 cursor-pointer'}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${busy?'animate-pulse bg-gray-400':cfg.dot}`}/>{busy?'…':cfg.label}
      </button>
    );
  };

  const Avatar = ({ size='md' }) => {
    const sz = size==='lg'?'w-9 h-9 text-sm':'w-7 h-7 text-xs';
    if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className={`${sz} rounded-full object-cover flex-shrink-0`}/>;
    return <div className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0`} style={{ background:'linear-gradient(135deg,#dc2626,#7c3aed)' }}>{(profile?.full_name||profile?.email||'A')[0].toUpperCase()}</div>;
  };

  const DiscountCell = ({ listing }) => {
    const op=listing.original_price||listing.previous_price||null, sp=listing.selling_price||listing.price||null;
    if (!op||!sp||op<=sp) return <span className="grad-white font-semibold text-sm">RM {sp?.toLocaleString()}</span>;
    const pct=Math.round(((op-sp)/op)*100), isHot=pct>=3;
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <span className="grad-white font-semibold text-sm">RM {sp.toLocaleString()}</span>
          <span className={`discount-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${isHot?'bg-red-500/15 text-red-400 border-red-500/25 hot-glow badge-glow-red':'bg-amber-500/15 text-amber-400 border-amber-500/25'}`}>
            {isHot&&<Flame className="w-3 h-3"/>}−{pct}%
          </span>
        </div>
        <p className="text-gray-600 text-xs line-through mt-0.5">RM {op.toLocaleString()}</p>
      </div>
    );
  };

  const condCls = c => ({ new:'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 badge-glow-cyan', recon:'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 badge-glow-cyan', used:'bg-white/[0.06] text-gray-400 border border-white/10' }[c]||'bg-white/[0.06] text-gray-400 border border-white/10');

  const TITLES = { listings:{title:'Listings',sub:'Manage your inventory'}, add:{title:'Add Listing',sub:'Upload a new car'}, team:{title:'Team',sub:'Manage salespeople'}, analytics:{title:'Analytics',sub:'Performance & AI advisor'} };
  const NAV = [
    { id:'listings',  Icon:Car,        label:'Listings',   badge:listings.length },
    { id:'add',       Icon:PlusCircle, label:'Add Listing' },
    { id:'analytics', Icon:BarChart2,  label:'Analytics' },
    { id:'team',      Icon:Users,      label:'Team' },
  ];

  // ── 5-column stat cards: added "Sold" ─────────────────────────────────────
  const STAT_CARDS = [
    { label:'Total Listings', val:listings.length,                    sub:'Active inventory',       grad:'grad-cyan',   Icon:Car,           glow:'rgba(103,232,249,0.13)' },
    { label:'Sold',           val:soldCount,                          sub:'Cars sold all time',     grad:'grad-green',  Icon:CheckCircle2,  glow:'rgba(110,231,183,0.13)' },
    { label:'Total Value',    val:`RM ${totalVal.toLocaleString()}`,   sub:'Combined price',         grad:'grad-purple', Icon:DollarSign,    glow:'rgba(216,180,254,0.13)' },
    { label:'Avg. Price',     val:`RM ${avgPrice.toLocaleString()}`,   sub:'Per vehicle',            grad:'grad-white',  Icon:TrendingUp,    glow:'rgba(255,255,255,0.06)' },
    { label:'Hot Deals',      val:hotCount, sub:hotCount>0?'On homepage':'No discounts', grad:hotCount>0?'grad-red':'', Icon:Flame, glow:hotCount>0?'rgba(248,113,113,0.18)':'rgba(255,255,255,0.03)' },
  ];

  return (
    <div className="min-h-screen text-white flex" style={{ fontFamily:"'DM Sans',sans-serif", background:'radial-gradient(ellipse 65% 40% at 0% 0%, rgba(220,38,38,0.06) 0%, transparent 55%), #09090b' }}>
      {sidebarOpen && <div className="fixed inset-0 bg-black/65 z-20 lg:hidden backdrop-blur-sm" onClick={()=>setSidebarOpen(false)}/>}

      {/* Sidebar */}
      <aside className={`fixed h-full z-30 flex flex-col w-60 transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen?'translate-x-0':'-translate-x-full'}`}
        style={{ background:'linear-gradient(155deg,#111118 0%,#0a0a0e 100%)', borderRight:'1px solid rgba(255,255,255,0.055)', boxShadow:'4px 0 28px rgba(0,0,0,0.65), inset -1px 0 0 rgba(220,38,38,0.07)' }}>

        <div className="px-5 py-5 flex items-center gap-3" style={T.divider}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#dc2626,#7c3aed)', boxShadow:'0 0 18px rgba(220,38,38,0.42), 0 2px 8px rgba(0,0,0,0.5)' }}>S</div>
          <div>
            <p className="font-black tracking-wider text-sm grad-red">ShiftOS</p>
            <p className="text-xs text-gray-600 mt-px">XDrive Admin</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-px mt-1">
          {NAV.map(({id,Icon,label,badge})=>(
            <button key={id} onClick={()=>handleTabChange(id)}
              className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab===id?'nav-active text-white':'text-gray-500 hover:text-white'}`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${activeTab===id?'text-red-400':''}`}/>
              {label}
              {badge!==undefined && <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums ${activeTab===id?'text-red-300 bg-red-950/70':'text-gray-600 bg-white/[0.05]'}`}>{badge}</span>}
            </button>
          ))}
          <a href="/" target="_blank" className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-white transition-all">
            <Home className="w-4 h-4 flex-shrink-0"/>View Site<Eye className="w-3 h-3 ml-auto opacity-40"/>
          </a>
        </nav>

        <div className="p-3" style={T.divider}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <Avatar size="lg"/><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{profile?.full_name||'—'}</p><p className="text-xs text-gray-600 truncate">{profile?.email||''}</p></div>
          </div>
          {profile?.dealership && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 mt-1 mx-1" style={{ background:'rgba(220,38,38,0.07)', border:'1px solid rgba(220,38,38,0.13)' }}>
              <Building2 className="w-3.5 h-3.5 text-red-500/60 flex-shrink-0"/><p className="text-xs font-semibold text-gray-300 truncate">{profile.dealership}</p>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-red-400 hover:bg-red-500/[0.06] transition-all mt-0.5"><LogOut className="w-4 h-4"/>Sign out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 lg:ml-60 min-w-0 flex flex-col">
        <div className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 backdrop-blur-xl"
          style={{ background:'rgba(9,9,11,0.92)', borderBottom:'1px solid rgba(255,255,255,0.05)', boxShadow:'0 1px 0 rgba(220,38,38,0.1)' }}>
          <button onClick={()=>setSidebarOpen(true)} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all"><Menu className="w-5 h-5"/></button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center font-black text-xs" style={{ background:'linear-gradient(135deg,#dc2626,#7c3aed)', boxShadow:'0 0 8px rgba(220,38,38,0.32)' }}>S</div>
            <span className="font-bold text-white text-sm tracking-tight">ShiftOS</span>
          </div>
          <span className="ml-1 text-gray-600 text-sm">{TITLES[activeTab]?.title}</span>
          <div className="ml-auto"><Avatar/></div>
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{TITLES[activeTab]?.title}</h1>
            <p className="text-gray-600 text-sm mt-0.5">{TITLES[activeTab]?.sub}</p>
            <div className="mt-4 h-px" style={{ background:'linear-gradient(90deg,rgba(220,38,38,0.32),rgba(56,189,248,0.18) 38%,transparent 68%)' }}/>
          </div>

          {activeTab==='listings' && (
            <>
              {/* ── 5-column stat grid ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {STAT_CARDS.map(({label,val,sub,grad,Icon,glow})=>(
                  <div key={label} className="stat-card card-top rounded-xl p-4 overflow-hidden" style={T.card}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(circle at 95% 5%, rgba(220,38,38,0.05) 0%, transparent 50%)' }}/>
                    <div className="flex items-center justify-between mb-3 relative">
                      <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">{label}</p>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:glow, boxShadow:`0 0 14px ${glow}` }}><Icon className="w-4 h-4 opacity-80"/></div>
                    </div>
                    <p className={`text-2xl sm:text-3xl font-black leading-none relative tabular-nums ${grad||'text-white'}`}>{val}</p>
                    <p className="text-xs text-gray-700 mt-2 hidden sm:block relative">{sub}</p>
                  </div>
                ))}
              </div>

              <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
                <div className="flex items-center justify-between p-4" style={T.divider}>
                  <h2 className="font-semibold text-white text-sm">All Vehicles <span className="text-gray-600 font-normal">({listings.length})</span></h2>
                  <button onClick={()=>setActiveTab('add')} className="btn-shimmer flex items-center gap-1.5 text-white px-3 py-1.5 rounded-lg text-sm font-semibold" style={T.btnRed}><PlusCircle className="w-3.5 h-3.5"/>Add</button>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-gray-600 text-sm">Loading…</div>
                ) : listings.length===0 ? (
                  <div className="p-12 text-center">
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background:'rgba(220,38,38,0.07)', border:'1px solid rgba(220,38,38,0.12)' }}><Car className="w-6 h-6 text-red-500/40"/></div>
                    <p className="text-gray-600 text-sm mb-4">No listings yet</p>
                    <button onClick={()=>setActiveTab('add')} className="btn-shimmer text-white px-5 py-2 rounded-lg text-sm font-semibold" style={T.btnRed}>Add your first car</button>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background:'rgba(255,255,255,0.02)', boxShadow:'inset 0 -1px 0 rgba(220,38,38,0.18)' }}>
                            {['Vehicle','Condition','Mileage','Location','Price','Listed','Status',''].map((h,i)=>(
                              <th key={i} className={`px-4 py-3 text-gray-600 font-semibold text-xs uppercase tracking-widest ${i===7?'text-right':'text-left'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {listings.map(l=>{
                            const age=getListingAge(l.created_at), bt=l.body_type||l.bodyType||null;
                            const isSold = l.status === 'sold';
                            return (
                              <tr key={l.id} className={`data-row ${age>=30&&!isSold?'bg-amber-950/[0.07]':''} ${isSold?'opacity-60':''}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    {l.images?.[0]?<img src={l.images[0]} alt="" className={`w-9 h-9 rounded-lg object-cover bg-gray-800 flex-shrink-0 ${isSold?'grayscale':''}`}/>:<div className="w-9 h-9 rounded-lg bg-white/5 flex-shrink-0"/>}
                                    <div className="min-w-0">
                                      <p className="font-semibold text-white text-sm truncate">{l.brand} {l.model}</p>
                                      <div className="flex items-center gap-1.5 mt-0.5"><p className="text-gray-600 text-xs truncate">{l.variant||'—'}</p>{bt&&<span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-gray-600">{bt}</span>}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${condCls(l.condition)}`}>{l.condition}</span></td>
                                <td className="px-4 py-3 text-gray-400 text-sm">{l.mileage?Number(l.mileage).toLocaleString()+' km':'—'}</td>
                                <td className="px-4 py-3 text-gray-400 text-sm">{l.state||'—'}</td>
                                <td className="px-4 py-3"><DiscountCell listing={l}/></td>
                                <td className="px-4 py-3"><AgeBadge createdAt={l.created_at}/></td>
                                <td className="px-4 py-3"><StatusBadge listing={l}/></td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-0.5 justify-end">
                                    {/* Mark as Sold button — only shows when NOT already sold */}
                                    {!isSold && (
                                      <button
                                        onClick={() => setMarkSoldListing(l)}
                                        title="Mark as Sold"
                                        className="sold-btn p-1.5 rounded-lg transition-all text-gray-600"
                                        style={{ border:'1px solid transparent' }}>
                                        <CheckCircle2 className="w-4 h-4"/>
                                      </button>
                                    )}
                                    <button onClick={()=>setPriceEditListing(l)} className="p-1.5 text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"><Tag className="w-4 h-4"/></button>
                                    <button onClick={()=>setTiktokListing(l)} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Video className="w-4 h-4"/></button>
                                    <button onClick={()=>setDeleteId(l.id)} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-white/[0.04]">
                      {listings.map(l=>{
                        const bt=l.body_type||l.bodyType||null;
                        const isSold = l.status === 'sold';
                        return (
                          <div key={l.id} className={`p-4 ${getListingAge(l.created_at)>=30&&!isSold?'bg-amber-950/[0.07]':''} ${isSold?'opacity-60':''}`}>
                            <div className="flex items-start gap-3">
                              {l.images?.[0]?<img src={l.images[0]} alt="" className={`w-14 h-14 rounded-xl object-cover bg-gray-800 flex-shrink-0 ${isSold?'grayscale':''}`}/>:<div className="w-14 h-14 rounded-xl bg-white/5 flex-shrink-0"/>}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-white text-sm leading-tight">{l.brand} {l.model}</p>
                                    <p className="text-gray-600 text-xs mt-0.5">{l.variant||'—'}{bt?` · ${bt}`:''}</p>
                                  </div>
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
                                    {!isSold && (
                                      <button onClick={()=>setMarkSoldListing(l)} title="Mark as Sold"
                                        className="sold-btn p-1.5 rounded-lg transition-all text-gray-600"
                                        style={{ border:'1px solid transparent' }}>
                                        <CheckCircle2 className="w-4 h-4"/>
                                      </button>
                                    )}
                                    <button onClick={()=>setPriceEditListing(l)} className="p-1.5 text-gray-600 hover:text-emerald-400 rounded-lg transition-all"><Tag className="w-4 h-4"/></button>
                                    <button onClick={()=>setTiktokListing(l)} className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg transition-all"><Video className="w-4 h-4"/></button>
                                    <button onClick={()=>setDeleteId(l.id)} className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg transition-all"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                                </div>
                                <div className="mb-2"><DiscountCell listing={l}/></div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${condCls(l.condition)}`}>{l.condition}</span>
                                  {l.mileage&&<span className="text-xs text-gray-400">{Number(l.mileage).toLocaleString()} km</span>}
                                  {l.state&&<span className="text-xs text-gray-400">{l.state}</span>}
                                  <AgeBadge createdAt={l.created_at}/>
                                  <StatusBadge listing={l}/>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab==='add' && (
            <div className="card-top rounded-xl p-4 sm:p-6" style={T.cardDark}>
              <CarForm onCreate={handleNew}/>
            </div>
          )}
          {activeTab==='analytics' && <AnalyticsTab listings={listings} profile={profile}/>}
          {activeTab==='team'      && <TeamTab managerDealership={profile?.dealership}/>}
        </div>
      </main>

      {/* Delete modal */}
      {deleteId && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background:'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md" style={T.modal}>
            <div className="flex items-start justify-between mb-3">
              <div><h3 className="font-semibold text-white">Delete Listing?</h3><p className="text-gray-500 text-xs mt-0.5">This cannot be undone.</p></div>
              <button onClick={()=>setDeleteId(null)} className="text-gray-500 hover:text-white p-1 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <p className="text-gray-400 text-sm mb-5">This will permanently remove the car listing from your inventory.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteId(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
              <button onClick={()=>handleDelete(deleteId)} className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {priceEditListing && <PriceEditModal listing={priceEditListing} onClose={()=>setPriceEditListing(null)} onSave={handlePriceSave}/>}
      {tiktokListing    && <TikTokGenerator listing={tiktokListing} onClose={()=>setTiktokListing(null)}/>}

      {/* Mark as Sold modal */}
      {markSoldListing && (
        <MarkSoldModal
          listing={markSoldListing}
          onClose={()=>setMarkSoldListing(null)}
          onConfirm={handleMarkSold}
          loading={markSoldLoading}
        />
      )}
    </div>
  );
}