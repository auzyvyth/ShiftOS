import React from "react";

// NEWCAR-1: shown at the top of the add-listing forms for a new-car advisor.
//
// New Proton/Perodua/Toyota cars are NOT listings: they come from the platform
// price list and are ticked in Settings > New cars (MyNewModels). Without this
// line an advisor opened the listing form, saw nothing about their brand, and
// reasonably concluded the setup had not worked. The form stays usable for a
// used or recon car they also sell.
export default function NewCarFormNotice({ profile, onOpenNewCars, dark = false }) {
  if (profile?.seller_type !== "new_car") return null;
  const brand = profile?.new_car_brand || "new";
  const fg = dark ? "#e5e7eb" : "#111827";
  const sub = dark ? "#9ca3af" : "#4b5563";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16, padding: "12px 14px",
      borderRadius: 10, background: dark ? "rgba(255,255,255,0.04)" : "#fff",
      border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
    }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: fg }}>Selling new {brand} cars?</p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: sub, lineHeight: 1.5 }}>
          You don't list them here. Tick your models in Settings and they show on your page with the official price. Use this form for a used or recon car.
        </p>
      </div>
      {onOpenNewCars && (
        <button type="button" onClick={onOpenNewCars}
          style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#dc2626", border: "none", color: "#fff" }}>
          Pick my {brand === "new" ? "" : `${brand} `}models
        </button>
      )}
    </div>
  );
}
