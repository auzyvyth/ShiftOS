import React from "react";
import { useTranslation } from "react-i18next";
import {
 Bell, Calendar, Car, CheckCircle, ChevronRight, Clock, ExternalLink, Eye, History,
 Link as LinkIcon, MessageCircle, Pin, Share2, Store, Users, ClipboardList, Zap, Calculator,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { normalizePhone } from "../../lib/phone";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";
import ShareMenu from "../../components/ShareMenu";
import ChannelBreakdown from "../../components/ChannelBreakdown";
import { shareVisits } from "../../utils/detectChannel";
import ThisWeek from "../../components/crm/ThisWeek";
import FollowUpRow from "../../components/crm/FollowUpRow";
import StarterTasks, { hasBioLinkVisit } from "../../components/onboarding/StarterTasks";
import {
 CARD_HEADER, EYEBROW, STAT, SOFT, ROW_LINE, LEAD_STAGES, stageLabel,
} from "./shared";
import SalesHistorySheet from "./SalesHistorySheet";
import StatSkeleton from "../../components/ui/StatSkeleton";

// Dashboard tab — split out of SalesmanPremium.jsx (was `renderDashboard`) so
// it lazy-loads instead of shipping in the initial bundle regardless of which
// tab the user opens. Body moved verbatim; only the wrapper (closure -> real
// component taking named props) and these imports are new.
export default function DashboardTab({
 leads, appointments, myListings, carStatsMap, enquiries, staleLeads, isReturning,
 goal, goalEditing, goalDraft, showPrevMonth, customers, dueNudges, profile, servicePackages,
 handoverActive, handoverNext,
 minipageStats, trafficReady = true, leadsReady = true, browserNotifPerm, notifBannerDismissed,
 isMobile,
 setActiveTab, setActiveLeadStage, setGoalDraft, setGoalEditing, setShowPrevMonth,
 setShowAddForm, setInboxSubTab,
 saveGoal, triggerGlow, switchTab, pingWA, handleThisWeekContacted,
 requestBrowserNotif, dismissNotifBanner,
 handleListingCopy, onVisitMinipage, starterHidden, starterTasksReady, onStarterDismiss, onEditBio, onEditPhoto, onVerify,
}) {
 const { t, i18n } = useTranslation();
 const dateLocale = i18n.language?.startsWith("ms") ? "ms-MY" : "en-MY";
 const activeLeads = leads.filter(
 (l) => l.stage !== "lost" && l.stage !== "closed_lost" && l.stage !== "closed_won" && l.stage !== "won",
 );
 const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
 const closedThisMonth = leads.filter((l) =>
 ["won", "closed_won", "lost", "closed_lost"].includes(l.stage) &&
 l.updated_at && new Date(l.updated_at) >= monthStart,
 );
 const todayAppts = appointments.filter((a) => {
 if (!a.appointment_date) return false;
 const d = new Date(a.appointment_date);
 if (isNaN(d)) return false;
 const today = new Date();
 return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
 }).length;

 // Subtitle for the Sold shortcut. It has to say what is waiting, not just
 // name the tab — that is the whole reason the old pair of buttons went
 // unclicked. Counts only; no invented figure of any kind.
 const renewalsDue = customers.filter((c) => {
 const due = (d) => d && (new Date(d) - Date.now()) / 86400000 <= 30;
 return due(c.road_tax_expiry) || due(c.insurance_expiry);
 }).length;
 const soldSummary = [
 handoverActive > 0 ? `${t("salesmanPremium.dash.handoversInProgress", { count: handoverActive })}${handoverNext ? ` · ${t("salesmanPremium.dash.next", { step: handoverNext })}` : ""}` : null,
 renewalsDue > 0 ? t("salesmanPremium.dash.renewalsDue", { count: renewalsDue }) : null,
 ].filter(Boolean).join(" · ")
 || (customers.length ? t("salesmanPremium.dash.buyersOnRecord", { count: customers.length }) : t("salesmanPremium.dash.soldEmpty"));

 const listingStats = myListings.map((car) => {
 const s = carStatsMap[car.id] ?? {};
 const views = s.views || 0;
 const waTaps = s.enquiries || 0;
 const enqCount = enquiries.filter((e) => e.listing_id === car.id).length;
 const cvr = views > 0 ? (waTaps / views) * 100 : null;
 // Index 6 of each 7-day series is TODAY (Malaysian calendar day) since
 // migration 20260904f — which car moved today, not just which is best
 // over 30 days. A car with one view today and none for a week reads very
 // differently from the same car with a flat 30-day total.
 const viewsToday = Number(s.daily?.[6]) || 0;
 const waToday = Number(s.waDaily?.[6]) || 0;
 return { car, views, waTaps, enqCount, cvr, viewsToday, waToday };
 });
 const totalViews = Object.values(carStatsMap).reduce((s, v) => s + (v.views || 0), 0);
 const totalWATaps = Object.values(carStatsMap).reduce((s, v) => s + (v.enquiries || 0), 0);
 // Real 7-day trends, oldest day first. All three come from data the page
 // already fetched: listing views (carStatsMap.daily), WhatsApp/call taps
 // (carStatsMap.waDaily — the w0..w6 columns get_salesman_analytics has
 // always returned) and mini-page visits (get_salesman_minipage_daily).
 // They are plotted as ONE chart with three waves rather than four tiles
 // where only Views had a line.
 const sumDaily = (key) => Array(7).fill(0).map((_, i) =>
 Object.values(carStatsMap).reduce((s, v) => s + (Number(v[key]?.[i]) || 0), 0)
 );
 const viewsTrend = sumDaily("daily");
 const waTrend = sumDaily("waDaily");
 const visitsTrend = Array(7).fill(0).map((_, i) => Number(minipageStats.daily?.[i]) || 0);
 // d0 = 6 days ago … d6 = today, so the axis labels count backwards from now.
 const dayFmt = new Intl.DateTimeFormat(dateLocale, { weekday: "short" });
 const trafficTrend = Array(7).fill(0).map((_, i) => {
 const d = new Date();
 d.setDate(d.getDate() - (6 - i));
 return {
 day: i === 6 ? t("salesmanPremium.dash.today") : dayFmt.format(d),
 views: viewsTrend[i],
 visits: visitsTrend[i],
 waTaps: waTrend[i],
 };
 });
 const TRAFFIC_SERIES = [
 { key: "views", label: t("salesmanPremium.dash.views"), hue: C.info },
 { key: "visits", label: t("salesmanPremium.dash.pageVisits"), hue: "#a78bfa" },
 { key: "waTaps", label: t("salesmanPremium.dash.waTaps"), hue: C.success },
 ];
 const hasTrafficTrend = trafficTrend.some((r) => r.views > 0 || r.visits > 0 || r.waTaps > 0);
 const overallCVR = totalViews > 0 ? ((totalWATaps / totalViews) * 100).toFixed(1) : null;
 const bestCVRStat = listingStats.reduce((best, s) => (s.cvr !== null && (best === null || s.cvr > best.cvr)) ? s : best, null);
 const cvrColor = (cvr) => cvr >= 10 ? C.success : cvr >= 5 ? C.warn : C.danger;
 const perfCarName = (car) => [car.year, car.brand, car.model].filter(Boolean).join(" ");
 const isNewUser = myListings.length === 0 && leads.length === 0;
 // No buyer has reached this seller yet (SIMPLE-1, 2026-10-21): every card
 // below the hero is about leads, bookings or sales, so all of them would
 // render as zeros and empty states. New signups called that "too
 // complicated"; hide them until there is something to show.
 const startingOut = leads.length === 0 && customers.length === 0
 && (appointments || []).length === 0 && (enquiries || []).length === 0;

 // Today's agenda — grouped by urgency, dates keyed on the LOCAL calendar (not
 // UTC) so an early-morning appointment isn't bucketed into the wrong day.
 const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
 const todayKey = dayKey(new Date());
 const apptDay = (a) => a.appointment_date ? dayKey(new Date(a.appointment_date)) : null;
 const apptOpen = (s) => !["cancelled", "completed", "done", "no_show"].includes((s || "").toLowerCase());
 const fuKey = (v) => v ? (v.length <= 10 ? v.slice(0, 10) : dayKey(new Date(v))) : null;
 const agendaAppts = appointments.filter((a) => apptDay(a) === todayKey && apptOpen(a.status));
 // Missed = an appointment whose day is already past but was never closed out.
 const missedAppts = appointments
 .filter((a) => { const k = apptDay(a); return k && k < todayKey && apptOpen(a.status); })
 .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
 .slice(0, 10);
 const agendaFollowUps = leads.filter((l) => fuKey(l.follow_up_at) === todayKey && !["won", "lost", "closed_won", "closed_lost"].includes(l.stage));
 const hasAgenda = agendaAppts.length > 0 || missedAppts.length > 0 || agendaFollowUps.length > 0;
 // Jump from an agenda row to its pipeline lead with the same red glow.
 // Appointments aren't joined to leads, so match by phone; fall back to the
 // Inbox tab when there's no lead yet (e.g. an unconfirmed booking).
 const goToLeadForAppt = (a) => {
 const ph = normalizePhone(a.buyer_phone);
 const lead = ph ? leads.find((l) => normalizePhone(l.phone) === ph) : null;
 if (lead) { setActiveTab("leads"); setActiveLeadStage(lead.stage); triggerGlow([lead.id]); }
 else { switchTab("enquiries"); setInboxSubTab("bookings"); }
 };

 // Goal panel data — commission earned this month (sum of commission_amount on sold listings)
 const soldThisMonth = myListings
 .filter(c => {
 if (c.status !== "sold" || !c.sold_at) return false;
 const d = new Date(c.sold_at);
 const now = new Date();
 return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
 })
 .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
 const soldCountThisMonth = myListings.filter(c => {
 if (c.status !== "sold" || !c.sold_at) return false;
 const d = new Date(c.sold_at);
 const now = new Date();
 return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
 }).length;

 // Commission sparkline — per-day (not cumulative) over the trailing 14 days,
 // compared against the 14 days before that.
 const DAY_MS = 86400000;
 const todayMidnight = new Date();
 todayMidnight.setHours(0, 0, 0, 0);
 const toLocalDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
 const soldWithCommission = myListings.filter(c => c.status === "sold" && c.sold_at);
 const commissionOnDay = (dateKey) => soldWithCommission
 .filter(c => toLocalDateKey(new Date(c.sold_at)) === dateKey)
 .reduce((s, c) => s + (Number(c.commission_amount) || 0), 0);
 const commissionTrend = Array.from({ length: 14 }, (_, i) => {
 const key = toLocalDateKey(new Date(todayMidnight.getTime() - (13 - i) * DAY_MS));
 return { d: key, val: commissionOnDay(key) };
 });
 const trendTotal = commissionTrend.reduce((s, p) => s + p.val, 0);
 const prevTrendTotal = Array.from({ length: 14 }, (_, i) =>
 commissionOnDay(toLocalDateKey(new Date(todayMidnight.getTime() - (27 - i) * DAY_MS))),
 ).reduce((s, v) => s + v, 0);
 const trendDelta = prevTrendTotal > 0
 ? Math.round(((trendTotal - prevTrendTotal) / prevTrendTotal) * 100)
 : (trendTotal > 0 ? 100 : null);
 const available = myListings.filter(c => c.status === "available");
 // The four headline numbers above the traffic chart. The three that have a
 // wave carry its colour as a dot; Live Listings is a count, not a series.
 // The four headline numbers are 30-day totals; `today` is the same metric for
 // TODAY ONLY, rendered beside it as a green +N. That is the whole daily view —
 // no second block of numbers competing with these, and nothing new fetched:
 // index 6 of each 7-day series IS today now that get_salesman_analytics and
 // get_salesman_minipage_daily bucket by Malaysian calendar days rather than a
 // rolling 24 hours (migration 20260904f). Before that fix a "+N today" badge
 // would have been counting from this time yesterday. Live Listings is a count,
 // not a time series, so it has no daily figure and shows no badge.
 const TRAFFIC_STATS = [
 { label: t("salesmanPremium.dash.views30"), value: totalViews || 0, today: viewsTrend[6] || 0, Icon: Eye, hue: C.info },
 { label: t("salesmanPremium.dash.visitsAll"), value: minipageStats.visits || 0, today: visitsTrend[6] || 0, Icon: LinkIcon, hue: "#a78bfa" },
 // Counts WhatsApp AND call taps, deduped per visitor, over a ROLLING 30 days
 // (get_salesman_analytics p_cutoff). It falls as old taps age out -- a seller
 // read 90 -> 88 as "upgrading lost my taps". Say both facts on the tile.
 { label: t("salesmanPremium.dash.taps30"), value: totalWATaps || 0, today: waTrend[6] || 0, Icon: MessageCircle, hue: C.success },
 { label: t("salesmanPremium.dash.liveListings"), value: available.length, today: null, Icon: Car, hue: null },
 ];
 const todayTotal = (viewsTrend[6] || 0) + (visitsTrend[6] || 0) + (waTrend[6] || 0);
 const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
 const pct = goal.target > 0 ? Math.min((soldThisMonth / goal.target) * 100, 100) : 0;
 const goalHue = pct >= 100 ? C.success : pct >= 60 ? C.info : C.danger;
 const goalHueText = pct >= 100 ? C.successText : pct >= 60 ? C.infoText : C.dangerText;
 // Semicircle gauge geometry for the goal card — arc runs from 180°
 // (0%, left) to 0° (100%, right); the pointer dot sits at pct along it.
 const gaugeCx = 120, gaugeCy = 116, gaugeR = 92;
 const gaugeAngleRad = ((180 - 1.8 * pct) * Math.PI) / 180;
 const gaugePtX = gaugeCx + gaugeR * Math.cos(gaugeAngleRad);
 const gaugePtY = gaugeCy - gaugeR * Math.sin(gaugeAngleRad);
 const focusCar = goal.focusCarId ? myListings.find(c => c.id === goal.focusCarId && c.status === "available") : null;
 const scoreCar = (c) => {
 const s = carStatsMap[c?.id] || {};
 return (s.views || 0) * 2 + (s.enquiries || 0) * 5;
 };
 const autoFocus = !focusCar && available.length > 0
 ? available.reduce((best, c) => (scoreCar(c) > scoreCar(best) ? c : best), available[0])
 : null;
 const highlighted = focusCar || autoFocus;

 const greetingWord = (() => {
 const h = new Date().getHours();
 return t(`salesmanPremium.greet.${h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"}`);
 })();
 const personalizedLine = isNewUser
 ? t("salesmanPremium.dash.lineNew")
 : isReturning
 ? (staleLeads.length > 0
 ? t("salesmanPremium.dash.lineBackStale", { count: staleLeads.length })
 : t("salesmanPremium.dash.lineBackClear"))
 : staleLeads.length > 0
 ? t("salesmanPremium.dash.lineStale", { count: staleLeads.length })
 : todayAppts > 0
 ? t("salesmanPremium.dash.lineAppts", { count: todayAppts })
 : activeLeads.length > 0
 ? t("salesmanPremium.dash.lineDeals", { count: activeLeads.length })
 : t("salesmanPremium.dash.lineClear");

 return (
 <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
 {/* Dashboard-only card chrome — layered gradient surface + a soft top
 highlight, richer than the flat CARD token used on every other tab.
 Scoped to this tab; nothing else changes. */}
 <style>{`
 .sp-insight-card {
 background: linear-gradient(155deg, ${C.surfaceRaised} 0%, ${C.surface} 65%);
 border: 1px solid ${C.border};
 border-radius: ${R.lg}px;
 box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 36px -24px rgba(0,0,0,0.6);
 position: relative;
 overflow: hidden;
 }
 .sp-insight-card::before {
 content: "";
 position: absolute; inset: 0; pointer-events: none;
 background: radial-gradient(120% 60px at 15% 0%, rgba(255,255,255,0.05), transparent 60%);
 }
 `}</style>

 {/* Starter tasks — same component Lite uses, Premium's 5-step list.
 First thing on the page, where a setup guide sits in Shopify's admin:
 below the Sold shortcut it was the last thing a new seller reached. */}
 {starterTasksReady && !starterHidden && (
 <StarterTasks
 premium
 t={t}
 profile={profile}
 listingCount={myListings.length}
 bioLinkSeen={hasBioLinkVisit(minipageStats.byChannel)}
 palette={{ surface: C.surface, border: C.border, line: C.line, text: C.text, textMuted: C.textMuted, textDim: C.textDim, accent: C.accent, onAccent: C.onAccent, success: C.success }}
 onAddListing={() => { switchTab("listings"); setTimeout(() => setShowAddForm(true), 100); }}
 onVisitMinipage={onVisitMinipage}
 onEditPhoto={onEditPhoto}
 onVerify={onVerify}
 onEditBio={onEditBio}
 onDismiss={onStarterDismiss}
 />
 )}

 {/* Hero: greeting + live portfolio snapshot */}
 <div className="sp-insight-card" style={{ padding: isMobile ? "20px 18px" : "26px 28px" }}>
 <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${withAlpha(C.accent, 0.14)} 0%, transparent 70%)`, pointerEvents: "none" }} />
 <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
 <div>
 <p style={{ margin: 0, fontSize: T.size.xl, fontWeight: T.weight.bold, color: C.text, letterSpacing: "-0.3px" }}>
 {greetingWord}, {profile?.full_name?.split(" ")[0] || t("salesmanPremium.greet.there")}.
 </p>
 <p style={{ margin: "5px 0 0", fontSize: T.size.base, color: C.textSec, maxWidth: 440 }}>
 {/* It counts leads; "your pipeline is clear" before they load is false. */}
 {leadsReady ? personalizedLine : <StatSkeleton width="70%" height={16} />}
 </p>
 </div>
 {staleLeads.length > 0 && (
 <button
 onClick={() => {
 const activeStageOrder = LEAD_STAGES.filter((s) => !["lost", "closed_lost", "closed_won"].includes(s));
 const firstStaleStage = activeStageOrder.find((s) => staleLeads.some((l) => l.stage === s));
 if (firstStaleStage) setActiveLeadStage(firstStaleStage);
 switchTab("leads");
 triggerGlow(staleLeads.map((l) => l.id));
 }}
 style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: R.pill, background: withAlpha(C.danger, 0.08), border: `1px solid ${withAlpha(C.danger, 0.18)}`, flexShrink: 0, cursor: "pointer", fontFamily: "inherit" }}
 >
 <Bell size={11} color={C.danger} strokeWidth={2.5} />
 <span style={{ fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.dangerText }}>{t("salesmanPremium.dash.overdue", { count: staleLeads.length })}</span>
 </button>
 )}
 </div>
 {/* Always rendered. Gating this on having a live listing hid the
 mini-page link from the one seller who most needs to find it — a
 brand-new account. With no listings the all-zero stat strip is
 replaced by the ask; the link itself shows either way. */}
 <div style={{ position: "relative", marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
 {available.length === 0 ? (
 /* No CTA here on purpose — the starter-tasks card below owns the
 "add a listing" ask and tracks whether it is done. */
 <div style={{ minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.lg, fontWeight: T.weight.semibold, color: C.text }}>
 {t("salesmanPremium.dash.emptyTitle")}
 </p>
 <p style={{ margin: "3px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.5 }}>
 {t("salesmanPremium.dash.emptyBody")}
 </p>
 </div>
 ) : (
 <>
 {/* One row, always — four columns on a 375px phone and on desktop
 alike. It used to be a flex row with flexWrap, so on mobile the
 tiles broke into a ragged 2+2 and the strip read as a separate
 (broken) card instead of one line of numbers. */}
 <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
 {TRAFFIC_STATS.map(({ label, value, today, Icon, hue }, i) => (
 <div key={label} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, paddingLeft: i > 0 ? (isMobile ? 10 : 18) : 0, paddingRight: isMobile ? 6 : 12, borderLeft: i > 0 ? `1px solid ${C.line}` : "none" }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: R.sm, background: hue ? withAlpha(hue, 0.12) : C.fillStrong, color: hue || C.textMuted }}>
 <Icon size={11} strokeWidth={2.2} />
 </span>
 <span style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0 }}>
 {/* Placeholder, never a 0, until every number behind the row is in
 (trafficReady, SalesmanPremium.jsx): they all appear together. */}
 {trafficReady
 ? <span style={{ ...STAT, fontSize: isMobile ? T.size.stat : T.size.statLg, color: C.text, lineHeight: 1.1 }}>{value.toLocaleString("en-MY")}</span>
 : <StatSkeleton width={isMobile ? 34 : 48} height={isMobile ? 24 : 30} />}
 {/* Only when something actually happened today. A "+0" on every tile
 every morning trains people to stop reading the row. */}
 {trafficReady && today > 0 && (
 <span title={t("salesmanPremium.dash.nToday", { n: today })} style={{ fontSize: T.size.xs, fontWeight: T.weight.semibold, color: C.successText, lineHeight: 1, whiteSpace: "nowrap" }}>
 +{today}
 </span>
 )}
 </span>
 <span style={{ ...EYEBROW, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
 </div>
 ))}
 </div>
 {/* Say what the two numbers mean, once, instead of labelling every tile
 twice. Silent on a quiet day rather than announcing a zero. */}
 <span style={{ ...EYEBROW, display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, fontWeight: T.weight.normal }}>
 <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.success }} />
 {t("salesmanPremium.dash.days30")}
 {trafficReady && todayTotal > 0 && (
 <span style={{ color: C.successText, fontWeight: T.weight.semibold }}>· {t("salesmanPremium.dash.greenToday")}</span>
 )}
 </span>

 {/* ONE traffic chart, three waves. Views used to be the only series with
 a sparkline (it was the only one the page read a daily array for),
 which made the strip look like three dead tiles and one live one.
 WA taps come from w0..w6 on get_salesman_analytics — already returned,
 never read — and mini-page visits from get_salesman_minipage_daily.
 Live Listings is a count, not a time series, so it has no wave. */}
 {/* Hold the chart's space while loading, or it lands later and shoves
 the rest of the card down. */}
 {!trafficReady && <StatSkeleton width="100%" height={128} style={{ display: "block", marginTop: 14 }} />}
 {trafficReady && hasTrafficTrend && (
 <div style={{ marginTop: 14 }}>
 <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
 <span style={EYEBROW}>{t("salesmanPremium.dash.traffic7")}</span>
 <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
 {TRAFFIC_SERIES.map((sr) => (
 <span key={sr.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: T.size.sm, color: C.textMuted }}>
 <span style={{ width: 7, height: 7, borderRadius: "50%", background: sr.hue, flexShrink: 0 }} />
 {sr.label}
 </span>
 ))}
 </div>
 </div>
 <div style={{ height: 108, margin: "2px -6px 0" }}>
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={trafficTrend} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
 <defs>
 {TRAFFIC_SERIES.map((sr) => (
 <linearGradient key={sr.key} id={`spTraffic-${sr.key}`} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={sr.hue} stopOpacity={0.26} />
 <stop offset="100%" stopColor={sr.hue} stopOpacity={0} />
 </linearGradient>
 ))}
 </defs>
 <XAxis dataKey="day" tick={{ fill: C.textDim, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
 <RTooltip
 cursor={{ stroke: C.borderStrong, strokeWidth: 1 }}
 contentStyle={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: R.md, fontSize: T.size.sm, padding: "6px 10px" }}
 labelStyle={{ color: C.textMuted, fontSize: T.size.xs, marginBottom: 2 }}
 itemStyle={{ padding: 0 }}
 />
 {TRAFFIC_SERIES.map((sr) => (
 <Area key={sr.key} type="monotone" dataKey={sr.key} name={sr.label}
 stroke={sr.hue} strokeWidth={2} fill={`url(#spTraffic-${sr.key})`}
 dot={false} activeDot={{ r: 3, strokeWidth: 0 }} isAnimationActive={false} />
 ))}
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}
 </>
 )}
 {/* Visits that came from a link someone passed on (Share button, copied
     link, WhatsApp, Telegram): shareVisits, detectChannel.js. All time, the
     same window as "Page visits". */}
 {profile?.slug && trafficReady && (
 <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: T.size.sm, color: C.textSec }}>
 <Share2 size={13} color="#a78bfa" style={{ flexShrink: 0 }} />
 <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: T.weight.semibold, color: C.text }}>{shareVisits(minipageStats.byChannel)}</span>
 <span>{t("salesmanPremium.dash.shareVisits")}</span>
 </div>
 )}
 {profile?.slug && (
 <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
 <button
 onClick={() => { navigator.clipboard.writeText(`https://xdrive.my/s/${profile.slug}`); toast.success(t("salesmanPremium.dash.linkCopied")); }}
 style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 0, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, cursor: "pointer", fontWeight: T.weight.medium, fontFamily: "inherit" }}
 >
 <LinkIcon size={11} />
 <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>xdrive.my/s/{profile.slug}</span>
 <span style={{ fontSize: T.size.xs, color: C.textMuted, flexShrink: 0 }}>{t("salesmanPremium.common.copy")}</span>
 </button>
 <a
 href={`/s/${profile.slug}`}
 target="_blank"
 rel="noopener noreferrer"
 // Counts as the "visit your mini page" starter task — same click,
 // same meaning as the card's own button.
 onClick={(e) => { if (onVisitMinipage) { e.preventDefault(); onVisitMinipage(); } }}
 title={t("salesmanPremium.dash.openMiniTitle")}
 style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 0, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: withAlpha(C.info, 0.07), border: `1px solid ${withAlpha(C.info, 0.2)}`, color: C.infoText, textDecoration: "none", fontWeight: T.weight.semibold, fontFamily: "inherit" }}
 >
 <ExternalLink size={11} />
 <span style={{ flex: 1 }}>{t("salesmanPremium.dash.viewMini")}</span>
 <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
 </a>
 <a
 href="/"
 target="_blank"
 rel="noopener noreferrer"
 title={t("salesmanPremium.dash.openMarketTitle")}
 style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 0, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, textDecoration: "none", fontWeight: T.weight.medium, fontFamily: "inherit" }}
 >
 <Store size={11} />
 <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("salesmanPremium.dash.viewMarket")}</span>
 <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
 </a>
 <ShareMenu
 baseUrl={`https://xdrive.my/s/${profile.slug}`}
 refSlug={profile.slug}
 waCaption={(url) => `Check out my car listings on XDrive:\n${url}`}
 dark
 label={t("salesmanPremium.dash.share")}
 style={{ flex: "1 1 120px", justifyContent: "center", padding: "9px 12px", fontSize: T.size.sm }}
 />
 </div>
 )}
 {/* Loan calculator, one tap from home: a new seller could not find it.
     Same as Lite: opens the mini page with the Live presentation (the
     calculator sellers use on camera) already open (?live=1,
     SalesmanProfilePage). */}
 {profile?.slug && <a
 href={`/s/${profile.slug}?live=1`}
 target="_blank"
 rel="noopener noreferrer"
 style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: withAlpha(C.accent, 0.08), border: `1.5px solid ${C.accent}`, color: C.text, textDecoration: "none", fontWeight: T.weight.semibold, fontFamily: "inherit" }}
 >
 <Calculator size={11} color={C.accent} />
 <span style={{ flex: 1 }}>{t("salesmanPremium.dash.loanCalculator")}</span>
 <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
 </a>}
 {minipageStats.byChannel.length > 0 && (
 <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
 <ChannelBreakdown
 rows={minipageStats.byChannel.map((r) => ({ channel: r.channel, views: Number(r.visits) || 0, enquiries: Number(r.card_clicks) || 0 }))}
 metric="views"
 title={t("salesmanPremium.dash.miniByPlatform")}
 viewsLabel={t("salesmanPremium.dash.visitsLower")}
 enquiriesLabel={t("salesmanPremium.dash.clicksLower")}
 compact
 />
 </div>
 )}
 </div>

 </div>

 {!startingOut ? (
 <>
 {/* Shortcut into the Sold tab. This used to be two buttons labelled
 "Customers" and "Handover" and nothing else — a noun is a menu item
 people skip, a number is a job. Both halves now live behind one
 destination that also owns a nav slot, so this is a shortcut, not the
 only way in. */}
 <button
 onClick={() => switchTab(handoverActive > 0 ? "handover" : "customers")}
 style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "16px 18px", borderRadius: R.lg, background: C.surface, border: `1px solid ${C.border}`, color: C.text, cursor: "pointer", fontFamily: "inherit" }}
 >
 <ClipboardList size={18} color={C.accent} style={{ flexShrink: 0 }} />
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.lg, fontWeight: T.weight.semibold }}>{t("salesmanPremium.tabs.sold")}</p>
 <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {soldSummary}
 </p>
 </div>
 <ChevronRight size={16} color={C.textDim} style={{ flexShrink: 0 }} />
 </button>

 {/* Dashboard body — 2-up grid on desktop, single column on mobile */}
 <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 16, alignItems: "start" }}>

 {/* Follow-up Needed */}
 {staleLeads.length > 0 && (
 <div className="sp-insight-card">
 <div style={CARD_HEADER}>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: R.sm, background: C.fillStrong, color: C.textMuted, flexShrink: 0 }}>
 <Bell size={12} strokeWidth={2.5} />
 </span>
 <span>{t("salesmanPremium.dash.followUpNeeded")}</span>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: R.pill, background: C.fillStrong, color: C.text, fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "0 5px" }}>{staleLeads.length}</span>
 </div>
 </div>
 <div>
 {staleLeads.slice(0, 8).map((lead, i, arr) => (
 <FollowUpRow
 key={lead.id}
 lead={lead}
 stageText={stageLabel(lead.stage || "new")}
 carText={lead.car_listings ? `${lead.car_listings.brand} ${lead.car_listings.model}` : t("salesmanPremium.dash.noCar")}
 onOpen={() => { setActiveTab("leads"); setActiveLeadStage(lead.stage); triggerGlow([lead.id]); }}
 onWA={() => pingWA(lead)}
 last={i === arr.length - 1}
 />
 ))}
 {staleLeads.length > 8 && (
 <button
 onClick={() => { setActiveTab("leads"); triggerGlow(staleLeads.map((l) => l.id)); }}
 style={{ display: "block", width: "100%", textAlign: "center", padding: "10px 18px", fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.textSec, background: C.fillSubtle, border: "none", borderTop: `1px solid ${C.line}`, cursor: "pointer", fontFamily: "inherit" }}
 >
 {t("salesmanPremium.dash.moreInPipeline", { n: staleLeads.length - 8 })}
 </button>
 )}
 </div>
 {!notifBannerDismissed && browserNotifPerm === 'default' && (
 <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderTop: `1px solid ${C.line}`, background: C.fillSubtle }}>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted, flex: 1 }}>{t("salesmanPremium.dash.notifyCold")}</p>
 <button onClick={requestBrowserNotif} style={{ ...SOFT(C.infoText), fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.semibold, fontFamily: "inherit" }}>{t("salesmanPremium.dash.enable")}</button>
 <button onClick={dismissNotifBanner} style={{ fontSize: T.size.lg, padding: "0 4px", background: "none", border: "none", color: C.textDim, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
 </div>
 )}
 </div>
 )}

 {/* Today's Agenda */}
 {hasAgenda && (
 <div className="sp-insight-card">
 <div style={CARD_HEADER}>
 <span>{t("salesmanPremium.dash.agenda")}</span>
 <span>{new Date().toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "short" })}</span>
 </div>
 <div style={{ padding: "6px 0" }}>
 {missedAppts.map((a) => (
 <div key={a.id} onClick={() => goToLeadForAppt(a)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, background: withAlpha(C.danger, 0.12), color: C.danger, flexShrink: 0 }}>
 <History size={13} strokeWidth={2.5} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.buyer_name || "—"}</p>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.dangerText }}>{t("salesmanPremium.dash.missedAppt")}{a.car_listings ? ` · ${a.car_listings.brand} ${a.car_listings.model}` : ""}</p>
 </div>
 <span style={{ fontSize: T.size.sm, color: C.dangerText, fontWeight: T.weight.semibold, flexShrink: 0 }}>{a.appointment_date ? new Date(a.appointment_date).toLocaleDateString(dateLocale, { day: "numeric", month: "short" }) : "—"}</span>
 </div>
 ))}
 {agendaAppts.map((a) => (
 <div key={a.id} onClick={() => goToLeadForAppt(a)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, background: withAlpha(C.info, 0.12), color: C.info, flexShrink: 0 }}>
 <Calendar size={13} strokeWidth={2.5} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.buyer_name || "—"}</p>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanPremium.stages.test_drive")}{a.car_listings ? ` · ${a.car_listings.brand} ${a.car_listings.model}` : ""}</p>
 </div>
 <span style={{ fontSize: T.size.sm, color: C.infoText, fontWeight: T.weight.semibold, flexShrink: 0 }}>{a.appointment_date ? new Date(a.appointment_date).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
 </div>
 ))}
 {agendaFollowUps.map((l) => (
 <div key={l.id} onClick={() => { setActiveTab("leads"); setActiveLeadStage(l.stage); triggerGlow([l.id]); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, background: withAlpha(C.warn, 0.12), color: C.warn, flexShrink: 0 }}>
 <Clock size={13} strokeWidth={2.5} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.buyer_name || "—"}</p>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanPremium.dash.scheduledFu")} · {l.car_listings ? `${l.car_listings.brand} ${l.car_listings.model}` : t("salesmanPremium.dash.noCar")}</p>
 </div>
 <span style={{ fontSize: T.size.sm, color: C.warnText, fontWeight: T.weight.semibold, flexShrink: 0 }}>{t("salesmanPremium.dash.today")}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* My Performance */}
 <div className="sp-insight-card" style={{ order: -1 }}>
 <div style={CARD_HEADER}>
 <span>{t("salesmanPremium.dash.myPerformance")}</span>
 <span>{t("salesmanPremium.dash.days30")}</span>
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: `1px solid ${C.line}` }}>
 {[
 { label: t("salesmanPremium.dash.views"), value: totalViews || 0, today: viewsTrend[6] || 0 },
 { label: t("salesmanPremium.dash.taps"), value: totalWATaps || 0, today: waTrend[6] || 0 },
 { label: "CVR", value: overallCVR !== null ? `${overallCVR}%` : "—", today: 0 },
 ].map(({ label, value, today }, i, arr) => (
 <div key={label} style={{ padding: "16px 18px", borderRight: i < arr.length - 1 ? `1px solid ${C.line}` : "none" }}>
 <p style={{ ...EYEBROW, margin: "0 0 4px" }}>{label}</p>
 <p style={{ ...STAT, margin: 0, fontSize: T.size.stat, display: "flex", alignItems: "baseline", gap: 5 }}>
 {trafficReady ? value : <StatSkeleton width={40} height={24} />}
 {trafficReady && today > 0 && (
 <span title={t("salesmanPremium.dash.nToday", { n: today })} style={{ fontSize: T.size.xs, fontWeight: T.weight.semibold, color: C.successText }}>+{today}</span>
 )}
 </p>
 </div>
 ))}
 </div>
 {trafficReady && listingStats.length > 0 && (
 <div>
 {[...listingStats].sort((a, b) => (b.cvr ?? -1) - (a.cvr ?? -1)).map(({ car, views, waTaps, cvr, viewsToday, waToday }, idx, arr) => {
 const isHot = views > 20 && cvr >= 10;
 const isWarm = !isHot && views > 5 && cvr >= 5;
 const img = car.images?.[0];
 return (
 <div key={car.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: ROW_LINE(idx < arr.length - 1) }}>
 {img ? (
 <img src={img} alt="" style={{ width: 40, height: 40, borderRadius: R.md, objectFit: "cover", flexShrink: 0 }} />
 ) : (
 <div style={{ width: 40, height: 40, borderRadius: R.md, background: C.fill, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
 <Car size={16} color={C.textDim} />
 </div>
 )}
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: "0 0 2px", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perfCarName(car)}</p>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>
 {t("salesmanPremium.dash.nViews", { count: views })}
 {viewsToday > 0 && <span style={{ color: C.successText, fontWeight: T.weight.semibold }}> +{viewsToday}</span>}
 {" · "}{t("salesmanPremium.dash.nWaTaps", { count: waTaps })}
 {waToday > 0 && <span style={{ color: C.successText, fontWeight: T.weight.semibold }}> +{waToday}</span>}
 </p>
 </div>
 <div style={{ textAlign: "right", flexShrink: 0 }}>
 <p style={{ margin: "0 0 3px", fontSize: T.size.base, fontWeight: T.weight.bold, color: cvr !== null ? cvrColor(cvr) : C.textDim }}>
 {cvr !== null ? `${cvr.toFixed(1)}%` : "—"}
 </p>
 {isHot && <span title={t("salesmanPremium.dash.hotTitle")} style={{ ...SOFT(C.successText), fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "1px 5px", borderRadius: R.sm, whiteSpace: "nowrap" }}>{t("salesmanPremium.dash.topViews")}</span>}
 {isWarm && <span title={t("salesmanPremium.dash.warmTitle")} style={{ ...SOFT(C.warnText), fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "1px 5px", borderRadius: R.sm, whiteSpace: "nowrap" }}>{t("salesmanPremium.dash.rising")}</span>}
 </div>
 </div>
 );
 })}
 </div>
 )}
 {listingStats.length === 0 && (
 <p style={{ margin: 0, padding: "16px 18px", fontSize: T.size.base, color: C.textMuted }}>{t("salesmanPremium.dash.noListingData")}</p>
 )}
 </div>

 {/* KPI strip — spans full grid width, top */}
 <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 10, order: -3, gridColumn: "1 / -1" }}>
 {[
 { label: t("salesmanPremium.common.pipeline"), value: activeLeads.length, accent: C.info, Icon: Users },
 { label: t("salesmanPremium.dash.liveListings"), value: myListings.filter(c => c.status === "available").length, accent: C.success, Icon: Car },
 { label: t("salesmanPremium.dash.followUps"), value: staleLeads.length, accent: staleLeads.length > 0 ? C.danger : C.textDim, Icon: Bell },
 { label: t("salesmanPremium.dash.todayAppts"), value: todayAppts, accent: C.info, Icon: Calendar },
 { label: t("salesmanPremium.dash.closed"), value: closedThisMonth.length, accent: C.success, Icon: CheckCircle },
 ].map(({ label, value, accent, Icon }) => (
 <div key={label} className="sp-insight-card" style={{ padding: "16px 14px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: R.md, background: withAlpha(accent, 0.12), color: accent }}>
 <Icon size={14} strokeWidth={2.5} />
 </span>
 <p style={{ ...STAT, margin: 0, fontSize: T.size.statLg }}>{leadsReady ? value : <StatSkeleton width={36} height={28} />}</p>
 <p style={{ ...EYEBROW, margin: 0 }}>{label}</p>
 </div>
 ))}
 </div>

 {/* The one call list. Sits directly under the KPI strip: the numbers say how
 the month is going, this says who to phone about it. Everything it shows
 already existed, spread over four tabs nobody opened. Ranking is in
 src/utils/thisWeek.js; the card folds and previews 4 rows so it never
 pushes the rest of the dashboard off screen. */}
 <ThisWeek leads={leads} customers={customers} nudges={dueNudges} packages={servicePackages}
 repName={profile?.full_name} onContacted={handleThisWeekContacted} loading={!leadsReady}
 style={{ order: -2, gridColumn: "1 / -1", marginBottom: 0 }} />

 {/* Goal */}
 <div className="sp-insight-card">
 <div style={CARD_HEADER}>
 <span>{t("salesmanPremium.dash.monthlyGoal")}</span>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <span>{t("salesmanPremium.dash.daysLeftIn", { n: daysLeft, month: new Date().toLocaleDateString(dateLocale, { month: "short" }) })}</span>
 <button
 onClick={() => setShowPrevMonth(true)}
 title={t("salesmanPremium.dash.prevMonthTitle")}
 style={{ fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "3px 8px", borderRadius: R.pill, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0 }}
 >
 {t("salesmanPremium.dash.prevMonth")}
 </button>
 </div>
 </div>
 <div style={{ padding: 18 }}>
 {goalEditing ? (
 <div>
 <p style={{ margin: "0 0 10px", fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanPremium.dash.setTarget", { month: new Date().toLocaleDateString(dateLocale, { month: "long" }) })}</p>
 <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
 <span style={{ fontSize: T.size.base, color: C.textSec, fontWeight: T.weight.semibold }}>RM</span>
 <input type="number" min="0" step="500" value={goalDraft} onChange={e => setGoalDraft(Number(e.target.value))}
 style={{ width: 100, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, borderRadius: R.sm, padding: "6px 10px", color: C.text, fontSize: T.size.lg, fontWeight: T.weight.bold, fontFamily: "inherit" }} autoFocus />
 <button onClick={() => { saveGoal({ target: goalDraft }); setGoalEditing(false); }} style={{ fontSize: T.size.base, padding: "6px 14px", borderRadius: R.sm, background: C.accent, border: "none", color: C.onAccent, cursor: "pointer", fontWeight: T.weight.semibold, fontFamily: "inherit" }}>{t("salesmanPremium.common.save")}</button>
 <button onClick={() => setGoalEditing(false)} style={{ fontSize: T.size.sm, padding: "6px 10px", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanPremium.common.cancel")}</button>
 </div>
 <p style={{ margin: "8px 0 0", fontSize: T.size.xs, color: C.textDim }}>{t("salesmanPremium.dash.commissionExplain")}</p>
 </div>
 ) : goal.target > 0 ? (
 <div>
 <p style={{ ...EYEBROW, margin: "0 0 2px" }}>{t("salesmanPremium.dash.commissionEarned")}</p>
 <div style={{ position: "relative", margin: "2px 0 4px" }}>
 <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", width: 180, height: 100, background: `radial-gradient(ellipse at center, ${withAlpha(C.accent, 0.22)}, transparent 72%)`, filter: "blur(14px)", pointerEvents: "none" }} />
 <svg width="100%" height="132" viewBox="0 0 240 132" style={{ position: "relative", display: "block" }}>
 <path d={`M ${gaugeCx - gaugeR},${gaugeCy} A ${gaugeR},${gaugeR} 0 0 1 ${gaugeCx + gaugeR},${gaugeCy}`} fill="none" stroke={C.fillStrong} strokeWidth="16" strokeLinecap="round" />
 <path d={`M ${gaugeCx - gaugeR},${gaugeCy} A ${gaugeR},${gaugeR} 0 0 1 ${gaugeCx + gaugeR},${gaugeCy}`} fill="none" stroke={C.accent} strokeWidth="16" strokeLinecap="round" pathLength="100" strokeDasharray={`${pct} 100`} />
 <circle cx={gaugePtX} cy={gaugePtY} r="9" fill={C.surface} />
 <circle cx={gaugePtX} cy={gaugePtY} r="6" fill="#fff" />
 <text x={gaugeCx} y={gaugeCy - 14} textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="46" fill={C.text}>
 RM {soldThisMonth.toLocaleString("en-MY")}
 </text>
 </svg>
 </div>
 {/* Below the arc, not inside the SVG: SVG text cannot wrap, and the BM line ran over the arc's end caps. */}
 <p style={{ margin: "0 0 8px", fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.textMuted, textAlign: "center" }}>
 {t("salesmanPremium.dash.ofGoal", { target: goal.target.toLocaleString("en-MY"), pct: Math.round(pct) })}
 </p>
 <p style={{ margin: "0 0 4px", fontSize: T.size.sm, color: C.textMuted, textAlign: "center" }}>{t("salesmanPremium.dash.carsSoldMonth", { count: soldCountThisMonth })}</p>
 {pct >= 100
 ? <p style={{ margin: "0 0 10px", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.successText }}>{t("salesmanPremium.dash.goalSmashed")}</p>
 : <p style={{ margin: "0 0 10px", fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanPremium.dash.toGo", { amount: (goal.target - soldThisMonth).toLocaleString("en-MY") })} · {daysLeft > 0 ? t("salesmanPremium.dash.daysLeft", { n: daysLeft }) : t("salesmanPremium.dash.lastDay")}</p>
 }
 {trendTotal > 0 && (
 <div style={{ marginBottom: 10 }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
 <p style={{ ...EYEBROW, margin: 0 }}>{t("salesmanPremium.dash.commission14")}</p>
 {trendDelta !== null && (
 <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: R.pill, fontSize: T.size.xs, fontWeight: T.weight.bold,
 background: withAlpha(trendDelta >= 0 ? C.success : C.danger, 0.12),
 color: trendDelta >= 0 ? C.successText : C.dangerText }}>
 {trendDelta >= 0 ? "↑" : "↓"} {Math.abs(trendDelta)}%
 </span>
 )}
 </div>
 <div style={{ height: 70, margin: "4px -8px -6px" }}>
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={commissionTrend} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
 <defs>
 <linearGradient id="spCommissionFill" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={C.accent} stopOpacity={0.32} />
 <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
 </linearGradient>
 </defs>
 <XAxis dataKey="d" hide />
 <RTooltip
 cursor={{ stroke: C.borderStrong }}
 contentStyle={{ background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, borderRadius: R.md, fontSize: T.size.sm }}
 labelStyle={{ color: C.textSec }}
 itemStyle={{ color: C.dangerText }}
 labelFormatter={(v) => {
 const [y, m, day] = v.split("-").map(Number);
 return new Date(y, m - 1, day).toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
 }}
 formatter={(v) => [`RM ${Number(v).toLocaleString("en-MY")}`, t("salesmanPremium.dash.commission")]}
 />
 <Area type="monotone" dataKey="val" stroke={C.accent} strokeWidth={2.5} fill="url(#spCommissionFill)" dot={false} activeDot={{ r: 5, fill: C.accent }} />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}
 <button onClick={() => { setGoalDraft(goal.target); setGoalEditing(true); }} style={{ fontSize: T.size.xs, padding: "3px 10px", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanPremium.dash.editTarget")}</button>
 </div>
 ) : (
 <button onClick={() => { setGoalDraft(5000); setGoalEditing(true); }} style={{ width: "100%", padding: "14px", borderRadius: R.md, background: withAlpha(C.accent, 0.06), border: `1px dashed ${withAlpha(C.accent, 0.2)}`, color: C.danger, fontSize: T.size.base, fontWeight: T.weight.semibold, cursor: "pointer", fontFamily: "inherit" }}>
 {t("salesmanPremium.dash.setGoal")}
 </button>
 )}

 {highlighted && (
 <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
 <p style={{ ...EYEBROW, margin: 0 }}>
 {focusCar ? <><Pin size={9} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />{t("salesmanPremium.dash.pinned")}</> : <><Zap size={9} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />{t("salesmanPremium.dash.bestToPush")}</>}
 </p>
 {focusCar && (
 <button onClick={() => saveGoal({ focusCarId: null })} style={{ fontSize: T.size.xs, padding: "2px 7px", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanPremium.dash.unpin")}</button>
 )}
 </div>
 <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
 {highlighted.images?.[0] ? (
 <img src={highlighted.images[0]} alt="" style={{ width: 52, height: 40, objectFit: "cover", borderRadius: R.md, flexShrink: 0, border: `1px solid ${C.line}` }} />
 ) : (
 <div style={{ width: 52, height: 40, borderRadius: R.md, background: C.fill, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Car size={18} color={C.textDim} /></div>
 )}
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {[highlighted.year, highlighted.brand, highlighted.model].filter(Boolean).join(" ")}
 </p>
 <p style={{ margin: "1px 0 0", fontSize: T.size.sm, color: C.textSec, fontWeight: T.weight.semibold }}>
 {highlighted.selling_price ? `RM ${Number(highlighted.selling_price).toLocaleString("en-MY")}` : "—"}
 </p>
 </div>
 <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
 <button onClick={() => handleListingCopy(highlighted, "wa")} style={{ ...SOFT(C.success), fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, cursor: "pointer", fontFamily: "inherit", fontWeight: T.weight.semibold }}>WA</button>
 {!focusCar && (
 <button onClick={() => saveGoal({ focusCarId: highlighted.id })} style={{ fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanPremium.dash.pin")}</button>
 )}
 </div>
 </div>
 {available.length > 1 && (
 <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
 {available.filter(c => c.id !== highlighted.id).slice(0, 4).map(c => (
 <button key={c.id} onClick={() => saveGoal({ focusCarId: c.id })} style={{ fontSize: T.size.xs, padding: "3px 9px", borderRadius: R.sm, background: C.fillSubtle, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {c.brand} {c.model}
 </button>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 </>
 ) : (
 // Starting out (SIMPLE-1): one quiet line instead of a Sold card, a
 // goal gauge, a call list and a KPI strip that are all zero until the
 // first buyer arrives. Says where those went so nothing feels missing.
 <p style={{ margin: "4px 2px 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.55 }}>
 {t("salesmanPremium.dash.startingOutNote")}
 </p>
 )}

 <SalesHistorySheet
 open={showPrevMonth}
 onClose={() => setShowPrevMonth(false)}
 listings={myListings}
 userId={profile?.id}
 profile={profile}
 dateLocale={dateLocale}
 isMobile={isMobile}
 />

 </div>
 );
}
