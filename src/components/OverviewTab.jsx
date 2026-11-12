import { Fragment, useEffect, useRef, useState } from 'react';
import { OVERVIEW_ROLES, NEEDS, overviewRoleFor } from '../config/dealerRoles';
import { useCachedFetch } from '../hooks/useCachedFetch';
import { supabase } from '../supabaseClient';
import { usePresence } from '../hooks/usePresence';
import { STAGE_ORDER, STAGE_CONFIG, canonicalStage } from '../lib/leadsHelpers';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Clock, Calendar, MessageCircle, ArrowRightLeft, FileText, UserPlus, CheckCircle2, ChevronRight, AlertTriangle, CreditCard, Eye, Inbox } from 'lucide-react';
import { liveChannel } from "../lib/liveChannel";
import { malaysiaDayBounds } from '../utils/myDay';
import { premiumLight as PL } from '../theme/tokens';
import '../theme/premiumLight.css';

// ─── Constants ────────────────────────────────────────────────────────────────
// Stage names, labels and colours come from the ONE stage list the leads board
// uses (src/lib/leadsHelpers.js). This file kept its own copy, which drifted to
// stages no lead has ever had (presented / reserved / documents / hp_submitted)
// and missed viewing_booked, test_drive and deposit_taken — so the pipeline
// chart silently dropped every lead sitting in those three.
const stageLabel = (s) => STAGE_CONFIG[canonicalStage(s)]?.label || s;
const SOURCE_LABELS = {
  drevo_enquiry: 'Enquiry', walk_in: 'Walk-In', mudah: 'Mudah',
  carlist: 'Carlist', facebook: 'Facebook', tiktok: 'TikTok',
  instagram: 'Instagram', whatsapp: 'WhatsApp', referral: 'Referral',
  other: 'Other', manual: 'Manual',
};
const ROLE_LABELS = {
  salesman: null, manager: 'Manager', admin: 'Admin',
  accountant: 'Accounts', fi_officer: 'F&I', owner: 'Owner',
  dealer: 'Owner', superadmin: 'Owner',
};
// Told apart by lightness, not hue (premiumLight: no blue / purple / amber).
const SOURCE_COLORS = PL.ramp;
const ACTIVE_STAGES = STAGE_ORDER.filter(s => s !== 'won' && s !== 'lost');
const AVATAR_COLORS = [PL.raised];
// One neutral icon well for every kind; only the outcome words carry colour
// (Sold = green text, Lost = red text).
const ACT_CFG = {
  whatsapp_sent:  { label: 'WhatsApp', icon: MessageCircle,   color: PL.textSec },
  stage_changed:  { label: 'Stage',    icon: ArrowRightLeft,  color: PL.textSec },
  note_added:     { label: 'Note',     icon: FileText,        color: PL.textSec },
  created:        { label: 'New lead', icon: UserPlus,        color: PL.textSec },
  won:            { label: 'Sold',     icon: CheckCircle2,    color: PL.up },
  lost:           { label: 'Lost',     icon: TrendingDown,    color: PL.accentText },
};
const WON_STAGES  = ['won', 'closed_won'];
const LOST_STAGES = ['lost', 'closed_lost'];
// A stage change INTO won/lost is the most important event in the feed — surface
// it as its own styled "Sold"/"Lost" entry instead of a generic stage change.
function effectiveActType(a) {
  if (a.activity_type === 'stage_changed' && WON_STAGES.includes(a.to_stage)) return 'won';
  if (a.activity_type === 'stage_changed' && LOST_STAGES.includes(a.to_stage)) return 'lost';
  return a.activity_type;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v >= 1_000_000) return `RM ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `RM ${(v / 1_000).toFixed(1)}K`;
  return `RM ${v.toLocaleString()}`;
}
function delta(val, prev) {
  if (!prev || prev === 0) return val > 0 ? 100 : null;
  return ((val - prev) / prev) * 100;
}
function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts);
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function isActiveToday(ts) {
  if (!ts) return false;
  return (Date.now() - new Date(ts)) < 8 * 3600_000;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const MICRO = { fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted, fontWeight: 600, margin: 0 };

// A tile states ONE number. No coloured icon square, no border: a white card
// on the grey canvas. The change vs last month is coloured TEXT, no pill.
function KpiCard({ label, value, sub, trend }) {
  const up = trend != null && trend >= 0;
  return (
    <div style={{ background: PL.cardBg, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '16px 18px', minWidth: 0 }}>
      <p style={MICRO}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: PL.text, margin: '8px 0 2px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ fontSize: 11, color: PL.textMuted, margin: 0, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {trend != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600, color: up ? PL.up : PL.accentText, fontVariantNumeric: 'tabular-nums' }}>
            {up ? <TrendingUp style={{ width: 11, height: 11 }} /> : <TrendingDown style={{ width: 11, height: 11 }} />}
            {up ? '+' : '-'}{Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sub && <span>{sub}</span>}
      </p>
    </div>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{ background: PL.cardBg, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '18px 20px', minWidth: 0, ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, sub, live }) {
  return (
    <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: PL.text, margin: 0 }}>{title}</p>
        {sub && <p style={{ fontSize: 11, color: PL.textMuted, margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {live && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: PL.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: PL.up, display: 'inline-block' }} />
          Live
        </span>
      )}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
// Plain async functions so useCachedFetch can paint the last result instantly
// and revalidate behind it. This tab is the first thing an owner sees; it used
// to show a skeleton until all five queries returned, which on a slow database
// moment was the whole 15+ second wait.
async function fetchPnl(dealerId) {
  const { data, error } = await supabase.rpc('gm_pnl_snapshot', { p_dealer_id: dealerId });
  if (error) throw error;
  return data;
}

async function fetchOverview(dealerId) {
  const now = Date.now();
  const today = malaysiaDayBounds();
  const [l, cl, apt, sm, acts, priceReq, teamAct, exc] = await Promise.all([
    supabase.from('leads')
      .select('id, stage, lead_source, created_at, updated_at, buyer_name, salesman_id, first_response_at')
      .eq('dealer_id', dealerId)
      .order('updated_at', { ascending: false })
      .limit(300),
    supabase.from('car_listings')
      .select('id, status, created_at')
      .eq('dealer_id', dealerId),
    supabase.from('appointments')
      .select('id, appointment_date')
      .eq('dealer_id', dealerId)
      .gte('appointment_date', today.start)
      .lt('appointment_date', today.end)
      .not('status', 'in', '(cancelled,no_show)'),
    supabase.from('profiles')
      .select('id, full_name, slug, role')
      .or(`dealer_id.eq.${dealerId},id.eq.${dealerId}`)
      .in('role', ['salesman', 'manager', 'admin', 'accountant', 'fi_officer', 'owner', 'dealer', 'superadmin']),
    supabase.from('lead_activities')
      .select('id, activity_type, note, created_at, lead_id, created_by, to_stage, creator:created_by(full_name)')
      .eq('dealer_id', dealerId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('deal_price_approvals')
      .select('lead_id, created_at', { count: 'exact' })
      .eq('dealer_id', dealerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1),
    // Each person's OWN last action (leads they worked, chat replies they sent,
    // logged actions). The same source the Team tab uses.
    supabase.rpc('get_team_activity', { p_dealer_id: dealerId }),
    // The exceptions GM Oversight's "Eyes Here" used to list (one alert list now).
    supabase.rpc('gm_exception_alerts', { p_dealer_id: dealerId }),
  ]);
  // A failed leads read must not overwrite a good cached overview with zeros —
  // throwing keeps the last snapshot on screen (useCachedFetch keeps old data).
  if (l.error) throw l.error;
  const allLeads    = l.data    || [];
  const allListings = cl.data   || [];
  const aptsToday   = apt.data  || [];
  const staff       = sm.data   || [];
  const activities  = acts.data || [];

  const leadsById = Object.fromEntries(allLeads.map(l => [l.id, l]));

  // "Active today" = something the person did THEMSELVES. It used to fall back
  // to leads.updated_at, which moves whenever the DEALER edits that rep's lead,
  // so a salesman who had not signed in for 45 days showed as active.
  const lastActivityByUser = {};
  for (const r of (teamAct?.error ? [] : teamAct?.data || [])) {
    if (r.user_id && r.last_active_at) lastActivityByUser[r.user_id] = r.last_active_at;
  }
  for (const a of activities) {
    if (!a.created_by) continue;
    const cur = lastActivityByUser[a.created_by];
    if (!cur || new Date(a.created_at) > new Date(cur))
      lastActivityByUser[a.created_by] = a.created_at;
  }

  // Exclude every terminal stage variant; 'sold' was never a lead stage
  const TERMINAL_STAGES = ['won','closed_won','lost','closed_lost'];
  const activeLeads = allLeads.filter(l => !TERMINAL_STAGES.includes(l.stage));
  const leadsPerSm  = {};
  for (const l of allLeads) {
    if (!l.salesman_id) continue;
    if (activeLeads.includes(l)) leadsPerSm[l.salesman_id] = (leadsPerSm[l.salesman_id] || 0) + 1;
  }

  const stageCounts = {};
  for (const l of allLeads) { const k = canonicalStage(l.stage); stageCounts[k] = (stageCounts[k] || 0) + 1; }

  const sourceCounts = {};
  for (const l of activeLeads) {
    const src = l.lead_source || 'unknown';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }

  const available = allListings.filter(c => c.status === 'available');
  const avgDays   = available.length
    ? Math.round(available.reduce((s, c) => s + (now - new Date(c.created_at)) / 86400000, 0) / available.length)
    : 0;
  const stale = available.filter(c => (now - new Date(c.created_at)) / 86400000 > 30).length;

  // Cold leads = active pipeline with no touch in 5+ days. The single most
  // actionable morning signal: real buyers going quiet.
  const COLD_DAYS = 5;
  const coldLeads = activeLeads
    .filter(l => (now - new Date(l.updated_at)) / 86400000 >= COLD_DAYS)
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
  const coldLeadsCount = coldLeads.length;

  // New leads nobody has answered for 30+ minutes (moved here from RevOps' strip).
  const unanswered = allLeads
    .filter(l => canonicalStage(l.stage) === 'new' && !l.first_response_at && (now - new Date(l.created_at)) > 30 * 60000)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const coldOldestDays = coldLeadsCount
    ? Math.floor((now - new Date(coldLeads[0].updated_at)) / 86400000)
    : 0;

  const teamRows = staff.map((s, idx) => {
    const lastAct = lastActivityByUser[s.id] || null;
    return {
      id: s.id,
      name: s.full_name || s.slug || 'Team',
      role: ROLE_LABELS[s.role] || null,
      active: leadsPerSm[s.id] || 0,
      isActive: isActiveToday(lastAct),
      lastActivity: lastAct,
      avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    };
  }).sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.active - a.active;
  });

  const recentActivities = activities.slice(0, 12).map(a => ({
    ...a,
    lead: leadsById[a.lead_id] || null,
  }));

  return {
    activeLeads: activeLeads.length,
    activeListings: available.length,
    stageCounts, sourceCounts, teamRows, avgDays, stale,
    coldLeadsCount, coldOldestDays,
    aptsToday: aptsToday.length, recentActivities,
    // Prices waiting for the dealer's OK (batch 6a). A failed read (table not on the
    // database yet) counts as none.
    priceWaiting: priceReq?.error ? 0 : (priceReq?.count || 0),
    // The oldest one: the alert opens that lead, not the whole list.
    priceLeadId: priceReq?.error ? null : (priceReq?.data?.[0]?.lead_id || null),
    unansweredCount: unanswered.length,
    unansweredOldestH: unanswered.length ? Math.floor((now - new Date(unanswered[0].created_at)) / 3600000) : 0,
    // gm_exception_alerts; a failed read = no exceptions shown, never a fake all-clear
    // for these specifically (they simply do not appear).
    exceptions: exc?.error ? null : (exc?.data || null),
  };
}

const EMPTY_SNAPSHOT = {
  activeLeads: 0, activeListings: 0, stageCounts: {}, sourceCounts: {},
  teamRows: [], avgDays: 0, stale: 0, coldLeadsCount: 0, coldOldestDays: 0, priceWaiting: 0,
  aptsToday: 0, recentActivities: [],
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OverviewTab({ dealerId, onNavigate, role, can }) {
  // Owner and manager see the SAME numbers in a different order (src/config/dealerRoles.js).
  // An owner can preview the manager's view; a manager cannot switch to the owner's.
  const realView = overviewRoleFor(role);
  const [preview, setPreview] = useState(null);
  const viewKey = realView === 'owner' && preview ? preview : realView;
  const view = OVERVIEW_ROLES[viewKey];
  const previewing = viewKey !== realView;
  // A previewed manager view hides what a manager would not see by default (their switches).
  const allowed = (key) => {
    const need = NEEDS[key];
    if (!need) return true;
    if (previewing) return true; // manager defaults have view_cost / view_gross ON
    return can ? can(need) : true;
  };
  // Keys end in the dealer id (per-account, and purged on logout via the
  // `cf:v1:` prefix in panelCache). ttlMs 0 = always refetch behind the paint.
  const { data: pnl } = useCachedFetch(
    dealerId ? `overview_pnl:${dealerId}` : null,
    () => fetchPnl(dealerId),
    { enabled: !!dealerId, ttlMs: 0 },
  );
  const { data: cachedSnapshot, loading, refresh } = useCachedFetch(
    dealerId ? `overview:${dealerId}` : null,
    () => fetchOverview(dealerId),
    { enabled: !!dealerId, ttlMs: 0 },
  );
  // No cache and the first read failed: show the empty state, never hang.
  const snapshot = cachedSnapshot || EMPTY_SNAPSHOT;
  const subRef = useRef(null);
  const onlineIds = usePresence(dealerId);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dealerId) return;
    const bump = () => refreshRef.current();
    subRef.current = liveChannel(supabase, `overview-${dealerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads',          filter: `dealer_id=eq.${dealerId}` }, bump)
      .subscribe();
    return () => { subRef.current?.unsubscribe(); };
  }, [dealerId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const mtd  = pnl?.mtd  || {};
  const lmtd = pnl?.lmtd || {};
  const unitTrend = delta(Number(mtd.units || 0), Number(lmtd.units || 0));
  const gpTrend   = delta(Number(mtd.gross_profit || 0), Number(lmtd.gross_profit || 0));

  const pipelineData = snapshot
    ? ACTIVE_STAGES.map(s => ({ stage: stageLabel(s), count: snapshot.stageCounts[s] || 0, color: STAGE_CONFIG[s].headerBorder })).filter(d => d.count > 0)
    : [];

  const sourceData = snapshot
    ? Object.entries(snapshot.sourceCounts)
        .map(([k, v]) => ({ name: SOURCE_LABELS[k] || k.replace(/_/g, ' '), value: v }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    : [];

  // gm_pnl_snapshot returns sparkline rows as { d: <date>, rev: <revenue> }
  const sparkData = (pnl?.sparkline || []).map(d => ({ day: d.d?.slice(5), rev: Number(d.rev || 0) }));

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <style>{`
          @keyframes ov-shimmer { 0%,100%{opacity:1} 50%{opacity:0.45} }
          .ov-skel { background:#eef0f3; border-radius:6px; animation:ov-shimmer 1.4s ease-in-out infinite; }
          @media(max-width:640px){.ov-kpi-grid{grid-template-columns:1fr 1fr !important}}
        `}</style>
        <div className="ov-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: PL.cardBg, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '16px 18px' }}>
              <div className="ov-skel" style={{ width: '40%', height: 10, marginBottom: 12 }} />
              <div className="ov-skel" style={{ width: '60%', height: 22, marginBottom: 8 }} />
              <div className="ov-skel" style={{ width: '40%', height: 11 }} />
            </div>
          ))}
        </div>
        <p style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center' }}>Loading overview…</p>
      </div>
    );
  }

  // Live presence overrides the activity-timestamp heuristic. Fall back to the
  // 8h heuristic only if realtime presence hasn't synced yet (empty set).
  const havePresence = onlineIds.size > 0;
  const teamRows = snapshot.teamRows
    .map(r => ({ ...r, isActive: havePresence ? onlineIds.has(r.id) : r.isActive }))
    .sort((a, b) => (a.isActive !== b.isActive ? (a.isActive ? -1 : 1) : b.active - a.active));
  const onlineCount = teamRows.filter(r => r.isActive).length;

  const SECTIONS = {
    alerts: (<>
      {/* ── Needs Attention strip ── */}
      {(() => {
        const alerts = [];
        // Urgent = a red dot. Info = no dot. Everything else is ink on a white
        // card: no tinted background with a matching solid border.
        if (snapshot.priceWaiting > 0) alerts.push({
          key: 'price', urgent: true, Icon: DollarSign,
          label: `${snapshot.priceWaiting} price${snapshot.priceWaiting === 1 ? '' : 's'} waiting for your OK`,
          detail: snapshot.priceWaiting > 1 ? 'a discount over your limit · opens the oldest' : 'a discount over your limit · tap to decide',
          go: 'crm', query: snapshot.priceLeadId ? { lead: snapshot.priceLeadId } : undefined,
        });
        if (snapshot.unansweredCount > 0) alerts.push({
          key: 'unanswered', urgent: true, Icon: Inbox,
          label: `${snapshot.unansweredCount} new lead${snapshot.unansweredCount === 1 ? '' : 's'} not answered`,
          detail: `waiting 30 min+ · oldest ${snapshot.unansweredOldestH}h`, go: 'crm',
        });
        const ex = snapshot.exceptions || {};
        if (ex.loss_makers?.length) alerts.push({
          key: 'loss', urgent: true, Icon: AlertTriangle,
          label: `${ex.loss_makers.length} car${ex.loss_makers.length === 1 ? '' : 's'} priced below cost`,
          detail: ex.loss_makers.slice(0, 3).map(x => x.name).join(', '), go: 'stock',
        });
        if (ex.stuck_hp > 0) alerts.push({
          key: 'hp', urgent: true, Icon: CreditCard,
          label: `${ex.stuck_hp} HP submission${ex.stuck_hp === 1 ? '' : 's'} stuck`,
          detail: 'no bank answer in 7d+', go: 'hp',
        });
        if (ex.expired_b7 > 0 || ex.missing_b7 > 0) alerts.push({
          key: 'b7', urgent: ex.expired_b7 > 0, Icon: AlertTriangle,
          label: `${(ex.expired_b7 || 0) + (ex.missing_b7 || 0)} unit${(ex.expired_b7 || 0) + (ex.missing_b7 || 0) === 1 ? '' : 's'} need PUSPAKOM B7`,
          detail: [ex.expired_b7 > 0 && `${ex.expired_b7} expired`, ex.missing_b7 > 0 && `${ex.missing_b7} missing`].filter(Boolean).join(' · '), go: 'stock',
        });
        if (ex.anomalies_7d > 0) alerts.push({
          key: 'anomaly', urgent: false, Icon: Eye,
          label: `${ex.anomalies_7d} unusual edit${ex.anomalies_7d === 1 ? '' : 's'} this week`,
          detail: 'see the activity trail', go: 'team', query: { trail: 'anomaly' },
        });
        if (snapshot.coldLeadsCount > 0) alerts.push({
          key: 'cold', urgent: true, Icon: MessageCircle,
          label: `${snapshot.coldLeadsCount} cold lead${snapshot.coldLeadsCount === 1 ? '' : 's'}`,
          detail: `no reply in 5d+ · oldest ${snapshot.coldOldestDays}d`, go: 'crm',
        });
        if (snapshot.stale > 0) alerts.push({
          key: 'stale', urgent: false, Icon: Clock,
          label: `${snapshot.stale} aged unit${snapshot.stale === 1 ? '' : 's'}`,
          detail: 'on lot 30d+ · review price', go: 'listings',
        });
        if (snapshot.aptsToday > 0) alerts.push({
          key: 'appt', urgent: false, Icon: Calendar,
          label: `${snapshot.aptsToday} appointment${snapshot.aptsToday === 1 ? '' : 's'} today`,
          detail: 'check the bookings board', go: 'crm', query: { sub: 'bookings' },
        });
        const shown = alerts
          .filter((x) => view.alerts.includes(x.key) && allowed(x.key))
          .sort((x, y) => view.alerts.indexOf(x.key) - view.alerts.indexOf(y.key));
        if (shown.length === 0) return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: PL.cardBg, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '14px 18px' }}>
            <CheckCircle2 style={{ width: 16, height: 16, color: PL.up }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: PL.text, margin: 0 }}>All clear. Nothing needs you right now.</p>
          </div>
        );
        return (
          <div className="ov-attn-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {shown.map(a => (
              <button key={a.key} className="pl-key" onClick={() => onNavigate?.(a.go, a.query)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: PL.cardBg, border: 'none', borderRadius: PL.radius.card, padding: '14px 16px', cursor: onNavigate ? 'pointer' : 'default', width: '100%', fontFamily: 'inherit', minWidth: 0 }}>
                <div style={{ position: 'relative', width: 38, height: 38, borderRadius: 12, background: PL.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <a.Icon style={{ width: 17, height: 17, color: PL.text }} />
                  {a.urgent && <span style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: PL.accent, border: `2px solid ${PL.card}` }} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: PL.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</p>
                  <p style={{ fontSize: 11.5, color: PL.textMuted, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detail}</p>
                </div>
                <ChevronRight style={{ width: 16, height: 16, color: PL.textMuted, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        );
      })()}

    </>),
    kpis: (<>
      {/* ── KPI Row ── */}
      <div className="ov-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {view.kpis.filter(allowed).map((id) => {
          const K = {
            open_leads:      { label: 'Open leads',       value: snapshot.activeLeads, sub: 'active pipeline' },
            active_listings: { label: 'Active listings',  value: snapshot.activeListings, sub: snapshot.stale ? `${snapshot.stale} on lot 30d+` : 'all under 30 days' },
            sold_month:      { label: 'Sold this month',  value: mtd.units ?? 0, sub: 'vs last month', trend: unitTrend },
            gross_month:     { label: 'Gross this month', value: fmt(mtd.gross_profit), sub: mtd.avg_margin ? `${mtd.avg_margin}% margin` : 'no sales yet', trend: gpTrend },
            appts_today:     { label: 'Appointments today', value: snapshot.aptsToday, sub: 'test drives and viewings' },
            money_tied:      { label: 'Money tied up',    value: fmt(pnl?.inventory?.capital_tied), sub: 'buy + recon, cars in stock' },
          }[id];
          return K ? <KpiCard key={id} label={K.label} value={K.value} sub={K.sub} trend={K.trend} /> : null;
        })}
      </div>

    </>),
    money: (<>
      {/* ── Revenue + Stock ── */}
      <div className="ov-rev-stock" style={{ display: 'grid', gridTemplateColumns: sparkData.length ? '2fr 1fr' : '1fr', gap: 14 }}>
        {sparkData.length > 0 && (
          <Panel>
            <SectionHeader title="Revenue — Last 30 Days" sub={`MTD ${fmt(mtd.revenue)}  ·  prev ${fmt(lmtd.revenue)}`} />
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={sparkData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={PL.raised} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', background: PL.card, boxShadow: '0 4px 16px rgba(17,24,39,0.12)' }} formatter={(v) => [fmt(v), 'Revenue']} />
                <Line type="monotone" dataKey="rev" stroke={PL.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        )}
        <Panel>
          <SectionHeader title="Stock" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Average days on lot', value: `${snapshot.avgDays}d` },
              { label: 'On lot 30 days+',     value: snapshot.stale, warn: snapshot.stale > 0 },
              { label: 'Appointments today',  value: snapshot.aptsToday },
              { label: 'Capital tied up',     value: fmt(pnl?.inventory?.capital_tied) },
            ].map(({ label, value, warn }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: PL.raised, borderRadius: PL.radius.row, padding: '10px 12px' }}>
                <span style={{ fontSize: 12, color: PL.textSec }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: warn ? PL.accentText : PL.text, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

    </>),
    pipeline: (<>
      {/* ── Pipeline + Sources ── */}
      <div className="ov-pipe-src" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel>
          <SectionHeader title="Lead Pipeline" sub="Active leads by stage" live />
          {pipelineData.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>No active leads yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(140, pipelineData.length * 28)}>
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: PL.textSec }} tickLine={false} axisLine={false} width={90} />
                <Tooltip cursor={{ fill: PL.raised }} contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(17,24,39,0.12)' }} />
                <Bar dataKey="count" fill={PL.text} radius={[0, 6, 6, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Lead Sources" sub="Where your leads come from" />
          {sourceData.length === 0 ? (
            <div>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>No leads yet.</p>
              <p style={{ fontSize: 11, color: PL.textMuted, marginTop: 4, lineHeight: 1.5 }}>
                Source is set when a salesman adds a lead — Walk-In, WhatsApp, Facebook, Mudah, Carlist, TikTok, Instagram, Referral.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={28} outerRadius={46} dataKey="value" strokeWidth={0}>
                      {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sourceData.map((s, i) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SOURCE_COLORS[i % SOURCE_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: PL.textSec }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: PL.text, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

    </>),
    team: (<>
      {/* ── Team on Duty + Recent Conversations ── */}
      <div className="ov-team-conv" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14 }}>

        {/* Team panel */}
        <Panel style={{ padding: '18px 16px' }}>
          <SectionHeader title="Team on Duty" sub={`${onlineCount} online now`} live />
          {teamRows.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>No team members found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {teamRows.map((r) => (
                <div key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderRadius: 8, transition: 'background 0.15s', cursor: 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = PL.raised}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: PL.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: PL.text }}>
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: r.isActive ? PL.up : '#c4c8cf', border: `2px solid ${PL.card}` }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</p>
                      {r.role && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: PL.textMuted, background: PL.raised, borderRadius: PL.radius.pill, padding: '2px 7px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.role}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: r.isActive ? PL.up : PL.textMuted }}>
                        {r.isActive ? 'Online' : (r.lastActivity ? timeAgo(r.lastActivity) : 'Away')}
                      </span>
                      {r.active > 0 && (
                        <>
                          <span style={{ color: '#D1D5DB' }}>•</span>
                          <span style={{ color: '#374151', fontWeight: 600 }}>{r.active} assigned</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Recent Conversations */}
        <Panel>
          <SectionHeader title="Recent Conversations" sub="WhatsApp sends, stage changes, notes" live />
          {snapshot.recentActivities.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>No activity yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {snapshot.recentActivities.map((a, i) => {
                const actType = effectiveActType(a);
                const cfg  = ACT_CFG[actType] || ACT_CFG.note_added;
                const Icon = cfg.icon;
                const who  = a.creator?.full_name || 'Salesman';
                const cust = a.lead?.buyer_name || 'Unknown';
                const stage = a.to_stage ? stageLabel(a.to_stage) : null;
                const note  = a.note ? (a.note.length > 48 ? a.note.slice(0, 45) + '…' : a.note) : null;
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: i > 0 ? `1px solid ${PL.line}` : undefined }}>
                    <div style={{ width: 30, height: 30, borderRadius: 10, background: PL.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Icon style={{ width: 13, height: 13, color: cfg.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{cust}</span>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>
                          {actType === 'won' && 'deal won'}
                          {actType === 'lost' && 'deal lost'}
                          {a.activity_type === 'whatsapp_sent' && 'WhatsApp sent'}
                          {actType === 'stage_changed' && (stage ? `→ ${stage}` : 'stage changed')}
                          {a.activity_type === 'note_added' && (note || 'note added')}
                          {a.activity_type === 'created' && 'lead created'}
                          {!ACT_CFG[a.activity_type] && actType === a.activity_type && (note || a.activity_type.replace(/_/g, ' '))}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0' }}>{who} · {timeAgo(a.created_at)}</p>
                    </div>
                    <span className="ov-conv-col-hide" style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: PL.raised, borderRadius: PL.radius.pill, padding: '3px 9px', flexShrink: 0, alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </>),
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: '#111827', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        @media (max-width: 768px) {
          .ov-kpi-grid   { grid-template-columns: 1fr 1fr !important; }
          .ov-rev-stock  { grid-template-columns: 1fr !important; }
          .ov-pipe-src   { grid-template-columns: 1fr !important; }
          .ov-team-conv  { grid-template-columns: 1fr !important; }
          .ov-attn-grid  { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .ov-kpi-grid   { grid-template-columns: 1fr 1fr !important; }
          .ov-conv-table { font-size: 11px !important; }
          .ov-conv-col-hide { display: none !important; }
        }
      `}</style>

      {/* Owner only: preview what a manager sees (same numbers, their order). */}
      {realView === 'owner' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <span style={{ fontSize: 12, color: PL.textMuted }}>View as</span>
          <div role="group" aria-label="View as" style={{ display: 'inline-flex', background: PL.raised, borderRadius: PL.radius.pill, padding: 3 }}>
            {['owner', 'manager'].map((r) => (
              <button key={r} type="button" aria-pressed={viewKey === r} onClick={() => setPreview(r === 'owner' ? null : r)}
                style={{ height: 30, padding: '0 14px', borderRadius: PL.radius.pill, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                  background: viewKey === r ? PL.card : 'transparent', color: viewKey === r ? PL.text : PL.textMuted, boxShadow: viewKey === r ? '0 1px 3px rgba(17,24,39,0.12)' : 'none' }}>
                {OVERVIEW_ROLES[r].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view.sections.filter(allowed).map((sec) => <Fragment key={sec}>{SECTIONS[sec]}</Fragment>)}
    </div>
  );
}
