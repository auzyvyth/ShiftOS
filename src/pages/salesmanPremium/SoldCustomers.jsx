// The Sold tab's two connected pieces:
//   ComingUp      - one list of what needs doing after the win, across every
//                   buyer: an open handover, a renewal, an aftercare visit due.
//                   Sits above the Handover | Customers pills so both see it.
//   SoldCustomers - one card per buyer, read as a journey of three stages
//                   (Handover -> Renewals -> Aftercare). Each stage is a cell;
//                   tapping one opens it in place, so the card stays short.
//
// The stages feed each other, and the card says so instead of leaving the
// seller to work it out: renewal dates are filled by ticking the handover
// insurance / road tax step (trg_sync_customer_expiry), so a missing date
// points back at that step; an aftercare plan's visit schedule is what puts a
// buyer back in Coming up. All status reads come from utils/aftercare.js.
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarClock, ChevronRight, ClipboardList, MessageCircle, Phone, ShieldCheck, TrendingUp, Wrench,
} from "lucide-react";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";
import { CARD, SOFT } from "./shared";
import ServicePackages from "../../components/crm/ServicePackages";
import { aftercareSummary, buildComingUp, renewalSummary } from "../../utils/aftercare";
import { usablePhone, waLink } from "../../utils/thisWeek";

const OWNED_READY_Y = 3;
const VEHICLE_READY_Y = 5;
const carName = (c) => [c.car_year, c.car_brand, c.car_model].filter(Boolean).join(" ");
const firstName = (s) => String(s || "").trim().split(" ")[0] || "";

function useFmt() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ms") ? "ms-MY" : "en-MY";
  const date = (d, withYear = false) => (d ? new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) }) : "");
  return { t, date, locale };
}

// Hue per state, shared by the journey cells and the Coming up rows.
const HUE = { ok: C.successText, done: C.successText, active: C.successText, due: C.warnText, soon: C.warnText, overdue: C.dangerText, missing: C.textMuted, none: C.textMuted, open: C.warnText };

// ── Coming up ──────────────────────────────────────────────────────────────
export function ComingUp({ customers, handover, packagesByCustomer, onPick }) {
  const { t, date } = useFmt();
  const [showAll, setShowAll] = useState(false);
  const items = useMemo(() => buildComingUp({
    customers, handoverDeals: handover.deals, statusForLead: handover.statusForLead, packagesByCustomer,
  }), [customers, handover.deals, handover.statusForLead, packagesByCustomer]);

  const reason = (it) => {
    if (it.kind === "handover") {
      return it.next
        ? t("salesmanPremium.sold.cuHandoverNext", { p: Math.max(0, it.progress || 0), step: it.next, defaultValue: "Handover {{p}}% · next: {{step}}" })
        : t("salesmanPremium.sold.cuHandover", { p: Math.max(0, it.progress || 0), defaultValue: "Handover {{p}}%" });
    }
    if (it.kind === "renewal") {
      const what = it.renewal === "insurance" ? t("salesmanPremium.sold.insurance", { defaultValue: "Insurance" }) : t("salesmanPremium.sold.roadTax", { defaultValue: "Road tax" });
      return it.days < 0
        ? t("salesmanPremium.sold.cuExpired", { what, date: date(it.date), defaultValue: "{{what}} expired {{date}}" })
        : t("salesmanPremium.sold.cuDue", { what, date: date(it.date), n: it.days, defaultValue: "{{what}} due {{date}} · {{n}}d" });
    }
    if (it.kind === "service") {
      return it.days <= 0
        ? t("salesmanPremium.sold.cuServiceNow", { plan: it.plan, defaultValue: "{{plan}}: visit due now" })
        : t("salesmanPremium.sold.cuService", { plan: it.plan, date: date(it.date), defaultValue: "{{plan}}: visit due {{date}}" });
    }
    return t("salesmanPremium.sold.cuPlanEnding", { plan: it.plan, date: date(it.date), n: it.left, defaultValue: "{{plan}} ends {{date}} · {{n}} unused" });
  };
  const ICON = { handover: ClipboardList, renewal: ShieldCheck, service: Wrench, plan_ending: CalendarClock };
  const tone = (it) => (it.kind === "renewal" && it.days < 0 ? C.dangerText : it.kind === "handover" ? C.textSec : C.warnText);

  const shown = showAll ? items : items.slice(0, 4);
  return (
    <div style={{ ...CARD, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: items.length ? `1px solid ${C.line}` : "none" }}>
        <span style={{ fontSize: T.size.base, fontWeight: T.weight.bold, color: C.text }}>
          {t("salesmanPremium.sold.comingUp", { defaultValue: "Coming up" })}
          {items.length > 0 && <span style={{ color: C.textMuted, fontWeight: T.weight.semibold }}> · {items.length}</span>}
        </span>
        {items.length === 0 && (
          <span style={{ fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanPremium.sold.allClear", { defaultValue: "Nothing due. Every buyer is up to date." })}</span>
        )}
      </div>
      {shown.map((it, i) => {
        const Icon = ICON[it.kind];
        return (
          <button key={`${it.kind}-${it.customerId || it.leadId}`} onClick={() => onPick(it)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", background: "transparent", border: "none", borderTop: i ? `1px solid ${C.line}` : "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <span style={{ width: 30, height: 30, borderRadius: R.pill, background: C.fillStrong, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={14} color={tone(it)} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.name || t("salesmanPremium.sold.unknownBuyer", { defaultValue: "Unknown buyer" })}
              </span>
              <span style={{ display: "block", fontSize: T.size.sm + 1, color: tone(it), marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {reason(it)}
                {it.also?.length ? <span style={{ color: C.textMuted }}> · {t("salesmanPremium.sold.more", { n: it.also.length, defaultValue: "+{{n}} more" })}</span> : null}
              </span>
            </span>
            <ChevronRight size={14} color={C.textDim} style={{ flexShrink: 0 }} />
          </button>
        );
      })}
      {items.length > 4 && (
        <button onClick={() => setShowAll((v) => !v)}
          style={{ width: "100%", padding: "10px 14px", background: "transparent", border: "none", borderTop: `1px solid ${C.line}`, color: C.textSec, fontSize: T.size.sm + 1, fontWeight: T.weight.semibold, cursor: "pointer", fontFamily: "inherit" }}>
          {showAll ? t("salesmanPremium.sold.showLess", { defaultValue: "Show less" }) : t("salesmanPremium.sold.showAll", { n: items.length, defaultValue: "Show all {{n}}" })}
        </button>
      )}
    </div>
  );
}

// ── One buyer ──────────────────────────────────────────────────────────────
function JourneyCell({ label, value, sub, hue, active, onClick, last }) {
  return (
    <button onClick={onClick}
      style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "stretch", textAlign: "left", padding: "9px 10px", background: active ? C.fillStrong : "transparent", border: "none", borderRight: last ? "none" : `1px solid ${C.border}`, cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ display: "block", fontSize: T.size.xs, fontWeight: T.weight.semibold, color: C.textMuted, textTransform: "uppercase", letterSpacing: T.track.label }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: R.pill, background: hue, flexShrink: 0 }} />
        <span style={{ fontSize: T.size.sm + 1, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      </span>
      {sub && <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", fontSize: T.size.sm, lineHeight: 1.35, color: C.textMuted, marginTop: 2, overflow: "hidden" }}>{sub}</span>}
    </button>
  );
}

function BuyerCard({ c, hs, pkgs, open, setOpen, linked, repName, onOpenHandover, pkgProps }) {
  const { t, date, locale } = useFmt();
  const now = new Date();
  const ren = renewalSummary(c, now);
  const care = aftercareSummary(pkgs, now);
  const initials = (c.name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const insLabel = t("salesmanPremium.sold.insurance", { defaultValue: "Insurance" });
  const rtLabel = t("salesmanPremium.sold.roadTax", { defaultValue: "Road tax" });
  const kindLabel = (k) => (k === "insurance" ? insLabel : rtLabel);
  const car = carName(c);
  const me = firstName(repName);

  // Trade-up: who to call, never a valuation (no table holds a loan balance).
  const owned = c.purchase_date ? (now - new Date(c.purchase_date)) / 31557600000 : null;
  const vAge = c.car_year ? now.getFullYear() - Number(c.car_year) : null;
  const tradeUp = (owned !== null && owned >= OWNED_READY_Y) || (vAge !== null && vAge >= VEHICLE_READY_Y);

  // Handover cell
  const hValue = !hs ? t("salesmanPremium.sold.noChecklist", { defaultValue: "No checklist" })
    : hs.done ? t("salesmanPremium.sold.done", { defaultValue: "Done" })
    : `${Math.max(0, hs.progress || 0)}%`;
  const hSub = hs && !hs.done && hs.next ? hs.next.label : null;
  const hHue = !hs ? C.textMuted : hs.done ? C.successText : C.warnText;

  // Renewals cell: the soonest of the two dates. The date is the value (it is
  // what fits a third of a phone); which policy and how soon go underneath.
  const rValue = ren.soonest ? date(ren.soonest.date) : t("salesmanPremium.sold.notSet", { defaultValue: "Not set" });
  const rWhen = ren.key === "overdue" ? t("salesmanPremium.sold.overdue", { defaultValue: "overdue" })
    : ren.key === "due" ? t("salesmanPremium.sold.inDays", { n: ren.soonest.days, defaultValue: "in {{n}} days" }) : null;
  const rSub = ren.soonest
    ? [kindLabel(ren.soonest.kind), rWhen].filter(Boolean).join(" · ")
    : t("salesmanPremium.sold.setAtHandover", { defaultValue: "Set at handover" });

  // Aftercare cell
  const aValue = care.key === "none" ? t("salesmanPremium.sold.noPlan", { defaultValue: "No plan" })
    : care.key === "done" ? t("salesmanPremium.sold.done", { defaultValue: "Done" })
    : care.key === "due" ? t("salesmanPremium.sold.visitDue", { defaultValue: "Visit due" })
    : date(care.due);
  const aSub = care.key === "none" ? t("salesmanPremium.sold.addOne", { defaultValue: "Add one" })
    : care.pkg ? care.pkg.package_name : null;

  const remindText = (r) => t(r.key === "overdue" ? "salesmanPremium.sold.waRenewExpired" : "salesmanPremium.sold.waRenewDue", {
    who: firstName(c.name) || t("salesmanPremium.sold.there", { defaultValue: "there" }),
    me: me || "XDrive", what: kindLabel(r.kind).toLowerCase(), car: car || t("salesmanPremium.sold.yourCar", { defaultValue: "your car" }), date: date(r.date, true),
    defaultValue: r.key === "overdue"
      ? "Hi {{who}}, {{me}} here. The {{what}} on the {{car}} expired on {{date}}. Want me to help you sort the renewal?"
      : "Hi {{who}}, {{me}} here. The {{what}} on the {{car}} is due on {{date}}. Want me to help you sort the renewal?",
  });
  const tradeText = t("salesmanPremium.sold.waTrade", {
    who: firstName(c.name) || t("salesmanPremium.sold.there", { defaultValue: "there" }), me: me || "XDrive", car: car || t("salesmanPremium.sold.yourCar", { defaultValue: "your car" }),
    defaultValue: "Hi {{who}}, {{me}} here. You have had the {{car}} a while now. If you are thinking about changing, I can take a look at it and tell you your options. No obligation.",
  });

  const toggle = (s) => setOpen(open === s ? null : s);
  return (
    <div id={`customer-${c.id}`} style={{ ...CARD, ...(linked ? { borderColor: withAlpha(C.accent, 0.45) } : null) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 14px" }}>
        <div style={{ width: 36, height: 36, borderRadius: R.pill, flexShrink: 0, background: C.fillStrong, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: T.size.base, fontWeight: T.weight.bold, color: C.textSec }}>{initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: T.size.lg - 1, fontWeight: T.weight.bold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || t("salesmanPremium.sold.unknownBuyer", { defaultValue: "Unknown buyer" })}</p>
          <p style={{ margin: "2px 0 0", fontSize: T.size.sm + 1, color: C.textMuted, lineHeight: 1.4 }}>
            {car}{c.car_plate ? ` · ${c.car_plate}` : ""}{c.purchase_date ? ` · ${new Date(c.purchase_date).toLocaleDateString(locale, { month: "short", year: "numeric" })}` : ""}
          </p>
        </div>
        {c.phone && (
          <a href={`tel:${c.phone.replace(/\D/g, "")}`} aria-label={t("salesmanPremium.sold.call", { defaultValue: "Call" })}
            style={{ width: 34, height: 34, borderRadius: R.pill, border: `1px solid ${C.border}`, color: C.textSec, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Phone size={14} />
          </a>
        )}
      </div>

      {/* The journey. Three stages, left to right, in the order the buyer lives them. */}
      <div style={{ display: "flex", borderTop: `1px solid ${C.border}` }}>
        <JourneyCell label={t("salesmanPremium.sold.handover", { defaultValue: "Handover" })} value={hValue} sub={hSub} hue={hHue}
          active={false} onClick={() => (hs ? onOpenHandover(c.lead_id) : null)} />
        <JourneyCell label={t("salesmanPremium.sold.renewals", { defaultValue: "Renewals" })} value={rValue} sub={rSub} hue={HUE[ren.key]}
          active={open === "renewals"} onClick={() => toggle("renewals")} />
        <JourneyCell label={t("salesmanPremium.sold.aftercare", { defaultValue: "Aftercare" })} value={aValue} sub={aSub} hue={HUE[care.key]}
          active={open === "aftercare"} onClick={() => toggle("aftercare")} last />
      </div>

      {open === "renewals" && (
        <div style={{ padding: "4px 14px 12px", borderTop: `1px solid ${C.line}` }}>
          {ren.rows.map((r) => {
            const link = (r.key === "overdue" || r.key === "due") ? waLink(c.phone, remindText(r)) : null;
            return (
              <div key={r.kind} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ width: 7, height: 7, borderRadius: R.pill, background: HUE[r.key], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: T.size.base, color: C.text, fontWeight: T.weight.semibold }}>{kindLabel(r.kind)}</p>
                  <p style={{ margin: "1px 0 0", fontSize: T.size.sm + 1, color: r.key === "missing" ? C.textMuted : HUE[r.key] }}>
                    {r.key === "missing" ? t("salesmanPremium.sold.notSet", { defaultValue: "Not set" })
                      : r.key === "overdue" ? t("salesmanPremium.sold.expiredOn", { date: date(r.date, true), defaultValue: "Expired {{date}}" })
                      : t("salesmanPremium.sold.expiresOn", { date: date(r.date, true), defaultValue: "Expires {{date}}" })}
                  </p>
                </div>
                {link && (
                  <button onClick={() => window.open(link, "_blank")}
                    style={{ ...SOFT(C.successText), display: "inline-flex", alignItems: "center", gap: 5, fontSize: T.size.sm + 1, fontWeight: T.weight.bold, padding: "6px 10px", borderRadius: R.sm, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    <MessageCircle size={13} /> {t("salesmanPremium.sold.remind", { defaultValue: "Remind" })}
                  </button>
                )}
              </div>
            );
          })}
          {/* The link between stage 1 and 2: dates come from the handover steps. */}
          {ren.missing > 0 && (
            <p style={{ margin: "10px 0 0", fontSize: T.size.sm + 1, color: C.textSec, lineHeight: 1.5 }}>
              {t("salesmanPremium.sold.fromHandover", { defaultValue: "Dates fill in by themselves when you tick the insurance and road tax steps in the handover." })}{" "}
              {hs && (
                <button onClick={() => onOpenHandover(c.lead_id)} style={{ background: "none", border: "none", padding: 0, color: C.infoText, fontWeight: T.weight.semibold, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                  {t("salesmanPremium.sold.openHandover", { defaultValue: "Open handover" })}
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {open === "aftercare" && (
        <div style={{ padding: "10px 14px 13px", borderTop: `1px solid ${C.line}` }}>
          {/* Shared with the dealer Customers tab, see components/crm/ServicePackages */}
          <ServicePackages customer={c} packages={pkgs} theme="dark" {...pkgProps} />
        </div>
      )}

      {tradeUp && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderTop: `1px solid ${C.line}`, background: withAlpha(C.info, 0.05) }}>
          <TrendingUp size={13} color={C.infoText} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: T.size.sm + 1, color: C.textSec }}>
            {t("salesmanPremium.sold.tradeUp", { defaultValue: "Trade-up ready" })}
            <span style={{ color: C.textMuted }}> · {vAge >= VEHICLE_READY_Y ? t("salesmanPremium.sold.carAge", { n: vAge, defaultValue: "{{n}}-year-old car" }) : t("salesmanPremium.sold.ownedYears", { n: Math.floor(owned), defaultValue: "owned {{n}} years" })}</span>
          </p>
          {usablePhone(c.phone) && (
            <button onClick={() => window.open(waLink(c.phone, tradeText), "_blank")}
              style={{ ...SOFT(C.infoText), fontSize: T.size.sm, fontWeight: T.weight.bold, padding: "5px 9px", borderRadius: R.sm, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
              {t("salesmanPremium.sold.message", { defaultValue: "Message" })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SoldCustomers({
  customers, loading, handover, packagesByCustomer, pkgProps, focus, customerParam, repName, onOpenHandover,
}) {
  const { t } = useFmt();
  const [search, setSearch] = useState("");
  const [tradeOnly, setTradeOnly] = useState(false);
  const [openById, setOpenById] = useState({});

  // Arriving from Coming up: open the stage that row was about and bring the card into view.
  useEffect(() => {
    if (!focus?.id) return;
    setOpenById((m) => ({ ...m, [focus.id]: focus.section || null }));
    const id = setTimeout(() => document.getElementById(`customer-${focus.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    return () => clearTimeout(id);
  }, [focus]);

  const now = new Date();
  const isTrade = (c) => {
    const owned = c.purchase_date ? (now - new Date(c.purchase_date)) / 31557600000 : 0;
    const vAge = c.car_year ? now.getFullYear() - Number(c.car_year) : 0;
    return owned >= OWNED_READY_Y || vAge >= VEHICLE_READY_Y;
  };
  const tradeCount = customers.filter(isTrade).length;
  const q = search.trim().toLowerCase();
  const list = customers.filter((c) => (!q || `${c.name || ""} ${c.phone || ""} ${c.car_plate || ""}`.toLowerCase().includes(q)) && (!tradeOnly || isTrade(c)));

  if (loading) return <p style={{ color: C.textMuted, fontSize: 13 }}>{t("salesmanPremium.sold.loading", { defaultValue: "Loading customers..." })}</p>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t("salesmanPremium.sold.search", { defaultValue: "Search buyers" })}
          style={{ flex: 1, minWidth: 0, background: C.fillStrong, border: `1px solid ${C.border}`, borderRadius: R.md, padding: "10px 12px", color: C.text, fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        {tradeCount > 0 && (
          <button onClick={() => setTradeOnly((v) => !v)}
            style={{ flexShrink: 0, borderRadius: R.pill, padding: "8px 12px", fontSize: T.size.sm + 1, fontWeight: T.weight.bold, cursor: "pointer", fontFamily: "inherit",
              ...(tradeOnly ? SOFT(C.infoText) : { background: "transparent", border: `1px solid ${C.border}`, color: C.textSec }) }}>
            {t("salesmanPremium.sold.tradeUp", { defaultValue: "Trade-up ready" })} · {tradeCount}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <p style={{ textAlign: "center", color: C.textMuted, fontSize: 13, padding: "30px 0", lineHeight: 1.5 }}>
          {customers.length === 0
            ? t("salesmanPremium.sold.noCustomers", { defaultValue: "No buyers yet. They appear here by themselves once a deal is won." })
            : t("salesmanPremium.sold.noMatch", { defaultValue: "No buyers match." })}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((c) => (
            <BuyerCard key={c.id} c={c}
              hs={c.lead_id ? handover.statusForLead(c.lead_id) : null}
              pkgs={packagesByCustomer[c.id] || []}
              open={openById[c.id] || null}
              setOpen={(s) => setOpenById((m) => ({ ...m, [c.id]: s }))}
              linked={customerParam === c.id || focus?.id === c.id}
              repName={repName} onOpenHandover={onOpenHandover} pkgProps={pkgProps} />
          ))}
        </div>
      )}
    </div>
  );
}

