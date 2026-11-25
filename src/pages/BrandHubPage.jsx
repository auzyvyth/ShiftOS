import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ChevronRight } from "lucide-react";
import { publicClient } from "../supabaseClient";
import MarketplaceHeader from "../components/MarketplaceHeader";
import MarketplaceFooter from "../components/MarketplaceFooter";
import NotFoundPage from "./NotFoundPage";
import { isSubdomain } from "../hooks/useTenant";
import { useMarketplaceTracking } from "../hooks/useMarketplaceTracking";
import { SITE_URL } from "../config/site";
import { brandFromSlug, NEW_CAR_BRANDS } from "../utils/newCars";
import { rmLoan, loanPath } from "../utils/brandLoan";
import { hubPath, hubModels, hubGroups, hubFaqs, hubCopy, hubJsonLd } from "../utils/brandHub";

// BRAND-HUB: /new-cars/:brand. All words and numbers come from src/utils/brandHub.js
// (shared with api/og.js). Photos are ours: new_car_model_media.
export default function BrandHubPage() {
  useMarketplaceTracking();
  const { brand: bSlug } = useParams();
  const brand = brandFromSlug(bSlug);
  const [rows, setRows] = useState(null);
  const [media, setMedia] = useState({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!brand) return undefined;
    let alive = true;
    setRows(null); setFailed(false);
    Promise.all([
      publicClient.from("new_car_models")
        .select("id, brand, model, variant, body_type, fuel_type, price_peninsular, is_active, specs")
        .eq("brand", brand).eq("is_active", true),
      publicClient.from("new_car_model_media").select("model, images").eq("brand", brand),
    ]).then(([m, p]) => {
      if (!alive) return;
      if (m.error) { setFailed(true); return; }
      setRows(m.data || []);
      setMedia(Object.fromEntries((p.data || []).map((x) => [x.model, x.images || []])));
    });
    return () => { alive = false; };
  }, [brand]);

  const models = useMemo(() => (brand && rows ? hubModels(brand, rows, media) : []), [brand, rows, media]);
  const groups = useMemo(() => hubGroups(brand, models), [brand, models]);
  const faqs = useMemo(() => hubFaqs(brand, models), [brand, models]);
  const copy = useMemo(() => (models.length ? hubCopy(brand, models) : null), [brand, models]);

  if (!brand || isSubdomain()) return <NotFoundPage />;
  if (rows && !models.length) return <NotFoundPage />;

  return (
    <>
      {copy && (
        <Helmet>
          <title>{copy.title}</title>
          <meta name="description" content={copy.description} />
          <link rel="canonical" href={`${SITE_URL}${hubPath(brand)}`} />
          {hubJsonLd(brand, models, faqs, SITE_URL).map((o, i) => (
            <script key={i} type="application/ld+json">{JSON.stringify(o)}</script>
          ))}
        </Helmet>
      )}
      <style>{CSS}</style>
      <MarketplaceHeader />
      <main className="bh">
        <div className="bh-wrap">
          <p className="bh-crumb"><Link to="/">Drevo</Link> <ChevronRight size={12} /> <b>New {brand}</b></p>
          <h1 className="bh-h1">{copy ? copy.h1 : `New ${brand} price in Malaysia`}</h1>
          {copy && <p className="bh-lead">{copy.intro}</p>}
          {failed && <p className="bh-msg">Couldn't load the models right now. Please refresh to try again.</p>}
          {!rows && !failed && <p className="bh-msg">Loading...</p>}

          {models.length > 0 && (
            <>
              <h2 className="bh-h2">All {brand} models</h2>
              <ul className="bh-grid">
                {models.map((m) => <ModelCard key={m.model} m={m} />)}
              </ul>
              <p className="bh-note">Prices are official, for Peninsular Malaysia, on the road without insurance. Sabah, Sarawak, Labuan and Langkawi are shown on each model page.</p>

              {groups.map((g) => (
                <section key={g.key} className="bh-sec">
                  <h2 className="bh-h2">{g.h2}</h2>
                  <p className="bh-p">{g.text}</p>
                  <ul className="bh-links">
                    {g.ms.map((m) => <li key={m.model}><Link to={m.path}>{m.name}</Link> <span>from {rmLoan(m.from)}</span></li>)}
                  </ul>
                </section>
              ))}

              <section className="bh-sec">
                <h2 className="bh-h2">{copy.malay.h2}</h2>
                <p className="bh-p">{copy.malay.text}</p>
                <p className="bh-p"><Link className="bh-cta" to={copy.malay.loanHref || loanPath(brand)}>{copy.malay.loanLabel}</Link></p>
              </section>

              <section className="bh-sec">
                <h2 className="bh-h2">{brand} questions</h2>
                {faqs.map((f) => (
                  <details key={f.q} className="bh-faq"><summary>{f.q}</summary><p>{f.a}</p></details>
                ))}
              </section>

              <nav className="bh-sec" aria-label="Other brands">
                <h2 className="bh-h2">Other new car brands</h2>
                <ul className="bh-links">
                  {NEW_CAR_BRANDS.filter((b) => b !== brand).map((b) => <li key={b}><Link to={hubPath(b)}>New {b}</Link></li>)}
                </ul>
              </nav>
            </>
          )}
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}

function ModelCard({ m }) {
  return (
    <li className="bh-card">
      <Link to={m.path} className="bh-card-a">
        <span className="bh-img">
          {m.photo ? <img src={m.photo} alt={m.name} loading="lazy" width="400" height="225" /> : <span className="bh-noimg" aria-hidden="true" />}
        </span>
        <span className="bh-name">{m.name}</span>
        <span className="bh-price">from {rmLoan(m.from)}</span>
        <span className="bh-meta">{m.nVariants} {m.nVariants === 1 ? "variant" : "variants"}{m.fuels.length ? ` · ${m.fuels.join(" / ")}` : ""}{m.seats ? ` · ${m.seats} seats` : ""}</span>
      </Link>
    </li>
  );
}

const CSS = `
  .bh { background: #F7F6F2; min-height: 100vh; font-family: var(--xd-font-body, 'Outfit', system-ui); color: #111827; }
  .bh-wrap { max-width: 1100px; margin: 0 auto; padding: 14px 16px 48px; }
  .bh-crumb { display: flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: #6b7280; margin: 0 0 10px; }
  .bh-crumb a { color: #6b7280; text-decoration: none; } .bh-crumb b { color: #111827; }
  .bh-h1 { margin: 2px 0 0; font-size: clamp(24px, 4vw, 34px); font-weight: 800; letter-spacing: -.01em; line-height: 1.15; }
  .bh-lead { margin: 6px 0 18px; font-size: 14.5px; line-height: 1.55; color: #374151; max-width: 720px; }
  .bh-msg { color: #6b7280; padding: 24px 0; }
  .bh-h2 { margin: 28px 0 10px; font-size: 18px; font-weight: 800; }
  .bh-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (min-width: 640px) { .bh-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (min-width: 960px) { .bh-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .bh-card { background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(15,23,42,.08); overflow: hidden; min-width: 0; }
  .bh-card-a { display: block; text-decoration: none; color: inherit; padding-bottom: 12px; }
  .bh-img { display: block; aspect-ratio: 16 / 9; background: #fff; }
  .bh-img img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .bh-noimg { display: block; width: 100%; height: 100%; background: #F4F3EF; }
  .bh-name, .bh-price, .bh-meta { display: block; padding: 0 12px; }
  .bh-name { margin-top: 8px; font-size: 15px; font-weight: 800; }
  .bh-price { font-size: 14px; font-weight: 800; color: #dc2626; font-variant-numeric: tabular-nums; }
  .bh-meta { margin-top: 2px; font-size: 12.5px; color: #6b7280; }
  .bh-note { margin: 10px 0 0; font-size: 12.5px; line-height: 1.5; color: #6b7280; }
  .bh-sec { max-width: 820px; }
  .bh-p { margin: 0 0 8px; font-size: 14.5px; line-height: 1.6; color: #374151; }
  .bh-links { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .bh-links li { background: #fff; border-radius: 12px; box-shadow: 0 0 0 1px rgba(15,23,42,.08); padding: 8px 12px; font-size: 13.5px; }
  .bh-links a { font-weight: 700; color: #111827; text-decoration: none; } .bh-links span { color: #6b7280; }
  .bh-cta { display: inline-block; background: #dc2626; color: #fff; font-weight: 700; padding: 10px 16px; border-radius: 12px; text-decoration: none; }
  .bh-faq { background: #fff; border-radius: 12px; box-shadow: 0 0 0 1px rgba(15,23,42,.08); padding: 12px 14px; margin-bottom: 8px; }
  .bh-faq summary { cursor: pointer; font-weight: 700; font-size: 14.5px; }
  .bh-faq p { margin: 8px 0 0; font-size: 14px; line-height: 1.55; color: #374151; }
`;
