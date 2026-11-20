// Cars, version C "Spotlight" (STOREFRONT-2 stage 3): the same heading, search and chips,
// then the newest car shown large with its facts, and the rest in the one card grid. The
// spotlight states only what the car row holds (name, price, the card's monthly estimate,
// mileage, gearbox, fuel, body type); no claim about the car's condition or history.
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ShowroomCardSkeleton } from "@/components/ShowroomCard";
import { CarsHeading, CarsToolbar, CarCard, ViewAllButton } from "./carsParts";
import { carHref, carPhoto, carName, carPrice, carMonthly } from "./heroParts";
import { wrap, secA, primaryBtn } from "./shared";

const specs = (car) => [
  Number(car.mileage) > 0 ? `${Number(car.mileage).toLocaleString("en-MY")} km` : null,
  car.transmission,
  car.fuel_type,
  car.body_type,
].filter(Boolean);

export default function InventorySpotlight({ featured, loading, carsBase, ctaCtx, compare }) {
  const lead = featured.find((c) => carPhoto(c));
  // Four under the spotlight: fills whole rows at 4 across (desktop) and 2 across (phone).
  const rest = featured.filter((c) => c !== lead).slice(0, 4);

  return (
    <section className="sec-pad" style={secA}>
      <style>{`
        .isp { display: grid; gap: 0; border-radius: 16px; overflow: hidden; background: #111113; border: 1px solid rgba(255,255,255,0.07); margin-bottom: 24px; }
        @media (min-width: 900px) { .isp { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); } }
        .isp-photo { display: block; aspect-ratio: 16 / 10; background: #141416; overflow: hidden; }
        @media (min-width: 900px) { .isp-photo { aspect-ratio: auto; min-height: 360px; height: 100%; } }
        .isp-photo img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.25s ease; }
        @media (hover: hover) { .isp-photo:hover img { transform: scale(1.03); } }
        .isp-body { padding: 28px; display: flex; flex-direction: column; justify-content: center; gap: 12px; min-width: 0; }
        .isp-eyebrow { color: #C4A265; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; margin: 0; }
        .isp-name { color: #F0F0F0; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.1; margin: 0; }
        .isp-price { color: #F0F0F0; font-size: clamp(1.6rem, 3.4vw, 2.2rem); font-weight: 800; font-variant-numeric: tabular-nums; margin: 4px 0 0; }
        .isp-monthly { color: #9CA3AF; font-size: 13px; margin: 0; }
        .isp-specs { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 8px; padding: 0; list-style: none; }
        .isp-specs li { color: #C0C0C6; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.05); border-radius: 6px; padding: 6px 10px; }
        @media (max-width: 480px) { .isp-body { padding: 20px; } }
      `}</style>
      <div style={wrap}>
        <CarsHeading carsBase={carsBase} />
        <CarsToolbar carsBase={carsBase} />
        {loading ? (
          <div className="sc-grid" style={{ marginBottom: "36px" }}>
            {[...Array(3)].map((_, i) => <ShowroomCardSkeleton key={i} dark />)}
          </div>
        ) : (
          <>
            {lead && (
              <div className="isp">
                <Link to={carHref(lead)} className="isp-photo" aria-label={carName(lead)}>
                  <img src={carPhoto(lead, 1280)} alt={carName(lead)} loading="lazy" />
                </Link>
                <div className="isp-body">
                  <p className="isp-eyebrow">Newest arrival</p>
                  <h3 className="isp-name">{carName(lead)}</h3>
                  <p className="isp-price">{carPrice(lead)}</p>
                  {carMonthly(lead) && <p className="isp-monthly">{carMonthly(lead)}</p>}
                  {specs(lead).length > 0 && <ul className="isp-specs">{specs(lead).map((s) => <li key={s}>{s}</li>)}</ul>}
                  <div>
                    <Link to={carHref(lead)} className="primary-btn" style={primaryBtn}>
                      See this car <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <div className="sc-grid" style={{ marginBottom: "36px" }}>
                {rest.map((c, i) => <CarCard key={c.id} car={c} index={i + 1} ctaCtx={ctaCtx} compare={compare} />)}
              </div>
            )}
          </>
        )}
        <ViewAllButton carsBase={carsBase} />
      </div>
    </section>
  );
}
