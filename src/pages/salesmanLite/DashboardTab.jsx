import React from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight, Bell, Calculator, Car, ChevronRight, Clock, ExternalLink,
  Link as LinkIcon, Lock, MessageCircle, Package, Store,
} from "lucide-react";
import { premiumDark as P } from "../../theme/tokens";
import { ROOT_DOMAIN, SITE_URL } from "../../config/site";
import ShareMenu from "../../components/ShareMenu";
import ChannelBreakdown from "../../components/ChannelBreakdown";
import StarterTasks from "../../components/onboarding/StarterTasks";
import SilentCarCard from "../../components/coach/SilentCarCard";
import StatSkeleton from "../../components/ui/StatSkeleton";

// Dashboard tab (Salesman Lite). Redesigned 2026-11-01 in the `premiumDark`
// palette, the same language as Salesman Premium's Dashboard
// (src/pages/salesmanPremium/DashboardTab.jsx): depth by tone, no borders, one
// red fill, mint as the only green, no blue / amber chips.
//
// PRESENTATION ONLY. Every number, handler and rule still lives in
// SalesmanLite.jsx `renderDashboard`; this file just draws what it is handed.
// Every control the old dashboard had is still here (stale pill, copy link,
// view mini page, marketplace, share, loan calculator, chat, services, both
// Premium rows, every agenda row, starter tasks, silent-car card).
// What went: each fact now shows ONCE. Views, WhatsApp taps and live cars were
// each on the dashboard two or three times (hero row, KPI strip, "My
// Performance"); follow-ups were a pill, a tile and a Premium row.
export default function DashboardTab({
  isMobile,
  profile,
  leadsReady, statsReady, startingOut,
  headline, noLiveCars,
  staleCount, onStaleClick,
  numbers,                                  // { pipeline, live, closedMonth, views, taps, cvr, visits }
  missedAppts, agendaAppts, agendaFollowUps, onApptClick, onFollowUpClick,
  listingStats, carName,
  channelRows, onCopyLink, onOpenMinipage,
  chatUnread, onChat, onServices,
  onPremium,
  showStarter, listingCount, bioLinkSeen, onAddListing, onDismissStarter,
  showSilent, silentPick, onShowMe,
}) {
  const { t, i18n } = useTranslation();
  const n = (v) => Number(v || 0).toLocaleString("en-MY");

  // ── Shared pieces ──────────────────────────────────────────────────────────
  const card = { background: P.card, borderRadius: P.radius.card, padding: isMobile ? 18 : 22, minWidth: 0 };
  const h2 = { margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: P.text };
  const sub = { margin: "2px 0 0", fontSize: 12, color: P.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const rowBtn = { display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: P.radius.row, background: P.raised, border: "none", color: P.text, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", boxSizing: "border-box" };
  const pageUrl = profile?.slug ? `${SITE_URL}/s/${profile.slug}` : null;
  const carLine = (row) => (row.car_listings ? `${row.car_listings.brand} ${row.car_listings.model}` : t("salesmanLite.dash.noCar"));
  const timeOf = (a) => (a.appointment_date ? new Date(a.appointment_date).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" }) : "—");
  const dateOf = (a) => (a.appointment_date ? new Date(a.appointment_date).toLocaleDateString("en-MY", { day: "numeric", month: "short" }) : "—");

  // ── Greeting ───────────────────────────────────────────────────────────────
  const greeting = (
    <section style={{ order: 1, ...card, background: P.hero, padding: isMobile ? 22 : "28px 30px", display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3, color: P.text, maxWidth: 560 }}>
          {leadsReady ? headline : <StatSkeleton width="70%" height={16} />}
        </p>
        {noLiveCars && (
          /* The setup list owns the "add a car" button; this only says why the
             page is quiet, so there is one ask on screen, not two. */
          <p style={{ margin: "8px 0 0", fontSize: 13, color: P.textSec, lineHeight: 1.5, maxWidth: 520 }}>
            {t("salesmanLite.dash.noListingsBody")}
          </p>
        )}
      </div>
      {staleCount > 0 && (
        <button type="button" className="ld-press" onClick={onStaleClick}
          style={{ flexShrink: 0, height: 44, padding: "0 18px", display: "inline-flex", alignItems: "center", gap: 8, borderRadius: P.radius.pill, background: P.text, color: P.card, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <Bell size={14} strokeWidth={2.5} />
          {staleCount} {t("salesmanLite.kpi.overdue")}
        </button>
      )}
    </section>
  );

  // ── The four numbers ───────────────────────────────────────────────────────
  const tile = (label, value, foot, ready) => (
    <div key={label} style={{ ...card, padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, color: P.textSec }}>{label}</span>
      {ready
        ? <span style={{ fontSize: isMobile ? 36 : 42, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: P.text }}>{n(value)}</span>
        : <StatSkeleton width={56} height={isMobile ? 36 : 42} />}
      {foot && <span style={{ fontSize: 12, color: P.textMuted }}>{foot}</span>}
    </div>
  );
  const stats = (
    <div className="ld-stats" style={{ order: 2, minWidth: 0 }}>
      {tile(t("salesmanLite.kpi.pipeline"), numbers.pipeline, t("salesmanLite.dash.closedMonth", { n: numbers.closedMonth }), leadsReady)}
      {tile(t("salesmanLite.kpi.liveListings"), numbers.live, null, leadsReady)}
      {tile(t("salesmanLite.dash.views"), numbers.views, t("salesmanLite.dash.days30"), statsReady)}
      {tile(t("salesmanLite.dash.tapsShort"), numbers.taps, numbers.cvr !== null && numbers.cvr !== undefined ? `${t("salesmanLite.dash.cvr")} ${numbers.cvr}%` : t("salesmanLite.dash.days30"), statsReady)}
    </div>
  );

  // ── Today's agenda (hidden when there is nothing, like before) ────────────
  const agendaRow = (key, onClick, lead, title, line, missed) => (
    <button key={key} type="button" className="ld-press" onClick={onClick}
      style={{ ...rowBtn, background: missed ? "transparent" : P.raised, border: missed ? `1px dashed ${P.line}` : "none" }}>
      <span style={{ width: 58, flexShrink: 0, display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: missed ? P.accentText : P.text }}>
        {lead}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ ...sub, display: "block" }}>{line}</span>
      </span>
    </button>
  );
  const hasAgenda = missedAppts.length > 0 || agendaAppts.length > 0 || agendaFollowUps.length > 0;
  const agenda = hasAgenda && (
    <section style={{ order: 4, ...card, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h2 style={h2}>{t("salesmanLite.dash.todaysAgenda")}</h2>
        <span style={{ fontSize: 13, color: P.textSec }}>{new Date().toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {missedAppts.map((a) => agendaRow(`m${a.id}`, () => onApptClick(a), dateOf(a), a.buyer_name || "—", `${t("salesmanLite.dash.missedAppt")} · ${carLine(a)}`, true))}
        {agendaAppts.map((a) => agendaRow(`a${a.id}`, () => onApptClick(a), timeOf(a), a.buyer_name || "—", `${t("salesmanLite.dash.testDrive")} · ${carLine(a)}`))}
        {agendaFollowUps.map((l) => agendaRow(`f${l.id}`, () => onFollowUpClick(l), <Clock size={15} color={P.textSec} aria-hidden="true" />, l.buyer_name || "—", `${t("salesmanLite.dash.scheduledFollowUp")} · ${carLine(l)}`))}
      </div>
    </section>
  );

  // ── Your page: the link, Share, and the three jump-offs ───────────────────
  const linkRow = (key, { href, onClick, icon, label, title }) => (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer" title={title} className="ld-press"
      onClick={onClick}
      style={{ ...rowBtn, height: 44, padding: "0 16px", borderRadius: P.radius.pill, background: "transparent", border: `1px solid ${P.line}`, fontSize: 14, fontWeight: 500 }}>
      {icon}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <ChevronRight size={14} color={P.textMuted} style={{ flexShrink: 0 }} />
    </a>
  );
  const yourPage = pageUrl && (
    <section style={{ order: 3, ...card, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={h2}>{t("salesmanLite.dash.yourPage")}</h2>
      <div style={{ display: "flex", gap: 8 }}>
        {/* Tapping the pill copies the link (the old "Copy" button). */}
        <button type="button" className="ld-press" onClick={onCopyLink}
          style={{ flex: 1, minWidth: 0, height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderRadius: P.radius.pill, background: P.raised, color: P.textSec, border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          <LinkIcon size={13} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ROOT_DOMAIN}/s/{profile.slug}</span>
          <span style={{ flexShrink: 0, fontSize: 12, color: P.textMuted }}>{t("salesmanLite.dash.copy")}</span>
        </button>
        <ShareMenu
          baseUrl={pageUrl}
          refSlug={profile.slug}
          waCaption={(url) => `${t("salesmanLite.dash.shareMyListingsCaption")}:\n${url}`}
          dark
          label={t("salesmanLite.dash.share")}
          style={{ height: 44, padding: "0 18px", borderRadius: P.radius.pill, background: P.accent, border: "none", color: P.onAccent, fontSize: 14 }}
        />
      </div>
      {statsReady && (
        <p style={{ margin: 0, fontSize: 13, color: P.textSec }}>
          <span style={{ fontWeight: 600, color: P.text, fontVariantNumeric: "tabular-nums" }}>{n(numbers.visits)}</span> {t("salesmanLite.dash.pageVisits")}
        </p>
      )}
      {linkRow("mini", {
        href: `/s/${profile.slug}`,
        // Same click as the setup list's "Open my page": record it, or a
        // seller who used this link is still nagged to do what they just did.
        onClick: (e) => { e.preventDefault(); onOpenMinipage(); },
        title: t("salesmanLite.dash.openMinipageTitle"),
        icon: <ExternalLink size={15} color={P.textSec} style={{ flexShrink: 0 }} />,
        label: t("salesmanLite.dash.openMinipage"),
      })}
      {/* Loan calculator = the Live presentation, opened straight away (?live=1). */}
      {linkRow("calc", {
        href: `/s/${profile.slug}?live=1`,
        icon: <Calculator size={15} color={P.textSec} style={{ flexShrink: 0 }} />,
        label: t("salesmanLite.dash.loanCalculator"),
      })}
      {linkRow("market", {
        href: "/",
        title: t("salesmanLite.dash.openMarketplaceTitle"),
        icon: <Store size={15} color={P.textSec} style={{ flexShrink: 0 }} />,
        label: t("salesmanLite.dash.openMarketplace"),
      })}
      {channelRows.length > 0 && (
        <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${P.line}` }}>
          <ChannelBreakdown
            theme="premium"
            rows={channelRows}
            metric="views"
            title={t("salesmanLite.dash.minipageTrafficBy")}
            viewsLabel="visits"
            enquiriesLabel="clicks"
            compact
          />
        </div>
      )}
    </section>
  );

  // ── Chat + Services (kept off the nav, one tap from here) ─────────────────
  const shortcut = (tourId, onClick, Icon, label, dot) => (
    /* A raised key (`.ld-key`, style block below): one gradient + four shadows,
       pressed = gradient flips, shadow goes inside, key drops 2px. */
    <button key={tourId} type="button" data-tour-id={tourId} className="ld-key" onClick={onClick}
      style={{ minWidth: 0, minHeight: 56, padding: "0 18px", display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", borderRadius: 24, color: P.text, cursor: "pointer", fontFamily: "inherit", boxSizing: "border-box" }}>
      <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
        <Icon size={17} color={P.text} />
        {dot ? <span style={{ position: "absolute", top: -3, right: -4, width: 9, height: 9, borderRadius: "50%", background: P.accent, border: "2px solid #1d2027" }} /> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <ArrowRight size={16} color={P.textSec} style={{ flexShrink: 0 }} />
    </button>
  );
  const shortcuts = (
    <div style={{ order: 5, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: isMobile ? 12 : 16 }}>
      {shortcut("chat", onChat, MessageCircle, t("salesmanLite.tabs.chat"), !!chatUnread)}
      {shortcut("services", onServices, Package, t("salesmanLite.tabs.services", { defaultValue: "Services" }), false)}
    </div>
  );

  // ── Per-car traffic: top 5 by conversion; every car is on the Listings tab ─
  const topCars = [...listingStats].sort((a, b) => (b.cvr ?? -1) - (a.cvr ?? -1)).slice(0, 5);
  const cars = !startingOut && statsReady && topCars.length > 0 && (
    <section style={{ order: 6, ...card }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <h2 style={h2}>{t("salesmanLite.dash.myPerformance")}</h2>
        <span style={{ fontSize: 13, color: P.textSec }}>{t("salesmanLite.dash.days30")}</span>
      </div>
      {topCars.map(({ car, views, waTaps, cvr }) => (
        <div key={car.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: `1px solid ${P.line}` }}>
          {car.images?.[0]
            ? <img src={car.images[0]} alt="" loading="lazy" style={{ width: 52, height: 40, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
            : <span style={{ width: 52, height: 40, borderRadius: 12, background: P.raised, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Car size={16} color={P.textMuted} /></span>}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carName(car)}</span>
            <span style={{ ...sub, display: "block" }}>{t("salesmanLite.dash.carMeta", { views: n(views), taps: n(waTaps) })}</span>
          </span>
          {/* Mint = a strong car (10%+ of viewers tap). No amber / red scale. */}
          <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: cvr !== null && cvr >= 10 ? P.up : P.textSec }}>
            {cvr !== null ? `${cvr.toFixed(1)}%` : "—"}
          </span>
        </div>
      ))}
    </section>
  );

  // ── Premium rows (kept: they are how a Lite seller finds the upgrade) ─────
  const upsell = (key, title, line) => (
    <button key={key} type="button" className="ld-press" onClick={onPremium}
      style={{ ...card, padding: isMobile ? 16 : 18, display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", border: "none", color: P.text, cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 10, background: P.raised, flexShrink: 0 }}>
        <Lock size={14} color={P.textSec} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{title}</span>
        {line && <span style={{ display: "block", marginTop: 2, fontSize: 12, color: P.textSec, lineHeight: 1.5 }}>{line}</span>}
      </span>
      <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: P.accentText, whiteSpace: "nowrap" }}>{t("salesmanLite.premiumRow.cta")}</span>
    </button>
  );
  const upsells = !startingOut && (
    <div style={{ order: 7, display: "flex", flexDirection: "column", gap: isMobile ? 12 : 16 }}>
      {staleCount > 0 && upsell("fu", t("salesmanLite.premiumRow.followUpTitle", { count: staleCount }), t("salesmanLite.premiumRow.followUpSub"))}
      {upsell("commission", t("salesmanLite.premiumRow.commissionTitle"), t("salesmanLite.premiumRow.commissionSub"))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 16, color: P.text }}>
      {/* Press feedback on touch-down; none for people who asked for no motion.
          Layout: one column on a phone (sections ordered by `order`), two
          columns from 900px, where the wrappers stop being `contents`. */}
      <style>{`
        .ld-press { transition: transform 120ms ease-out, filter 120ms ease-out; -webkit-tap-highlight-color: transparent; }
        .ld-press:active { transform: scale(0.97); filter: brightness(1.15); }
        @media (prefers-reduced-motion: reduce) { .ld-press, .ld-press:active { transition: none; transform: none; } }
        .ld-key { -webkit-tap-highlight-color: transparent; transition: translate 90ms ease-out, box-shadow 90ms ease-out;
          background: linear-gradient(#262a32, #191c22);
          box-shadow: inset 0 1px 0 rgb(255 255 255 / .12), inset 0 -2px 0 rgb(0 0 0 / .35), 0 2px 3px rgb(0 0 0 / .5), 0 10px 26px rgb(0 0 0 / .45); }
        .ld-key:active { background: linear-gradient(#191c22, #262a32); box-shadow: inset 0 3px 6px rgb(0 0 0 / .45); translate: 0 2px; }
        .ld-key:focus-visible { outline: 2px solid ${P.textSec}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .ld-key { transition: none; } .ld-key:active { translate: none; } }
        .ld-stats { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .ld-grid { display: flex; flex-direction: column; gap: 12px; }
        .ld-col { display: contents; }
        @media (min-width: 900px) {
          .ld-stats { gap: 16px; }
          .ld-grid { display: grid; gap: 16px; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); align-items: start; }
          .ld-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        }
      `}</style>

      {/* Setup list stays first while it is not done (INTRO-1). Lite = 2 tasks. */}
      {showStarter && (
        <StarterTasks
          noBio
          t={t}
          profile={profile}
          listingCount={listingCount}
          bioLinkSeen={bioLinkSeen}
          palette={{ surface: P.card, border: P.line, line: P.line, text: P.text, textMuted: P.textSec, textDim: P.textMuted, accent: P.accent, onAccent: P.onAccent, success: P.up }}
          onAddListing={onAddListing}
          onVisitMinipage={onOpenMinipage}
          onDismiss={onDismissStarter}
        />
      )}

      {/* COACH-1: the car nobody has seen for 2+ days, and "Show me how". */}
      {showSilent && (
        <SilentCarCard
          pick={silentPick} lang={i18n.language}
          colors={{ card: P.card, radius: P.radius.card, text: P.text, sub: P.textSec, accent: P.accent, onAccent: P.onAccent }}
          onShowMe={onShowMe}
        />
      )}

      {startingOut ? (
        <>
          {greeting}
          {yourPage}
          <p style={{ order: 9, margin: "4px 2px 0", fontSize: 13, color: P.textMuted, lineHeight: 1.55 }}>
            {t("salesmanLite.dash.startingOutNote")}
          </p>
        </>
      ) : (
        <div className="ld-grid">
          <div className="ld-col">
            {greeting}
            {stats}
            {agenda}
            {cars}
          </div>
          <div className="ld-col">
            {yourPage}
            {shortcuts}
            {upsells}
          </div>
        </div>
      )}
    </div>
  );
}
