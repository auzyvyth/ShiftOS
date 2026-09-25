import { Check, Car, Globe, Send, Film, Store, AlertCircle } from "lucide-react";

// ─── Pain-section previews ────────────────────────────────────────────────────
// One coded screen per pain row on /shiftos (keys p1..p6 in shiftos.pain.items).
// Each shows a DIFFERENT surface from the hero cards (HeroShowcase.jsx), so the
// page never repeats a picture:
//   p1 Stock list with gross per unit   (StockTab + P&L)
//   p2 Handover board across deals      (PostSaleBoard)
//   p3 Team scorecard                   (GM Oversight)
//   p4 One deal on the HP Board         (multi-bank + LOU/JPJ milestones)
//   p5 Where a new listing got published
//   p6 Renewals + service packages      (Customers / "This week")
// Fluid layouts, no fixed widths: they reflow down to a 327px phone column.
// Figures are illustrative and consistent with the hero (Honda City = RM 12,010).

const INK = "#111827", MUTED = "#6b7280", LINE = "#e5e7eb", UP = "#059669", RED = "#dc2626";
const num = { fontVariantNumeric: "tabular-nums" };
const micro = { fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED };
const row = { borderTop: "1px solid #f3f4f6", fontSize: 12, color: INK, alignItems: "center" };
const ell = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

function Pill({ tone = "neutral", children }) {
  const t = {
    neutral: ["#f3f4f6", "#374151"],
    up:      ["rgba(5,150,105,0.1)", UP],
    red:     ["rgba(220,38,38,0.08)", RED],
  }[tone];
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: t[0], color: t[1], whiteSpace: "nowrap" }}>{children}</span>;
}

function Frame({ title, meta, children }) {
  return (
    <div className="pp-frame">
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", borderBottom: `1px solid ${LINE}`, background: "#f9fafb" }}>
        {["#fca5a5", "#fcd34d", "#86efac"].map((c) => <span key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />)}
        <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: INK, ...ell }}>{title}</span>
        {meta && <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{meta}</span>}
      </div>
      {children}
    </div>
  );
}

// p1 ─ gross per unit, aged unit flagged
const STOCK = [
  ["Honda City 1.5 V 2019", 12, "10,160", "1,850", "12,010"],
  ["Toyota Vios 1.5 G 2020", 21, "8,420", "2,300", "10,720"],
  ["Perodua Myvi 1.5 AV 2021", 9, "5,980", "950", "6,930"],
  ["Mazda CX-5 2.0 2018", 64, "3,150", "0", "3,150"],
];
const stockCols = { display: "grid", gridTemplateColumns: "minmax(0,2fr) 0.6fr 0.9fr 0.8fr 1fr", gap: 8, padding: "8px 14px" };
function PnlPreview() {
  return (
    <Frame title="Inventory · Gross per unit" meta="Sep 2026">
      <div className="pp-stock" style={{ ...stockCols, ...micro, fontSize: 9 }}>
        <span>Car</span><span>Days</span><span className="pp-sm-hide">Front</span><span className="pp-sm-hide">Back</span><span style={{ textAlign: "right" }}>Gross</span>
      </div>
      {STOCK.map(([car, days, f, b, g]) => (
        <div key={car} className="pp-stock" style={{ ...stockCols, ...row }}>
          <span style={{ ...ell, fontWeight: 600 }}>{car}</span>
          <span style={num}>{days > 60 ? <Pill tone="red">{days}d</Pill> : `${days}d`}</span>
          <span className="pp-sm-hide" style={{ ...num, color: MUTED }}>{f}</span>
          <span className="pp-sm-hide" style={{ ...num, color: MUTED }}>{b}</span>
          <span style={{ ...num, fontWeight: 700, textAlign: "right" }}>{g}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 14px", borderTop: `1px solid ${LINE}`, background: "#fcfcfd" }}>
        <span style={{ fontSize: 12, color: MUTED }}>MTD total gross</span>
        <span style={num}>
          <b style={{ fontSize: 17, color: INK }}>RM 142,860</b>
          <span style={{ fontSize: 11, fontWeight: 600, color: UP, marginLeft: 8 }}>+12.8%</span>
        </span>
      </div>
    </Frame>
  );
}

// p2 ─ every won deal and the step it is stuck on
const DEALS = [
  ["Hafiz R.", "Honda City 2019", "Puspakom B5 inspection", 2, "Due today"],
  ["Mei Ling T.", "Toyota Vios 2020", "JPJ ownership transfer", 4],
  ["Kumar S.", "Perodua Myvi 2021", "Collect new geran / VOC", 6],
  ["Nurul A.", "Proton X50 2022", "Handed over", 8],
];
function HandoverPreview() {
  return (
    <Frame title="Handover" meta="4 sold deals">
      {DEALS.map(([name, car, next, done, flag], i) => (
        <div key={name} style={{ padding: "11px 14px", borderTop: i ? "1px solid #f3f4f6" : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: INK, ...ell }}>{name} <span style={{ fontWeight: 400, color: MUTED }}>· {car}</span></span>
            {done === 8 ? <Pill tone="up">Done</Pill> : flag ? <Pill tone="red">{flag}</Pill> : <span style={{ ...num, fontSize: 11, color: MUTED }}>{done}/8</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
            <span style={{ flex: 1, height: 5, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
              <span style={{ display: "block", width: `${(done / 8) * 100}%`, height: "100%", borderRadius: 99, background: done === 8 ? UP : RED }} />
            </span>
            <span style={{ fontSize: 11, color: done === 8 ? UP : "#374151", flexShrink: 0, maxWidth: "58%", ...ell }}>{done === 8 ? "All 8 steps" : `Next: ${next}`}</span>
          </div>
        </div>
      ))}
    </Frame>
  );
}

// p3 ─ the owner's view of who is actually selling
const TEAM = [
  ["Aiman", 42, "6m", "31%", "48.2k"],
  ["Siti", 35, "11m", "26%", "39.5k"],
  ["Jason", 28, "22m", "18%", "24.1k"],
  ["Ravi", 19, "1h 40m", "11%", "9.8k", true],
];
const teamCols = { display: "grid", gridTemplateColumns: "minmax(0,1.3fr) 0.7fr 1fr 0.8fr 0.9fr", gap: 8, padding: "9px 14px" };
function TeamPreview() {
  return (
    <Frame title="GM Oversight · Team" meta="Last 30 days">
      <div style={{ ...teamCols, ...micro, fontSize: 9 }}>
        <span>Salesman</span><span>Leads</span><span>Reply</span><span>Close</span><span style={{ textAlign: "right" }}>Gross</span>
      </div>
      {TEAM.map(([n, l, r, c, g, slow], i) => (
        <div key={n} style={{ ...teamCols, ...row }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ ...num, fontSize: 10, fontWeight: 700, color: MUTED, width: 10 }}>{i + 1}</span>
            <span style={{ ...ell, fontWeight: 600 }}>{n}</span>
          </span>
          <span style={num}>{l}</span>
          <span style={{ ...num, color: slow ? RED : INK, fontWeight: slow ? 700 : 400 }}>{r}</span>
          <span style={num}>{c}</span>
          <span style={{ ...num, fontWeight: 700, textAlign: "right" }}>{g}</span>
        </div>
      ))}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: "#374151", display: "flex", gap: 8, alignItems: "center", background: "#fcfcfd" }}>
        <AlertCircle size={14} color={RED} style={{ flexShrink: 0 }} /> Ravi has 5 leads with no reply for 24h+
      </div>
    </Frame>
  );
}

// p4 ─ one deal, submitted to four banks at once
const BANKS = [["Maybank", "Approved", "up"], ["Public Bank", "Approved", "up"], ["CIMB", "Pending", "neutral"], ["RHB", "Declined", "red"]];
const MILES = [["Submitted", 1], ["Approved", 1], ["LOU", 1], ["JPJ", 0.5], ["Disbursed", 0]];
function HpPreview() {
  return (
    <Frame title="HP Board" meta="Loan RM 58,000 · 9 yr">
      <div style={{ padding: "12px 14px 4px", fontSize: 12.5, fontWeight: 700, color: INK }}>
        Hafiz R. <span style={{ fontWeight: 400, color: MUTED }}>· Honda City 1.5 V 2019</span>
      </div>
      <div style={{ padding: "4px 14px 10px", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
        {BANKS.map(([b, s, tone]) => (
          <div key={b} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 6, padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: INK }}>{b}</span><Pill tone={tone}>{s}</Pill>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 14px 14px", borderTop: `1px solid ${LINE}`, background: "#fcfcfd" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {MILES.map(([m, st], i) => (
            <div key={m} style={{ flex: i ? 1 : "0 0 auto", display: "flex", alignItems: "center" }}>
              {i > 0 && <span style={{ flex: 1, height: 2, background: st > 0 ? INK : LINE }} />}
              <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: st === 1 ? INK : "#fff", border: st === 1 ? "none" : `1.5px solid ${st ? RED : "#d1d5db"}` }}>
                {st === 1 && <Check size={9} color="#fff" strokeWidth={3} />}
                {st === 0.5 && <span style={{ width: 5, height: 5, borderRadius: "50%", background: RED }} />}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: MUTED }}>
          {MILES.map(([m, st]) => <span key={m} style={{ fontWeight: st === 0.5 ? 700 : 400, color: st === 0.5 ? INK : MUTED }}>{m}</span>)}
        </div>
      </div>
    </Frame>
  );
}

// p5 ─ one listing, four places, no copy-paste
const CHANNELS = [
  [Store, "Your storefront", "yourdealer.xdrive.my", "Live"],
  [Globe, "XDrive marketplace", "xdrive.my", "Live"],
  [Send, "Telegram channel", "Auto-posted", "Sent"],
  [Film, "TikTok slides", "5 slides ready", "Ready"],
];
function PublishPreview() {
  return (
    <Frame title="New listing" meta="Published in 4 min">
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px" }}>
        <span style={{ width: 64, height: 46, borderRadius: 8, flexShrink: 0, background: "linear-gradient(135deg,#f3f4f6,#e5e7eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Car size={22} color="#9ca3af" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, ...ell }}>Toyota Vios 1.5 G 2020</div>
          <div style={{ ...num, fontSize: 12, color: MUTED, marginTop: 2 }}>RM 68,800 · 42,100 km · Auto</div>
        </div>
      </div>
      {CHANNELS.map(([Icon, name, sub, st]) => (
        <div key={name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 14px", borderTop: "1px solid #f3f4f6" }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "#f9fafb", border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={14} color="#374151" />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{name}</div>
            <div style={{ fontSize: 11, color: MUTED, ...ell }}>{sub}</div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: UP }}><Check size={13} strokeWidth={3} />{st}</span>
        </div>
      ))}
    </Frame>
  );
}

// p6 ─ the buyers worth calling back this week
const RENEWALS = [
  ["Mei Ling T.", "Toyota Vios 2020", "Road tax expires in 7 days", "red"],
  ["Kumar S.", "Perodua Myvi 2021", "Insurance expires in 30 days", "neutral"],
  ["Nurul A.", "Proton X50 2022", "Service package · 2 of 4 visits left", "neutral"],
  ["Lim K.H.", "Honda Civic 2016", "Trade-up ready · owned 3 years", "up"],
];
function RetentionPreview() {
  return (
    <Frame title="Customers · This week" meta="4 to call">
      {RENEWALS.map(([n, car, why, tone], i) => (
        <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: i ? "1px solid #f3f4f6" : "none" }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#f3f4f6", color: "#374151", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {n.split(" ").map((w) => w[0]).join("").slice(0, 2)}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, ...ell }}>{n} <span style={{ fontWeight: 400, color: MUTED }}>· {car}</span></div>
            <div style={{ marginTop: 4 }}><Pill tone={tone}>{why}</Pill></div>
          </div>
          <span className="pp-sm-hide" style={{ fontSize: 11.5, fontWeight: 700, color: INK, padding: "5px 10px", border: `1px solid ${LINE}`, borderRadius: 8, flexShrink: 0 }}>Message</span>
        </div>
      ))}
    </Frame>
  );
}

export const PAIN_PREVIEWS = {
  p1: PnlPreview,
  p2: HandoverPreview,
  p3: TeamPreview,
  p4: HpPreview,
  p5: PublishPreview,
  p6: RetentionPreview,
};
