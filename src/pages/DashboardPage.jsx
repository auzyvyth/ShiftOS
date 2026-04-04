import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { useRoleRedirect } from "../hooks/useRoleRedirect";
import CarForm from "../components/CarForm";
import TikTokGenerator from "../components/TikTokGenerator";
import LeadsPage from "./LeadsPage";
import HeroSlidesPage from "./xdrive/HeroSlidesPage";
import { clearSiteProfileCache } from "../hooks/useSiteProfile";
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
} from "lucide-react";

const SERVER_URL = "https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1";
const MAX_DEALERSHIP_CHANGES = 2;

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

  .sold-btn:hover { background:rgba(34,197,94,0.15) !important; border-color:rgba(34,197,94,0.45) !important; color:#4ade80 !important; }

  .settings-section { position:relative; background:rgba(255,255,255,0.022); border:1px solid rgba(255,255,255,0.065); border-radius:16px; overflow:hidden; }
  .settings-section::before { content:''; position:absolute; top:0; left:16px; right:16px; height:1px; background:linear-gradient(90deg,transparent,rgba(220,38,38,0.35) 35%,rgba(56,189,248,0.2) 65%,transparent); pointer-events:none; }

  ::-webkit-scrollbar { width:4px; height:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(220,38,38,0.22); border-radius:4px; }
  ::-webkit-scrollbar-thumb:hover { background:rgba(220,38,38,0.42); }
`;

const T = {
  card: {
    position: "relative",
    background:
      "linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  cardDark: {
    position: "relative",
    background: "rgba(255,255,255,0.022)",
    border: "1px solid rgba(255,255,255,0.065)",
  },
  modal: {
    position: "relative",
    background: "rgba(11,11,15,0.98)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 0 0 1px rgba(220,38,38,0.07), 0 32px 64px rgba(0,0,0,0.72)",
  },
  divider: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  btnRed: {
    background: "linear-gradient(135deg,#dc2626,#b91c1c)",
    boxShadow: "0 2px 10px rgba(220,38,38,0.28)",
  },
};

const iCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/10 transition-all";
const taCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/10 transition-all resize-none";

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

function AgeBadge({ createdAt }) {
  const d = getListingAge(createdAt);
  if (d < 14)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 badge-glow-cyan">
        <Clock className="w-3 h-3" />
        {d === 0 ? "Today" : `${d}d`}
      </span>
    );
  if (d < 30)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 badge-glow-gold">
        <Clock className="w-3 h-3" />
        {d}d
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-400/10 text-red-400 border border-red-400/20 badge-glow-red">
      <Clock className="w-3 h-3" />
      {d}d
    </span>
  );
}

// ─── Settings Section wrapper ─────────────────────────────────────────────────
function SettingsSection({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-red-400",
  iconBg = "rgba(220,38,38,0.1)",
  iconBorder = "rgba(220,38,38,0.18)",
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
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </label>
        {hint && <span className="text-xs text-gray-600">{hint}</span>}
      </div>
      {children}
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
  }, [profile]);

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
        data: { session },
      } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("profiles")
        .update({ ...payload, settings_updated_at: new Date().toISOString() })
        .eq("id", session.user.id)
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
      whatsapp_number: whatsapp.trim(),
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
      <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1.5">
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
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${dealershipLocked ? "text-red-400" : changesLeft === 1 ? "text-amber-400" : "text-emerald-400"}`}
          style={{
            background: dealershipLocked
              ? "rgba(220,38,38,0.07)"
              : changesLeft === 1
                ? "rgba(251,191,36,0.07)"
                : "rgba(52,211,153,0.07)",
            border: `1px solid ${dealershipLocked ? "rgba(220,38,38,0.18)" : changesLeft === 1 ? "rgba(251,191,36,0.18)" : "rgba(52,211,153,0.18)"}`,
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
              className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-600/50 transition-all font-mono"
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
            disabled={dealershipLocked}
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
              className={`relative w-10 h-5 rounded-full transition-all ${announcementOn ? "bg-red-600" : "bg-white/10"}`}
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
              className={`relative w-10 h-5 rounded-full transition-all ${tgAutoPost ? "bg-red-600" : "bg-white/10"}`}
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

        <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Setup</p>
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

      {/* ── 5. Danger Zone ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: "1px solid rgba(220,38,38,0.22)",
          background: "rgba(220,38,38,0.03)",
        }}
      >
        <button
          onClick={() => setShowDanger((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-500/[0.04] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(220,38,38,0.12)",
                border: "1px solid rgba(220,38,38,0.22)",
              }}
            >
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-red-400 text-sm font-semibold">Danger Zone</p>
          </div>
          {showDanger ? (
            <ChevronUp className="w-4 h-4 text-red-500/50" />
          ) : (
            <ChevronDown className="w-4 h-4 text-red-500/50" />
          )}
        </button>

        {showDanger && (
          <div
            className="px-5 pb-5 space-y-4"
            style={{ borderTop: "1px solid rgba(220,38,38,0.12)" }}
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
                background: "linear-gradient(135deg,#dc2626,#991b1b)",
                border: "1px solid rgba(220,38,38,0.3)",
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
        style={T.modal}
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
                <span className="text-red-400 text-xs font-medium bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">
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
                className="w-full pl-12 pr-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white text-lg font-semibold focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/15 transition-all"
              />
            </div>
          </div>
          {npv > 0 && npv !== cur && (
            <div
              className={`px-4 py-3 rounded-xl border text-sm ${isReset ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" : isUp ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : isHot ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}
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
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              ⚠ {err}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
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
        style={T.modal}
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
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
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
function AnalyticsTab({ listings, profile }) {
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
    supabase
      .from("analytics_events")
      .select("*")
      .eq("dealer_id", profile.id)   // scope to logged-in dealer only
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEvents(data || []);
        setEventsLoading(false);
      });
  }, [profile?.id]);
  const totalClicks = events.filter(
    (e) => e.event_type === "link_visit" || e.event_type === "car_view",
  ).length;
  const totalEnquiries = events.filter(
    (e) => e.event_type === "whatsapp_click" || e.event_type === "call_click",
  ).length;
  const totalWa = events.filter(
    (e) => e.event_type === "whatsapp_click",
  ).length;
  const totalCalls = events.filter((e) => e.event_type === "call_click").length;
  const bySlug = events.reduce((acc, e) => {
    if (!acc[e.salesman_slug])
      acc[e.salesman_slug] = { clicks: 0, enquiries: 0 };
    if (e.event_type === "link_visit" || e.event_type === "car_view")
      acc[e.salesman_slug].clicks++;
    if (e.event_type === "whatsapp_click" || e.event_type === "call_click")
      acc[e.salesman_slug].enquiries++;
    return acc;
  }, {});
  const topSalesmen = Object.entries(bySlug).sort(
    (a, b) => b[1].enquiries - a[1].enquiries,
  );

  const total = listings.length;
  const active = listings.filter(
    (l) => (l.status || "active") === "active",
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
      getListingAge(l.created_at) >= 30 && (l.status || "active") === "active",
  );

  const ctx = () => {
    const s = listings
      .slice(0, 20)
      .map(
        (l) =>
          `${l.brand} ${l.model}|RM${l.selling_price?.toLocaleString()}|${getListingAge(l.created_at)}d|${l.status || "active"}|${l.condition}|${l.mileage ? l.mileage.toLocaleString() + "km" : "-"}|${l.state || "-"}${l.original_price ? `|was RM${l.original_price.toLocaleString()}` : ""}`,
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
    },
    {
      label: "Hot Deals",
      val: hot,
      sub: "≥3% off",
      grad: hot > 0 ? "grad-red" : "",
      icon: <Flame className="w-4 h-4" />,
      glow: hot > 0 ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.03)",
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(({ label, val, sub, grad, icon, glow }) => (
          <div
            key={label}
            className="stat-card card-top rounded-xl p-4 overflow-hidden"
            style={T.card}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 100% 0%, rgba(220,38,38,0.05) 0%, transparent 55%)`,
              }}
            />
            <div className="flex items-center justify-between mb-3 relative">
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
              className={`text-2xl sm:text-3xl font-black leading-none relative tabular-nums ${grad || "text-white"}`}
            >
              {val}
            </p>
            <p className="text-xs text-gray-700 mt-1.5 hidden sm:block relative">
              {sub}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Clicks",
            val: totalClicks,
            grad: "grad-cyan",
            glow: "rgba(103,232,249,0.14)",
            icon: <Eye className="w-4 h-4" />,
          },
          {
            label: "Enquiries",
            val: totalEnquiries,
            grad: "grad-gold",
            glow: "rgba(251,191,36,0.14)",
            icon: <MessageSquare className="w-4 h-4" />,
          },
          {
            label: "WhatsApp",
            val: totalWa,
            grad: "grad-green",
            glow: "rgba(110,231,183,0.14)",
            icon: <MessageCircle className="w-4 h-4" />,
          },
          {
            label: "Call Clicks",
            val: totalCalls,
            grad: "grad-purple",
            glow: "rgba(216,180,254,0.14)",
            icon: <Phone className="w-4 h-4" />,
          },
        ].map(({ label, val, grad, glow, icon }) => (
          <div
            key={label}
            className="stat-card card-top rounded-xl p-4 overflow-hidden"
            style={T.card}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">
                {label}
              </p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: glow }}
              >
                {icon}
              </div>
            </div>
            {eventsLoading ? (
              <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
            ) : (
              <p
                className={`text-2xl sm:text-3xl font-black leading-none tabular-nums ${grad}`}
              >
                {val}
              </p>
            )}
          </div>
        ))}
      </div>
      {topSalesmen.length > 0 && (
        <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
          <div className="flex items-center gap-2 p-4" style={T.divider}>
            <BarChart2 className="w-4 h-4 text-red-400" />
            <p className="font-semibold text-white text-sm">
              Salesman Performance
            </p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {topSalesmen.map(([slug, { clicks, enquiries }], i) => (
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
                      <span className="text-amber-400 font-semibold">
                        {enquiries}
                      </span>{" "}
                      enquiries
                    </span>
                  </div>
                </div>
                {enquiries > 0 && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: "rgba(251,191,36,0.1)",
                      border: "1px solid rgba(251,191,36,0.2)",
                      color: "#fbbf24",
                    }}
                  >
                    🔥 Active
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {stale.length > 0 && (
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
              {stale.length} listing{stale.length > 1 ? "s" : ""} aging 30+ days
            </p>
          </div>
          <div className="space-y-2">
            {stale.slice(0, 5).map((l) => (
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
                <span className="text-amber-400 text-xs font-semibold bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 badge-glow-gold">
                  {getListingAge(l.created_at)}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <div
          className="flex items-center justify-between p-4"
          style={T.divider}
        >
          <div>
            <h2 className="font-semibold text-white text-sm">
              Listing Performance
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Views & leads tracking activates once traffic is live
            </p>
          </div>
        </div>
        {listings.length === 0 ? (
          <div className="p-12 text-center text-gray-600 text-sm">
            No listings to analyse yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    boxShadow: "inset 0 -1px 0 rgba(220,38,38,0.2)",
                  }}
                >
                  {[
                    "Vehicle",
                    "Price",
                    "Age",
                    "Views",
                    "Leads",
                    "CVR",
                    "Status",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-gray-600 font-semibold text-xs uppercase tracking-widest text-left"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {listings.map((l) => (
                  <tr
                    key={l.id}
                    className={`data-row ${getListingAge(l.created_at) >= 30 ? "bg-amber-950/[0.08]" : ""}`}
                  >
                    <td className="px-4 py-3">
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
                        <div className="min-w-0">
                          <p className="font-medium text-white text-sm truncate">
                            {l.brand} {l.model}
                          </p>
                          <p className="text-gray-600 text-xs truncate">
                            {l.variant || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold grad-white text-sm">
                      RM {l.selling_price?.toLocaleString() || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <AgeBadge createdAt={l.created_at} />
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-sm">—</td>
                    <td className="px-4 py-3 text-gray-700 text-sm">—</td>
                    <td className="px-4 py-3 text-gray-700 text-sm">—</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${(l.status || "active") === "active" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 badge-glow-cyan" : l.status === "reserved" ? "bg-amber-400/10 text-amber-400 border-amber-400/20 badge-glow-gold" : "bg-red-400/10 text-red-400 border-red-400/20 badge-glow-red"}`}
                      >
                        {l.status || "active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                background: "rgba(220,38,38,0.1)",
                border: "1px solid rgba(220,38,38,0.18)",
                boxShadow: "0 0 12px rgba(220,38,38,0.12)",
              }}
            >
              <Bot className="w-4 h-4 text-red-400" />
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
                        background: "rgba(220,38,38,0.12)",
                        border: "1px solid rgba(220,38,38,0.18)",
                      }}
                    >
                      <Bot className="w-3 h-3 text-red-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "text-white rounded-tr-sm" : "text-gray-300 rounded-tl-sm"}`}
                    style={
                      m.role === "user"
                        ? {
                            background:
                              "linear-gradient(135deg,#dc2626,#b91c1c)",
                            boxShadow: "0 2px 8px rgba(220,38,38,0.22)",
                          }
                        : {
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.06)",
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
                      background: "rgba(220,38,38,0.12)",
                      border: "1px solid rgba(220,38,38,0.18)",
                    }}
                  >
                    <Bot className="w-3 h-3 text-red-400" />
                  </div>
                  <div
                    className="px-3.5 py-3 rounded-2xl rounded-tl-sm"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 bg-red-500/40 rounded-full animate-bounce"
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
                    className="text-xs px-3 py-1.5 rounded-full text-gray-400 hover:text-white transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
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
                  (e.target.style.borderColor = "rgba(220,38,38,0.4)")
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
  const [togglingId, setTogglingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [tempPw, setTempPw] = useState("");
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
      if (!map[salesman_slug]) map[salesman_slug] = { clicks: 0, enquiries: 0 };
      if (event_type === "link_visit" || event_type === "car_view")
        map[salesman_slug].clicks++;
      if (event_type === "whatsapp_click" || event_type === "call_click")
        map[salesman_slug].enquiries++;
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
      .eq("role", "salesman")
      .eq("dealership", managerDealership)
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
    setPhone("");
    setSlug("");
    setTempPw("");
    setAddError("");
    setAddSuccess("");
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
    if (!n || !e || !s || !tempPw) {
      setAddError("All fields required.");
      return;
    }
    if (tempPw.length < 8) {
      setAddError("Password min 8 chars.");
      return;
    }
    if (!/^[a-z0-9]+$/.test(s)) {
      setAddError("Slug: lowercase + numbers only.");
      return;
    }
    setAddLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
          slug: s,
          password: tempPw,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(json.message || "Failed.");
        setAddLoading(false);
        return;
      }
      setSalespeople((p) => [json.invite, ...p]);
      setAddSuccess(`${n} added successfully.`);
      resetForm();
      setShowAddForm(false);
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

  const activeCount = salespeople.filter((s) => s.is_active !== false).length;
  const inactiveCount = salespeople.filter((s) => s.is_active === false).length;
  const activeRate = salespeople.length
    ? Math.round((activeCount / salespeople.length) * 100)
    : 0;
  const inputCls =
    "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/10 transition-all";

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
                background: "rgba(220,38,38,0.07)",
                border: "1px solid rgba(220,38,38,0.12)",
              }}
            >
              <Users className="w-5 h-5 text-red-500/40" />
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
          <div className="divide-y divide-white/[0.04]">
            {salespeople.map((s) => (
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
                        background: "linear-gradient(135deg,#dc2626,#7c3aed)",
                      }}
                    >
                      {(s.full_name || "S")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-white truncate">
                        {s.full_name}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${s.is_active !== false ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 badge-glow-cyan" : "bg-white/5 text-gray-500 border-white/8"}`}
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
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-400"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.07)",
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
                          String(analyticsMap[s.slug]?.enquiries || 0),
                          "Enquiries",
                        ],
                        [String(teamSoldCount), "Team Sales"],
                      ].map(([v, lbl]) => (
                        <div
                          key={lbl}
                          className="rounded-lg px-2.5 py-2"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <p
                            className={`text-sm font-bold ${lbl === "Team Sales" ? "grad-green" : lbl === "Enquiries" && Number(v) > 0 ? "grad-gold" : "grad-white"}`}
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-all"
                      style={{ border: "1px solid rgba(220,38,38,0.18)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
            style={T.modal}
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
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
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
      {showAddForm && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
            style={T.modal}
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
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
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
                      <input
                        type="tel"
                        placeholder="+60 12-345 6789"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="off"
                        className={inputCls}
                      />
                    </div>
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
                        className="flex-1 rounded-r-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-red-600/50 transition-colors"
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
                      className="rounded-xl px-3 py-2.5 text-red-400 text-xs"
                      style={{
                        background: "rgba(220,38,38,0.07)",
                        border: "1px solid rgba(220,38,38,0.18)",
                      }}
                    >
                      ⚠ {addError}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
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
                      {addLoading ? "Creating..." : "Add Salesman"}
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const redirectByRole = useRoleRedirect("dealer");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("listings");
  const [deleteId, setDeleteId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tiktokListing, setTiktokListing] = useState(null);
  const [priceEditListing, setPriceEditListing] = useState(null);
  const [markSoldListing, setMarkSoldListing] = useState(null);
  const [markSoldLoading, setMarkSoldLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [editListing, setEditListing] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedListingId, setCopiedListingId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [salesmen,         setSalesmen]         = useState([]);
  const [assignDropdownId, setAssignDropdownId] = useState(null);
  const [assignToast,      setAssignToast]      = useState(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = STYLES;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  useEffect(() => {
    const name = profile?.site_name || profile?.dealership || "XDrive";
    document.title = `${name} — Admin`;
  }, [profile]);

  useEffect(() => {
    let active = true;

    // Shared loader — called on first mount AND on every auth state change so
    // switching accounts always loads the correct owner's data.
    const loadSession = async (session) => {
      if (!session) { navigate("/login"); return; }
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
      } else {
        navigate("/login");
        return;
      }

      const { data: cars, error: carsError } = await supabase
        .from("car_listings")
        .select("*")
        .eq("dealer_id", uid)
        .order("created_at", { ascending: false });
      if (active) setListings(carsError ? [] : cars || []);

      const { data: sm } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("role", "salesman");
      if (active) {
        setSalesmen(sm || []);
        setLoading(false);
      }
    };

    // Fast initial load from cached session
    supabase.auth.getSession().then(({ data }) => loadSession(data.session));

    // Re-run the full loader on every auth event so account-switching is safe
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN") loadSession(session);
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
            if (payload.eventType === "INSERT") return [payload.new, ...prev];
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear(); // prevent stale branding from a previous session bleeding through
    navigate("/login");
  };
  const handleNew = (l) => {
    setListings((p) => [l, ...p]);
    setActiveTab("listings");
  };
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };
  const handleDelete = async (id) => {
    const { error } = await supabase.from("car_listings").delete().eq("id", id);
    if (!error) setListings((p) => p.filter((l) => l.id !== id));
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
    setEditListing(null);
  };
  const handleProfileUpdate = (updated) => setProfile(updated);

  const handleMarkSold = async () => {
    if (!markSoldListing) return;
    setMarkSoldLoading(true);
    try {
      const { data, error } = await supabase
        .from("car_listings")
        .update({ status: "sold" })
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

  const filteredListings = searchQuery.trim()
    ? listings.filter((l) => {
        const q = searchQuery.toLowerCase();
        return (
          (l.brand || "").toLowerCase().includes(q) ||
          (l.model || "").toLowerCase().includes(q) ||
          (l.variant || "").toLowerCase().includes(q) ||
          (l.vin_number || "").toLowerCase().includes(q)
        );
      })
    : listings;

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
  const totalVal = listings.reduce((s, l) => s + (l.selling_price || 0), 0);
  const avgPrice = listings.length ? Math.round(totalVal / listings.length) : 0;
  const hotCount = listings.filter(
    (l) =>
      l.original_price &&
      l.selling_price &&
      l.selling_price <= l.original_price * 0.97,
  ).length;

  const STATUS = {
    active: {
      label: "Active",
      dot: "bg-emerald-400",
      cls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 badge-glow-cyan",
      next: "reserved",
    },
    reserved: {
      label: "Reserved",
      dot: "bg-amber-400",
      cls: "bg-amber-400/10 text-amber-400 border-amber-400/20 badge-glow-gold",
      next: "sold",
    },
    sold: {
      label: "Sold",
      dot: "bg-red-400",
      cls: "bg-red-400/10 text-red-400 border-red-400/20 badge-glow-red",
      next: "active",
    },
  };

  const StatusBadge = ({ listing }) => {
    const s = listing.status || "active",
      cfg = STATUS[s] || STATUS.active,
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
  };

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
        style={{ background: "linear-gradient(135deg,#dc2626,#7c3aed)" }}
      >
        {(profile?.full_name || profile?.email || "A")[0].toUpperCase()}
      </div>
    );
  };

  const DiscountCell = ({ listing }) => {
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
            className={`discount-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${isHot ? "bg-red-500/15 text-red-400 border-red-500/25 hot-glow badge-glow-red" : "bg-amber-500/15 text-amber-400 border-amber-500/25"}`}
          >
            {isHot && <Flame className="w-3 h-3" />}−{pct}%
          </span>
        </div>
        <p className="text-gray-600 text-xs line-through mt-0.5">
          RM {op.toLocaleString()}
        </p>
      </div>
    );
  };

  const condCls = (c) =>
    ({
      new: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 badge-glow-cyan",
      recon:
        "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 badge-glow-cyan",
      used: "bg-white/[0.06] text-gray-400 border border-white/10",
    })[c] || "bg-white/[0.06] text-gray-400 border border-white/10";

  const TITLES = {
    listings: { title: "Listings", sub: "Manage your inventory" },
    add: { title: "Add Listing", sub: "Upload a new car" },
    team: { title: "Team", sub: "Manage salespeople" },
    analytics: { title: "Analytics", sub: "Performance & AI advisor" },
    settings: { title: "Settings", sub: "Dealership, front page & account" },
    leads: { title: "Leads", sub: "Pipeline & CRM" },
    hero: {
      title: "Hero Carousel",
      sub: "Manage your XDrive homepage spotlight — up to 5 slides",
    },
  };

  const NAV = [
    { id: "listings", Icon: Car, label: "Listings", badge: listings.length },
    { id: "add", Icon: PlusCircle, label: "Add Listing" },
    { id: "leads", Icon: Inbox, label: "Leads" },
    { id: "analytics", Icon: BarChart2, label: "Analytics" },
    { id: "team", Icon: Users, label: "Team" },
    { id: "hero", Icon: HeroCarouselIcon, label: "Hero Carousel" },
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
      label: "Avg. Price",
      val: `RM ${avgPrice.toLocaleString()}`,
      sub: "Per vehicle",
      grad: "grad-white",
      Icon: TrendingUp,
      glow: "rgba(255,255,255,0.06)",
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

  return (
    <div
      className="min-h-screen text-white flex"
      style={{
        fontFamily: "'DM Sans',sans-serif",
        background:
          "radial-gradient(ellipse 65% 40% at 0% 0%, rgba(220,38,38,0.06) 0%, transparent 55%), #09090b",
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
        className={`fixed h-full z-30 flex flex-col w-60 transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "linear-gradient(155deg,#111118 0%,#0a0a0e 100%)",
          borderRight: "1px solid rgba(255,255,255,0.055)",
          boxShadow:
            "4px 0 28px rgba(0,0,0,0.65), inset -1px 0 0 rgba(220,38,38,0.07)",
        }}
      >
        <div className="px-5 py-5 flex items-center gap-3" style={T.divider}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
            style={{
              background: "linear-gradient(135deg,#dc2626,#7c3aed)",
              boxShadow:
                "0 0 18px rgba(220,38,38,0.42), 0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            S
          </div>
          <div>
            <p className="font-black tracking-wider text-sm grad-red">
              ShiftOS
            </p>
            <p className="text-xs text-gray-600 mt-px">XDrive Admin</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-px mt-1 overflow-y-auto">
          {NAV.map(({ id, Icon, label, badge }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === id ? "nav-active text-white" : "text-gray-500 hover:text-white"}`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${activeTab === id ? "text-red-400" : ""}`}
              />
              {label}
              {badge !== undefined && (
                <span
                  className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums ${activeTab === id ? "text-red-300 bg-red-950/70" : "text-gray-600 bg-white/[0.05]"}`}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
          <a
            href="/"
            target="_blank"
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-white transition-all"
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            View Site
            <Eye className="w-3 h-3 ml-auto opacity-40" />
          </a>
        </nav>

        {/* ── Sidebar bottom: profile + settings + logout ── */}
        <div
          className="p-3 space-y-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
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
                background: "rgba(220,38,38,0.07)",
                border: "1px solid rgba(220,38,38,0.13)",
              }}
            >
              <Building2 className="w-3.5 h-3.5 text-red-500/60 flex-shrink-0" />
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
              className={`w-4 h-4 flex-shrink-0 ${activeTab === "settings" ? "text-red-400" : ""}`}
            />
            Settings
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-red-400 hover:bg-red-500/[0.06] transition-all"
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
          className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 backdrop-blur-xl"
          style={{
            background: "rgba(9,9,11,0.92)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 1px 0 rgba(220,38,38,0.1)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center font-black text-xs"
              style={{
                background: "linear-gradient(135deg,#dc2626,#7c3aed)",
                boxShadow: "0 0 8px rgba(220,38,38,0.32)",
              }}
            >
              S
            </div>
            <span className="font-bold text-white text-sm tracking-tight">
              ShiftOS
            </span>
          </div>
          <span className="ml-1 text-gray-600 text-sm">
            {TITLES[activeTab]?.title}
          </span>
          <div className="ml-auto">
            <Avatar />
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {TITLES[activeTab]?.title}
            </h1>
            <p className="text-gray-600 text-sm mt-0.5">
              {TITLES[activeTab]?.sub}
            </p>
            <div
              className="mt-4 h-px"
              style={{
                background:
                  "linear-gradient(90deg,rgba(220,38,38,0.32),rgba(56,189,248,0.18) 38%,transparent 68%)",
              }}
            />
          </div>

          {/* ── Listings Tab ── */}
          {activeTab === "listings" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {STAT_CARDS.map(({ label, val, sub, grad, Icon, glow }) => (
                  <div
                    key={label}
                    className="stat-card card-top rounded-xl p-4 overflow-hidden"
                    style={T.card}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(circle at 95% 5%, rgba(220,38,38,0.05) 0%, transparent 50%)",
                      }}
                    />
                    <div className="flex items-center justify-between mb-3 relative">
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
                      className={`text-2xl sm:text-3xl font-black leading-none relative tabular-nums ${grad || "text-white"}`}
                    >
                      {val}
                    </p>
                    <p className="text-xs text-gray-700 mt-2 hidden sm:block relative">
                      {sub}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className={`card-top rounded-xl ${assignDropdownId ? 'overflow-visible' : 'overflow-hidden'}`}
                style={T.cardDark}
              >
                <div
                  className="flex items-center justify-between p-4"
                  style={T.divider}
                >
                  <h2 className="font-semibold text-white text-sm">
                    All Vehicles{" "}
                    <span className="text-gray-600 font-normal">
                      ({filteredListings.length}
                      {searchQuery.trim() &&
                      listings.length !== filteredListings.length
                        ? ` of ${listings.length}`
                        : ""}
                      )
                    </span>
                  </h2>
                  <button
                    onClick={() => setActiveTab("add")}
                    className="btn-shimmer flex items-center gap-1.5 text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
                    style={T.btnRed}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
                <div className="px-4 pb-3 pt-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by brand, model, variant, VIN…"
                      className="w-full pl-9 pr-8 py-2 text-sm text-white placeholder-gray-600 rounded-lg focus:outline-none focus:border-red-500/40 transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-gray-600 text-sm">
                    Loading…
                  </div>
                ) : listings.length === 0 ? (
                  <div className="p-12 text-center">
                    <div
                      className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                      style={{
                        background: "rgba(220,38,38,0.07)",
                        border: "1px solid rgba(220,38,38,0.12)",
                      }}
                    >
                      <Car className="w-6 h-6 text-red-500/40" />
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                      No listings yet
                    </p>
                    <button
                      onClick={() => setActiveTab("add")}
                      className="btn-shimmer text-white px-5 py-2 rounded-lg text-sm font-semibold"
                      style={T.btnRed}
                    >
                      Add your first car
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto overflow-y-visible">
                      <table className="w-full text-sm">
                        <thead>
                          <tr
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              boxShadow: "inset 0 -1px 0 rgba(220,38,38,0.18)",
                            }}
                          >
                            {[
                              "Vehicle",
                              "Condition",
                              "Mileage",
                              "Location",
                              "Price",
                              "Listed",
                              "Status",
                              "",
                            ].map((h, i) => (
                              <th
                                key={i}
                                className={`px-4 py-3 text-gray-600 font-semibold text-xs uppercase tracking-widest ${i === 7 ? "text-right" : "text-left"}`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {filteredListings.map((l) => {
                            const age = getListingAge(l.created_at),
                              bt = l.body_type || l.bodyType || null;
                            const isSold = l.status === "sold";
                            return (
                              <tr
                                key={l.id}
                                className={`data-row ${age >= 30 && !isSold ? "bg-amber-950/[0.07]" : ""} ${isSold ? "opacity-60" : ""}`}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    {l.images?.[0] ? (
                                      <img
                                        src={l.images[0]}
                                        alt=""
                                        className={`w-9 h-9 rounded-lg object-cover bg-gray-800 flex-shrink-0 ${isSold ? "grayscale" : ""}`}
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg bg-white/5 flex-shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-semibold text-white text-sm truncate">
                                        {l.brand} {l.model}
                                      </p>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <p className="text-gray-600 text-xs truncate">
                                          {l.variant || "—"}
                                        </p>
                                        {bt && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-gray-600">
                                            {bt}
                                          </span>
                                        )}
                                      </div>
                                      {l.assigned_to && salesmenById[l.assigned_to] && (
                                        <p className="text-[10px] text-purple-400/80 mt-0.5 flex items-center gap-1">
                                          <UserPlus className="w-2.5 h-2.5 flex-shrink-0" />
                                          {salesmenById[l.assigned_to].full_name}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${condCls(l.condition)}`}
                                  >
                                    {l.condition}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-sm">
                                  {l.mileage
                                    ? Number(l.mileage).toLocaleString() + " km"
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-sm">
                                  {l.state || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <DiscountCell listing={l} />
                                </td>
                                <td className="px-4 py-3">
                                  <AgeBadge createdAt={l.created_at} />
                                </td>
                                <td className="px-4 py-3">
                                  <StatusBadge listing={l} />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-0.5 justify-end">
                                    {!isSold && (
                                      <button
                                        onClick={() => setMarkSoldListing(l)}
                                        title="Mark as Sold"
                                        className="sold-btn p-1.5 rounded-lg transition-all text-gray-600"
                                        style={{
                                          border: "1px solid transparent",
                                        }}
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setEditListing(l)}
                                      title="Edit"
                                      className="p-1.5 text-gray-600 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => copyListing(l)}
                                      title="Copy"
                                      className={`p-1.5 rounded-lg transition-all ${copiedListingId === l.id ? "text-emerald-400 bg-emerald-500/10" : "text-gray-600 hover:text-amber-400 hover:bg-amber-500/10"}`}
                                    >
                                      {copiedListingId === l.id ? (
                                        <Check className="w-4 h-4" />
                                      ) : (
                                        <Clipboard className="w-4 h-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setPriceEditListing(l)}
                                      className="p-1.5 text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                                    >
                                      <Tag className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setTiktokListing(l)}
                                      className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                      <Video className="w-4 h-4" />
                                    </button>
                                    {/* Assign to salesman */}
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAssignDropdownId(assignDropdownId === l.id ? null : l.id);
                                        }}
                                        title={l.assigned_to && salesmenById[l.assigned_to] ? `Assigned: ${salesmenById[l.assigned_to].full_name}` : "Assign to salesman"}
                                        className={`p-1.5 rounded-lg transition-all ${l.assigned_to ? "text-purple-400 bg-purple-500/10" : "text-gray-600 hover:text-purple-400 hover:bg-purple-500/10"}`}
                                      >
                                        <UserPlus className="w-4 h-4" />
                                      </button>
                                      {assignDropdownId === l.id && (
                                        <div
                                          className="absolute right-0 bottom-full mb-1 w-44 rounded-xl overflow-hidden z-50 py-1"
                                          style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 -8px 32px rgba(0,0,0,0.7)" }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {l.assigned_to && (
                                            <button
                                              onClick={() => handleUnassign(l.id)}
                                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                              <X className="w-3 h-3" />
                                              Unassign
                                            </button>
                                          )}
                                          {l.assigned_to && salesmen.length > 0 && (
                                            <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
                                          )}
                                          {salesmen.length === 0 ? (
                                            <p className="px-3 py-2 text-xs text-gray-600">No salesmen found</p>
                                          ) : (
                                            salesmen.map((s) => (
                                              <button
                                                key={s.id}
                                                onClick={() => handleAssign(l.id, s.id, s.full_name)}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${l.assigned_to === s.id ? "text-purple-400 bg-purple-500/10" : "text-gray-300 hover:text-white hover:bg-white/5"}`}
                                              >
                                                <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                                                  {(s.full_name || "S")[0].toUpperCase()}
                                                </div>
                                                <span className="truncate">{s.full_name || "Unknown"}</span>
                                                {l.assigned_to === s.id && <Check className="w-3 h-3 ml-auto flex-shrink-0" />}
                                              </button>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => setDeleteId(l.id)}
                                      className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
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
                      {filteredListings.map((l) => {
                        const bt = l.body_type || l.bodyType || null;
                        const isSold = l.status === "sold";
                        const copied = copiedListingId === l.id;
                        return (
                          <div
                            key={l.id}
                            className={`p-4 ${getListingAge(l.created_at) >= 30 && !isSold ? "bg-amber-950/[0.07]" : ""} ${isSold ? "opacity-60" : ""}`}
                          >
                            <div className="flex gap-3 mb-3">
                              {l.images?.[0] ? (
                                <img
                                  src={l.images[0]}
                                  alt=""
                                  className={`w-14 h-14 rounded-xl object-cover bg-gray-800 flex-shrink-0 ${isSold ? "grayscale" : ""}`}
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-xl bg-white/5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-white text-sm leading-tight truncate">
                                      {l.brand} {l.model}
                                    </p>
                                    <p className="text-gray-600 text-xs mt-0.5 truncate">
                                      {l.variant || "—"}
                                      {bt ? ` · ${bt}` : ""}
                                    </p>
                                  </div>
                                  <StatusBadge listing={l} />
                                </div>
                                <div className="mt-1.5">
                                  <DiscountCell listing={l} />
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mb-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${condCls(l.condition)}`}
                              >
                                {l.condition}
                              </span>
                              {l.mileage && (
                                <span className="text-xs text-gray-500">
                                  {Number(l.mileage).toLocaleString()} km
                                </span>
                              )}
                              {l.state && (
                                <span className="text-xs text-gray-500">
                                  {l.state}
                                </span>
                              )}
                              <AgeBadge createdAt={l.created_at} />
                              {l.assigned_to && salesmenById[l.assigned_to] && (
                                <span className="flex items-center gap-1 text-[10px] text-purple-400/80">
                                  <UserPlus className="w-2.5 h-2.5" />
                                  {salesmenById[l.assigned_to].full_name}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => setEditListing(l)}
                                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-sky-400 transition-all"
                                style={{
                                  background: "rgba(56,189,248,0.07)",
                                  border: "1px solid rgba(56,189,248,0.15)",
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => copyListing(l)}
                                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${copied ? "text-emerald-400" : "text-amber-400"}`}
                                style={{
                                  background: copied
                                    ? "rgba(52,211,153,0.07)"
                                    : "rgba(251,191,36,0.07)",
                                  border: `1px solid ${copied ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.15)"}`,
                                }}
                              >
                                {copied ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Clipboard className="w-3.5 h-3.5" />
                                )}
                                {copied ? "Copied!" : "Copy"}
                              </button>
                              <button
                                onClick={() => setPriceEditListing(l)}
                                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-emerald-400 transition-all"
                                style={{
                                  background: "rgba(52,211,153,0.07)",
                                  border: "1px solid rgba(52,211,153,0.15)",
                                }}
                              >
                                <Tag className="w-3.5 h-3.5" />
                                Price
                              </button>
                              <button
                                onClick={() => setTiktokListing(l)}
                                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-red-400 transition-all"
                                style={{
                                  background: "rgba(220,38,38,0.07)",
                                  border: "1px solid rgba(220,38,38,0.15)",
                                }}
                              >
                                <Video className="w-3.5 h-3.5" />
                                TikTok
                              </button>
                              {!isSold && (
                                <button
                                  onClick={() => setMarkSoldListing(l)}
                                  className="sold-btn flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-500 transition-all"
                                  style={{
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                  }}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Sold
                                </button>
                              )}
                              {/* Assign — mobile */}
                              <div className="relative col-span-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssignDropdownId(assignDropdownId === l.id ? null : l.id);
                                  }}
                                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
                                  style={{
                                    background: l.assigned_to ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)",
                                    border: l.assigned_to ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(255,255,255,0.08)",
                                    color: l.assigned_to ? "#c084fc" : "#9ca3af",
                                  }}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  {l.assigned_to && salesmenById[l.assigned_to]
                                    ? salesmenById[l.assigned_to].full_name
                                    : "Assign"}
                                </button>
                                {assignDropdownId === l.id && (
                                  <div
                                    className="absolute left-0 bottom-full mb-1 w-full rounded-xl overflow-hidden z-50 py-1"
                                    style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 -8px 32px rgba(0,0,0,0.7)" }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {l.assigned_to && (
                                      <button
                                        onClick={() => handleUnassign(l.id)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                        Unassign
                                      </button>
                                    )}
                                    {salesmen.map((s) => (
                                      <button
                                        key={s.id}
                                        onClick={() => handleAssign(l.id, s.id, s.full_name)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${l.assigned_to === s.id ? "text-purple-400 bg-purple-500/10" : "text-gray-300 hover:text-white hover:bg-white/5"}`}
                                      >
                                        <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                                          {(s.full_name || "S")[0].toUpperCase()}
                                        </div>
                                        <span className="truncate">{s.full_name || "Unknown"}</span>
                                        {l.assigned_to === s.id && <Check className="w-3 h-3 ml-auto flex-shrink-0" />}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => setDeleteId(l.id)}
                                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-red-500 transition-all"
                                style={{
                                  background: "rgba(220,38,38,0.06)",
                                  border: "1px solid rgba(220,38,38,0.14)",
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
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

          {activeTab === "add" && (
            <div className="card-top rounded-xl p-4 sm:p-6" style={T.cardDark}>
              <CarForm onCreate={handleNew} />
            </div>
          )}
          {activeTab === "analytics" && (
            <AnalyticsTab listings={listings} profile={profile} />
          )}
          {activeTab === "team" && (
            <TeamTab managerDealership={profile?.dealership} dealerId={profile?.id} />
          )}
          {activeTab === "settings" && profile && (
            <SettingsTab
              profile={profile}
              onProfileUpdate={handleProfileUpdate}
            />
          )}
          {activeTab === "leads" && (
            <div
              className="flex flex-col"
              style={{ minHeight: "calc(100vh - 120px)" }}
            >
              <LeadsPage />
            </div>
          )}
          {activeTab === "hero" && userId && (
            <HeroSlidesPage userId={userId} profile={profile} />
          )}
        </div>
      </main>

      {/* ── Delete modal ── */}
      {deleteId && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
            style={T.modal}
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
            <p className="text-gray-400 text-sm mb-5">
              This will permanently remove the car listing from your inventory.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
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
        <TikTokGenerator
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
            style={T.modal}
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
    </div>
  );
}
