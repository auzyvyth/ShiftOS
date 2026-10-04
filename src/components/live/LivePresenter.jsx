import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  monthlyPayment, DEFAULT_EIR, DEFAULT_LOAN_RATIO, MAX_TENURE_YEARS, HIGH_VALUE_THRESHOLD,
} from '../../utils/financing';
import {
  salaryGuide, eirForTenure, fmtRate, liveReport, SALARY_SHARE, maxMonthlyFromPay, budgetMatches,
} from '../../utils/liveMaths';

// Live presentation — the seller's full-screen view of their own cars, built
// to be shown on a TikTok / FB live (camera on the screen, or screen-share).
//
// TikTok strikes a live for a phone number, link, QR code or "WhatsApp me" on
// screen, so NOTHING here may ever render contact details, a URL, a QR or a
// messaging-app logo. Viewers reach the seller through the profile bio link,
// which lands on the mini page — and the car on this screen is pinned there
// ("Live now", set_live_listing). The #number is the shared language: a viewer
// comments "#3", the seller says "tap my profile, car #3".
//
// The monthly table is the calculation poster salesmen already hold up on
// lives, generated for every car: deposit rows x tenure columns. One formula
// (financing.js). The default cell (10% down, 7 years) is the same estimate
// the mini page card shows, so the two never disagree.
//
// Tap any cell and it becomes the answer card: one big number a camera can
// read, with the deposit, tenure, rate and a take-home-pay guide (35% rule,
// shown with the rule). The rate can be typed FLAT, the way brochures quote
// it, and is converted to EIR per tenure (liveMaths.eirForTenure).
//
// Cars above HIGH_VALUE_THRESHOLD get the table HERE ONLY (owner's call,
// 2026-10-03: a seller on a live is asked about them too), labelled as a rough
// guide. calcMonthly and the mini page card still say "financing on request".
//
// Under the big number is the WORKING (price - deposit = loan, months, rate):
// the trust a viewer got from watching the seller punch it into a calculator.
//
// Budget tab: the reverse question ("gaji RM3,500, boleh ambil kereta apa?").
// The viewer's monthly budget, or their take-home pay run through the same
// 35% rule backwards, lists which of the seller's cars fit (liveMaths
// budgetMatches). Tapping one opens it with that deposit and tenure picked.
//
// Leaving after a minute or more shows the live report: counts from the
// seller's own analytics rows in the live window. Counts only, never a buyer's
// name — the report may still be on stream.

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-MY');
const TENURES = [5, 7, MAX_TENURE_YEARS];
const DEFAULT_DOWN = Math.round((1 - DEFAULT_LOAN_RATIO) * 100); // 10
const DOWN_ROWS = [DEFAULT_DOWN, 20, 30];
const DEFAULT_TENURE = 7;
const HEARTBEAT_MS = 4 * 60 * 1000; // live_until window is 10 min server-side
const REPORT_MIN_MS = 60 * 1000;     // a quick peek at the presenter is not a live

const carName = (c) => [c.year, c.brand, c.model].filter(Boolean).join(' ');

export default function LivePresenter({ listings, slug, sellerId, onClose }) {
  const [mode, setMode] = useState('cars'); // 'cars' | 'budget'
  const [idx, setIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [eir, setEir] = useState(String(DEFAULT_EIR));
  const [basis, setBasis] = useState('eir'); // 'eir' | 'flat' — how the seller typed the rate
  const [customDown, setCustomDown] = useState('');
  const [pick, setPick] = useState({ row: DEFAULT_DOWN, years: DEFAULT_TENURE });
  // Budget mode: what the viewer said in the chat.
  const [budgetKind, setBudgetKind] = useState('monthly'); // 'monthly' | 'pay'
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetDown, setBudgetDown] = useState('');
  const [budgetYears, setBudgetYears] = useState(DEFAULT_TENURE);
  const [report, setReport] = useState(null); // null = presenting; {loading} | result
  const startedAt = useRef(new Date());
  const touchX = useRef(null);
  const fitRef = useRef(null);

  // Fit the Cars screen to the stage: a seller cannot scroll mid-pitch, and a
  // phone filming a monitor cannot see below the fold. Shrinks to 80% at most
  // (any smaller and the camera cannot read it), then lets the page scroll.
  // Budget is a list, so it scrolls like one. Style is set directly so the
  // measurement never costs a re-render.
  const fit = useRef(() => {});
  fit.current = () => {
    const el = fitRef.current;
    const body = el?.parentElement;
    if (!el || !body) return;
    el.style.zoom = '1';
    if (mode !== 'cars') return;
    const pad = parseFloat(getComputedStyle(body).paddingTop) * 2 || 0;
    const avail = body.clientHeight - pad;
    const need = el.offsetHeight;
    if (need > avail && avail > 0) el.style.zoom = String(Math.max(0.8, avail / need));
  };
  useLayoutEffect(() => { fit.current(); });
  useEffect(() => {
    const body = fitRef.current?.parentElement;
    if (!body || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => fit.current());
    ro.observe(body);
    document.fonts?.ready?.then(() => fit.current());
    return () => ro.disconnect();
  }, [report]);

  const car = listings[idx] || null;
  const images = Array.isArray(car?.images) ? car.images.filter(Boolean) : [];
  const price = Number(car?.selling_price) || 0;
  const rate = Math.max(0, Number(eir) || 0);

  const go = useCallback((d) => {
    setIdx((i) => (i + d + listings.length) % listings.length);
    setImgIdx(0);
  }, [listings.length]);

  // Exit: a live of a minute or more ends on its report; a peek just closes.
  const finish = useCallback(async () => {
    const endedAt = new Date();
    if (endedAt - startedAt.current < REPORT_MIN_MS || !slug) { onClose(); return; }
    setReport({ loading: true });
    const since = startedAt.current.toISOString();
    const [ev, ld] = await Promise.all([
      supabase.from('analytics_events')
        .select('event_type,session_id,car_id')
        .eq('salesman_slug', slug)
        .gte('created_at', since)
        .in('event_type', ['minipage_view', 'minipage_card_click', 'whatsapp_click'])
        .limit(5000),
      sellerId
        ? supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('salesman_id', sellerId).gte('created_at', since)
        : Promise.resolve({ error: true }),
    ]).catch(() => [{ error: true }, { error: true }]);
    setReport({
      ...liveReport({
        events: ev.error ? [] : ev.data,
        newLeads: ld.error ? undefined : ld.count,
        listings, startedAt: startedAt.current, endedAt,
      }),
      eventsFailed: !!ev.error,
    });
  }, [slug, sellerId, listings, onClose]);

  // Overlay rules 1+2: portalled, body scroll locked while open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Keyboard for a laptop running LIVE Studio: arrows swipe, Esc closes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT') return;
      if (report) { if (e.key === 'Escape') onClose(); return; }
      if (e.key === 'Escape') finish();
      else if (mode !== 'cars') return;
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, finish, report, mode]);

  // A live runs 30-60 minutes; a phone that dims and locks mid-pitch kills it.
  useEffect(() => {
    let lock = null;
    const acquire = async () => {
      try { lock = await navigator.wakeLock?.request('screen'); } catch { /* unsupported / denied */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      try { lock?.release(); } catch { /* ignore */ }
    };
  }, []);

  // Tell the mini page which car is on screen. Debounced so flicking through
  // five cars is one write; heartbeat keeps the 10-minute window open; closing
  // clears it. Errors are ignored on purpose: the presenter must keep working
  // even if the sync is down (or before migration 20261003a is applied).
  // The report screen means the live is over: stop pinning the car right away.
  const carId = report ? null : (car?.id || null);
  useEffect(() => {
    if (report) supabase.rpc('set_live_listing', { p_listing_id: null }).then(() => {}, () => {});
  }, [report]);
  useEffect(() => {
    if (!carId) return undefined;
    const push = () => { supabase.rpc('set_live_listing', { p_listing_id: carId }).then(() => {}, () => {}); };
    const t = setTimeout(push, 600);
    const hb = setInterval(push, HEARTBEAT_MS);
    return () => { clearTimeout(t); clearInterval(hb); };
  }, [carId]);
  useEffect(() => () => {
    supabase.rpc('set_live_listing', { p_listing_id: null }).then(() => {}, () => {});
  }, []);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  if (!car) return null;

  // Typed deposit, 0 included: "no deposit" is the most-asked question on a live.
  const custom = customDown === '' ? null : Math.max(0, Number(customDown) || 0);
  const rows = [
    ...(custom !== null && custom < price
      ? [{ key: 'c', label: custom > 0 ? `RM ${fmt(custom)}` : 'No deposit', down: custom, custom: true }] : []),
    ...DOWN_ROWS.map((pct) => ({ key: pct, down: price * pct / 100 })),
  ];
  const financeable = price > 0;
  const highValue = price > HIGH_VALUE_THRESHOLD;
  const rateFor = (y) => eirForTenure(rate, basis, y);
  const monthlyFor = (down, y) => monthlyPayment(price - down, rateFor(y), y * 12);
  const picked = rows.find((r) => r.key === pick.row) || rows.find((r) => r.key === DEFAULT_DOWN);
  const pickYears = TENURES.includes(pick.years) ? pick.years : DEFAULT_TENURE;
  const answer = financeable ? monthlyFor(picked.down, pickYears) : 0;
  const salary = salaryGuide(answer);
  const rateTextFor = (y) => (basis === 'flat'
    ? `${fmtRate(rate)}% flat (${fmtRate(rateFor(y))}% EIR)`
    : `${fmtRate(rate)}% EIR`);

  // Budget mode. "pay" runs the 35% rule backwards; the line under the input
  // always prints that rule, the same way the answer card does.
  const amount = Math.max(0, Number(budgetAmount) || 0);
  const maxMonthly = budgetKind === 'pay' ? maxMonthlyFromPay(amount) : (amount || null);
  const bDown = Math.max(0, Number(budgetDown) || 0);
  const matches = budgetMatches(listings, { maxMonthly, deposit: bDown, years: budgetYears, rate, basis });
  const openFromBudget = (m) => {
    setIdx(m.n - 1);
    setImgIdx(0);
    setCustomDown(String(bDown));
    setPick({ row: 'c', years: budgetYears });
    setMode('cars');
  };
  const anyHighValue = [...matches.fits, ...matches.above].some((m) => m.price > HIGH_VALUE_THRESHOLD);

  return createPortal(
    <div className="lp">
      {/* Light, on the marketplace tokens (DESIGN.md): page #F7F6F2, white cards,
          ink #0f1115, one red only for the selected cell's marker.
          Everything lives on ONE portrait stage, 9:16 at most. On a phone that
          is the whole screen; on a monitor it is a centred column, because the
          seller films the monitor with a phone held upright, and a landscape
          two-column layout came out cropped or tiny on a portrait stream.
          Sizes use container units (cqw / cqh) so the same screen fits a
          375px phone and a 1080p monitor without a scroll. */}
      <style>{`
        .lp { position: fixed; inset: 0; z-index: 1000; background: #E8E5DE; color: #111827; font-family: var(--xd-font-body); -webkit-font-smoothing: antialiased; }
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
        .lp-stage { height: 100%; width: min(100%, calc(100dvh * 9 / 16)); margin: 0 auto; background: #F7F6F2; display: flex; flex-direction: column; container-type: size; }
        .lp-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; background: #fff; border-bottom: 1px solid rgba(0,0,0,.06); flex-shrink: 0; }
        .lp-count { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; }
        .lp-iconbtn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgba(0,0,0,.12); background: #fff; color: #111827; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .lp-iconbtn[aria-pressed="true"] { background: #0f1115; border-color: #0f1115; color: #fff; }
        .lp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .lp-body > * { flex-shrink: 0; }
        .lp-card { background: #fff; border-radius: 14px; border: 1px solid rgba(0,0,0,.06); box-shadow: 0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.05); }
        .lp-photo { position: relative; height: clamp(150px, 33cqh, 560px); border-radius: 14px; overflow: hidden; background: #EDEAE3; }
        .lp-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .lp-num { position: absolute; top: 10px; left: 10px; font-family: 'Bebas Neue', sans-serif; font-size: clamp(26px, 8cqw, 44px); line-height: 1; letter-spacing: .02em; color: #fff; background: rgba(15,17,21,.78); border-radius: 8px; padding: 6px 10px 3px; }
        .lp-dots { position: absolute; top: 14px; right: 12px; display: flex; gap: 5px; pointer-events: none; }
        .lp-dots span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 2px rgba(0,0,0,.4); }
        .lp-dots span[data-on="1"] { background: #fff; }
        /* Name + price ride on the photo: one block a camera reads at a glance. */
        .lp-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 48px 14px 12px; background: linear-gradient(to bottom, rgba(15,17,21,0), rgba(15,17,21,.88)); color: #fff; pointer-events: none; }
        .lp-name { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(28px, 9cqw, 52px); line-height: .95; letter-spacing: .015em; margin: 0; }
        .lp-capline { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-top: 6px; }
        .lp-spec { font-size: clamp(12px, 3.4cqw, 16px); color: rgba(255,255,255,.82); margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-price { font-size: clamp(20px, 6.4cqw, 34px); font-weight: 800; margin: 0; white-space: nowrap; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
        .lp-calc { padding: 14px; }
        .lp-eb { font-size: clamp(11px, 2.8cqw, 15px); font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #6b7280; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
        .lp-eb i { width: 16px; height: 2px; background: #dc2626; display: inline-block; }
        .lp-big { font-size: clamp(38px, 12cqw, 72px); font-weight: 800; line-height: 1; letter-spacing: -.02em; color: #0f1115; margin: 0; font-variant-numeric: tabular-nums; }
        .lp-big span { font-size: .32em; font-weight: 600; letter-spacing: 0; color: #6b7280; margin-left: 6px; }
        /* The working, the way a calculator would show it: the trust a viewer
           got from watching the seller punch the numbers in. */
        .lp-work { font-size: clamp(13px, 3.4cqw, 18px); font-weight: 600; color: #374151; margin: 6px 0 0; font-variant-numeric: tabular-nums; line-height: 1.45; }
        .lp-work em { font-style: normal; color: #9ca3af; font-weight: 500; }
        .lp-salary { font-size: clamp(12px, 3.1cqw, 16px); color: #4b5563; margin: 6px 0 0; line-height: 1.4; }
        .lp-salary b { color: #0f1115; font-variant-numeric: tabular-nums; }
        .lp-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; margin-top: 8px; }
        .lp-table th { font-size: clamp(11px, 2.8cqw, 14px); font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #9ca3af; padding: 8px 8px 6px; text-align: right; border-top: 1px solid rgba(0,0,0,.06); }
        .lp-table th:first-child { text-align: left; padding-left: 0; }
        .lp-table td { padding: 6px 8px; text-align: right; font-size: clamp(15px, 4.4cqw, 22px); font-weight: 700; color: #111827; border-top: 1px solid rgba(0,0,0,.06); }
        .lp-table td:first-child { text-align: left; padding-left: 0; font-size: clamp(11px, 3cqw, 15px); font-weight: 500; color: #4b5563; white-space: nowrap; }
        .lp-table td:first-child b { font-size: clamp(13px, 3.8cqw, 17px); font-weight: 700; color: #111827; margin-right: 6px; }
        .lp-table td.lp-cell { cursor: pointer; border-radius: 8px; }
        .lp-table td.lp-cell:hover { background: rgba(15,17,21,.05); }
        .lp-table td.lp-def, .lp-table td.lp-def:hover { background: #0f1115; color: #fff; border-top-color: transparent; }
        .lp-note { font-size: clamp(11px, 2.8cqw, 14px); color: #6b7280; line-height: 1.45; margin: 8px 0 0; }
        .lp-fit { display: flex; flex-direction: column; gap: 10px; }
        .lp-adjust { padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lp-adjust label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: #4b5563; min-width: 0; }
        .lp-in { width: 100%; height: 44px; background: #fff; border: 1px solid rgba(0,0,0,.12); border-radius: 10px; color: #111827; padding: 0 12px; font-size: 16px; font-family: inherit; font-variant-numeric: tabular-nums; }
        .lp-in:focus { outline: none; border-color: #0f1115; }
        .lp-seg { display: flex; gap: 4px; padding: 4px; background: #F1EFEA; border-radius: 10px; }
        .lp-adjust .lp-seg { grid-column: 1 / -1; }
        .lp-seg button { flex: 1; height: 34px; padding: 0 12px; border: none; border-radius: 7px; background: transparent; font: inherit; font-size: 13px; font-weight: 700; color: #4b5563; cursor: pointer; white-space: nowrap; }
        .lp-seg button[aria-pressed="true"] { background: #fff; color: #0f1115; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
        .lp-hint { grid-column: 1 / -1; font-size: 12px; color: #6b7280; line-height: 1.5; margin: 0; }
        .lp-nav { display: flex; gap: 10px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid rgba(0,0,0,.06); flex-shrink: 0; }
        .lp-navbtn { flex: 1; height: 48px; border-radius: 12px; border: 1px solid rgba(0,0,0,.12); background: #fff; color: #111827; font-size: 16px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-family: inherit; font-variant-numeric: tabular-nums; }
        .lp-navbtn.lp-next { background: #0f1115; border-color: #0f1115; color: #fff; }
        .lp-bud { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .lp-money { display: flex; align-items: center; gap: 8px; height: clamp(56px, 15cqw, 80px); padding: 0 14px; border: 1px solid rgba(0,0,0,.12); border-radius: 12px; background: #fff; }
        .lp-money:focus-within { border-color: #0f1115; }
        .lp-money span { font-size: clamp(20px, 6cqw, 32px); font-weight: 700; color: #9ca3af; }
        .lp-money input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: transparent; font: inherit; font-size: clamp(28px, 9cqw, 48px); font-weight: 800; color: #0f1115; font-variant-numeric: tabular-nums; }
        .lp-budrow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: end; }
        .lp-budrow label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: #4b5563; min-width: 0; }
        .lp-budrow .lp-seg button { padding: 0 6px; height: 36px; }
        .lp-res { padding: 6px 14px; }
        .lp-res h3 { font-size: clamp(11px, 2.8cqw, 14px); font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #6b7280; margin: 8px 0 2px; }
        .lp-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 0; border: none; border-top: 1px solid rgba(0,0,0,.06); background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
        .lp-res h3 + .lp-row { border-top: none; }
        .lp-row img, .lp-row .lp-noimg { width: clamp(52px, 15cqw, 88px); aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; background: #EDEAE3; flex-shrink: 0; }
        .lp-row .lp-n { font-family: 'Bebas Neue', sans-serif; font-size: clamp(24px, 7.5cqw, 38px); line-height: 1; color: #0f1115; flex-shrink: 0; }
        .lp-row .lp-rn { flex: 1; min-width: 0; }
        .lp-row .lp-rn b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: clamp(13px, 3.8cqw, 18px); font-weight: 700; line-height: 1.25; color: #111827; }
        .lp-row .lp-rn span { display: block; font-size: 12px; color: #6b7280; font-variant-numeric: tabular-nums; }
        .lp-row .lp-m { text-align: right; flex-shrink: 0; font-size: clamp(16px, 4.8cqw, 24px); font-weight: 800; color: #0f1115; font-variant-numeric: tabular-nums; }
        .lp-row .lp-m small { display: block; font-size: 11px; font-weight: 600; color: #9ca3af; }
        .lp-row.lp-over { opacity: .62; }
        .lp-empty { font-size: 14px; color: #6b7280; line-height: 1.5; margin: 10px 0; }
        .lp-report { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 16px; }
        .lp-report h2 { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 40px; line-height: 1; letter-spacing: .015em; color: #0f1115; margin: 0; }
        .lp-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .lp-tile { padding: 16px; }
        .lp-tile b { display: block; font-size: 32px; font-weight: 800; color: #0f1115; font-variant-numeric: tabular-nums; line-height: 1.1; }
        .lp-tile span { display: block; font-size: 13px; color: #4b5563; margin-top: 4px; }
      `}</style>

      <div className="lp-stage">
      {/* Top bar: mode + controls. Deliberately no seller name or contact. */}
      <div className="lp-top">
        {report ? <span className="lp-count">Live ended</span> : (
          <div className="lp-seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={mode === 'cars'} onClick={() => setMode('cars')}>Cars</button>
            <button type="button" aria-pressed={mode === 'budget'} onClick={() => setMode('budget')}>Budget</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {!report && (
            <button className="lp-iconbtn" onClick={() => setAdjustOpen((v) => !v)} aria-label="Adjust financing" aria-pressed={adjustOpen}>
              <SlidersHorizontal size={17} />
            </button>
          )}
          <button className="lp-iconbtn" onClick={report ? onClose : finish} aria-label="Exit live presentation"><X size={18} /></button>
        </div>
      </div>

      {report ? <LiveReport report={report} onDone={onClose} /> : (<>
      <div className="lp-body" onTouchStart={mode === 'cars' ? onTouchStart : undefined} onTouchEnd={mode === 'cars' ? onTouchEnd : undefined}>
        <div className="lp-fit" ref={fitRef}>
        {adjustOpen && (
          <div className="lp-card lp-adjust">
            <div className="lp-seg" role="group" aria-label="How the rate is quoted">
              <button type="button" aria-pressed={basis === 'eir'} onClick={() => setBasis('eir')}>EIR</button>
              <button type="button" aria-pressed={basis === 'flat'} onClick={() => setBasis('flat')}>Flat (brochure)</button>
            </div>
            <label style={mode === 'budget' ? { gridColumn: '1 / -1' } : undefined}>
              {basis === 'flat' ? 'Rate (flat % a year)' : 'Rate (EIR % a year)'}
              <input className="lp-in" type="number" inputMode="decimal" step="0.01" min="0" value={eir} onChange={(e) => setEir(e.target.value)} />
            </label>
            {mode === 'cars' && (
              <label>
                Custom deposit (RM)
                <input className="lp-in" type="number" inputMode="numeric" min="0" placeholder="0 = no deposit" value={customDown}
                  onChange={(e) => { setCustomDown(e.target.value); if (e.target.value !== '') setPick((p) => ({ ...p, row: 'c' })); }} />
              </label>
            )}
            {basis === 'flat' && (
              <p className="lp-hint">
                Type the bank's flat rate as quoted. Flat rates were abolished for new loans on
                1 June 2026, so it is worked out as EIR: {TENURES.map((y) => `${y} yrs ${fmtRate(rateFor(y))}%`).join(', ')}.
              </p>
            )}
          </div>
        )}

        {mode === 'cars' ? (<>
        {/* Photo: tap the left / right third to step through this car's photos. */}
        <div className="lp-photo lp-card">
          {images[imgIdx]
            ? <img src={images[imgIdx]} alt={carName(car)} />
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>No photo</div>}
          {images.length > 1 && (
            <>
              <button aria-label="Previous photo" onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%', background: 'none', border: 'none', cursor: 'pointer' }} />
              <button aria-label="Next photo" onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', background: 'none', border: 'none', cursor: 'pointer' }} />
              <div className="lp-dots">
                {images.slice(0, 12).map((_, i) => <span key={i} data-on={i === imgIdx ? '1' : '0'} />)}
              </div>
            </>
          )}
          <span className="lp-num">#{idx + 1}</span>
          <div className="lp-cap">
            <h2 className="lp-name">{carName(car)}</h2>
            <div className="lp-capline">
              <p className="lp-spec">
                {[car.variant, car.mileage ? `${fmt(car.mileage)} km` : null, car.transmission].filter(Boolean).join(' · ')}
              </p>
              <p className="lp-price">{price > 0 ? `RM ${fmt(price)}` : 'Price on request'}</p>
            </div>
          </div>
        </div>

        {financeable && (
          <div className="lp-card lp-calc">
            <p className="lp-eb"><i />Monthly instalment</p>
            <p className="lp-big">RM {fmt(answer)}<span>/month</span></p>
            <p className="lp-work">
              RM {fmt(price)} <em>−</em> {picked.down > 0 ? `RM ${fmt(picked.down)} down` : 'no deposit'} <em>=</em> RM {fmt(price - picked.down)} loan
              <br />{pickYears * 12} months ({pickYears} years) <em>at</em> {rateTextFor(pickYears)}
            </p>
            {salary && (
              <p className="lp-salary">
                Take-home pay needed: <b>about RM {fmt(salary)}</b>. Instalment at {Math.round(SALARY_SHARE * 100)}% of take-home pay. The bank decides.
              </p>
            )}
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Deposit</th>
                  {TENURES.map((y) => <th key={y}>{y} yrs</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      {r.custom ? <b>{r.label}</b> : <><b>{r.key}%</b>RM {fmt(r.down)}</>}
                    </td>
                    {TENURES.map((y) => {
                      const on = r.key === picked.key && y === pickYears;
                      return (
                        <td key={y} className={on ? 'lp-cell lp-def' : 'lp-cell'}
                          onClick={() => setPick({ row: r.key, years: y })}
                          role="button" aria-pressed={on}>
                          {fmt(monthlyFor(r.down, y))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lp-note">
              RM per month, reducing balance. Tap a number to show it big.{' '}
              {highValue
                ? 'Above RM300k banks decide case by case, often with a bigger deposit or shorter tenure, so treat this as a rough guide.'
                : 'Subject to bank approval.'}
            </p>
          </div>
        )}
        </>) : (<>
        {/* Budget: the viewer's number in, the cars that fit out. */}
        <div className="lp-card lp-bud">
          <div className="lp-seg" role="group" aria-label="Budget is">
            <button type="button" aria-pressed={budgetKind === 'monthly'} onClick={() => setBudgetKind('monthly')}>Monthly budget</button>
            <button type="button" aria-pressed={budgetKind === 'pay'} onClick={() => setBudgetKind('pay')}>Take-home pay</button>
          </div>
          <label className="lp-money">
            <span>RM</span>
            <input type="number" inputMode="numeric" min="0" value={budgetAmount} placeholder="0"
              aria-label={budgetKind === 'pay' ? 'Take-home pay a month' : 'Monthly budget'}
              onChange={(e) => setBudgetAmount(e.target.value)} />
          </label>
          <div className="lp-budrow">
            <label>
              Deposit (RM)
              <input className="lp-in" type="number" inputMode="numeric" min="0" placeholder="0 = no deposit" value={budgetDown}
                onChange={(e) => setBudgetDown(e.target.value)} />
            </label>
            <div className="lp-seg" role="group" aria-label="Years">
              {TENURES.map((y) => (
                <button key={y} type="button" aria-pressed={budgetYears === y} onClick={() => setBudgetYears(y)}>{y} yrs</button>
              ))}
            </div>
          </div>
          {maxMonthly ? (
            <p className="lp-work" style={{ margin: 0 }}>
              {budgetKind === 'pay' && <>RM {fmt(amount)} <em>×</em> {Math.round(SALARY_SHARE * 100)}% <em>=</em> </>}
              up to <b>RM {fmt(maxMonthly)}/month</b>
              <br />{bDown > 0 ? `RM ${fmt(bDown)} deposit` : 'No deposit'} · {budgetYears} years at {rateTextFor(budgetYears)}
            </p>
          ) : null}
          {budgetKind === 'pay' && maxMonthly ? (
            <p className="lp-salary" style={{ margin: 0 }}>Rough guide: instalment at {Math.round(SALARY_SHARE * 100)}% of take-home pay. The bank decides.</p>
          ) : null}
        </div>

        <div className="lp-card lp-res">
          {!maxMonthly ? (
            <p className="lp-empty">Type the monthly amount a viewer can pay, or their take-home pay, and the cars that fit show here.</p>
          ) : (<>
            <h3>{matches.fits.length ? `${matches.fits.length} ${matches.fits.length === 1 ? 'car fits' : 'cars fit'}` : 'None fit this budget yet'}</h3>
            {matches.fits.map((m) => <BudgetRow key={m.car.id} m={m} onOpen={openFromBudget} />)}
            {matches.above.length > 0 && <h3>Just above</h3>}
            {matches.above.map((m) => <BudgetRow key={m.car.id} m={m} over onOpen={openFromBudget} />)}
            <p className="lp-note" style={{ marginBottom: 8 }}>
              RM per month, reducing balance. Subject to bank approval.
              {anyHighValue ? ' Above RM300k banks decide case by case, so treat those as a rough guide.' : ''}
            </p>
          </>)}
        </div>
        </>)}
        </div>
      </div>

      {/* Big prev / next: a seller talking to camera needs a target they can hit blind. */}
      {mode === 'cars' && listings.length > 1 && (
        <div className="lp-nav">
          <button className="lp-navbtn" onClick={() => go(-1)}><ChevronLeft size={20} /> #{((idx - 1 + listings.length) % listings.length) + 1}</button>
          <button className="lp-navbtn lp-next" onClick={() => go(1)}>#{((idx + 1) % listings.length) + 1} <ChevronRight size={20} /></button>
        </div>
      )}
      </>)}
      </div>
    </div>,
    document.body,
  );
}

// One budget result. Tapping it opens that car on the Cars screen with the
// same deposit and years picked, so the big number matches this row.
function BudgetRow({ m, over, onOpen }) {
  const img = Array.isArray(m.car.images) ? m.car.images.find(Boolean) : null;
  return (
    <button type="button" className={over ? 'lp-row lp-over' : 'lp-row'} onClick={() => onOpen(m)}>
      {img ? <img src={img} alt="" /> : <span className="lp-noimg" />}
      <span className="lp-n">#{m.n}</span>
      <span className="lp-rn">
        <b>{carName(m.car)}</b>
        <span>RM {fmt(m.price)}</span>
      </span>
      <span className="lp-m">RM {fmt(m.monthly)}<small>/month</small></span>
    </button>
  );
}

// After the live. Counts only: this can still be on the stream, so no buyer
// name, phone or message ever renders here.
function LiveReport({ report, onDone }) {
  if (report.loading) {
    return <div className="lp-report"><p className="lp-note">Adding up your live...</p></div>;
  }
  const n = (v) => (v === null || v === undefined ? '-' : fmt(v));
  return (
    <div className="lp-report">
      <h2>Your live, {report.minutes} min</h2>
      <div className="lp-tiles">
        <div className="lp-card lp-tile"><b>{report.eventsFailed ? '-' : n(report.visitors)}</b><span>opened your page</span></div>
        <div className="lp-card lp-tile"><b>{report.eventsFailed ? '-' : n(report.carTaps)}</b><span>car taps</span></div>
        <div className="lp-card lp-tile"><b>{report.eventsFailed ? '-' : n(report.whatsappTaps)}</b><span>WhatsApp taps</span></div>
        <div className="lp-card lp-tile"><b>{n(report.newLeads)}</b><span>new leads in your pipeline</span></div>
      </div>
      {report.topCar && (
        <div className="lp-card lp-tile">
          <span>Most tapped</span>
          <b style={{ fontSize: 22 }}>#{report.topCar.n} {report.topCar.name}</b>
          <span>{report.topCar.taps} taps. Lead with it next live.</span>
        </div>
      )}
      <p className="lp-note">
        Counted from the moment you opened the presentation. Page opens are everyone who opened
        your page in that time, not only your viewers, and visitors who turned analytics off
        are not counted, so the real number can be higher. Your new leads are waiting in your pipeline.
      </p>
      <button className="lp-navbtn lp-next" onClick={onDone} style={{ flex: 'none' }}>Done</button>
    </div>
  );
}
