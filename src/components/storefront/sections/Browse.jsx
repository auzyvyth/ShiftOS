// Browse bar (STOREFRONT-2 stage 4 phase B): brand, model and max price drop-downs and one
// circle per body type, every option taken from the dealer's OWN live cars, so no pick lands
// on an empty page. Submits to /cars with the params it already reads (storefrontStock.js
// browseHref keeps only real options). Hidden while loading and when there is no car.
// While this section is on, the cars section drops its own body-type chips (carsParts.jsx
// CarsToolbar `browseOn`): one row of them on the page, not two.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { PRICE_STEPS } from "@/components/PriceDrumPicker";
import { stockBrands, stockModels, stockPriceSteps, stockBodyTypes, browseHref } from "../../../utils/storefrontStock";
import { useDealerStock } from "./stockParts";
import { FadeIn } from "./ui";
import { wrap, secA, accentOf } from "./shared";

export default function Browse({ tenant, carsBase }) {
  const rows = useDealerStock(tenant?.id);
  const navigate = useNavigate();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  if (!rows || rows.length === 0) return null;
  const brands = stockBrands(rows);
  const models = brand ? stockModels(rows, brand) : [];
  const prices = stockPriceSteps(rows, PRICE_STEPS);
  const bodies = stockBodyTypes(rows);
  const go = (e) => {
    e.preventDefault();
    navigate(browseHref(carsBase, { brand, model, maxPrice }, rows, PRICE_STEPS));
  };

  return (
    <section className="sec-pad" style={{ ...secA, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .sfw { max-width: 920px; margin: 0 auto; text-align: center; }
        .sfw-head .sfv-eyebrow { justify-content: center; }
        .sfw-bar { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; padding: 12px; margin-top: 28px;
          background: var(--sf-card, #111113); border: 1px solid var(--sf-border, rgba(255,255,255,0.08)); border-radius: 16px; }
        .sfw-sel { appearance: none; -webkit-appearance: none; width: 100%; min-width: 0; height: 52px; padding: 0 40px 0 16px;
          border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;
          background: var(--sf-bg, #0C0C0E) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 16px center;
          color: var(--sf-text, #F0F0F0); border: 1px solid var(--sf-border, rgba(255,255,255,0.1)); }
        .sfw-sel:disabled { cursor: default; color: var(--sf-muted, rgba(255,255,255,0.62)); }
        .sfw-sel:focus-visible, .sfw-go:focus-visible { outline: 2px solid var(--sf-accent, #DC2626); outline-offset: 2px; }
        .sfw-go { height: 52px; padding: 0 22px; border: none; border-radius: 10px; cursor: pointer; display: inline-flex;
          align-items: center; justify-content: center; gap: 8px; font-size: 15px; font-weight: 700;
          background: var(--sf-accent, #DC2626); color: var(--sf-on-accent, #fff); }
        .sfw-types { display: flex; flex-wrap: wrap; justify-content: center; gap: 22px; margin-top: 32px; }
        .sfw-type { display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; width: 76px; }
        .sfw-ring { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center;
          border: 2px solid var(--sf-accent, #DC2626); color: var(--sf-text, #F0F0F0); font-size: 18px; font-weight: 700;
          font-variant-numeric: tabular-nums; transition: background .2s ease, color .2s ease; }
        .sfw-type:hover .sfw-ring { background: var(--sf-accent, #DC2626); color: var(--sf-on-accent, #fff); }
        .sfw-label { font-size: 13px; font-weight: 600; color: var(--sf-text, #F0F0F0); }
        @media (max-width: 720px) {
          .sfw-bar { grid-template-columns: 1fr; }
          .sfw-types { gap: 14px; }
        }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <div className="sfw">
            <div className="sfw-head">
              <p className="sfv-eyebrow">Browse</p>
              <h2 className="sec-title">Find your car</h2>
            </div>
            <form className="sfw-bar" onSubmit={go} role="search" aria-label="Browse our cars">
              <select className="sfw-sel" aria-label="Brand" value={brand}
                onChange={(e) => { setBrand(e.target.value); setModel(""); }}>
                <option value="">Any brand</option>
                {brands.map((b) => <option key={b.name} value={b.name}>{b.name} ({b.count})</option>)}
              </select>
              <select className="sfw-sel" aria-label="Model" value={model} disabled={!brand}
                onChange={(e) => setModel(e.target.value)}>
                <option value="">{brand ? "Any model" : "Pick a brand first"}</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="sfw-sel" aria-label="Max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
                <option value="">Any price</option>
                {prices.map((p) => <option key={p.value} value={p.value}>Up to {p.label}</option>)}
              </select>
              <button type="submit" className="sfw-go"><Search size={18} /> Search</button>
            </form>
            {bodies.length > 0 && (
              <div className="sfw-types">
                {bodies.map((b) => (
                  <Link key={b.name} className="sfw-type" to={browseHref(carsBase, { bodyType: b.name }, rows, PRICE_STEPS)}
                    aria-label={`${b.name}: ${b.count} ${b.count === 1 ? "car" : "cars"}`}>
                    <span className="sfw-ring">{b.count}</span>
                    <span className="sfw-label">{b.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
