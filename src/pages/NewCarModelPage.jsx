import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "../supabaseClient";
import MarketplaceHeader from "../components/MarketplaceHeader";
import MarketplaceFooter from "../components/MarketplaceFooter";
import NotFoundPage from "./NotFoundPage";
import { isSubdomain } from "../hooks/useTenant";
import { sellerWaUrl } from "../utils/sellerWhatsApp";
import { replyTimeLabel } from "../utils/agentTrust";
import { trackEvent } from "../utils/analytics";
import {
  PRICE_ZONES, rm, fmtDate, brandFromSlug, modelRows, newModelCopy, newModelPath,
} from "../utils/newCars";

// /new-cars/:brand/:model -- NEWCAR-1, "the salesman is the product".
//
// ONE page per model, never a card per advisor: the brand sets the price, so a
// marketplace of 30 identical Saga cards would be noise. The page states the
// official price once (per zone, from new_car_models) and then lists the
// ADVISORS who sell it, compared on what actually differs: where they are and
// their measured reply time (get_new_model_advisors). No phone numbers ship:
// WhatsApp goes through /api/wa by slug (CDP-3).
//
// A zone with no price entered says "ask an advisor" -- never the Peninsular
// number, which an East Malaysia buyer cannot get.
const SITE = "https://xdrive.my";

export default function NewCarModelPage() {
  const { brand: bSlug, model: mSlug } = useParams();
  const brand = brandFromSlug(bSlug);
  const [rows, setRows] = useState(null);
  // A failed read is "couldn't load", never "this model doesn't exist".
  const [loadError, setLoadError] = useState(false);
  const [advisors, setAdvisors] = useState(null);
  const [advError, setAdvError] = useState(false);
  const [zone, setZone] = useState("peninsular");

  useEffect(() => {
    if (!brand) return;
    let alive = true;
    supabase
      .from("new_car_models")
      .select("id, brand, model, variant, price_peninsular, price_sabah_sarawak, price_labuan, price_langkawi, effective_from, source_url, is_active, sort_order")
      .eq("brand", brand)
      .eq("is_active", true)
      .order("sort_order").order("price_peninsular")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setLoadError(true);
        else setRows(modelRows(data, mSlug));
      });
    return () => { alive = false; };
  }, [brand, mSlug]);

  const model = rows?.[0]?.model || null;

  useEffect(() => {
    if (!brand || !model) return;
    let alive = true;
    supabase.rpc("get_new_model_advisors", { p_brand: brand, p_model: model }).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setAdvError(true); setAdvisors([]); }
      else setAdvisors(data || []);
    });
    return () => { alive = false; };
  }, [brand, model]);

  const zoneCol = PRICE_ZONES.find((z) => z.key === zone)?.col || "price_peninsular";
  // Advisors in the buyer's chosen zone first; the RPC already ranks verified
  // + fastest measured reply at the top within that.
  const sorted = useMemo(() => {
    const list = advisors || [];
    return [...list.filter((a) => a.price_zone === zone), ...list.filter((a) => a.price_zone !== zone)];
  }, [advisors, zone]);

  if (isSubdomain()) return <Navigate to="/cars" replace />;
  if (!brand || (rows && rows.length === 0)) return <NotFoundPage />;

  const copy = model ? newModelCopy(brand, model, rows) : null;
  const canonical = model ? `${SITE}${newModelPath(brand, model)}` : null;
  const latest = rows?.reduce((d, r) => (r.effective_from > d ? r.effective_from : d), "") || "";

  const waFor = (a) => (a.has_whatsapp
    ? sellerWaUrl({ slug: a.slug, text: `Hi ${(a.full_name || "").split(" ")[0]}, I saw you on XDrive. I'm interested in the new ${brand} ${model}.` })
    : null);

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
        </Helmet>
      )}
      <style>{CSS}</style>
      <MarketplaceHeader />
      <main className="ncm">
        <div className="ncm-wrap">
          {loadError ? (
            <p className="ncm-intro">Couldn't load prices right now. Please refresh to try again.</p>
          ) : !copy ? (
            <p className="ncm-intro">Loading...</p>
          ) : (
            <>
              <header className="ncm-head">
                <h1 className="ncm-h1">{copy.h1}</h1>
                <p className="ncm-intro">{copy.intro}</p>
              </header>

              <section>
                <h2 className="ncm-h2">Official price</h2>
                <div className="ncm-zones" role="group" aria-label="Your region">
                  {PRICE_ZONES.map((z) => (
                    <button key={z.key} type="button" aria-pressed={zone === z.key} onClick={() => setZone(z.key)}>{z.label}</button>
                  ))}
                </div>
                <div className="ncm-card">
                  {rows.map((r) => (
                    <div key={r.id} className="ncm-row">
                      <span>{brand} {r.model} {r.variant}</span>
                      <b>{rm(r[zoneCol]) || "Ask an advisor"}</b>
                    </div>
                  ))}
                </div>
                <p className="ncm-note">
                  On the road without insurance, as published by {brand}{latest ? `, latest change ${fmtDate(latest)}` : ""}. Insurance, accessories and any promotion are quoted by the advisor.
                </p>
              </section>

              <section className="ncm-sec">
                <h2 className="ncm-h2">Advisors who sell it {sorted.length > 0 && <span className="ncm-count">{sorted.length}</span>}</h2>
                {advisors === null ? (
                  <p className="ncm-note">Loading advisors...</p>
                ) : sorted.length === 0 ? (
                  <div className="ncm-card ncm-empty">
                    <p>{advError ? "Couldn't load advisors right now. Please refresh to try again." : `No advisor lists the ${brand} ${model} on XDrive yet.`}</p>
                    {!advError && <p>Sell {brand}? <Link to="/for-salesmen">Put your page on XDrive</Link>.</p>}
                  </div>
                ) : (
                  <div className="ncm-adv">
                    {sorted.map((a) => {
                      const reply = replyTimeLabel({ median_minutes: a.reply_median_minutes, samples: a.reply_samples });
                      const where = [a.city, a.state].filter(Boolean).join(", ");
                      const wa = waFor(a);
                      return (
                        <div key={a.slug} className="ncm-card ncm-a">
                          <div className="ncm-a-top">
                            {a.avatar_url
                              ? <img src={a.avatar_url} alt="" className="ncm-av" loading="lazy" />
                              : <span className="ncm-av ncm-av-i" aria-hidden="true">{(a.full_name || "A")[0].toUpperCase()}</span>}
                            <div style={{ minWidth: 0 }}>
                              <p className="ncm-name">{a.full_name}{a.is_verified && <span className="ncm-ver">Verified</span>}</p>
                              {where && <p className="ncm-sub">{where}</p>}
                              {reply && <p className="ncm-sub">{reply}</p>}
                            </div>
                          </div>
                          <div className="ncm-a-btns">
                            <Link to={`/s/${a.slug}`}>View page</Link>
                            {wa && (
                              <a href={wa} target="_blank" rel="noopener noreferrer" className="ncm-primary"
                                onClick={() => trackEvent(supabase, "whatsapp_click", { salesman_slug: a.slug, metadata: { source: "new_model_page", model: `${brand} ${model}` } })}>
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
          <p className="ncm-foot"><Link to="/showroom">Browse used cars</Link></p>
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}

// Light marketplace surface, same tokens as UsedCarsHubPage (DESIGN.md).
const CSS = `
  .ncm { background: #F7F6F2; min-height: 100vh; font-family: var(--xd-font-body, 'Outfit', system-ui); color: #111827; }
  .ncm-wrap { max-width: 860px; margin: 0 auto; padding: 24px clamp(16px, 4vw, 48px) 72px; }
  .ncm-head { margin-bottom: 28px; }
  .ncm-h1 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(2rem, 6vw, 2.8rem); letter-spacing: 0.02em; line-height: 1; color: #0f1115; margin: 0 0 12px; }
  .ncm-intro { font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0; }
  .ncm-h2 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(22px, 3vw, 30px); letter-spacing: 0.02em; color: #0f1115; margin: 0 0 12px; display: flex; align-items: baseline; gap: 8px; }
  .ncm-count { font-family: var(--xd-font-body, 'Outfit', system-ui); font-size: 13px; font-weight: 600; color: #6b7280; }
  .ncm-sec { margin-top: 40px; }
  .ncm-zones { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .ncm-zones button { min-height: 36px; padding: 6px 12px; border-radius: 8px; background: #fff; border: 1px solid rgba(0,0,0,0.12); color: #4b5563; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .ncm-zones button[aria-pressed="true"] { border-color: #0f1115; color: #0f1115; }
  .ncm-card { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; }
  .ncm-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; font-size: 14px; }
  .ncm-row + .ncm-row { border-top: 1px solid rgba(0,0,0,0.06); }
  .ncm-row span { color: #374151; min-width: 0; }
  .ncm-row b { flex-shrink: 0; font-variant-numeric: tabular-nums; color: #111827; }
  .ncm-note { font-size: 12.5px; line-height: 1.6; color: #6b7280; margin: 10px 0 0; }
  .ncm-empty { padding: 20px 16px; font-size: 14px; color: #4b5563; }
  .ncm-empty p { margin: 0; }
  .ncm-empty p + p { margin-top: 6px; }
  .ncm-empty a, .ncm-foot a { color: #111827; font-weight: 600; }
  .ncm-adv { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; }
  .ncm-a { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .ncm-a-top { display: flex; gap: 12px; align-items: center; min-width: 0; }
  .ncm-av { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #EDEAE3; }
  .ncm-av-i { display: inline-flex; align-items: center; justify-content: center; font-weight: 700; color: #4b5563; }
  .ncm-name { margin: 0; font-size: 15px; font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; }
  .ncm-ver { margin-left: 8px; font-size: 11px; font-weight: 600; color: #15803d; }
  .ncm-sub { margin: 2px 0 0; font-size: 12.5px; color: #6b7280; }
  .ncm-a-btns { display: flex; gap: 8px; }
  .ncm-a-btns a { flex: 1; min-width: 0; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; border: 1px solid rgba(0,0,0,0.12); color: #111827; }
  .ncm-a-btns a.ncm-primary { background: #dc2626; border-color: #dc2626; color: #fff; }
  .ncm-foot { margin-top: 40px; font-size: 14px; color: #6b7280; }
`;
