import React, { Suspense, lazy, useEffect, useState } from "react";
import { publicClient } from "../../supabaseClient";
import { withTimeout } from "../../config/marketplaceConfig";

// The /for-salesmen hero: the REAL Live presentation (LivePresenter.jsx) in its
// `embedded` demo mode, fed with real cars, so a visiting seller can tap
// Cars / Budget / Docs, change the deposit and see the actual tool. No copy of
// the presenter lives here: change the presenter and this changes with it.
//
// Cars come from the owner's own seller account (airymotors), read the same
// way its mini page /s/airymotors reads them, so #N matches that page. Public
// columns only, through the anon publicClient (never waits on a login). If the
// read fails or the account has nothing live, one sample car stands in and the
// caption says so. No contact box: the demo never shows a seller's number.

const LivePresenter = lazy(() => import("../live/LivePresenter"));

const DEMO_SELLER_ID = "673d0772-871c-4586-bc67-98f4382503a7"; // airymotors
// A new-car card leads the demo (owner, 2026-10-18), so a visiting advisor sees
// the variant switch: the Proton Saga card on the example page (premiummotors,
// EXAMPLE_PAGE in salesmanLandingCopy.js). Picked by model, not by id, so a
// re-made card still shows; if it is gone the demo simply starts at the used cars.
const CARD_SELLER_ID = "f92eb826-e99e-4d43-bc26-8b5a1540b717"; // premiummotors
const COLS = "id,year,brand,model,variant,selling_price,images,mileage,transmission,condition,state,is_model_card";
const SAMPLE = [{ id: "sample", year: 2021, brand: "Honda", model: "City", variant: "1.5 V", mileage: 38000, transmission: "Auto", selling_price: 72800, images: [] }];

// `copy` is landingCopy(lang).demo; `lang` starts the presenter in the page's
// language (remounted on a switch, so the demo follows the page).
export default function LiveDemo({ copy, lang }) {
  const [cars, setCars] = useState(null); // null = loading
  const [sample, setSample] = useState(false);
  const [hasCard, setHasCard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const used = withTimeout(
      publicClient.from("public_car_listings").select(COLS)
        .eq("dealer_id", DEMO_SELLER_ID).in("status", ["available", "reserved"])
        .order("created_at", { ascending: false }).limit(12),
      8000,
    );
    const card = withTimeout(
      publicClient.from("public_car_listings").select(COLS)
        .eq("dealer_id", CARD_SELLER_ID).eq("is_model_card", true)
        .eq("brand", "Proton").eq("model", "Saga").eq("status", "available").limit(1),
      8000,
    ).catch(() => ({ data: [] }));
    Promise.all([used, card]).then(([{ data, error }, cardRes]) => {
      if (cancelled) return;
      const ok = (rows) => (Array.isArray(rows) ? rows.filter((c) => Number(c.selling_price) > 0) : []);
      const live = [...ok(cardRes?.data), ...(!error ? ok(data) : [])];
      setSample(!live.length);
      setHasCard(live.some((c) => c.is_model_card));
      setCars(live.length ? live : SAMPLE);
    }).catch(() => { if (!cancelled) { setSample(true); setCars(SAMPLE); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <figure className="ld" aria-label={copy.label}>
      <style>{CSS}</style>
      <div className="ld-box">
        {cars ? (
          <Suspense fallback={<div className="ld-skel" />}>
            <LivePresenter key={lang} listings={cars} embedded initialLang={lang} onClose={() => {}}
              officialNew={cars.some((c) => c.is_model_card)} />
          </Suspense>
        ) : <div className="ld-skel" />}
      </div>
      <figcaption className="ld-note">{sample ? copy.sampleCaption : hasCard ? copy.caption : copy.captionUsed}</figcaption>
    </figure>
  );
}

const CSS = `
  .ld { margin: 0; width: 100%; }
  .ld-box { position: relative; width: 100%; aspect-ratio: 9 / 16; max-height: 760px; border-radius: 22px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 24px 60px rgba(10,10,10,0.12); background: #EBEAE8; }
  .ld-skel { position: absolute; inset: 0; background: #EBEAE8; }
  .ld-note { font-size: 12px; color: #6b7280; text-align: center; line-height: 1.5; margin: 10px 0 0; }
`;
