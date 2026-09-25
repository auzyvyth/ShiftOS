import React, { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "../supabaseClient";
import MarketplaceHeader from "../components/MarketplaceHeader";
import MarketplaceFooter from "../components/MarketplaceFooter";
import ShowroomCard, { ShowroomCardSkeleton } from "../components/ShowroomCard";
import { useCTAContext } from "../hooks/useCTAContext";
import { isSubdomain } from "../hooks/useTenant";
import { CAR_FIELDS } from "../config/marketplaceConfig";
import NotFoundPage from "./NotFoundPage";
import {
  HUB_BASE, HUB_LIVE, HUB_ROW_COLS, buildHubs, findHub, hubCopy, hubCrumbs,
  hubCarFilter, faqLd, breadcrumbLd,
} from "../utils/modelHubs";

// Brand/model landing pages: /used-cars, /used-cars/:brand, /used-cars/:brand/:model.
// These exist so a car can be found by the model a buyer types into Google
// ("used Toyota Alphard"): /showroom filters are query strings that canonicalise
// to /showroom and can never be indexed on their own. All grouping and copy
// comes from src/utils/modelHubs.js, which api/og.js also renders for crawlers —
// so the page Google indexes and the page a buyer lands on say the same thing.
const SITE = "https://xdrive.my";

export default function UsedCarsHubPage() {
  const { brand: bSlug, model: mSlug } = useParams();
  const ctaCtx = useCTAContext();
  const [hubs, setHubs] = useState(null);
  const [cars, setCars] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("public_car_listings")
      .select(HUB_ROW_COLS)
      .in("status", [...HUB_LIVE, "sold"])
      .limit(5000)
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e.message);
        else setHubs(buildHubs(data || []));
      });
    return () => { alive = false; };
  }, []);

  const { brand, model } = hubs ? findHub(hubs, bSlug, mSlug) : { brand: null, model: null };
  const missing = hubs && ((bSlug && !brand) || (mSlug && !model));

  useEffect(() => {
    if (!brand) { setCars(null); return; }
    let alive = true;
    setCars(null);
    supabase
      .from("public_car_listings")
      .select(CAR_FIELDS)
      .in("status", HUB_LIVE)
      .or(hubCarFilter(brand, model))
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e.message);
        else setCars(data || []);
      });
    return () => { alive = false; };
  }, [brand?.slug, model?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isSubdomain()) return <Navigate to="/cars" replace />;
  if (missing) return <NotFoundPage />;

  const copy = hubs ? hubCopy(brand, model) : null;
  const crumbs = hubCrumbs(brand, model);
  const canonical = `${SITE}${model ? model.path : brand ? brand.path : HUB_BASE}`;
  const siblings = brand ? brand.models.filter((m) => m.slug !== model?.slug) : [];

  return (
    <>
      {copy && (
        <Helmet>
          <title>{copy.title}</title>
          <meta name="description" content={copy.description} />
          <link rel="canonical" href={canonical} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={copy.title} />
          <meta property="og:description" content={copy.description} />
          <meta property="og:url" content={canonical} />
          <script type="application/ld+json">{JSON.stringify(breadcrumbLd(crumbs, SITE))}</script>
          {copy.faqs.length > 0 && <script type="application/ld+json">{JSON.stringify(faqLd(copy.faqs))}</script>}
        </Helmet>
      )}
      <style>{CSS}</style>
      <MarketplaceHeader />
      <main className="uch">
        <div className="uch-wrap">
          <nav className="uch-crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <React.Fragment key={c.path}>
                {i > 0 && <span aria-hidden="true">›</span>}
                {i === crumbs.length - 1
                  ? <span aria-current="page">{c.name}</span>
                  : <Link to={c.path}>{c.name}</Link>}
              </React.Fragment>
            ))}
          </nav>

          {error && <p className="uch-intro">Could not load cars right now. Please refresh to try again.</p>}

          {copy && (
            <header className="uch-head">
              <h1 className="uch-h1">{copy.h1}</h1>
              <p className="uch-intro">{copy.intro}</p>
            </header>
          )}

          {/* Index: every brand with its models */}
          {hubs && !brand && (
            <div className="uch-index">
              {hubs.map((b) => (
                <section key={b.slug} className="uch-brand">
                  <h2 className="uch-h2"><Link to={b.path}>{b.brand}</Link> <span className="uch-count">{b.count}</span></h2>
                  <div className="uch-chips">
                    {b.models.map((m) => (
                      <Link key={m.slug} to={m.path} className="uch-chip">{m.model} <span>{m.count}</span></Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Brand page: its models as chips, above the cars */}
          {brand && !model && brand.models.length > 1 && (
            <div className="uch-chips uch-chips-top">
              {brand.models.map((m) => (
                <Link key={m.slug} to={m.path} className="uch-chip">{m.model} <span>{m.count}</span></Link>
              ))}
            </div>
          )}

          {brand && (
            <div className="uch-grid">
              {cars === null
                ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="uch-cell"><ShowroomCardSkeleton /></div>)
                : cars.map((car) => <div key={car.id} className="uch-cell"><ShowroomCard car={car} ctaContext={ctaCtx} /></div>)}
            </div>
          )}

          {model && siblings.length > 0 && (
            <section className="uch-more">
              <h2 className="uch-h2">Other {brand.brand} models</h2>
              <div className="uch-chips">
                {siblings.map((m) => (
                  <Link key={m.slug} to={m.path} className="uch-chip">{m.model} <span>{m.count}</span></Link>
                ))}
              </div>
            </section>
          )}

          {copy && copy.faqs.length > 0 && (
            <section className="uch-faq">
              <h2 className="uch-h2">Good to know</h2>
              {copy.faqs.map((f) => (
                <div key={f.q} className="uch-faq-item">
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </section>
          )}

          <p className="uch-foot">
            <Link to="/showroom">Browse all used cars</Link>
            {brand && <> · <Link to={HUB_BASE}>All brands and models</Link></>}
          </p>
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}

// Tokens and scales from DESIGN.md: light marketplace surface, 1360 container,
// one gutter, flex-wrap card grid, ink-on-neutral chips (no pills, no red chips).
const CSS = `
  .uch { background: #F7F6F2; min-height: 100vh; font-family: 'Outfit', sans-serif; color: #111827; }
  .uch-wrap { max-width: 1360px; margin: 0 auto; padding: 24px clamp(20px, 4vw, 48px) 72px; }
  .uch-crumbs { display: flex; flex-wrap: wrap; gap: 6px; font-size: 13px; color: #6b7280; margin-bottom: 16px; }
  .uch-crumbs a { color: #4b5563; text-decoration: none; }
  .uch-crumbs a:hover { color: #111827; text-decoration: underline; }
  .uch-crumbs [aria-current] { color: #111827; font-weight: 600; }
  .uch-head { margin-bottom: 24px; max-width: 760px; }
  .uch-h1 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(1.8rem, 5vw, 2.6rem); letter-spacing: 0.02em; line-height: 1; color: #0f1115; margin: 0 0 12px; }
  .uch-intro { font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0; }
  .uch-h2 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(22px, 3vw, 32px); letter-spacing: 0.02em; color: #0f1115; margin: 0 0 12px; }
  .uch-h2 a { color: inherit; text-decoration: none; }
  .uch-h2 a:hover { color: #dc2626; }
  .uch-count { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; color: #6b7280; }
  .uch-index { display: grid; gap: 28px; }
  .uch-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .uch-chips-top { margin-bottom: 24px; }
  .uch-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 8px 12px; border-radius: 8px;
    background: #ffffff; border: 1px solid rgba(0,0,0,0.12); color: #111827; font-size: 13px; font-weight: 600; text-decoration: none;
    transition: border-color .15s ease, background .15s ease; }
  .uch-chip span { color: #6b7280; font-weight: 500; }
  .uch-chip:hover { border-color: #0f1115; }
  .uch-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; }
  .uch-cell { flex: 1 1 280px; max-width: 340px; min-width: 0; }
  .uch-more, .uch-faq { margin-top: 48px; }
  .uch-faq { max-width: 760px; }
  .uch-faq-item { padding: 16px 0; border-top: 1px solid rgba(0,0,0,0.06); }
  .uch-faq-item h3 { font-size: 15px; font-weight: 600; margin: 0 0 6px; color: #111827; }
  .uch-faq-item p { font-size: 14px; line-height: 1.6; margin: 0; color: #4b5563; }
  .uch-foot { margin-top: 40px; font-size: 14px; color: #6b7280; }
  .uch-foot a { color: #111827; font-weight: 600; }
`;
