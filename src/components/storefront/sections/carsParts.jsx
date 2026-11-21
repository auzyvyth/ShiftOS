// Pieces shared by the three versions of a dealer site's car section (STOREFRONT-2 stage 3):
// the heading, the search + body-type chips, one car card, and View all. Version A (the grid)
// was built from these exact parts, so the three versions only differ in how the cars are
// laid out, never in what a buyer can do. The card is always ShowroomCard (DESIGN.md: one card).
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import ShowroomCard from "@/components/ShowroomCard";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import { MAX as COMPARE_MAX } from "../../../hooks/useCompare";
import { FadeIn } from "./ui";
import { BODY_TYPES } from "./shared";

export function CarsHeading({ carsBase }) {
  return (
    <FadeIn>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <p className="sec-eyebrow">Our Inventory</p>
          <h2 className="sec-title">Browse Our Cars</h2>
        </div>
        <Link to={carsBase} className="view-all-link">
          All Cars <ArrowRight size={12} />
        </Link>
      </div>
    </FadeIn>
  );
}

const chip = (active) => ({
  flexShrink: 0, padding: "7px 15px", borderRadius: 50, textDecoration: "none",
  fontSize: 13, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
  whiteSpace: "nowrap", transition: "all 0.15s",
  border: `1px solid ${active ? "rgba(var(--sf-accent-rgb, 220,38,38),0.4)" : "var(--sf-border, rgba(255,255,255,0.14))"}`,
  background: active ? "rgba(var(--sf-accent-rgb, 220,38,38),0.12)" : "var(--sf-card, rgba(255,255,255,0.04))",
  color: active ? "var(--sf-accent-text, #f87171)" : "var(--sf-muted, rgba(255,255,255,0.78))",
});

// browseOn = the Browse bar section is on (phase B): it already shows the body types the dealer
// has, so this row of chips steps aside and the page carries one set, not two.
export function CarsToolbar({ carsBase, browseOn = false }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <>
      <div className="inv-toolbar">
        <div className="inv-search">
          <SearchAutocomplete
            dark
            value={q}
            onChange={setQ}
            placeholder="Search our cars by make, model or variant…"
            onSubmit={(val) => {
              const s = (val || "").trim();
              navigate(s ? `${carsBase}?q=${encodeURIComponent(s)}` : carsBase);
            }}
            inputStyle={{ padding: "13px 16px", fontSize: "15px" }}
          />
        </div>
      </div>
      {!browseOn && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "28px" }}>
          <Link to={carsBase} style={chip(true)}>All cars</Link>
          {BODY_TYPES.map((bt) => (
            <Link key={bt} to={`${carsBase}?body_type=${encodeURIComponent(bt)}`} style={chip(false)}>{bt}</Link>
          ))}
        </div>
      )}
    </>
  );
}

export function CarCard({ car, index, ctaCtx, compare }) {
  const { compareIds, addToCompare, removeFromCompare, isInCompare } = compare;
  return (
    <ShowroomCard
      car={car}
      ctaContext={ctaCtx}
      priority={index === 0}
      dark
      inCompare={isInCompare(car.id)}
      compareFull={compareIds.length >= COMPARE_MAX}
      onCompare={() => (isInCompare(car.id) ? removeFromCompare(car.id) : addToCompare(car.id))}
    />
  );
}

export function ViewAllButton({ carsBase }) {
  const { t } = useTranslation();
  return (
    <div style={{ textAlign: "center" }}>
      <Link
        to={carsBase}
        className="ghost-outline"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "transparent",
          border: "1px solid var(--sf-border, rgba(255,255,255,0.1))",
          color: "var(--sf-muted, #C0C0C6)",
          fontWeight: "600",
          fontSize: "13px",
          padding: "12px 28px",
          borderRadius: "4px",
          textDecoration: "none",
          transition: "all 0.2s ease",
          letterSpacing: "0.02em",
        }}
      >
        {t("home.hotDeals.viewAllBtn")} <ArrowRight size={14} />
      </Link>
    </div>
  );
}
