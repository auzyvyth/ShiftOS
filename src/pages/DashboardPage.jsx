import React, { useEffect, useState, useRef, useMemo } from "react";
import SuspendedBanner from "../components/SuspendedBanner";
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush, ResponsiveContainer } from "recharts";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { getDealerIdFromProfile } from "../hooks/useProfile";
import { useRoleRedirect } from "../hooks/useRoleRedirect";
import CarForm from "../components/CarForm";
import CarFormFast from "../components/CarFormFast";
import TikTokStudioV3 from "../components/TikTokStudioV3";
import FinancingCalculator from "../components/FinancingCalculator";
import LeadsPage from "./LeadsPage";
import CRMPanel from "./CRMPanel";
import SciFiLoader from "../components/SciFiLoader";
import HeroSlidesPage from "./xdrive/HeroSlidesPage";
import RevOpsPage from "./RevOpsPage";
import ServicesPage from "./ServicesPage";
import { clearSiteProfileCache } from "../hooks/useSiteProfile";
import useSubscription from "../hooks/useSubscription";
import { normalizeMYPhone } from "../utils/phone";
import { getCategoryCfg } from "../utils/serviceCategories";
import { getEmbedUrl } from "../utils/videoEmbed";
import { useDealerSnapshot } from '../hooks/useDealerSnapshot';
import AISalesManager from '../components/AISalesManager';
import {
  Car,
  PlusCircle,
  LogOut,
  Home,
  Trash2,
  X,
  TrendingUp,
  DollarSign,
  Eye,
  Menu,
  Building2,
  Clock,
  Users,
  Copy,
  Check,
  Link,
  UserPlus,
  ToggleLeft,
  ToggleRight,
  Video,
  Tag,
  Flame,
  BarChart2,
  BarChart3,
  Send,
  Bot,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  MessageCircle,
  Phone,
  Pencil,
  Clipboard,
  Search,
  Settings,
  Save,
  Lock,
  Globe,
  Megaphone,
  Instagram,
  Facebook,
  Shield,
  KeyRound,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Palette,
  Inbox,
  Gauge,
  Droplets,
  MapPin,
  ChevronLeft,
  ZoomIn,
  Calculator,
  Bell,
  Package,
  Calendar,
  FileText,
  Banknote,
  Printer,
  CheckSquare,
  Wrench,
  Upload,
} from "lucide-react";

const SERVER_URL = "https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1";
const MAX_DEALERSHIP_CHANGES = 2;

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  .grad-red    { background: linear-gradient(135deg,#93c5fd,#fb923c); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-blue   { background: linear-gradient(135deg,#60a5fa,#3b82f6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-cyan   { background: linear-gradient(135deg,#67e8f9,#38bdf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-green  { background: linear-gradient(135deg,#6ee7b7,#34d399); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-purple { background: linear-gradient(135deg,#d8b4fe,#a78bfa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-gold   { background: linear-gradient(135deg,#fde68a,#fbbf24); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-white  { background: linear-gradient(135deg,#f8fafc,#94a3b8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }

  .card-top::before { content:''; position:absolute; top:0; left:16px; right:16px; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06) 35%,rgba(255,255,255,0.03) 65%,transparent); pointer-events:none; z-index:1; }
  .modal-top::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent 8%,rgba(255,255,255,0.07) 38%,rgba(255,255,255,0.04) 68%,transparent 92%); border-radius:16px 16px 0 0; pointer-events:none; z-index:2; }

  .nav-item { border-left:2px solid transparent; transition:all 0.15s; }
  .nav-item:hover:not(.nav-active) { background:rgba(255,255,255,0.04)!important; border-left-color:rgba(255,255,255,0.1); }
  .nav-active { background:rgba(220,38,38,0.08)!important; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-left:2px solid #dc2626!important; box-shadow:inset 0 1px 0 rgba(220,38,38,0.08),inset 0 -1px 0 rgba(0,0,0,0.1); }

  .stat-card { transition:transform 0.18s,box-shadow 0.18s; }
  .stat-card:hover { transform:translateY(-2px); box-shadow:0 14px 32px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.08); }

  .data-row { border-left:2px solid transparent; transition:background 0.12s,border-left-color 0.12s; }
  .data-row:hover { background:rgba(255,255,255,0.025)!important; border-left-color:rgba(255,255,255,0.12); }


  @keyframes hotpulse { 0%,100%{opacity:1}50%{opacity:.55} }
  .blue-glow { animation:hotpulse 2.2s ease-in-out infinite; }
  .blue-glow { animation:hotpulse 2.2s ease-in-out infinite; }

  .discount-chip { transition:box-shadow 0.15s; }
  .discount-chip:hover { box-shadow:0 0 10px rgba(255,255,255,0.08); }

  .btn-shimmer { position:relative; overflow:hidden; }
  .btn-shimmer::after { content:''; position:absolute; top:0; left:-80%; width:50%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent); animation:shimmer 3s ease infinite; }
  @keyframes shimmer { to { left:150%; } }

  .sold-btn:hover { background:rgba(34,197,94,0.15) !important; border-color:rgba(34,197,94,0.45) !important; color:#4ade80 !important; }

  .settings-section { position:relative; background:rgba(255,255,255,0.022); border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; }
  .settings-section::before { content:''; position:absolute; top:0; left:16px; right:16px; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06) 35%,rgba(255,255,255,0.03) 65%,transparent); pointer-events:none; }

  .table-wrap { position:relative; overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .table-wrap::after { content:''; position:absolute; top:0; right:0; bottom:0; width:28px; background:linear-gradient(to left,rgba(8,10,18,0.85),transparent); pointer-events:none; border-radius:0 8px 8px 0; }

  .glass { background:rgba(255,255,255,0.045); backdrop-filter:blur(24px) saturate(180%); -webkit-backdrop-filter:blur(24px) saturate(180%); border:1px solid rgba(255,255,255,0.1); box-shadow:0 8px 32px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.2); }
  .glass-blue { background:rgba(59,130,246,0.08); backdrop-filter:blur(24px) saturate(180%); -webkit-backdrop-filter:blur(24px) saturate(180%); border:1px solid rgba(59,130,246,0.18); box-shadow:0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(59,130,246,0.2),inset 0 -1px 0 rgba(0,0,0,0.15); }
  .glass-pill { background:rgba(255,255,255,0.08); backdrop-filter:blur(16px) saturate(160%); -webkit-backdrop-filter:blur(16px) saturate(160%); border:1px solid rgba(255,255,255,0.12); box-shadow:inset 0 1px 0 rgba(255,255,255,0.1),0 4px 16px rgba(0,0,0,0.3); }
  .glass-modal, .modal-top { background:rgba(8,12,22,0.75); backdrop-filter:blur(40px) saturate(200%); -webkit-backdrop-filter:blur(40px) saturate(200%); border:1px solid rgba(255,255,255,0.09); box-shadow:0 40px 80px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.08); }

  ::-webkit-scrollbar { width:4px; height:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:4px; }
  ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.2); }

  @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
`;

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
  modal: {
    position: 'relative',
    background: 'rgba(5,7,14,0.99)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
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
const taCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all resize-none";

// Inline SVG icon for the Hero Carousel sidebar nav item
const HeroCarouselIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
);

function getListingAge(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt)) / 86400000);
}

const AgeBadge = React.memo(function AgeBadge({ createdAt }) {
  const d = getListingAge(createdAt);
  if (d < 15)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
        <Clock className="w-3 h-3" />
        {d === 0 ? "Today" : `${d}d`}
      </span>
    );
  if (d < 25)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
        <Clock className="w-3 h-3" />
        {d}d
      </span>
    );
  if (d < 30)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-400/10 text-orange-400 border border-orange-400/20">
        <Clock className="w-3 h-3" />
        {d}d
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20">
      <Clock className="w-3 h-3" />
      {d}d
    </span>
  );
});

// ─── Sparkline ────────────────────────────────────────────────────────────────
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

function bucketByDay(events, eventTypes, days = 14) {
  const result = Array(days).fill(0);
  const now = Date.now();
  events.forEach(e => {
    if (!eventTypes.includes(e.event_type)) return;
    const daysAgo = Math.floor((now - new Date(e.created_at)) / 86400000);
    if (daysAgo < days) result[days - 1 - daysAgo]++;
  });
  return result;
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

// ─── Settings Section wrapper ─────────────────────────────────────────────────
function SettingsSection({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-blue-400",
  iconBg = "rgba(59,130,246,0.1)",
  iconBorder = "rgba(59,130,246,0.18)",
  children,
}) {
  return (
    <div className="settings-section">
      <div className="flex items-center gap-3 px-5 py-4" style={T.divider}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
        >
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div>
          <p className="text-white text-sm font-semibold">{title}</p>
          {subtitle && (
            <p className="text-gray-600 text-xs mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function SettingsField({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </label>
        {hint && <span className="text-xs text-gray-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── ProductsCatalogue ────────────────────────────────────────────────────────
const PRODUCT_CATEGORIES = [
  { value: 'protection',   label: 'Protection Film' },
  { value: 'window_tint',  label: 'Window Tint' },
  { value: 'warranty',     label: 'Extended Warranty' },
  { value: 'insurance',    label: 'Insurance' },
  { value: 'road_tax',     label: 'Road Tax' },
  { value: 'service',      label: 'Service Package' },
  { value: 'accessories',  label: 'Accessories' },
  { value: 'other',        label: 'Other' },
];

const PRODUCT_SEEDS = [
  { name: 'Paint Protection Film', category: 'protection',  selling_price: 800, cost_price: 400 },
  { name: 'Window Tint',           category: 'window_tint', selling_price: 350, cost_price: 150 },
  { name: 'Extended Warranty 1yr', category: 'warranty',    selling_price: 600, cost_price: 250 },
  { name: 'Insurance Referral',    category: 'insurance',   selling_price: 200, cost_price: 0   },
];

const EMPTY_PRODUCT_FORM = { name: '', category: 'protection', cost_price: '', selling_price: '', description: '', is_active: true };

function marginColor(sell, cost) {
  if (!sell) return '#6b7280';
  const pct = ((sell - cost) / sell) * 100;
  if (pct >= 40) return '#4ade80';
  if (pct >= 20) return '#fbbf24';
  return '#f87171';
}

function ProductsCatalogue({ dealerId }) {
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = add, obj = edit
  const [form, setForm]           = useState(EMPTY_PRODUCT_FORM);
  const [saving, setSaving]       = useState(false);
  const [stockCountMap, setStockCountMap] = useState({});

  const fetchProducts = async () => {
    if (!dealerId) return;
    setLoading(true);
    const [{ data }, { data: stockListings }] = await Promise.all([
      supabase.from('dealer_products').select('*').eq('dealer_id', dealerId).order('created_at', { ascending: false }),
      supabase.from('car_listings').select('included_services').eq('dealer_id', dealerId).neq('status', 'sold'),
    ]);
    setProducts(data || []);
    // Build per-product stock count
    const countMap = {};
    (stockListings || []).forEach(car => {
      (car.included_services || []).forEach(svc => {
        if (svc.id) countMap[svc.id] = (countMap[svc.id] || 0) + 1;
      });
    });
    setStockCountMap(countMap);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [dealerId]);

  const openAdd = () => { setForm(EMPTY_PRODUCT_FORM); setEditTarget(null); setShowModal(true); };
  const openEdit = (p) => { setForm({ name: p.name, category: p.category, cost_price: p.cost_price ?? '', selling_price: p.selling_price, description: p.description || '', is_active: p.is_active }); setEditTarget(p); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.selling_price) { toast.error('Name and selling price are required'); return; }
    setSaving(true);
    const payload = {
      dealer_id:     dealerId,
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
      setShowModal(false);
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

  const handleToggleActive = async (p) => {
    await supabase.from('dealer_products').update({ is_active: !p.is_active }).eq('id', p.id);
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
  };

  const seedProduct = async (seed) => {
    const payload = { dealer_id: dealerId, ...seed, description: null, is_active: true };
    await supabase.from('dealer_products').insert(payload);
    await fetchProducts();
    toast.success(`"${seed.name}" added`);
  };

  const catLabel = (v) => PRODUCT_CATEGORIES.find(c => c.value === v)?.label || v;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.025] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
            <Tag className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Services & Add-ons</p>
            {!loading && <p className="text-xs text-gray-600 mt-px">{products.length} product{products.length !== 1 ? 's' : ''} configured</p>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-xs text-gray-500">Products your dealership sells as add-ons</p>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 2px 8px rgba(220,38,38,0.25)' }}
            >
              <PlusCircle className="w-3 h-3" />Add Product
            </button>
          </div>

          {loading ? (
            <div className="px-5 pb-5 space-y-2">
              {[1,2].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="px-5 pb-5">
              <p className="text-xs text-gray-600 mb-3">Quick-start suggestions:</p>
              <div className="grid grid-cols-2 gap-2">
                {PRODUCT_SEEDS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => seedProduct(s)}
                    className="text-left p-3 rounded-lg border transition-all hover:border-red-600/30 hover:bg-red-600/[0.04]"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px dashed rgba(255,255,255,0.1)' }}
                  >
                    <p className="text-xs font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">RM {s.selling_price.toLocaleString()} selling</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 pb-5">
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                {/* Header row */}
                <div className="grid px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider hidden sm:grid" style={{ gridTemplateColumns: '1fr 110px 80px 80px 60px 64px 48px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.025)' }}>
                  <span>Name</span><span>Category</span><span>Cost</span><span>Sell</span><span>Margin</span><span>Active</span><span></span>
                </div>
                {products.map(p => {
                  const margin = p.selling_price ? (((p.selling_price - (p.cost_price || 0)) / p.selling_price) * 100).toFixed(1) : null;
                  const stockCount = stockCountMap[p.id] || 0;
                  return (
                    <div key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="grid items-center px-3 py-2.5" style={{ gridTemplateColumns: '1fr 110px 80px 80px 60px 64px 48px' }}>
                        <div className="min-w-0">
                          <span className="text-sm text-white font-medium truncate block">{p.name}</span>
                          {stockCount > 0 && (
                            <span className="text-[10px] text-cyan-400/70 font-medium">
                              In {stockCount} listing{stockCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{catLabel(p.category)}</span>
                        <span className="text-xs text-gray-500">{p.cost_price ? `RM ${Number(p.cost_price).toLocaleString()}` : '—'}</span>
                        <span className="text-xs text-gray-300">RM {Number(p.selling_price).toLocaleString()}</span>
                        <span className="text-xs font-semibold" style={{ color: marginColor(p.selling_price, p.cost_price || 0) }}>{margin ? `${margin}%` : '—'}</span>
                        <button onClick={() => handleToggleActive(p)} className="flex items-center">
                          {p.is_active
                            ? <ToggleRight className="w-5 h-5 text-green-400" />
                            : <ToggleLeft className="w-5 h-5 text-gray-600" />}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(p)} className="text-gray-600 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(p.id)} className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="w-full max-w-md rounded-xl relative" style={{ background: 'rgba(5,7,14,0.99)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 40px 80px rgba(0,0,0,0.8)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="font-semibold text-white text-sm">{editTarget ? 'Edit Product' : 'Add Product'}</p>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Paint Protection Film" className={iCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Category *</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={iCls} style={{ appearance: 'none' }}>
                  {PRODUCT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cost Price (RM)</label>
                  <input type="number" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))} placeholder="0" className={iCls} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Selling Price (RM) *</label>
                  <input type="number" value={form.selling_price} onChange={e => setForm(p => ({ ...p, selling_price: e.target.value }))} placeholder="0" className={iCls} min="0" />
                </div>
              </div>
              {form.selling_price && (
                <p className="text-xs" style={{ color: marginColor(Number(form.selling_price), Number(form.cost_price) || 0) }}>
                  Margin: {(((Number(form.selling_price) - (Number(form.cost_price) || 0)) / Number(form.selling_price)) * 100).toFixed(1)}%
                </p>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Short description…" rows={2} className={taCls} />
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-500">Active</span>
                <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))} className="flex items-center">
                  {form.is_active ? <ToggleRight className="w-6 h-6 text-green-400" /> : <ToggleLeft className="w-6 h-6 text-gray-600" />}
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-1"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SettingsTab ──────────────────────────────────────────────────────────────
function SettingsTab({ profile, onProfileUpdate }) {
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [errors, setErrors] = useState({});

  // Section states
  const [dealership, setDealership] = useState(profile?.dealership || "");
  const [siteName, setSiteName] = useState(profile?.site_name || "");
  const [brandColor, setBrandColor] = useState(
    profile?.brand_color || "#c9a84c",
  );
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number || "");
  const [contactEmail, setContactEmail] = useState(profile?.email || "");
  const [contactPhone, setContactPhone] = useState(profile?.phone || "+60");
  const [tiktok, setTiktok] = useState(profile?.social_tiktok || "");
  const [instagram, setInstagram] = useState(profile?.social_instagram || "");
  const [facebook, setFacebook] = useState(profile?.social_facebook || "");
  const [heroTitle, setHeroTitle] = useState(profile?.hero_title || "");
  const [heroSubtitle, setHeroSubtitle] = useState(
    profile?.hero_subtitle || "",
  );
  const [heroCta, setHeroCta] = useState(profile?.hero_cta_text || "");
  const [announcementText, setAnnouncementText] = useState(
    profile?.announcement_bar || "",
  );
  const [announcementOn, setAnnouncementOn] = useState(
    profile?.announcement_bar_enabled || false,
  );
  const [aboutText, setAboutText] = useState(profile?.about_text || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDanger, setShowDanger] = useState(false);
  const [tgToken, setTgToken] = useState(profile?.telegram_bot_token || "");
  const [tgChannel, setTgChannel] = useState(profile?.telegram_channel_id || "");
  const [tgAutoPost, setTgAutoPost] = useState(profile?.telegram_auto_post || false);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState(null);

  const [subdomain, setSubdomain] = useState(profile?.subdomain || '');
  const [subdomainStatus, setSubdomainStatus] = useState(null); // 'checking' | 'taken' | 'available' | 'unchanged'

  const sanitizeSubdomain = (val) =>
    val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const checkSubdomain = useDebouncedCallback(async (value) => {
    if (!value || value === profile?.subdomain) {
      setSubdomainStatus('unchanged');
      return;
    }
    setSubdomainStatus('checking');
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('subdomain', value)
      .neq('id', profile?.id)
      .maybeSingle();
    setSubdomainStatus(!error && data ? 'taken' : 'available');
  }, 500);

  const defaultSfWhy = { title: "", items: [{title:"",desc:""},{title:"",desc:""},{title:"",desc:""},{title:"",desc:""}] };
  const defaultSfHow = { title: "", steps: [{title:"",desc:""},{title:"",desc:""},{title:"",desc:""},{title:"",desc:""}] };
  const defaultSfTestimonials = [{name:"",location:"",text:""},{name:"",location:"",text:""},{name:"",location:"",text:""}];
  const defaultSfCta = { title: "", subtitle: "", primary_label: "", secondary_label: "" };

  const [sfWhy, setSfWhy] = useState(() => ({ ...defaultSfWhy, ...(profile?.storefront_why || {}), items: (profile?.storefront_why?.items || defaultSfWhy.items).map(i => ({...i})) }));
  const [sfHow, setSfHow] = useState(() => ({ ...defaultSfHow, ...(profile?.storefront_how || {}), steps: (profile?.storefront_how?.steps || defaultSfHow.steps).map(s => ({...s})) }));
  const [sfTestimonials, setSfTestimonials] = useState(() => (profile?.storefront_testimonials || defaultSfTestimonials).map(t => ({...t})));
  const [sfCta, setSfCta] = useState(() => ({ ...defaultSfCta, ...(profile?.storefront_cta || {}) }));

  // Hero video
  const [heroVideoEnabled, setHeroVideoEnabled] = useState(profile?.hero_video_enabled || false);
  const [heroVideoUrl, setHeroVideoUrl] = useState(profile?.hero_video_url || '');
  const [heroVideoTitle, setHeroVideoTitle] = useState(profile?.hero_video_title || '');

  // Sync all form fields whenever the profile prop changes.
  // useState initial values are only read on mount, so without this effect
  // the form would show stale data after a save (onProfileUpdate) or an
  // account switch where SettingsTab stays mounted.
  useEffect(() => {
    if (!profile) return;
    setDealership(profile.dealership || "");
    setSiteName(profile.site_name || "");
    setBrandColor(profile.brand_color || "#c9a84c");
    setWhatsapp(profile.whatsapp_number || "");
    setContactEmail(profile.email || "");
    setContactPhone(profile.phone || "");
    setTiktok(profile.social_tiktok || "");
    setInstagram(profile.social_instagram || "");
    setFacebook(profile.social_facebook || "");
    setHeroTitle(profile.hero_title || "");
    setHeroSubtitle(profile.hero_subtitle || "");
    setHeroCta(profile.hero_cta_text || "");
    setAnnouncementText(profile.announcement_bar || "");
    setAnnouncementOn(profile.announcement_bar_enabled || false);
    setAboutText(profile.about_text || "");
    setTgToken(profile.telegram_bot_token || "");
    setTgChannel(profile.telegram_channel_id || "");
    setTgAutoPost(profile.telegram_auto_post || false);
    setSubdomain(profile.subdomain || "");
    setSubdomainStatus(null);
    setSfWhy({ ...defaultSfWhy, ...(profile.storefront_why || {}), items: (profile.storefront_why?.items || defaultSfWhy.items).map(i => ({...i})) });
    setSfHow({ ...defaultSfHow, ...(profile.storefront_how || {}), steps: (profile.storefront_how?.steps || defaultSfHow.steps).map(s => ({...s})) });
    setSfTestimonials((profile.storefront_testimonials || defaultSfTestimonials).map(t => ({...t})));
    setSfCta({ ...defaultSfCta, ...(profile.storefront_cta || {}) });
    setHeroVideoEnabled(profile.hero_video_enabled || false);
    setHeroVideoUrl(profile.hero_video_url || '');
    setHeroVideoTitle(profile.hero_video_title || '');
  }, [profile]);

  useEffect(() => {
    setSubdomain(profile?.subdomain || '');
  }, [profile?.subdomain]);

  const changeCount = profile?.dealership_change_count || 0;
  const changesLeft = MAX_DEALERSHIP_CHANGES - changeCount;
  const dealershipLocked = changesLeft <= 0;

  const flash = (key) => {
    setSaved((p) => ({ ...p, [key]: true }));
    setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2500);
  };

  const saveSection = async (key, payload) => {
    setSaving((p) => ({ ...p, [key]: true }));
    setErrors((p) => ({ ...p, [key]: "" }));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .update({ ...payload, settings_updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw error;
      onProfileUpdate(data);
      clearSiteProfileCache(); // so public pages pick up new settings on next load
      flash(key);
    } catch (e) {
      setErrors((p) => ({ ...p, [key]: e.message }));
    }
    setSaving((p) => ({ ...p, [key]: false }));
  };

  const saveDealership = async () => {
    if (dealershipLocked) return;
    if (!dealership.trim()) {
      setErrors((p) => ({
        ...p,
        identity: "Dealership name cannot be empty.",
      }));
      return;
    }
    const dealershipChanged = dealership.trim() !== profile?.dealership;
    const payload = {
      dealership: dealership.trim(),
      site_name: siteName.trim() || dealership.trim(),
      brand_color: brandColor,
      subdomain,
      ...(subdomain !== profile?.subdomain && {
        subdomain_changed_at: new Date().toISOString(),
        previous_subdomain: profile?.subdomain,
      }),
    };
    // Only count toward the change limit if the dealership name itself changed
    if (dealershipChanged) {
      payload.dealership_change_count = changeCount + 1;
      payload.dealership_name_changed_at = new Date().toISOString();
    }
    await saveSection("identity", payload);
  };

  const saveContact = () =>
    saveSection("contact", {
      whatsapp_number: whatsapp.trim() ? normalizeMYPhone(whatsapp.trim()) : '',
      email: contactEmail.trim(),
      phone: contactPhone.trim() ? normalizeMYPhone(contactPhone.trim()) : '',
      social_tiktok: tiktok.trim(),
      social_instagram: instagram.trim(),
      social_facebook: facebook.trim(),
    });

  const saveTelegram = () =>
    saveSection("telegram", {
      telegram_bot_token: tgToken.trim(),
      telegram_channel_id: tgChannel.trim(),
      telegram_auto_post: tgAutoPost,
    });

  const testTelegram = async () => {
    if (!tgToken.trim() || !tgChannel.trim()) {
      setErrors((p) => ({ ...p, telegram: "Fill in bot token and channel ID first." }));
      return;
    }
    setTgTesting(true);
    setTgTestResult(null);
    setErrors((p) => ({ ...p, telegram: "" }));
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${tgToken.trim()}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: tgChannel.trim(),
            text: "✅ ShiftOS Telegram connected! Auto-posting is active.",
          }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setTgTestResult("ok");
      } else {
        setTgTestResult("fail");
        setErrors((p) => ({ ...p, telegram: data.description || "Test failed. Check token and channel ID." }));
      }
    } catch {
      setTgTestResult("fail");
      setErrors((p) => ({ ...p, telegram: "Network error. Check your token." }));
    }
    setTgTesting(false);
    setTimeout(() => setTgTestResult(null), 4000);
  };
  const saveFrontPage = () =>
    saveSection("frontpage", {
      hero_title: heroTitle.trim(),
      hero_subtitle: heroSubtitle.trim(),
      hero_cta_text: heroCta.trim(),
      announcement_bar: announcementText.trim(),
      announcement_bar_enabled: announcementOn,
      about_text: aboutText.trim(),
      hero_video_enabled: heroVideoEnabled,
      hero_video_url: heroVideoUrl.trim() || null,
      hero_video_title: heroVideoTitle.trim() || null,
    });

  const savePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setErrors((p) => ({
        ...p,
        password: "Password must be at least 8 characters.",
      }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors((p) => ({ ...p, password: "Passwords do not match." }));
      return;
    }
    setSaving((p) => ({ ...p, password: true }));
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setErrors((p) => ({ ...p, password: error.message }));
    } else {
      flash("password");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving((p) => ({ ...p, password: false }));
  };

  const saveStorefront = () =>
    saveSection("storefront", {
      storefront_why: sfWhy,
      storefront_how: sfHow,
      storefront_testimonials: sfTestimonials,
      storefront_cta: sfCta,
    });

  const SaveBtn = ({ sectionKey, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={saving[sectionKey] || disabled}
      className="btn-shimmer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
      style={
        saved[sectionKey]
          ? {
              background: "linear-gradient(135deg,#16a34a,#15803d)",
              boxShadow: "0 2px 10px rgba(22,163,74,0.28)",
            }
          : T.btnRed
      }
    >
      {saving[sectionKey] ? (
        <>
          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Saving…
        </>
      ) : saved[sectionKey] ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Saved!
        </>
      ) : (
        <>
          <Save className="w-3.5 h-3.5" />
          Save
        </>
      )}
    </button>
  );

  const ErrMsg = ({ k }) =>
    errors[k] ? (
      <p className="text-blue-400 text-xs mt-1.5 flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
        {errors[k]}
      </p>
    ) : null;

  return (
    <div className="space-y-4 max-w-2xl">
      {/* ── 1. Dealership Identity ── */}
      <SettingsSection
        title="Dealership Identity"
        subtitle="Your brand name, site title & accent colour"
        icon={Building2}
      >
        {/* Change count badge */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${dealershipLocked ? "text-blue-400" : changesLeft === 1 ? "text-amber-400" : "text-emerald-400"}`}
          style={{
            background: dealershipLocked
              ? "rgba(59,130,246,0.07)"
              : changesLeft === 1
                ? "rgba(251,191,36,0.07)"
                : "rgba(52,211,153,0.07)",
            border: `1px solid ${dealershipLocked ? "rgba(59,130,246,0.18)" : changesLeft === 1 ? "rgba(251,191,36,0.18)" : "rgba(52,211,153,0.18)"}`,
          }}
        >
          {dealershipLocked ? (
            <>
              <Lock className="w-3.5 h-3.5" />
              Dealership name is locked — contact support to change
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5" />
              {changesLeft} name change{changesLeft !== 1 ? "s" : ""} remaining
              — choose carefully
            </>
          )}
        </div>

        <SettingsField
          label="Dealership Name"
          hint={dealershipLocked ? "Locked" : `${changesLeft} left`}
        >
          <div className="relative">
            <input
              value={dealership}
              onChange={(e) => setDealership(e.target.value)}
              disabled={dealershipLocked}
              placeholder="e.g. Auto City Penang"
              className={`${iCls} ${dealershipLocked ? "opacity-40 cursor-not-allowed" : ""} pr-9`}
            />
            {dealershipLocked && (
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            )}
          </div>
        </SettingsField>

        {profile?.role !== 'superadmin' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Subdomain <span className="text-gray-500 text-xs">(your Drevo storefront URL)</span>
            </label>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex-1">
                <span className="px-3 text-gray-500 text-sm select-none border-r border-gray-700 py-2">xdrive.my/</span>
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => {
                    const clean = sanitizeSubdomain(e.target.value);
                    setSubdomain(clean);
                    checkSubdomain(clean);
                  }}
                  placeholder="your-dealership"
                  className="flex-1 bg-transparent py-2 px-3 text-white text-sm outline-none"
                />
              </div>
              {subdomainStatus === 'checking' && <span className="text-xs text-gray-500 whitespace-nowrap">Checking...</span>}
              {subdomainStatus === 'taken' && <span className="text-xs text-blue-400 whitespace-nowrap">⚠ Already taken</span>}
              {subdomainStatus === 'available' && <span className="text-xs text-green-400 whitespace-nowrap">✓ Available</span>}
            </div>
            {subdomain !== profile?.subdomain && profile?.subdomain && (
              <p className="text-xs text-yellow-400 mt-1">
                ⚠ Changing your subdomain will break existing links shared as <code className="text-yellow-300">xdrive.my/{profile.subdomain}</code>
              </p>
            )}
          </div>
        )}

        <SettingsField label="Site / Tab Name" hint="Shows in browser tab">
          <input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="e.g. Auto City — Used Cars Penang"
            className={iCls}
          />
        </SettingsField>

        <SettingsField
          label="Brand Accent Colour"
          hint="Used on your public site"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5 bg-white/5"
              />
            </div>
            <input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              placeholder="#c9a84c"
              className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono"
            />
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0 border border-white/10"
              style={{ background: brandColor }}
            />
          </div>
        </SettingsField>

        <ErrMsg k="identity" />
        <div className="flex justify-end pt-1">
          <SaveBtn
            sectionKey="identity"
            onClick={saveDealership}
            disabled={dealershipLocked || subdomainStatus === 'taken' || subdomainStatus === 'checking'}
          />
        </div>
      </SettingsSection>

      {/* ── 2. Contact & Socials ── */}
      <SettingsSection
        title="Contact & Socials"
        subtitle="What customers see when they click enquire or visit your profile"
        icon={Phone}
        iconColor="text-sky-400"
        iconBg="rgba(56,189,248,0.08)"
        iconBorder="rgba(56,189,248,0.18)"
      >
        <SettingsField label="WhatsApp Number" hint="Include country code">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm pointer-events-none">
              +60
            </span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="12-345 6789"
              className={`${iCls} pl-12`}
            />
          </div>
          <p className="text-xs text-gray-700 mt-1">
            This powers the WhatsApp enquiry button on every listing card.
          </p>
        </SettingsField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingsField label="Email Address">
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              type="email"
              placeholder="info@yourshowroom.com"
              className={iCls}
            />
          </SettingsField>
          <SettingsField label="Phone Number">
            <div className={`flex items-center overflow-hidden ${iCls}`} style={{ padding:0 }}>
              <span className="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-700 bg-gray-800/50 flex-shrink-0">+60</span>
              <input
                type="tel"
                value={(contactPhone||'').replace(/^\+?60/,'')}
                onChange={(e) => setContactPhone('+60'+e.target.value.replace(/\D/g,''))}
                placeholder="X-XXXXXXX"
                className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2.5"
              />
            </div>
          </SettingsField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SettingsField label="TikTok">
            <input
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="@yourhandle"
              className={iCls}
            />
          </SettingsField>
          <SettingsField label="Instagram">
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@yourhandle"
              className={iCls}
            />
          </SettingsField>
          <SettingsField label="Facebook">
            <input
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="page name or URL"
              className={iCls}
            />
          </SettingsField>
        </div>

        <ErrMsg k="contact" />
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="contact" onClick={saveContact} />
        </div>
      </SettingsSection>

      {/* ── 3. Front Page Control ── */}
      <SettingsSection
        title="Front Page Control"
        subtitle="Full control over what customers see on your public site"
        icon={Globe}
        iconColor="text-purple-400"
        iconBg="rgba(167,139,250,0.08)"
        iconBorder="rgba(167,139,250,0.18)"
      >
        {/* Announcement bar */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "rgba(56,189,248,0.04)",
            border: "1px solid rgba(56,189,248,0.1)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-sky-400" />
              <p className="text-white text-sm font-semibold">
                Announcement Bar
              </p>
            </div>
            <button
              onClick={() => setAnnouncementOn((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-all ${announcementOn ? "bg-blue-600" : "bg-white/10"}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${announcementOn ? "left-5" : "left-0.5"}`}
              />
            </button>
          </div>
          <input
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="🔥 Raya sale — all recon cars discounted this week!"
            className={iCls}
            disabled={!announcementOn}
            style={{ opacity: announcementOn ? 1 : 0.4 }}
          />
          <p className="text-xs text-gray-600">
            Shows as a sticky banner at the top of your public site when
            enabled.
          </p>
        </div>

        <SettingsField label="Hero Title" hint="Main headline">
          <input
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
            placeholder="Your Trusted Recon Specialist"
            className={iCls}
          />
        </SettingsField>

        <SettingsField label="Hero Subtitle" hint="Tagline under the title">
          <input
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
            placeholder="Quality cars at honest prices, based in Penang"
            className={iCls}
          />
        </SettingsField>

        <SettingsField label="CTA Button Text" hint="The main action button">
          <input
            value={heroCta}
            onChange={(e) => setHeroCta(e.target.value)}
            placeholder="Browse Our Cars"
            className={iCls}
          />
        </SettingsField>

        <SettingsField label="About Us" hint="Shown on your homepage">
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            rows={4}
            placeholder="Tell customers who you are, what you specialize in, and why they should buy from you..."
            className={taCls}
          />
          <p className="text-xs text-gray-700 mt-1">
            {aboutText.length}/500 characters
          </p>
        </SettingsField>

        {/* ── Hero Video ── */}
        <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: heroVideoEnabled ? 12 : 0 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#f3f4f6' }}>Frontpage Video Section</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Show a YouTube / TikTok video on your store's homepage</p>
            </div>
            <button
              type="button"
              onClick={() => setHeroVideoEnabled(p => !p)}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0, cursor: 'pointer', border: 'none',
                background: heroVideoEnabled ? '#dc2626' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: heroVideoEnabled ? 23 : 3, width: 18, height: 18,
                borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
          </div>
          {heroVideoEnabled && (
            <div className="space-y-2">
              <SettingsField label="Video Section Title" hint="e.g. 'See Our Cars in Action'">
                <input
                  value={heroVideoTitle}
                  onChange={e => setHeroVideoTitle(e.target.value)}
                  placeholder="See Our Cars in Action"
                  className={iCls}
                />
              </SettingsField>
              <SettingsField label="Video URL" hint="YouTube, TikTok, or Instagram">
                <input
                  type="url"
                  value={heroVideoUrl}
                  onChange={e => setHeroVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className={iCls}
                />
              </SettingsField>
              {heroVideoUrl && (() => {
                const embed = getEmbedUrl(heroVideoUrl);
                return embed
                  ? (
                    <div style={{ aspectRatio: '16/9', maxWidth: 360, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', marginTop: 8 }}>
                      <iframe src={embed} style={{ width: '100%', height: '100%' }} allowFullScreen title="Video preview" />
                    </div>
                  )
                  : <p style={{ fontSize: 11, color: '#fbbf24', marginTop: 4 }}>⚠ Could not parse URL. Paste a YouTube, TikTok, or Instagram link.</p>;
              })()}
            </div>
          )}
        </div>

        <ErrMsg k="frontpage" />
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="frontpage" onClick={saveFrontPage} />
        </div>
      </SettingsSection>

      {/* ── 4. Account / Password ── */}
      <SettingsSection
        title="Account Security"
        subtitle="Change your login password"
        icon={KeyRound}
        iconColor="text-amber-400"
        iconBg="rgba(251,191,36,0.08)"
        iconBorder="rgba(251,191,36,0.18)"
      >
        <SettingsField label="New Password">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min 8 characters"
            className={iCls}
          />
        </SettingsField>
        <SettingsField label="Confirm Password">
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            className={iCls}
          />
        </SettingsField>

        <ErrMsg k="password" />
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="password" onClick={savePassword} />
        </div>
      </SettingsSection>

      {/* ── 4. Telegram Auto-Post ── */}
      <SettingsSection
        title="Telegram Auto-Post"
        subtitle="Automatically post new listings to your Telegram channel"
        icon={Send}
        iconColor="text-sky-400"
        iconBg="rgba(56,189,248,0.08)"
        iconBorder="rgba(56,189,248,0.18)"
      >
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.1)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" />
              <p className="text-white text-sm font-semibold">Auto-Post New Listings</p>
            </div>
            <button
              onClick={() => setTgAutoPost((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-all ${tgAutoPost ? "bg-blue-600" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${tgAutoPost ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Every new car you add will be auto-posted to your Telegram channel with full details and photos.
          </p>
        </div>

        <SettingsField label="Bot Token" hint="From @BotFather">
          <input
            value={tgToken}
            onChange={(e) => setTgToken(e.target.value)}
            placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
            className={iCls}
            type="password"
            autoComplete="off"
          />
          <p className="text-xs text-gray-700 mt-1">
            Create a bot via <span className="text-sky-500">@BotFather</span> → /newbot → copy the token here.
          </p>
        </SettingsField>

        <SettingsField label="Channel ID" hint="e.g. @yourchannel or -1001234567890">
          <input
            value={tgChannel}
            onChange={(e) => setTgChannel(e.target.value)}
            placeholder="@autocitypenang"
            className={iCls}
          />
          <p className="text-xs text-gray-700 mt-1">
            Add your bot as <span className="text-white">Admin</span> to the channel first, then paste the username or numeric ID.
          </p>
        </SettingsField>

        <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Setup</p>
          {[
            "Open Telegram → search @BotFather → /newbot",
            "Copy the bot token and paste above",
            "Create or open your channel → Add Members → search your bot → make it Admin",
            "Paste your channel username (e.g. @mydealer) above",
            "Click Test Connection to verify, then Save",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-4 h-4 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-500 flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold">{i + 1}</span>
              <p className="text-xs text-gray-500 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        <ErrMsg k="telegram" />

        {tgTestResult === "ok" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-emerald-400" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            Test message sent! Check your Telegram channel.
          </div>
        )}

        <div className="flex items-center gap-3 pt-1 justify-end">
          <button
            onClick={testTelegram}
            disabled={tgTesting || !tgToken.trim() || !tgChannel.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-sky-400 disabled:onpacity-40 transition-all"
            style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)" }}
          >
            {tgTesting
              ? <><div className="w-3.5 h-3.5 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />Testing…</>
              : <><Send className="w-3.5 h-3.5" />Test Connection</>
            }
          </button>
          <SaveBtn sectionKey="telegram" onClick={saveTelegram} />
        </div>
      </SettingsSection>

      {/* ── 5. Storefront Content ── */}
      <SettingsSection
        title="Storefront Content"
        subtitle="Customise the Why, How It Works, Testimonials, and CTA sections on your public page"
        icon={Globe}
      >
        {/* Why section */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Why Choose Us</p>
        <input className={iCls} placeholder="Section title" value={sfWhy.title} onChange={e => setSfWhy(p => ({ ...p, title: e.target.value }))} />
        <div className="mt-3 space-y-3">
          {sfWhy.items.map((item, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input className={iCls} placeholder={`Item ${i+1} title`} value={item.title} onChange={e => setSfWhy(p => { const items = p.items.map((x,j) => j===i ? {...x, title: e.target.value} : x); return {...p, items}; })} />
              <input className={iCls} placeholder="Description" value={item.desc} onChange={e => setSfWhy(p => { const items = p.items.map((x,j) => j===i ? {...x, desc: e.target.value} : x); return {...p, items}; })} />
            </div>
          ))}
        </div>

        {/* How It Works */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-5 mb-2">How It Works</p>
        <input className={iCls} placeholder="Section title" value={sfHow.title} onChange={e => setSfHow(p => ({ ...p, title: e.target.value }))} />
        <div className="mt-3 space-y-3">
          {sfHow.steps.map((step, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input className={iCls} placeholder={`Step ${i+1} title`} value={step.title} onChange={e => setSfHow(p => { const steps = p.steps.map((x,j) => j===i ? {...x, title: e.target.value} : x); return {...p, steps}; })} />
              <input className={iCls} placeholder="Description" value={step.desc} onChange={e => setSfHow(p => { const steps = p.steps.map((x,j) => j===i ? {...x, desc: e.target.value} : x); return {...p, steps}; })} />
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-5 mb-2">Testimonials</p>
        <div className="space-y-4">
          {sfTestimonials.map((t, i) => (
            <div key={i} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className={iCls} placeholder="Name" value={t.name} onChange={e => setSfTestimonials(p => p.map((x,j) => j===i ? {...x, name: e.target.value} : x))} />
                <input className={iCls} placeholder="Location" value={t.location} onChange={e => setSfTestimonials(p => p.map((x,j) => j===i ? {...x, location: e.target.value} : x))} />
              </div>
              <textarea className={iCls} rows={2} placeholder="Testimonial text" value={t.text} onChange={e => setSfTestimonials(p => p.map((x,j) => j===i ? {...x, text: e.target.value} : x))} style={{ resize: "vertical" }} />
            </div>
          ))}
        </div>

        {/* CTA */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-5 mb-2">Call to Action</p>
        <div className="space-y-2">
          <input className={iCls} placeholder="CTA title" value={sfCta.title} onChange={e => setSfCta(p => ({ ...p, title: e.target.value }))} />
          <input className={iCls} placeholder="Subtitle" value={sfCta.subtitle} onChange={e => setSfCta(p => ({ ...p, subtitle: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className={iCls} placeholder="Primary button label" value={sfCta.primary_label} onChange={e => setSfCta(p => ({ ...p, primary_label: e.target.value }))} />
            <input className={iCls} placeholder="Secondary button label" value={sfCta.secondary_label} onChange={e => setSfCta(p => ({ ...p, secondary_label: e.target.value }))} />
          </div>
        </div>

        <div className="pt-2">
          <SaveBtn sectionKey="storefront" onClick={saveStorefront} />
          <ErrMsg k="storefront" />
        </div>
      </SettingsSection>

      {/* ── 6. Services & Add-ons ── */}
      <ProductsCatalogue dealerId={getDealerIdFromProfile(profile)} />

      {/* ── 7. Danger Zone ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: "1px solid rgba(59,130,246,0.22)",
          background: "rgba(59,130,246,0.03)",
        }}
      >
        <button
          onClick={() => setShowDanger((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-500/[0.04] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.22)",
              }}
            >
              <AlertTriangle className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-blue-400 text-sm font-semibold">Danger Zone</p>
          </div>
          {showDanger ? (
            <ChevronUp className="w-4 h-4 text-blue-500/50" />
          ) : (
            <ChevronDown className="w-4 h-4 text-blue-500/50" />
          )}
        </button>

        {showDanger && (
          <div
            className="px-5 pb-5 space-y-4"
            style={{ borderTop: "1px solid rgba(59,130,246,0.12)" }}
          >
            <p className="text-gray-500 text-xs pt-4">
              Deleting your account is permanent and cannot be undone. All your
              listings, team, and data will be removed.
            </p>
            <SettingsField label={`Type "DELETE" to confirm`}>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className={iCls}
              />
            </SettingsField>
            <button
              disabled={deleteConfirm !== "DELETE"}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-30 transition-all"
              style={{
                background: "linear-gradient(135deg,#3b82f6,#1e40af)",
                border: "1px solid rgba(59,130,246,0.3)",
              }}
            >
              Permanently Delete Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PriceEditModal ───────────────────────────────────────────────────────────
function PriceEditModal({ listing, onClose, onSave }) {
  const cur = listing.selling_price || 0;
  const orig = listing.original_price || null;
  const [np, setNp] = useState(String(cur));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const npv = parseFloat(np) || 0;
  const ref = orig || cur;
  const disc = ref > npv ? ref - npv : 0;
  const pct = ref > 0 ? (disc / ref) * 100 : 0;
  const isHot = pct >= 3,
    isUp = npv > cur,
    isReset = orig && npv >= orig;

  const handleSave = async () => {
    setErr("");
    if (!npv || npv <= 0) {
      setErr("Enter a valid price");
      return;
    }
    if (npv === cur) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      let payload = { selling_price: npv };
      if (isReset) payload.original_price = null;
      else if (!orig && npv < cur) payload.original_price = cur;
      const { data, error } = await supabase
        .from("car_listings")
        .update(payload)
        .eq("id", listing.id)
        .select();
      if (error) throw error;
      onSave(data?.[0] ?? { ...listing, ...payload });
      onClose();
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}
    >
      <div
        className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden"
        style={undefined}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={T.divider}
        >
          <div>
            <h3 className="font-semibold text-white">Adjust Price</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {listing.brand} {listing.model} {listing.variant || ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Current price</span>
            <div className="flex items-center gap-2">
              {orig && (
                <span className="text-gray-600 line-through text-xs">
                  RM {orig.toLocaleString()}
                </span>
              )}
              <span className="font-semibold grad-white">
                RM {cur.toLocaleString()}
              </span>
              {orig && (
                <span className="text-blue-400 text-xs font-medium bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                  -{Math.round(((orig - cur) / orig) * 100)}%
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              New Selling Price (RM)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">
                RM
              </span>
              <input
                type="number"
                value={np}
                onChange={(e) => {
                  setNp(e.target.value);
                  setErr("");
                }}
                min="0"
                autoFocus
                className="w-full pl-12 pr-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white text-lg font-semibold focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/15 transition-all"
              />
            </div>
          </div>
          {npv > 0 && npv !== cur && (
            <div
              className={`px-4 py-3 rounded-xl border text-sm ${isReset ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" : isUp ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : isHot ? "bg-blue-500/10 border-red-500/20 text-blue-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}
            >
              {isReset && (
                <p className="font-medium">
                  Price raised — discount badge removed
                </p>
              )}
              {!isReset && isUp && (
                <p className="font-medium">
                  Price raised by RM {(npv - cur).toLocaleString()}
                </p>
              )}
              {!isReset && !isUp && (
                <>
                  <div className="flex items-center gap-2 font-semibold">
                    {isHot && <Flame className="w-4 h-4" />}
                    <span>
                      RM {disc.toLocaleString()} off ({pct.toFixed(1)}%)
                    </span>
                    {isHot && (
                      <span className="text-xs font-normal">Hot Deal!</span>
                    )}
                  </div>
                  <p className="text-xs opacity-70 mt-1">
                    {!orig
                      ? "Original price locked automatically"
                      : "Original stays locked"}
                  </p>
                  {isHot && (
                    <p className="text-xs opacity-70 mt-0.5">
                      Moves to Hot Deals
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {err && (
            <p className="text-blue-400 text-xs bg-blue-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              ⚠ {err}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.09)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !npv || npv <= 0}
              className="btn-shimmer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-40 rounded-xl text-sm text-white font-semibold"
              style={T.btnRed}
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Price"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MarkSoldModal ────────────────────────────────────────────────────────────
function MarkSoldModal({ listing, onClose, onConfirm, loading }) {
  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}
    >
      <div
        className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
        style={undefined}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white">Mark as Sold?</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              {listing.brand} {listing.model} {listing.variant || ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
          style={{
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.18)",
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-emerald-300 text-sm font-semibold">
              Sold count will update automatically
            </p>
            <p className="text-emerald-500/60 text-xs mt-0.5">
              This listing moves to "Sold" and the sold counter updates in
              real-time.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn-shimmer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg,#16a34a,#15803d)",
              boxShadow: "0 2px 10px rgba(22,163,74,0.3)",
            }}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Marking…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm Sold
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AnalyticsTab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ listings, profile, onEditListing, onStaleAdjusted, adjustedStaleIds }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I'm your performance advisor. I can see your inventory and help with pricing, leads, and conversions. What would you like to know?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const endRef = useRef(null);
  useEffect(() => {
    if (chatOpen) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  useEffect(() => {
    if (!profile?.id) return;
    const dealerId = getDealerIdFromProfile(profile);
    if (!dealerId) return;
    // Also pull events where dealer_id is null but car_id belongs to this dealer
    // (covers main-domain visits where dealer_id wasn't attached to store_visit)
    Promise.all([
      supabase
        .from("analytics_events")
        .select("*")
        .eq("dealer_id", dealerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("car_listings")
        .select("id")
        .eq("dealer_id", dealerId)
        .in("status", ["available", "reserved", "sold"]),
    ]).then(([eventsRes, listingsRes]) => {
      const directEvents = eventsRes.data || [];
      const dealerCarIds = new Set((listingsRes.data || []).map(l => l.id));
      // No-dealer_id events that reference one of this dealer's cars (deduped by id)
      const seenIds = new Set(directEvents.map(e => e.id));
      setEvents(directEvents);
      setEventsLoading(false);
      // Fetch orphan events (null dealer_id but car_id matches) separately to avoid large OR query
      if (dealerCarIds.size > 0) {
        supabase
          .from("analytics_events")
          .select("*")
          .is("dealer_id", null)
          .in("car_id", [...dealerCarIds])
          .order("created_at", { ascending: false })
          .then(({ data }) => {
            const extras = (data || []).filter(e => !seenIds.has(e.id));
            if (extras.length > 0) setEvents(prev => [...prev, ...extras]);
          });
      }
    });
  }, [profile?.id]);
  const totalClicks = events.filter(
    (e) => e.event_type === "link_visit" || e.event_type === "car_view" || e.event_type === "card_click",
  ).length;
  const totalWa = events.filter(
    (e) => e.event_type === "whatsapp_click",
  ).length;
  const totalCalls = events.filter((e) => e.event_type === "call_click").length;
  const totalBookings = events.filter((e) => e.event_type === "booking_click").length;
  const storeVisits = events.filter((e) =>
    e.event_type === "store_visit" || e.event_type === "car_view" || e.event_type === "page_view"
  ).length;

  const buildDailyChart = (evts, days = 30) => {
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
      const dayEvents = evts.filter(e => e.created_at?.slice(0, 10) === dateStr);
      result.push({
        date:     label,
        visits:   dayEvents.filter(e => ['store_visit', 'car_view', 'page_view'].includes(e.event_type)).length,
        clicks:   dayEvents.filter(e => ['link_visit', 'card_click'].includes(e.event_type)).length,
        whatsapp: dayEvents.filter(e => e.event_type === 'whatsapp_click').length,
        calls:    dayEvents.filter(e => e.event_type === 'call_click').length,
        bookings: dayEvents.filter(e => e.event_type === 'booking_click').length,
      });
    }
    return result;
  };

  const dailyChart = useMemo(() => buildDailyChart(events), [events]);

  const carStatsMap = useMemo(() => {
    const map = {};
    events.forEach(e => {
      if (!e.car_id) return;
      if (!map[e.car_id]) map[e.car_id] = { views: 0, whatsapp: 0, calls: 0, bookings: 0 };
      if (['car_view', 'link_visit', 'card_click'].includes(e.event_type)) map[e.car_id].views++;
      if (e.event_type === 'whatsapp_click') map[e.car_id].whatsapp++;
      if (e.event_type === 'call_click') map[e.car_id].calls++;
      if (e.event_type === 'booking_click') map[e.car_id].bookings++;
    });
    Object.values(map).forEach(s => {
      const leads = s.whatsapp + s.calls;
      s.cvr = s.views > 0 ? ((leads / s.views) * 100).toFixed(1) + '%' : '—';
    });
    return map;
  }, [events]);

  const bySlug = events.reduce((acc, e) => {
    if (!acc[e.salesman_slug])
      acc[e.salesman_slug] = { clicks: 0, whatsapp: 0 };
    if (e.event_type === "link_visit" || e.event_type === "car_view")
      acc[e.salesman_slug].clicks++;
    if (e.event_type === "whatsapp_click")
      acc[e.salesman_slug].whatsapp++;
    return acc;
  }, {});
  const topSalesmen = Object.entries(bySlug).sort(
    (a, b) => b[1].whatsapp - a[1].whatsapp,
  );

  const total = listings.length;
  const active = listings.filter(
    (l) => (l.status || 'available') === 'available',
  ).length;
  const sold = listings.filter((l) => l.status === "sold").length;
  const hot = listings.filter((l) => {
    const op = l.original_price,
      sp = l.selling_price;
    return op && sp && sp <= op * 0.97;
  }).length;
  const avgAge = total
    ? Math.round(
        listings.reduce((s, l) => s + getListingAge(l.created_at), 0) / total,
      )
    : 0;
  const stale = listings.filter(
    (l) =>
      getListingAge(l.created_at) >= 30 && (l.status || 'available') === 'available',
  );

  const ctx = () => {
    const s = listings
      .slice(0, 20)
      .map(
        (l) =>
          `${l.brand} ${l.model}|RM${l.selling_price?.toLocaleString()}|${getListingAge(l.created_at)}d|${l.status || "available"}|${l.condition}|${l.mileage ? l.mileage.toLocaleString() + "km" : "-"}|${l.state || "-"}${l.original_price ? `|was RM${l.original_price.toLocaleString()}` : ""}`,
      )
      .join("\n");
    return `AI performance advisor for ShiftOS, Malaysian car dealer SaaS.\nDealer: ${profile?.dealership || "Unknown"}. Total:${total} Active:${active} Sold:${sold} HotDeals:${hot} AvgAge:${avgAge}d Stale:${stale.length}\nListings:\n${s}\nBe concise, actionable. Under 200 words.`;
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const history = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: msg },
      ];
      const res = await fetch(`${SERVER_URL}/ai/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: ctx(),
          messages: history,
        }),
      });
      const data = await res.json();
      let reply = "Could not generate a response.";
      if (Array.isArray(data?.content))
        reply = data.content.find((b) => b.type === "text")?.text || reply;
      else if (data?.completion) reply = data.completion;
      setMessages((p) => [...p, { role: "assistant", content: reply }]);
    } catch {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "Connection error. Try again." },
      ]);
    }
    setLoading(false);
  };

  const PROMPTS = [
    "Why aren't my listings converting?",
    "Which car should I reprice?",
    "Any I should remove?",
    "How to write better listings?",
  ];
  const kpis = [
    {
      label: "Active",
      val: active,
      sub: `of ${total} total`,
      grad: "grad-cyan",
      icon: <Car className="w-4 h-4" />,
      glow: "rgba(103,232,249,0.14)",
    },
    {
      label: "Sold",
      val: sold,
      sub: "all time",
      grad: "grad-green",
      icon: <CheckCircle2 className="w-4 h-4" />,
      glow: "rgba(110,231,183,0.14)",
      spark: Array(14).fill(0),
      sparkColor: '#34d399',
    },
    {
      label: "Avg. Age",
      val: `${avgAge}d`,
      sub: avgAge >= 30 ? "⚠ Aging" : "Healthy",
      grad: avgAge >= 30 ? "grad-gold" : "grad-white",
      icon: <Clock className="w-4 h-4" />,
      glow: avgAge >= 30 ? "rgba(251,191,36,0.14)" : "rgba(255,255,255,0.03)",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {kpis.map(({ label, val, sub, grad, icon, glow, spark, sparkColor }) => (
          <div
            key={label}
            className="stat-card card-top rounded-2xl overflow-hidden glass"
            style={{ position: 'relative' }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 100% 0%, rgba(59,130,246,0.05) 0%, transparent 55%)`,
              }}
            />
            {spark && (
              <div className="relative px-3.5 pt-3">
                <Sparkline data={spark} color={sparkColor || '#3b82f6'} width={120} height={32} />
              </div>
            )}
            <div className={spark ? 'p-3 sm:p-4 pt-2 relative' : 'p-3 sm:p-4 relative'}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">
                  {label}
                </p>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: glow, boxShadow: `0 0 12px ${glow}` }}
                >
                  {icon}
                </div>
              </div>
              <p
                className={`text-xl sm:text-3xl font-black leading-none tabular-nums ${grad || "text-white"}`}
              >
                {val}
              </p>
              <p className="text-xs text-gray-700 mt-1.5 hidden sm:block">
                {sub}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        {/* Header + summary pills */}
        <div className="flex items-center justify-between p-4 flex-wrap gap-3" style={T.divider}>
          <div>
            <h2 className="font-semibold text-white text-sm">Engagement Overview</h2>
            <p className="text-xs text-gray-600 mt-0.5">Last 30 days · drag the range slider to zoom into any period</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Page Visits', val: storeVisits,   color: '#94a3b8' },
              { label: 'Clicks',      val: totalClicks,   color: '#67e8f9' },
              { label: 'WhatsApp',    val: totalWa,       color: '#4ade80' },
              { label: 'Bookings',    val: totalBookings, color: '#fbbf24' },
              { label: 'Calls',       val: totalCalls,    color: '#c084fc' },
            ].map(({ label, val, color }) => (
              <div key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs font-bold text-white tabular-nums">
                  {eventsLoading ? '…' : val}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Chart */}
        <div className="p-4 pt-2">
          {eventsLoading ? (
            <div className="flex items-center justify-center h-52 text-gray-600 text-sm">Loading chart…</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#4b5563' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f1117',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: '#e5e7eb' }}
                  labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
                  cursor={{ stroke: 'rgba(59,130,246,0.2)', strokeWidth: 1 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }}
                />
                <Brush
                  dataKey="date"
                  height={20}
                  stroke="rgba(59,130,246,0.3)"
                  fill="rgba(59,130,246,0.05)"
                  travellerWidth={6}
                  startIndex={Math.max(0, dailyChart.length - 14)}
                />
                <Line type="monotone" dataKey="visits"   stroke="#94a3b8" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="clicks"   stroke="#67e8f9" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="whatsapp" stroke="#4ade80" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="bookings" stroke="#fbbf24" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="calls"    stroke="#c084fc" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {topSalesmen.length > 0 && (
        <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
          <div className="flex items-center gap-2 p-4" style={T.divider}>
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <p className="font-semibold text-white text-sm">
              Salesman Performance
            </p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {topSalesmen.map(([slug, { clicks, whatsapp }], i) => (
              <div key={slug} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs text-gray-600 w-4 tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    /{slug}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">
                      <span className="text-sky-400 font-semibold">
                        {clicks}
                      </span>{" "}
                      clicks
                    </span>
                    <span className="text-xs text-gray-500">
                      <span className="text-green-400 font-semibold">
                        {whatsapp}
                      </span>{" "}
                      whatsapp
                    </span>
                  </div>
                </div>
                {whatsapp > 0 && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: "rgba(74,222,128,0.1)",
                      border: "1px solid rgba(74,222,128,0.2)",
                      color: "#4ade80",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {(() => {
        const visibleStale = stale.filter(l => !(adjustedStaleIds || new Set()).has(l.id));
        const adjustedStale = stale.filter(l => (adjustedStaleIds || new Set()).has(l.id));
        return (
          <>
            {visibleStale.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(251,191,36,0.04)",
                  border: "1px solid rgba(251,191,36,0.12)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <p className="text-amber-300 text-sm font-semibold">
                    {visibleStale.length} listing{visibleStale.length > 1 ? "s" : ""} aging 30+ days — needs attention
                  </p>
                </div>
                <div className="space-y-2">
                  {visibleStale.slice(0, 5).map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between py-2"
                      style={{ borderBottom: "1px solid rgba(251,191,36,0.07)" }}
                    >
                      <div className="flex items-center gap-3">
                        {l.images?.[0] ? (
                          <img
                            src={l.images[0]}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover bg-gray-800 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-white text-sm font-medium">
                            {l.brand} {l.model}
                          </p>
                          <p className="text-gray-500 text-xs">
                            RM {l.selling_price?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-xs font-semibold bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                          {getListingAge(l.created_at)}d
                        </span>
                        {onEditListing && (
                          <button
                            onClick={() => {
                              onEditListing(l);
                            }}
                            className="text-xs font-semibold px-3 py-1 rounded-lg transition-all"
                            style={{
                              background: "rgba(59,130,246,0.1)",
                              border: "1px solid rgba(59,130,246,0.25)",
                              color: "#93c5fd",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.2)"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.45)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(59,130,246,0.1)"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.25)"; }}
                          >
                            Adjust
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {adjustedStale.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(34,197,94,0.03)",
                  border: "1px solid rgba(34,197,94,0.15)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-emerald-300 text-sm font-semibold">
                    {adjustedStale.length} listing{adjustedStale.length > 1 ? "s" : ""} adjusted — 30+ days old, repriced or updated
                  </p>
                </div>
                <div className="space-y-2">
                  {adjustedStale.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between py-2"
                      style={{ borderBottom: "1px solid rgba(34,197,94,0.07)" }}
                    >
                      <div className="flex items-center gap-3">
                        {l.images?.[0] ? (
                          <img
                            src={l.images[0]}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover bg-gray-800 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-white text-sm font-medium">
                            {l.brand} {l.model}
                          </p>
                          <p className="text-gray-500 text-xs">
                            RM {l.selling_price?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-xs font-semibold bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                          {getListingAge(l.created_at)}d · adjusted
                        </span>
                        {onEditListing && (
                          <button
                            onClick={() => onEditListing(l)}
                            className="text-xs px-2.5 py-1 rounded-lg transition-all"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "#6b7280",
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = "#e5e7eb"}
                            onMouseLeave={e => e.currentTarget.style.color = "#6b7280"}
                          >
                            Edit again
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <style>{`
          .lp-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.05); }
          /* ── desktop table ── */
          .lp-table-wrap { display:block; }
          .lp-table { width:100%; border-collapse:collapse; table-layout:fixed; }
          .lp-table colgroup col:nth-child(1) { width:22%; }
          .lp-table colgroup col:nth-child(2) { width:14%; }
          .lp-table colgroup col:nth-child(3) { width:9%; }
          .lp-table colgroup col:nth-child(4) { width:9%; }
          .lp-table colgroup col:nth-child(5) { width:10%; }
          .lp-table colgroup col:nth-child(6) { width:9%; }
          .lp-table colgroup col:nth-child(7) { width:10%; }
          .lp-table colgroup col:nth-child(8) { width:8%; }
          .lp-table colgroup col:nth-child(9) { width:9%; }
          .lp-th { padding:10px 14px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:rgba(107,114,128,0.8); text-align:left; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05); }
          .lp-row { border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.15s; }
          .lp-row:last-child { border-bottom:none; }
          .lp-row:hover { background:rgba(255,255,255,0.025); }
          .lp-row.stale { background:rgba(251,191,36,0.03); }
          .lp-row.stale:hover { background:rgba(251,191,36,0.06); }
          .lp-td { padding:13px 14px; vertical-align:middle; }
          .lp-stat { display:inline-flex; align-items:center; justify-content:center; min-width:32px; height:24px; padding:0 8px; border-radius:6px; font-size:12px; font-weight:700; tabular-nums; letter-spacing:0.02em; }
          .lp-stat.sky  { background:rgba(56,189,248,0.1);  color:#38bdf8; border:1px solid rgba(56,189,248,0.18); }
          .lp-stat.green{ background:rgba(34,197,94,0.1);   color:#4ade80; border:1px solid rgba(34,197,94,0.18); }
          .lp-stat.purple{ background:rgba(168,85,247,0.1); color:#c084fc; border:1px solid rgba(168,85,247,0.18); }
          .lp-stat.amber{ background:rgba(251,191,36,0.1);  color:#fbbf24; border:1px solid rgba(251,191,36,0.18); }
          .lp-stat.dim  { background:rgba(255,255,255,0.03); color:rgba(75,85,99,0.9); border:1px solid rgba(255,255,255,0.06); }
          .lp-vehicle-img { width:44px; height:34px; object-fit:cover; border-radius:6px; flex-shrink:0; background:#111827; }
          .lp-vehicle-placeholder { width:44px; height:34px; border-radius:6px; flex-shrink:0; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); }
          /* ── mobile cards ── */
          .lp-cards { display:none; padding:12px; gap:10px; flex-direction:column; }
          .lp-card { border-radius:10px; overflow:hidden; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); transition:border-color 0.15s; }
          .lp-card.stale { border-color:rgba(251,191,36,0.2); background:rgba(251,191,36,0.02); }
          .lp-card-top { display:flex; align-items:center; gap:12px; padding:12px 14px 10px; }
          .lp-card-img { width:52px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0; background:#111827; }
          .lp-card-placeholder { width:52px; height:40px; border-radius:6px; flex-shrink:0; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); }
          .lp-card-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:1px; background:rgba(255,255,255,0.05); border-top:1px solid rgba(255,255,255,0.05); }
          .lp-card-stat { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:9px 4px; background:rgba(6,12,20,0.6); gap:2px; }
          .lp-card-stat-val { font-size:13px; font-weight:800; tabular-nums; letter-spacing:0.02em; }
          .lp-card-stat-lbl { font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#374151; }
          @media(max-width:640px) {
            .lp-table-wrap { display:none !important; }
            .lp-cards { display:flex !important; }
          }
        `}</style>

        {/* ── header ── */}
        <div className="lp-header">
          <div>
            <h2 style={{ fontSize:14, fontWeight:700, color:'white', margin:0, letterSpacing:'-0.01em' }}>Listing Performance</h2>
            <p style={{ fontSize:11, color:'#374151', margin:'2px 0 0', letterSpacing:'0.01em' }}>Sorted by views · traffic activates once listings go live</p>
          </div>
          <span style={{ fontSize:11, fontWeight:600, color:'#374151', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:6, padding:'4px 10px' }}>
            {listings.length} listing{listings.length !== 1 ? 's' : ''}
          </span>
        </div>

        {listings.length === 0 ? (
          <div style={{ padding:'48px 20px', textAlign:'center', color:'#374151', fontSize:13 }}>
            No listings to analyse yet
          </div>
        ) : (() => {
          const sorted = [...listings].sort((a, b) => {
            const aViews = carStatsMap[a.id]?.views || 0;
            const bViews = carStatsMap[b.id]?.views || 0;
            return bViews - aViews;
          });
          return (
            <>
              {/* ── desktop table ── */}
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <colgroup>
                    <col /><col /><col /><col /><col /><col /><col /><col /><col />
                  </colgroup>
                  <thead>
                    <tr>
                      {['Vehicle','Price','Age','Views','WhatsApp','Calls','Bookings','CVR','Status'].map(h => (
                        <th key={h} className="lp-th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((l) => {
                      const stats  = carStatsMap[l.id] || {};
                      const views  = stats.views    || 0;
                      const wa     = stats.whatsapp  || 0;
                      const calls  = stats.calls     || 0;
                      const books  = stats.bookings  || 0;
                      const cvr    = stats.cvr;
                      const cvrNum = parseFloat(cvr);
                      const isStale = getListingAge(l.created_at) >= 30;
                      const statusKey = l.status || 'available';
                      const statusCls = statusKey === 'available' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                        : statusKey === 'reserved' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                        : 'bg-blue-400/10 text-blue-400 border-blue-400/20';
                      return (
                        <tr key={l.id} className={`lp-row${isStale ? ' stale' : ''}`}>
                          {/* Vehicle */}
                          <td className="lp-td">
                            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                              {l.images?.[0]
                                ? <img src={l.images[0]} alt="" className="lp-vehicle-img" />
                                : <div className="lp-vehicle-placeholder" />
                              }
                              <div style={{ minWidth:0 }}>
                                <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>
                                  {l.brand} {l.model}
                                </p>
                                <p style={{ fontSize:11, color:'#4b5563', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {l.variant || l.year || '—'}
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Price */}
                          <td className="lp-td">
                            <p style={{ fontSize:13, fontWeight:800, color:'#f3f4f6', margin:0, letterSpacing:'-0.02em', tabularNums:true }}>
                              RM {l.selling_price?.toLocaleString() || '—'}
                            </p>
                          </td>
                          {/* Age */}
                          <td className="lp-td">
                            <AgeBadge createdAt={l.created_at} />
                          </td>
                          {/* Views */}
                          <td className="lp-td">
                            <span className={`lp-stat ${views > 0 ? 'sky' : 'dim'}`}>
                              {eventsLoading ? '…' : views}
                            </span>
                          </td>
                          {/* WhatsApp */}
                          <td className="lp-td">
                            <span className={`lp-stat ${wa > 0 ? 'green' : 'dim'}`}>
                              {eventsLoading ? '…' : wa}
                            </span>
                          </td>
                          {/* Calls */}
                          <td className="lp-td">
                            <span className={`lp-stat ${calls > 0 ? 'purple' : 'dim'}`}>
                              {eventsLoading ? '…' : calls}
                            </span>
                          </td>
                          {/* Bookings */}
                          <td className="lp-td">
                            <span className={`lp-stat ${books > 0 ? 'amber' : 'dim'}`}>
                              {eventsLoading ? '…' : books}
                            </span>
                          </td>
                          {/* CVR */}
                          <td className="lp-td">
                            <span style={{ fontSize:12, fontWeight:700, color: cvrNum > 5 ? '#34d399' : cvrNum > 0 ? '#fbbf24' : '#374151' }}>
                              {eventsLoading ? '…' : (cvr || '—')}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="lp-td">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCls}`} style={{ letterSpacing:'0.04em', textTransform:'capitalize' }}>
                              {statusKey}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── mobile cards ── */}
              <div className="lp-cards">
                {sorted.map((l) => {
                  const stats  = carStatsMap[l.id] || {};
                  const views  = stats.views    || 0;
                  const wa     = stats.whatsapp  || 0;
                  const calls  = stats.calls     || 0;
                  const books  = stats.bookings  || 0;
                  const cvr    = stats.cvr;
                  const cvrNum = parseFloat(cvr);
                  const isStale = getListingAge(l.created_at) >= 30;
                  const statusKey = l.status || 'available';
                  const statusColor = statusKey === 'available' ? '#4ade80' : statusKey === 'reserved' ? '#fbbf24' : '#60a5fa';
                  return (
                    <div key={l.id} className={`lp-card${isStale ? ' stale' : ''}`}>
                      {/* top row */}
                      <div className="lp-card-top">
                        {l.images?.[0]
                          ? <img src={l.images[0]} alt="" className="lp-card-img" />
                          : <div className="lp-card-placeholder" />
                        }
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6 }}>
                            <div style={{ minWidth:0 }}>
                              <p style={{ fontSize:13, fontWeight:800, color:'white', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>
                                {l.brand} {l.model}
                              </p>
                              <p style={{ fontSize:11, color:'#4b5563', margin:'1px 0 0' }}>
                                {l.variant || l.year || '—'}
                              </p>
                            </div>
                            <span style={{ fontSize:10, fontWeight:700, color:statusColor, background:`${statusColor}18`, border:`1px solid ${statusColor}30`, borderRadius:20, padding:'2px 8px', flexShrink:0, letterSpacing:'0.06em', textTransform:'capitalize' }}>
                              {statusKey}
                            </span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                            <span style={{ fontSize:14, fontWeight:800, color:'#f3f4f6', letterSpacing:'-0.02em' }}>
                              RM {l.selling_price?.toLocaleString() || '—'}
                            </span>
                            <AgeBadge createdAt={l.created_at} />
                          </div>
                        </div>
                      </div>
                      {/* stats strip */}
                      <div className="lp-card-stats">
                        {[
                          { label:'Views',    val: views,  color:'#38bdf8' },
                          { label:'WhatsApp', val: wa,     color:'#4ade80' },
                          { label:'Calls',    val: calls,  color:'#c084fc' },
                          { label:'Bookings', val: books,  color:'#fbbf24' },
                          { label:'CVR',      val: eventsLoading ? '…' : (cvr || '—'), color: cvrNum > 5 ? '#34d399' : cvrNum > 0 ? '#fbbf24' : '#374151', raw: true },
                        ].map(({ label, val, color, raw }) => (
                          <div key={label} className="lp-card-stat">
                            <span className="lp-card-stat-val" style={{ color: (raw ? true : val > 0) ? color : '#374151' }}>
                              {eventsLoading && !raw ? '…' : val}
                            </span>
                            <span className="lp-card-stat-lbl">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(59,130,246,0.1)",
                border: "1px solid rgba(59,130,246,0.18)",
                boxShadow: "0 0 12px rgba(59,130,246,0.12)",
              }}
            >
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-left">
              <p className="text-white text-sm font-semibold">
                AI Performance Advisor
              </p>
              <p className="text-gray-600 text-xs mt-0.5">
                Ask anything about your inventory & performance
              </p>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${chatOpen ? "rotate-90" : ""}`}
          />
        </button>
        {chatOpen && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="h-72 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {m.role === "assistant" && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        border: "1px solid rgba(59,130,246,0.18)",
                      }}
                    >
                      <Bot className="w-3 h-3 text-blue-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "text-white rounded-tr-sm" : "text-gray-300 rounded-tl-sm"}`}
                    style={
                      m.role === "user"
                        ? {
                            background:
                              "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                            boxShadow: "0 2px 8px rgba(59,130,246,0.22)",
                          }
                        : {
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: "rgba(59,130,246,0.12)",
                      border: "1px solid rgba(59,130,246,0.18)",
                    }}
                  >
                    <Bot className="w-3 h-3 text-blue-400" />
                  </div>
                  <div
                    className="px-3.5 py-3 rounded-2xl rounded-tl-sm"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {messages.length === 1 && (
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="text-xs px-3 py-1.5 rounded-full text-gray-500 hover:text-white transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <div
              className="p-3 flex gap-2 items-end"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about your listings, pricing, leads…"
                className="flex-1 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none resize-none transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  maxHeight: "120px",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "rgba(59,130,246,0.4)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.08)")
                }
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="btn-shimmer w-9 h-9 flex items-center justify-center disabled:opacity-30 rounded-xl flex-shrink-0"
                style={T.btnRed}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// FIXED: auth-first account creation
// ─── TeamTab ──────────────────────────────────────────────────────────────────
function TeamTab({ managerDealership, dealerId }) {
  const [salespeople, setSalespeople] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [copiedPw, setCopiedPw] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [newRole, setNewRole] = useState("salesman");
  const [teamTab, setTeamTab] = useState("salesman");
  const [msgTarget, setMsgTarget] = useState('all');
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgDone, setMsgDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+60");
  const [slug, setSlug] = useState("");
  const [tempPw, setTempPw] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null); // one-time password modal
  const [teamSoldCount, setTeamSoldCount] = useState(0);
  const [analyticsMap, setAnalyticsMap] = useState({});

  const fetchAnalytics = async () => {
    if (!dealerId) return;
    const { data } = await supabase
      .from("analytics_events")
      .select("salesman_slug,event_type")
      .eq("dealer_id", dealerId);   // scope to this dealer's salesmen only
    if (!data) return;
    const map = {};
    data.forEach(({ salesman_slug, event_type }) => {
      if (!map[salesman_slug]) map[salesman_slug] = { clicks: 0, whatsapp: 0 };
      if (event_type === "link_visit" || event_type === "car_view")
        map[salesman_slug].clicks++;
      if (event_type === "whatsapp_click")
        map[salesman_slug].whatsapp++;
    });
    setAnalyticsMap(map);
  };

  useEffect(() => {
    fetchTeam();
    fetchAnalytics();
  }, [managerDealership]);

  useEffect(() => {
    if (!managerDealership) return;
    const fetchSold = async () => {
      const { count } = await supabase
        .from("car_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "sold");
      setTeamSoldCount(count || 0);
    };
    fetchSold();
    const ch = supabase
      .channel("team_sold")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "car_listings" },
        fetchSold,
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [managerDealership]);

  const fetchTeam = async () => {
    if (!managerDealership) {
      setSalespeople([]);
      setTeamError("Dealership profile missing.");
      setLoadingTeam(false);
      return;
    }
    setLoadingTeam(true);
    setTeamError("");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["salesman","manager","accountant","fi_officer","admin"])
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false });
    if (error) {
      setTeamError(error.message || "Failed to load team.");
      setSalespeople([]);
    } else setSalespeople(data || []);
    setLoadingTeam(false);
  };

  const slugify = (v) =>
    v
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  const handleNameChange = (v) => {
    setName(v);
    setSlug(slugify(v.trim().split(/\s+/)[0]));
  };
  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("+60");
    setSlug("");
    setTempPw("");
    setAddError("");
    setAddSuccess("");
    setNewRole("salesman");
  };

  const handleAdd = async () => {
    setAddError("");
    const n = name.trim(),
      e = email.trim().toLowerCase(),
      s = slug.trim(),
      p = phone.trim() || null;
    if (!managerDealership) {
      setAddError("Dealership required.");
      return;
    }
    const isSalesman = newRole === "salesman";
    if (!n || !e || !s || (!isSalesman && !tempPw)) {
      setAddError("All fields required.");
      return;
    }
    if (!isSalesman && tempPw.length < 8) {
      setAddError("Password min 8 chars.");
      return;
    }
    if (!/^[a-z0-9]+$/.test(s)) {
      setAddError("Slug: lowercase + numbers only.");
      return;
    }
    setAddLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (isSalesman) {
        // Auth-first salesman creation via edge function
        const res = await fetch(`${SERVER_URL}/create-salesman`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: e,
            full_name: n,
            phone: p,
            slug: s,
            dealer_id: dealerId,
            plan: "salesman_full",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddError(
            data.error === "email_taken"
              ? "Email already in use."
              : data.message || data.error || "Failed to create account.",
          );
          setAddLoading(false);
          return;
        }
        setShowAddForm(false);
        setCreatedAccount({ full_name: n, email: e, temp_password: data.temp_password });
        await fetchTeam();
        resetForm();
      } else {
        // Non-salesman roles use existing invites function
        const res = await fetch(`${SERVER_URL}/invites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            full_name: n,
            email: e,
            phone: p,
            dealership: managerDealership,
            dealer_id: dealerId,
            slug: s,
            password: tempPw,
            role: newRole,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddError(data.message || "Failed.");
          setAddLoading(false);
          return;
        }
        setSalespeople((prev) => [data.invite, ...prev]);
        setAddSuccess(`${n} added successfully.`);
        resetForm();
        setShowAddForm(false);
      }
    } catch {
      setAddError("Server unreachable.");
    }
    setAddLoading(false);
  };

  const copyLink = (s) => {
    navigator.clipboard.writeText(
      `${window.location.origin}/cars?ref=${s.slug}`,
    );
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const toggleActive = async (s) => {
    setTogglingId(s.id);
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    if (!error)
      setSalespeople((p) =>
        p.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)),
      );
    setTogglingId(null);
  };
  const deleteSalesman = async (id) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${SERVER_URL}/invites/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) setSalespeople((p) => p.filter((x) => x.id !== id));
    setDeleteConfirmId(null);
  };

  const ROLE_COLORS = {
    salesman:   '#3b82f6',
    manager:    '#f97316',
    accountant: '#22c55e',
    fi_officer: '#a855f7',
    admin:      '#94a3b8',
  };
  const ROLE_TABS = [
    { role: 'salesman',   label: 'Salesmen',    color: '#3b82f6' },
    { role: 'manager',    label: 'Managers',    color: '#f97316' },
    { role: 'accountant', label: 'Accountants', color: '#22c55e' },
    { role: 'fi_officer', label: 'F&I',         color: '#a855f7' },
    { role: 'admin',      label: 'Admins',      color: '#94a3b8' },
  ];

  const activeCount = salespeople.filter((s) => s.is_active !== false).length;
  const inactiveCount = salespeople.filter((s) => s.is_active === false).length;
  const activeRate = salespeople.length
    ? Math.round((activeCount / salespeople.length) * 100)
    : 0;
  const inputCls =
    "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-red-600/10 transition-all";

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{
          background: "rgba(34,197,94,0.05)",
          border: "1px solid rgba(34,197,94,0.15)",
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1">
          <p className="text-emerald-300 text-sm font-semibold">
            {teamSoldCount} car{teamSoldCount !== 1 ? "s" : ""} sold
          </p>
          <p className="text-emerald-600/60 text-xs">
            Live count · updates automatically
          </p>
        </div>
        <p className="text-3xl font-black grad-green tabular-nums">
          {teamSoldCount}
        </p>
      </div>
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <div
          className="flex items-center justify-between gap-3 p-4"
          style={T.divider}
        >
          <div>
            <h2 className="font-semibold text-white">Salespeople</h2>
            <p className="text-xs text-gray-600 mt-0.5 hidden sm:block">
              {salespeople.length > 0
                ? `${activeCount} active · ${inactiveCount} inactive · ${activeRate}% active rate`
                : "Manage accounts, links, and status."}
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(true);
              resetForm();
            }}
            disabled={!managerDealership}
            className="btn-shimmer inline-flex items-center gap-2 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
            style={T.btnRed}
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Salesman</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
        {/* Role tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
          {ROLE_TABS.map(({ role, label, color }) => {
            const count = salespeople.filter(s => s.role === role).length;
            return (
              <button
                key={role}
                onClick={() => setTeamTab(role)}
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  color: teamTab === role ? '#f3f4f6' : '#6b7280',
                  borderBottom: teamTab === role ? `2px solid ${color}` : '2px solid transparent',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                {label}
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: '1px 7px', borderRadius: 10,
                  background: teamTab === role ? `${color}18` : 'rgba(255,255,255,0.05)',
                  color: teamTab === role ? color : '#4b5563',
                }}>{count}</span>
              </button>
            );
          })}
        </div>
        {teamError && (
          <div
            className="m-4 rounded-lg px-3 py-2.5 text-amber-300 text-xs"
            style={{
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.14)",
            }}
          >
            ⚠ {teamError}
          </div>
        )}
        {loadingTeam ? (
          <div className="p-12 text-center text-gray-600 text-sm">
            Loading team...
          </div>
        ) : salespeople.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{
                background: "rgba(59,130,246,0.07)",
                border: "1px solid rgba(59,130,246,0.12)",
              }}
            >
              <Users className="w-5 h-5 text-blue-500/40" />
            </div>
            <p className="text-gray-600 text-sm mb-4">
              No salespeople added yet
            </p>
            <button
              onClick={() => {
                setShowAddForm(true);
                resetForm();
              }}
              disabled={!managerDealership}
              className="btn-shimmer text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={T.btnRed}
            >
              Add your first salesman
            </button>
          </div>
        ) : (
          <div>
            {(() => {
              const filteredTeam = salespeople.filter(s => s.role === teamTab);
              return (
                <>
                  {filteredTeam.length === 0 && (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#4b5563', fontSize: 13 }}>
                      No {ROLE_TABS.find(t => t.role === teamTab)?.label} yet.
                    </div>
                  )}
                  {filteredTeam.map((s) => (
              <div
                key={s.id}
                className={`p-4 transition-colors ${s.is_active === false ? "opacity-50" : "hover:bg-white/[0.02]"}`}
              >
                <div className="flex items-start gap-3">
                  {s.avatar_url ? (
                    <img
                      src={s.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg,#3b82f6,#7c3aed)",
                      }}
                    >
                      {(s.full_name || "S")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLORS[s.role] || '#6b7280', flexShrink: 0 }} />
                      <p className="font-semibold text-white truncate">
                        {s.full_name}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${s.is_active !== false ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-white/5 text-gray-500 border-white/8"}`}
                      >
                        {s.is_active !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-500">
                      <span className="truncate max-w-[200px]">{s.email}</span>
                      {s.phone && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span>{s.phone}</span>
                        </>
                      )}
                    </div>
                    {s.slug ? (
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-500"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <Link className="w-3 h-3 text-gray-600" />
                          /cars?ref=
                          <span className="text-white font-medium">
                            {s.slug}
                          </span>
                        </div>
                        <button
                          onClick={() => copyLink(s)}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white rounded-lg px-2 py-1.5 transition-all"
                          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          {copiedId === s.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <span
                          className="text-xs text-amber-500/70 px-2.5 py-1.5 rounded-lg"
                          style={{
                            background: "rgba(251,191,36,0.06)",
                            border: "1px solid rgba(251,191,36,0.12)",
                          }}
                        >
                          ⚠ No slug — referral link unavailable
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 max-w-xs">
                      {[
                        [String(analyticsMap[s.slug]?.clicks || 0), "Clicks"],
                        [
                          String(analyticsMap[s.slug]?.whatsapp || 0),
                          "WhatsApp",
                        ],
                        [String(teamSoldCount), "Team Sales"],
                      ].map(([v, lbl]) => (
                        <div
                          key={lbl}
                          className="rounded-lg px-2.5 py-2"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <p
                            className={`text-sm font-bold ${lbl === "Team Sales" ? "grad-green" : lbl === "WhatsApp" && Number(v) > 0 ? "grad-green" : "grad-white"}`}
                          >
                            {v}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {lbl}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(s)}
                      disabled={togglingId === s.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white transition-all disabled:opacity-40"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {s.is_active !== false ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="hidden sm:inline">Deactivate</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5 text-gray-600" />
                          <span className="hidden sm:inline">Activate</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(s.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-blue-500 hover:bg-blue-500/10 transition-all"
                      style={{ border: "1px solid rgba(59,130,246,0.18)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
                </>
              );
            })()}
          </div>
        )}
      </div>
      {deleteConfirmId && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
            style={undefined}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-white">Remove Salesman?</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  Deletes their account and referral link permanently.
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSalesman(deleteConfirmId)}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── One-time Password Modal ── */}
      {createdAccount && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md relative"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.22)" }}
                >
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Account Created</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Share these credentials with your salesman</p>
                </div>
              </div>
              <button
                onClick={() => setCreatedAccount(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="rounded-xl px-3.5 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Name</p>
                <p className="text-white text-sm font-medium">{createdAccount.full_name}</p>
              </div>
              <div className="rounded-xl px-3.5 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Email</p>
                <p className="text-white text-sm font-medium">{createdAccount.email}</p>
              </div>
              <div className="rounded-xl px-3.5 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Temporary Password</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdAccount.temp_password);
                      setCopiedPw(true);
                      setTimeout(() => setCopiedPw(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all"
                    style={copiedPw
                      ? { color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }
                      : { color: "#9ca3af", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {copiedPw ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <p className="text-white text-base font-mono font-bold tracking-widest">{createdAccount.temp_password}</p>
              </div>
            </div>

            <div
              className="rounded-xl px-3.5 py-2.5 mb-4 flex items-start gap-2.5"
              style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.16)" }}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-300/80 text-xs leading-relaxed">
                This password will <span className="font-semibold text-amber-300">not be shown again</span>. Share it securely with your salesman now.
              </p>
            </div>

            <button
              onClick={() => setCreatedAccount(null)}
              className="btn-shimmer w-full px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
              style={T.btnRed}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {/* ── Message Team Panel ── */}
      {(() => {
        const MSG_ROLES = [
          { value: 'all',        label: 'Everyone',    color: '#f3f4f6' },
          { value: 'salesman',   label: 'Salesmen',    color: '#3b82f6' },
          { value: 'manager',    label: 'Managers',    color: '#f97316' },
          { value: 'accountant', label: 'Accountants', color: '#22c55e' },
          { value: 'fi_officer', label: 'F&I',         color: '#a855f7' },
          { value: 'admin',      label: 'Admins',      color: '#94a3b8' },
        ];
        const recipients = salespeople.filter(s =>
          (msgTarget === 'all' || s.role === msgTarget) && s.is_active !== false
        );
        const sendToTeam = async () => {
          if (!msgText.trim() || recipients.length === 0 || msgSending) return;
          setMsgSending(true);
          const inserts = recipients.map(s => ({
            salesman_id: s.id,
            type: 'broadcast',
            title: '📢 Message from Owner',
            body: msgText.trim(),
          }));
          const { error } = await supabase.from('salesman_notifications').insert(inserts);
          setMsgSending(false);
          if (error) { alert('Failed to send: ' + error.message); return; }
          setMsgDone(true);
          setMsgText('');
          setTimeout(() => setMsgDone(false), 3000);
        };
        return (
          <div className="rounded-xl overflow-hidden" style={T.cardDark}>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Message Team</h2>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Sends to each member's dashboard notification</p>
              </div>
              <Send style={{ width: 16, height: 16, color: '#4b5563' }} />
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Role filter pills */}
              <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Send To</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {MSG_ROLES.map(({ value, label, color }) => {
                  const cnt = value === 'all'
                    ? salespeople.filter(s => s.is_active !== false).length
                    : salespeople.filter(s => s.role === value && s.is_active !== false).length;
                  return (
                    <button
                      key={value}
                      onClick={() => setMsgTarget(value)}
                      style={{
                        padding: '6px 14px', borderRadius: 20,
                        border: `1px solid ${msgTarget === value ? color : 'rgba(255,255,255,0.08)'}`,
                        background: msgTarget === value ? `${color}18` : 'rgba(255,255,255,0.03)',
                        color: msgTarget === value ? color : '#6b7280',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                        display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                      }}
                    >
                      {value !== 'all' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />}
                      {label}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                        background: msgTarget === value ? `${color}22` : 'rgba(255,255,255,0.05)',
                        color: msgTarget === value ? color : '#4b5563',
                      }}>{cnt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Recipient preview */}
              {recipients.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {recipients.map(s => (
                    <span key={s.id} style={{ fontSize: 11, color: '#9ca3af', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: ROLE_COLORS[s.role] || '#6b7280', flexShrink: 0, display: 'inline-block' }} />
                      {s.full_name}
                    </span>
                  ))}
                </div>
              )}

              {/* Message input */}
              <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Message</p>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                rows={4}
                placeholder="Type your message here…"
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '10px 12px', color: '#f3f4f6', fontSize: 13,
                  fontFamily: "'DM Sans',sans-serif", outline: 'none', lineHeight: 1.6,
                  marginBottom: 12,
                }}
              />

              <button
                onClick={sendToTeam}
                disabled={!msgText.trim() || recipients.length === 0 || msgSending}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600,
                  border: 'none', transition: 'all 0.15s',
                  ...(msgDone
                    ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
                    : { ...T.btnRed, opacity: (!msgText.trim() || recipients.length === 0) ? 0.4 : 1 }),
                }}
              >
                {msgDone ? (
                  <><Check style={{ width: 15, height: 15 }} /> Sent to {recipients.length} member{recipients.length !== 1 ? 's' : ''}</>
                ) : msgSending ? (
                  'Sending…'
                ) : (
                  <><Send style={{ width: 14, height: 14 }} /> Send to {recipients.length} member{recipients.length !== 1 ? 's' : ''}</>
                )}
              </button>
            </div>
          </div>
        );
      })()}

      {showAddForm && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
            style={undefined}
          >
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={T.divider}
            >
              <div>
                <h3 className="font-semibold text-white">Add Salesman</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create account and trackable referral link
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {addSuccess ? (
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{
                      background: "rgba(52,211,153,0.12)",
                      border: "1px solid rgba(52,211,153,0.22)",
                    }}
                  >
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-emerald-400 font-semibold mb-1">
                    Salesman added!
                  </p>
                  <p className="text-gray-500 text-sm mb-6">{addSuccess}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      Done
                    </button>
                    <button
                      onClick={resetForm}
                      className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                      style={T.btnRed}
                    >
                      Add Another
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Role selector */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2.5">Select Role</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { role: 'salesman',   label: 'Salesman',    color: '#3b82f6', desc: 'Sells cars, manages leads' },
                        { role: 'manager',    label: 'Manager',     color: '#f97316', desc: 'Manages sales team' },
                        { role: 'accountant', label: 'Accountant',  color: '#22c55e', desc: 'Financial view only' },
                        { role: 'fi_officer', label: 'F&I Officer', color: '#a855f7', desc: 'Finance & insurance' },
                        { role: 'admin',      label: 'Admin',       color: '#94a3b8', desc: 'Listings management' },
                      ].map(({ role, label, color, desc }) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setNewRole(role)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: `1px solid ${newRole === role ? color : 'rgba(255,255,255,0.08)'}`,
                            background: newRole === role ? `${color}18` : 'rgba(255,255,255,0.03)',
                            cursor: 'pointer',
                            fontFamily: "'DM Sans',sans-serif",
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: newRole === role ? color : '#9ca3af' }}>{label}</span>
                          </div>
                          <p style={{ fontSize: 10, color: '#4b5563', margin: '2px 0 0', textAlign: 'left' }}>{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Ahmad bin Abdullah"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        autoComplete="off"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Email *
                      </label>
                      <input
                        type="email"
                        placeholder="ahmad@autocity.my"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Phone
                      </label>
                      <div className={`flex items-center overflow-hidden ${inputCls}`} style={{ padding:0 }}>
                        <span className="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-700 bg-gray-800/50 flex-shrink-0">+60</span>
                        <input
                          type="tel"
                          value={(phone||'').replace(/^\+?60/,'')}
                          onChange={(e) => setPhone('+60'+e.target.value.replace(/\D/g,''))}
                          placeholder="X-XXXXXXX"
                          autoComplete="off"
                          className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2.5"
                        />
                      </div>
                    </div>
                    {newRole !== "salesman" && (
                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                          Temp Password *
                        </label>
                        <input
                          type="text"
                          placeholder="Min 8 characters"
                          value={tempPw}
                          onChange={(e) => setTempPw(e.target.value)}
                          autoComplete="off"
                          className={inputCls}
                        />
                      </div>
                    )}
                    {newRole === "salesman" && (
                      <div className="flex items-end">
                        <div
                          className="w-full rounded-xl px-3 py-2.5 text-xs text-emerald-400"
                          style={{
                            background: "rgba(52,211,153,0.06)",
                            border: "1px solid rgba(52,211,153,0.18)",
                          }}
                        >
                          Password auto-generated — shown once after creation.
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                      Unique Slug *
                    </label>
                    <div className="flex">
                      <span
                        className="rounded-l-xl px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRight: "none",
                        }}
                      >
                        /cars?ref=
                      </span>
                      <input
                        type="text"
                        placeholder="ahmad"
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value))}
                        autoComplete="off"
                        className="flex-1 rounded-r-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-blue-500/50 transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-700 mt-1">
                      Auto-filled from first name. Lowercase + numbers only.
                    </p>
                  </div>
                  {addError && (
                    <div
                      className="rounded-xl px-3 py-2.5 text-blue-400 text-xs"
                      style={{
                        background: "rgba(59,130,246,0.07)",
                        border: "1px solid rgba(59,130,246,0.18)",
                      }}
                    >
                      ⚠ {addError}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={addLoading}
                      className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40"
                      style={T.btnRed}
                    >
                      {addLoading ? "Creating..." : newRole === "salesman" ? "Create Salesman" : "Add Team Member"}
                    </button>
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

// ─── Helpers shared by ListingDetailDrawer ────────────────────────────────────
function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split(/,|\n/).map(s => s.trim()).filter(Boolean);
}

const DRAWER_GRADE_COLORS = { S:'#a78bfa', 5:'#34d399', '4.5':'#6ee7b7', 4:'#fbbf24', '3.5':'#fb923c', 3:'#93c5fd', R:'#ef4444', RA:'#3b82f6', 2:'#1d4ed8', 1:'#1e3a8a' };
const DRAWER_DMG_COLORS   = { scratch:'#fbbf24', dent:'#93c5fd', crack:'#f43f5e', replaced:'#a78bfa' };

function DrawerDamageMap({ damageMap }) {
  const zones = Array.isArray(damageMap) ? damageMap : [];
  const byZone = {};
  zones.forEach(z => { byZone[z.zone] = z.type; });
  const fill   = z => byZone[z] ? DRAWER_DMG_COLORS[byZone[z]] + '44' : 'rgba(255,255,255,0.035)';
  const stroke = z => byZone[z] ? DRAWER_DMG_COLORS[byZone[z]]       : 'rgba(255,255,255,0.09)';
  return (
    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 16 }}>
      <svg viewBox="0 0 170 220" width={150} height={220} style={{ flexShrink: 0 }}>
        <rect x="42" y="6"   width="86" height="44" rx="6" fill={fill('hood')}        stroke={stroke('hood')}        strokeWidth="1.3"/>
        <text x="85" y="33"  textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="DM Sans,sans-serif">Hood</text>
        <rect x="6"  y="6"   width="34" height="44" rx="5" fill={fill('front-left')}  stroke={stroke('front-left')}  strokeWidth="1.3"/>
        <text x="23" y="23"  textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif">FL</text>
        <text x="23" y="34"  textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="DM Sans,sans-serif">Fender</text>
        <rect x="130" y="6"  width="34" height="44" rx="5" fill={fill('front-right')} stroke={stroke('front-right')} strokeWidth="1.3"/>
        <text x="147" y="23" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif">FR</text>
        <text x="147" y="34" textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="DM Sans,sans-serif">Fender</text>
        <rect x="6"  y="54"  width="32" height="80" rx="4" fill={fill('left')}        stroke={stroke('left')}        strokeWidth="1.3"/>
        <text x="22" y="97"  textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif" transform="rotate(-90,22,97)">Left</text>
        <rect x="132" y="54" width="32" height="80" rx="4" fill={fill('right')}       stroke={stroke('right')}       strokeWidth="1.3"/>
        <text x="148" y="97" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif" transform="rotate(90,148,97)">Right</text>
        <rect x="40" y="54"  width="90" height="80" rx="4" fill={fill('roof')}        stroke={stroke('roof')}        strokeWidth="1.3"/>
        <text x="85" y="98"  textAnchor="middle" fontSize="11" fill="#9ca3af" fontFamily="DM Sans,sans-serif">Roof</text>
        <rect x="6"  y="138" width="32" height="36" rx="4" fill={fill('rear-left')}   stroke={stroke('rear-left')}   strokeWidth="1.3"/>
        <text x="22" y="155" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif">RL</text>
        <text x="22" y="166" textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="DM Sans,sans-serif">Qtr</text>
        <rect x="132" y="138" width="32" height="36" rx="4" fill={fill('rear-right')} stroke={stroke('rear-right')} strokeWidth="1.3"/>
        <text x="148" y="155" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif">RR</text>
        <text x="148" y="166" textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="DM Sans,sans-serif">Qtr</text>
        <rect x="40" y="138" width="90" height="36" rx="4" fill={fill('trunk')}       stroke={stroke('trunk')}       strokeWidth="1.3"/>
        <text x="85" y="161" textAnchor="middle" fontSize="11" fill="#9ca3af" fontFamily="DM Sans,sans-serif">Trunk</text>
        <text x="85" y="192" textAnchor="middle" fontSize="8" fill="#374151" fontFamily="DM Sans,sans-serif">▲ FRONT · REAR ▼</text>
      </svg>
      <div style={{ flex: 1, minWidth: 140 }}>
        <p style={{ fontSize: 10, color: '#374151', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Legend</p>
        {Object.entries(DRAWER_DMG_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <div style={{ width: 11, height: 11, borderRadius: 3, background: color + '44', border: `1.5px solid ${color}`, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
        <p style={{ fontSize: 10, color: '#374151', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '16px 0 10px' }}>Reported</p>
        {zones.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
            <span style={{ fontSize: 12, color: '#34d399' }}>No damage reported</span>
          </div>
        ) : zones.map((z, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: (DRAWER_DMG_COLORS[z.type] || '#9ca3af') + '44', border: `1.5px solid ${DRAWER_DMG_COLORS[z.type] || '#9ca3af'}`, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#6b7280' }}><span style={{ color: '#e5e5e5' }}>{z.zone}</span> — {z.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListingDetailDrawer({
  listing, salesmen, salesmenById, onClose, onUpdate, onDelete,
  setEditListing, setTiktokListing, setPriceEditListing, setMarkSoldListing,
  setDeleteId, copyListing, copiedListingId, handleAssign, handleUnassign,
  handleStatus, updatingStatus, getListingAge,
}) {
  const [imgIdx, setImgIdx]       = useState(0);
  const [lbOpen, setLbOpen]       = useState(false);
  const [drawerTab, setDrawerTab] = useState('specs');
  const [showAssign, setShowAssign] = useState(false);
  const [calcOpen,  setCalcOpen]  = useState(false);
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const images = Array.isArray(listing.images) && listing.images.length > 0 ? listing.images : ['/placeholder-car.jpg'];
  const sp = listing.selling_price || listing.price || 0;
  const op = listing.original_price || listing.previous_price || null;
  const saving = op && op > sp ? op - sp : 0;
  const monthly = sp > 0 ? Math.round((sp * 0.9 * (1 + 3.5 / 100 * 7)) / (7 * 12)) : null;
  const pct = op && op > sp ? Math.round(((op - sp) / op) * 100) : 0;
  const gradeMeta = DRAWER_GRADE_COLORS[listing.auction_grade] || null;
  const intColor = { A:'#34d399', B:'#fbbf24', C:'#fb923c', D:'#93c5fd' }[listing.interior_grade] || '#9ca3af';
  let damageMap = [];
  try { if (listing.damage_map) damageMap = typeof listing.damage_map === 'string' ? JSON.parse(listing.damage_map) : listing.damage_map; } catch {}
  const features = parseTags(listing.features);
  const options  = parseTags(listing.options);
  const isSold   = listing.status === 'sold';
  const age      = getListingAge(listing.created_at);
  const sCfg = ({ available: { bg: 'rgba(74,222,128,0.12)', bd: 'rgba(74,222,128,0.3)', tx: '#4ade80', dot: '#4ade80' }, reserved: { bg: 'rgba(251,191,36,0.12)', bd: 'rgba(251,191,36,0.3)', tx: '#fbbf24', dot: '#fbbf24' }, sold: { bg: 'rgba(156,163,175,0.12)', bd: 'rgba(156,163,175,0.2)', tx: '#9ca3af', dot: '#9ca3af' } })[listing.status || 'available'] || { bg: 'rgba(74,222,128,0.12)', bd: 'rgba(74,222,128,0.3)', tx: '#4ade80', dot: '#4ade80' };

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { if (lbOpen) setLbOpen(false); else onClose(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lbOpen, onClose]);

  const tabs = ['specs', 'features', 'options', ...(listing.is_recon ? ['recon'] : [])];
  const tabLabel = { specs: 'Specifications', features: 'Features', options: 'Options', recon: 'Recon' };

  const btnBase = { width: '100%', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 6, padding: '11px 14px', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 0.2s', border: '1px solid rgba(255,255,255,0.08)', fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' };

  const specRows = [
    { k: 'Year',              v: listing.year || '—' },
    { k: 'Registration Date', v: listing.registration_date || '—' },
    { k: 'VIN',               v: listing.vin_number || '—' },
    { k: 'Condition',         v: listing.condition || '—' },
    { k: 'Chassis Status',    v: listing.chassis_status || '—', dot: true },
    { k: 'Location',          v: [listing.city, listing.state].filter(Boolean).join(', ') || '—' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', overflowY: 'auto' }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          style={{ position: 'relative', margin: isMobile ? 0 : '24px auto', maxWidth: isMobile ? '100vw' : 1100, width: isMobile ? '100vw' : 'calc(100vw - 48px)', height: isMobile ? '100dvh' : undefined, maxHeight: isMobile ? '100dvh' : 'calc(100vh - 48px)', background: 'rgba(11,11,15,0.99)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: isMobile ? 0 : 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 36, height: 36, borderRadius: 6, background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflowY: 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
            {/* LEFT */}
            <div style={{ flex: 1, minWidth: 0, padding: isMobile ? 16 : 24, borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)', overflowY: isMobile ? 'visible' : 'auto' }}>

              {/* Gallery */}
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Thumb strip */}
                <div style={{ width: 64, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: isMobile ? 200 : 320, overflowY: 'auto' }}>
                  {images.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setImgIdx(i)}
                      style={{ width: 64, height: 48, borderRadius: 4, cursor: 'pointer', flexShrink: 0, background: '#0d0d0d', border: i === imgIdx ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', opacity: i === imgIdx ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </div>
                  ))}
                </div>
                {/* Main image */}
                <div style={{ flex: 1, position: 'relative', background: '#0d0d0d', borderRadius: 6, overflow: 'hidden', height: isMobile ? 200 : 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={images[imgIdx]}
                    alt=""
                    onClick={() => setLbOpen(true)}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in', display: 'block' }}
                  />
                  {images.length > 1 && (
                    <>
                      <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + images.length) % images.length); }} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronLeft style={{ width: 14, height: 14 }} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % images.length); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronRight style={{ width: 14, height: 14 }} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setLbOpen(true)} style={{ position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ZoomIn style={{ width: 13, height: 13 }} />
                  </button>
                  {images.length > 1 && (
                    <span style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 10, color: '#9ca3af', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 7px' }}>{imgIdx + 1} / {images.length}</span>
                  )}
                </div>
              </div>

              {/* Car header */}
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>{listing.brand}</p>
                <p style={{ fontSize: 22, fontWeight: 300, color: '#f3f4f6', margin: '4px 0 0', lineHeight: 1.2 }}>{listing.model}{listing.variant ? ` ${listing.variant}` : ''}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0 0' }}>
                  {[listing.year, listing.body_type, listing.transmission, listing.fuel_type].filter(Boolean).join(' · ')}
                </p>
                {(listing.city || listing.state) && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin style={{ width: 11, height: 11 }} />
                    {[listing.city, listing.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              {/* Price row */}
              <div style={{ marginTop: 12 }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#f3f4f6', margin: 0, lineHeight: 1 }}>RM {sp.toLocaleString()}</p>
                {saving > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#374151', textDecoration: 'line-through' }}>RM {op.toLocaleString()}</span>
                    <span style={{ fontSize: 10, color: '#93c5fd', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 4, padding: '1px 6px' }}>SAVE RM {saving.toLocaleString()}</span>
                  </div>
                )}
                {monthly && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Est. RM {monthly.toLocaleString()}/mo · 90% loan · 7yr · 3.5% p.a.</p>}
              </div>

              {/* Specs strip */}
              <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '16px 0', padding: '12px 0', gap: 0, overflowX: 'auto' }}>
                {[
                  { Icon: Gauge,    label: 'Mileage',       value: listing.mileage ? `${Number(listing.mileage).toLocaleString()} km` : '—' },
                  { Icon: Settings, label: 'Engine',        value: listing.engine_cc ? `${Number(listing.engine_cc).toLocaleString()} cc` : '—' },
                  { Icon: ChevronRight, label: 'Transmission', value: listing.transmission || '—' },
                  { Icon: Droplets, label: 'Fuel',          value: listing.fuel_type || '—' },
                  { Icon: Palette,  label: 'Colour',        value: listing.colour || '—' },
                ].map(({ Icon, label, value }, i, arr) => (
                  <div key={label} style={{ flex: '1 0 80px', textAlign: 'center', padding: '0 12px', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <Icon style={{ width: 13, height: 13, color: '#6b7280', marginBottom: 4 }} />
                    <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', marginBottom: 3 }}>{label}</p>
                    <p style={{ fontSize: 13, color: '#f3f4f6' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
                {tabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDrawerTab(tab)}
                    style={{ padding: '8px 16px', fontSize: 12, color: drawerTab === tab ? '#f3f4f6' : '#6b7280', borderBottom: drawerTab === tab ? '2px solid #ef4444' : '2px solid transparent', background: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'color 0.15s' }}
                  >
                    {tabLabel[tab]}
                  </button>
                ))}
              </div>

              {/* Tab: Specifications */}
              {drawerTab === 'specs' && (
                <div>
                  {specRows.map(({ k, v, dot }) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{k}</span>
                      <span style={{ fontSize: 13, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {dot && v !== '—' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />}
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: Features */}
              {drawerTab === 'features' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {features.length === 0 ? <p style={{ fontSize: 13, color: '#6b7280' }}>No features listed.</p> : features.map((f, i) => (
                    <span key={i} style={{ fontSize: 12, color: '#9ca3af', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 10px' }}>{f}</span>
                  ))}
                </div>
              )}

              {/* Tab: Options */}
              {drawerTab === 'options' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {options.length === 0 ? <p style={{ fontSize: 13, color: '#6b7280' }}>No options listed.</p> : options.map((o, i) => (
                    <span key={i} style={{ fontSize: 12, color: '#9ca3af', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 10px' }}>{o}</span>
                  ))}
                </div>
              )}

              {/* Tab: Recon */}
              {drawerTab === 'recon' && listing.is_recon && (
                <div>
                  {gradeMeta && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.04)', border: `1px solid ${gradeMeta}25`, borderRadius: 6, padding: '10px 16px', marginBottom: 20 }}>
                      <div>
                        <p style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Ext. Grade</p>
                        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: gradeMeta, lineHeight: 1 }}>{listing.auction_grade}</p>
                      </div>
                      {listing.interior_grade && (
                        <>
                          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }} />
                          <div>
                            <p style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Int. Grade</p>
                            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: intColor, lineHeight: 1 }}>{listing.interior_grade}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {[
                    { k: 'Import Country', v: listing.import_country },
                    { k: 'Auction House',  v: listing.auction_house },
                    { k: 'Exterior Grade', v: listing.auction_grade },
                    { k: 'Interior Grade', v: listing.interior_grade },
                  ].filter(r => r.v).map(({ k, v }) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{k}</span>
                      <span style={{ fontSize: 13, color: '#9ca3af' }}>{v}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 20, marginBottom: 0 }}>Condition Map</p>
                  <DrawerDamageMap damageMap={damageMap} />
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div style={{ flex: isMobile ? 'none' : '0 0 200px', width: isMobile ? '100%' : undefined, padding: isMobile ? '12px 16px 24px' : 20, display: 'flex', flexDirection: 'column', gap: 0, borderTop: isMobile ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 18, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr', gap: 8 }}>
                <p style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, gridColumn: isMobile ? '1 / -1' : undefined }}>Actions</p>

                {/* Edit */}
                <button onClick={() => { setEditListing(listing); }} style={{ ...btnBase, border: '1px solid rgba(56,189,248,0.25)', color: '#64b4ff' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Pencil style={{ width: 14, height: 14, flexShrink: 0 }} />Edit Listing
                </button>

                {/* TikTok */}
                <button onClick={() => setTiktokListing(listing)} style={{ ...btnBase, border: '1px solid rgba(255,100,100,0.25)', color: '#ff6b6b' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Video style={{ width: 14, height: 14, flexShrink: 0 }} />ShiftOS Studio
                </button>

                {/* Price */}
                <button onClick={() => setPriceEditListing(listing)} style={{ ...btnBase, border: '1px solid rgba(59,130,246,0.3)', color: '#ef4444' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Tag style={{ width: 14, height: 14, flexShrink: 0 }} />Change Price
                </button>

                {/* Copy */}
                <button onClick={() => copyListing(listing)} style={{ ...btnBase, border: '1px solid rgba(139,195,74,0.25)', color: copiedListingId === listing.id ? '#4ade80' : '#8bc34a' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  {copiedListingId === listing.id ? <Check style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Clipboard style={{ width: 14, height: 14, flexShrink: 0 }} />}
                  {copiedListingId === listing.id ? 'Copied!' : 'Copy Writing'}
                </button>

                {/* Financing Calculator */}
                <button onClick={() => setCalcOpen(true)} style={{ ...btnBase, border: '1px solid rgba(59,130,246,0.25)', color: '#ef4444' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Calculator style={{ width: 14, height: 14, flexShrink: 0 }} />Financing Calc
                </button>

                {/* Assign */}
                <div style={{ position: 'relative', gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <button onClick={() => setShowAssign(v => !v)} style={{ ...btnBase, border: '1px solid rgba(100,180,255,0.25)', color: '#64b4ff' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                    <UserPlus style={{ width: 14, height: 14, flexShrink: 0 }} />Assign Salesman
                  </button>
                  {showAssign && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 4, background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, boxShadow: '0 -8px 32px rgba(0,0,0,0.7)', zIndex: 60, overflow: 'hidden', padding: '4px 0' }}>
                      {listing.assigned_to && (
                        <button onClick={() => { handleUnassign(listing.id); setShowAssign(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>
                          <X style={{ width: 12, height: 12 }} />Unassign
                        </button>
                      )}
                      {salesmen.map(s => (
                        <button key={s.id} onClick={() => { handleAssign(listing.id, s.id, s.full_name); setShowAssign(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: listing.assigned_to === s.id ? 'rgba(168,85,247,0.1)' : 'none', border: 'none', color: listing.assigned_to === s.id ? '#c084fc' : '#d1d5db', fontSize: 12, cursor: 'pointer' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(s.full_name || 'S')[0].toUpperCase()}</div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name || 'Unknown'}</span>
                          {listing.assigned_to === s.id && <Check style={{ width: 11, height: 11, marginLeft: 'auto', flexShrink: 0 }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mark Sold */}
                {!isSold && (
                  <button onClick={() => setMarkSoldListing(listing)} style={{ ...btnBase, border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                    <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />Mark as Sold
                  </button>
                )}

                {/* Delete */}
                <button onClick={() => { setDeleteId(listing.id); onClose(); }} style={{ ...btnBase, border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Trash2 style={{ width: 14, height: 14, flexShrink: 0 }} />Delete Listing
                </button>

                {/* Metadata */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 12, marginTop: 4, gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>Listed {age === 0 ? 'today' : `${age} day${age !== 1 ? 's' : ''} ago`}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: sCfg.dot, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: sCfg.tx, textTransform: 'capitalize' }}>{listing.status || 'available'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lbOpen && (
        <div
          onClick={() => setLbOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Close */}
          <button
            onClick={() => setLbOpen(false)}
            style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e5e5e5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
          {/* Counter */}
          {images.length > 1 && (
            <span style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: '#9ca3af', background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '4px 12px' }}>
              {imgIdx + 1} / {images.length}
            </span>
          )}
          {/* Prev */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + images.length) % images.length); }}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e5e5e5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft style={{ width: 22, height: 22 }} />
            </button>
          )}
          {/* Image */}
          <img
            src={images[imgIdx]}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 'calc(100vw - 120px)', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4, display: 'block' }}
          />
          {/* Next */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % images.length); }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e5e5e5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight style={{ width: 22, height: 22 }} />
            </button>
          )}
        </div>
      )}

      {/* Financing Calculator modal */}
      {calcOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'DM Sans',sans-serif" }}
        >
          <div style={{ width: '100%', maxWidth: 860, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <p style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>Financing &amp; Cost Calculator</p>
                <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>{listing.brand} {listing.model}{listing.variant ? ` ${listing.variant}` : ''}</p>
              </div>
              <button onClick={() => setCalcOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <FinancingCalculator
                initialPrice={listing.selling_price || listing.price}
                engineCc={listing.engine_cc}
                bodyType={listing.body_type}
                carName={`${listing.brand} ${listing.model}${listing.variant ? ` ${listing.variant}` : ''}`}
                carYear={listing.year ? String(listing.year) : ''}
                carColor={listing.colour || ''}
                flat
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── StockTab ─────────────────────────────────────────────────────────────────
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
            <button onClick={() => navigate('/dashboard/import-stock')} className="flex items-center gap-2 text-sm font-semibold text-white px-3 py-1.5 rounded-lg" style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}><Upload className="w-3.5 h-3.5" />Import Stock</button>
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

// ─── DocumentsTab ─────────────────────────────────────────────────────────────
const EMPTY_GEN_FORM = {
  doc_type: 'Sales Agreement', listing_id: '', buyer_name: '', buyer_ic: '',
  buyer_phone: '+60', buyer_address: '', sale_price: '', deposit_amount: '',
  // SA fields
  sa_name: '', sa_phone: '', sa_ic: '',
  // Financing fields
  include_financing: false,
  loan_amount: '', interest_rate: '', loan_tenure_months: '', monthly_payment: '', financing_bank: '',
};

function DocumentsTab({ userId, listings, prefillDocData, onClearPrefill, profile }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGen, setShowGen] = useState(false);
  const [genForm, setGenForm] = useState({ ...EMPTY_GEN_FORM });
  const [genSaving, setGenSaving] = useState(false);
  const [printDoc, setPrintDoc] = useState(null);
  const [listingDropOpen, setListingDropOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  const DOC_TYPES = ['Sales Agreement', 'Deposit Receipt', 'Handover Checklist'];

  // Pre-fill from Enquiries shortcut
  useEffect(() => {
    if (!prefillDocData) return;
    const prefillListing = prefillDocData.listing_id ? listings.find(l => l.id === prefillDocData.listing_id) || null : null;
    setSelectedListing(prefillListing);
    setGenForm(p => ({
      ...p,
      doc_type: prefillDocData.doc_type || 'Sales Agreement',
      buyer_name: prefillDocData.buyer_name || '',
      buyer_phone: prefillDocData.buyer_phone || '+60',
      listing_id: prefillDocData.listing_id || '',
      sale_price: prefillListing?.selling_price ? String(prefillListing.selling_price) : p.sale_price,
      sa_name: profile?.full_name || '',
      sa_phone: profile?.whatsapp_number || '',
    }));
    setShowGen(true);
    onClearPrefill?.();
  }, [prefillDocData]);

  // Pre-fill SA name when opening modal
  useEffect(() => {
    if (showGen && profile) {
      setGenForm(p => ({
        ...p,
        sa_name: p.sa_name || profile.full_name || '',
        sa_phone: p.sa_phone || profile.whatsapp_number || '',
      }));
    }
  }, [showGen]);

  // Generic document form calculator — not the same as the standard car estimate in utils/financing.js.
  // This one accepts user-specified rate and tenure from form inputs.
  const calcLoanPayment = (amount, rate, months) => {
    const a = parseFloat(amount), r = parseFloat(rate), m = parseInt(months);
    if (!a || !r || !m) return '';
    return ((a + a * (r / 100) * (m / 12)) / m).toFixed(2);
  };

  const gf = (field, value) => {
    setGenForm(p => {
      const next = { ...p, [field]: value };
      if (['loan_amount', 'interest_rate', 'loan_tenure_months'].includes(field)) {
        next.monthly_payment = calcLoanPayment(
          field === 'loan_amount' ? value : next.loan_amount,
          field === 'interest_rate' ? value : next.interest_rate,
          field === 'loan_tenure_months' ? value : next.loan_tenure_months,
        );
      }
      return next;
    });
  };

  const handleListingSelect = (listing) => {
    setSelectedListing(listing);
    setGenForm(p => ({
      ...p,
      listing_id: listing.id,
      sale_price: listing.selling_price ? String(listing.selling_price) : p.sale_price,
    }));
    setListingDropOpen(false);
  };

  const fetchDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dealer_documents')
      .select('*, car_listings(brand, model, year, plate_number)')
      .eq('dealer_id', userId)
      .order('issued_at', { ascending: false });
    setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchDocs(); }, [userId]);

  const handleGenerate = async () => {
    setGenSaving(true);
    const car = selectedListing || listings.find(l => l.id === genForm.listing_id) || null;
    try {
      const { data, error } = await supabase.from('dealer_documents').insert({
        dealer_id: userId,
        listing_id: genForm.listing_id || null,
        buyer_name: genForm.buyer_name,
        buyer_ic: genForm.buyer_ic,
        buyer_phone: genForm.buyer_phone,
        buyer_address: genForm.buyer_address,
        doc_type: genForm.doc_type,
        sale_price: Number(genForm.sale_price) || 0,
        deposit_amount: Number(genForm.deposit_amount) || 0,
        balance_amount: Math.max(0, (Number(genForm.sale_price) || 0) - (Number(genForm.deposit_amount) || 0)),
        issued_at: new Date().toISOString(),
        metadata: {
          car_label: car ? `${car.year} ${car.brand} ${car.model}` : '',
          car_colour: car?.colour || '',
          car_plate: car?.plate_number || '',
          car_mileage: car?.mileage || '',
          car_vin: car?.vin_number || '',
          included_services: car?.included_services || [],
          sa_name: genForm.sa_name,
          sa_phone: genForm.sa_phone,
          sa_ic: genForm.sa_ic,
          include_financing: genForm.include_financing,
          loan_amount: genForm.loan_amount,
          interest_rate: genForm.interest_rate,
          loan_tenure_months: genForm.loan_tenure_months,
          monthly_payment: genForm.monthly_payment,
          financing_bank: genForm.financing_bank,
        },
      }).select().single();
      if (error) throw error;
      setShowGen(false);
      setSelectedListing(null);
      setGenForm({ ...EMPTY_GEN_FORM });
      if (data) setPrintDoc({ ...data, car_listings: car });
      fetchDocs();
    } catch (err) {
      console.error('[DocumentsTab] handleGenerate error:', err.message, err);
      toast.error(`Failed to save document: ${err.message}`);
    } finally {
      setGenSaving(false);
    }
  };

  const renderDocHTML = (doc) => {
    const car = doc.car_listings || {};
    const m = doc.metadata || {};
    const carLabel = m.car_label || (car.brand ? `${car.year || ''} ${car.brand} ${car.model}` : '—');
    const carPlate  = m.car_plate  || car.plate_number || '—';
    const carColour = m.car_colour || car.colour       || '—';
    const carMileage = m.car_mileage || car.mileage     || null;
    const carVin    = m.car_vin    || car.vin_number   || '—';
    const issued = doc.issued_at ? new Date(doc.issued_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const isHandover = doc.doc_type === 'Handover Checklist';
    const isDeposit  = doc.doc_type === 'Deposit Receipt';
    const isSales    = doc.doc_type === 'Sales Agreement';
    const services   = m.included_services || [];
    const saName     = m.sa_name  || '—';
    const saPhone    = m.sa_phone || '—';
    const saIc       = m.sa_ic    || '—';
    const hasFinancing = isSales && m.include_financing && m.loan_amount;

    const row = (label, value) =>
      `<tr><td style="padding:5px 0;font-size:13px;color:#555;width:180px;">${label}</td><td style="padding:5px 0;font-size:13px;">${value || '—'}</td></tr>`;

    const section = (title, content) =>
      `<div style="margin-bottom:22px;"><h3 style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;border-bottom:1px solid #e5e5e5;padding-bottom:6px;margin:0 0 10px;">${title}</h3>${content}</div>`;

    return `
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:40px;color:#111;background:#fff;">
        <div style="text-align:center;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #111;">
          <h1 style="font-size:21px;font-weight:800;margin:0 0 4px;">${doc.doc_type.toUpperCase()}</h1>
          <p style="font-size:12px;color:#555;margin:0;">Date: ${issued}</p>
        </div>

        ${section('Vehicle Details', `
          <table style="width:100%;border-collapse:collapse;">
            ${row('Vehicle', `<strong>${carLabel}</strong>`)}
            ${row('Plate Number', carPlate)}
            ${row('Colour', carColour)}
            ${carMileage ? row('Mileage', `${Number(carMileage).toLocaleString()} km`) : ''}
            ${carVin !== '—' ? row('VIN / Chassis', carVin) : ''}
          </table>`)}

        ${section('Buyer Details', `
          <table style="width:100%;border-collapse:collapse;">
            ${row('Full Name', doc.buyer_name)}
            ${row('IC Number', doc.buyer_ic)}
            ${row('Phone', doc.buyer_phone)}
            ${row('Address', doc.buyer_address)}
          </table>`)}

        ${isHandover ? section('Handover Checklist',
          ['Spare keys','Service booklet','Road tax','Insurance document','Owner manual','Spare tyre','Jack & tools','Accessories agreed']
            .map(item => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f0f0f0;"><div style="width:16px;height:16px;border:2px solid #333;border-radius:3px;flex-shrink:0;"></div><span style="font-size:13px;">${item}</span></div>`).join('')
        ) : section('Financial Summary', `
          <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:1px solid #e5e5e5;"><th style="text-align:left;padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;">Description</th><th style="text-align:right;padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;">Amount</th></tr>
            ${isDeposit
              ? `<tr><td style="padding:8px 0;font-size:13px;">Deposit for ${carLabel}</td><td style="text-align:right;font-size:13px;font-weight:600;">RM ${Number(doc.deposit_amount||0).toLocaleString()}</td></tr>`
              : `<tr><td style="padding:8px 0;font-size:13px;">Sale Price</td><td style="text-align:right;font-size:13px;">RM ${Number(doc.sale_price||0).toLocaleString()}</td></tr>
                 <tr><td style="padding:8px 0;font-size:13px;">Deposit Paid</td><td style="text-align:right;font-size:13px;">RM ${Number(doc.deposit_amount||0).toLocaleString()}</td></tr>
                 <tr style="border-top:2px solid #111;"><td style="padding:8px 0;font-size:14px;font-weight:700;">Balance Due</td><td style="text-align:right;font-size:14px;font-weight:700;">RM ${Number(doc.balance_amount||0).toLocaleString()}</td></tr>`
            }
          </table>`)}

        ${hasFinancing ? section('Financing Details', `
          <table style="width:100%;border-collapse:collapse;">
            ${row('Financing Bank', m.financing_bank)}
            ${row('Loan Amount', `RM ${Number(m.loan_amount).toLocaleString()}`)}
            ${row('Interest Rate', `${m.interest_rate}% p.a.`)}
            ${row('Tenure', `${m.loan_tenure_months} months`)}
            ${m.monthly_payment ? row('Monthly Payment', `RM ${Number(m.monthly_payment).toLocaleString()}`) : ''}
          </table>`) : ''}

        ${isSales && services.length > 0 ? section('Included Services / Packages', `
          <table style="width:100%;border-collapse:collapse;">
            ${services.map(s => `<tr><td style="padding:5px 0;font-size:13px;">${s.name || '—'}</td><td style="text-align:right;font-size:13px;color:#555;">RM ${Number(s.selling_price||0).toLocaleString()}</td></tr>`).join('')}
          </table>`) : ''}

        ${isSales ? section('Sales Advisor', `
          <table style="width:100%;border-collapse:collapse;">
            ${row('Name', saName)}
            ${row('Phone', saPhone)}
            ${saIc !== '—' ? row('IC Number', saIc) : ''}
          </table>`) : ''}

        <div style="margin-top:56px;display:grid;grid-template-columns:1fr 1fr;gap:48px;">
          <div style="border-top:1px solid #111;padding-top:8px;">
            <p style="font-size:12px;color:#555;margin:0 0 2px;">Buyer Signature</p>
            <p style="font-size:11px;color:#aaa;margin:0;">${doc.buyer_name || ''}</p>
            <p style="font-size:11px;color:#aaa;margin:24px 0 0;">Date: _______________</p>
          </div>
          <div style="border-top:1px solid #111;padding-top:8px;">
            <p style="font-size:12px;color:#555;margin:0 0 2px;">Sales Advisor Signature</p>
            <p style="font-size:11px;color:#aaa;margin:0;">${saName}</p>
            <p style="font-size:11px;color:#aaa;margin:24px 0 0;">Date: _______________</p>
          </div>
        </div>
      </div>`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={T.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Documents</h2>
          <button onClick={() => setShowGen(true)} className="flex items-center gap-2 text-sm font-semibold text-white px-3 py-1.5 rounded-lg" style={T.btnRed}><FileText className="w-3.5 h-3.5" />Generate</button>
        </div>
        <div className="table-wrap">
          {loading ? (
            <p className="text-gray-500 text-sm p-6">Loading...</p>
          ) : documents.length === 0 ? (
            <p className="text-gray-600 text-sm p-6">No documents generated yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans', sans-serif" }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Type', 'Buyer', 'Car', 'Issued', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px' }}><span style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '2px 8px' }}>{doc.doc_type}</span></td>
                    <td style={{ padding: '12px 14px', color: '#f3f4f6', fontSize: 13, fontWeight: 500 }}>{doc.buyer_name || '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: 13 }}>{doc.car_label || (doc.car_listings ? `${doc.car_listings.brand} ${doc.car_listings.model}` : '—')}</td>
                    <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>{doc.issued_at ? new Date(doc.issued_at).toLocaleDateString('en-MY') : '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => setPrintDoc(doc)} className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#9ca3af', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}><Printer className="w-3 h-3" />Print</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Generate Modal */}
      {showGen && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col" style={undefined}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white">Generate Document</h3>
              <button onClick={() => setShowGen(false)} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Document Type</label>
                <select value={genForm.doc_type} onChange={e => setGenForm(p => ({ ...p, doc_type: e.target.value }))} className={iCls} style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {DOC_TYPES.map(t => <option key={t} value={t} style={{ background: '#111118' }}>{t}</option>)}
                </select>
              </div>
              {/* Rich Car Listing Selector */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Car Listing</label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setListingDropOpen(p => !p)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {selectedListing ? (
                      <>
                        {selectedListing.images?.[0] ? (
                          <img src={selectedListing.images[0]} alt="" style={{ width: 44, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 44, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Car style={{ width: 18, height: 18, color: '#6b7280' }} />
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedListing.year} {selectedListing.brand} {selectedListing.model}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 1 }}>
                            {selectedListing.plate_number && <span>{selectedListing.plate_number}</span>}
                            {selectedListing.colour && <span>{selectedListing.colour}</span>}
                            {selectedListing.mileage && <span>{Number(selectedListing.mileage).toLocaleString()} km</span>}
                          </div>
                        </div>
                        {selectedListing.selling_price && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', flexShrink: 0 }}>RM {Number(selectedListing.selling_price).toLocaleString()}</span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: '#6b7280' }}>Select a listing…</span>
                    )}
                    <ChevronDown style={{ width: 16, height: 16, color: '#6b7280', marginLeft: 'auto', flexShrink: 0 }} />
                  </button>
                  {listingDropOpen && (
                    <>
                      <div onClick={() => setListingDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, zIndex: 50, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                        {listings.length === 0 ? (
                          <div style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>No active listings</div>
                        ) : listings.map(l => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleListingSelect(l)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: genForm.listing_id === l.id ? 'rgba(220,38,38,0.1)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Sans', sans-serif', transition: 'background 0.15s" }}
                            onMouseEnter={e => { if (genForm.listing_id !== l.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            onMouseLeave={e => { if (genForm.listing_id !== l.id) e.currentTarget.style.background = 'transparent'; }}
                          >
                            {l.images?.[0] ? (
                              <img src={l.images[0]} alt="" style={{ width: 44, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 44, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Car style={{ width: 16, height: 16, color: '#6b7280' }} />
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.year} {l.brand} {l.model}</div>
                              <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 8, marginTop: 1 }}>
                                {l.plate_number && <span>{l.plate_number}</span>}
                                {l.colour && <span>{l.colour}</span>}
                                {l.mileage && <span>{Number(l.mileage).toLocaleString()} km</span>}
                              </div>
                            </div>
                            {l.selling_price && (
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', flexShrink: 0 }}>RM {Number(l.selling_price).toLocaleString()}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Buyer Name</label><input value={genForm.buyer_name} onChange={e => setGenForm(p => ({ ...p, buyer_name: e.target.value }))} placeholder="Ahmad" className={iCls} /></div>
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Buyer IC</label><input value={genForm.buyer_ic} onChange={e => setGenForm(p => ({ ...p, buyer_ic: e.target.value }))} placeholder="XXXXXX-XX-XXXX" className={iCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Phone</label><div className={`flex items-center overflow-hidden ${iCls}`} style={{padding:0}}><span className="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-700 bg-gray-800/50 flex-shrink-0">+60</span><input type="tel" value={(genForm.buyer_phone||'').replace(/^\+?60/,'')} onChange={e => setGenForm(p => ({ ...p, buyer_phone: '+60'+e.target.value.replace(/\D/g,'') }))} placeholder="X-XXXXXXX" className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2.5" /></div></div>
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Sale Price (RM)</label><input type="number" value={genForm.sale_price} onChange={e => setGenForm(p => ({ ...p, sale_price: e.target.value }))} placeholder="0" className={iCls} /></div>
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Buyer Address</label><textarea value={genForm.buyer_address} onChange={e => setGenForm(p => ({ ...p, buyer_address: e.target.value }))} rows={2} className={taCls} placeholder="Full address" /></div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Deposit Amount (RM)</label><input type="number" value={genForm.deposit_amount} onChange={e => setGenForm(p => ({ ...p, deposit_amount: e.target.value }))} placeholder="0" className={iCls} /></div>

              {/* Sales Advisor Details */}
              <div style={{ paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Sales Advisor</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Name</label><input value={genForm.sa_name} onChange={e => setGenForm(p => ({ ...p, sa_name: e.target.value }))} placeholder="SA Name" className={iCls} /></div>
                  <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Phone</label><div className={`flex items-center overflow-hidden ${iCls}`} style={{padding:0}}><span className="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-700 bg-gray-800/50 flex-shrink-0">+60</span><input type="tel" value={(genForm.sa_phone||'').replace(/^\+?60/,'')} onChange={e => setGenForm(p => ({ ...p, sa_phone: '+60'+e.target.value.replace(/\D/g,'') }))} placeholder="X-XXXXXXX" className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2.5" /></div></div>
                </div>
                <div style={{ marginTop: 10 }}><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">IC Number</label><input value={genForm.sa_ic} onChange={e => setGenForm(p => ({ ...p, sa_ic: e.target.value }))} placeholder="XXXXXX-XX-XXXX" className={iCls} /></div>
              </div>

              {/* Financing — Sales Agreement only */}
              {genForm.doc_type === 'Sales Agreement' && (
                <div style={{ paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: genForm.include_financing ? 12 : 0 }}>
                    <input type="checkbox" checked={genForm.include_financing} onChange={e => setGenForm(p => ({ ...p, include_financing: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#dc2626' }} />
                    <span style={{ fontSize: 13, color: '#d1d5db', fontFamily: "'DM Sans', sans-serif" }}>Include Financing Details</span>
                  </label>
                  {genForm.include_financing && (
                    <div className="space-y-3">
                      <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Financing Bank</label><input value={genForm.financing_bank} onChange={e => gf('financing_bank', e.target.value)} placeholder="e.g. Maybank, CIMB" className={iCls} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Loan Amount (RM)</label><input type="number" value={genForm.loan_amount} onChange={e => gf('loan_amount', e.target.value)} placeholder="0" className={iCls} /></div>
                        <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Interest Rate (% p.a.)</label><input type="number" step="0.01" value={genForm.interest_rate} onChange={e => gf('interest_rate', e.target.value)} placeholder="3.5" className={iCls} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Tenure (months)</label><input type="number" value={genForm.loan_tenure_months} onChange={e => gf('loan_tenure_months', e.target.value)} placeholder="84" className={iCls} /></div>
                        <div>
                          <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Monthly Payment (RM)</label>
                          <div style={{ position: 'relative' }}>
                            <input readOnly value={genForm.monthly_payment ? `RM ${Number(genForm.monthly_payment).toLocaleString()}` : '—'} className={iCls} style={{ color: '#4ade80', background: 'rgba(74,222,128,0.05)', cursor: 'default' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-white/[0.06] flex gap-3">
              <button onClick={() => setShowGen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
              <button onClick={handleGenerate} disabled={genSaving} className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>{genSaving ? 'Generating...' : 'Generate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printDoc && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ ...T.modal, background: '#fff' }}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 text-sm">{printDoc.doc_type}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { const w = window.open('','_blank'); w.document.write(`<html><head><title>${printDoc.doc_type}</title><style>@media print{body{margin:0;}}</style></head><body>${renderDocHTML(printDoc)}</body></html>`); w.document.close(); w.print(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={T.btnRed}><Printer className="w-3.5 h-3.5" />Print</button>
                <button onClick={() => setPrintDoc(null)} className="text-gray-500 hover:text-gray-800 p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderDocHTML(printDoc) }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Outreach Hub ─────────────────────────────────────────────────────────────
function OutreachHub({ dealerId, listings }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [segment, setSegment]     = useState('hot');
  const [selectedId, setSelectedId] = useState(null);
  const [template, setTemplate]   = useState('followup');
  const [sentToday, setSentToday] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!dealerId) return;
    setLoading(true);
    supabase
      .from('whatsapp_enquiries')
      .select('id, buyer_name, buyer_phone, created_at, source, listing:listing_id(brand, model, selling_price, year, slug)')
      .eq('dealer_id', dealerId)
      .order('created_at', { ascending: false })
      .limit(400)
      .then(({ data }) => { setEnquiries(data || []); setLoading(false); });
  }, [dealerId, refreshKey]);

  const now  = Date.now();
  const DAY  = 86400000;

  // Dedupe by normalised phone — keep the newest per buyer
  const deduped = useMemo(() => {
    const seen = new Map();
    (enquiries || []).forEach(e => {
      const key = (e.buyer_phone || e.id).replace(/\D/g, '');
      if (!seen.has(key)) seen.set(key, e);
    });
    return Array.from(seen.values());
  }, [enquiries]);

  // Attach score + urgency
  const scored = useMemo(() => deduped.map(e => {
    const ageDays  = (now - new Date(e.created_at).getTime()) / DAY;
    const ageHours = ageDays * 24;
    let score, urgency;
    if (ageHours < 1)       { score = 98; urgency = 'critical'; }
    else if (ageHours < 6)  { score = 90; urgency = 'high';     }
    else if (ageHours < 24) { score = 74; urgency = 'medium';   }
    else if (ageDays < 3)   { score = 54; urgency = 'low';      }
    else if (ageDays < 7)   { score = 34; urgency = 'warm';     }
    else                    { score = 14; urgency = 'cold';      }
    return { ...e, ageDays, ageHours, score, urgency };
  }), [deduped]);

  const SEGS = {
    hot:  { label: 'Hot',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   emoji: '🔥', filter: e => e.ageDays < 1 },
    warm: { label: 'Warm',  color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.2)',  emoji: '🌡️', filter: e => e.ageDays >= 1 && e.ageDays < 7 },
    cold: { label: 'Cold',  color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)',  emoji: '🧊', filter: e => e.ageDays >= 7 },
    all:  { label: 'All',   color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', emoji: '📋', filter: () => true },
  };

  const visibleLeads = useMemo(() =>
    scored.filter(SEGS[segment].filter).sort((a, b) => a.ageDays - b.ageDays)
  , [scored, segment]);

  const selected = scored.find(e => e.id === selectedId) || null;

  const TEMPLATES = {
    followup: {
      label: 'Follow-Up',  icon: '👋',
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! 👋\n\nJust following up on your enquiry about the ${e.listing?.year || ''} ${e.listing?.brand || ''} ${e.listing?.model || ''}${e.listing?.selling_price ? ` (RM ${e.listing.selling_price.toLocaleString()})` : ''}.\n\nAre you still looking? I'd love to help you arrange a viewing at your convenience 🚗\n\nReply anytime — happy to help!`,
    },
    viewing: {
      label: 'Book Viewing', icon: '📅',
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! 📅\n\nThe ${e.listing?.brand || ''} ${e.listing?.model || ''} is available for a test drive this week.\n\nWhich day works for you? We can arrange morning or afternoon. Looking forward to having you in! 🔑`,
    },
    price_drop: {
      label: 'Price Alert',  icon: '📉',
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! 🎉\n\nGreat news — the ${e.listing?.brand || ''} ${e.listing?.model || ''} you enquired about has just been repriced!\n\n💰 Current Price: RM ${e.listing?.selling_price?.toLocaleString() || '—'}\n\nThis is a limited opportunity. Shall I reserve it for you? Just reply YES and I'll hold it! ✅`,
    },
    last_chance: {
      label: 'Last Chance',  icon: '⏰',
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! ⏰\n\nQuick heads-up: the ${e.listing?.brand || ''} ${e.listing?.model || ''} is getting a lot of interest lately.\n\nIf you're still considering it, now's the time! I can hold it for 24h with a small deposit.\n\nLet me know! 🚗`,
    },
  };

  const urgencyColor = { critical:'#ef4444', high:'#f97316', medium:'#fbbf24', low:'#a3e635', warm:'#60a5fa', cold:'#94a3b8' };

  const fmtAge = e => {
    if (e.ageHours < 1)  return `${Math.round(e.ageHours * 60)}m ago`;
    if (e.ageHours < 24) return `${Math.round(e.ageHours)}h ago`;
    return `${Math.round(e.ageDays)}d ago`;
  };

  const openWA = (lead, msg) => {
    const raw = (lead.buyer_phone || '').replace(/\D/g, '');
    if (!raw) { toast.error('No phone number'); return; }
    const phone = raw.startsWith('6') ? raw : '6' + raw;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setSentToday(p => p + 1);
    toast.success(`WhatsApp opened for ${lead.buyer_name || 'lead'}`, { duration: 1800 });
  };

  const launchCampaign = () => {
    if (!visibleLeads.length) { toast.error('No leads in this segment'); return; }
    const batch = visibleLeads.slice(0, 10);
    batch.forEach((lead, i) => setTimeout(() => openWA(lead, TEMPLATES[template].gen(lead)), i * 750));
    toast.success(`Launching ${batch.length} WhatsApp chats…`);
  };

  // Pulse numbers
  const hotCount  = scored.filter(e => e.ageDays < 1).length;
  const staleCount = scored.filter(e => e.ageDays >= 7).length;
  const critCount = scored.filter(e => e.urgency === 'critical').length;

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:320, color:'#4b5563', fontSize:13, gap:10 }}>
      <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }} /> Loading contacts…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", animation:'slideUp 0.3s ease' }}>

      {/* ── Top pulse bar ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Total Contacts',  val: scored.length,  sub:'Unique enquiries', color:'#60a5fa', emoji:'👥', pulse:false },
          { label:'Hot Right Now',   val: hotCount,        sub:'Enquired < 24h',   color:'#ef4444', emoji:'🔥', pulse: critCount > 0 },
          { label:'Need Re-engage',  val: staleCount,      sub:'Silent 7+ days',   color:'#a78bfa', emoji:'🧊', pulse:false },
          { label:'Sent Today',      val: sentToday,       sub:'This session',      color:'#34d399', emoji:'✅', pulse:false },
        ].map(({ label, val, sub, color, emoji, pulse }) => (
          <div key={label} className="card-top" style={{ background:`${color}0d`, border:`1px solid ${color}20`, borderRadius:14, padding:'16px 18px', position:'relative', overflow:'hidden' }}>
            {pulse && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color},transparent)`, animation:'hotpulse 2s ease-in-out infinite' }} />}
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
              <span style={{ fontSize:16 }}>{emoji}</span>
              <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.15em', color:'#374151', fontWeight:700 }}>{label}</p>
            </div>
            <p style={{ fontSize:30, fontWeight:800, color, lineHeight:1, marginBottom:3 }}>{val}</p>
            <p style={{ fontSize:11, color:'#4b5563' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Two-column body ── */}
      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:14, marginBottom:14 }}>

        {/* LEFT — Lead list */}
        <div style={{ background:'rgba(255,255,255,0.018)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Segment tabs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            {Object.entries(SEGS).map(([key, seg]) => {
              const count = scored.filter(seg.filter).length;
              const active = segment === key;
              return (
                <button key={key} onClick={() => setSegment(key)}
                  style={{ padding:'10px 6px 12px', background:'none', border:'none', borderBottom: active ? `2px solid ${seg.color}` : '2px solid transparent', color: active ? seg.color : '#374151', fontFamily:"'DM Sans',sans-serif", cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, marginBottom:-1, transition:'all 0.15s' }}>
                  <span style={{ fontSize:15 }}>{seg.emoji}</span>
                  <span style={{ fontSize:10, fontWeight: active ? 700 : 500 }}>{seg.label}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background: active ? `${seg.color}18` : 'rgba(255,255,255,0.04)', color: active ? seg.color : '#374151' }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Lead scroll */}
          <div style={{ overflowY:'auto', flex:1, maxHeight:440, padding:8 }}>
            {visibleLeads.length === 0 ? (
              <div style={{ padding:'40px 16px', textAlign:'center', color:'#374151', fontSize:13 }}>
                <p style={{ fontSize:28, marginBottom:8 }}>{SEGS[segment].emoji}</p>
                <p>No {SEGS[segment].label.toLowerCase()} leads</p>
                <p style={{ fontSize:11, marginTop:4, color:'#1e293b' }}>Enquiries appear here as they come in</p>
              </div>
            ) : visibleLeads.map(lead => {
              const isActive = selectedId === lead.id;
              const uc = urgencyColor[lead.urgency] || '#94a3b8';
              const circumference = 2 * Math.PI * 14;
              const dash = (lead.score / 100) * circumference;
              return (
                <button key={lead.id} onClick={() => setSelectedId(isActive ? null : lead.id)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:10, background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent', border: isActive ? '1px solid rgba(59,130,246,0.28)' : '1px solid transparent', cursor:'pointer', textAlign:'left', transition:'all 0.15s', marginBottom:3 }}>
                  {/* SVG score ring */}
                  <div style={{ flexShrink:0, position:'relative', width:34, height:34 }}>
                    <svg width="34" height="34" viewBox="0 0 34 34" style={{ transform:'rotate(-90deg)' }}>
                      <circle cx="17" cy="17" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                      <circle cx="17" cy="17" r="14" fill="none" stroke={uc} strokeWidth="3" strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
                    </svg>
                    <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:uc }}>{lead.score}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'#f9fafb', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.buyer_name || 'Unknown'}</span>
                      <span style={{ fontSize:9, fontWeight:700, color:uc, flexShrink:0, padding:'1px 6px', background:`${uc}14`, borderRadius:4 }}>{fmtAge(lead)}</span>
                    </div>
                    <span style={{ fontSize:11, color:'#4b5563', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                      {lead.listing ? `${lead.listing.brand} ${lead.listing.model}` : 'Car enquiry'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Refresh footer */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, color:'#1e293b' }}>{scored.length} unique contacts</span>
            <button onClick={() => { setLoading(true); setRefreshKey(k => k + 1); }} style={{ background:'none', border:'none', color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontFamily:"'DM Sans',sans-serif", padding:'2px 6px', borderRadius:6, transition:'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color='#94a3b8'} onMouseLeave={e => e.currentTarget.style.color='#374151'}>
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>

        {/* RIGHT — Message Studio */}
        <div style={{ background:'rgba(255,255,255,0.018)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          {!selected ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, minHeight:340, gap:14, color:'#374151' }}>
              <div style={{ width:56, height:56, borderRadius:16, background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>💬</div>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:14, fontWeight:600, color:'#6b7280', marginBottom:6 }}>Select a contact</p>
                <p style={{ fontSize:12, color:'#374151', lineHeight:1.7 }}>Choose a lead from the list,<br/>pick a message template,<br/>and open WhatsApp with one click.</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:260 }}>
                {[
                  { icon:'🔥', text:'Hot leads need replies within 30 min' },
                  { icon:'⚡', text:'Personalized messages per buyer & car' },
                  { icon:'📈', text:'Campaign blast up to 10 contacts at once' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize:14 }}>{icon}</span>
                    <span style={{ fontSize:11, color:'#4b5563' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Contact header */}
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.18)', borderRadius:12 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,rgba(59,130,246,0.8),rgba(99,102,241,0.8))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:800, color:'white', flexShrink:0 }}>
                  {(selected.buyer_name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:700, color:'white', marginBottom:2 }}>{selected.buyer_name || 'Unknown'}</p>
                  <p style={{ fontSize:11, color:'#6b7280' }}>{selected.buyer_phone} · {fmtAge(selected)}</p>
                </div>
                {selected.listing && (
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:11, color:'#60a5fa', marginBottom:1 }}>{selected.listing.brand} {selected.listing.model}</p>
                    {selected.listing.selling_price && <p style={{ fontSize:13, fontWeight:700, color:'white' }}>RM {selected.listing.selling_price.toLocaleString()}</p>}
                  </div>
                )}
              </div>

              {/* Intent score bar */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.14em', color:'#374151', fontWeight:700, flexShrink:0 }}>Intent Score</p>
                <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${selected.score}%`, background:`linear-gradient(90deg, ${urgencyColor[selected.urgency]}, ${urgencyColor[selected.urgency]}cc)`, borderRadius:3, transition:'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:urgencyColor[selected.urgency], flexShrink:0 }}>{selected.score}/100</span>
              </div>

              {/* Template picker */}
              <div>
                <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.14em', color:'#374151', fontWeight:700, marginBottom:8 }}>Message Template</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {Object.entries(TEMPLATES).map(([key, t]) => (
                    <button key={key} onClick={() => setTemplate(key)}
                      style={{ padding:'9px 12px', borderRadius:9, background: template===key ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)', border: template===key ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.07)', color: template===key ? '#93c5fd' : '#6b7280', fontSize:12, fontWeight: template===key ? 600 : 400, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:6, transition:'all 0.15s', textAlign:'left' }}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message preview */}
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.14em', color:'#374151', fontWeight:700 }}>Preview</p>
                  <span style={{ fontSize:10, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:5, padding:'2px 8px', color:'#4ade80', fontWeight:600 }}>WhatsApp</span>
                </div>
                <div style={{ background:'#0c1018', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'14px 16px', minHeight:120, maxHeight:200, overflowY:'auto' }}>
                  <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.75, whiteSpace:'pre-wrap' }}>{TEMPLATES[template]?.gen(selected)}</p>
                </div>
              </div>

              {/* Send */}
              <button onClick={() => openWA(selected, TEMPLATES[template].gen(selected))} className="btn-shimmer"
                style={{ width:'100%', padding:'14px', borderRadius:12, background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', boxShadow:'0 4px 20px rgba(34,197,94,0.3)', color:'white', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <MessageCircle size={16} /> Open WhatsApp — {(selected.buyer_name || 'Lead').split(' ')[0]}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Bulk Campaign strip ── */}
      <div style={{ background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.18)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(167,139,250,0.4),transparent)' }} />
        <Megaphone size={18} style={{ color:'#a78bfa', flexShrink:0 }} />
        <div style={{ flex:1, minWidth:200 }}>
          <p style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:2 }}>Bulk Campaign · {SEGS[segment].emoji} {SEGS[segment].label} Leads</p>
          <p style={{ fontSize:11, color:'#6b7280', lineHeight:1.5 }}>
            Send the selected template to all {SEGS[segment].label.toLowerCase()} leads.
            {' '}<span style={{ color:'#a78bfa', fontWeight:600 }}>{Math.min(visibleLeads.length, 10)} WhatsApp chats</span> will open one by one (browser must allow popups).
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          {/* Template quick-pick in campaign */}
          <select value={template} onChange={e => setTemplate(e.target.value)}
            style={{ padding:'9px 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:9, color:'#d1d5db', fontSize:12, fontFamily:"'DM Sans',sans-serif", cursor:'pointer', outline:'none' }}>
            {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k} style={{ background:'#111118' }}>{t.icon} {t.label}</option>)}
          </select>
          <button onClick={launchCampaign}
            style={{ padding:'9px 20px', borderRadius:9, background:'rgba(167,139,250,0.18)', border:'1px solid rgba(167,139,250,0.35)', color:'#c4b5fd', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.28)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.18)'; }}>
            <Send size={13} /> Launch ({Math.min(visibleLeads.length, 10)})
          </button>
        </div>
      </div>

      {/* Tips bar */}
      <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
        {[
          { icon:'⚡', tip:'Leads contacted within 5 minutes convert 8× more' },
          { icon:'🔁', tip:'Re-engage cold leads every 2 weeks with a new angle' },
          { icon:'📊', tip:'Price drop alerts have the highest open rate of any template' },
        ].map(({ icon, tip }) => (
          <div key={tip} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:8, flex:'1 1 auto' }}>
            <span style={{ fontSize:13, flexShrink:0 }}>{icon}</span>
            <span style={{ fontSize:11, color:'#374151', lineHeight:1.4 }}>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const redirectByRole = useRoleRedirect("dealer");
  const { status, loading: subLoading } = useSubscription();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("listings");
  const [showFastModal, setShowFastModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tiktokListing, setTiktokListing] = useState(null);
  const [priceEditListing, setPriceEditListing] = useState(null);
  const [markSoldListing, setMarkSoldListing] = useState(null);
  const [markSoldLoading, setMarkSoldLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [editListing, setEditListing] = useState(null);
  const [adjustedStaleIds, setAdjustedStaleIds] = useState(new Set());
  const handleStaleAdjusted = (id) => setAdjustedStaleIds(prev => new Set([...prev, id]));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("available");
  const [copiedListingId, setCopiedListingId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [salesmen,         setSalesmen]         = useState([]);
  const [assignDropdownId, setAssignDropdownId] = useState(null);
  const [assignToast,      setAssignToast]      = useState(null);
  const [detailListing,    setDetailListing]    = useState(null);
  const [svcPopupListing,  setSvcPopupListing]  = useState(null);
  const sidebarBellRef = useRef(null);
  const [sidebarBellRect, setSidebarBellRect] = useState(null);
  const closeNotif = () => { setNotifOpen(false); setSidebarBellRect(null); };
  const [notifications,    setNotifications]    = useState([]);
  const [notifOpen,        setNotifOpen]        = useState(false);
  const [pendingStockListing, setPendingStockListing] = useState(null);
  const [pendingStockForm, setPendingStockForm] = useState({ purchase_price: '', purchase_date: '', purchase_source: '', recon_cost: '' });
  const [pendingStockSaving, setPendingStockSaving] = useState(false);
  const [prefillDocData,   setPrefillDocData]   = useState(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingCopied, setOnboardingCopied] = useState(false);
  const [onboardingToast,  setOnboardingToast]  = useState(false);
  const loadedUidRef = useRef(null);

  const getStorefrontUrl = () => {
    if (!profile?.subdomain || profile?.role === 'superadmin') {
      return 'https://xdrive.my';
    }
    return `https://${profile.subdomain}.xdrive.my`;
  };

  useEffect(() => {
    const name = profile?.site_name || profile?.dealership || "XDrive";
    document.title = `${name} — Admin`;
  }, [profile]);

  useEffect(() => {
    if (sidebarOpen) {
      const y = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${y}px`;
      document.body.style.width = '100%';
    } else {
      const y = parseInt(document.body.style.top || '0', 10);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (y) window.scrollTo(0, -y);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    let active = true;

    // Shared loader — called on first mount AND on every auth state change so
    // switching accounts always loads the correct owner's data.
    const loadSession = async (session) => {
      if (!session) { navigate("/login"); return; }
      // Block unconfirmed accounts from accessing the dashboard
      if (!session.user.email_confirmed_at) {
        navigate("/login?unconfirmed=1", { replace: true });
        return;
      }
      const uid = session.user.id;

      // Reset to a clean slate before populating for this session.
      // Prevents any previous owner's branding from bleeding through.
      setProfile(null);
      setListings([]);
      setSalesmen([]);
      setLoading(true);
      setUserId(uid);

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)   // always scoped to the live session user
        .maybeSingle();
      if (!active) return;

      if (p) {
        if (redirectByRole(p.role)) return;
        if (!["dealer", "superadmin", "admin", "manager", "owner"].includes(p.role)) {
          navigate("/login");
          return;
        }
        setProfile(p);
        loadedUidRef.current = uid;
        // Correct dealer ID for manager/admin roles (their uid ≠ dealer_id)
        const dealerId = getDealerIdFromProfile(p);
        setUserId(dealerId);
      } else {
        navigate("/login");
        return;
      }

      const dealerId = getDealerIdFromProfile(p);
      const { data: cars, error: carsError } = await supabase
        .from("car_listings")
        .select("*")
        .eq("dealer_id", dealerId)
        .order("created_at", { ascending: false });
      if (active) setListings(carsError ? [] : cars || []);

      const { data: sm } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("role", "salesman")
        .eq("dealer_id", dealerId);
      if (active) {
        setSalesmen(sm || []);
        setLoading(false);
      }
    };

    // Fast initial load from cached session
    supabase.auth.getSession().then(({ data }) => loadSession(data.session));

    // Re-run the full loader on every auth event so account-switching is safe.
    // Guard: skip SIGNED_IN for the same user (fires on tab return / token refresh)
    // to prevent the app from wiping state and showing the loading/banner again.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN") {
          if (session?.user?.id && session.user.id === loadedUidRef.current) return;
          loadSession(session);
        }
        else if (event === "SIGNED_OUT") navigate("/login");
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("dash_listings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "car_listings",
          filter: `dealer_id=eq.${userId}`,
        },
        (payload) => {
          setListings((prev) => {
            if (payload.eventType === "INSERT") {
              if (prev.some((l) => l.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            }
            if (payload.eventType === "UPDATE")
              return prev.map((l) =>
                l.id === payload.new.id ? { ...l, ...payload.new } : l,
              );
            if (payload.eventType === "DELETE")
              return prev.filter((l) => l.id !== payload.old.id);
            return prev;
          });
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  // ── Notifications realtime ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const reload = () =>
      supabase.from('dealer_notifications').select('*').eq('dealer_id', userId)
        .order('created_at', { ascending: false }).limit(20)
        .then(({ data }) => setNotifications(data || []));
    reload();
    const ch = supabase.channel(`notifs_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dealer_notifications', filter: `dealer_id=eq.${userId}` }, reload)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear(); // prevent stale branding from a previous session bleeding through
    window.location.href = 'https://xdrive.my/login';
  };
  const handleNew = (l) => {
    setListings((p) => [l, ...p]);
    setActiveTab("listings");
    // Prompt to add stock purchase details
    setPendingStockListing(l);
    setPendingStockForm({ purchase_price: '', purchase_date: new Date().toISOString().slice(0,10), purchase_source: 'Direct Buy', recon_cost: '' });
  };
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };
  const handleDelete = async (id) => {
    const { error } = await supabase
      .from("car_listings")
      .delete()
      .eq("id", id)
      .eq("dealer_id", userId);  // explicit RLS guard
    if (error) {
      console.error("Delete failed:", error.message);
      toast.error("Could not delete listing: " + error.message);
      return;
    }
    setListings((p) => p.filter((l) => l.id !== id));
    if (detailListing?.id === id) setDetailListing(null);
    setDeleteId(null);
  };
  const handleAssign = async (listingId, salesmanId, name) => {
    setAssignDropdownId(null);
    await supabase.from("car_listings").update({ assigned_to: salesmanId }).eq("id", listingId);
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, assigned_to: salesmanId } : l))
    );
    setAssignToast({ listingId, msg: `Assigned to ${name}` });
    setTimeout(() => setAssignToast(null), 2000);
  };
  const handleUnassign = async (listingId) => {
    setAssignDropdownId(null);
    await supabase.from("car_listings").update({ assigned_to: null }).eq("id", listingId);
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, assigned_to: null } : l))
    );
    setAssignToast({ listingId, msg: "Unassigned" });
    setTimeout(() => setAssignToast(null), 2000);
  };
  const handleStatus = async (id, status) => {
    setUpdatingStatus(id);
    try {
      const { data, error } = await supabase
        .from("car_listings")
        .update({ status })
        .eq("id", id)
        .select();
      if (error) throw error;
      setListings((p) =>
        p.map((l) => (l.id === id ? (data?.[0] ?? { ...l, status }) : l)),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingStatus(null);
    }
  };
  const handlePriceSave = (u) =>
    setListings((p) => p.map((l) => (l.id === u.id ? u : l)));
  const handleUpdate = (u) => {
    setListings((p) => p.map((l) => (l.id === u.id ? u : l)));
    // Mark as adjusted only after a real save — not when the form is merely opened
    if (editListing && getListingAge(editListing.created_at) >= 30) {
      handleStaleAdjusted(u.id);
    }
    setEditListing(null);
  };
  const handleProfileUpdate = (updated) => setProfile(updated);

  const handleMarkSold = async () => {
    if (!markSoldListing) return;
    setMarkSoldLoading(true);
    try {
      const { data, error } = await supabase
        .from("car_listings")
        .update({ status: "sold", sold_at: new Date().toISOString() })
        .eq("id", markSoldListing.id)
        .select();
      if (error) throw error;
      const updated = data?.[0] ?? { ...markSoldListing, status: "sold" };
      setListings((p) => p.map((l) => (l.id === updated.id ? updated : l)));
      setMarkSoldListing(null);
    } catch (e) {
      console.error(e);
    }
    setMarkSoldLoading(false);
  };

  const filteredListings = useMemo(() => {
    let result = listings.filter((l) =>
      (l.status || 'available') === statusFilter
    );
    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter((l) =>
      (l.brand || "").toLowerCase().includes(q) ||
      (l.model || "").toLowerCase().includes(q) ||
      (l.variant || "").toLowerCase().includes(q) ||
      (l.vin || "").toLowerCase().includes(q) ||
      (l.vin_number || "").toLowerCase().includes(q)
    );
  }, [listings, searchQuery, statusFilter]);

  const salesmenById = Object.fromEntries(salesmen.map((s) => [s.id, s]));

  const copyListing = (l) => {
    const lines = [
      `🚗 ${l.year} ${l.brand} ${l.model}${l.variant ? " " + l.variant : ""}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📋 DETAILS`,
      l.mileage ? `• Mileage: ${Number(l.mileage).toLocaleString()} km` : null,
      l.engine_cc
        ? `• Engine: ${Number(l.engine_cc).toLocaleString()} cc`
        : null,
      l.transmission ? `• Transmission: ${l.transmission}` : null,
      l.colour ? `• Colour: ${l.colour}` : null,
      l.condition
        ? `• Condition: ${l.condition.charAt(0).toUpperCase() + l.condition.slice(1)}`
        : null,
      l.city || l.state
        ? `• Location: ${[l.city, l.state].filter(Boolean).join(", ")}`
        : null,
      l.vin_number ? `• VIN: ${l.vin_number}` : null,
      ``,
      `💰 PRICE: RM ${(l.selling_price || 0).toLocaleString()}`,
      l.original_price && l.original_price > l.selling_price
        ? `(Was: RM ${l.original_price.toLocaleString()} | Save RM ${(l.original_price - l.selling_price).toLocaleString()})`
        : null,
    ];
    if (l.features) lines.push(``, `✨ FEATURES`, l.features);
    if (l.specs) lines.push(``, `🔧 SPECS`, l.specs);
    if (l.options) lines.push(``, `📝 ABOUT`, l.options);
    const tags = [
      l.brand,
      l.model,
      l.condition,
      l.state,
      "UsedCars",
      "Malaysia",
      "CarForSale",
    ]
      .filter(Boolean)
      .map((t) => `#${t.replace(/\s+/g, "")}`)
      .join(" ");
    lines.push(``, tags);
    navigator.clipboard
      .writeText(lines.filter((x) => x !== null).join("\n"))
      .then(() => {
        setCopiedListingId(l.id);
        setTimeout(() => setCopiedListingId(null), 2000);
      });
  };

  const soldCount = listings.filter((l) => l.status === "sold").length;
  const totalVal = listings.filter(l => l.status !== 'sold').reduce((s, l) => s + (l.selling_price || 0), 0);
  const hotCount = listings.filter(
    (l) =>
      l.original_price &&
      l.selling_price &&
      l.selling_price < l.original_price,
  ).length;
  const soldSpark = bucketByDay(
    listings.filter(l => l.status === 'sold' && l.sold_at).map(l => ({ event_type: 'sold', created_at: l.sold_at })),
    ['sold']
  );

  const STATUS = {
    available: {
      label: "Available",
      dot: "bg-emerald-400",
      cls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
      next: "reserved",
    },
    reserved: {
      label: "Reserved",
      dot: "bg-amber-400",
      cls: "bg-amber-400/10 text-amber-400 border-amber-400/20",
      next: "sold",
    },
    sold: {
      label: "Sold",
      dot: "bg-red-400",
      cls: "bg-blue-400/10 text-blue-400 border-blue-400/20",
      next: "available",
    },
  };

  const StatusBadge = React.memo(({ listing }) => {
    const s = listing.status || "available",
      cfg = STATUS[s] || STATUS.available,
      busy = updatingStatus === listing.id;
    return (
      <button
        onClick={() => handleStatus(listing.id, cfg.next)}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-all ${cfg.cls} ${busy ? "opacity-50 cursor-wait" : "hover:opacity-75 cursor-pointer"}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${busy ? "animate-pulse bg-gray-400" : cfg.dot}`}
        />
        {busy ? "…" : cfg.label}
      </button>
    );
  });

  const Avatar = ({ size = "md" }) => {
    const sz = size === "lg" ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs";
    if (profile?.avatar_url)
      return (
        <img
          src={profile.avatar_url}
          alt=""
          className={`${sz} rounded-full object-cover flex-shrink-0`}
        />
      );
    return (
      <div
        className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.8), rgba(99,102,241,0.8))",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        {(profile?.full_name || profile?.email || "A")[0].toUpperCase()}
      </div>
    );
  };

  const DiscountCell = React.memo(({ listing }) => {
    const op = listing.original_price || listing.previous_price || null,
      sp = listing.selling_price || listing.price || null;
    if (!op || !sp || op <= sp)
      return (
        <span className="grad-white font-semibold text-sm">
          RM {sp?.toLocaleString()}
        </span>
      );
    const pct = Math.round(((op - sp) / op) * 100),
      isHot = pct >= 3;
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <span className="grad-white font-semibold text-sm">
            RM {sp.toLocaleString()}
          </span>
          <span
            className={`discount-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${isHot ? "bg-blue-500/15 text-blue-400 border-blue-500/25 blue-glow" : "bg-amber-500/15 text-amber-400 border-amber-500/25"}`}
          >
            {isHot && <Flame className="w-3 h-3" />}−{pct}%
          </span>
        </div>
        <p className="text-gray-600 text-xs line-through mt-0.5">
          RM {op.toLocaleString()}
        </p>
      </div>
    );
  });

  const condCls = (c) =>
    ({
      new: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
      recon:
        "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25",
      used: "bg-white/[0.06] text-gray-500 border border-white/10",
    })[c] || "bg-white/[0.06] text-gray-500 border border-white/10";

  const GRADE_COLORS = { S:'#a78bfa', 5:'#34d399', '4.5':'#6ee7b7', 4:'#fbbf24', '3.5':'#fb923c', 3:'#93c5fd', R:'#ef4444', RA:'#3b82f6', 2:'#1d4ed8', 1:'#1e3a8a' };
  const gradeColor = (g) => GRADE_COLORS[g] || '#6b7280';
  const fmtDate = (d) => { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };

  const { snapshot, loading: snapshotLoading } = useDealerSnapshot(userId);

  const TITLES = {
    listings: { title: "Listings", sub: "Manage your inventory" },
    add: { title: "Add Listing", sub: "Upload a new car" },
    team: { title: "Team", sub: "Manage salespeople" },
    analytics: { title: "Analytics", sub: "Performance & AI advisor" },
    settings: { title: "Settings", sub: "Dealership, front page & account" },
    crm: { title: "CRM", sub: "Pipeline, enquiries, bookings & leads" },
    hero: {
      title: "Hero Carousel",
      sub: "Manage your XDrive homepage spotlight — up to 5 slides",
    },
    stock: { title: "Stock", sub: "Vehicle stock units & cost tracking" },
    documents: { title: "Documents", sub: "Sales agreements & receipts" },
    revops:    { title: "RevOps",    sub: "Revenue operations & deal health" },
    services:  { title: "Services",  sub: "Add-ons & product catalogue" },
    ai_manager: { title: "AI Sales Manager", sub: "Your always-on senior sales advisor" },
    outreach:   { title: "Outreach Hub",     sub: "Lead campaigns & WhatsApp automation" },
  };

  const NAV = [
    { id: "listings", Icon: Car, label: "Listings", badge: listings.length },
    { id: "add", Icon: PlusCircle, label: "Add Listing" },
    { id: "crm", Icon: MessageCircle, label: "CRM" },
    { id: "analytics", Icon: BarChart2, label: "Analytics" },
    { id: "outreach",   Icon: Megaphone, label: "Outreach Hub",     badge: null },
    { id: "ai_manager", Icon: Bot, label: "AI Sales Manager" },
    { id: "team", Icon: Users, label: "Team" },
    { id: "hero", Icon: HeroCarouselIcon, label: "Hero Carousel" },
    { id: "stock", Icon: Package, label: "Stock" },
    { id: "documents", Icon: FileText, label: "Documents" },
    { id: "revops",   Icon: BarChart3, label: "RevOps" },
    { id: "services", Icon: Wrench,   label: "Services & Add-ons" },
  ];

  const STAT_CARDS = [
    {
      label: "Total Listings",
      val: listings.length,
      sub: "Active inventory",
      grad: "grad-cyan",
      Icon: Car,
      glow: "rgba(103,232,249,0.13)",
    },
    {
      label: "Sold",
      val: soldCount,
      sub: "Cars sold all time",
      grad: "grad-green",
      Icon: CheckCircle2,
      glow: "rgba(110,231,183,0.13)",
      spark: soldSpark,
      sparkColor: '#34d399',
    },
    {
      label: "Total Value",
      val: `RM ${totalVal.toLocaleString()}`,
      sub: "Combined price",
      grad: "grad-purple",
      Icon: DollarSign,
      glow: "rgba(216,180,254,0.13)",
    },
    {
      label: "Hot Deals",
      val: hotCount,
      sub: hotCount > 0 ? "On homepage" : "No discounts",
      grad: hotCount > 0 ? "grad-red" : "",
      Icon: Flame,
      glow: hotCount > 0 ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.03)",
    },
  ];

  const notifCount = notifications.filter(n => !n.is_read).length;
  const timeAgo = (iso) => {
    if (!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };
  const markNotifRead = async (n) => {
    if (n.is_read) return;
    await supabase.from('dealer_notifications').update({ is_read: true }).eq('id', n.id);
    setNotifications(p => p.map(x => x.id === n.id ? { ...x, is_read: true } : x));
  };
  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read).map(n => n.id);
    if (!unread.length) return;
    await supabase.from('dealer_notifications').update({ is_read: true }).in('id', unread);
    setNotifications(p => p.map(n => ({ ...n, is_read: true })));
  };

  // ── Onboarding completion check ─────────────────────────────────────────
  const onboardingItems = profile ? [
    { label: 'Account created',          done: true },
    { label: 'Add your first listing',   done: listings.length > 0,         action: () => handleTabChange('listings') },
    { label: 'Connect Telegram',         done: !!profile.telegram_bot_token, action: () => handleTabChange('settings') },
    { label: 'Share your storefront',    done: onboardingCopied,             isCopy: true },
  ] : [];
  const onboardingDoneCount = onboardingItems.filter(i => i.done).length;
  const allOnboardingDone   = onboardingDoneCount === onboardingItems.length;

  useEffect(() => {
    if (!allOnboardingDone || !userId || profile?.onboarding_complete) return;
    supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId);
    setOnboardingDismissed(true);
    setOnboardingToast(true);
    setTimeout(() => setOnboardingToast(false), 5000);
  }, [allOnboardingDone]);

  const copyStorefrontOnboarding = () => {
    const url = profile?.subdomain ? `https://${profile.subdomain}.xdrive.my` : 'https://xdrive.my';
    navigator.clipboard.writeText(url).catch(() => {});
    setOnboardingCopied(true);
  };

  const showOnboardingBanner = profile && profile.onboarding_complete === false && !onboardingDismissed;

  if (!profile) return <SciFiLoader />;

  if (!subLoading && status === 'expired') return (
    <div style={{ background: '#0d0d0d', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", gap: 16 }}>
      <p style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>Your trial has ended</p>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Contact us to activate your ShiftOS subscription.</p>
      <a href="https://wa.me/60174155191" style={{ background: '#3b82f6', color: 'white', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Upgrade Now</a>
    </div>
  );

  return (
    <>
    <SuspendedBanner />
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
    <style>{STYLES}</style>
    <div
      className="min-h-screen text-white flex"
      style={{
        fontFamily: "'DM Sans',sans-serif",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px), radial-gradient(ellipse 80% 50% at 0% 0%, rgba(30,58,138,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(49,46,129,0.06) 0%, transparent 55%), #05070e",
        backgroundSize: "24px 24px, auto, auto",
      }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/65 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed h-dvh overflow-hidden z-30 flex flex-col w-60 transition-transform duration-300 ease-in-out lg:translate-x-0 glass ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex-shrink-0 px-4 py-4 flex items-center gap-3" style={T.divider}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              boxShadow: "0 0 18px rgba(59,130,246,0.42), 0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            S
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black tracking-wider text-sm grad-blue">
              ShiftOS
            </p>
            <p className="text-xs text-gray-600 mt-px">XDrive Admin</p>
          </div>
          {/* Bell in sidebar header */}
          <div ref={sidebarBellRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => {
              const rect = sidebarBellRef.current?.getBoundingClientRect() ?? null;
              setSidebarBellRect(notifOpen ? null : rect);
              setNotifOpen(p => !p);
            }} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: notifCount > 0 ? '#93c5fd' : '#4b5563', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell className="w-4 h-4" />
              {notifCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: '#3b82f6', color: '#fff', fontSize: 8, fontWeight: 800, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #0a0a0e' }}>{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-gray-600 hover:text-white rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-2 sm:p-3 space-y-px mt-1">
          {NAV.map(({ id, Icon, label, badge }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`nav-item w-full flex items-center gap-3 px-3 py-2 sm:py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === id ? "nav-active text-white" : "text-gray-500 hover:text-white"}`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${activeTab === id ? "text-blue-400" : ""}`}
              />
              {label}
              {badge !== undefined && (
                <span
                  className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums ${activeTab === id ? "text-blue-300 bg-blue-950/70" : "text-gray-600 bg-white/[0.05]"}`}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
          {profile?.role === 'superadmin' && (
            <a
              href="/platform"
              className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-white transition-all"
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              Admin Panel
            </a>
          )}
          <button
            onClick={() => window.open(getStorefrontUrl(), '_blank')}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-white transition-all"
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            View Site
            <Eye className="w-3 h-3 ml-auto opacity-40" />
          </button>
        </nav>

        {/* ── Sidebar bottom: profile + settings + logout ── */}
        <div
          className="shrink-0 p-3 space-y-1 border-t border-gray-800"
          style={{}}
        >
          {/* Profile row */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <Avatar size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {profile?.full_name || "—"}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {profile?.email || ""}
              </p>
            </div>
          </div>

          {/* Dealership chip */}
          {profile?.dealership && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 mx-1"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <Building2 className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-gray-300 truncate flex-1">
                {profile.dealership}
              </p>
            </div>
          )}

          {/* ✅ Settings button — sits right under username */}
          <button
            onClick={() => handleTabChange("settings")}
            className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "settings" ? "nav-active text-white" : "text-gray-500 hover:text-white"}`}
          >
            <Settings
              className={`w-4 h-4 flex-shrink-0 ${activeTab === "settings" ? "text-red-500" : ""}`}
            />
            Settings
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 lg:ml-60 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div
          className="lg:hidden sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5 backdrop-blur-xl"
          style={{
            background: 'rgba(5,7,14,0.7)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div
              className="w-5 h-5 rounded flex items-center justify-center font-black text-xs"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 8px rgba(220,38,38,0.3)' }}
            >
              S
            </div>
            <span className="font-bold text-white text-xs tracking-tight hidden xs:inline">ShiftOS</span>
          </div>
          <span className="text-gray-500 text-xs truncate flex-1 min-w-0">
            {TITLES[activeTab]?.title}
          </span>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setNotifOpen(p => !p)}
              style={{
                position: 'relative',
                background: 'transparent',
                border: 'none', borderRadius: 8, padding: 6,
                cursor: 'pointer',
                color: notifCount > 0 ? '#f3f4f6' : '#6b7280',
                display: 'flex',
              }}
            >
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  background: '#dc2626', color: '#fff',
                  fontSize: 8, fontWeight: 800, borderRadius: '50%',
                  width: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid #05070e',
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, width: 320, maxHeight: 420, overflowY: 'auto', background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', fontFamily: "'DM Sans', sans-serif" }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>Notifications</span>
                    {notifCount > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Mark all read</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#4b5563', padding: '20px 16px', textAlign: 'center' }}>No notifications</p>
                  ) : notifications.slice(0, 10).map(n => (
                    <div key={n.id} onClick={() => { if (n.link_to) { handleTabChange(n.link_to); setNotifOpen(false); } markNotifRead(n); }} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: n.link_to ? 'pointer' : 'default', background: n.is_read ? 'transparent' : 'rgba(255,255,255,0.03)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(255,255,255,0.03)'}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        {!n.is_read && <div style={{ width: 6, height: 6, background: '#dc2626', borderRadius: '50%', flexShrink: 0, marginTop: 5 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: '0 0 2px', lineHeight: 1.3 }}>{n.title || 'Notification'}</p>
                          {n.body && <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px', lineHeight: 1.4 }}>{n.body}</p>}
                          <p style={{ fontSize: 10, color: '#4b5563', margin: 0 }}>{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <Avatar />
        </div>

        {/* ── Onboarding Banner ── */}
        {showOnboardingBanner && (
          <div style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 24px', fontFamily: "'DM Sans',sans-serif", position: 'sticky', top: 0, zIndex: 15 }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckSquare className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: 0, lineHeight: 1.2 }}>Setup Progress</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{onboardingDoneCount} of {onboardingItems.length} complete</p>
                  </div>
                </div>
                <button
                  onClick={() => setOnboardingDismissed(true)}
                  style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(onboardingDoneCount / onboardingItems.length) * 100}%`, background: 'linear-gradient(90deg,#dc2626,#ef4444)', borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>

              {/* Checklist */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {onboardingItems.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (item.isCopy) copyStorefrontOnboarding();
                      else if (item.action && !item.done) item.action();
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 12px',
                      background: item.done ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${item.done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 8,
                      cursor: (!item.done || item.isCopy) ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!item.done || item.isCopy) e.currentTarget.style.borderColor = item.done ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.18)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = item.done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'; }}
                  >
                    {item.done
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 12, color: item.done ? '#6ee7b7' : '#9ca3af', fontWeight: item.done ? 500 : 400, whiteSpace: 'nowrap' }}>
                      {item.label}
                      {item.isCopy && item.done && ' ✓'}
                      {item.isCopy && !item.done && ' (click to copy)'}
                    </span>
                    {!item.done && item.action && <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Congrats toast ── */}
        {onboardingToast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99, background: '#111118', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontFamily: "'DM Sans',sans-serif", animation: 'slideUp 0.3s ease' }}>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Setup complete!</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Your storefront is fully configured.</p>
            </div>
          </div>
        )}

        <div className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <div className="hidden sm:block mb-4 sm:mb-6">
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              {TITLES[activeTab]?.title}
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5">
              {TITLES[activeTab]?.sub}
            </p>
            <div
              className="mt-4 h-px"
              style={{
                background:
                  "linear-gradient(90deg,rgba(59,130,246,0.4),rgba(99,102,241,0.2) 38%,transparent 65%)",
              }}
            />
          </div>

          {/* ── Listings Tab ── */}
          {activeTab === "listings" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
                {STAT_CARDS.map(({ label, val, sub, grad, Icon, glow, spark, sparkColor }) => (
                  <div
                    key={label}
                    className="stat-card card-top rounded-2xl overflow-hidden glass"
                    style={{ position: 'relative' }}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(circle at 95% 5%, rgba(59,130,246,0.05) 0%, transparent 50%)",
                      }}
                    />
                    {spark && (
                      <div className="relative px-3.5 pt-3">
                        <Sparkline data={spark} color={sparkColor || '#3b82f6'} width={120} height={32} />
                      </div>
                    )}
                    <div className={spark ? 'p-3 sm:p-4 pt-2 relative' : 'p-3 sm:p-4 relative'}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">
                          {label}
                        </p>
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: glow,
                            boxShadow: `0 0 14px ${glow}`,
                          }}
                        >
                          <Icon className="w-4 h-4 opacity-80" />
                        </div>
                      </div>
                      <p
                        className={`text-xl sm:text-3xl font-black leading-none tabular-nums ${grad || "text-white"}`}
                      >
                        {val}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 relative truncate">
                        {sub}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Listings panel ── */}
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,12,20,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', fontFamily: "'DM Sans', sans-serif" }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#f9fafb', fontFamily: "'DM Sans', sans-serif", margin: 0, lineHeight: 1 }}>My Listings</h2>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 6, padding: '2px 8px', lineHeight: 1.5 }}>
                        {filteredListings.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#4b5563', pointerEvents: 'none' }} />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search…"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 10px 7px 28px', fontSize: 13, color: '#f3f4f6', fontFamily: "'DM Sans', sans-serif", outline: 'none', width: 160 }}
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                            <X style={{ width: 13, height: 13 }} />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setShowFastModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        ⚡ Fast
                      </button>
                      <button
                        onClick={() => setActiveTab("add")}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.28)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#f87171', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.18)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,38,38,0.1)'}
                      >
                        <PlusCircle style={{ width: 14, height: 14 }} />
                        Full Form
                      </button>
                    </div>
                  </div>

                  {/* ── Status filter tabs ── */}
                  <div style={{ display: 'flex', gap: 0, padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: 14 }}>
                    {[
                      { key: 'available', label: 'Available', count: listings.filter(l => (l.status || 'available') === 'available').length },
                      { key: 'reserved', label: 'Reserved', count: listings.filter(l => l.status === 'reserved').length },
                      { key: 'sold',     label: 'Sold',     count: listings.filter(l => l.status === 'sold').length },
                    ].map(({ key, label, count }) => (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '10px 16px', fontSize: 13,
                          fontWeight: statusFilter === key ? 600 : 400,
                          fontFamily: "'DM Sans', sans-serif",
                          color: statusFilter === key ? '#f9fafb' : '#4b5563',
                          borderBottom: statusFilter === key ? '2px solid #dc2626' : '2px solid transparent',
                          marginBottom: -1,
                          display: 'flex', alignItems: 'center', gap: 7,
                          transition: 'color 0.15s',
                        }}
                      >
                        {label}
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 4, lineHeight: 1.6,
                          background: statusFilter === key ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.04)',
                          color: statusFilter === key ? '#f87171' : '#374151',
                        }}>
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>

                {loading ? (
                  <div style={{ padding: 52, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>Loading…</div>
                ) : filteredListings.length === 0 ? (
                  <div style={{ padding: 52, textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <Car style={{ width: 22, height: 22, color: 'rgba(220,38,38,0.45)' }} />
                    </div>
                    <p style={{ color: '#4b5563', fontSize: 13, marginBottom: listings.length === 0 ? 16 : 0 }}>
                      {listings.length === 0 ? 'No listings yet' : `No ${statusFilter} listings`}
                    </p>
                    {listings.length === 0 && (
                      <button onClick={() => setActiveTab("add")} style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', borderRadius: 8, padding: '8px 20px', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Add your first car
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans', sans-serif" }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['', 'Vehicle', 'Price', 'Year / Km', 'Grade', 'Age', 'Status'].map((h, i) => (
                              <th key={i} style={{ padding: '11px 16px', fontSize: 10, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#374151', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredListings.map((l) => {
                            const isSold = l.status === 'sold';
                            const extGC = gradeColor(String(l.auction_grade));
                            const sp = l.selling_price || l.price || 0;
                            const op = l.original_price || l.previous_price || null;
                            const pct = op && op > sp ? Math.round(((op - sp) / op) * 100) : 0;
                            const isHot = pct >= 3;
                            return (
                              <tr
                                key={l.id}
                                onClick={() => setDetailListing(l)}
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.12s', opacity: isSold ? 0.5 : 1 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {/* Thumbnail */}
                                <td style={{ padding: '12px 8px 12px 16px', width: 84 }}>
                                  {l.images?.[0]
                                    ? <img src={l.images[0]} alt="" style={{ width: 72, height: 48, borderRadius: 8, objectFit: 'cover', display: 'block', filter: isSold ? 'grayscale(0.7) brightness(0.7)' : 'none' }} />
                                    : <div style={{ width: 72, height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car style={{ width: 16, height: 16, color: '#374151' }} /></div>
                                  }
                                </td>
                                {/* Vehicle */}
                                <td style={{ padding: '12px 16px', minWidth: 165 }}>
                                  <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, fontWeight: 600 }}>{l.brand}</p>
                                  <p style={{ fontSize: 14, color: '#f9fafb', fontWeight: 700, lineHeight: 1.25, margin: '3px 0 0' }}>{l.model}</p>
                                  {l.variant && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{l.variant}</p>}
                                  {(l.vin || l.vin_number) && <p style={{ fontSize: 10, color: '#374151', margin: '3px 0 0', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{(l.vin || l.vin_number).trim()}</p>}
                                </td>
                                {/* Price */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  <p style={{ fontSize: 14, color: '#f9fafb', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>RM {sp.toLocaleString()}</p>
                                  {pct > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                      <span style={{ fontSize: 10, color: '#374151', textDecoration: 'line-through' }}>RM {op.toLocaleString()}</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: isHot ? '#60a5fa' : '#fbbf24', background: isHot ? 'rgba(96,165,250,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${isHot ? 'rgba(96,165,250,0.2)' : 'rgba(251,191,36,0.2)'}`, borderRadius: 4, padding: '0 5px' }}>−{pct}%</span>
                                    </div>
                                  )}
                                </td>
                                {/* Year / Km */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  {l.year && <p style={{ fontSize: 13, color: '#d1d5db', fontWeight: 600, margin: 0 }}>{l.year}</p>}
                                  {l.mileage
                                    ? <p style={{ fontSize: 11, color: '#6b7280', margin: l.year ? '2px 0 0' : 0 }}>{Number(l.mileage).toLocaleString()} km</p>
                                    : !l.year && <span style={{ color: '#374151', fontSize: 13 }}>—</span>
                                  }
                                </td>
                                {/* Grade */}
                                <td style={{ padding: '12px 16px' }}>
                                  {l.auction_grade
                                    ? <span style={{ fontSize: 11, fontWeight: 700, color: extGC, background: `${extGC}15`, border: `1px solid ${extGC}28`, borderRadius: 5, padding: '2px 8px', display: 'inline-block' }}>{l.auction_grade}</span>
                                    : l.condition
                                      ? <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{l.condition}</span>
                                      : <span style={{ color: '#374151', fontSize: 12 }}>—</span>
                                  }
                                </td>
                                {/* Age */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  <AgeBadge createdAt={l.created_at} />
                                  <span style={{ display: 'block', fontSize: 10, color: '#374151', marginTop: 4 }}>{fmtDate(l.created_at)}</span>
                                </td>
                                {/* Status */}
                                <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                                  <StatusBadge listing={l} />
                                  {Array.isArray(l.included_services) && l.included_services.length > 0 && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setSvcPopupListing(l); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, color: '#60a5fa', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                      <Tag style={{ width: 9, height: 9 }} />
                                      {l.included_services.length} svc
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden">
                      {filteredListings.map((l) => {
                        const isSold = l.status === 'sold';
                        const sp = l.selling_price || l.price || 0;
                        const op = l.original_price || l.previous_price || null;
                        const pct = op && op > sp ? Math.round(((op - sp) / op) * 100) : 0;
                        const isHot = pct >= 3;
                        return (
                          <div
                            key={l.id}
                            onClick={() => setDetailListing(l)}
                            style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: isSold ? 0.55 : 1, cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              {/* Image */}
                              {l.images?.[0]
                                ? <img src={l.images[0]} alt="" style={{ width: 80, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0, filter: isSold ? 'grayscale(0.7) brightness(0.7)' : 'none' }} />
                                : <div style={{ width: 80, height: 60, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car style={{ width: 18, height: 18, color: '#374151' }} /></div>
                              }
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, fontWeight: 600 }}>{l.brand}{l.year ? ` · ${l.year}` : ''}</p>
                                    <p style={{ fontSize: 15, color: '#f9fafb', fontWeight: 700, lineHeight: 1.25, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.model}</p>
                                    {l.variant && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.variant}</p>}
                                  </div>
                                  <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0, marginTop: 1 }}>
                                    <StatusBadge listing={l} />
                                  </span>
                                </div>
                                {/* Price */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                                  <span style={{ fontSize: 15, color: '#f9fafb', fontWeight: 700, letterSpacing: '-0.01em' }}>RM {sp.toLocaleString()}</span>
                                  {pct > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: isHot ? '#60a5fa' : '#fbbf24', background: isHot ? 'rgba(96,165,250,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${isHot ? 'rgba(96,165,250,0.2)' : 'rgba(251,191,36,0.2)'}`, borderRadius: 4, padding: '1px 6px' }}>−{pct}%</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Meta row — indented under image */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 9, paddingLeft: 92 }}>
                              {(l.vin || l.vin_number) && <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{(l.vin || l.vin_number).trim()}</span>}
                              {l.mileage && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{Number(l.mileage).toLocaleString()} km</span>}
                              {l.state && <><span style={{ color: '#1f2937', fontSize: 10 }}>·</span><span style={{ fontSize: 11, color: '#6b7280' }}>{l.state}</span></>}
                              <AgeBadge createdAt={l.created_at} />
                              {Array.isArray(l.included_services) && l.included_services.length > 0 && (
                                <button
                                  onClick={e => { e.stopPropagation(); setSvcPopupListing(l); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#60a5fa', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}
                                >
                                  <Tag style={{ width: 9, height: 9 }} />
                                  {l.included_services.length} svc
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                </div>
              </div>
            </>
          )}

          {activeTab === "add" && (
            <div className="card-top rounded-xl p-4 sm:p-6" style={T.cardDark}>
              <CarForm onCreate={handleNew} />
            </div>
          )}
          {activeTab === "analytics" && (
            <AnalyticsTab
              listings={listings}
              profile={profile}
              onEditListing={setEditListing}
              onStaleAdjusted={handleStaleAdjusted}
              adjustedStaleIds={adjustedStaleIds}
            />
          )}
          {activeTab === "ai_manager" && snapshot && (
            <AISalesManager
              snapshot={snapshot}
              dealerName={profile?.dealership || profile?.site_name || "Your Dealership"}
            />
          )}
          {activeTab === "ai_manager" && !snapshot && (
            <div className="flex items-center justify-center h-64 text-gray-600 text-sm">
              Loading dealer data...
            </div>
          )}
          {activeTab === "team" && (
            <TeamTab managerDealership={profile?.dealership} dealerId={getDealerIdFromProfile(profile)} />
          )}
          {activeTab === "settings" && profile && (
            <SettingsTab
              profile={profile}
              onProfileUpdate={handleProfileUpdate}
            />
          )}
          {activeTab === "crm" && (
            <CRMPanel
              userId={userId}
              listings={listings}
              salesmen={salesmen}
              onOpenDoc={(data) => { setPrefillDocData(data); handleTabChange('documents'); }}
            />
          )}
          {activeTab === "hero" && userId && (
            <HeroSlidesPage userId={userId} profile={profile} />
          )}
          {activeTab === "stock" && userId && (
            <StockTab userId={userId} listings={listings} />
          )}
          {activeTab === "documents" && (
            <DocumentsTab userId={userId} listings={listings} prefillDocData={prefillDocData} onClearPrefill={() => setPrefillDocData(null)} profile={profile} />
          )}
          {activeTab === "revops" && userId && (
            <RevOpsPage userId={userId} />
          )}
          {activeTab === "services" && userId && (
            <ServicesPage userId={userId} />
          )}
          {activeTab === "outreach" && userId && (
            <OutreachHub dealerId={userId} listings={listings} />
          )}
        </div>
      </main>

      {detailListing && (
        <ListingDetailDrawer
          listing={detailListing}
          salesmen={salesmen}
          salesmenById={salesmenById}
          onClose={() => setDetailListing(null)}
          onUpdate={(updated) => {
            setListings(p => p.map(l => l.id === updated.id ? updated : l));
            setDetailListing(updated);
          }}
          onDelete={(id) => {
            setListings(p => p.filter(l => l.id !== id));
            setDetailListing(null);
          }}
          setEditListing={setEditListing}
          setTiktokListing={setTiktokListing}
          setPriceEditListing={setPriceEditListing}
          setMarkSoldListing={setMarkSoldListing}
          setDeleteId={setDeleteId}
          copyListing={copyListing}
          copiedListingId={copiedListingId}
          handleAssign={handleAssign}
          handleUnassign={handleUnassign}
          handleStatus={handleStatus}
          updatingStatus={updatingStatus}
          getListingAge={getListingAge}
        />
      )}

      {/* ── Sidebar notification dropdown (portal — escapes overflow-hidden sidebar) ── */}
      {notifOpen && sidebarBellRect && createPortal(
        <>
          <div onClick={closeNotif} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <div style={{
            position: 'fixed',
            top: sidebarBellRect.bottom + 8,
            left: Math.max(8, sidebarBellRect.right - 320),
            width: 320,
            maxHeight: 420,
            overflowY: 'auto',
            background: '#111118',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            fontFamily: "'DM Sans', sans-serif",
            zIndex: 9999,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>Notifications</span>
              {notifCount > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Mark all read</button>}
            </div>
            {notifications.length === 0 ? (
              <p style={{ fontSize: 13, color: '#4b5563', padding: '20px 16px', textAlign: 'center' }}>No notifications</p>
            ) : notifications.slice(0, 10).map(n => (
              <div key={n.id} onClick={() => { if (n.link_to) { handleTabChange(n.link_to); closeNotif(); } markNotifRead(n); }} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: n.link_to ? 'pointer' : 'default', background: n.is_read ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {!n.is_read && <div style={{ width: 6, height: 6, background: '#dc2626', borderRadius: '50%', flexShrink: 0, marginTop: 5 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: '0 0 2px' }}>{n.title || 'Notification'}</p>
                    {n.body && <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>{n.body}</p>}
                    <p style={{ fontSize: 10, color: '#4b5563', margin: 0 }}>{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* ── Services popup ── */}
      {svcPopupListing && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.78)' }}
          onClick={() => setSvcPopupListing(null)}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-sm overflow-hidden"
            style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-white text-sm">Included Services</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {svcPopupListing.brand} {svcPopupListing.model} {svcPopupListing.variant || ''}
                </p>
              </div>
              <button onClick={() => setSvcPopupListing(null)} className="text-gray-500 hover:text-white p-1 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Services list */}
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {(svcPopupListing.included_services || []).map((svc, i) => {
                const cfg = getCategoryCfg(svc.category);
                const CatIcon = cfg.icon;
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <CatIcon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{svc.name}</p>
                      <p className="text-xs text-gray-500">{cfg.label}</p>
                    </div>
                    <span className="text-sm font-semibold text-white whitespace-nowrap">
                      RM {Number(svc.selling_price || 0).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Total footer */}
            {svcPopupListing.included_services_cost > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] bg-blue-500/5">
                <span className="text-xs text-gray-500 font-medium">Total value</span>
                <span className="text-sm font-bold text-blue-400">
                  RM {Number(svcPopupListing.included_services_cost).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fast List modal ── */}
      {showFastModal && (
        <div onClick={() => setShowFastModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0d1117', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>⚡ Fast List</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#4b5563' }}>2 steps — live in 30 seconds</p>
              </div>
              <button onClick={() => setShowFastModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: '#6b7280', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <CarFormFast
              onCreate={(car) => {
                setShowFastModal(false);
                toast.success("Listed! Add more details anytime.");
              }}
            />
          </div>
        </div>
      )}

      {/* ── Delete modal ── */}
      {deleteId && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
            style={undefined}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-white">Delete Listing?</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setDeleteId(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-5">
              This will permanently remove the car listing from your inventory.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {priceEditListing && (
        <PriceEditModal
          listing={priceEditListing}
          onClose={() => setPriceEditListing(null)}
          onSave={handlePriceSave}
        />
      )}
      {/* Assign dropdown backdrop — closes any open assign dropdown */}
      {assignDropdownId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setAssignDropdownId(null)}
        />
      )}

      {/* Assign toast */}
      {assignToast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white"
          style={{
            background: "rgba(22,163,74,0.92)",
            border: "1px solid rgba(74,222,128,0.3)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <Check className="w-4 h-4 text-green-200" />
          {assignToast.msg}
        </div>
      )}

      {tiktokListing && (
        <TikTokStudioV3
          listing={tiktokListing}
          onClose={() => setTiktokListing(null)}
        />
      )}

      {/* Edit listing modal */}
      {editListing && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
            style={undefined}
          >
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={T.divider}
            >
              <div>
                <h3 className="font-semibold text-white">Edit Listing</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editListing.brand} {editListing.model}{" "}
                  {editListing.variant || ""}
                </p>
              </div>
              <button
                onClick={() => setEditListing(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              <CarForm
                listing={editListing}
                onUpdate={handleUpdate}
                onCreate={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {markSoldListing && (
        <MarkSoldModal
          listing={markSoldListing}
          onClose={() => setMarkSoldListing(null)}
          onConfirm={handleMarkSold}
          loading={markSoldLoading}
        />
      )}

      {/* ── Post-listing stock purchase prompt ── */}
      {pendingStockListing && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col" style={undefined}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-white">Add Purchase Details?</h3>
                <p className="text-gray-500 text-xs mt-0.5">{pendingStockListing.brand} {pendingStockListing.model} {pendingStockListing.year}</p>
              </div>
              <button onClick={() => setPendingStockListing(null)} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Purchase Price (RM) *</label>
                  <input type="number" value={pendingStockForm.purchase_price} onChange={e => setPendingStockForm(p => ({ ...p, purchase_price: e.target.value }))} placeholder="0" className={iCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Purchase Date</label>
                  <input type="date" value={pendingStockForm.purchase_date} onChange={e => setPendingStockForm(p => ({ ...p, purchase_date: e.target.value }))} className={iCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Source</label>
                  <select value={pendingStockForm.purchase_source} onChange={e => setPendingStockForm(p => ({ ...p, purchase_source: e.target.value }))} className={iCls} style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {['Auction','Direct Buy','Trade-in','Other'].map(s => <option key={s} value={s} style={{ background: '#111118' }}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Recon Cost (RM)</label>
                  <input type="number" value={pendingStockForm.recon_cost} onChange={e => setPendingStockForm(p => ({ ...p, recon_cost: e.target.value }))} placeholder="0" className={iCls} />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-white/[0.06] flex gap-3">
              <button onClick={() => setPendingStockListing(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Skip</button>
              <button
                disabled={pendingStockSaving || !pendingStockForm.purchase_price}
                onClick={async () => {
                  setPendingStockSaving(true);
                  await supabase.from('stock_units').insert({
                    dealer_id: userId,
                    listing_id: pendingStockListing.id,
                    // Mirror car identity fields from the listing
                    brand:          pendingStockListing.brand,
                    model:          pendingStockListing.model,
                    year:           pendingStockListing.year,
                    variant:        pendingStockListing.variant,
                    colour:         pendingStockListing.colour,
                    mileage:        pendingStockListing.mileage,
                    transmission:   pendingStockListing.transmission,
                    fuel_type:      pendingStockListing.fuel_type,
                    body_type:      pendingStockListing.body_type,
                    engine_cc:      pendingStockListing.engine_cc,
                    is_recon:       pendingStockListing.is_recon,
                    import_country: pendingStockListing.import_country,
                    auction_grade:  pendingStockListing.auction_grade,
                    interior_grade: pendingStockListing.interior_grade,
                    auction_house:  pendingStockListing.auction_house,
                    vin_number:     pendingStockListing.vin_number,
                    asking_price:   pendingStockListing.selling_price,
                    // Purchase-specific fields from the modal form
                    purchase_price: Number(pendingStockForm.purchase_price) || 0,
                    purchase_date: pendingStockForm.purchase_date || null,
                    purchase_source: pendingStockForm.purchase_source || null,
                    recon_cost: Number(pendingStockForm.recon_cost) || 0,
                    status: 'in_stock',
                  });
                  setPendingStockSaving(false);
                  setPendingStockListing(null);
                }}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                {pendingStockSaving ? 'Saving...' : 'Add to Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
