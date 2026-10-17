// Sales history: every car the seller has sold since they joined, month by
// month, with the views / WhatsApp taps / calls each car drew. Replaces the
// old one-month "Previous month" popup on the goal card. Download gives the
// same rows as a CSV the seller keeps: their record, not ours.
//
// Sold cars come from the page's own `myListings` (no new query). Traffic is
// one call to get_dealer_car_analytics, guarded on auth.uid(), all-time.
// Overlay rules: portalled, body scroll locked, no useModalHistory (rule 5).
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Eye, MessageCircle, Phone } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { panel as C, panelType as T, panelRadius as R } from "../../theme/tokens";
import { tp } from "./shared";
import { soldCars, groupByMonth, daysToSell, carName, salesCsv } from "../../utils/salesHistory";

const NUM = { fontVariantNumeric: "tabular-nums" };
const ALL_TIME_DAYS = 36500;
const rm = (n) => `RM ${(Number(n) || 0).toLocaleString("en-MY")}`;

export default function SalesHistorySheet({ open, onClose, listings, userId, profile, dateLocale, isMobile }) {
  const [stats, setStats] = useState(null); // null = loading, {} = loaded/failed
  const cars = useMemo(() => soldCars(listings), [listings]);
  const months = useMemo(() => groupByMonth(cars), [cars]);
  const total = cars.reduce((s, c) => s + (Number(c.commission_amount) || 0), 0);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !userId) return;
    let live = true;
    setStats(null);
    supabase.rpc("get_dealer_car_analytics", { p_dealer_id: userId, p_days: ALL_TIME_DAYS })
      .then(({ data, error }) => {
        if (!live) return;
        if (error) console.error("salesHistory stats:", error);
        const map = {};
        (data || []).forEach((r) => {
          map[r.car_id] = { views: Number(r.views) || 0, whatsapp: Number(r.whatsapp) || 0, calls: Number(r.calls) || 0, bookings: Number(r.bookings) || 0 };
        });
        setStats(map);
      });
    return () => { live = false; };
  }, [open, userId]);

  if (!open) return null;

  const since = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(dateLocale, { month: "long", year: "numeric" })
    : null;

  const download = () => {
    const headers = ["sold_date", "car", "plate", "selling_price", "base_price", "commission", "days_to_sell", "views", "whatsapp_taps", "calls", "bookings"];
    const blob = new Blob([salesCsv(cars, stats || {}, headers)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-history-${profile?.slug || "me"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const statLine = (car) => {
    const s = stats?.[car.id];
    const v = (n) => (stats ? (n || 0).toLocaleString("en-MY") : "–");
    return (
      <span style={{ display: "inline-flex", gap: 12, fontSize: T.size.sm, color: C.textMuted, ...NUM }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={tp("salesHistory.views")}><Eye size={12} />{v(s?.views)}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={tp("salesHistory.whatsapp")}><MessageCircle size={12} />{v(s?.whatsapp)}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={tp("salesHistory.calls")}><Phone size={12} />{v(s?.calls)}</span>
      </span>
    );
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: isMobile ? `${R.lg}px ${R.lg}px 0 0` : R.lg, width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column", fontFamily: "inherit" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: T.size.lg, fontWeight: T.weight.semibold, color: C.text }}>{tp("salesHistory.title")}</p>
            {since && <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textMuted }}>{tp("salesHistory.since", { date: since })}</p>}
          </div>
          <button onClick={onClose} aria-label={tp("common.close")} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "14px 18px 18px" }}>
          {/* Totals + download */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: T.size.xs, color: C.textMuted, textTransform: "uppercase", letterSpacing: T.track.label }}>{tp("salesHistory.carsSold")}</p>
                <p style={{ margin: 0, fontSize: T.size.stat, fontWeight: T.weight.bold, color: C.text, ...NUM }}>{cars.length}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: T.size.xs, color: C.textMuted, textTransform: "uppercase", letterSpacing: T.track.label }}>{tp("salesHistory.commission")}</p>
                <p style={{ margin: 0, fontSize: T.size.stat, fontWeight: T.weight.bold, color: C.text, ...NUM }}>{rm(total)}</p>
              </div>
            </div>
            {cars.length > 0 && (
              <button
                onClick={download}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.borderStrong}`, color: C.text, fontSize: T.size.sm, fontWeight: T.weight.semibold, cursor: "pointer", fontFamily: "inherit" }}
              >
                <Download size={13} /> {tp("salesHistory.download")}
              </button>
            )}
          </div>

          {months.length === 0 && (
            <p style={{ margin: "24px 0", fontSize: T.size.base, color: C.textSec, textAlign: "center" }}>{tp("salesHistory.empty")}</p>
          )}

          {months.map((m) => (
            <div key={m.key} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: T.size.xs, fontWeight: T.weight.bold, color: C.textMuted, textTransform: "uppercase", letterSpacing: T.track.label }}>
                  {m.date.toLocaleDateString(dateLocale, { month: "long", year: "numeric" })}
                </span>
                <span style={{ fontSize: T.size.sm, color: C.textSec, ...NUM }}>
                  {tp("salesHistory.monthLine", { count: m.cars.length, amount: rm(m.commission) })}
                </span>
              </div>
              {m.cars.map((car) => {
                const days = daysToSell(car);
                return (
                  <div key={car.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carName(car)}</p>
                      <p style={{ margin: "2px 0 4px", fontSize: T.size.sm, color: C.textSec, ...NUM }}>
                        {new Date(car.sold_at).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })} · {rm(car.selling_price)}
                        {days != null && ` · ${tp("salesHistory.daysToSell", { count: days })}`}
                      </p>
                      {statLine(car)}
                    </div>
                    <span style={{ fontSize: T.size.base, fontWeight: T.weight.bold, color: C.successText, whiteSpace: "nowrap", ...NUM }}>
                      +{rm(car.commission_amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
