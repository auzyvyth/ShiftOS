import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, MessageCircle, ChevronDown } from "lucide-react";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";
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
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 16, marginBottom: 16, ...style }}>
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        title={collapsed ? t("crm.thisWeek.showList") : t("crm.thisWeek.hideList")}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: collapsed ? 0 : 4, padding: 0, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <ChevronDown size={15} color={C.textMuted} style={{ flexShrink: 0, transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform .15s" }} />
          <span style={{ fontSize: 17, fontWeight: T.weight.bold, color: C.text }}>{t("crm.thisWeek.title")}</span>
        </span>
        {open.length > 0 && (
          <span style={{ fontSize: T.size.sm, color: C.textMuted, flexShrink: 0 }}>
            <span style={{ color: C.dangerText, fontWeight: T.weight.bold }}>{open.length}</span> {t("crm.thisWeek.toContact")}
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
        <p style={{ margin: "10px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.6 }}>
          {t("crm.thisWeek.empty")}
        </p>
      ) : (
        <>
          <p style={{ margin: "0 0 12px", fontSize: T.size.sm, color: C.textMuted }}>
            {t("crm.thisWeek.intro")}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shown.map((item) => {
              const urgent = item.kind === "never_replied";
              const canSend = !!waLink(item.phone, item.message);
              return (
                <div key={item.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 11px", borderRadius: R.md, background: C.fill, border: `1px solid ${urgent ? withAlpha(C.danger, 0.22) : C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.bold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: urgent ? C.dangerText : C.textSec }}>
                      {item.why}
                    </p>
                    {(item.sub || item.also?.length > 0) && (
                      <p style={{ margin: "2px 0 0", fontSize: T.size.xs, color: C.textMuted }}>
                        {[item.sub, ...(item.also || [])].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {canSend && (
                      <button onClick={() => sendAndMark(item)} title={t("crm.thisWeek.messageTitle")}
                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "6px 10px", borderRadius: R.sm, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, color: C.text, cursor: "pointer", fontFamily: "inherit" }}>
                        <MessageCircle size={12} /> {t("crm.thisWeek.message")}
                      </button>
                    )}
                    <button onClick={() => markDone(item)} title={t("crm.thisWeek.handledTitle")}
                      aria-label={t("crm.thisWeek.markHandled", { name: item.name })}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
                      <Check size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {open.length > PREVIEW && (
            <button onClick={() => setShowAll((v) => !v)}
              style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 5, fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.textSec, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
              <ChevronDown size={13} style={{ transform: showAll ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              {showAll ? t("crm.thisWeek.showFewer") : t("crm.thisWeek.showAll", { n: open.length })}
            </button>
          )}
        </>
      )}
    </div>
  );
}
