import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, MessageCircle, ChevronDown } from "lucide-react";
import { premiumDark as P } from "../../theme/tokens";
import { buildThisWeek, waLink } from "../../utils/thisWeek";
import StatSkeleton from "../ui/StatSkeleton";

// "This week" — the single call list, top of the salesman's home screen.
//
// The point is that a salesman opens the app and is told who to contact,
// instead of having to remember to go look on four different tabs. Everything
// here already existed; this is the one place it is finally shown together.
//
// A row is a HUMAN, not a reason — someone whose insurance lapsed AND who is
// trade-up ready is one call, one row. The extra reasons ride along under it.
//
// Nothing auto-sends. "Message" opens WhatsApp with the draft in it and the
// salesman presses send himself, same rule as the nudge queue.

// Four rows is the whole point of the preview: it sits under the KPI strip on
// the dashboard, so it has to read as a short call list, not a second page.
// Everything past the fourth row is one tap away behind "Show all".
const PREVIEW = 4;
const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export default function ThisWeek({ leads = [], customers = [], nudges = [], packages = [], repName = "", onContacted, style, loading = false }) {
  const [showAll, setShowAll] = useState(false);
  // The card folds to its header — a rep who has already worked the list today
  // shouldn't have to scroll past it to reach the rest of the dashboard.
  const [collapsed, setCollapsed] = useState(false);
  const [done, setDone] = useState(() => new Set());
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const items = useMemo(
    () => buildThisWeek({
      leads, customers, nudges, packages, repName,
      locale: lang?.startsWith("ms") ? "ms-MY" : "en-MY",
      tr: (id, vars, english) => t(`crm.thisWeek.why.${id}`, { ...vars, defaultValue: english }),
    }),
    // t changes identity with the language; lang is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, customers, nudges, packages, repName, lang],
  );
  const open = items.filter((i) => !done.has(i.id));
  const shown = showAll ? open : open.slice(0, PREVIEW);

  const markDone = (item) => {
    setDone((prev) => new Set(prev).add(item.id));
    onContacted?.(item);
  };

  const sendAndMark = (item) => {
    const url = waLink(item.phone, item.message);
    if (!url) return;
    // Opened straight from the click, before any await — a popup blocker eats
    // window.open otherwise.
    window.open(url, "_blank", "noopener");
    markDone(item);
  };

  return (
    <div style={{ background: P.card, borderRadius: P.radius.card, padding: 20, marginBottom: 16, ...style }}>
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        title={collapsed ? t("crm.thisWeek.showList") : t("crm.thisWeek.hideList")}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: collapsed ? 0 : 4, padding: 0, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <ChevronDown size={15} color={P.textMuted} style={{ flexShrink: 0, transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform .15s" }} />
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: P.text }}>{t("crm.thisWeek.title")}</span>
        </span>
        {open.length > 0 && (
          <span style={{ fontSize: 13, color: P.textSec, flexShrink: 0 }}>
            <span style={{ color: P.text, fontWeight: 600 }}>{open.length}</span> {t("crm.thisWeek.toContact")}
          </span>
        )}
      </button>

      {/* While leads load, "nothing waiting" would be a false all-clear. */}
      {collapsed ? null : loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          <StatSkeleton width="100%" height={44} />
          <StatSkeleton width="100%" height={44} />
        </div>
      ) : open.length === 0 ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: P.textMuted, lineHeight: 1.6 }}>
          {t("crm.thisWeek.empty")}
        </p>
      ) : (
        <>
          <p style={{ margin: "2px 0 8px", fontSize: 12, color: P.textMuted }}>
            {t("crm.thisWeek.intro")}
          </p>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {shown.map((item) => {
              const urgent = item.kind === "never_replied";
              const canSend = !!waLink(item.phone, item.message);
              return (
                <div key={item.id}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: `1px solid ${P.line}` }}>
                  <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 18, background: P.raised, color: P.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    {initials(item.name)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: urgent ? P.accentText : P.textSec }}>
                      {item.why}
                    </p>
                    {(item.sub || item.also?.length > 0) && (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: P.textMuted }}>
                        {[item.sub, ...(item.also || [])].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {canSend && (
                      <button onClick={() => sendAndMark(item)} title={t("crm.thisWeek.messageTitle")}
                        style={{ display: "flex", alignItems: "center", gap: 6, height: 36, fontSize: 13, fontWeight: 600, padding: "0 14px", borderRadius: P.radius.pill, background: "transparent", border: `1px solid ${P.line}`, color: P.text, cursor: "pointer", fontFamily: "inherit" }}>
                        <MessageCircle size={13} /> {t("crm.thisWeek.message")}
                      </button>
                    )}
                    <button onClick={() => markDone(item)} title={t("crm.thisWeek.handledTitle")}
                      aria-label={t("crm.thisWeek.markHandled", { name: item.name })}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 18, background: P.raised, border: "none", color: P.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                      <Check size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {open.length > PREVIEW && (
            <button onClick={() => setShowAll((v) => !v)}
              style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: P.textSec, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
              <ChevronDown size={13} style={{ transform: showAll ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              {showAll ? t("crm.thisWeek.showFewer") : t("crm.thisWeek.showAll", { n: open.length })}
            </button>
          )}
        </>
      )}
    </div>
  );
}
