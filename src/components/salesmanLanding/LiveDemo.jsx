import React, { Suspense, lazy, useEffect, useState } from "react";
import { publicClient } from "../../supabaseClient";
import { withTimeout } from "../../config/marketplaceConfig";
import { LIVE_DEMO } from "../../config/salesmanLandingCopy";

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
const COLS = "id,year,brand,model,variant,selling_price,images,mileage,transmission";
const SAMPLE = [{ id: "sample", year: 2021, brand: "Honda", model: "City", variant: "1.5 V", mileage: 38000, transmission: "Auto", selling_price: 72800, images: [] }];

export default function LiveDemo() {
  const [cars, setCars] = useState(null); // null = loading
  const [sample, setSample] = useState(false);

  useEffect(() => {
    let cancelled = false;
    withTimeout(
      publicClient.from("public_car_listings").select(COLS)
        .eq("dealer_id", DEMO_SELLER_ID).in("status", ["available", "reserved"])
        .order("created_at", { ascending: false }).limit(12),
      8000,
    ).then(({ data, error }) => {
      if (cancelled) return;
      const live = !error && Array.isArray(data) ? data.filter((c) => Number(c.selling_price) > 0) : [];
      setSample(!live.length);
      setCars(live.length ? live : SAMPLE);
    }).catch(() => { if (!cancelled) { setSample(true); setCars(SAMPLE); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <figure className="ld" aria-label={LIVE_DEMO.label}>
      <style>{CSS}</style>
      <div className="ld-box">
        {cars ? (
          <Suspense fallback={<div className="ld-skel" />}>
            <LivePresenter listings={cars} embedded onClose={() => {}} />
          </Suspense>
        ) : <div className="ld-skel" />}
      </div>
      <figcaption className="ld-note">{sample ? LIVE_DEMO.sampleCaption : LIVE_DEMO.caption}</figcaption>
    </figure>
  );
}

const CSS = `
  .ld { margin: 0; width: 100%; }
  .ld-box { position: relative; width: 100%; aspect-ratio: 9 / 16; max-height: 760px; border-radius: 22px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 24px 60px rgba(10,10,10,0.12); background: #EBEAE8; }
  .ld-skel { position: absolute; inset: 0; background: #EBEAE8; }
  .ld-note { font-size: 12px; color: #6b7280; text-align: center; line-height: 1.5; margin: 10px 0 0; }
`;
