import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ChevronRight, FileSpreadsheet, Radio } from "lucide-react";
import { publicClient } from "../supabaseClient";
import MarketplaceHeader from "../components/MarketplaceHeader";
import MarketplaceFooter from "../components/MarketplaceFooter";
import NotFoundPage from "./NotFoundPage";
import { isSubdomain } from "../hooks/useTenant";
import { useMarketplaceTracking } from "../hooks/useMarketplaceTracking";
import { SITE_URL } from "../config/site";
import { loanTotals } from "../utils/financing";
import { RATE_MAX } from "../utils/liveMaths";
import { NEW_CAR_BRANDS } from "../utils/newCars";
import {
  LOAN_TENURES, LOAN_DEPOSITS, LOAN_DEPOSIT_PCT, loanBrandFromSlug, loanPath, loanRate,
  loanModels, loanCopy, loanMonthly, loanFaqLd, rmLoan,
} from "../utils/brandLoan";

// LOAN-SEO (2026-11-22): /kalkulator-loan/:brand. Every number comes from
// new_car_models + src/utils/brandLoan.js (shared with api/og.js), so the
// crawler page and this one never disagree.
export default function BrandLoanPage() {
  useMarketplaceTracking();
  const { brand: bSlug } = useParams();
  const brand = loanBrandFromSlug(bSlug);
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [modelIx, setModelIx] = useState(0);
  const [variantIx, setVariantIx] = useState(0);
  const [deposit, setDeposit] = useState(LOAN_DEPOSIT_PCT);
  const [years, setYears] = useState(9);
  const [rateText, setRateText] = useState(String(loanRate(brand)));

  useEffect(() => {
    if (!brand) return;
    let alive = true;
    setRows(null); setFailed(false); setModelIx(0); setVariantIx(0); setRateText(String(loanRate(brand)));
    publicClient.from("new_car_models")
      .select("id, brand, model, variant, price_peninsular, is_active")
      .eq("brand", brand).eq("is_active", true)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setFailed(true); else setRows(data || []);
      });
    return () => { alive = false; };
  }, [brand]);

  const models = useMemo(() => (brand && rows ? loanModels(brand, rows) : []), [brand, rows]);
  const copy = useMemo(() => (brand ? loanCopy(brand, models) : null), [brand, models]);

  if (!brand || isSubdomain()) return <NotFoundPage />;
  if (rows && !models.length) return <NotFoundPage />;

  const rate = Math.min(RATE_MAX, Math.max(0, Number(rateText) || 0));
  const m = models[modelIx] || models[0];
  const v = m?.variants[variantIx] || m?.variants[0];
  const loan = v ? v.price * (1 - deposit / 100) : 0;
  const tot = v ? loanTotals(loan, rate, years * 12) : null;
  const canonical = `${SITE_URL}${loanPath(brand)}`;

  return (
    <>
      <Helmet>
        <title>{copy.title}</title>
        <meta name="description" content={copy.description} />
        <link rel="canonical" href={canonical} />
        <html lang="ms" />
        <script type="application/ld+json">{JSON.stringify(loanFaqLd(copy.faqs))}</script>
      </Helmet>
      <style>{CSS}</style>
      <MarketplaceHeader />
      <main className="bl">
        <div className="bl-wrap">
          <p className="bl-crumb">
            <Link to="/calculator">Kalkulator loan</Link> <ChevronRight size={12} /> <b>{brand}</b>
          </p>
          <p className="bl-ey">Kalkulator loan kereta baru</p>
          <h1 className="bl-h1">{copy.h1}</h1>
          <p className="bl-lead">{copy.intro}</p>

          {failed && <p className="bl-msg">Harga tidak dapat dimuat sekarang. Cuba muat semula.</p>}
          {!rows && !failed && <p className="bl-msg">Memuatkan harga...</p>}

          {m && v && (
            <div className="bl-grid">
              <section className="bl-card bl-calc" aria-label={`Kira ansuran ${brand}`}>
                <h2 className="bl-h2">Model</h2>
                <div className="bl-chips">
                  {models.map((x, i) => (
                    <button key={x.model} aria-pressed={i === modelIx} onClick={() => { setModelIx(i); setVariantIx(0); }}>
                      {x.model}<small>dari {rmLoan(x.from)}</small>
                    </button>
                  ))}
                </div>
                <h2 className="bl-h2">Varian</h2>
                <div className="bl-chips">
                  {m.variants.map((x, i) => (
                    <button key={x.id || x.variant} aria-pressed={i === variantIx} onClick={() => setVariantIx(i)}>
                      {x.variant}<small>{rmLoan(x.price)}</small>
                    </button>
                  ))}
                </div>
                <div className="bl-row">
                  <div>
                    <h2 className="bl-h2">Deposit</h2>
                    <div className="bl-seg">
                      {LOAN_DEPOSITS.map((d) => (
                        <button key={d} aria-pressed={d === deposit} onClick={() => setDeposit(d)}>{d === 0 ? "Tiada" : `${d}%`}</button>
                      ))}
                    </div>
                  </div>
                  <label className="bl-rate">
                    <span className="bl-h2">Kadar (EIR)</span>
                    <span className="bl-rate-box">
                      <input inputMode="decimal" value={rateText} onChange={(e) => setRateText(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} aria-label="Kadar faedah EIR setahun" />%
                    </span>
                  </label>
                </div>
                <h2 className="bl-h2">Tempoh</h2>
                <div className="bl-tiles">
                  {LOAN_TENURES.map((y) => (
                    <button key={y} aria-pressed={y === years} onClick={() => setYears(y)}>
                      <span>{y} tahun</span>
                      <b>{rmLoan(loanMonthly(v.price, { depositPct: deposit, years: y, rate }))}</b>
                    </button>
                  ))}
                </div>
                <div className="bl-answer">
                  <span className="bl-big">{rmLoan(Math.round(tot.monthly))}</span><small> sebulan</small>
                  <p>{brand} {m.model} {v.variant}, {years} tahun</p>
                </div>
                <dl className="bl-work">
                  <div><dt>Harga rasmi (Semenanjung)</dt><dd>{rmLoan(v.price)}</dd></div>
                  <div><dt>Deposit {deposit}%</dt><dd>{deposit ? `- ${rmLoan(v.price - loan)}` : "RM 0"}</dd></div>
                  <div><dt>Jumlah pinjaman</dt><dd>{rmLoan(loan)}</dd></div>
                  <div><dt>Jumlah faedah, {rate}% EIR</dt><dd>{rmLoan(tot.totalInterest)}</dd></div>
                </dl>
                <p className="bl-note">
                  Anggaran atas baki berkurangan. Harga tanpa insurans; Sabah, Sarawak, Labuan dan Langkawi ada harga lain.
                  Bank yang menentukan kadar dan kelulusan. <Link to={m.path}>Harga semua zon + advisor {m.model}</Link>
                </p>
              </section>

              <aside className="bl-side">
                <Link to="/articles/cara-kira-loan-kereta-excel" className="bl-card bl-link">
                  <FileSpreadsheet size={18} />
                  <span><b>Template Excel percuma</b><small>Formula PMT, tukar flat ke EIR</small></span>
                  <ChevronRight size={16} />
                </Link>
                <div className="bl-card bl-sa">
                  <p className="bl-sa-t"><Radio size={16} /> Sales advisor {brand}?</p>
                  <p>Tunjuk harga, deposit dan ansuran setiap kereta anda masa live TikTok, besar dan jelas untuk kamera. Versi asas percuma.</p>
                  <Link to="/for-salesmen" className="bl-btn">Cuba Live presentation</Link>
                </div>
              </aside>
            </div>
          )}

          {models.length > 0 && (
            <section className="bl-table-wrap">
              <h2 className="bl-h2 bl-h2-lg">Ansuran bulanan semua varian {brand}</h2>
              <p className="bl-note">Deposit {LOAN_DEPOSIT_PCT}%, {copy.rate}% EIR, harga rasmi Semenanjung tanpa insurans.</p>
              {models.map((x) => (
                <div key={x.model} className="bl-card bl-table">
                  <h3><Link to={x.path}>{brand} {x.model}</Link></h3>
                  <table>
                    <thead><tr><th>Varian</th><th>Harga</th>{LOAN_TENURES.map((y) => <th key={y}>{y} thn</th>)}</tr></thead>
                    <tbody>
                      {x.variants.map((r) => (
                        <tr key={r.id || r.variant}>
                          <td>{r.variant}</td>
                          <td>{rmLoan(r.price)}</td>
                          {LOAN_TENURES.map((y) => <td key={y}>{rmLoan(loanMonthly(r.price, { years: y, rate: copy.rate }))}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          )}

          <section className="bl-faq">
            <h2 className="bl-h2 bl-h2-lg">Soalan lazim</h2>
            {copy.faqs.map((f) => (
              <details key={f.q} className="bl-card">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </section>

          <nav className="bl-more" aria-label="Kalkulator jenama lain">
            <h2 className="bl-h2">Kalkulator loan jenama lain</h2>
            <p>
              {NEW_CAR_BRANDS.filter((b) => b !== brand).map((b) => (
                <Link key={b} to={loanPath(b)}>{b}</Link>
              ))}
              <Link to="/articles/car-loan-malaysia-flat-rate-vs-eir">Flat vs EIR</Link>
              <Link to="/calculator">Kereta terpakai</Link>
            </p>
          </nav>
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}

const CSS = `
  .bl { background: #F7F6F2; min-height: 100vh; font-family: var(--xd-font-body, 'Outfit', system-ui); color: #111827; }
  .bl-wrap { max-width: 1100px; margin: 0 auto; padding: 14px 16px 48px; }
  .bl-crumb { display: flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: #6b7280; margin: 0 0 10px; }
  .bl-crumb a { color: #6b7280; text-decoration: none; } .bl-crumb b { color: #111827; }
  .bl-ey { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #dc2626; }
  .bl-h1 { margin: 2px 0 0; font-size: clamp(24px, 4vw, 34px); font-weight: 800; letter-spacing: -.01em; line-height: 1.15; }
  .bl-lead { margin: 6px 0 18px; font-size: 14.5px; line-height: 1.55; color: #374151; max-width: 720px; }
  .bl-msg { color: #6b7280; padding: 24px 0; }
  .bl-card { background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
  .bl-grid { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 900px) { .bl-grid { grid-template-columns: minmax(0, 1fr) 320px; align-items: start; } .bl-side { position: sticky; top: 84px; } }
  .bl-calc { padding: 16px; min-width: 0; }
  .bl-h2 { display: block; margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #4b5563; }
  .bl-h2-lg { font-size: 18px; font-weight: 800; color: #111827; margin-top: 28px; }
  .bl-chips { display: flex; gap: 7px; overflow-x: auto; scrollbar-width: none; padding: 2px; margin-bottom: 14px; }
  .bl-chips::-webkit-scrollbar { display: none; }
  .bl-chips button { flex-shrink: 0; text-align: left; padding: 8px 12px; border-radius: 12px; border: 0; background: #fff; box-shadow: 0 0 0 1px rgba(15,23,42,.1); font: inherit; font-size: 13.5px; font-weight: 700; color: #111827; cursor: pointer; line-height: 1.25; }
  .bl-chips button small { display: block; font-size: 12px; font-weight: 600; color: #6b7280; }
  .bl-chips button[aria-pressed="true"] { background: #0f1115; color: #fff; box-shadow: none; }
  .bl-chips button[aria-pressed="true"] small { color: rgba(255,255,255,.72); }
  .bl-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: space-between; margin-bottom: 14px; }
  .bl-seg { display: inline-flex; background: #F4F3EF; border-radius: 12px; padding: 3px; }
  .bl-seg button { border: 0; background: none; font: inherit; font-size: 13.5px; font-weight: 700; color: #4b5563; padding: 8px 14px; border-radius: 9px; cursor: pointer; }
  .bl-seg button[aria-pressed="true"] { background: #0f1115; color: #fff; }
  .bl-rate-box { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; background: #F4F3EF; border-radius: 12px; padding: 0 12px; height: 40px; }
  .bl-rate-box input { width: 52px; border: 0; background: none; font: inherit; font-size: 16px; font-weight: 800; text-align: right; outline: none; color: #111827; }
  .bl-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .bl-tiles button { border: 0; background: #F4F3EF; border-radius: 14px; padding: 10px 6px; font: inherit; cursor: pointer; color: #111827; }
  .bl-tiles span { display: block; font-size: 12px; font-weight: 600; color: #6b7280; }
  .bl-tiles b { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .bl-tiles button[aria-pressed="true"] { background: #0f1115; color: #fff; }
  .bl-tiles button[aria-pressed="true"] span { color: rgba(255,255,255,.72); }
  .bl-answer { margin-top: 16px; }
  .bl-big { font-size: 38px; font-weight: 800; letter-spacing: -.02em; color: #dc2626; font-variant-numeric: tabular-nums; }
  .bl-answer small { font-size: 15px; font-weight: 600; color: #6b7280; }
  .bl-answer p { margin: 0; font-size: 13.5px; font-weight: 600; color: #4b5563; }
  .bl-work { margin: 12px 0 0; padding: 0; }
  .bl-work div { display: flex; justify-content: space-between; gap: 10px; padding: 9px 0; font-size: 13.5px; border-top: 1px solid rgba(15,23,42,.07); }
  .bl-work dt { color: #4b5563; } .bl-work dd { margin: 0; font-weight: 800; font-variant-numeric: tabular-nums; }
  .bl-note { margin: 10px 0 0; font-size: 12.5px; line-height: 1.5; color: #6b7280; }
  .bl-note a { color: #111827; font-weight: 700; }
  .bl-side { display: grid; gap: 12px; min-width: 0; }
  .bl-link { display: flex; align-items: center; gap: 12px; padding: 14px 16px; color: #111827; text-decoration: none; }
  .bl-link span { flex: 1; } .bl-link b { display: block; font-size: 14px; } .bl-link small { font-size: 12.5px; color: #6b7280; }
  .bl-sa { padding: 16px; }
  .bl-sa p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.5; color: #374151; }
  .bl-sa-t { display: flex; align-items: center; gap: 7px; font-weight: 800; color: #111827 !important; font-size: 14.5px !important; margin-bottom: 6px !important; }
  .bl-btn { display: inline-flex; align-items: center; height: 42px; padding: 0 16px; border-radius: 12px; background: #dc2626; color: #fff; font-weight: 700; font-size: 14px; text-decoration: none; }
  .bl-table { padding: 12px 14px; margin-top: 10px; overflow-x: auto; }
  .bl-table h3 { margin: 0 0 6px; font-size: 15px; font-weight: 800; }
  .bl-table h3 a { color: #111827; text-decoration: none; }
  .bl-table table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  .bl-table th { text-align: right; font-size: 11.5px; font-weight: 700; color: #6b7280; padding: 6px 4px; white-space: nowrap; }
  .bl-table th:first-child, .bl-table td:first-child { text-align: left; }
  .bl-table td { text-align: right; padding: 8px 4px; border-top: 1px solid rgba(15,23,42,.07); white-space: nowrap; font-weight: 600; }
  .bl-table td:first-child { white-space: normal; font-weight: 700; }
  @media (min-width: 900px) { .bl-table-wrap { max-width: 760px; } .bl-faq { max-width: 760px; } }
  .bl-faq details { margin-top: 8px; padding: 12px 16px; }
  .bl-faq summary { font-weight: 700; font-size: 14.5px; cursor: pointer; }
  .bl-faq details p { margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: #374151; }
  .bl-more { margin-top: 28px; }
  .bl-more p { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; }
  .bl-more a { padding: 8px 13px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 1px rgba(15,23,42,.1); color: #111827; font-weight: 700; font-size: 13px; text-decoration: none; }
`;
