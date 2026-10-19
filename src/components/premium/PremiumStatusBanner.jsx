import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import PremiumPayBox from "./PremiumPayBox";

// Two quiet one-line banners around a standalone seller's paid-through date
// (profiles.plan_expires_at). Owner, 2026-10-19: "payment due banner, make it
// not annoying". So: one line, no modal, no colour until the last 3 days, and
// the close button hides it until tomorrow. The DB sends two pushes on top of
// this (sweep_premium_lapses: 3 days before, and on the day it ends).
//   PremiumDueBanner   - on Premium, from 7 days before the date.
//   PremiumEndedBanner - on Lite, after the date, while cars are locked or for
//                        14 days after it ended.
// Dark seller-panel surface.

const DAY = 86400000;
const todayKey = () => new Date().toISOString().slice(0, 10);

function useDismissedToday(key) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(key) === todayKey(); } catch { return false; }
  });
  const hide = () => {
    setHidden(true);
    try { localStorage.setItem(key, todayKey()); } catch { /* private mode */ }
  };
  return [hidden, hide];
}

const fmtDate = (d, lang) =>
  d.toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", { weekday: "short", day: "numeric", month: "short" });

// A standalone Premium seller on a paid-through date (not dealer-granted, not
// the legacy no-date flag).
function datedSolo(profile) {
  if (!profile || profile.role !== "salesman" || profile.dealer_id) return null;
  if (profile.plan !== "salesman_full" || !profile.plan_expires_at) return null;
  if (profile.payment_status === "received") return null;
  const d = new Date(profile.plan_expires_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

const shell = {
  display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", padding: "8px 12px",
  borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
};
const textStyle = { margin: 0, flex: 1, minWidth: 0, fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.5 };
const linkBtn = {
  padding: 0, border: "none", background: "none", color: "#f87171", fontSize: 12.5,
  fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
};
const closeBtn = {
  display: "flex", padding: 4, border: "none", background: "none", color: "#6b7280",
  cursor: "pointer", flexShrink: 0,
};

export function PremiumDueBanner({ profile }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hidden, hide] = useDismissedToday(`xd_premium_due_${profile?.id}`);
  const end = datedSolo(profile);
  if (!end || hidden) return null;
  const left = end.getTime() - Date.now();
  if (left <= 0 || left > 7 * DAY) return null;

  const days = Math.max(1, Math.ceil(left / DAY));
  const soon = days <= 3;
  const date = fmtDate(end, i18n.language);
  return (
    <div style={{ margin: "0 0 12px" }}>
      <div style={{ ...shell, margin: 0 }}>
        {soon && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />}
        <p style={textStyle}>
          {soon
            ? t("premiumLapse.dueSoon", { count: days, date })
            : t("premiumLapse.paidUntil", { date })}
        </p>
        <button type="button" style={linkBtn} onClick={() => setOpen((o) => !o)}>
          {open ? t("premiumLapse.hide") : t("premiumLapse.renew")}
        </button>
        <button type="button" style={closeBtn} onClick={hide} aria-label={t("premiumLapse.close")}>
          <X size={14} />
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 8, padding: 14, borderRadius: 10, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)" }}>
          <PremiumPayBox profile={profile} />
        </div>
      )}
    </div>
  );
}

export function PremiumEndedBanner({ profile, lockedCount = 0, onRenew }) {
  const { t, i18n } = useTranslation();
  const [hidden, hide] = useDismissedToday(`xd_premium_ended_${profile?.id}`);
  const end = datedSolo(profile);
  if (!end || hidden) return null;
  const since = Date.now() - end.getTime();
  if (since <= 0) return null;
  if (lockedCount === 0 && since > 14 * DAY) return null;

  const date = fmtDate(end, i18n.language);
  return (
    <div style={shell}>
      <p style={textStyle}>
        {lockedCount > 0
          ? t("premiumLapse.endedLocked", { count: lockedCount, date })
          : t("premiumLapse.ended", { date })}
      </p>
      <button type="button" style={linkBtn} onClick={onRenew}>{t("premiumLapse.renew")}</button>
      <button type="button" style={closeBtn} onClick={hide} aria-label={t("premiumLapse.close")}>
        <X size={14} />
      </button>
    </div>
  );
}
