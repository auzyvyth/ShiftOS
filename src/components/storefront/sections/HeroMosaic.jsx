// Top banner, version C "Showroom wall" (STOREFRONT-2 stage 3): the dealer's name and two
// buttons over a wall of their three newest cars, one large and two small, each with its
// name and price. The photos are the dealer's own stock (DESIGN.md: live inventory is the
// photography, never a stock shot). Fewer cars, fewer tiles; no cars, no wall.
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { carHref, carPhoto, carName, carPrice, showcaseCars } from "./heroParts";
import { primaryBtn } from "./shared";

function Tile({ car, big }) {
  return (
    <Link to={carHref(car)} className={`hmo-tile${big ? " hmo-big" : ""}`} aria-label={`${carName(car)}, ${carPrice(car)}`}>
      <img src={carPhoto(car, big ? 1280 : 720)} alt={carName(car)} loading={big ? "eager" : "lazy"} fetchPriority={big ? "high" : "auto"} />
      <span className="hmo-label">
        <span className="hmo-name">{carName(car)}</span>
        <span className="hmo-price">{carPrice(car)}</span>
      </span>
    </Link>
  );
}

export default function HeroMosaic({ tenant, siteName, carsBase, featured, loading }) {
  const cars = showcaseCars(featured, 3);
  const place = [tenant?.city, tenant?.state].filter(Boolean).join(", ");
  const title = tenant?.hero_title?.trim() || siteName;
  const line = tenant?.hero_subtitle?.trim();

  return (
    <section className="hmo">
      <style>{`
        .hmo { background: #0C0C0E; padding: 112px 0 72px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .hmo-wrap { max-width: 1280px; margin: 0 auto; padding: 0 20px; }
        .hmo-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
        .hmo-place { display: inline-flex; align-items: center; gap: 6px; color: #C4A265; font-size: 11px; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase; margin: 0 0 12px; }
        .hmo-title { color: #F0F0F0; font-size: clamp(2.2rem, 6vw, 4rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1.02; margin: 0; }
        .hmo-line { color: #9CA3AF; font-size: 15px; line-height: 1.7; margin: 12px 0 0; max-width: 520px; }
        .hmo-wall { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .hmo-wall.n1 { grid-template-columns: minmax(0, 1fr); }
        .hmo-tile { position: relative; display: block; border-radius: 16px; overflow: hidden; background: #141416; aspect-ratio: 4 / 3; text-decoration: none; }
        .hmo-big { grid-column: 1 / -1; aspect-ratio: 16 / 10; }
        .hmo-wall.n2 .hmo-tile:not(.hmo-big) { grid-column: 1 / -1; aspect-ratio: 16 / 10; }
        .hmo-tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.25s ease; }
        @media (hover: hover) { .hmo-tile:hover img { transform: scale(1.03); } }
        .hmo-label { position: absolute; left: 12px; right: 12px; bottom: 12px; background: rgba(12,12,14,0.78); border-radius: 10px;
          padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .hmo-name { color: #F0F0F0; font-size: 13px; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hmo-price { color: #F0F0F0; font-size: 14px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .hmo-skel { border-radius: 16px; aspect-ratio: 16 / 7; background: linear-gradient(90deg,#141416 25%,#1C1C1E 50%,#141416 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @media (min-width: 900px) {
          .hmo-wall { grid-template-columns: 2fr 1fr; grid-template-rows: repeat(2, minmax(0, 1fr)); height: clamp(380px, 46vw, 560px); }
          .hmo-wall.n1 { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
          .hmo-wall.n2 { grid-template-columns: 2fr 1fr; grid-template-rows: minmax(0, 1fr); }
          .hmo-tile, .hmo-big, .hmo-wall.n2 .hmo-tile:not(.hmo-big) { aspect-ratio: auto; height: 100%; grid-column: auto; }
          .hmo-big { grid-column: auto; grid-row: 1 / -1; }
          .hmo-name { font-size: 14px; } .hmo-big .hmo-name { font-size: 16px; } .hmo-big .hmo-price { font-size: 18px; }
          .hmo-label { left: 16px; right: 16px; bottom: 16px; padding: 10px 16px; }
        }
        @media (max-width: 899px) {
          .hmo-tile:not(.hmo-big) .hmo-label { flex-direction: column; align-items: flex-start; gap: 2px; left: 8px; right: 8px; bottom: 8px; padding: 6px 10px; }
          .hmo-tile:not(.hmo-big) .hmo-name { width: 100%; font-size: 12px; }
          .hmo-tile:not(.hmo-big) .hmo-price { font-size: 13px; }
        }
        @media (max-width: 480px) { .hmo { padding: 92px 0 48px; } .hmo-head { margin-bottom: 20px; } }
      `}</style>
      <div className="hmo-wrap">
        <div className="hmo-head">
          <div style={{ minWidth: 0 }}>
            {place && <p className="hmo-place"><MapPin size={12} /> {place}</p>}
            <h1 className="hmo-title">{title}</h1>
            {line && <p className="hmo-line">{line}</p>}
          </div>
          <Link to={carsBase} className="primary-btn" style={primaryBtn}>
            Browse our cars <ArrowRight size={14} />
          </Link>
        </div>
        {cars.length > 0 ? (
          <div className={`hmo-wall n${cars.length}`}>
            {cars.map((c, i) => <Tile key={c.id} car={c} big={i === 0} />)}
          </div>
        ) : loading ? (
          <div className="hmo-skel" aria-hidden />
        ) : null}
      </div>
    </section>
  );
}
