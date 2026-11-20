// Top banner, version B "Split" (STOREFRONT-2 stage 3): the dealer's name, where they are
// and a search box on the left; their newest car's real photo on the right, with its name
// and price. Search first (DESIGN.md: the hero exists to get someone typing). Every word is
// the dealer's own (hero_title / hero_subtitle from Settings) or a fact we hold (stock count,
// town); nothing claims a check or a promise.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import { carHref, carPhoto, carName, carPrice, carMonthly, showcaseCars } from "./heroParts";
import { primaryBtn } from "./shared";

export default function HeroSplit({ tenant, siteName, carsBase, stock, featured, loading }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const car = showcaseCars(featured, 1)[0];
  const place = [tenant?.city, tenant?.state].filter(Boolean).join(", ");
  const title = tenant?.hero_title?.trim() || siteName;
  const line = tenant?.hero_subtitle?.trim() || (stock > 0 ? `${stock} cars for sale now${place ? ` in ${tenant.city || tenant.state}` : ""}.` : "");

  return (
    <section className="hsp">
      <style>{`
        .hsp { background: #0C0C0E; padding: 112px 0 72px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .hsp-wrap { max-width: 1280px; margin: 0 auto; padding: 0 20px; display: grid; gap: 40px; align-items: center; }
        @media (min-width: 900px) { .hsp-wrap { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 48px; } }
        .hsp-place { display: inline-flex; align-items: center; gap: 6px; color: #C4A265; font-size: 11px; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase; margin: 0 0 16px; }
        .hsp-title { color: #F0F0F0; font-size: clamp(2.2rem, 6vw, 4rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1.02; margin: 0 0 16px; }
        .hsp-line { color: #9CA3AF; font-size: 15px; line-height: 1.7; margin: 0 0 28px; max-width: 460px; }
        .hsp-search { margin-bottom: 16px; max-width: 520px; }
        .hsp-car { position: relative; display: block; border-radius: 16px; overflow: hidden; aspect-ratio: 4 / 3; background: #141416; text-decoration: none; }
        .hsp-car img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.25s ease; }
        @media (hover: hover) { .hsp-car:hover img { transform: scale(1.03); } }
        .hsp-tag { position: absolute; left: 16px; right: 16px; bottom: 16px; background: rgba(12,12,14,0.78); border-radius: 10px;
          padding: 12px 16px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
        .hsp-tag-name { color: #F0F0F0; font-size: 15px; font-weight: 700; margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hsp-tag-sub { color: #9CA3AF; font-size: 12px; margin: 2px 0 0; }
        .hsp-tag-price { color: #F0F0F0; font-size: 18px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .hsp-skel { border-radius: 16px; aspect-ratio: 4 / 3; background: linear-gradient(90deg,#141416 25%,#1C1C1E 50%,#141416 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @media (max-width: 480px) {
          .hsp { padding: 92px 0 48px; } .hsp-line { margin-bottom: 20px; }
          .hsp-tag { left: 12px; right: 12px; bottom: 12px; padding: 10px 12px; flex-direction: column; align-items: flex-start; gap: 4px; }
          .hsp-tag > div { width: 100%; }
          .hsp-tag-price { font-size: 17px; }
        }
      `}</style>
      <div className="hsp-wrap">
        <div style={{ minWidth: 0 }}>
          {place && <p className="hsp-place"><MapPin size={12} /> {place}</p>}
          <h1 className="hsp-title">{title}</h1>
          {line && <p className="hsp-line">{line}</p>}
          <div className="hsp-search">
            <SearchAutocomplete
              dark
              value={q}
              onChange={setQ}
              placeholder="Search our cars by make, model or variant…"
              onSubmit={(val) => {
                const s = (val || "").trim();
                navigate(s ? `${carsBase}?q=${encodeURIComponent(s)}` : carsBase);
              }}
              inputStyle={{ padding: "14px 16px", fontSize: "15px" }}
            />
          </div>
          <Link to={carsBase} className="primary-btn" style={primaryBtn}>
            Browse our cars <ArrowRight size={14} />
          </Link>
        </div>
        {car ? (
          <Link to={carHref(car)} className="hsp-car" aria-label={`${carName(car)}, ${carPrice(car)}`}>
            <img src={carPhoto(car)} alt={carName(car)} loading="eager" fetchPriority="high" />
            <div className="hsp-tag">
              <div style={{ minWidth: 0 }}>
                <p className="hsp-tag-name">{carName(car)}</p>
                <p className="hsp-tag-sub">Newest arrival{carMonthly(car) ? ` · ${carMonthly(car)}` : ""}</p>
              </div>
              <span className="hsp-tag-price">{carPrice(car)}</span>
            </div>
          </Link>
        ) : loading ? (
          <div className="hsp-skel" aria-hidden />
        ) : null}
      </div>
    </section>
  );
}
