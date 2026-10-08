import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { publicClient } from "../../supabaseClient";
import { priceBasis, payWarning, rm } from "../../utils/newCars";

// NEWCAR-1: what the car page shows under a new-car advisor's CARD
// (car_listings.new_car_model_id). One read, get_new_car_listing_info, which
// only answers for a car the public can already see. Renders nothing for any
// other car, or when the read fails: the page above still works.
//
// Wording rule (CLAUDE.md "Agent page trust signals"): "advisor" is the
// seller's own stated role. Only advisor_verified (profiles.is_verified,
// granted by a person) may be called verified. We do not check employment
// with the brand, so nothing here says "authorised" or "official agent".

const STEPS = [
  ["Pick the variant and colour", "Ask which colours are in stock and how long the wait is."],
  ["Pay the booking fee", "Only into the brand's company account or at the showroom counter."],
  ["Loan approval", "The advisor sends your papers to the banks. The bank decides."],
  ["Registration and insurance", "Plate number, road tax and insurance are done before delivery."],
  ["Collect your car", "At the showroom, with a handover of the car and its warranty book."],
];

// CarDetailPage mounts this twice (mobile + desktop blocks, one CSS-hidden),
// so both share one request per listing.
const pending = new Map();
function loadInfo(id) {
  if (!pending.has(id)) {
    pending.set(id, publicClient.rpc("get_new_car_listing_info", { p_listing_id: id }).maybeSingle()
      .then(({ data }) => data || null, () => null)
      .finally(() => setTimeout(() => pending.delete(id), 60000)));
  }
  return pending.get(id);
}

function specRows(i) {
  const s = i.specs || {};
  return [
    ["Body", i.body_type],
    ["Fuel", i.fuel_type],
    ["Gearbox", i.transmission],
    ["Engine", s.engine],
    ["Power", s.power_ps ? `${s.power_ps} PS` : null],
    ["Torque", s.torque_nm ? `${s.torque_nm} Nm` : null],
    ["Battery", s.battery_kwh ? `${s.battery_kwh} kWh` : null],
    ["Range", s.range_km ? `${s.range_km} km` : s.ev_range_km ? `${s.ev_range_km} km EV` : null],
    ["Seats", s.seats ? String(s.seats) : null],
  ].filter(([, v]) => v);
}

export default function NewCarListingInfo({ listingId, sellerName, th }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let alive = true;
    setInfo(null);
    if (!listingId) return undefined;
    loadInfo(listingId).then((d) => { if (alive) setInfo(d); });
    return () => { alive = false; };
  }, [listingId]);

  if (!info) return null;
  const first = (sellerName || "").trim().split(/\s+/)[0] || "This advisor";
  const specs = specRows(info);
  const others = Array.isArray(info.other_cards) ? info.other_cards : [];
  const label = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: th.textMuted, fontWeight: 700, margin: "0 0 14px" };
  const box = { background: th.card, border: `1px solid ${th.border}`, borderRadius: 12 };

  return (
    <div style={{ marginTop: 32, paddingTop: 28, borderTop: `1px solid ${th.border}` }}>
      <p style={label}>New {info.brand}</p>
      <div style={{ ...box, padding: "16px 18px" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: th.text, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {sellerName || "This seller"} is a {info.brand} sales advisor
          {info.advisor_verified && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#15803d" }}>
              <BadgeCheck size={14} /> Verified by XDrive
            </span>
          )}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: th.textSec, lineHeight: 1.6 }}>
          Brand new, 0 km. The price is {info.brand}'s own price list, not set by {first}, and XDrive updates it when {info.brand} changes it.
          {" "}{priceBasis(info.price_zone, info.effective_from)}
        </p>
      </div>

      {specs.length > 0 && (
        <>
          <p style={{ ...label, marginTop: 24 }}>{info.model} {info.variant} specs</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 1, ...box, overflow: "hidden", background: th.border }}>
            {specs.map(([k, v]) => (
              <div key={k} style={{ padding: "12px 14px", background: th.card, minWidth: 0 }}>
                <p style={{ margin: "0 0 4px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: th.textMuted, fontWeight: 700 }}>{k}</p>
                <p style={{ margin: 0, fontSize: 14, color: th.text, fontWeight: 500, overflowWrap: "anywhere" }}>{v}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ ...label, marginTop: 24 }}>How buying new works</p>
      <ol style={{ ...box, margin: 0, padding: "6px 18px", listStyle: "none" }}>
        {STEPS.map(([h, d], i) => (
          <li key={h} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${th.borderSec}` : "none" }}>
            <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 11, background: th.card2, color: th.text, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: th.text }}>{h}</span>
              <span style={{ display: "block", fontSize: 12.5, color: th.textSec, lineHeight: 1.5, marginTop: 2 }}>{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: th.textMuted, lineHeight: 1.6 }}>{payWarning(info.brand)}</p>

      {others.length > 0 && (
        <>
          <p style={{ ...label, marginTop: 24 }}>More from {first}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {others.map((o) => (
              <Link key={o.id} to={`/showroom/${o.slug || o.id}`}
                style={{ ...box, display: "flex", alignItems: "center", gap: 12, padding: 8, textDecoration: "none", minWidth: 0 }}>
                <span style={{ flexShrink: 0, width: 64, height: 44, borderRadius: 8, overflow: "hidden", background: th.card2 }}>
                  {o.image && <img src={o.image} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: th.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {info.brand} {o.model} {o.variant}
                </span>
                <span style={{ flexShrink: 0, fontSize: 13.5, fontWeight: 600, color: th.text, fontVariantNumeric: "tabular-nums", paddingRight: 6 }}>{rm(o.price)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
