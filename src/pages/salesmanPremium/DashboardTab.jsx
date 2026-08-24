import React from "react";
import {
 Bell, Calendar, Car, CheckCircle, ChevronRight, Clock, ExternalLink, Eye, History,
 Link as LinkIcon, MessageCircle, Pin, Store, UserCheck, Users, ClipboardList, Zap,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { normalizePhone } from "../../lib/phone";
import { panel as C, panelType as T, panelRadius as R, panelStageHue, withAlpha } from "../../theme/tokens";
import ShareMenu from "../../components/ShareMenu";
import ChannelBreakdown from "../../components/ChannelBreakdown";
import ThisWeek from "../../components/crm/ThisWeek";
import UpgradeBanner from "../../components/ai/UpgradeBanner";
import AiLoadingState from "../../components/ai/AiLoadingState";
import {
 CARD_HEADER, EYEBROW, STAT, SOFT, ROW_LINE, LEAD_STAGES, PrevMonthModal,
} from "./shared";

// Dashboard tab — split out of SalesmanPremium.jsx (was `renderDashboard`) so
// it lazy-loads instead of shipping in the initial bundle regardless of which
// tab the user opens. Body moved verbatim; only the wrapper (closure -> real
// component taking named props) and these imports are new.
export default function DashboardTab({
 leads, appointments, myListings, carStatsMap, enquiries, staleLeads, isReturning,
 goal, goalEditing, goalDraft, showPrevMonth, customers, dueNudges, profile,
 minipageStats, aiFollowups, followupsLoading, browserNotifPerm, notifBannerDismissed,
 isPremium, isMobile,
 setActiveTab, setMobileLeadStage, setGoalDraft, setGoalEditing, setShowPrevMonth,
 setShowAddForm, setAiFollowups, setInboxSubTab,
 saveGoal, triggerGlow, switchTab, pingWA, handleThisWeekContacted,
 fetchFollowupSuggestions, requestBrowserNotif, dismissNotifBanner, dismissTour,
 handleListingCopy,
}) {
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

 const listingStats = myListings.map((car) => {
 const s = carStatsMap[car.id] ?? {};
 const views = s.views || 0;
 const waTaps = s.enquiries || 0;
 const enqCount = enquiries.filter((e) => e.listing_id === car.id).length;
 const cvr = views > 0 ? (waTaps / views) * 100 : null;
 return { car, views, waTaps, enqCount, cvr };
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
 const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
 const trafficTrend = Array(7).fill(0).map((_, i) => {
 const d = new Date();
 d.setDate(d.getDate() - (6 - i));
 return {
 day: i === 6 ? "Today" : DAY_LABEL[d.getDay()],
 views: viewsTrend[i],
 visits: visitsTrend[i],
 waTaps: waTrend[i],
 };
 });
 const TRAFFIC_SERIES = [
 { key: "views", label: "Views", hue: C.info },
 { key: "visits", label: "Page Visits", hue: "#a78bfa" },
 { key: "waTaps", label: "WA Taps", hue: C.success },
 ];
 const hasTrafficTrend = trafficTrend.some((r) => r.views > 0 || r.visits > 0 || r.waTaps > 0);
 const overallCVR = totalViews > 0 ? ((totalWATaps / totalViews) * 100).toFixed(1) : null;
 const bestCVRStat = listingStats.reduce((best, s) => (s.cvr !== null && (best === null || s.cvr > best.cvr)) ? s : best, null);
 const cvrColor = (cvr) => cvr >= 10 ? C.success : cvr >= 5 ? C.warn : C.danger;
 const perfCarName = (car) => [car.year, car.brand, car.model].filter(Boolean).join(" ");
 const isNewUser = myListings.length === 0 && leads.length === 0;

 const STEP_CIRCLE = (done) => {
 const hue = done ? C.success : C.accent;
 return {
 width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
 fontSize: T.size.base, fontWeight: T.weight.bold,
 background: withAlpha(hue, 0.14),
 border: `1px solid ${withAlpha(hue, 0.24)}`,
 color: done ? C.success : C.danger,
 };
 };

 // Pipeline-stage accent hues + labels — colour-code the Follow-up rows so
 // you can see at a glance where each cold lead sits in the funnel.
 const stageHue = (s) => panelStageHue[s] || panelStageHue.fallback;
 const stageLabel = (s) => (s || "new").replace(/_/g, " ");

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
 if (lead) { setActiveTab("leads"); setMobileLeadStage(lead.stage); triggerGlow([lead.id]); }
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

 // Previous-month commission — feeds the "Previous month" popup so history
 // is one tap away instead of just disappearing at a month boundary.
 const soldInMonth = (year, month) => myListings.filter(c => {
 if (c.status !== "sold" || !c.sold_at) return false;
 const d = new Date(c.sold_at);
 return d.getFullYear() === year && d.getMonth() === month;
 });
 const prevMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
 const twoMonthsAgoDate = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1);
 const prevMonthSold = soldInMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
 const twoMonthsAgoSold = soldInMonth(twoMonthsAgoDate.getFullYear(), twoMonthsAgoDate.getMonth());
 const prevMonthCommission = prevMonthSold.reduce((s, c) => s + (Number(c.commission_amount) || 0), 0);
 const twoMonthsAgoCommission = twoMonthsAgoSold.reduce((s, c) => s + (Number(c.commission_amount) || 0), 0);
 const prevMonthTrendPct = twoMonthsAgoCommission > 0
 ? Math.round(((prevMonthCommission - twoMonthsAgoCommission) / twoMonthsAgoCommission) * 100)
 : (prevMonthCommission > 0 ? 100 : null);

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
 const TRAFFIC_STATS = [
 { label: "Views", value: totalViews || 0, Icon: Eye, hue: C.info },
 { label: "Page Visits", value: minipageStats.visits || 0, Icon: LinkIcon, hue: "#a78bfa" },
 { label: "WA Taps", value: totalWATaps || 0, Icon: MessageCircle, hue: C.success },
 { label: "Live Listings", value: available.length, Icon: Car, hue: null },
 ];
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
 return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
 })();
 const personalizedLine = isNewUser
 ? "Add your first car to start building your portfolio."
 : isReturning
 ? (staleLeads.length > 0
 ? `Welcome back! ${staleLeads.length} lead${staleLeads.length !== 1 ? "s" : ""} ready to reconnect.`
 : "Welcome back! Your pipeline is clear — good time to reach out to old buyers.")
 : staleLeads.length > 0
 ? `${staleLeads.length} lead${staleLeads.length !== 1 ? "s" : ""} waiting for follow-up — don't let a hot one go cold.`
 : todayAppts > 0
 ? `You have ${todayAppts} appointment${todayAppts !== 1 ? "s" : ""} today. Make it count.`
 : activeLeads.length > 0
 ? `${activeLeads.length} deal${activeLeads.length !== 1 ? "s" : ""} in motion right now.`
 : "Pipeline is clear — good time to feature a car or reach out to old buyers.";

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

 {/* AI: What to do today — Premium-only, kept from the old dashboard (not
 part of Lite's page, but a working paid feature with its own backend
 quota/generation wiring; deleting the call site would've left
 fetchFollowupSuggestions/aiFollowups dead). Flagging this in case you
 want it gone too. */}
 <div style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 12, padding: "14px 16px" }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <span style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>What to do today</span>
 </div>
 {isPremium && (
 <button
 onClick={fetchFollowupSuggestions}
 disabled={followupsLoading}
 style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5", cursor: "pointer" }}
 >
 {followupsLoading? "Loading..." : aiFollowups.length? "Refresh" : "Generate"}
 </button>
 )}
 </div>
 {!isPremium? (
 <UpgradeBanner feature="AI Follow-up Suggestions" />
 ) : followupsLoading? (
 <AiLoadingState text="AI sedang analisa leads anda..." />
 ) : aiFollowups.length === 0? (
 <p style={{ margin: 0, fontSize: 12, color: "#4b5563" }}>Klik Generate untuk cadangan susulan AI anda.</p>
 ) : (
 <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
 {aiFollowups.map((item, i) => (
 <div key={i} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, opacity: item.is_acted_on? 0.4 : 1 }}>
 <span style={{ fontSize: 18, flexShrink: 0 }}>{item.type === "call"? "" : item.type === "whatsapp"? "" : item.type === "visit"? "" : item.type === "offer"? "" : ""}</span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.lead.buyer_name || "—"}</p>
 <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>{item.suggestion}</p>
 </div>
 <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
 {item.lead.phone && (
 <button onClick={() => { const ph = item.lead.phone.replace(/\D/g,""); window.open(`https://wa.me/${ph.startsWith("6")? ph : "6"+ph}`, "_blank"); }} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}>WA</button>
 )}
 <button onClick={() => setAiFollowups((p) => p.map((x, j) => j === i? { ...x, is_acted_on: true } : x))} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Done</button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Hero: greeting + live portfolio snapshot */}
 <div className="sp-insight-card" style={{ padding: isMobile ? "20px 18px" : "26px 28px" }}>
 <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${withAlpha(C.accent, 0.14)} 0%, transparent 70%)`, pointerEvents: "none" }} />
 <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
 <div>
 <p style={{ margin: 0, fontSize: T.size.xl, fontWeight: T.weight.bold, color: C.text, letterSpacing: "-0.3px" }}>
 {greetingWord}, {profile?.full_name?.split(" ")[0] || "there"}.
 </p>
 <p style={{ margin: "5px 0 0", fontSize: T.size.base, color: C.textSec, maxWidth: 440 }}>
 {personalizedLine}
 </p>
 </div>
 {staleLeads.length > 0 && (
 <button
 onClick={() => {
 const activeStageOrder = LEAD_STAGES.filter((s) => !["lost", "closed_lost", "closed_won"].includes(s));
 const firstStaleStage = activeStageOrder.find((s) => staleLeads.some((l) => l.stage === s));
 if (firstStaleStage) setMobileLeadStage(firstStaleStage);
 switchTab("leads");
 triggerGlow(staleLeads.map((l) => l.id));
 }}
 style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: R.pill, background: withAlpha(C.danger, 0.08), border: `1px solid ${withAlpha(C.danger, 0.18)}`, flexShrink: 0, cursor: "pointer", fontFamily: "inherit" }}
 >
 <Bell size={11} color={C.danger} strokeWidth={2.5} />
 <span style={{ fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.dangerText }}>{staleLeads.length} overdue</span>
 </button>
 )}
 </div>
 {available.length > 0 && (
 <div style={{ position: "relative", marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
 {/* One row, always — four columns on a 375px phone and on desktop
 alike. It used to be a flex row with flexWrap, so on mobile the
 tiles broke into a ragged 2+2 and the strip read as a separate
 (broken) card instead of one line of numbers. */}
 <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
 {TRAFFIC_STATS.map(({ label, value, Icon, hue }, i) => (
 <div key={label} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, paddingLeft: i > 0 ? (isMobile ? 10 : 18) : 0, paddingRight: isMobile ? 6 : 12, borderLeft: i > 0 ? `1px solid ${C.line}` : "none" }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: R.sm, background: hue ? withAlpha(hue, 0.12) : C.fillStrong, color: hue || C.textMuted }}>
 <Icon size={11} strokeWidth={2.2} />
 </span>
 <span style={{ ...STAT, fontSize: isMobile ? T.size.stat : T.size.statLg, color: C.text, lineHeight: 1.1 }}>{value.toLocaleString("en-MY")}</span>
 <span style={{ ...EYEBROW, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
 </div>
 ))}
 </div>
 <span style={{ ...EYEBROW, display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, fontWeight: T.weight.normal }}>
 <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.success }} />
 30 days
 </span>

 {/* ONE traffic chart, three waves. Views used to be the only series with
 a sparkline (it was the only one the page read a daily array for),
 which made the strip look like three dead tiles and one live one.
 WA taps come from w0..w6 on get_salesman_analytics — already returned,
 never read — and mini-page visits from get_salesman_minipage_daily.
 Live Listings is a count, not a time series, so it has no wave. */}
 {hasTrafficTrend && (
 <div style={{ marginTop: 14 }}>
 <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
 <span style={EYEBROW}>Traffic — last 7 days</span>
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
 {profile?.slug && (
 <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
 <button
 onClick={() => { navigator.clipboard.writeText(`https://xdrive.my/s/${profile.slug}`); toast.success("Link copied!"); }}
 style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 0, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, cursor: "pointer", fontWeight: T.weight.medium, fontFamily: "inherit" }}
 >
 <LinkIcon size={11} />
 <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>xdrive.my/s/{profile.slug}</span>
 <span style={{ fontSize: T.size.xs, color: C.textMuted, flexShrink: 0 }}>Copy</span>
 </button>
 <a
 href={`/s/${profile.slug}`}
 target="_blank"
 rel="noopener noreferrer"
 title="Open your mini-page in a new tab"
 style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 0, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: withAlpha(C.info, 0.07), border: `1px solid ${withAlpha(C.info, 0.2)}`, color: C.infoText, textDecoration: "none", fontWeight: T.weight.semibold, fontFamily: "inherit" }}
 >
 <ExternalLink size={11} />
 <span style={{ flex: 1 }}>View your mini-page</span>
 <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
 </a>
 <a
 href="/"
 target="_blank"
 rel="noopener noreferrer"
 title="Open the XDrive marketplace in a new tab"
 style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 0, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, textDecoration: "none", fontWeight: T.weight.medium, fontFamily: "inherit" }}
 >
 <Store size={11} />
 <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>View XDrive marketplace</span>
 <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
 </a>
 <ShareMenu
 baseUrl={`https://xdrive.my/s/${profile.slug}`}
 refSlug={profile.slug}
 waCaption={(url) => `Check out my car listings on XDrive:\n${url}`}
 dark
 label="Share"
 style={{ flex: "1 1 120px", justifyContent: "center", padding: "9px 12px", fontSize: T.size.sm }}
 />
 </div>
 )}
 {minipageStats.byChannel.length > 0 && (
 <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
 <ChannelBreakdown
 rows={minipageStats.byChannel.map((r) => ({ channel: r.channel, views: Number(r.visits) || 0, enquiries: Number(r.card_clicks) || 0 }))}
 metric="views"
 title="Mini-page traffic by platform"
 viewsLabel="visits"
 enquiriesLabel="clicks"
 compact
 />
 </div>
 )}
 </div>
 )}

 </div>

 {/* Premium-only tabs — big, plain entry buttons (kept off the
 already-crowded bottom nav). */}
 <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
 {[
 { tab: "customers", label: "Customers", Icon: UserCheck },
 { tab: "handover", label: "Handover", Icon: ClipboardList },
 ].map(({ tab, label, Icon }) => (
 <button
 key={tab}
 onClick={() => switchTab(tab)}
 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "18px 14px", borderRadius: R.lg, background: C.surface, border: `1px solid ${C.border}`, color: C.text, cursor: "pointer", fontFamily: "inherit" }}
 >
 <Icon size={18} color={C.accent} />
 <span style={{ fontSize: T.size.lg, fontWeight: T.weight.semibold }}>{label}</span>
 </button>
 ))}
 </div>

 {/* Dashboard body — 2-up grid on desktop, single column on mobile */}
 <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 16, alignItems: "start" }}>

 {/* Follow-up Needed */}
 {staleLeads.length > 0 && (
 <div className="sp-insight-card">
 <div style={CARD_HEADER}>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: R.sm, background: withAlpha(C.danger, 0.12), color: C.danger, flexShrink: 0 }}>
 <Bell size={12} strokeWidth={2.5} />
 </span>
 <span>Follow-up Needed</span>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: R.pill, background: withAlpha(C.danger, 0.15), color: C.dangerText, fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "0 5px" }}>{staleLeads.length}</span>
 </div>
 </div>
 <div>
 {staleLeads.slice(0, 8).map((lead, i, arr) => {
 const car = lead.car_listings;
 const daysSince = Math.floor((Date.now() - new Date(lead.updated_at)) / 86400000);
 const hue = stageHue(lead.stage);
 return (
 <div
 key={lead.id}
 onClick={() => { setActiveTab("leads"); setMobileLeadStage(lead.stage); triggerGlow([lead.id]); }}
 style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: ROW_LINE(i < arr.length - 1), background: withAlpha(hue, 0.07), cursor: "pointer" }}
 >
 <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.fillStrong, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.textSec, flexShrink: 0 }}>
 {(lead.buyer_name || "?")[0].toUpperCase()}
 </div>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.buyer_name || "—"}</p>
 <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
 <span style={{ fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "1px 7px", borderRadius: R.sm, background: withAlpha(hue, 0.13), border: `1px solid ${withAlpha(hue, 0.33)}`, color: hue, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{stageLabel(lead.stage || "new")}</span>
 <span style={{ fontSize: T.size.sm, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{car ? `${car.brand} ${car.model}` : "No car"}</span>
 </div>
 </div>
 <span style={{ ...SOFT(C.dangerText), fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "3px 8px", borderRadius: R.pill, flexShrink: 0 }}>{daysSince}d ago</span>
 {lead.phone && (
 <button onClick={(e) => { e.stopPropagation(); pingWA(lead); }} style={{ ...SOFT(C.success), fontSize: T.size.sm, padding: "5px 12px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.semibold, flexShrink: 0, fontFamily: "inherit" }}>WA</button>
 )}
 </div>
 );
 })}
 {staleLeads.length > 8 && (
 <button
 onClick={() => { setActiveTab("leads"); triggerGlow(staleLeads.map((l) => l.id)); }}
 style={{ display: "block", width: "100%", textAlign: "center", padding: "10px 18px", fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.textSec, background: C.fillSubtle, border: "none", borderTop: `1px solid ${C.line}`, cursor: "pointer", fontFamily: "inherit" }}
 >
 +{staleLeads.length - 8} more in pipeline
 </button>
 )}
 </div>
 {!notifBannerDismissed && browserNotifPerm === 'default' && (
 <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderTop: `1px solid ${C.line}`, background: C.fillSubtle }}>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted, flex: 1 }}>Get notified when leads go cold</p>
 <button onClick={requestBrowserNotif} style={{ ...SOFT(C.infoText), fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.semibold, fontFamily: "inherit" }}>Enable</button>
 <button onClick={dismissNotifBanner} style={{ fontSize: T.size.lg, padding: "0 4px", background: "none", border: "none", color: C.textDim, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
 </div>
 )}
 </div>
 )}

 {/* Today's Agenda */}
 {hasAgenda && (
 <div className="sp-insight-card">
 <div style={CARD_HEADER}>
 <span>Today's Agenda</span>
 <span>{new Date().toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}</span>
 </div>
 <div style={{ padding: "6px 0" }}>
 {missedAppts.map((a) => (
 <div key={a.id} onClick={() => goToLeadForAppt(a)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, background: withAlpha(C.danger, 0.12), color: C.danger, flexShrink: 0 }}>
 <History size={13} strokeWidth={2.5} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.buyer_name || "—"}</p>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.dangerText }}>Missed appointment{a.car_listings ? ` · ${a.car_listings.brand} ${a.car_listings.model}` : ""}</p>
 </div>
 <span style={{ fontSize: T.size.sm, color: C.dangerText, fontWeight: T.weight.semibold, flexShrink: 0 }}>{a.appointment_date ? new Date(a.appointment_date).toLocaleDateString("en-MY", { day: "numeric", month: "short" }) : "—"}</span>
 </div>
 ))}
 {agendaAppts.map((a) => (
 <div key={a.id} onClick={() => goToLeadForAppt(a)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, background: withAlpha(C.info, 0.12), color: C.info, flexShrink: 0 }}>
 <Calendar size={13} strokeWidth={2.5} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.buyer_name || "—"}</p>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>Test drive{a.car_listings ? ` · ${a.car_listings.brand} ${a.car_listings.model}` : ""}</p>
 </div>
 <span style={{ fontSize: T.size.sm, color: C.infoText, fontWeight: T.weight.semibold, flexShrink: 0 }}>{a.appointment_date ? new Date(a.appointment_date).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
 </div>
 ))}
 {agendaFollowUps.map((l) => (
 <div key={l.id} onClick={() => { setActiveTab("leads"); setMobileLeadStage(l.stage); triggerGlow([l.id]); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, background: withAlpha(C.warn, 0.12), color: C.warn, flexShrink: 0 }}>
 <Clock size={13} strokeWidth={2.5} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.buyer_name || "—"}</p>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>Scheduled follow-up · {l.car_listings ? `${l.car_listings.brand} ${l.car_listings.model}` : "No car"}</p>
 </div>
 <span style={{ fontSize: T.size.sm, color: C.warnText, fontWeight: T.weight.semibold, flexShrink: 0 }}>Today</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* My Performance */}
 <div className="sp-insight-card" style={{ order: -1 }}>
 <div style={CARD_HEADER}>
 <span>My Performance</span>
 <span>30 days</span>
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: `1px solid ${C.line}` }}>
 {[
 { label: "Views", value: totalViews || 0 },
 { label: "WA Taps", value: totalWATaps || 0 },
 { label: "CVR", value: overallCVR !== null ? `${overallCVR}%` : "—" },
 ].map(({ label, value }, i, arr) => (
 <div key={label} style={{ padding: "16px 18px", borderRight: i < arr.length - 1 ? `1px solid ${C.line}` : "none" }}>
 <p style={{ ...EYEBROW, margin: "0 0 4px" }}>{label}</p>
 <p style={{ ...STAT, margin: 0, fontSize: T.size.stat }}>{value}</p>
 </div>
 ))}
 </div>
 {listingStats.length > 0 && (
 <div>
 {[...listingStats].sort((a, b) => (b.cvr ?? -1) - (a.cvr ?? -1)).map(({ car, views, waTaps, cvr }, idx, arr) => {
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
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>{views} view{views !== 1 ? "s" : ""} · {waTaps} WA tap{waTaps !== 1 ? "s" : ""}</p>
 </div>
 <div style={{ textAlign: "right", flexShrink: 0 }}>
 <p style={{ margin: "0 0 3px", fontSize: T.size.base, fontWeight: T.weight.bold, color: cvr !== null ? cvrColor(cvr) : C.textDim }}>
 {cvr !== null ? `${cvr.toFixed(1)}%` : "—"}
 </p>
 {isHot && <span title="High views and click-through — one of your best-performing ads" style={{ ...SOFT(C.successText), fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "1px 5px", borderRadius: R.sm, whiteSpace: "nowrap" }}>TOP VIEWS</span>}
 {isWarm && <span title="Views and click-through picking up" style={{ ...SOFT(C.warnText), fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "1px 5px", borderRadius: R.sm, whiteSpace: "nowrap" }}>RISING</span>}
 </div>
 </div>
 );
 })}
 </div>
 )}
 {listingStats.length === 0 && (
 <p style={{ margin: 0, padding: "16px 18px", fontSize: T.size.base, color: C.textMuted }}>No listing data yet — publish a car to start tracking.</p>
 )}
 </div>

 {/* KPI strip — spans full grid width, top */}
 <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 10, order: -3, gridColumn: "1 / -1" }}>
 {[
 { label: "Pipeline", value: activeLeads.length, accent: C.info, Icon: Users },
 { label: "Live Listings", value: myListings.filter(c => c.status === "available").length, accent: C.success, Icon: Car },
 { label: "Follow-ups", value: staleLeads.length, accent: staleLeads.length > 0 ? C.danger : C.textDim, Icon: Bell },
 { label: "Today's Appts", value: todayAppts, accent: C.info, Icon: Calendar },
 { label: "Closed", value: closedThisMonth.length, accent: C.success, Icon: CheckCircle },
 ].map(({ label, value, accent, Icon }) => (
 <div key={label} className="sp-insight-card" style={{ padding: "16px 14px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
 <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: R.md, background: withAlpha(accent, 0.12), color: accent }}>
 <Icon size={14} strokeWidth={2.5} />
 </span>
 <p style={{ ...STAT, margin: 0, fontSize: T.size.statLg }}>{value}</p>
 <p style={{ ...EYEBROW, margin: 0 }}>{label}</p>
 </div>
 ))}
 </div>

 {/* The one call list. Sits directly under the KPI strip: the numbers say how
 the month is going, this says who to phone about it. Everything it shows
 already existed, spread over four tabs nobody opened. Ranking is in
 src/utils/thisWeek.js; the card folds and previews 4 rows so it never
 pushes the rest of the dashboard off screen. */}
 <ThisWeek leads={leads} customers={customers} nudges={dueNudges}
 repName={profile?.full_name} onContacted={handleThisWeekContacted}
 style={{ order: -2, gridColumn: "1 / -1", marginBottom: 0 }} />

 {/* Goal */}
 <div className="sp-insight-card">
 <div style={CARD_HEADER}>
 <span>Monthly Goal</span>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <span>{daysLeft}d left in {new Date().toLocaleDateString("en-MY",{month:"short"})}</span>
 <button
 onClick={() => setShowPrevMonth(true)}
 title="This card only tracks the current month — see history"
 style={{ fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "3px 8px", borderRadius: R.pill, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0 }}
 >
 Previous month
 </button>
 </div>
 </div>
 <div style={{ padding: 18 }}>
 {goalEditing ? (
 <div>
 <p style={{ margin: "0 0 10px", fontSize: T.size.sm, color: C.textMuted }}>Set your commission target for {new Date().toLocaleDateString("en-MY", { month: "long" })}:</p>
 <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
 <span style={{ fontSize: T.size.base, color: C.textSec, fontWeight: T.weight.semibold }}>RM</span>
 <input type="number" min="0" step="500" value={goalDraft} onChange={e => setGoalDraft(Number(e.target.value))}
 style={{ width: 100, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, borderRadius: R.sm, padding: "6px 10px", color: C.text, fontSize: T.size.lg, fontWeight: T.weight.bold, fontFamily: "inherit" }} autoFocus />
 <button onClick={() => { saveGoal({ target: goalDraft }); setGoalEditing(false); }} style={{ fontSize: T.size.base, padding: "6px 14px", borderRadius: R.sm, background: C.accent, border: "none", color: C.onAccent, cursor: "pointer", fontWeight: T.weight.semibold, fontFamily: "inherit" }}>Save</button>
 <button onClick={() => setGoalEditing(false)} style={{ fontSize: T.size.sm, padding: "6px 10px", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
 </div>
 <p style={{ margin: "8px 0 0", fontSize: T.size.xs, color: C.textDim }}>Set commission per car in your Listings tab. Sold cars count toward this goal.</p>
 </div>
 ) : goal.target > 0 ? (
 <div>
 <p style={{ ...EYEBROW, margin: "0 0 2px" }}>Commission earned</p>
 <div style={{ position: "relative", margin: "2px 0 4px" }}>
 <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", width: 180, height: 100, background: `radial-gradient(ellipse at center, ${withAlpha(C.accent, 0.22)}, transparent 72%)`, filter: "blur(14px)", pointerEvents: "none" }} />
 <svg width="100%" height="176" viewBox="0 0 240 176" style={{ position: "relative" }}>
 <path d={`M ${gaugeCx - gaugeR},${gaugeCy} A ${gaugeR},${gaugeR} 0 0 1 ${gaugeCx + gaugeR},${gaugeCy}`} fill="none" stroke={C.fillStrong} strokeWidth="16" strokeLinecap="round" />
 <path d={`M ${gaugeCx - gaugeR},${gaugeCy} A ${gaugeR},${gaugeR} 0 0 1 ${gaugeCx + gaugeR},${gaugeCy}`} fill="none" stroke={C.accent} strokeWidth="16" strokeLinecap="round" pathLength="100" strokeDasharray={`${pct} 100`} />
 <circle cx={gaugePtX} cy={gaugePtY} r="9" fill={C.surface} />
 <circle cx={gaugePtX} cy={gaugePtY} r="6" fill="#fff" />
 <text x={gaugeCx} y={gaugeCy - 14} textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="46" fill={C.text}>
 RM {soldThisMonth.toLocaleString("en-MY")}
 </text>
 <text x={gaugeCx} y={gaugeCy + 10} textAnchor="middle" fontFamily="system-ui" fontSize="12" fontWeight="600" fill={C.textMuted}>
 of RM {goal.target.toLocaleString("en-MY")} goal &middot; {Math.round(pct)}% done
 </text>
 </svg>
 </div>
 <p style={{ margin: "0 0 4px", fontSize: T.size.sm, color: C.textMuted, textAlign: "center" }}>{soldCountThisMonth} car{soldCountThisMonth !== 1 ? "s" : ""} sold this month</p>
 {pct >= 100
 ? <p style={{ margin: "0 0 10px", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.successText }}>Goal smashed!</p>
 : <p style={{ margin: "0 0 10px", fontSize: T.size.sm, color: C.textMuted }}>RM {(goal.target - soldThisMonth).toLocaleString("en-MY")} to go · {daysLeft > 0 ? `${daysLeft}d left` : "last day!"}</p>
 }
 {trendTotal > 0 && (
 <div style={{ marginBottom: 10 }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
 <p style={{ ...EYEBROW, margin: 0 }}>Commission — last 14 days</p>
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
 return new Date(y, m - 1, day).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
 }}
 formatter={(v) => [`RM ${Number(v).toLocaleString("en-MY")}`, "Commission"]}
 />
 <Area type="monotone" dataKey="val" stroke={C.accent} strokeWidth={2.5} fill="url(#spCommissionFill)" dot={false} activeDot={{ r: 5, fill: C.accent }} />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}
 <button onClick={() => { setGoalDraft(goal.target); setGoalEditing(true); }} style={{ fontSize: T.size.xs, padding: "3px 10px", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Edit target</button>
 </div>
 ) : (
 <button onClick={() => { setGoalDraft(5000); setGoalEditing(true); }} style={{ width: "100%", padding: "14px", borderRadius: R.md, background: withAlpha(C.accent, 0.06), border: `1px dashed ${withAlpha(C.accent, 0.2)}`, color: C.danger, fontSize: T.size.base, fontWeight: T.weight.semibold, cursor: "pointer", fontFamily: "inherit" }}>
 + Set a monthly commission goal
 </button>
 )}

 {highlighted && (
 <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
 <p style={{ ...EYEBROW, margin: 0 }}>
 {focusCar ? <><Pin size={9} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />Pinned</> : <><Zap size={9} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />Best to push</>}
 </p>
 {focusCar && (
 <button onClick={() => saveGoal({ focusCarId: null })} style={{ fontSize: T.size.xs, padding: "2px 7px", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Unpin</button>
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
 <button onClick={() => saveGoal({ focusCarId: highlighted.id })} style={{ fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Pin</button>
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

 {/* Onboarding */}
 {isNewUser && !localStorage.getItem("sp_tour_done") && (
 <div className="sp-insight-card" style={{ border: `1px solid ${withAlpha(C.accent, 0.15)}` }}>
 <div style={CARD_HEADER}><span>Get Started</span></div>
 <div style={{ padding: 18 }}>
 <p style={{ margin: "0 0 16px", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>Here's how to make your first sale:</p>
 {[
 { num: 1, done: myListings.length > 0, title: "Add your first listing", sub: "Upload photos, set price, publish to XDrive marketplace.", ctaLabel: "Add Listing →", ctaAction: () => { switchTab("listings"); setTimeout(() => setShowAddForm(true), 100); }, locked: false },
 { num: 2, done: myListings.length > 0, title: "Share your listing link", sub: "Blast it on WhatsApp groups, Facebook, TikTok.", ctaLabel: "Go to Listings →", ctaAction: () => switchTab("listings"), locked: myListings.length === 0 },
 { num: 3, done: leads.length > 0, title: "Track your leads", sub: "Every enquiry auto-converts to a lead.", ctaLabel: "View Pipeline →", ctaAction: () => switchTab("leads"), locked: myListings.length === 0 },
 ].map((step, idx) => (
 <div key={step.num}>
 <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: idx > 0 ? "14px 0 0" : "0" }}>
 <div style={STEP_CIRCLE(step.done)}>{step.done ? "✓" : step.num}</div>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>{step.title}</p>
 <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.5 }}>{step.sub}</p>
 </div>
 {step.locked
 ? <span style={{ fontSize: T.size.xs, color: C.textDim, flexShrink: 0, paddingTop: 3 }}>Step 1 first</span>
 : <button onClick={step.ctaAction} style={{ ...SOFT(C.accent), color: C.danger, fontSize: T.size.sm, padding: "5px 12px", borderRadius: R.sm, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>{step.ctaLabel}</button>
 }
 </div>
 {idx < 2 && <div style={{ height: 1, background: C.line, margin: "14px 0 0" }} />}
 </div>
 ))}
 <button onClick={dismissTour} style={{ marginTop: 16, background: "none", border: "none", color: C.textDim, fontSize: T.size.xs, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Dismiss</button>
 </div>
 </div>
 )}
 </div>

 <PrevMonthModal
 open={showPrevMonth}
 onClose={() => setShowPrevMonth(false)}
 monthLabel={prevMonthDate.toLocaleDateString("en-MY", { month: "long", year: "numeric" })}
 commission={prevMonthCommission}
 count={prevMonthSold.length}
 trendPct={prevMonthTrendPct}
 trendLabel={twoMonthsAgoDate.toLocaleDateString("en-MY", { month: "short" })}
 />

 </div>
 );
}
