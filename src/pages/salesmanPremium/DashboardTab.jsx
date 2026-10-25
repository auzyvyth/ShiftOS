import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calculator, Car, ChevronRight } from "lucide-react";
import { normalizePhone } from "../../lib/phone";
import { premiumDark as P } from "../../theme/tokens";
import { ROOT_DOMAIN, SITE_URL } from "../../config/site";
import ShareMenu from "../../components/ShareMenu";
import ThisWeek from "../../components/crm/ThisWeek";
import StarterTasks, { hasBioLinkVisit } from "../../components/onboarding/StarterTasks";
import SalesHistorySheet from "./SalesHistorySheet";
import StatSkeleton from "../../components/ui/StatSkeleton";

// Dashboard tab (Salesman Premium). Rebuilt 2026-10-25 (SIMPLE-2) in the
// `premiumDark` palette: each fact is shown ONCE. It used to show follow-ups
// four times (pill, tile, card, This week), views + taps three times and live
// cars twice, in five colours. What went: the 7-day traffic chart and the
// platform breakdown (Analytics > Listings has both), the Follow-up card (This
// week is the one call list), the goal gauge + 14-day commission chart + "best
// car to push" box (the goal is a bar in "Sold this month"), Copy link and
// Marketplace buttons (the link pill opens the page, Share copies it).
// Mockup: https://claude.ai/artifact/98gAj72cBKupiYBkxWTNLc
export default function DashboardTab({
 leads, appointments, myListings, carStatsMap, enquiries, staleLeads, isReturning,
 goal, goalEditing, goalDraft, showPrevMonth, customers, dueNudges, profile, servicePackages,
 handoverActive, handoverNext,
 minipageStats, trafficReady = true, leadsReady = true,
 isMobile,
 setActiveTab, setActiveLeadStage, setGoalDraft, setGoalEditing, setShowPrevMonth,
 setShowAddForm, setInboxSubTab,
 saveGoal, triggerGlow, switchTab, handleThisWeekContacted,
 onVisitMinipage, starterHidden, starterTasksReady, onStarterDismiss, onEditBio, onEditPhoto, onVerify,
}) {
 const { t, i18n } = useTranslation();
 const dateLocale = i18n.language?.startsWith("ms") ? "ms-MY" : "en-MY";
 const closedStage = (s) => ["won", "closed_won", "lost", "closed_lost"].includes(s);
 const activeLeads = leads.filter((l) => !closedStage(l.stage));
 const isNewUser = myListings.length === 0 && leads.length === 0;
 // No buyer has reached this seller yet (SIMPLE-1): every card below the
 // greeting would be zeros, so only the greeting and the page link show.
 const startingOut = leads.length === 0 && customers.length === 0
 && (appointments || []).length === 0 && (enquiries || []).length === 0;

 // ── Today: a 7-day strip from today, tap a day to see its bookings ──────
 // Dates keyed on the LOCAL calendar (not UTC) so an early-morning booking
 // isn't bucketed into the wrong day.
 const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
 const todayKey = dayKey(new Date());
 const [pickedDay, setPickedDay] = useState(todayKey);
 const apptDay = (a) => a.appointment_date ? dayKey(new Date(a.appointment_date)) : null;
 const apptOpen = (s) => !["cancelled", "completed", "done", "no_show"].includes((s || "").toLowerCase());
 const fuKey = (v) => v ? (v.length <= 10 ? v.slice(0, 10) : dayKey(new Date(v))) : null;
 const openAppts = appointments.filter((a) => apptOpen(a.status));
 const openLeads = leads.filter((l) => !closedStage(l.stage));
 const busyDays = new Set([
 ...openAppts.map(apptDay),
 ...openLeads.map((l) => fuKey(l.follow_up_at)),
 ].filter(Boolean));
 const dayFmt = new Intl.DateTimeFormat(dateLocale, { weekday: "short" });
 const strip = Array.from({ length: 7 }, (_, i) => {
 const d = new Date();
 d.setDate(d.getDate() + i);
 const key = dayKey(d);
 return { key, name: i === 0 ? t("salesmanPremium.dash.today") : dayFmt.format(d), num: d.getDate(), busy: busyDays.has(key) };
 });
 // Missed = a past booking never closed out. Only shown on today's view.
 const missedAppts = pickedDay !== todayKey ? [] : openAppts
 .filter((a) => { const k = apptDay(a); return k && k < todayKey; })
 .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
 .slice(0, 5);
 const dayAppts = openAppts.filter((a) => apptDay(a) === pickedDay)
 .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
 const dayFollowUps = openLeads.filter((l) => fuKey(l.follow_up_at) === pickedDay);
 const carOf = (row) => row.car_listings ? `${row.car_listings.brand} ${row.car_listings.model}` : t("salesmanPremium.dash.noCar");
 // Appointments aren't joined to leads, so match by phone; fall back to the
 // Inbox bookings when there's no lead yet (an unconfirmed booking).
 const goToLeadForAppt = (a) => {
 const ph = normalizePhone(a.buyer_phone);
 const lead = ph ? leads.find((l) => normalizePhone(l.phone) === ph) : null;
 if (lead) { setActiveTab("leads"); setActiveLeadStage(lead.stage); triggerGlow([lead.id]); }
 else { switchTab("enquiries"); setInboxSubTab("bookings"); }
 };
 const goToLead = (l) => { setActiveTab("leads"); setActiveLeadStage(l.stage); triggerGlow([l.id]); };

 // ── The four numbers ─────────────────────────────────────────────────────
 // Index 6 of each 7-day series is TODAY (Malaysian calendar day, migration
 // 20260904f), shown as "+N today" only when something happened.
 const sumToday = (key) => Object.values(carStatsMap).reduce((s, v) => s + (Number(v[key]?.[6]) || 0), 0);
 const totalWATaps = Object.values(carStatsMap).reduce((s, v) => s + (v.enquiries || 0), 0);
 const now = new Date();
 const soldThisMonth = myListings.filter((c) => {
 if (c.status !== "sold" || !c.sold_at) return false;
 const d = new Date(c.sold_at);
 return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
 });
 const commission = soldThisMonth.reduce((s, c) => s + (Number(c.commission_amount) || 0), 0);
 const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
 const pct = goal.target > 0 ? Math.min((commission / goal.target) * 100, 100) : 0;

 // ── Top cars: most WhatsApp taps, then views ─────────────────────────────
 const available = myListings.filter((c) => c.status === "available");
 const topCars = available
 .map((car) => ({ car, views: carStatsMap[car.id]?.views || 0, taps: carStatsMap[car.id]?.enquiries || 0 }))
 .filter((r) => r.views > 0 || r.taps > 0)
 .sort((a, b) => b.taps - a.taps || b.views - a.views)
 .slice(0, 3);

 // ── Sold shortcut: says what is waiting, never just the tab name ─────────
 const renewalsDue = customers.filter((c) => {
 const due = (d) => d && (new Date(d) - Date.now()) / 86400000 <= 30;
 return due(c.road_tax_expiry) || due(c.insurance_expiry);
 }).length;
 const soldSummary = [
 handoverActive > 0 ? `${t("salesmanPremium.dash.handoversInProgress", { count: handoverActive })}${handoverNext ? ` · ${t("salesmanPremium.dash.next", { step: handoverNext })}` : ""}` : null,
 renewalsDue > 0 ? t("salesmanPremium.dash.renewalsDue", { count: renewalsDue }) : null,
 ].filter(Boolean).join(" · ")
 || (customers.length ? t("salesmanPremium.dash.buyersOnRecord", { count: customers.length }) : t("salesmanPremium.dash.soldEmpty"));

 const greetingWord = t(`salesmanPremium.greet.${now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}`);
 const todayAppts = openAppts.filter((a) => apptDay(a) === todayKey).length;
 const personalizedLine = isNewUser
 ? t("salesmanPremium.dash.lineNew")
 : isReturning
 ? (staleLeads.length > 0 ? t("salesmanPremium.dash.lineBackStale", { count: staleLeads.length }) : t("salesmanPremium.dash.lineBackClear"))
 : staleLeads.length > 0 ? t("salesmanPremium.dash.lineStale", { count: staleLeads.length })
 : todayAppts > 0 ? t("salesmanPremium.dash.lineAppts", { count: todayAppts })
 : activeLeads.length > 0 ? t("salesmanPremium.dash.lineDeals", { count: activeLeads.length })
 : t("salesmanPremium.dash.lineClear");
 const scrollToCalls = () => document.getElementById("sp-call-list")?.scrollIntoView({ behavior: "smooth", block: "start" });

 // ── Shared pieces ────────────────────────────────────────────────────────
 const card = { background: P.card, borderRadius: P.radius.card, padding: isMobile ? 18 : 22, minWidth: 0 };
 const h2 = { margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: P.text };
 const sub = { margin: "2px 0 0", fontSize: 12, color: P.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
 const rowBtn = { display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: P.radius.row, background: P.raised, border: "none", color: P.text, cursor: "pointer", fontFamily: "inherit" };
 const pageUrl = profile?.slug ? `${SITE_URL}/s/${profile.slug}` : null;

 const greeting = (
 <section style={{ gridArea: "hero", ...card, background: P.hero, padding: isMobile ? 22 : "28px 30px", display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: 16 }}>
 <div style={{ minWidth: 0 }}>
 <h1 style={{ margin: 0, fontSize: isMobile ? 26 : 30, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.12, color: P.text }}>
 {greetingWord}, {profile?.full_name?.split(" ")[0] || t("salesmanPremium.greet.there")}.
 </h1>
 <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.45, color: P.textSec, maxWidth: 520 }}>
 {/* It counts leads; "your pipeline is clear" before they load is false. */}
 {available.length === 0 && !isNewUser ? t("salesmanPremium.dash.emptyBody")
 : leadsReady ? personalizedLine : <StatSkeleton width="70%" height={16} />}
 </p>
 </div>
 {!startingOut && staleLeads.length > 0 && (
 <button type="button" className="pd-press" onClick={scrollToCalls}
 style={{ flexShrink: 0, height: 44, padding: "0 20px", borderRadius: P.radius.pill, background: P.text, color: P.card, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
 {t("salesmanPremium.dash.openCallList")}
 </button>
 )}
 </section>
 );

 const yourPage = pageUrl && (
 <section style={{ gridArea: "page", ...card, display: "flex", flexDirection: "column", gap: 12 }}>
 <h2 style={h2}>{t("salesmanPremium.dash.yourPage")}</h2>
 <div style={{ display: "flex", gap: 8 }}>
 {/* The pill IS the "open my page" button; it also ticks the
 "see your page" starter task (onVisitMinipage). */}
 <a href={`/s/${profile.slug}`} target="_blank" rel="noopener noreferrer" className="pd-press"
 title={t("salesmanPremium.dash.openPage")}
 onClick={(e) => { if (onVisitMinipage) { e.preventDefault(); onVisitMinipage(); } }}
 style={{ flex: 1, minWidth: 0, height: 44, display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRadius: P.radius.pill, background: P.raised, color: P.textSec, fontSize: 13, textDecoration: "none" }}>
 <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ROOT_DOMAIN}/s/{profile.slug}</span>
 <ChevronRight size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
 </a>
 <ShareMenu
 baseUrl={pageUrl}
 refSlug={profile.slug}
 waCaption={(url) => `Check out my car listings on XDrive:\n${url}`}
 dark
 label={t("salesmanPremium.dash.share")}
 style={{ height: 44, padding: "0 18px", borderRadius: P.radius.pill, background: P.accent, border: "none", color: P.onAccent, fontSize: 14 }}
 />
 </div>
 {/* Loan calculator, one tap from home: opens the Live presentation
 (?live=1, SalesmanProfilePage), the calculator sellers use on camera. */}
 <a href={`/s/${profile.slug}?live=1`} target="_blank" rel="noopener noreferrer" className="pd-press"
 style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderRadius: P.radius.pill, border: `1px solid ${P.line}`, color: P.text, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>
 <Calculator size={15} color={P.textSec} />
 <span style={{ flex: 1 }}>{t("salesmanPremium.dash.loanCalculator")}</span>
 <ChevronRight size={14} color={P.textMuted} />
 </a>
 </section>
 );

 const agendaRow = (key, onClick, lead, title, line, tone) => (
 <button key={key} type="button" className="pd-press" onClick={onClick}
 style={{ ...rowBtn, background: tone === "missed" ? "transparent" : P.raised, border: tone === "missed" ? `1px dashed ${P.line}` : "none" }}>
 <span style={{ width: 58, flexShrink: 0, fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: tone === "missed" ? P.accentText : P.text }}>{lead}</span>
 <span style={{ flex: 1, minWidth: 0 }}>
 <span style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
 <span style={{ ...sub, display: "block" }}>{line}</span>
 </span>
 </button>
 );
 const timeOf = (a) => a.appointment_date ? new Date(a.appointment_date).toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit" }) : "—";
 const shortDate = (a) => a.appointment_date ? new Date(a.appointment_date).toLocaleDateString(dateLocale, { day: "numeric", month: "short" }) : "—";
 const agendaEmpty = missedAppts.length === 0 && dayAppts.length === 0 && dayFollowUps.length === 0;

 const today = (
 <section style={{ gridArea: "today", ...card, display: "flex", flexDirection: "column", gap: 14 }}>
 <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
 <h2 style={h2}>{t("salesmanPremium.dash.today")}</h2>
 <span style={{ fontSize: 13, color: P.textSec }}>{now.toLocaleDateString(dateLocale, { month: "long", year: "numeric" })}</span>
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
 {strip.map((d) => {
 const on = d.key === pickedDay;
 return (
 <button key={d.key} type="button" aria-pressed={on} className="pd-press" onClick={() => setPickedDay(d.key)}
 style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 0", minWidth: 0, borderRadius: 16, border: "none", cursor: "pointer", fontFamily: "inherit", background: on ? P.text : "transparent", color: on ? P.card : P.text }}>
 <span style={{ fontSize: 11, opacity: on ? 0.8 : 0.7, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
 <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{d.num}</span>
 <span style={{ width: 4, height: 4, borderRadius: 2, background: d.busy ? P.accent : "transparent" }} />
 </button>
 );
 })}
 </div>
 <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
 {missedAppts.map((a) => agendaRow(`m${a.id}`, () => goToLeadForAppt(a), shortDate(a), a.buyer_name || "—", `${t("salesmanPremium.dash.missedAppt")} · ${carOf(a)}`, "missed"))}
 {dayAppts.map((a) => agendaRow(`a${a.id}`, () => goToLeadForAppt(a), timeOf(a), a.buyer_name || "—", `${t("salesmanPremium.stages.test_drive")} · ${carOf(a)}`))}
 {dayFollowUps.map((l) => agendaRow(`f${l.id}`, () => goToLead(l), l.follow_up_at?.length > 10 ? new Date(l.follow_up_at).toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit" }) : "", l.buyer_name || "—", `${t("salesmanPremium.dash.scheduledFu")} · ${carOf(l)}`))}
 {agendaEmpty && <p style={{ margin: 0, padding: "12px 2px", fontSize: 13, color: P.textMuted }}>{t("salesmanPremium.dash.nothingBooked")}</p>}
 </div>
 </section>
 );

 const tile = (label, value, foot, footUp, ready, extra) => (
 <div key={label} style={{ ...card, padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 8 }}>
 <span style={{ fontSize: 13, color: P.textSec }}>{label}</span>
 {ready
 ? <span style={{ fontSize: isMobile ? 36 : 42, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: P.text }}>{value.toLocaleString("en-MY")}</span>
 : <StatSkeleton width={56} height={isMobile ? 36 : 42} />}
 {foot && <span style={{ fontSize: 12, color: footUp ? P.up : P.textMuted, fontWeight: footUp ? 600 : 400 }}>{foot}</span>}
 {extra}
 </div>
 );
 const tapsToday = sumToday("waDaily");
 const visitsToday = Number(minipageStats.daily?.[6]) || 0;
 const goalBlock = goalEditing ? (
 <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
 <span style={{ fontSize: 12, color: P.textSec }}>RM</span>
 <input type="number" min="0" step="500" value={goalDraft} onChange={(e) => setGoalDraft(Number(e.target.value))} autoFocus
 aria-label={t("salesmanPremium.dash.setTarget", { month: now.toLocaleDateString(dateLocale, { month: "long" }) })}
 style={{ width: 84, minWidth: 0, height: 36, padding: "0 10px", borderRadius: 10, border: "none", background: P.raised, color: P.text, fontSize: 14, fontWeight: 600, fontFamily: "inherit" }} />
 <button type="button" onClick={() => { saveGoal({ target: goalDraft }); setGoalEditing(false); }}
 style={{ height: 36, padding: "0 12px", borderRadius: P.radius.pill, border: "none", background: P.accent, color: P.onAccent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanPremium.common.save")}</button>
 <button type="button" onClick={() => setGoalEditing(false)}
 style={{ height: 36, padding: "0 10px", borderRadius: P.radius.pill, border: "none", background: "transparent", color: P.textSec, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanPremium.common.cancel")}</button>
 </div>
 ) : goal.target > 0 ? (
 <>
 <span role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
 style={{ display: "block", height: 6, borderRadius: 3, background: P.raised, overflow: "hidden" }}>
 <span style={{ display: "block", width: `${pct}%`, height: 6, borderRadius: 3, background: P.accent }} />
 </span>
 <button type="button" onClick={() => { setGoalDraft(goal.target); setGoalEditing(true); }} title={t("salesmanPremium.dash.editTarget")}
 style={{ padding: 0, border: "none", background: "none", textAlign: "left", fontSize: 12, color: P.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
 {t("salesmanPremium.dash.goalLine", { earned: commission.toLocaleString("en-MY"), target: goal.target.toLocaleString("en-MY"), n: daysLeft })}
 </button>
 </>
 ) : (
 <button type="button" onClick={() => { setGoalDraft(5000); setGoalEditing(true); }}
 style={{ padding: 0, border: "none", background: "none", textAlign: "left", fontSize: 12, fontWeight: 600, color: P.accentText, cursor: "pointer", fontFamily: "inherit" }}>
 {t("salesmanPremium.dash.setGoal")}
 </button>
 );
 const stats = (
 <div className="pd-stats" style={{ gridArea: "stats", minWidth: 0 }}>
 {tile(t("salesmanPremium.dash.leadsLabel"), activeLeads.length, t("salesmanPremium.dash.inPipeline"), false, leadsReady)}
 {tile(t("salesmanPremium.dash.tapsShort"), totalWATaps, tapsToday > 0 ? `+${tapsToday} ${t("salesmanPremium.dash.today").toLowerCase()}` : t("salesmanPremium.dash.last30"), tapsToday > 0, trafficReady)}
 {tile(t("salesmanPremium.dash.visitsShort"), minipageStats.visits || 0, visitsToday > 0 ? `+${visitsToday} ${t("salesmanPremium.dash.today").toLowerCase()}` : t("salesmanPremium.dash.allTime"), visitsToday > 0, trafficReady)}
 {tile(t("salesmanPremium.dash.soldMonth"), soldThisMonth.length, null, false, true, <>
 {goalBlock}
 <button type="button" onClick={() => setShowPrevMonth(true)} title={t("salesmanPremium.dash.prevMonthTitle")}
 style={{ alignSelf: "flex-start", padding: 0, border: "none", background: "none", fontSize: 12, color: P.textSec, cursor: "pointer", fontFamily: "inherit" }}>
 {t("salesmanPremium.dash.prevMonth")} ›
 </button>
 </>)}
 </div>
 );

 const cars = topCars.length > 0 && (
 <section style={{ gridArea: "cars", ...card }}>
 <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
 <h2 style={h2}>{t("salesmanPremium.dash.topCars")}</h2>
 <button type="button" onClick={() => switchTab("analytics")}
 style={{ padding: 0, border: "none", background: "none", fontSize: 13, color: P.textSec, cursor: "pointer", fontFamily: "inherit" }}>
 {t("salesmanPremium.dash.allInAnalytics")} ›
 </button>
 </div>
 {topCars.map(({ car, views, taps }) => (
 <div key={car.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: `1px solid ${P.line}` }}>
 {car.images?.[0]
 ? <img src={car.images[0]} alt="" loading="lazy" style={{ width: 52, height: 40, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
 : <span style={{ width: 52, height: 40, borderRadius: 12, background: P.raised, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Car size={16} color={P.textMuted} /></span>}
 <span style={{ flex: 1, minWidth: 0 }}>
 <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {[car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ")}
 </span>
 <span style={{ ...sub, display: "block" }}>{t("salesmanPremium.dash.carMeta", { views: views.toLocaleString("en-MY"), taps })}</span>
 </span>
 </div>
 ))}
 </section>
 );

 const sold = (
 <button type="button" className="pd-press" onClick={() => switchTab(handoverActive > 0 ? "handover" : "customers")}
 style={{ gridArea: "sold", ...card, display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", border: "none", color: P.text, cursor: "pointer", fontFamily: "inherit" }}>
 <span style={{ flex: 1, minWidth: 0 }}>
 <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{t("salesmanPremium.tabs.sold")}</span>
 <span style={{ ...sub, display: "block", marginTop: 3 }}>{soldSummary}</span>
 </span>
 <ChevronRight size={16} color={P.textMuted} style={{ flexShrink: 0 }} />
 </button>
 );

 return (
 <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 16, color: P.text }}>
 {/* Press feedback on touch-down (apple-design: respond on pointer-down),
 no motion for people who asked for none. Layout areas: one column on
 a phone, two on a tablet, three on a wide screen. */}
 <style>{`
 .pd-press { transition: transform 120ms ease-out, filter 120ms ease-out; -webkit-tap-highlight-color: transparent; }
 .pd-press:active { transform: scale(0.97); filter: brightness(1.15); }
 @media (prefers-reduced-motion: reduce) { .pd-press, .pd-press:active { transition: none; transform: none; } }
 .pd-stats { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
 @media (min-width: 1100px) { .pd-stats { gap: 16px; grid-template-columns: repeat(4, minmax(0, 1fr)); } }
 .pd-grid { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr);
 grid-template-areas: "hero" "today" "stats" "calls" "page" "cars" "sold"; align-items: start; }
 @media (min-width: 768px) { .pd-grid { gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr));
 grid-template-areas: "hero hero" "stats stats" "today calls" "today page" "cars sold"; } }
 @media (min-width: 1240px) { .pd-grid { grid-template-columns: repeat(3, minmax(0, 1fr));
 grid-template-areas: "hero hero today" "stats stats today" "calls cars page" "calls cars sold"; } }
 `}</style>

 {/* Setup list stays first while it is not done (INTRO-1). */}
 {starterTasksReady && !starterHidden && (
 <StarterTasks
 premium
 t={t}
 profile={profile}
 listingCount={myListings.length}
 bioLinkSeen={hasBioLinkVisit(minipageStats.byChannel)}
 palette={{ surface: P.card, border: P.line, line: P.line, text: P.text, textMuted: P.textSec, textDim: P.textMuted, accent: P.accent, onAccent: P.onAccent, success: P.up }}
 onAddListing={() => { switchTab("listings"); setTimeout(() => setShowAddForm(true), 100); }}
 onVisitMinipage={onVisitMinipage}
 onEditPhoto={onEditPhoto}
 onVerify={onVerify}
 onEditBio={onEditBio}
 onDismiss={onStarterDismiss}
 />
 )}

 {startingOut ? (
 <>
 {greeting}
 {yourPage}
 <p style={{ margin: "4px 2px 0", fontSize: 13, color: P.textMuted, lineHeight: 1.55 }}>
 {t("salesmanPremium.dash.startingOutNote")}
 </p>
 </>
 ) : (
 <div className="pd-grid">
 {greeting}
 {today}
 {stats}
 {/* The one call list (src/utils/thisWeek.js). The "Open call list"
 button in the greeting scrolls here. */}
 <div id="sp-call-list" style={{ gridArea: "calls", minWidth: 0, scrollMarginTop: 72 }}>
 <ThisWeek leads={leads} customers={customers} nudges={dueNudges} packages={servicePackages}
 repName={profile?.full_name} onContacted={handleThisWeekContacted} loading={!leadsReady}
 style={{ ...card, border: "none", marginBottom: 0 }} />
 </div>
 {yourPage}
 {cars}
 {sold}
 </div>
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
