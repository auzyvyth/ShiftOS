import { Link } from "react-router-dom";
import { Flame, ArrowRight } from "lucide-react";
import CarCard from "@/components/CarCard";
import { FadeIn, SkeletonCard } from "./ui";
import { wrap, secB } from "./shared";

// The dealer's cars priced at least 3% under their original price (isHotDeal, HomePage.jsx).
export default function HotDeals({ hotDeals, loading, carsBase, ctaCtx }) {
  return (
    <>
      {(hotDeals.length > 0 || loading) && (
        <section className="sec-pad" style={secB}>
          <div style={wrap}>
            <FadeIn>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  marginBottom: "40px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <p className="sec-eyebrow red">
                    <Flame size={10} style={{ marginRight: -4 }} /> Limited Time
                  </p>
                  <h2 className="sec-title">Hot Deals</h2>
                </div>
                <Link to={`${carsBase}?hot_deals=true`} className="view-all-link">
                  View All <ArrowRight size={12} />
                </Link>
              </div>
            </FadeIn>
            <div className="car-grid-hp">
              {loading
                ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
                : hotDeals.map((c, i) => (
                    <CarCard key={c.id} car={c} ctaContext={ctaCtx} priority={i === 0} />
                  ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
