import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Car, Zap, ShieldCheck, MessageSquare, ChevronRight } from "lucide-react";
import { MY_STATES } from "../utils/locations";
import { supabase, publicClient } from "../supabaseClient";
import MarketplaceHeader from "../components/MarketplaceHeader";
import MarketplaceFooter from "../components/MarketplaceFooter";
import ContactGate from "../components/ContactGate";
import NotFoundPage from "./NotFoundPage";
import { isSubdomain } from "../hooks/useTenant";
import { sellerWaUrl } from "../utils/sellerWhatsApp";
import { replyTimeLabel } from "../utils/agentTrust";
import { trackEvent } from "../utils/analytics";
import { sanitizeState } from "../config/marketplaceConfig";
import { SITE_URL } from "../config/site";
import { cdnImg } from "../utils/img";
import { monthlyPayment, DEFAULT_EIR, DEFAULT_LOAN_RATIO, DEFAULT_TENURE_YEARS } from "../utils/financing";
import { LOCAL_NEW_EIR, isLocalNew, variantExtras } from "../utils/liveMaths";
import { calcRoadTaxEst, calcInsuranceAnnual, estAnnualFuel } from "../utils/ownership";
import {
  PRICE_ZONES, rm, fmtDate, brandFromSlug, modelRows, newModelCopy, newModelPath, payWarning, zoneForState, modelDisplayName,
  readBuyerState, saveBuyerState, liveNewCarBrands, colourSwatch, modelFacts, modelLead,
} from "../utils/newCars";

// /new-cars/:brand/:model -- NEWCAR-1, "the salesman is the product". Redesigned 2026-11-22
// (NEWCAR-PAGE, owner: "robotic and empty"): the car first (photos, colours, facts, price +
// monthly), then the variant the buyer wants and what it adds, what it costs a year, then the
// advisors. Every figure comes from new_car_models (price + specs) or the app's one formula for it
// (financing.js, ownership.js); nothing is typed for this page.
//
// The variant + colour the buyer picks ride into the advisor's lead (NEWCAR-PICK): WhatsApp goes
// through ContactGate (name, then the lead via /api/wa + /api/whatsapp-lead with the pick), and the
// message names the variant and colour. The advisor's lead card shows both (SalesmanPremium).
//
// A zone with no price says "Ask an advisor" -- never the Peninsular number. No phone numbers ship
// (CDP-3): WhatsApp goes through /api/wa. Each advisor links to THEIR CARD for this model
// (NEWCAR-STATS); a card visit is what the seller's dashboard counts as a view.
const SITE = SITE_URL;
const SHOWN = 5;

export default function NewCarModelPage() {
  const { brand: bSlug, model: mSlug } = useParams();
  const brand = brandFromSlug(bSlug);
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [others, setOthers] = useState([]);
  const [advisors, setAdvisors] = useState(null);
  const [advError, setAdvError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [pickedId, setPickedId] = useState(null);
  const [colour, setColour] = useState(null);
  const [gate, setGate] = useState(null); // the advisor whose WhatsApp was tapped
  // The buyer's state ORDERS the advisors and picks the starting zone; it never hides anyone.
  const [params, setParams] = useSearchParams();
  const buyerState = sanitizeState(params.get("state") || "") || readBuyerState(MY_STATES);
  const [zone, setZone] = useState(() => zoneForState(buyerState));
  const pickState = (s) => {
    saveBuyerState(s);
    setZone(zoneForState(s));
    setParams(s ? { state: s } : {}, { replace: true });
  };

  useEffect(() => {
    if (!brand) return;
    let alive = true;
    supabase
      .from("new_car_models")
      .select("id, brand, model, variant, price_peninsular, price_sabah_sarawak, price_labuan, price_langkawi, effective_from, source_url, is_active, sort_order, specs")
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
    // The platform's photos for the model (console > New car prices), and the brand's other models.
    publicClient.from("new_car_model_media").select("images").eq("brand", brand).eq("model", model).maybeSingle()
      .then(({ data }) => { if (alive) setPhotos(Array.isArray(data?.images) ? data.images.filter(Boolean) : []); });
    publicClient.from("public_car_listings").select("brand,model,selling_price,images")
      .eq("is_model_card", true).eq("brand", brand).in("status", ["available", "reserved"]).limit(200)
      .then(({ data }) => {
        if (!alive) return;
        const b = liveNewCarBrands(data).find((x) => x.brand === brand);
        setOthers((b?.models || []).filter((m) => m.model !== model));
      });
    return () => { alive = false; };
  }, [brand, model]);

  const zoneCol = PRICE_ZONES.find((z) => z.key === zone)?.col || "price_peninsular";
  // The variants as the shared helpers want them: the price in the buyer's zone.
  const variants = useMemo(() => (rows || []).map((r) => ({
    model_id: r.id, variant: r.variant, price: r[zoneCol] != null ? Number(r[zoneCol]) : null, specs: r.specs || {},
  })), [rows, zoneCol]);
  const priced = variants.filter((v) => v.price != null).sort((a, b) => a.price - b.price);
  const picked = variants.find((v) => v.model_id === pickedId) || priced[0] || variants[0] || null;
  const paints = Array.isArray(picked?.specs?.colours) ? picked.specs.colours : [];
  const paint = paints.includes(colour) ? colour : paints[0] || null;

  // Advisors in the buyer's state first, then the chosen zone; the RPC already ranks verified +
  // fastest measured reply at the top within each group.
  const sorted = useMemo(() => {
    const list = advisors || [];
    const rank = (a) => (buyerState && a.state === buyerState ? 0 : a.price_zone === zone ? 1 : 2);
    return list.map((a, i) => [a, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(([a]) => a);
  }, [advisors, zone, buyerState]);
  const nearCount = buyerState ? sorted.filter((a) => a.state === buyerState).length : 0;
  const stateChips = useMemo(() => {
    const seen = [...new Set((advisors || []).map((a) => a.state).filter(Boolean))];
    return [...new Set([buyerState, ...seen].filter(Boolean))].slice(0, 4);
  }, [advisors, buyerState]);

  useEffect(() => {
    if (!brand || !model) return;
    trackEvent(supabase, "page_view", { metadata: { source: "new_model_page", model: `${modelDisplayName(brand, model)}` } });
  }, [brand, model]);

  if (isSubdomain()) return <Navigate to="/cars" replace />;
  if (!brand || (rows && rows.length === 0)) return <NotFoundPage />;

  const copy = model ? newModelCopy(brand, model, rows) : null;
  const canonical = model ? `${SITE}${newModelPath(brand, model)}` : null;
  const latest = rows?.reduce((d, r) => (r.effective_from > d ? r.effective_from : d), "") || "";
  const zoneLabel = PRICE_ZONES.find((z) => z.key === zone)?.label || "Peninsular";

  // The monthly: 10% down, 7 years, the new Proton/Perodua rate where it applies (the Live
  // presenter and the page budget finder use the same rates), else the standard one.
  const rate = isLocalNew({ condition: "new", brand }) ? LOCAL_NEW_EIR : DEFAULT_EIR;
  const monthlyOf = (p) => (p ? Math.round(monthlyPayment(p * DEFAULT_LOAN_RATIO, rate, DEFAULT_TENURE_YEARS * 12)) : null);
  const price = picked?.price ?? null;
  const monthly = monthlyOf(price);
  const extras = picked ? variantExtras(variants, picked, 5) : { items: [] };
  const below = extras.over ? priced.find((v) => v.variant === extras.over) : null;
  const diff = below && price ? price - below.price : null;
  const facts = modelFacts(picked?.specs);
  const lead = modelLead(picked?.specs, priced[0]?.price);

  // A year of running it, from the app's one formula for each (estimates, labelled so).
  const cc = Number(picked?.specs?.engine_cc) || null;
  const roadTax = cc ? calcRoadTaxEst(cc) : null;
  const insurance = cc && price ? calcInsuranceAnnual(price, cc, buyerState) : null;
  const fuel = cc ? estAnnualFuel({ engine_cc: cc, fuel_type: picked?.specs?.fuel || "petrol" }) : null;
  const pickName = [brand, model, picked?.variant].filter(Boolean).join(" ");

  const waFor = (a) => (a.has_whatsapp
    ? sellerWaUrl({
      slug: a.slug,
      car: a.card_id || undefined,
      text: `Hi ${(a.full_name || "").split(" ")[0]}, I saw you on Drevo. I'm interested in the new ${pickName}${paint ? ` in ${paint}` : ""}.`,
    })
    : null);
  const tapWa = (a) => {
    trackEvent(supabase, "whatsapp_click", {
      car_id: a.card_id || undefined, salesman_slug: a.slug,
      metadata: { source: "new_model_page", model: `${modelDisplayName(brand, model)}`, variant: picked?.variant || null, colour: paint },
    });
  };
  const list = showAll ? sorted : sorted.slice(0, SHOWN);

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
        {loadError ? (
          <p className="ncm-wrap ncm-msg">Couldn't load prices right now. Please refresh to try again.</p>
        ) : !copy ? (
          <p className="ncm-wrap ncm-msg">Loading...</p>
        ) : (
          <div className="ncm-wrap">
            <nav className="ncm-crumb" aria-label="Breadcrumb">
              <Link to="/">New cars</Link> <span>›</span> <span>{brand}</span> <span>›</span> <b>{model}</b>
            </nav>
            <div className="ncm-grid">
              {/* Photos */}
              <section className="ncm-gal-wrap">
                <div className="ncm-gal">
                  {photos.length ? (
                    <div className="ncm-strip" onScroll={(e) => {
                      const el = e.currentTarget;
                      setPhotoIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
                    }}>
                      {photos.map((src, i) => (
                        <img key={src} src={cdnImg(src, 960, 75)} alt={`${modelDisplayName(brand, model)}${i ? ` photo ${i + 1}` : ""}`}
                          loading={i ? "lazy" : "eager"} decoding="async" />
                      ))}
                    </div>
                  ) : (
                    <div className="ncm-nophoto"><Car size={56} strokeWidth={1.3} /></div>
                  )}
                  <span className="ncm-tag">Official price</span>
                  {photos.length > 1 && <span className="ncm-cnt">{photoIdx + 1} / {photos.length}</span>}
                </div>
                {paints.length > 0 && (
                  <div className="ncm-paints" role="group" aria-label="Colour">
                    {paints.map((p) => (
                      <button key={p} type="button" aria-pressed={p === paint} title={p} aria-label={p}
                        onClick={() => setColour(p)} style={{ background: colourSwatch(p) }} />
                    ))}
                    <span>{paint}</span>
                  </div>
                )}
              </section>

              {/* Right column on desktop: name + price, then the advisors (display: contents on a phone). */}
              <div className="ncm-side">
              <section className="ncm-head">
                <p className="ncm-ey">New car · {brand}</p>
                <h1 className="ncm-h1">{brand} {model}</h1>
                {lead && <p className="ncm-lead">{lead}</p>}
                <div className="ncm-price">
                  <div className="ncm-big">
                    <span className="xd-crimson-text">{price ? rm(price) : "Ask an advisor"}</span>
                    {picked?.variant && <small>{picked.variant}</small>}
                  </div>
                  {monthly && (
                    <p className="ncm-mo">or <b>RM {monthly.toLocaleString("en-MY")}/mo</b> · {Math.round((1 - DEFAULT_LOAN_RATIO) * 100)}% down, {DEFAULT_TENURE_YEARS} yrs, {rate}%</p>
                  )}
                  <div className="ncm-zone">
                    Prices for{" "}
                    <label className="ncm-zone-pick">
                      {zoneLabel}
                      <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Region">
                        {PRICE_ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
                      </select>
                    </label>
                    {" "}· Same price at every advisor
                  </div>
                </div>
                {facts.length > 0 && (
                  <div className="ncm-facts">
                    {facts.map((f) => <div key={f.label}><b>{f.value}</b><span>{f.label}</span></div>)}
                  </div>
                )}
              </section>

              {/* Advisors */}
              <section className="ncm-advs" id="advisors">
                <h2 className="ncm-h2">Advisors who sell it {sorted.length > 0 && <small>{buyerState && nearCount ? `${nearCount} in ${buyerState}` : sorted.length}</small>}</h2>
                {sorted.length > 0 && (
                  <div className="ncm-states" role="group" aria-label="Near">
                    {stateChips.map((s) => (
                      <button key={s} type="button" aria-pressed={s === buyerState} onClick={() => pickState(s)}>{s}</button>
                    ))}
                    <label className={`ncm-states-more${buyerState && !stateChips.includes(buyerState) ? " on" : ""}`}>
                      {buyerState ? "Other state" : "Pick your state"}
                      <select value={buyerState} onChange={(e) => pickState(e.target.value)} aria-label="Your state">
                        <option value="">Any state</option>
                        {MY_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                {buyerState && sorted.length > 0 && nearCount === 0 && <p className="ncm-note">None in {buyerState} yet. These advisors can still help.</p>}
                {advisors === null ? (
                  <p className="ncm-note">Loading advisors...</p>
                ) : sorted.length === 0 ? (
                  <div className="ncm-card ncm-empty">
                    <p>{advError ? "Couldn't load advisors right now. Please refresh to try again." : `No advisor lists the ${modelDisplayName(brand, model)} on Drevo yet.`}</p>
                    {!advError && <p>Sell {brand}? <Link to="/for-salesmen">Put your page on Drevo</Link>.</p>}
                  </div>
                ) : (
                  <>
                    <div className="ncm-alist">
                      {list.map((a) => {
                        const reply = replyTimeLabel({ median_minutes: a.reply_median_minutes, samples: a.reply_samples });
                        const where = [...new Set([a.city, a.state].map((x) => (x || "").trim()).filter(Boolean))].join(", ");
                        const to = a.card_slug ? `/showroom/${a.card_slug}` : `/s/${a.slug}`;
                        const wa = waFor(a);
                        const openCard = () => {
                          if (a.card_id) trackEvent(supabase, "card_click", { car_id: a.card_id, salesman_slug: a.slug, metadata: { source: "new_model_page" } });
                        };
                        return (
                          <div key={a.slug} className="ncm-card ncm-a">
                            <Link to={to} onClick={openCard} className="ncm-a-top">
                              {a.avatar_url
                                ? <img src={a.avatar_url} alt="" className="ncm-av" loading="lazy" />
                                : <span className="ncm-av ncm-av-i" aria-hidden="true">{(a.full_name || "A")[0].toUpperCase()}</span>}
                              <span className="ncm-a-who">
                                <span className="ncm-name">{a.full_name}{a.is_verified && <ShieldCheck size={14} className="ncm-tick" aria-label="Verified" />}</span>
                                <span className="ncm-sub">{where || "Location not set"}</span>
                                {reply && <span className="ncm-fact"><Zap size={11} /> {reply}</span>}
                              </span>
                            </Link>
                            {wa && (
                              <button type="button" className="ncm-wa"
                                aria-label={`WhatsApp ${a.full_name} about the ${pickName}`}
                                onClick={() => { tapWa(a); setGate(a); }}>
                                <WaMark /> <span>WhatsApp</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {sorted.length > SHOWN && !showAll && (
                      <button type="button" className="ncm-more" onClick={() => setShowAll(true)}>See all {sorted.length} <ChevronRight size={14} /></button>
                    )}
                  </>
                )}
                <Link to="/find-me" className="ncm-ask"><MessageSquare size={16} /> Ask several advisors at once <small>· they reply to you</small></Link>
                <div className="ncm-safe"><ShieldCheck size={18} /><p>{payWarning(brand)}</p></div>
              </section>

              </div>

              {/* Variants */}
              <section className="ncm-var">
                <h2 className="ncm-h2">Pick a variant</h2>
                <div className="ncm-vchips" role="group" aria-label="Variant">
                  {variants.map((v) => (
                    <button key={v.model_id} type="button" aria-pressed={v.model_id === picked?.model_id}
                      onClick={() => setPickedId(v.model_id)}>
                      {v.variant}<small>{v.price != null ? rm(v.price) : "Ask"}</small>
                    </button>
                  ))}
                </div>
                {extras.items.length > 0 && (
                  <div className="ncm-adds">
                    <p>
                      {extras.over ? `${picked.variant} adds over ${extras.over}` : `${picked.variant} comes with`}
                      {diff > 0 && monthly && below ? ` · +${rm(diff)} (about RM ${(monthly - monthlyOf(below.price)).toLocaleString("en-MY")}/mo)` : ""}
                    </p>
                    <ul>
                      {extras.seats && <li>{extras.seats} seats</li>}
                      {extras.items.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                  </div>
                )}
                <p className="ncm-note">
                  On the road without insurance, as published by {brand}{latest ? `, latest change ${fmtDate(latest)}` : ""}. Insurance, accessories and any promotion are quoted by the advisor.
                </p>
              </section>

              {/* A year of running it */}
              {(roadTax || insurance || fuel) && (
                <section className="ncm-cost">
                  <h2 className="ncm-h2">What it costs a year <small>estimate</small></h2>
                  <div className="ncm-card ncm-costs">
                    {roadTax != null && <div><span>Road tax</span><b>{rm(roadTax)}</b></div>}
                    {insurance != null && <div><span>Insurance<small>first year, no NCD</small></span><b>about {rm(Math.round(insurance / 10) * 10)}</b></div>}
                    {fuel && <div><span>Petrol<small>15,000 km a year</small></span><b>about {rm(Math.round(fuel.rm / 10) * 10)}</b></div>}
                  </div>
                  <p className="ncm-note">Insurance follows the old motor tariff and petrol uses today's RON95 price. Your insurer and your driving decide the real figure.</p>
                </section>
              )}

              {/* The brand's other models */}
              {others.length > 0 && (
                <section className="ncm-other">
                  <h2 className="ncm-h2">Other new {brand}s</h2>
                  <div className="ncm-orow">
                    {others.map((m) => (
                      <Link key={m.model} to={newModelPath(brand, m.model)} className="ncm-oc">
                        <span className="ncm-oimg" style={m.photo ? { backgroundImage: `url("${cdnImg(m.photo, 300, 65)}")` } : undefined}>{!m.photo && <Car size={26} strokeWidth={1.4} />}</span>
                        <span className="ncm-on">{m.model}</span>
                        <span className="ncm-op xd-crimson-text">{m.from ? rm(m.from) : "See prices"}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
            <p className="ncm-foot"><Link to="/showroom">Browse used cars</Link></p>
          </div>
        )}
        {sorted.length > 0 && (
          <div className="ncm-sticky">
            <a href="#advisors"><WaMark /> Ask an advisor · {sorted.length} sell{sorted.length === 1 ? "s" : ""} it</a>
          </div>
        )}
      </main>
      <MarketplaceFooter />
      <ContactGate
        open={!!gate}
        onClose={() => setGate(null)}
        waUrl={gate ? waFor(gate) : null}
        carId={gate?.card_id || null}
        carName={`${pickName}${paint ? ` in ${paint}` : ""}`}
        pick={picked ? { variantId: picked.model_id, colour: paint } : null}
      />
    </>
  );
}

// The WhatsApp mark: green on a neutral key, so the price stays the page's one colour.
function WaMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
      <path fill="#fff" d="M16.5 14.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.4-.3z" />
    </svg>
  );
}

// Light marketplace surface (DESIGN.md): white cards on a soft shadow, no borders, one accent.
const CSS = `
  .ncm { background: #F7F6F2; min-height: 100vh; font-family: var(--xd-font-body, 'Outfit', system-ui); color: #111827; padding-bottom: 76px; }
  .ncm-wrap { max-width: 1180px; margin: 0 auto; padding: 14px 16px 40px; }
  .ncm-msg { padding-top: 40px; color: #6b7280; }
  .ncm-crumb { font-size: 12.5px; font-weight: 600; color: #6b7280; margin-bottom: 10px; }
  .ncm-crumb a { color: #6b7280; text-decoration: none; }
  .ncm-crumb b { color: #111827; }
  .ncm-grid { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "gal" "head" "var" "cost" "advs" "other"; }
  .ncm-side { display: contents; }
  .ncm-gal-wrap { grid-area: gal; min-width: 0; } .ncm-head { grid-area: head; min-width: 0; } .ncm-var { grid-area: var; min-width: 0; }
  .ncm-cost { grid-area: cost; min-width: 0; } .ncm-advs { grid-area: advs; min-width: 0; } .ncm-other { grid-area: other; min-width: 0; }
  .ncm-card { background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
  .ncm-gal { position: relative; border-radius: 18px; overflow: hidden; aspect-ratio: 16 / 10; background: linear-gradient(160deg, #e4e2dc, #cfcdc6); }
  .ncm-strip { display: flex; height: 100%; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .ncm-strip::-webkit-scrollbar { display: none; }
  .ncm-strip img { flex: 0 0 100%; width: 100%; height: 100%; object-fit: cover; scroll-snap-align: start; }
  .ncm-nophoto { height: 100%; display: grid; place-items: center; color: #8f8d86; }
  .ncm-tag { position: absolute; left: 10px; top: 10px; background: rgba(255,255,255,.95); font-size: 11.5px; font-weight: 700; padding: 5px 9px; border-radius: 999px; }
  .ncm-cnt { position: absolute; right: 10px; bottom: 10px; background: rgba(15,17,21,.72); color: #fff; font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 7px; }
  .ncm-paints { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .ncm-paints button { width: 26px; height: 26px; border-radius: 999px; border: 0; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); padding: 0; }
  .ncm-paints button[aria-pressed="true"] { box-shadow: 0 0 0 2px #F7F6F2, 0 0 0 4px #0f1115; }
  .ncm-paints span { font-size: 13px; font-weight: 600; color: #4b5563; margin-left: 2px; }
  .ncm-ey { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #de1c3e; }
  .ncm-h1 { margin: 2px 0 0; font-size: clamp(24px, 4vw, 34px); font-weight: 800; letter-spacing: -.01em; line-height: 1.15; }
  .ncm-lead { margin: 6px 0 0; font-size: 14.5px; line-height: 1.5; color: #374151; }
  .ncm-price { margin-top: 12px; padding: 14px 16px; background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
  .ncm-big { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .ncm-big span { font-size: 28px; font-weight: 800; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
  .ncm-big small { font-size: 14px; font-weight: 600; color: #6b7280; }
  .ncm-mo { margin: 2px 0 0; font-size: 13.5px; color: #6b7280; }
  .ncm-mo b { color: #111827; }
  .ncm-zone { margin-top: 9px; padding-top: 9px; border-top: 1px solid rgba(15,23,42,.08); font-size: 12.5px; color: #6b7280; }
  .ncm-zone-pick { position: relative; font-weight: 700; color: #111827; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .ncm-zone-pick select, .ncm-states-more select { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; font-size: 16px; }
  .ncm-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
  .ncm-facts div { background: #fff; border-radius: 14px; padding: 10px 6px; text-align: center; box-shadow: 0 1px 3px rgba(15,23,42,.08); min-width: 0; }
  .ncm-facts b { display: block; font-size: 15px; font-weight: 800; }
  .ncm-facts span { font-size: 11px; font-weight: 600; color: #6b7280; }
  .ncm-h2 { margin: 0 0 9px; font-size: 16px; font-weight: 800; display: flex; align-items: baseline; gap: 7px; }
  .ncm-h2 small { font-size: 13px; font-weight: 600; color: #6b7280; }
  .ncm-vchips { display: flex; gap: 7px; overflow-x: auto; scrollbar-width: none; padding: 2px; }
  .ncm-vchips::-webkit-scrollbar { display: none; }
  .ncm-vchips button { flex-shrink: 0; text-align: left; padding: 9px 12px; border-radius: 12px; border: 0; background: #fff; box-shadow: 0 0 0 1px rgba(15,23,42,.09); font: inherit; font-size: 13.5px; font-weight: 700; color: #111827; cursor: pointer; line-height: 1.25; }
  .ncm-vchips button small { display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-top: 2px; }
  .ncm-vchips button[aria-pressed="true"] { background: #0f1115; color: #fff; box-shadow: none; }
  .ncm-vchips button[aria-pressed="true"] small { color: rgba(255,255,255,.72); }
  .ncm-adds { margin-top: 10px; background: #fff; border-radius: 14px; padding: 12px 14px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
  .ncm-adds p { margin: 0; font-size: 12.5px; font-weight: 600; color: #6b7280; }
  .ncm-adds ul { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .ncm-adds li { font-size: 12.5px; font-weight: 600; background: #F4F3EF; padding: 6px 9px; border-radius: 8px; }
  .ncm-note { margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: #6b7280; }
  .ncm-costs { padding: 2px 14px; }
  .ncm-costs div { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 11px 0; font-size: 13.5px; font-weight: 600; }
  .ncm-costs div + div { border-top: 1px solid rgba(15,23,42,.07); }
  .ncm-costs small { display: block; font-size: 11.5px; font-weight: 500; color: #6b7280; }
  .ncm-costs b { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ncm-states { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .ncm-states button, .ncm-states-more { position: relative; height: 36px; padding: 0 13px; border-radius: 999px; border: 0; background: #fff; box-shadow: 0 0 0 1px rgba(15,23,42,.09); font: inherit; font-size: 13px; font-weight: 700; color: #111827; cursor: pointer; display: inline-flex; align-items: center; }
  .ncm-states button[aria-pressed="true"], .ncm-states-more.on { background: #0f1115; color: #fff; box-shadow: none; }
  .ncm-alist { display: flex; flex-direction: column; gap: 10px; }
  .ncm-a { padding: 12px 14px; display: flex; align-items: center; gap: 12px; min-width: 0; }
  .ncm-a-top { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
  .ncm-av { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #EDEAE3; }
  .ncm-av-i { display: inline-flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; background: #334155; font-size: 18px; }
  .ncm-a-who { min-width: 0; display: flex; flex-direction: column; }
  .ncm-name { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ncm-tick { color: #de1c3e; flex-shrink: 0; }
  .ncm-sub { font-size: 12.5px; color: #6b7280; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ncm-fact { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 12px; font-weight: 700; background: #F4F3EF; padding: 3px 7px; border-radius: 6px; }
  .ncm-wa { flex-shrink: 0; height: 44px; padding: 0 14px; border-radius: 12px; border: 0; background: #0f1115; color: #fff; display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; }
  @media (max-width: 340px) { .ncm-wa span { display: none; } .ncm-wa { width: 46px; padding: 0; justify-content: center; } }
  .ncm-more { margin: 10px auto 0; display: flex; align-items: center; gap: 2px; background: none; border: 0; font: inherit; font-size: 13.5px; font-weight: 700; color: #111827; cursor: pointer; min-height: 40px; }
  .ncm-ask { margin-top: 12px; height: 48px; border-radius: 13px; background: #fff; box-shadow: 0 0 0 1px rgba(15,23,42,.09); display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 700; color: #111827; text-decoration: none; }
  .ncm-ask small { font-weight: 600; color: #6b7280; font-size: 13px; }
  .ncm-safe { margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: #efede8; display: flex; gap: 10px; align-items: flex-start; }
  .ncm-safe svg { flex-shrink: 0; margin-top: 1px; }
  .ncm-safe p { margin: 0; font-size: 12.5px; line-height: 1.5; color: #374151; }
  .ncm-empty { padding: 18px 16px; font-size: 14px; color: #4b5563; }
  .ncm-empty p { margin: 0; } .ncm-empty p + p { margin-top: 6px; }
  .ncm-empty a, .ncm-foot a { color: #111827; font-weight: 700; }
  .ncm-orow { display: grid; grid-auto-flow: column; grid-auto-columns: 150px; gap: 10px; overflow-x: auto; scrollbar-width: none; padding: 2px; }
  .ncm-orow::-webkit-scrollbar { display: none; }
  .ncm-oc { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,.08); text-decoration: none; color: #111827; display: flex; flex-direction: column; }
  .ncm-oimg { aspect-ratio: 4 / 3; background: #e4e2dc center / cover no-repeat; display: grid; place-items: center; color: #8f8d86; }
  .ncm-on { padding: 9px 11px 0; font-size: 14px; font-weight: 700; }
  .ncm-op { padding: 2px 11px 11px; font-size: 14px; font-weight: 800; width: fit-content; }
  .ncm-foot { margin-top: 28px; font-size: 14px; color: #6b7280; }
  .ncm-sticky { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; padding: 10px 16px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, #F7F6F2 35%); }
  .ncm-sticky a { height: 50px; border-radius: 14px; background: #0f1115; color: #fff; display: flex; align-items: center; justify-content: center; gap: 9px; font-weight: 700; font-size: 15px; text-decoration: none; box-shadow: 0 8px 20px -8px rgba(0,0,0,.45); max-width: 520px; margin: 0 auto; }
  @media (min-width: 980px) {
    .ncm { padding-bottom: 0; }
    .ncm-wrap { padding: 18px 32px 56px; }
    .ncm-grid { grid-template-columns: minmax(0, 1fr) 400px; column-gap: 28px; row-gap: 22px;
      grid-template-areas: "gal side" "var side" "cost side" "other side"; align-items: start; }
    .ncm-side { grid-area: side; display: flex; flex-direction: column; gap: 22px; }
    .ncm-gal { aspect-ratio: 16 / 9; }
    .ncm-sticky { display: none; }
  }
`;
