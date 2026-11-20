import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import ShowroomCard, { ShowroomCardSkeleton } from "@/components/ShowroomCard";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import { MAX as COMPARE_MAX } from "../../../hooks/useCompare";
import { FadeIn } from "./ui";
import { wrap, secA, BODY_TYPES } from "./shared";

// "Browse Our Cars": search, body-type chips and the newest six cars.
export default function Inventory({ featured, loading, carsBase, ctaCtx, compare }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [heroQ, setHeroQ] = useState("");
  const { compareIds, addToCompare, removeFromCompare, isInCompare } = compare;
  const chip = (active) => ({
    flexShrink: 0, padding: "7px 15px", borderRadius: 50, textDecoration: "none",
    fontSize: 13, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
    whiteSpace: "nowrap", transition: "all 0.15s",
    border: `1px solid ${active ? "rgba(220,38,38,0.4)" : "rgba(255,255,255,0.14)"}`,
    background: active ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.04)",
    color: active ? "#f87171" : "rgba(255,255,255,0.78)",
  });
  return (
    <section className="sec-pad" style={secA}>
      <div style={wrap}>
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
        <div className="inv-toolbar">
          <div className="inv-search">
            <SearchAutocomplete
              dark
              value={heroQ}
              onChange={setHeroQ}
              placeholder="Search our cars by make, model or variant…"
              onSubmit={(val) => {
                const s = (val || "").trim();
                navigate(s ? `${carsBase}?q=${encodeURIComponent(s)}` : carsBase);
              }}
              inputStyle={{ padding: "13px 16px", fontSize: "15px" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "28px" }}>
          <Link to={carsBase} style={chip(true)}>All cars</Link>
          {BODY_TYPES.map((bt) => (
            <Link key={bt} to={`${carsBase}?body_type=${encodeURIComponent(bt)}`} style={chip(false)}>{bt}</Link>
          ))}
        </div>
        <div className="sc-grid" style={{ marginBottom: "36px" }}>
          {loading
            ? [...Array(3)].map((_, i) => <ShowroomCardSkeleton key={i} dark />)
            : featured.map((c, i) => (
                <ShowroomCard
                  key={c.id}
                  car={c}
                  ctaContext={ctaCtx}
                  priority={i === 0}
                  dark
                  inCompare={isInCompare(c.id)}
                  compareFull={compareIds.length >= COMPARE_MAX}
                  onCompare={() => (isInCompare(c.id) ? removeFromCompare(c.id) : addToCompare(c.id))}
                />
              ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <Link
            to={carsBase}
            className="ghost-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#C0C0C6",
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
      </div>
    </section>
  );
}
