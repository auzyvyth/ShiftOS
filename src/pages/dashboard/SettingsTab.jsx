import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { supabase } from "../../supabaseClient";
import { getDealerIdFromProfile } from "../../hooks/useProfile";
import { clearSiteProfileCache } from "../../hooks/useSiteProfile";
import { normalizeMYPhone } from "../../utils/phone";
import { getEmbedUrl } from "../../utils/videoEmbed";
import {
  Building2,
  Phone,
  Globe,
  KeyRound,
  Send,
  Lock,
  Shield,
  Save,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  Tag,
  PlusCircle,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Megaphone,
} from "lucide-react";

const MAX_DEALERSHIP_CHANGES = 2;

const SERVER_URL = "https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1";

const T = {
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
            text: "ShiftOS Telegram connected! Auto-posting is active.",
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
            placeholder="Raya sale — all recon cars discounted this week!"
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

    </div>
  );
}

export default SettingsTab;
