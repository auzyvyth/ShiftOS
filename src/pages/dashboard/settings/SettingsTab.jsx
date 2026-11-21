import React, { useEffect, useState, useRef } from "react";
import { useModalHistory } from "../../../hooks/useModalHistory";
import AvailabilityEditor from "../../../components/AvailabilityEditor";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { logActivity } from "../../../utils/activityLog";
import { useDebouncedCallback } from "use-debounce";
import { supabase } from "../../../supabaseClient";
import { getDealerIdFromProfile } from "../../../hooks/useProfile";
import { getStorefrontUrl as buildStorefrontUrl } from "../../../hooks/useTenant";
import { CONFIGURABLE_ROLES, CAPABILITY_GROUPS, capabilitiesForRole, resolvePermissions, roleExtras, isFullAccessRole, OWNER_ONLY, ROLE_ENABLED_KEY } from "../../../lib/permissions";
import { DEFAULT_WA_TEMPLATES, WA_PLACEHOLDERS } from "../../../lib/leadsHelpers";
import { T, iCls, taCls } from "../shared";
import VerifyIdentity from "../../../components/kyc/VerifyIdentity";
import { clearSiteProfileCache } from "../../../hooks/useSiteProfile";
import { toPlus60, isValidMyPhone, MY_PHONE_ERROR } from "../../../lib/phone";
import PhoneInput from "../../../components/ui/PhoneInput";
import PushToggle from "../../../components/PushToggle";
import { getPlanConfig, nextDealerPlan } from "../../../utils/planConfig";
import { color, border, font } from "../../../theme/tokens";
import { getEmbedUrl } from "../../../utils/videoEmbed";
import { premiumLight, premiumLight as PL } from "../../../theme/tokens";
import { AutoPostSettings } from "../../../components/autopost/AutoPost";
import { Trash2, X, DollarSign, Building2, Clock, Copy, Check, Send, CreditCard, ChevronRight, AlertCircle, CheckCircle2, MessageCircle, Phone, Settings, Save, Lock, Globe, Megaphone, Instagram, Facebook, Shield, KeyRound, AlertTriangle, ChevronLeft, Calculator, Package, FileText, Upload, User, ClipboardCheck, ShieldCheck, Share2 } from "lucide-react";
const ServicesPage = React.lazy(() => import("../../ServicesPage"));

const MAX_DEALERSHIP_CHANGES = 2;

function SettingsSection({
  title,
  subtitle,
  icon: Icon,
  children,
}) {
  return (
    <div className="settings-section">
      <div className="flex items-center gap-3 px-5 py-4" style={T.divider}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 pl-well"
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-gray-900 text-sm font-semibold">{title}</p>
          {subtitle && (
            <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>
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
      <div className="flex items-baseline justify-between flex-wrap gap-x-3 gap-y-0.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </label>
        {hint && <span className="text-xs text-gray-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SaveBtn({ sectionKey, onClick, disabled, saving, saved }) {
  return (
    <button
      onClick={onClick}
      disabled={saving[sectionKey] || disabled}
      className="btn-shimmer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
      style={
        saved[sectionKey]
          ? {
              background: "#111827",
              boxShadow: "none",
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
}

function ErrMsg({ k, errors }) {
  return errors[k] ? (
    <p className="text-red-600 text-xs mt-1.5 flex items-center gap-1.5">
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      {errors[k]}
    </p>
  ) : null;
}

// ─── PermissionsMatrix (SEC-2) ────────────────────────────────────────────────
function PermissionsMatrix({ dealerId, actor }) {
  const [rows, setRows] = useState({});   // { role: permissionsMap }
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(null);
  // "Do you have a manager?" (owner, 2026-11-13: some dealerships don't need one). Stored on the
  // manager row as role_enabled; resolvePermissions drops unknown keys, so it is read apart.
  const [hasManager, setHasManager] = useState(true);
  const [managerCount, setManagerCount] = useState(0);
  const [loadErr, setLoadErr] = useState(false);
  // The manager switches as last SAVED: the Yes/No answer is saved on top of these, never on top
  // of toggles the owner has not pressed Save for.
  const savedManager = useRef({});

  useEffect(() => {
    if (!dealerId) return;
    setLoading(true);
    Promise.all([
      supabase.from('role_permissions').select('role, permissions').eq('dealer_id', dealerId),
      // Active managers only: a deactivated one cannot sign in, so it should not block "No".
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('dealer_id', dealerId).eq('role', 'manager').eq('is_active', true),
    ]).then(([{ data, error }, mgr]) => {
        // A failed read must not show every switch at its default: saving that would overwrite
        // what the owner set.
        if (error) { setLoadErr(true); setLoading(false); return; }
        const byRole = {};
        for (const { value } of CONFIGURABLE_ROLES) {
          const stored = (data || []).find(r => r.role === value)?.permissions;
          byRole[value] = resolvePermissions(value, stored);
        }
        const mgrStored = (data || []).find(r => r.role === 'manager')?.permissions;
        savedManager.current = byRole.manager;
        setHasManager(mgrStored?.[ROLE_ENABLED_KEY] !== false);
        setManagerCount(mgr?.error ? null : (mgr?.count || 0)); // null = could not count
        setRows(byRole);
        setLoading(false);
      });
  }, [dealerId]);

  const saveHasManager = async (next) => {
    if (!next && managerCount === null) {
      toast.error('Could not check your team. Refresh and try again.');
      return;
    }
    if (!next && managerCount > 0) {
      toast.error(`Remove your ${managerCount === 1 ? 'manager' : `${managerCount} managers`} in Team first.`);
      return;
    }
    setHasManager(next);
    const { data: saved, error } = await supabase.from('role_permissions')
      .upsert({ dealer_id: dealerId, role: 'manager', permissions: { ...savedManager.current, [ROLE_ENABLED_KEY]: next }, updated_at: new Date().toISOString() }, { onConflict: 'dealer_id,role' })
      .select('role');
    if (error || !saved?.length) { setHasManager(!next); toast.error('Save failed'); return; }
    logActivity({ dealerId, actor, tableName: 'role_permissions', recordId: null, action: 'updated', summary: next ? 'Manager role switched on' : 'Manager role switched off' });
  };

  const toggle = (role, key) => setRows(p => ({ ...p, [role]: { ...p[role], [key]: !p[role]?.[key] } }));

  const saveRole = async (role) => {
    setSavingRole(role);
    const permissions = role === 'manager' ? { ...rows[role], [ROLE_ENABLED_KEY]: hasManager } : rows[role];
    const { data: saved, error } = await supabase.from('role_permissions')
      .upsert({ dealer_id: dealerId, role, permissions, updated_at: new Date().toISOString() }, { onConflict: 'dealer_id,role' })
      .select('role');
    if (error || !saved?.length) { toast.error('Save failed'); }
    else {
      if (role === 'manager') savedManager.current = rows.manager;
      logActivity({ dealerId, actor, tableName: 'role_permissions', recordId: null, action: 'updated', summary: `Permissions updated — ${role}` });
      toast.success('Permissions saved');
    }
    setSavingRole(null);
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;
  if (loadErr) return <p className="text-sm" style={{ color: premiumLight.accentText }}>Could not load the switches. Refresh to try again.</p>;

  return (
    <div className="space-y-5">
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Do you have a manager?</p>
        <p style={{ fontSize: 11.5, color: '#6b7280', margin: '2px 0 10px' }}>No hides the manager role everywhere: Team, these switches and Overview.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[[true, 'Yes'], [false, 'No, I run it myself']].map(([v, l]) => (
            <button key={l} type="button" onClick={() => v !== hasManager && saveHasManager(v)}
              style={{ padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                background: hasManager === v ? '#111827' : '#eceef1', color: hasManager === v ? '#fff' : '#374151' }}>{l}</button>
          ))}
        </div>
      </div>
      {CONFIGURABLE_ROLES.filter(({ value }) => (value !== 'manager' || hasManager) && (capabilitiesForRole(value).length || roleExtras(value).length)).map(({ value, label }) => {
        // A switch the app does not check yet (`enforced: false`, src/lib/permissions.js) is not shown:
        // an owner who unticks it would believe the manager is limited when nothing stops them
        // (DASH-TEST 12). Its saved value is kept (the save writes the whole row back). Show it again
        // once the app AND the database (`dealer_can`) check it, by setting `enforced: true`.
        const caps = capabilitiesForRole(value).filter((c) => c.enforced !== false);
        return (
          <div key={value} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{label}</span>
              <SaveBtn sectionKey={`perm_${value}`} onClick={() => saveRole(value)} saving={{ [`perm_${value}`]: savingRole === value }} saved={{}} />
            </div>
            {/* Grouped by what each switch protects (src/lib/permissions.js CAPABILITY_GROUPS). */}
            {CAPABILITY_GROUPS.map(g => {
              const inGroup = caps.filter(c => (c.group || 'money') === g.id);
              if (!inGroup.length) return null;
              return (
                <div key={g.id} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '6px 0 6px' }}>{g.label}</p>
                  <div className="space-y-2">
                    {inGroup.map(cap => (
                      <label key={cap.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!rows[value]?.[cap.key]} onChange={() => toggle(value, cap.key)} style={{ accentColor: '#dc2626', marginTop: 2 }} />
                        <span>
                          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{cap.label}</span>
                          <span style={{ display: 'block', fontSize: 11, color: '#9ca3af' }}>{cap.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* Grantable extras — dealer-dashboard features lent to this role */}
            {roleExtras(value).length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 4px' }}>Extra features</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 8px' }}>Grant dealer-dashboard features into this role's own panel (scoped to their own data). Off by default.</p>
                <div className="space-y-2">
                  {roleExtras(value).map(f => {
                    const key = `feat_${f.id}`;
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={rows[value]?.[key] === true} onChange={() => toggle(value, key)} style={{ accentColor: '#dc2626', marginTop: 2 }} />
                        <span>
                          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{f.label}</span>
                          {f.description && <span style={{ display: 'block', fontSize: 11, color: '#9ca3af' }}>{f.description}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: '#9ca3af' }}>Only you, the owner, can do these, whatever the switches say: {OWNER_ONLY.join(', ').toLowerCase()}.</p>
    </div>
  );
}

// ─── WhatsApp Template Editor (SET-1) ─────────────────────────────────────────
function WaTemplatesEditor({ dealerId, actor }) {
  const [tpls, setTpls] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dealerId) return;
    supabase.from('profiles').select('whatsapp_templates').eq('id', dealerId).maybeSingle()
      .then(({ data }) => {
        const t = data?.whatsapp_templates;
        setTpls(Array.isArray(t) && t.length ? t.map(x => ({ ...x })) : DEFAULT_WA_TEMPLATES.map(x => ({ ...x })));
      });
  }, [dealerId]);

  const update = (i, k, v) => setTpls(p => p.map((t, idx) => idx === i ? { ...t, [k]: v } : t));
  const remove = (i) => setTpls(p => p.filter((_, idx) => idx !== i));
  const add = () => setTpls(p => [...p, { label: 'New template', message: 'Hi {{name}}, ' }]);
  const reset = () => setTpls(DEFAULT_WA_TEMPLATES.map(x => ({ ...x })));

  const save = async () => {
    setBusy(true);
    const clean = (tpls || []).filter(t => t.label.trim() && t.message.trim());
    const { error } = await supabase.from('profiles').update({ whatsapp_templates: clean }).eq('id', dealerId);
    if (error) { toast.error('Save failed'); }
    else {
      logActivity({ dealerId, actor, tableName: 'profiles', recordId: dealerId, action: 'updated', summary: 'WhatsApp templates updated' });
      toast.success('Templates saved');
    }
    setBusy(false);
  };

  if (tpls === null) return <p className="text-gray-500 text-sm">Loading…</p>;

  return (
    <div className="space-y-3">
      <p style={{ fontSize: 11, color: '#9ca3af' }}>
        Placeholders: {WA_PLACEHOLDERS.map(p => p.token).join('  ·  ')}
      </p>
      {tpls.map((t, i) => (
        <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div className="flex items-center gap-2 mb-2">
            <input value={t.label} onChange={e => update(i, 'label', e.target.value)} className={iCls} placeholder="Template name" style={{ fontWeight: 600 }} />
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
          <textarea value={t.message} onChange={e => update(i, 'message', e.target.value)} rows={2} className={taCls} placeholder="Message with {{placeholders}}" />
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <button onClick={add} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: '#6b7280', border: '1px solid #e5e7eb', background: '#fff' }}>+ Add template</button>
          <button onClick={reset} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: '#9ca3af', border: '1px solid #e5e7eb', background: '#fff' }}>Reset to defaults</button>
        </div>
        <button onClick={save} disabled={busy} className="btn-shimmer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={T.btnRed}>
          {busy ? 'Saving…' : 'Save templates'}
        </button>
      </div>
    </div>
  );
}

// ─── SettingsTab ──────────────────────────────────────────────────────────────
export default function SettingsTab({ profile, onProfileUpdate, jumpTo, onOpenServices }) {
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [errors, setErrors] = useState({});
  const [settingsNav, setSettingsNav] = useState(null);

  // Section states
  const [dealership, setDealership] = useState(profile?.dealership || "");
  const [siteName, setSiteName] = useState(profile?.site_name || "");
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number || "");
  const [contactEmail, setContactEmail] = useState(profile?.email || "");
  const [contactPhone, setContactPhone] = useState(profile?.phone || "");
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
  const [statYears, setStatYears] = useState(profile?.stat_years != null ? String(profile.stat_years) : "");
  const [statHappyCustomers, setStatHappyCustomers] = useState(profile?.stat_happy_customers != null ? String(profile.stat_happy_customers) : "");
  const [dealDisclaimer, setDealDisclaimer] = useState(profile?.deal_disclaimer || "");
  const [commType, setCommType] = useState(profile?.commission_config?.type || "percent_gross");
  const [commValue, setCommValue] = useState(profile?.commission_config?.value != null ? String(profile.commission_config.value) : "10");
  const [handlesRti, setHandlesRti] = useState(profile?.handles_roadtax_insurance !== false);
  // Cost-floor settings (separate table: dealer_cost_settings)
  const settingsDealerId = getDealerIdFromProfile(profile);
  const [costSettings, setCostSettings] = useState({
    monthly_overhead: "", avg_fleet_size: "", floor_plan_rate: "",
    runner_fee: "", admin_fee: "", warranty_reserve_pct: "",
  });
  // Discount limit (batch 6a): above it, a salesman's price waits for the dealer's OK.
  // Saved in its own write so a missing column can never break the cost save above.
  const [discountLimit, setDiscountLimit] = useState({ amount: "", pct: "" });
  const [dealerState, setDealerState] = useState(profile?.state || '');
  const [dealerCity, setDealerCity]   = useState(profile?.city  || '');
  const [dealerAddress, setDealerAddress] = useState(profile?.location || '');
  const [businessHours, setBusinessHours] = useState(profile?.business_hours || '');
  // Identity fields buyers see on every listing (TRUST-2). ssm_number was only
  // ever captured at onboarding and had no way to be edited or added later.
  const [ssmNumber, setSsmNumber] = useState(profile?.ssm_number || '');
  // Deposit policy (TRUST-4). Buyers see this at the deposit ask on every listing;
  // when it is unset the listing says so rather than assuming a policy for you.
  const [depositPolicy, setDepositPolicy] = useState(profile?.deposit_policy || '');
  const [depositTerms, setDepositTerms] = useState(profile?.deposit_terms || '');
  // The one charge on a listing that genuinely varies by seller and location.
  const [processingFee, setProcessingFee] = useState(
    profile?.processing_fee != null ? String(profile.processing_fee) : '',
  );
  const [dealerPostcode, setDealerPostcode] = useState(profile?.postcode || '');
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ── 2FA / TOTP (SEC-1) ──
  const [mfaFactors, setMfaFactors] = useState([]);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaEnroll, setMfaEnroll] = useState(null); // { factorId, qr, secret }
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState("");

  const [tgToken, setTgToken] = useState(""); // SEC-5: write-only field, never prefilled
  const tokenConfigured = !!profile?.telegram_bot_token;
  const [tgChannel, setTgChannel] = useState(profile?.telegram_channel_id || "");
  const [tgAutoPost, setTgAutoPost] = useState(profile?.telegram_auto_post || false);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState(null);

  const [subdomain, setSubdomain] = useState(profile?.subdomain || '');
  const [subdomainStatus, setSubdomainStatus] = useState(null); // 'checking' | 'taken' | 'available' | 'unchanged'
  const [logoUrl, setLogoUrl] = useState(profile?.site_logo_url || '');
  const [logoBusy, setLogoBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [planUsage, setPlanUsage] = useState(null);
  const [settingsLastChange, setSettingsLastChange] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    const dealerIdForUsage = profile.role === 'manager' || profile.role === 'admin' ? profile.dealer_id : profile.id;
    if (!dealerIdForUsage) return;
    supabase.rpc('get_plan_usage', { p_dealer_id: dealerIdForUsage }).then(({ data }) => {
      if (data) setPlanUsage(data);
    });
    supabase.from('activity_log')
      .select('actor_name, actor_role, created_at, summary')
      .eq('dealer_id', dealerIdForUsage)
      .eq('table_name', 'profiles')
      .eq('action', 'settings_updated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setSettingsLastChange(data); });
  }, [profile?.id]);

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
    setStatYears(profile.stat_years != null ? String(profile.stat_years) : "");
    setStatHappyCustomers(profile.stat_happy_customers != null ? String(profile.stat_happy_customers) : "");
    setDealDisclaimer(profile.deal_disclaimer || "");
    setCommType(profile.commission_config?.type || "percent_gross");
    setCommValue(profile.commission_config?.value != null ? String(profile.commission_config.value) : "10");
    setHandlesRti(profile.handles_roadtax_insurance !== false);
    setDealerState(profile.state || '');
    setDealerCity(profile.city || '');
    setDealerAddress(profile.location || '');
    setBusinessHours(profile.business_hours || '');
    setSsmNumber(profile.ssm_number || '');
    setDepositPolicy(profile.deposit_policy || '');
    setDepositTerms(profile.deposit_terms || '');
    setProcessingFee(profile.processing_fee != null ? String(profile.processing_fee) : '');
    setDealerPostcode(profile.postcode || '');
    setTgToken(""); // SEC-5: write-only — never load the stored token back into the form
    setTgChannel(profile.telegram_channel_id || "");
    setTgAutoPost(profile.telegram_auto_post || false);
    setSubdomain(profile.subdomain || "");
    setSubdomainStatus(null);
    setLogoUrl(profile.site_logo_url || "");
    setAvatarUrl(profile.avatar_url || "");
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

  // Load dealer cost-floor settings once
  useEffect(() => {
    if (!settingsDealerId) return;
    supabase.from("dealer_cost_settings").select("*").eq("dealer_id", settingsDealerId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCostSettings({
          monthly_overhead: data.monthly_overhead != null ? String(data.monthly_overhead) : "",
          avg_fleet_size: data.avg_fleet_size != null ? String(data.avg_fleet_size) : "",
          floor_plan_rate: data.floor_plan_rate != null ? String(data.floor_plan_rate) : "",
          runner_fee: data.runner_fee != null ? String(data.runner_fee) : "",
          admin_fee: data.admin_fee != null ? String(data.admin_fee) : "",
          warranty_reserve_pct: data.warranty_reserve_pct != null ? String(data.warranty_reserve_pct) : "",
        });
        setDiscountLimit({
          amount: data.discount_limit_amount != null ? String(data.discount_limit_amount) : "",
          pct: data.discount_limit_pct != null ? String(data.discount_limit_pct) : "",
        });
      });
  }, [settingsDealerId]);

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
    let success = false;
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
      success = true;
    } catch (e) {
      const msg = e.message?.includes("dealership_name_change_limit_reached")
        ? "Dealership name can only be changed twice. Contact support to change it again."
        : e.message;
      setErrors((p) => ({ ...p, [key]: msg }));
    }
    setSaving((p) => ({ ...p, [key]: false }));
    return success;
  };

  const saveDealership = async () => {
    // The name-change limit locks ONLY the name — brand colour, site name and
    // subdomain stay freely saveable. Never write the dealership column when the
    // name is locked or unchanged (touching it can trip the limit trigger).
    if (!dealershipLocked && !dealership.trim()) {
      setErrors((p) => ({ ...p, identity: "Dealership name cannot be empty." }));
      return;
    }
    // SSM is required (owner, 2026-11-16): buyers trust a listing with a real company number behind it.
    if (ssmNumber.replace(/[^A-Za-z0-9]/g, '').length < 6) {
      setErrors((p) => ({ ...p, identity: "Fill in your company registration (SSM) number, e.g. 202301234567 or 1234567-A." }));
      return;
    }
    const dealershipChanged = !dealershipLocked && dealership.trim() !== (profile?.dealership || "");
    const logoChanged = (logoUrl || "") !== (profile?.site_logo_url || "");
    const avatarChanged = (avatarUrl || "") !== (profile?.avatar_url || "");
    const payload = {
      site_name: siteName.trim() || (profile?.dealership || dealership.trim() || ""),
      subdomain,
      ssm_number: ssmNumber.trim(),
      ...(logoChanged && { site_logo_url: logoUrl || null }),
      ...(avatarChanged && { avatar_url: avatarUrl || null }),
      ...(dealershipChanged && {
        dealership: dealership.trim(),
        dealership_change_count: changeCount + 1,
        dealership_name_changed_at: new Date().toISOString(),
      }),
      ...(subdomain !== profile?.subdomain && {
        subdomain_changed_at: new Date().toISOString(),
        previous_subdomain: profile?.subdomain,
      }),
    };
    const ok = await saveSection("identity", payload);
    if (ok) {
      const changes = [];
      const fc = {};
      if (dealership.trim() !== profile?.dealership) { changes.push(`name "${profile?.dealership}" → "${dealership.trim()}"`); fc.dealership = { from: profile?.dealership, to: dealership.trim() }; }
      if (subdomain !== profile?.subdomain) { changes.push(`subdomain "${profile?.subdomain}" → "${subdomain}"`); fc.subdomain = { from: profile?.subdomain, to: subdomain }; }
      if (changes.length) {
        const dealerIdForLog = profile?.role === 'manager' || profile?.role === 'admin' ? profile?.dealer_id : profile?.id;
        logActivity({ dealerId: dealerIdForLog, actor: profile, tableName: 'profiles', recordId: profile?.id, action: 'settings_updated', summary: `Settings updated: ${changes.join('; ')}`, fieldChanges: fc });
        setSettingsLastChange({ actor_name: profile?.full_name || profile?.email, actor_role: profile?.role, created_at: new Date().toISOString(), summary: `Settings updated: ${changes.join('; ')}` });
      }
    }
  };

  // Dealership logo — the file is uploaded to the avatars bucket immediately (so
  // we have a URL to preview), but it is only STAGED in local state. It is not
  // written to the profile until the Save button is clicked (saveDealership),
  // exactly like the name / subdomain / site-name fields — so the change marks
  // the form dirty and unlocks Save instead of silently persisting.
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Logo must be under 3 MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    setLogoBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/dealer-logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) { toast.error("Upload failed: " + upErr.message); setLogoBusy(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setLogoUrl(`${publicUrl}?t=${Date.now()}`); // stage only — persisted on Save
    } catch (err) { toast.error(err.message || "Upload failed"); }
    setLogoBusy(false);
  };
  // Stage removal only — cleared from the profile when Save is clicked.
  const removeLogo = () => setLogoUrl("");

  // Dealer profile picture — same staged-upload pattern as the logo above:
  // upload to the avatars bucket for a preview URL, but only persist to
  // profiles.avatar_url when Save is clicked. This is the dealer's personal
  // avatar shown in the dashboard header, distinct from the storefront logo.
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Photo must be under 3 MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    setAvatarBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) { toast.error("Upload failed: " + upErr.message); setAvatarBusy(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`); // stage only — persisted on Save
    } catch (err) { toast.error(err.message || "Upload failed"); }
    setAvatarBusy(false);
  };
  const removeAvatar = () => setAvatarUrl("");

  // Save enables on ANY single change (name OR site name OR subdomain) —
  // the name lock no longer gates the button.
  const identityDirty =
    (!dealershipLocked && dealership.trim() !== (profile?.dealership || "")) ||
    (siteName.trim() || "") !== (profile?.site_name || "") ||
    subdomain !== (profile?.subdomain || "") ||
    (ssmNumber.trim() || "") !== (profile?.ssm_number || "") ||
    (logoUrl || "") !== (profile?.site_logo_url || "") ||
    (avatarUrl || "") !== (profile?.avatar_url || "");

  const saveContact = () => {
    if ((whatsapp && !isValidMyPhone(whatsapp, { mobileOnly: true })) || (contactPhone && !isValidMyPhone(contactPhone))) {
      setErrors((p) => ({ ...p, contact: MY_PHONE_ERROR }));
      return;
    }
    return saveSection("contact", {
      whatsapp_number: whatsapp.trim() ? toPlus60(whatsapp) : '',
      email: contactEmail.trim(),
      phone: contactPhone.trim() ? toPlus60(contactPhone) : '',
      social_tiktok: tiktok.trim(),
      social_instagram: instagram.trim(),
      social_facebook: facebook.trim(),
      state: dealerState.trim(),
      city:  dealerCity.trim(),
      location: dealerAddress.trim(),
      business_hours: businessHours.trim(),
      postcode: dealerPostcode.trim(),
      deposit_policy: depositPolicy || null,
      deposit_terms: depositTerms.trim() || null,
      processing_fee: processingFee.trim() === '' ? null : (Number(processingFee) || 0),
    });
  };

  const saveTelegram = () =>
    saveSection("telegram", {
      // SEC-5: only overwrite the stored token when a new one is typed
      ...(tgToken.trim() ? { telegram_bot_token: tgToken.trim() } : {}),
      telegram_channel_id: tgChannel.trim(),
      telegram_auto_post: tgAutoPost,
    });

  const testTelegram = async () => {
    if (!tgChannel.trim() || (!tgToken.trim() && !tokenConfigured)) {
      setErrors((p) => ({ ...p, telegram: "Fill in bot token and channel ID first." }));
      return;
    }
    // Save before testing. The token has to be saved so the edge function can read
    // it — and the CHANNEL ID has to be saved too, because send-telegram now only
    // delivers to a destination already stored on a profile the caller owns. This
    // used to be skipped whenever the token field was left blank (the normal case
    // for a dealer editing only the channel), which would now fail the test.
    await saveSection("telegram", {
      ...(tgToken.trim() ? { telegram_bot_token: tgToken.trim() } : {}),
      telegram_channel_id: tgChannel.trim(),
      telegram_auto_post: tgAutoPost,
    });
    setTgTesting(true);
    setTgTestResult(null);
    setErrors((p) => ({ ...p, telegram: "" }));
    try {
      const dealerId = profile?.role === 'manager' || profile?.role === 'admin' ? profile?.dealer_id : profile?.id;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('send-telegram', {
        body: {
          dealer_id: dealerId,
          channel_id: tgChannel.trim(),
          message: "DrevoOS Telegram connected! Auto-posting is active.",
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const data = res.data;
      if (data?.ok) {
        setTgTestResult("ok");
      } else if (data?.error === 'no_token') {
        setTgTestResult("fail");
        setErrors((p) => ({ ...p, telegram: "No token saved. Save settings first." }));
      } else {
        setTgTestResult("fail");
        setErrors((p) => ({ ...p, telegram: data?.description || "Test failed. Check token and channel ID." }));
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
      stat_years: statYears.trim() === "" ? null : (parseInt(statYears, 10) || null),
      stat_happy_customers: statHappyCustomers.trim() === "" ? null : (parseInt(statHappyCustomers, 10) || null),
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

  // ── 2FA / TOTP handlers (SEC-1) ──
  const loadMfaFactors = async () => {
    setMfaLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setMfaFactors(data?.totp || []);
    setMfaLoading(false);
  };
  useEffect(() => { loadMfaFactors(); }, []);

  const startMfaEnroll = async () => {
    setMfaError("");
    setMfaBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setMfaBusy(false);
    if (error) { setMfaError(error.message); return; }
    setMfaEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setMfaCode("");
  };

  const verifyMfaEnroll = async () => {
    if (!mfaEnroll || mfaCode.trim().length < 6) { setMfaError("Enter the 6-digit code."); return; }
    setMfaError("");
    setMfaBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaEnroll.factorId });
    if (chErr) { setMfaError(chErr.message); setMfaBusy(false); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: mfaEnroll.factorId, challengeId: ch.id, code: mfaCode.trim(),
    });
    setMfaBusy(false);
    if (vErr) { setMfaError("Invalid code. Try again."); return; }
    logActivity({ dealerId: profile?.id, actor: profile, tableName: "profiles", recordId: profile?.id, action: "mfa_enabled", summary: "Two-factor authentication enabled" });
    setMfaEnroll(null);
    setMfaCode("");
    toast.success("Two-factor authentication enabled");
    loadMfaFactors();
  };

  const cancelMfaEnroll = async () => {
    if (mfaEnroll?.factorId) await supabase.auth.mfa.unenroll({ factorId: mfaEnroll.factorId }).catch(() => {});
    setMfaEnroll(null);
    setMfaCode("");
    setMfaError("");
  };

  // ── SEC-4: log out everywhere ──
  const [logoutBusy, setLogoutBusy] = useState(false);
  const logoutAllDevices = async () => {
    if (!window.confirm("Sign out of DrevoOS on all devices? You'll need to log in again.")) return;
    setLogoutBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) { toast.error(error.message); setLogoutBusy(false); return; }
    logActivity({ dealerId: profile?.id, actor: profile, tableName: "profiles", recordId: profile?.id, action: "updated", summary: "Signed out of all devices" });
    window.location.href = "/login";
  };

  // ── MOBILE-7: self-service account deletion (dealer/owner only — see the
  // 'danger' nav item's gate above). Soft delete: flips this profile to
  // account_status='deleted', which hides the storefront/listings immediately;
  // nothing is actually destroyed until the 30-day purge cron runs, and
  // logging back in before then restores everything (restore_my_account()).
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  useModalHistory(deleteConfirmOpen, () => setDeleteConfirmOpen(false));
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    document.body.style.overflow = deleteConfirmOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [deleteConfirmOpen]);
  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("delete-account");
    if (error || (data && data.error)) {
      console.error("delete-account:", error || data?.error);
      toast.error("Couldn't delete your account. Please try again.");
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/login";
  };

  const removeMfaFactor = async (factorId) => {
    if (!window.confirm("Disable two-factor authentication for this account?")) return;
    setMfaBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setMfaBusy(false);
    if (error) { toast.error(error.message); return; }
    logActivity({ dealerId: profile?.id, actor: profile, tableName: "profiles", recordId: profile?.id, action: "mfa_disabled", summary: "Two-factor authentication disabled" });
    toast.success("Two-factor authentication disabled");
    loadMfaFactors();
  };

  const saveDealSheet = () => saveSection("dealsheet", { deal_disclaimer: dealDisclaimer.trim() || null });

  const saveCostSettings = async () => {
    setSaving((p) => ({ ...p, costs: true }));
    setErrors((p) => ({ ...p, costs: "" }));
    try {
      const numOrNull = (v) => (v === "" || v == null ? 0 : Number(v) || 0);
      const { error } = await supabase.from("dealer_cost_settings").upsert({
        dealer_id: settingsDealerId,
        monthly_overhead: numOrNull(costSettings.monthly_overhead),
        avg_fleet_size: costSettings.avg_fleet_size === "" ? 20 : Number(costSettings.avg_fleet_size) || 20,
        floor_plan_rate: numOrNull(costSettings.floor_plan_rate),
        runner_fee: numOrNull(costSettings.runner_fee),
        admin_fee: numOrNull(costSettings.admin_fee),
        warranty_reserve_pct: numOrNull(costSettings.warranty_reserve_pct),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      const lim = (v) => (v === "" || v == null ? null : Math.max(0, Number(v) || 0));
      const { error: limErr } = await supabase.from("dealer_cost_settings")
        .update({ discount_limit_amount: lim(discountLimit.amount), discount_limit_pct: lim(discountLimit.pct) })
        .eq("dealer_id", settingsDealerId);
      if (limErr) {
        // Columns arrive with tonight's database update (20261109g).
        if (discountLimit.amount !== "" || discountLimit.pct !== "") {
          throw new Error("Costs saved. The discount limit can be saved after tonight's update.");
        }
      }
      flash("costs");
    } catch (e) {
      setErrors((p) => ({ ...p, costs: e.message }));
    }
    setSaving((p) => ({ ...p, costs: false }));
  };

  const saveCommission = () => saveSection("commission", {
    commission_config: { type: commType, value: Number(commValue) || 0 },
  });

  const saveStorefront = () =>
    saveSection("storefront", {
      storefront_why: sfWhy,
      storefront_how: sfHow,
      storefront_testimonials: sfTestimonials,
      storefront_cta: sfCta,
    });

  const planCfg = getPlanConfig(profile?.plan);
  const nextPlan = nextDealerPlan(profile?.plan);
  const nextPlanCfg = nextPlan ? getPlanConfig(nextPlan) : null;

  const settingsNavGroupsAll = [
    { group: 'Profile', items: [
      { key: 'identity', icon: Building2, label: 'Dealership', desc: 'Name, logo & brand color' },
      { key: 'contact', icon: Phone, label: 'Contact & Socials', desc: 'WhatsApp, email & social links' },
    ]},
    { group: 'Storefront', items: [
      { key: 'frontpage', icon: Globe, label: 'Homepage', desc: 'Hero banner, CTA & announcement' },
      { key: 'autopost', icon: Share2, label: 'Auto-post', desc: 'Post every car to your socials once' },
      { key: 'storefront', icon: Settings, label: 'Page Content', desc: 'About, photos & layout' },
    ]},
    { group: 'Operations', items: [
      { key: 'commission', icon: DollarSign, label: 'Commission', desc: 'Sales commission structure' },
      { key: 'costs', icon: Calculator, label: 'Cost Floor', desc: 'Overhead, runner & holding costs' },
      { key: 'dealsheet', icon: FileText, label: 'Deal Sheet', desc: 'Customer proposal settings' },
      { key: 'availability', icon: Clock, label: 'Viewing Hours', desc: 'When buyers can book viewings' },
      // The add-on catalogue has ONE home: Storefront > Services & Add-ons (ServicesPage).
      // This entry is a shortcut there, not a second editor.
      { key: 'services', icon: Package, label: 'Services', desc: 'Opens Storefront > Services & Add-ons' },
      { key: 'handover_ops', icon: ClipboardCheck, label: 'Handover', desc: 'Road tax & insurance handling' },
    ]},
    { group: 'Notifications', items: [
      { key: 'telegram', icon: Send, label: 'Telegram', desc: 'Bot alert notifications' },
      { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', desc: 'Message templates' },
    ]},
    { group: 'Account', items: [
      { key: 'verify', icon: ShieldCheck, label: 'Verify ID', desc: 'Required before buyers can see your cars' },
      { key: 'security', icon: KeyRound, label: 'Security', desc: 'Password & 2-factor auth' },
      { key: 'team', icon: Lock, label: 'Team', desc: 'Staff access & roles' },
      { key: 'plan', icon: CreditCard, label: 'Plan & Billing', desc: 'Current plan & usage' },
      // Self-service deletion is for the account that OWNS the dealership — a
      // linked manager/admin/accountant/fi_officer sharing this same Settings
      // tab is dealer-managed and cannot self-delete (delete-account 403s
      // them regardless), so the option itself is hidden rather than shown
      // and rejected.
      ...(profile?.role === 'dealer' || profile?.role === 'owner'
        ? [{ key: 'danger', icon: Trash2, label: 'Delete Account', desc: 'Close your dealer account' }]
        : []),
    ]},
  ];
  // Staff (manager, admin) see only their own password. Every other section writes to the
  // profile row of whoever is signed in, so a manager saving "Dealership" renamed THEMSELVES,
  // and billing, staff, the switches and deleting the dealership are the owner's alone.
  const settingsNavGroups = isFullAccessRole(profile?.role)
    ? settingsNavGroupsAll
    : [{ group: 'Account', items: settingsNavGroupsAll.flatMap(g => g.items).filter(i => i.key === 'security') }];

  // The Verify-ID prompt on the listings tab deep-links straight to that
  // section — landing on 'Dealership' and making them hunt is how the step got
  // missed in the first place.
  useEffect(() => { if (jumpTo) setSettingsNav(jumpTo); }, [jumpTo]);

  const navKeys = new Set(settingsNavGroups.flatMap(g => g.items).map(i => i.key));
  const effectiveNav = settingsNav && navKeys.has(settingsNav) ? settingsNav
    : (isFullAccessRole(profile?.role) ? 'identity' : 'security');

  const sectionContent = (
    <div className="space-y-4 max-w-2xl">
      {effectiveNav === 'verify' && (
        <VerifyIdentity
          profile={profile}
          userId={profile?.id}
          theme="light"
          onSubmitted={() => onProfileUpdate?.({ ...profile, kyc_submitted_at: new Date().toISOString() })}
        />
      )}
      {effectiveNav === 'availability' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px' }}>
          <AvailabilityEditor ownerId={profile?.id} dealerId={profile?.id} />
          <p style={{ margin: '18px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            This is your dealership's house schedule — it applies to cars not assigned to a specific salesman. Assigned reps set their own hours in their panel.
          </p>
        </div>
      )}
      {(effectiveNav === 'plan') && planUsage && (
        <div style={{ background: '#fff', border: 'none', boxShadow: PL.shadow, borderRadius: PL.radius.card, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, letterSpacing: 2, color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>CURRENT PLAN</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{planCfg.label}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>RM {planCfg.price.toLocaleString()}</p>
              <p style={{ fontSize: 11, color: '#6b7280' }}>/month</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: nextPlanCfg ? 16 : 0 }}>
            <div style={{ background: '#f5f6f8', border: 'none', borderRadius: 12, padding: '12px 16px' }}>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>LISTINGS</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: planUsage.listing_cap && planUsage.active_listings >= planUsage.listing_cap ? '#dc2626' : '#111827' }}>
                {planUsage.active_listings ?? 0}
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 400 }}>
                  {planUsage.listing_cap ? ` / ${planUsage.listing_cap}` : ' / unlimited'}
                </span>
              </p>
              {planUsage.listing_cap && (
                <div style={{ marginTop: 8, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: planUsage.active_listings >= planUsage.listing_cap ? '#dc2626' : '#111827', width: `${Math.min(100, (planUsage.active_listings / planUsage.listing_cap) * 100)}%`, transition: 'width 0.4s' }} />
                </div>
              )}
            </div>
            <div style={{ background: '#f5f6f8', border: 'none', borderRadius: 12, padding: '12px 16px' }}>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>TEAM SEATS</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: planUsage.seat_cap && planUsage.seat_count >= planUsage.seat_cap ? '#dc2626' : '#111827' }}>
                {planUsage.seat_count ?? 0}
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 400 }}>
                  {planUsage.seat_cap ? ` / ${planUsage.seat_cap}` : ' / unlimited'}
                </span>
              </p>
              {planUsage.seat_cap && (
                <div style={{ marginTop: 8, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: planUsage.seat_count >= planUsage.seat_cap ? '#dc2626' : '#111827', width: `${Math.min(100, (planUsage.seat_count / planUsage.seat_cap) * 100)}%`, transition: 'width 0.4s' }} />
                </div>
              )}
            </div>
            {planUsage.hp_submissions_mtd != null && (
              <div style={{ background: '#f5f6f8', border: 'none', borderRadius: 12, padding: '12px 16px', gridColumn: '1 / -1' }}>
                <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>HP SUBMISSIONS THIS MONTH</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{planUsage.hp_submissions_mtd}</p>
              </div>
            )}
          </div>
          {nextPlanCfg && (
            <a href="mailto:support@xdrive.my?subject=Upgrade to Plan" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f5f6f8', border: 'none', borderRadius: 8, textDecoration: 'none' }}>
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>Upgrade to {nextPlanCfg.label}</span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>RM {nextPlanCfg.price.toLocaleString()}/mo →</span>
            </a>
          )}
        </div>
      )}
      {effectiveNav === 'identity' && <SettingsSection
        title="Dealership Identity"
        subtitle="Your brand name, site title & accent colour"
        icon={Building2}
      >
        {/* Change count badge */}
        <div
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${changesLeft === 1 && !dealershipLocked ? "pl-note-bad" : "pl-note"}`}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subdomain</label>
              <span className="text-xs text-gray-600">Your storefront URL</span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex items-center rounded-xl overflow-hidden flex-1" style={{ background: "#f5f6f8" }}>
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => {
                    const clean = sanitizeSubdomain(e.target.value);
                    setSubdomain(clean);
                    checkSubdomain(clean);
                  }}
                  placeholder="your-dealership"
                  className="flex-1 bg-transparent py-2 px-3 text-gray-900 text-sm outline-none"
                />
                <span className="px-3 text-gray-500 text-sm select-none border-l border-gray-200 py-2 bg-gray-50">.drevo.my</span>
              </div>
              {subdomainStatus === 'checking' && <span className="text-xs text-gray-500 whitespace-nowrap">Checking...</span>}
              {subdomainStatus === 'taken' && <span className="text-xs text-red-600 whitespace-nowrap">Already taken</span>}
              {subdomainStatus === 'available' && <span className="text-xs text-green-400 whitespace-nowrap">✓ Available</span>}
            </div>
            {profile?.subdomain && (
              <p className="text-xs text-gray-500 mt-1">
                Your site:&nbsp;
                <a href={buildStorefrontUrl(profile.subdomain)} target="_blank" rel="noopener noreferrer" style={{ color: '#DC2626', textDecoration: 'none', fontWeight: 500 }}>
                  {profile.subdomain}.drevo.my
                </a>
              </p>
            )}
            {subdomain !== profile?.subdomain && profile?.subdomain && (
              <p className="text-xs text-yellow-600 mt-1">
                ⚠ Changing your subdomain will break existing links at <code className="font-mono">{profile.subdomain}.drevo.my</code>
              </p>
            )}
          </div>
        )}

        <SettingsField label="Company Registration (SSM)" hint="Required · shown on every listing">
          <input
            value={ssmNumber}
            onChange={(e) => setSsmNumber(e.target.value)}
            placeholder="e.g. 202301234567 or 1234567-A"
            required
            aria-required="true"
            className={iCls}
          />
          {!ssmNumber.trim() && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>Required. Buyers trust a dealer with a real company number behind it.</p>}
        </SettingsField>

        <SettingsField label="Site / Tab Name" hint="Shows in browser tab">
          <input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="e.g. Auto City — Used Cars Penang"
            className={iCls}
          />
        </SettingsField>

        <SettingsField label="Profile Picture" hint="Your personal avatar, shown in the dashboard">
          <div className="flex items-center gap-3 flex-wrap">
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <User className="w-5 h-5 text-gray-400" />}
            </div>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151', opacity: avatarBusy ? 0.5 : 1 }}>
              <Upload className="w-3.5 h-3.5" />
              {avatarBusy ? 'Uploading…' : (avatarUrl ? 'Change photo' : 'Upload photo')}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={avatarBusy} style={{ display: 'none' }} />
            </label>
            {avatarUrl && (
              <button type="button" onClick={removeAvatar} disabled={avatarBusy} className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ color: '#6b7280', border: '1px solid #e5e7eb' }}>
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">Square image works best. Max 3 MB. Click <span className="font-medium text-gray-700">Save</span> below to apply.</p>
        </SettingsField>

        <SettingsField label="Dealership Logo" hint="Shown in your storefront header">
          <div className="flex items-center gap-3 flex-wrap">
            <div style={{ width: 84, height: 48, borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {logoUrl
                ? <img src={logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <Building2 className="w-5 h-5 text-gray-400" />}
            </div>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151', opacity: logoBusy ? 0.5 : 1 }}>
              <Upload className="w-3.5 h-3.5" />
              {logoBusy ? 'Uploading…' : (logoUrl ? 'Change logo' : 'Upload logo')}
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={logoBusy} style={{ display: 'none' }} />
            </label>
            {logoUrl && (
              <button type="button" onClick={removeLogo} disabled={logoBusy} className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ color: '#6b7280', border: '1px solid #e5e7eb' }}>
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">Transparent PNG works best; scales to fit the header (square or wide). Max 3 MB. Click <span className="font-medium text-gray-700">Save</span> below to apply.</p>
        </SettingsField>

        <ErrMsg k="identity" errors={errors} />
        <div className="flex items-center justify-between pt-1 gap-4">
          {settingsLastChange ? (
            <p className="text-xs text-gray-500">
              Last changed by <span className="font-medium text-gray-700">{settingsLastChange.actor_name}</span>
              {' · '}{new Date(settingsLastChange.created_at).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          ) : <span />}
          <SaveBtn
            sectionKey="identity"
            onClick={saveDealership}
            disabled={!identityDirty || subdomainStatus === 'taken' || subdomainStatus === 'checking'}
            saving={saving}
            saved={saved}
          />
        </div>
      </SettingsSection>}
      {effectiveNav === 'contact' && <SettingsSection
        title="Contact & Socials"
        subtitle="What customers see when they click enquire or visit your profile"
        icon={Phone}
      >
        {/* Buyers judge a listing on whether a real business is behind it, and
            these fields are the only place that comes from. Naming the gaps beats
            a form that quietly stays empty. */}
        {(() => {
          const missing = [
            !dealerAddress.trim() && 'street address',
            !dealerPostcode.trim() && 'postcode',
            !businessHours.trim() && 'business hours',
            !contactPhone.trim() && 'landline',
          ].filter(Boolean);
          if (missing.length === 0) return null;
          return (
            <div className="flex items-start gap-2.5 p-3.5 pl-note">
              <AlertCircle size={15} className="text-gray-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 leading-relaxed m-0">
                Buyers see an <strong>About this dealer</strong> block on every one of your
                listings. It only shows what you have filled in — right now it is missing your{' '}
                {missing.join(', ')}.
              </p>
            </div>
          );
        })()}

        <SettingsField label="WhatsApp Number">
          <PhoneInput mobileOnly value={whatsapp} onChange={setWhatsapp} className={iCls}
            prefixClassName="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-200 bg-gray-50 flex-shrink-0"
            inputClassName="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm px-3 py-2.5" />
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
            <PhoneInput value={contactPhone} onChange={(v) => setContactPhone(v)} className={iCls} prefixClassName="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-200 bg-gray-50 flex-shrink-0" inputClassName="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm px-3 py-2.5" />
          </SettingsField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingsField label="State" hint="Pre-fills new listing location">
            <select value={dealerState} onChange={e => { setDealerState(e.target.value); setDealerCity(''); }} className={iCls}>
              <option value="">— select state —</option>
              {["Kuala Lumpur","Selangor","Penang","Johor","Perak","Melaka","Negeri Sembilan","Kedah","Kelantan","Terengganu","Pahang","Sabah","Sarawak"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </SettingsField>
          <SettingsField label="City / Area" hint="Pre-fills new listing location">
            <input
              value={dealerCity}
              onChange={e => setDealerCity(e.target.value)}
              placeholder="e.g. Petaling Jaya"
              className={iCls}
            />
          </SettingsField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingsField label="Postcode" hint="Completes the trading address buyers see">
            <input
              value={dealerPostcode}
              onChange={e => setDealerPostcode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="e.g. 47301"
              inputMode="numeric"
              className={iCls}
            />
          </SettingsField>
        </div>

        <SettingsField label="Street Address" hint="Shown on your storefront Visit Us card and on every listing, with a Directions link">
          <input
            value={dealerAddress}
            onChange={e => setDealerAddress(e.target.value)}
            placeholder="e.g. 12 Jalan Setia, Petaling Jaya"
            className={iCls}
          />
        </SettingsField>

        <SettingsField label="Business Hours" hint="Shown on your storefront, one line per day is fine">
          <textarea
            value={businessHours}
            onChange={e => setBusinessHours(e.target.value)}
            placeholder={"e.g. Mon–Sat 9am–6pm\nSun closed"}
            rows={2}
            className={iCls}
            style={{ resize: "vertical" }}
          />
        </SettingsField>

        <SettingsField
          label="Deposit Policy"
          hint="Shown at the deposit ask on every listing — the moment a buyer decides whether to trust you"
        >
          <div className="space-y-2">
            {[
              { v: 'refundable', l: 'Refundable', d: 'Returned if the buyer decides not to go ahead' },
              { v: 'refundable_on_loan_rejection', l: 'Refundable if the loan is rejected', d: 'Otherwise held against the purchase price' },
              { v: 'non_refundable', l: 'Non-refundable', d: 'Kept once paid, whatever happens' },
            ].map(({ v, l, d }) => (
              <button
                key={v}
                type="button"
                onClick={() => setDepositPolicy(depositPolicy === v ? '' : v)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${depositPolicy === v ? 'bg-white border-gray-900' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
              >
                <span className={`mt-0.5 h-4 w-4 rounded-full border flex-shrink-0 ${depositPolicy === v ? 'border-gray-900 bg-gray-900' : 'border-gray-300 bg-white'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{l}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{d}</span>
                </span>
              </button>
            ))}
            {!depositPolicy && (
              <p className="text-xs text-amber-700 m-0">
                Not set — listings currently tell buyers to ask you, in writing, before paying.
              </p>
            )}
          </div>
        </SettingsField>

        <SettingsField
          label="Handling / Runner Fee"
          hint="Your own fee on top of the official JPJ and Puspakom charges. Enter 0 if you charge none. Shown on every listing; left blank it reads 'Not stated'."
        >
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">RM</span>
            <input
              value={processingFee}
              onChange={e => setProcessingFee(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="e.g. 300"
              inputMode="decimal"
              className={`${iCls} pl-11`}
            />
          </div>
        </SettingsField>

        <SettingsField label="Deposit Details (optional)" hint="Who holds it, how long the car stays reserved">
          <textarea
            value={depositTerms}
            onChange={e => setDepositTerms(e.target.value)}
            placeholder={"e.g. Held by the showroom, car reserved for 7 days."}
            rows={2}
            className={iCls}
            style={{ resize: 'vertical' }}
          />
        </SettingsField>

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

        <ErrMsg k="contact" errors={errors} />
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="contact" onClick={saveContact} saving={saving} saved={saved} />
        </div>
      </SettingsSection>}
      {effectiveNav === 'frontpage' && <SettingsSection
        title="Front Page Control"
        subtitle="Full control over what customers see on your public site"
        icon={Globe}
      >
        {/* Announcement bar */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "#f5f6f8" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-gray-600" />
              <p className="text-gray-900 text-sm font-semibold">
                Announcement Bar
              </p>
            </div>
            <button
              onClick={() => setAnnouncementOn((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-all ${announcementOn ? "bg-gray-900" : "bg-gray-300"}`}
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

        {/* ── Storefront stat counters (Cars in Stock & Cars Sold pull from live data) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SettingsField label="Years in Business" hint="Shown in your homepage stats. Leave blank to hide.">
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={statYears}
              onChange={(e) => setStatYears(e.target.value)}
              placeholder="e.g. 12"
              className={iCls}
            />
          </SettingsField>
          <SettingsField label="Happy Customers" hint="Total customers served. Leave blank to hide.">
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={statHappyCustomers}
              onChange={(e) => setStatHappyCustomers(e.target.value)}
              placeholder="e.g. 850"
              className={iCls}
            />
          </SettingsField>
        </div>

        {/* ── Hero Video ── */}
        <div style={{ paddingTop: 16, borderTop: '1px solid rgba(17,24,39,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: heroVideoEnabled ? 12 : 0 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>Frontpage Video Section</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Show a YouTube / TikTok video on your store's homepage</p>
            </div>
            <button
              type="button"
              onClick={() => setHeroVideoEnabled(p => !p)}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0, cursor: 'pointer', border: 'none',
                background: heroVideoEnabled ? '#dc2626' : '#d1d5db',
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
                    <div style={{ aspectRatio: '16/9', maxWidth: 360, borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb', marginTop: 8 }}>
                      <iframe src={embed} style={{ width: '100%', height: '100%' }} allowFullScreen title="Video preview" />
                    </div>
                  )
                  : <p style={{ fontSize: 11, color: '#fbbf24', marginTop: 4 }}>⚠ Could not parse URL. Paste a YouTube, TikTok, or Instagram link.</p>;
              })()}
            </div>
          )}
        </div>

        <ErrMsg k="frontpage" errors={errors} />
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="frontpage" onClick={saveFrontPage} saving={saving} saved={saved} />
        </div>
      </SettingsSection>}
      {effectiveNav === 'security' && <SettingsSection
        title="Account Security"
        subtitle="Change your login password"
        icon={KeyRound}
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

        <ErrMsg k="password" errors={errors} />
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="password" onClick={savePassword} saving={saving} saved={saved} />
        </div>

        {/* ── Two-Factor Authentication (SEC-1) ── */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 20, paddingTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb", margin: 0 }}>Two-Factor Authentication</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>
                Require an authenticator-app code at login. Protects against stolen passwords.
              </p>
            </div>
            {!mfaLoading && mfaFactors.some(f => f.status === "verified") && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", background: '#f5f6f8', borderRadius: 6, padding: "3px 10px", whiteSpace: "nowrap" }}>
                ENABLED
              </span>
            )}
          </div>

          {mfaLoading ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 10 }}>Loading…</p>
          ) : mfaFactors.some(f => f.status === "verified") ? (
            <div style={{ marginTop: 12 }}>
              {mfaFactors.filter(f => f.status === "verified").map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: '#f5f6f8', borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "#e5e7eb" }}>{f.friendly_name || "Authenticator app"}</span>
                  <button onClick={() => removeMfaFactor(f.id)} disabled={mfaBusy}
                    style={{ fontSize: 12, color: "#f87171", background: '#f5f6f8', borderRadius: 6, padding: "5px 12px", cursor: "pointer", opacity: mfaBusy ? 0.6 : 1 }}>
                    Disable
                  </button>
                </div>
              ))}
            </div>
          ) : mfaEnroll ? (
            <div style={{ marginTop: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 16 }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12, lineHeight: 1.5 }}>
                Scan this QR code with Google Authenticator, Authy, or 1Password, then enter the 6-digit code to confirm.
              </p>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                <img src={`data:image/svg+xml;base64,${btoa(mfaEnroll.qr)}`} alt="2FA QR code" style={{ width: 150, height: 150, borderRadius: 8, background: "#fff", padding: 6 }} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Manual entry key</p>
                  <code style={{ fontSize: 11, color: "#fbbf24", wordBreak: "break-all", display: "block", marginBottom: 12 }}>{mfaEnroll.secret}</code>
                  <input
                    type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                    value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className={iCls}
                    style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: 18 }}
                  />
                </div>
              </div>
              {mfaError && <p style={{ fontSize: 12, color: "#f87171", marginTop: 10 }}>⚠ {mfaError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                <button onClick={cancelMfaEnroll} disabled={mfaBusy}
                  style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={verifyMfaEnroll} disabled={mfaBusy || mfaCode.length < 6}
                  style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#dc2626", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", opacity: (mfaBusy || mfaCode.length < 6) ? 0.5 : 1 }}>
                  {mfaBusy ? "Verifying…" : "Verify & Enable"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {mfaError && <p style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>⚠ {mfaError}</p>}
              <button onClick={startMfaEnroll} disabled={mfaBusy}
                className="pl-btn-grey" style={{ fontSize: 13, padding: "9px 18px", opacity: mfaBusy ? 0.6 : 1 }}>
                {mfaBusy ? "Setting up…" : "Enable 2FA"}
              </button>
            </div>
          )}
        </div>

        {/* ── Sessions (SEC-4) ── */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 20, paddingTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb", margin: 0 }}>Active Sessions</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>
              Sign out everywhere if a device is lost or a session may be compromised.
            </p>
          </div>
          <button onClick={logoutAllDevices} disabled={logoutBusy}
            style={{ fontSize: 13, fontWeight: 600, color: "#f87171", background: '#f5f6f8', borderRadius: 8, padding: "9px 16px", cursor: "pointer", whiteSpace: "nowrap", opacity: logoutBusy ? 0.6 : 1 }}>
            {logoutBusy ? "Signing out…" : "Log out all devices"}
          </button>
        </div>
      </SettingsSection>}
      {effectiveNav === 'danger' && <SettingsSection
        title="Danger Zone"
        subtitle="Permanently close your dealer account"
        icon={Trash2}
      >
        <div className="pl-note p-4">
          <p className="text-gray-700 text-xs leading-relaxed mb-3">
            Deleting your account hides your storefront and listings immediately.
            Nothing is destroyed for 30 days — logging back in within that window
            restores everything, including your staff and pipeline. After that,
            it's permanent and cannot be undone.
          </p>
          <button
            onClick={() => { setDeleteConfirmText(""); setDeleteConfirmOpen(true); }}
            className="pl-btn-grey text-red-600 text-xs px-3.5 py-2"
          >
            Delete my account
          </button>
        </div>
      </SettingsSection>}
      {effectiveNav === 'team' && <SettingsSection
        title="Team Permissions"
        subtitle="Control what each staff role can see and do"
        icon={Lock}
      >
        <PermissionsMatrix dealerId={getDealerIdFromProfile(profile)} actor={profile} />
      </SettingsSection>}
      {effectiveNav === 'whatsapp' && <SettingsSection
        title="WhatsApp Templates"
        subtitle="Customise the quick-message templates your team sends to leads"
        icon={MessageCircle}
      >
        <WaTemplatesEditor dealerId={getDealerIdFromProfile(profile)} actor={profile} />
      </SettingsSection>}
      {effectiveNav === 'dealsheet' && <SettingsSection
        title="Deal Sheet"
        subtitle="Your logo (from Dealership Identity) and a custom disclaimer appear on every deal sheet"
        icon={FileText}
      >
        <SettingsField label="Deal Sheet Disclaimer" hint="Shown at the bottom of every deal sheet">
          <textarea
            value={dealDisclaimer}
            onChange={(e) => setDealDisclaimer(e.target.value)}
            rows={4}
            placeholder="Leave blank to use the standard estimate/not-a-contract disclaimer."
            className={taCls}
          />
        </SettingsField>
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="dealsheet" onClick={saveDealSheet} saving={saving} saved={saved} />
        </div>
      </SettingsSection>}
      {effectiveNav === 'commission' && <SettingsSection
        title="Commission Structure"
        subtitle="Default rule used to suggest salesman commission on new listings"
        icon={DollarSign}
      >
        <div className="grid grid-cols-2 gap-3">
          <SettingsField label="Type">
            <select value={commType} onChange={(e) => setCommType(e.target.value)} className={iCls} style={{ appearance: "none" }}>
              <option value="percent_gross">% of gross margin</option>
              <option value="percent_sale">% of sale price</option>
              <option value="flat">Flat amount (RM)</option>
            </select>
          </SettingsField>
          <SettingsField label={commType === "flat" ? "Amount (RM)" : "Percentage (%)"}>
            <input
              type="number"
              value={commValue}
              onChange={(e) => setCommValue(e.target.value)}
              className={iCls}
              min="0"
              placeholder={commType === "flat" ? "e.g. 500" : "e.g. 10"}
            />
          </SettingsField>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Applied as the suggested commission when adding or editing a listing. Salesmen can still be set a custom amount per deal.
        </p>
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="commission" onClick={saveCommission} saving={saving} saved={saved} />
        </div>
      </SettingsSection>}
      {effectiveNav === 'handover_ops' && <SettingsSection
        title="Handover Operations"
        subtitle="Which post-sale work your dealership handles in-house"
        icon={ClipboardCheck}
      >
        <div className="flex items-center justify-between">
          <div style={{ minWidth: 0, paddingRight: 12 }}>
            <p className="text-gray-900 text-sm font-semibold">We handle road tax & insurance</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Turn off if the buyer or an external agent handles road tax and insurance. Those
              steps are then auto-marked N/A on the handover checklist, and road tax / insurance
              products are hidden from the add-on pickers.
            </p>
          </div>
          <button
            onClick={() => setHandlesRti((v) => !v)}
            className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${handlesRti ? "bg-gray-900" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${handlesRti ? "left-5" : "left-0.5"}`} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Only affects new won deals and pickers — steps already marked done are never changed.
        </p>
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="handover_ops" onClick={() => saveSection("handover_ops", { handles_roadtax_insurance: handlesRti })} saving={saving} saved={saved} />
        </div>
      </SettingsSection>}
      {effectiveNav === 'costs' && <SettingsSection
        title="Cost Floor Settings"
        subtitle="Silent per-unit costs applied automatically to every car's cost floor and P&L"
        icon={Calculator}
      >
        <p className="text-xs text-gray-500" style={{ marginBottom: 4 }}>
          Set these once. They apply to every car automatically — no per-unit typing. Leave a field at 0 to skip it.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <SettingsField label="Monthly overhead (RM)">
            <input type="number" min="0" value={costSettings.monthly_overhead}
              onChange={(e) => setCostSettings(s => ({ ...s, monthly_overhead: e.target.value }))}
              className={iCls} placeholder="e.g. 18000" />
          </SettingsField>
          <SettingsField label="Avg fleet size (units)">
            <input type="number" min="1" value={costSettings.avg_fleet_size}
              onChange={(e) => setCostSettings(s => ({ ...s, avg_fleet_size: e.target.value }))}
              className={iCls} placeholder="e.g. 20" />
          </SettingsField>
        </div>
        <p className="text-xs text-gray-500" style={{ marginTop: -4 }}>
          Daily holding cost = overhead ÷ fleet size ÷ 30. Used when no floor-plan rate is set below.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <SettingsField label="Floor-plan rate (% / year)">
            <input type="number" min="0" step="0.1" value={costSettings.floor_plan_rate}
              onChange={(e) => setCostSettings(s => ({ ...s, floor_plan_rate: e.target.value }))}
              className={iCls} placeholder="e.g. 3.5" />
          </SettingsField>
          <SettingsField label="Runner / agent fee (RM)">
            <input type="number" min="0" value={costSettings.runner_fee}
              onChange={(e) => setCostSettings(s => ({ ...s, runner_fee: e.target.value }))}
              className={iCls} placeholder="e.g. 250" />
          </SettingsField>
          <SettingsField label="Admin / docs per unit (RM)">
            <input type="number" min="0" value={costSettings.admin_fee}
              onChange={(e) => setCostSettings(s => ({ ...s, admin_fee: e.target.value }))}
              className={iCls} placeholder="e.g. 80" />
          </SettingsField>
          <SettingsField label="Warranty reserve (% of sale)">
            <input type="number" min="0" step="0.1" value={costSettings.warranty_reserve_pct}
              onChange={(e) => setCostSettings(s => ({ ...s, warranty_reserve_pct: e.target.value }))}
              className={iCls} placeholder="e.g. 1.5" />
          </SettingsField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <SettingsField label="Discount limit (RM off asking)">
            <input type="number" min="0" value={discountLimit.amount}
              onChange={(e) => setDiscountLimit(s => ({ ...s, amount: e.target.value }))}
              className={iCls} placeholder="e.g. 2000 (blank = no limit)" />
          </SettingsField>
          <SettingsField label="Discount limit (% off asking)">
            <input type="number" min="0" step="0.5" value={discountLimit.pct}
              onChange={(e) => setDiscountLimit(s => ({ ...s, pct: e.target.value }))}
              className={iCls} placeholder="e.g. 3 (blank = no limit)" />
          </SettingsField>
        </div>
        <p className="text-xs text-gray-500">
          A salesman can close at a discount up to this limit on their own. Above it, the price comes to you
          (or a manager) to approve before the deal closes. Leave both blank for no limit.
        </p>
        <p className="text-xs text-gray-500">
          Floor-plan rate charges interest on each car's purchase price per day it sits. If both overhead and floor-plan
          are set, floor-plan takes priority. Runner fee is added on top of the RM100 JPJ government rate.
        </p>
        {errors.costs && <p className="text-xs text-red-500">{errors.costs}</p>}
        <div className="flex justify-end pt-1">
          <SaveBtn sectionKey="costs" onClick={saveCostSettings} saving={saving} saved={saved} />
        </div>
      </SettingsSection>}
      {effectiveNav === 'autopost' && <SettingsSection
        title="Auto-post"
        subtitle="Set it once. Every car you add goes out to the accounts you switch on."
        icon={Share2}
      >
        <AutoPostSettings dealerId={settingsDealerId} />
      </SettingsSection>}
      {effectiveNav === 'telegram' && <SettingsSection
        title="Notifications"
        subtitle="Push alerts on your devices, and Telegram auto-posting for new listings"
        icon={Send}
      >
        {/* Push sits with Telegram because both are "how alerts reach me".
            theme="light" — this whole settings surface is white cards.
            userId is the LOGGED-IN user's own id, deliberately NOT
            getDealerIdFromProfile(): push_subscriptions RLS is
            `auth.uid() = user_id`, so a manager/admin (whose dealer id is their
            parent's) would have every insert silently rejected. A device belongs
            to the person holding it, not to the dealership. */}
        <PushToggle userId={profile?.id} theme="light" />

        <div className="rounded-xl p-4 space-y-3" style={{ background: "#f5f6f8" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-gray-600" />
              <p className="text-gray-900 text-sm font-semibold">Auto-Post New Listings</p>
            </div>
            <button
              onClick={() => setTgAutoPost((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-all ${tgAutoPost ? "bg-gray-900" : "bg-gray-300"}`}
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
            placeholder={tokenConfigured ? "•••••••• saved — type to replace" : "1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"}
            className={iCls}
            type="password"
            autoComplete="off"
          />
          <p className="text-xs text-gray-700 mt-1">
            {tokenConfigured ? (
              <span className="text-green-600">Token saved (hidden for security). Leave blank to keep it, or enter a new token to replace.</span>
            ) : (
              <>Create a bot via <span className="font-semibold text-gray-900">@BotFather</span> → /newbot → copy the token here.</>
            )}
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
            Add your bot as <span className="font-semibold text-gray-900">Admin</span> to the channel first, then paste the username or numeric ID.
          </p>
        </SettingsField>

        <div className="rounded-xl p-4 space-y-2 pl-note">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Setup</p>
          {[
            "Open Telegram → search @BotFather → /newbot",
            "Copy the bot token and paste above",
            "Create or open your channel → Add Members → search your bot → make it Admin",
            "Paste your channel username (e.g. @mydealer) above",
            "Click Test Connection to verify, then Save",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-4 h-4 rounded-full bg-white border border-gray-200 text-[10px] text-gray-500 flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold">{i + 1}</span>
              <p className="text-xs text-gray-500 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        <ErrMsg k="telegram" errors={errors} />

        {tgTestResult === "ok" && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs pl-note-good">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            Test message sent! Check your Telegram channel.
          </div>
        )}

        <div className="flex items-center gap-3 pt-1 justify-end">
          <button
            onClick={testTelegram}
            disabled={tgTesting || !tgToken.trim() || !tgChannel.trim()}
            className="pl-btn-grey inline-flex items-center gap-2 px-4 py-2 text-sm transition-all"
          >
            {tgTesting
              ? <><div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />Testing…</>
              : <><Send className="w-3.5 h-3.5" />Test Connection</>
            }
          </button>
          <SaveBtn sectionKey="telegram" onClick={saveTelegram} saving={saving} saved={saved} />
        </div>
      </SettingsSection>}
      {effectiveNav === 'storefront' && <SettingsSection
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
          <SaveBtn sectionKey="storefront" onClick={saveStorefront} saving={saving} saved={saved} />
          <ErrMsg k="storefront" errors={errors} />
        </div>
      </SettingsSection>}

    </div>
  );

  return (
    <>
    <div style={{ background: '#f5f6f8', borderRadius: 20, border: 'none' }}>
      {/* ── MOBILE ── */}
      <div className="md:hidden">
        {!settingsNav ? (
          /* Grouped menu list */
          <div style={{ padding: '8px 12px 16px' }}>
            {settingsNavGroups.map(({ group, items }) => (
              <div key={group} style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6, paddingLeft: 4 }}>{group}</p>
                <div style={{ background: '#fff', borderRadius: 16, boxShadow: premiumLight.shadow, overflow: 'hidden' }}>
                  {items.map(({ key, icon: Icon, label, desc }, idx) => (
                    <button
                      key={key}
                      onClick={() => (key === 'services' && onOpenServices ? onOpenServices() : setSettingsNav(key))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 13, width: '100%',
                        padding: '11px 14px', background: 'none', border: 'none',
                        borderTop: idx > 0 ? '1px solid rgba(17,24,39,0.06)' : 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={15} style={{ color: '#4b5563' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 1 }}>{label}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af' }}>{desc}</p>
                      </div>
                      <ChevronRight size={14} style={{ color: '#d1d5db', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Section panel with back button */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid rgba(17,24,39,0.06)', background: '#fff' }}>
              <button
                onClick={() => setSettingsNav(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, fontWeight: 500, padding: '4px 0' }}
              >
                <ChevronLeft size={15} />
                Settings
              </button>
              <ChevronRight size={13} style={{ color: '#d1d5db' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                {settingsNavGroups.flatMap(g => g.items).find(i => i.key === settingsNav)?.label}
              </span>
            </div>
            <div style={{ padding: '16px 12px' }}>
              {sectionContent}
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden md:flex" style={{ minHeight: 560 }}>
        <nav style={{ width: 196, flexShrink: 0, borderRight: '1px solid rgba(17,24,39,0.06)', padding: '20px 10px', background: '#fff', borderRadius: '20px 0 0 20px' }}>
          {settingsNavGroups.map(({ group, items }, gi) => (
            <div key={group} style={{ marginBottom: 24, paddingTop: gi > 0 ? 0 : 0 }}>
              <p style={{ fontSize: 10, letterSpacing: '0.1em', color: '#b0b7c3', fontWeight: 700, textTransform: 'uppercase', padding: '0 10px', marginBottom: 3 }}>{group}</p>
              {items.map(({ key, icon: Icon, label }) => {
                const active = effectiveNav === key;
                return (
                  <button
                    key={key}
                    onClick={() => (key === 'services' && onOpenServices ? onOpenServices() : setSettingsNav(key))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 10px',
                      borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: 1,
                      background: active ? '#f5f6f8' : 'transparent',
                      color: active ? '#111827' : '#4b5563',
                      fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: active ? 600 : 400,
                      transition: 'all 0.12s',
                    }}
                  >
                    <Icon size={14} style={{ flexShrink: 0 }} />
                    {label}
                  </button>
                );
              })}
              {gi < settingsNavGroups.length - 1 && (
                <div style={{ height: 1, background: '#f0f1f3', margin: '14px 10px 0' }} />
              )}
            </div>
          ))}
        </nav>
        <div style={{ flex: 1, padding: '24px 28px', minWidth: 0, overflowY: 'auto' }}>
          {sectionContent}
        </div>
      </div>
    </div>
    {deleteConfirmOpen && createPortal(
      <div
        onClick={() => !deleting && setDeleteConfirmOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-[400px] p-6 border border-gray-200 shadow-2xl">
          <p className="text-gray-900 text-base font-bold mb-1.5">Delete your dealer account?</p>
          <p className="text-gray-500 text-xs leading-relaxed mb-4">
            Your storefront and listings disappear immediately. Everything is kept for 30
            days — logging back in restores it. After that it's permanent and cannot be undone.
          </p>
          <label className="block text-gray-500 text-[11px] mb-1.5">Type DELETE to confirm</label>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
            className="w-full border border-gray-300 rounded-lg text-gray-900 text-sm px-3 py-2.5 mb-4 outline-none tracking-wider"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
              className="flex-1 text-gray-700 text-sm font-semibold border border-gray-200 rounded-lg py-2.5 bg-gray-50 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
              className="flex-1 text-white text-sm font-bold rounded-lg py-2.5 bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}
