import { useEffect, useRef, useState } from "react";
import {
  Gauge, DollarSign, TrendingUp, CreditCard, Car, ClipboardCheck, UserCheck,
  FileText, MessageCircle, Check, Search, Bell, Globe, Activity,
} from "lucide-react";

// ─── Hero product showcase ────────────────────────────────────────────────────
// A coded replica of the dealer dashboard (DashboardPage Overview) with four
// floating cards, each one a real screen that answers one pain on this page:
//   lead toast   -> p3  every lead auto-logged + attributed   (CRM)
//   unit P&L     -> p1  real per-unit gross                   (StockTab P&L modal)
//   handover     -> p2  Malaysian transfer checklist          (PostSaleChecklist)
//   bank scores  -> p4  multi-bank HP approval scorecard      (HP Board)
// Coded rather than screenshotted: sharp at any size, no real dealer data, and
// labels mirror the live UI (NAV_GROUPS, OverviewTab, postSaleSteps.js).
// Figures are illustrative. The P&L arithmetic is the real formula and sums.
//
// Everything is drawn on a fixed 1100x660 canvas and scaled to fit, so the
// composition is identical at every width. On phones the floating cards are
// counter-scaled so they stay legible, and the two small ones are dropped.

const W = 1100, H = 660;
const INK = "#111827", MUTED = "#6b7280", LINE = "#e5e7eb", UP = "#059669", RED = "#dc2626";
const num = { fontVariantNumeric: "tabular-nums" };

const card = {
  background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14,
  boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 18px 48px -12px rgba(15,23,42,0.18)",
};
const micro = { fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED };

// ── Main frame: dealer dashboard Overview ──────────────────────────────────────
const NAV = [
  ["Reports", [[Gauge, "Overview", true], [DollarSign, "Revenue"], [TrendingUp, "Performance"]]],
  ["Sales", [[MessageCircle, "Leads / CRM"], [CreditCard, "HP Board"]]],
  ["Inventory", [[Car, "Inventory"], [Activity, "Market Demand"]]],
  ["Operations", [[ClipboardCheck, "Handover"], [UserCheck, "Customers"], [FileText, "Documents"]]],
  ["Growth", [[Globe, "Storefront"]]],
];

const KPIS = [
  ["Open Leads", "38", "Active pipeline"],
  ["Active Listings", "64", "6 stale 30d+"],
  ["MTD Units Sold", "17", "+21.4%", true],
  ["MTD Gross", "RM 142,860", "+12.8%", true],
];

const LEADS = [
  ["Hafiz R.", "Honda City 1.5 V 2019", "WhatsApp", "Test drive"],
  ["Mei Ling T.", "Toyota Vios 1.5 G 2020", "Marketplace", "Won"],
  ["Kumar S.", "Perodua Myvi 1.5 AV 2021", "Walk-in", "Negotiating"],
  ["Nurul A.", "Proton X50 1.5T 2022", "Referral", "New"],
];

function Dashboard() {
  return (
    <div style={{ ...card, borderRadius: 16, overflow: "hidden", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* browser chrome */}
      <div style={{ height: 34, flexShrink: 0, display: "flex", alignItems: "center", gap: 7, padding: "0 14px", background: "#f9fafb", borderBottom: `1px solid ${LINE}` }}>
        {["#fca5a5", "#fcd34d", "#86efac"].map((c) => <span key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />)}
        <div style={{ margin: "0 auto", width: 260, height: 20, borderRadius: 6, background: "#fff", border: `1px solid ${LINE}`, fontSize: 10.5, color: MUTED, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <Search size={10} /> xdrive.my/dashboard
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* sidebar */}
        <div style={{ width: 172, flexShrink: 0, borderRight: `1px solid ${LINE}`, padding: "16px 12px", background: "#fcfcfd" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, paddingLeft: 4 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: RED, color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(6deg)" }}>S</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: INK, letterSpacing: ".02em" }}>ShiftOS</span>
          </div>
          {NAV.map(([group, items]) => (
            <div key={group} style={{ marginBottom: 12 }}>
              <div style={{ ...micro, fontSize: 9, padding: "0 6px 5px" }}>{group}</div>
              {items.map(([Icon, label, on]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 7, fontSize: 11.5, fontWeight: on ? 700 : 500, color: on ? RED : "#374151", background: on ? "rgba(220,38,38,0.07)" : "transparent" }}>
                  <Icon size={13} /> {label}
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* content */}
        <div style={{ flex: 1, minWidth: 0, padding: "18px 20px", background: "#f9fafb", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: INK }}>Overview</div>
              <div style={{ fontSize: 11, color: MUTED }}>Good morning. 3 things need you today.</div>
            </div>
            <Bell size={15} color={MUTED} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {KPIS.map(([label, value, sub, up]) => (
              <div key={label} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={micro}>{label}</div>
                <div style={{ ...num, fontSize: 19, fontWeight: 700, color: INK, margin: "4px 0 2px" }}>{value}</div>
                <div style={{ ...num, fontSize: 10.5, fontWeight: up ? 600 : 400, color: up ? UP : MUTED }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 10 }}>
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>Revenue — Last 30 Days</span>
                <span style={{ ...num, fontSize: 10.5, color: MUTED }}>MTD RM 1.24M · prev RM 1.06M</span>
              </div>
              <svg viewBox="0 0 400 110" style={{ width: "100%", height: 112, display: "block", marginTop: 6 }} fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="hs-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity="0.16" />
                    <stop offset="100%" stopColor={RED} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[28, 56, 84].map((y) => <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="#f3f4f6" />)}
                <path d="M0,96 C40,92 60,86 95,84 C130,82 150,70 190,66 C230,62 250,52 290,44 C330,36 360,24 396,16 L396,110 L0,110Z" fill="url(#hs-area)" />
                <path className="hs-line" d="M0,96 C40,92 60,86 95,84 C130,82 150,70 190,66 C230,62 250,52 290,44 C330,36 360,24 396,16" stroke={RED} strokeWidth="2" strokeLinecap="round" />
                <circle cx="396" cy="16" r="3.5" fill={RED} stroke="#fff" strokeWidth="1.5" />
              </svg>
            </div>
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 8 }}>Stock Snapshot</div>
              {[["Avg Days on Lot", "27d"], ["Stale (30d+)", "6"], ["Appts Today", "4"], ["Capital Tied", "RM 2.41M"]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #f3f4f6", fontSize: 11.5 }}>
                  <span style={{ color: MUTED }}>{l}</span><span style={{ ...num, fontWeight: 700, color: INK }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr 0.9fr", padding: "7px 12px", background: "#f9fafb", borderBottom: `1px solid ${LINE}`, ...micro, fontSize: 9 }}>
              <span>Buyer</span><span>Car</span><span>Source</span><span>Stage</span>
            </div>
            {LEADS.map(([b, c, s, st]) => (
              <div key={b} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr 0.9fr", padding: "7px 12px", borderTop: "1px solid #f3f4f6", fontSize: 11.5, color: INK, alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>{b}</span>
                <span style={{ color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c}</span>
                <span style={{ color: MUTED }}>{s}</span>
                <span><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: st === "Won" ? "rgba(5,150,105,0.1)" : "#f3f4f6", color: st === "Won" ? UP : "#374151" }}>{st}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Floating cards ──────────────────────────────────────────────────────────────
function LeadToast() {
  return (
    <div style={{ ...card, padding: "12px 14px", display: "flex", gap: 11, alignItems: "flex-start" }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: "rgba(5,150,105,0.1)", color: UP, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MessageCircle size={16} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>New WhatsApp lead</div>
        <div style={{ fontSize: 11.5, color: "#374151", marginTop: 2 }}>Hafiz R. · Honda City 1.5 V 2019</div>
        <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>Auto-assigned to Aiman · just now</div>
      </div>
    </div>
  );
}

const PNL = [
  ["Sale price", "72,800"],
  ["Purchase price", "−58,500"],
  ["Recon", "−2,150"],
  ["Included services", "−600"],
  ["Commission", "−1,200"],
  ["Handover costs", "−190"],
];
function UnitPnl() {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={micro}>Unit P&amp;L</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: "3px 0 10px" }}>Honda City 1.5 V · 2019</div>
      {PNL.map(([l, v]) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "4px 0" }}>
          <span style={{ color: MUTED }}>{l}</span><span style={{ ...num, color: INK }}>{v}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "7px 0 4px", borderTop: `1px solid ${LINE}`, marginTop: 4 }}>
        <span style={{ color: "#374151", fontWeight: 600 }}>Front gross</span><span style={{ ...num, fontWeight: 700, color: INK }}>10,160</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "4px 0" }}>
        <span style={{ color: "#374151", fontWeight: 600 }}>Back gross (F&amp;I)</span><span style={{ ...num, fontWeight: 700, color: INK }}>+1,850</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, padding: "9px 11px", borderRadius: 9, background: "rgba(220,38,38,0.06)" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>Total gross</span>
        <span style={{ ...num, fontSize: 17, fontWeight: 800, color: RED }}>RM 12,010</span>
      </div>
    </div>
  );
}

// Labels + fees from src/utils/postSaleSteps.js
const STEPS = [
  ["Settle outstanding loan", "done"],
  ["Buyer insurance / cover note", "done"],
  ["Puspakom B5 inspection", "done", "RM30"],
  ["Puspakom B7 (financed cars)", "done", "RM60"],
  ["JPJ ownership transfer", "now", "RM100"],
  ["Road tax renewal", ""],
  ["Collect new geran / VOC", ""],
  ["Vehicle handover", ""],
];
function Handover() {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={micro}>Handover</div>
        <div style={{ ...num, fontSize: 11, fontWeight: 700, color: INK }}>4 / 8</div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: "3px 0 8px" }}>Mei Ling T. · Toyota Vios 2020</div>
      <div style={{ height: 5, borderRadius: 99, background: "#f3f4f6", marginBottom: 10, overflow: "hidden" }}>
        <div style={{ width: "50%", height: "100%", background: RED, borderRadius: 99 }} />
      </div>
      {STEPS.map(([l, st, fee]) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3.5px 0", fontSize: 11.5 }}>
          <span style={{
            width: 15, height: 15, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: st === "done" ? INK : "#fff", border: st === "done" ? "none" : `1.5px solid ${st === "now" ? RED : "#d1d5db"}`,
          }}>
            {st === "done" && <Check size={9} color="#fff" strokeWidth={3} />}
            {st === "now" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: RED }} />}
          </span>
          <span style={{ flex: 1, color: st === "done" ? MUTED : INK, fontWeight: st === "now" ? 700 : 500, textDecoration: st === "done" ? "line-through" : "none", textDecorationColor: "#d1d5db" }}>{l}</span>
          {fee && <span style={{ ...num, fontSize: 10.5, color: MUTED }}>{fee}</span>}
        </div>
      ))}
    </div>
  );
}

const BANKS = [["Maybank", 84], ["Public Bank", 78], ["RHB", 71], ["CIMB", 63]];
function BankScores() {
  return (
    <div style={{ ...card, padding: "13px 15px" }}>
      <div style={micro}>Bank approval rate · 90d</div>
      <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
        {BANKS.map(([b, v], i) => (
          <div key={b} style={{ display: "grid", gridTemplateColumns: "76px 1fr 30px", alignItems: "center", gap: 8, fontSize: 11.5 }}>
            <span style={{ color: "#374151" }}>{b}</span>
            <span style={{ height: 6, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
              <span style={{ display: "block", width: `${v}%`, height: "100%", borderRadius: 99, background: i === 0 ? RED : "#9ca3af" }} />
            </span>
            <span style={{ ...num, fontWeight: 700, color: INK, textAlign: "right" }}>{v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// On phones the handover card moves up and the box grows to hold it, since
// counter-scaling makes it taller than the canvas.
const PHONE_HANDOVER_Y = 250, HANDOVER_H = 300;

// Positions on the 1100x660 canvas. `side` sets the counter-scale anchor.
const FLOATS = [
  { C: LeadToast,  side: "left",  x: 0,   y: 64,  w: 280, delay: 700,  small: true },
  { C: UnitPnl,    side: "right", x: 846, y: 70,  w: 254, delay: 900 },
  { C: Handover,   side: "left",  x: 22,  y: 330, w: 282, delay: 1100 },
  { C: BankScores, side: "right", x: 856, y: 452, w: 236, delay: 1300, small: true },
];

export default function HeroShowcase() {
  const ref = useRef(null);
  const [width, setWidth] = useState(W);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = Math.min(1, width / W);
  const phone = s < 0.5;
  // Keep floating cards readable when the whole canvas shrinks on a phone.
  const fs = Math.min(1.75, Math.max(1, 0.55 / s));

  return (
    <div ref={ref} className="hs-root" style={{ width: "100%", maxWidth: W, margin: "0 auto", height: (phone ? Math.max(H, PHONE_HANDOVER_Y + HANDOVER_H * fs) : H) * s, position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${s})`, transformOrigin: "0 0", textAlign: "left" }}>
        <div className="hs-in" style={{ position: "absolute", left: 110, top: 24, width: 880, height: 600, animationDelay: "350ms" }}>
          <Dashboard />
        </div>
        {FLOATS.filter((f) => !(phone && f.small)).map(({ C, side, x, y, w, delay }, i) => (
          <div key={i} style={{
            position: "absolute", top: phone && C === Handover ? PHONE_HANDOVER_Y : y, width: w,
            ...(side === "left" ? { left: x } : { right: W - x - w }),
            transform: `scale(${phone ? fs : 1})`, transformOrigin: side === "left" ? "0 0" : "100% 0",
          }}>
            <div className="hs-in" style={{ animationDelay: `${delay}ms` }}><C /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
