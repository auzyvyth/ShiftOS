import React, { useEffect, useRef, useState } from "react";
import { publicClient } from "../../supabaseClient";
import { withTimeout } from "../../config/marketplaceConfig";
import { SITE_URL } from "../../config/site";
import { DEFAULT_EIR } from "../../utils/financing";
import { defaultDeposit, loanPosterNumbers } from "../../utils/loanPoster";
import { renderLoanPoster } from "../poster/renderLoanPoster";

// The loan poster section on /for-salesmen: the REAL poster renderer
// (POSTER-1, renderLoanPoster.js) drawing a real car, so the picture is the
// product, never a mock-up that can drift from it. One car from the same demo
// account LiveDemo uses (airymotors), public columns via the anon publicClient.
// The seller is a sample: name only, the number masked. Never put a real
// seller's number here, this is a public page (CDP-3).

const DEMO_SELLER_ID = "673d0772-871c-4586-bc67-98f4382503a7"; // airymotors
const COLS = "id,year,brand,model,variant,selling_price,images,mileage,condition,auction_grade,interior_grade";
const SAMPLE = { id: "sample", year: 2021, brand: "Honda", model: "City", variant: "1.5 V", mileage: 38000, condition: "used", selling_price: 72800, images: [] };

export default function PosterDemo({ copy, lang, role }) {
  const canvasRef = useRef(null);
  const [car, setCar] = useState(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    withTimeout(
      publicClient.from("public_car_listings").select(COLS)
        .eq("dealer_id", DEMO_SELLER_ID).eq("status", "available")
        .gt("selling_price", 0).not("images", "is", null)
        .order("created_at", { ascending: false }).limit(1),
      8000,
    ).then(({ data }) => { if (!cancelled) setCar(data?.[0] || SAMPLE); })
      .catch(() => { if (!cancelled) setCar(SAMPLE); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!car || !canvasRef.current) return;
    const price = Number(car.selling_price);
    const numbers = loanPosterNumbers({ price, deposit: defaultDeposit(price), rate: DEFAULT_EIR, basis: "eir" });
    if (!numbers.ok) return;
    renderLoanPoster(canvasRef.current, {
      car,
      seller: { full_name: "Ahmad", job_title: role, whatsapp_number: "01X-XXX XXXX" },
      numbers,
      lang,
      pageUrl: `${SITE_URL}/s/ahmad`,
      dpr: 1,
    }).then(() => setDrawn(true)).catch(() => {});
  }, [car, lang, role]);

  return (
    <figure className="pd" aria-label={copy.aria}>
      <style>{CSS}</style>
      <div className="pd-frame">
        <canvas ref={canvasRef} className={`pd-canvas${drawn ? " is-on" : ""}`} />
      </div>
      <figcaption className="pd-cap">{copy.caption}</figcaption>
    </figure>
  );
}

const CSS = `
  .pd { margin: 0; width: 100%; max-width: 380px; }
  .pd-frame { position: relative; aspect-ratio: 4 / 5; border-radius: 18px; overflow: hidden; background: #0b0f17; box-shadow: 0 24px 60px rgba(10,10,10,0.16); }
  .pd-canvas { display: block; width: 100%; height: 100%; opacity: 0; transition: opacity .3s; }
  .pd-canvas.is-on { opacity: 1; }
  .pd-cap { font-size: 12px; color: #6b7280; text-align: center; line-height: 1.5; margin: 10px 0 0; }
`;
