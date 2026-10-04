import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Contact, SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../supabaseClient';
import {
  monthlyPayment, DEFAULT_EIR, DEFAULT_LOAN_RATIO, MAX_TENURE_YEARS, HIGH_VALUE_THRESHOLD,
} from '../../utils/financing';
import {
  salaryGuide, eirForTenure, fmtRate, liveReport, SALARY_SHARE, maxMonthlyFromPay, budgetMatches,
} from '../../utils/liveMaths';
import { LIVE_COPY, initialLiveLang, saveLiveLang } from './liveCopy';

// Live presentation — the seller's full-screen view of their own cars, built
// to be shown on a TikTok / FB live (camera on the screen, or screen-share).
//
// TikTok can strike a live for a phone number, link, QR code or "WhatsApp me"
// on screen. So the seller's name + number (the contact box) is HIDDEN by
// default and only shows when the seller taps the contact button, for this
// live only; tapping the box hides it again. Never a URL, QR or app logo.
// Viewers also reach the seller through the profile bio link, which lands on
// the mini page — and the car on this screen is pinned there ("Live now",
// set_live_listing). The #number is the shared language: a viewer comments
// "#3", the seller says "tap my profile, car #3".
//
// The Cars screen is laid out like the quotation poster salesmen already hold
// up on lives: title, photo | price - deposit = loan at rate, then (contact |)
// tenure rows with the monthly, then a "comment #N" bar. One formula
// (financing.js). The default (10% down, 7 years) is the same estimate the
// mini page card shows, so the two never disagree.
//
// Deposit chips switch the whole sheet; tapping a tenure row picks it (shown
// big, with a take-home-pay guide that always prints the 35% rule). The rate
// can be typed FLAT, the way brochures quote it, and is converted to EIR per
// tenure (liveMaths.eirForTenure).
//
// Cars above HIGH_VALUE_THRESHOLD get the table HERE ONLY (owner's call,
// 2026-10-03: a seller on a live is asked about them too), labelled as a rough
// guide. calcMonthly and the mini page card still say "financing on request".
//
// The breakdown beside the photo is the WORKING: the trust a viewer got from
// watching the seller punch it into a calculator.
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
const TENURES_DESC = [...TENURES].reverse(); // the poster lists longest first
const DEFAULT_DOWN = Math.round((1 - DEFAULT_LOAN_RATIO) * 100); // 10
const DOWN_ROWS = [DEFAULT_DOWN, 20, 30];
const DEFAULT_TENURE = 7;
const HEARTBEAT_MS = 4 * 60 * 1000; // live_until window is 10 min server-side
const REPORT_MIN_MS = 60 * 1000;     // a quick peek at the presenter is not a live

const carName = (c) => [c.year, c.brand, c.model].filter(Boolean).join(' ');

// 0182479790 / 60182479790 -> 018-2479790, the way it is said out loud.
const fmtPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('60')) d = `0${d.slice(2)}`;
  if (d.length < 9) return '';
  return `${d.slice(0, 3)}-${d.slice(3)}`;
};

export default function LivePresenter({ listings, slug, sellerId, sellerName, sellerPhone, onClose }) {
  const [mode, setMode] = useState('cars'); // 'cars' | 'budget'
  const [idx, setIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [showContact, setShowContact] = useState(false); // off every time: see header
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
  // Presenter language, separate from the app's (liveCopy.js).
  const { i18n } = useTranslation();
  const [lang, setLang] = useState(() => initialLiveLang(i18n.language));
  const t = LIVE_COPY[lang];
  const toggleLang = () => setLang((l) => { const next = l === 'ms' ? 'en' : 'ms'; saveLiveLang(next); return next; });
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
  const phoneText = fmtPhone(sellerPhone);
  const contact = (sellerName || phoneText)
    ? { name: (sellerName || '').trim(), phone: phoneText } : null;
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
      ? [{ key: 'c', label: custom > 0 ? `RM ${fmt(custom)}` : t.noDeposit, down: custom, custom: true }] : []),
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
    ? t.rateFlatText(fmtRate(rate), fmtRate(rateFor(y)))
    : `${fmtRate(rate)}% EIR`);

  // Budget mode. "pay" runs the 35% rule backwards; the line under the input
  // always prints that rule, the same way the tenure pick does.
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
          Phones and tablets: ONE portrait stage, 9:16 at most, sized in
          container units so it fits a 375px phone with no scroll.
          Desktop (mouse + landscape screen, 1024px+): a wide two-column sheet
          (photo left, the working and the tenure table right). Owner's call,
          2026-10-04: sellers film their monitor and the 9:16 column was too
          thin to read on camera. The desktop block at the end of the styles is
          the only place that layout lives. */}
      <style>{`
        .lp { position: fixed; inset: 0; z-index: 1000; background: #E8E5DE; color: #111827; font-family: var(--xd-font-body); -webkit-font-smoothing: antialiased; }
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
        .lp-stage { height: 100%; width: min(100%, calc(100dvh * 9 / 16)); margin: 0 auto; background: #F7F6F2; display: flex; flex-direction: column; container-type: size; }
        .lp-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; background: #fff; border-bottom: 1px solid rgba(0,0,0,.06); flex-shrink: 0; }
        .lp-count { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; }
        .lp-iconbtn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgba(0,0,0,.12); background: #fff; color: #111827; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .lp-lang { font-size: 13px; font-weight: 800; letter-spacing: .04em; font-family: inherit; }
        .lp-iconbtn[aria-pressed="true"] { background: #0f1115; border-color: #0f1115; color: #fff; }
        .lp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .lp-body > * { flex-shrink: 0; }
        .lp-card { background: #fff; border-radius: 14px; border: 1px solid rgba(0,0,0,.06); box-shadow: 0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.05); }
        /* The quotation sheet (the poster sellers hold up on lives): title, then
           photo | price breakdown, then contact | tenure table, then the comment
           bar. Sized in container units so it fits the stage with no scroll. */
        .lp-sheet { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .lp-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .lp-num { font-family: 'Bebas Neue', sans-serif; font-size: clamp(26px, 8cqw, 44px); line-height: 1; letter-spacing: .02em; color: #fff; background: #0f1115; border-radius: 8px; padding: 6px 10px 3px; flex-shrink: 0; }
        .lp-tt { min-width: 0; }
        .lp-name { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(24px, 7.4cqw, 44px); line-height: .95; letter-spacing: .015em; margin: 0; color: #0f1115; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-spec { font-size: clamp(11px, 3cqw, 15px); color: #6b7280; margin: 3px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-pair { display: grid; grid-template-columns: minmax(0, 42fr) minmax(0, 58fr); gap: 10px; align-items: center; }
        .lp-photo { position: relative; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: #EDEAE3; }
        .lp-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .lp-dots { position: absolute; bottom: 6px; left: 0; right: 0; display: flex; justify-content: center; gap: 4px; pointer-events: none; }
        .lp-dots span { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 2px rgba(0,0,0,.4); }
        .lp-dots span[data-on="1"] { background: #fff; }
        .lp-brk { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
        .lp-brk td { padding: 3px 0; font-size: clamp(12px, 3.4cqw, 19px); color: #4b5563; }
        .lp-brk td:last-child { text-align: right; font-weight: 700; color: #111827; white-space: nowrap; }
        .lp-brk tr.lp-loan td { padding-top: 6px; border-top: 1px solid rgba(0,0,0,.1); font-weight: 700; color: #0f1115; }
        .lp-brk tr.lp-loan td:last-child { font-size: clamp(15px, 4.4cqw, 24px); }
        .lp-deps button { padding: 0 4px; }
        .lp-low { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: stretch; }
        .lp-low.lp-with { grid-template-columns: minmax(0, 38fr) minmax(0, 62fr); }
        .lp-contact { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px 6px; border: none; border-radius: 10px; background: #F1EFEA; font: inherit; color: #0f1115; text-align: center; cursor: pointer; min-width: 0; }
        .lp-contact b { font-size: clamp(13px, 3.8cqw, 20px); font-weight: 800; letter-spacing: .06em; text-transform: uppercase; overflow-wrap: anywhere; }
        .lp-contact span { font-size: clamp(14px, 4.2cqw, 22px); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .lp-ten { width: 100%; border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; }
        .lp-ten th { font-size: clamp(10px, 2.7cqw, 14px); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #9ca3af; padding: 0 10px 4px; text-align: right; }
        .lp-ten th:first-child { text-align: left; }
        .lp-ten td { padding: 6px 10px; font-size: clamp(13px, 3.8cqw, 20px); font-weight: 600; color: #4b5563; border-top: 1px solid rgba(0,0,0,.06); }
        .lp-ten td:last-child { text-align: right; font-size: clamp(17px, 5.2cqw, 28px); font-weight: 800; color: #111827; }
        .lp-ten tr.lp-t { cursor: pointer; }
        .lp-ten tr.lp-t:hover td { background: rgba(15,17,21,.04); }
        .lp-ten tr.lp-def td, .lp-ten tr.lp-def:hover td { background: #0f1115; color: #fff; border-top-color: transparent; }
        .lp-ten tr.lp-def td:last-child { font-size: clamp(22px, 7cqw, 40px); }
        .lp-ten tr.lp-def td:first-child { border-radius: 8px 0 0 8px; }
        .lp-ten tr.lp-def td:last-child { border-radius: 0 8px 8px 0; }
        .lp-salary { font-size: clamp(12px, 3.1cqw, 16px); color: #4b5563; margin: 0; line-height: 1.4; }
        .lp-salary b { color: #0f1115; font-variant-numeric: tabular-nums; }
        .lp-work { font-size: clamp(13px, 3.4cqw, 18px); font-weight: 600; color: #374151; margin: 0; font-variant-numeric: tabular-nums; line-height: 1.45; }
        .lp-work em { font-style: normal; color: #9ca3af; font-weight: 500; }
        .lp-cta { margin: 0; padding: 8px 10px; border-radius: 8px; background: #0f1115; color: #fff; text-align: center; font-size: clamp(11px, 3.1cqw, 16px); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
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

        /* Desktop only: a wide, landscape quotation sheet for sellers who film
           their monitor. Phones and tablets keep the portrait stage above.
           Sizes switch to cqh (stage height) so a 768px laptop and a 1080p
           monitor both fit with no scroll. */
        @media (min-width: 1024px) and (orientation: landscape) and (hover: hover) and (pointer: fine) {
          .lp-stage { width: min(100%, 1440px, calc(100dvh * 1.7)); }
          .lp-top { padding: 10px 20px; }
          .lp-body { padding: 16px 20px; }
          /* Spare height on a tall monitor goes above and below the card, not all under it. */
          .lp-fit:has(.lp-sheet) { margin-block: auto; }
          .lp-sheet { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 24px; row-gap: 12px; padding: 20px 24px;
            grid-template-areas: "title title" "photo brk" "photo deps" "photo low" "salary salary" "note cta"; align-items: start; }
          .lp-sheet .lp-title { grid-area: title; }
          .lp-sheet .lp-pair { display: contents; }
          .lp-sheet .lp-photo { grid-area: photo; aspect-ratio: auto; width: 100%; height: 100%; min-height: 220px; align-self: stretch; border-radius: 12px; }
          .lp-sheet .lp-brk { grid-area: brk; }
          .lp-sheet .lp-deps { grid-area: deps; }
          .lp-sheet .lp-low { grid-area: low; }
          .lp-sheet .lp-salary { grid-area: salary; }
          .lp-sheet .lp-note { grid-area: note; align-self: center; }
          .lp-sheet .lp-cta { grid-area: cta; align-self: center; }
          .lp-num { font-size: clamp(30px, 5.4cqh, 64px); padding: 8px 14px 4px; }
          .lp-name { font-size: clamp(30px, 5.4cqh, 64px); }
          .lp-spec { font-size: clamp(13px, 1.9cqh, 22px); }
          .lp-brk td { font-size: clamp(15px, 2.4cqh, 28px); padding: 4px 0; }
          .lp-brk tr.lp-loan td:last-child { font-size: clamp(18px, 3.1cqh, 36px); }
          .lp-seg button { height: clamp(34px, 4.6cqh, 48px); font-size: clamp(13px, 1.7cqh, 18px); }
          .lp-contact b { font-size: clamp(15px, 2.4cqh, 28px); }
          .lp-contact span { font-size: clamp(16px, 2.6cqh, 30px); }
          .lp-ten th { font-size: clamp(11px, 1.5cqh, 16px); }
          .lp-ten td { font-size: clamp(15px, 2.4cqh, 28px); padding: 7px 14px; }
          .lp-ten td:last-child { font-size: clamp(18px, 3.2cqh, 36px); }
          .lp-ten tr.lp-def td:last-child { font-size: clamp(26px, 5cqh, 56px); }
          .lp-salary { font-size: clamp(13px, 1.9cqh, 21px); }
          .lp-note { font-size: clamp(12px, 1.6cqh, 17px); }
          .lp-cta { font-size: clamp(13px, 2cqh, 22px); padding: 10px 14px; }
          .lp-adjust { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .lp-adjust .lp-seg { grid-column: auto; }
          /* Budget: the viewer's number on the left, the cars that fit on the right. */
          .lp-fit:has(.lp-bud) { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 16px; align-items: start; }
          .lp-fit:has(.lp-bud) > .lp-adjust { grid-column: 1 / -1; }
          .lp-row img, .lp-row .lp-noimg { width: clamp(64px, 9cqh, 110px); }
          .lp-row .lp-n { font-size: clamp(24px, 4cqh, 44px); }
          .lp-row .lp-rn b { font-size: clamp(14px, 2.1cqh, 22px); }
          .lp-row .lp-m { font-size: clamp(16px, 2.7cqh, 30px); }
          .lp-nav { justify-content: center; }
          .lp-navbtn { flex: 0 1 320px; }
          .lp-report { max-width: 760px; width: 100%; margin: 0 auto; }
        }
      `}</style>

      <div className="lp-stage">
      {/* Top bar: mode + controls. Contact only shows when the seller turns it on. */}
      <div className="lp-top">
        {report ? <span className="lp-count">{t.liveEnded}</span> : (
          <div className="lp-seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={mode === 'cars'} onClick={() => setMode('cars')}>{t.cars}</button>
            <button type="button" aria-pressed={mode === 'budget'} onClick={() => setMode('budget')}>{t.budget}</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Shows the language on screen now; tap to switch. */}
          <button className="lp-iconbtn lp-lang" onClick={toggleLang} aria-label={t.langLabel}>
            {lang === 'ms' ? 'BM' : 'EN'}
          </button>
          {!report && mode === 'cars' && contact && (
            <button className="lp-iconbtn" onClick={() => setShowContact((v) => !v)}
              aria-label={showContact ? t.hideContact : t.showContact} aria-pressed={showContact}>
              <Contact size={17} />
            </button>
          )}
          {!report && (
            <button className="lp-iconbtn" onClick={() => setAdjustOpen((v) => !v)} aria-label={t.adjust} aria-pressed={adjustOpen}>
              <SlidersHorizontal size={17} />
            </button>
          )}
          <button className="lp-iconbtn" onClick={report ? onClose : finish} aria-label={t.exit}><X size={18} /></button>
        </div>
      </div>

      {report ? <LiveReport report={report} onDone={onClose} t={t} /> : (<>
      <div className="lp-body" onTouchStart={mode === 'cars' ? onTouchStart : undefined} onTouchEnd={mode === 'cars' ? onTouchEnd : undefined}>
        <div className="lp-fit" ref={fitRef}>
        {adjustOpen && (
          <div className="lp-card lp-adjust">
            <div className="lp-seg" role="group" aria-label={t.rateQuoted}>
              <button type="button" aria-pressed={basis === 'eir'} onClick={() => setBasis('eir')}>EIR</button>
              <button type="button" aria-pressed={basis === 'flat'} onClick={() => setBasis('flat')}>{t.flatBrochure}</button>
            </div>
            <label style={mode === 'budget' ? { gridColumn: '1 / -1' } : undefined}>
              {basis === 'flat' ? t.rateFlat : t.rateEir}
              <input className="lp-in" type="number" inputMode="decimal" step="0.01" min="0" value={eir} onChange={(e) => setEir(e.target.value)} />
            </label>
            {mode === 'cars' && (
              <label>
                {t.customDeposit}
                <input className="lp-in" type="number" inputMode="numeric" min="0" placeholder={t.noDepositHint} value={customDown}
                  onChange={(e) => { setCustomDown(e.target.value); if (e.target.value !== '') setPick((p) => ({ ...p, row: 'c' })); }} />
              </label>
            )}
            {basis === 'flat' && (
              <p className="lp-hint">
                {t.flatHint(TENURES.map((y) => `${t.yrsShort(y)} ${fmtRate(rateFor(y))}%`).join(', '))}
              </p>
            )}
          </div>
        )}

        {mode === 'cars' ? (
        <div className="lp-card lp-sheet">
          <div className="lp-title">
            <span className="lp-num">#{idx + 1}</span>
            <div className="lp-tt">
              <h2 className="lp-name">{carName(car)}</h2>
              <p className="lp-spec">
                {[car.variant, car.mileage ? `${fmt(car.mileage)} km` : null, car.transmission].filter(Boolean).join(' · ') || '\u00a0'}
              </p>
            </div>
          </div>

          <div className="lp-pair">
            {/* Photo: tap the left / right half to step through this car's photos. */}
            <div className="lp-photo">
              {images[imgIdx]
                ? <img src={images[imgIdx]} alt={carName(car)} />
                : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>{t.noPhoto}</div>}
              {images.length > 1 && (
                <>
                  <button aria-label={t.prevPhoto} onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                    style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', background: 'none', border: 'none', cursor: 'pointer' }} />
                  <button aria-label={t.nextPhoto} onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                    style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', background: 'none', border: 'none', cursor: 'pointer' }} />
                  <div className="lp-dots">
                    {images.slice(0, 12).map((_, i) => <span key={i} data-on={i === imgIdx ? '1' : '0'} />)}
                  </div>
                </>
              )}
            </div>

            {/* The working, line by line: price - deposit = loan, at this rate. */}
            <table className="lp-brk">
              <tbody>
                <tr><td>{t.price}</td><td>{price > 0 ? `RM ${fmt(price)}` : t.onRequest}</td></tr>
                {financeable && (<>
                  <tr><td>{t.deposit}</td><td>{picked.down > 0 ? `RM ${fmt(picked.down)}` : t.none}</td></tr>
                  <tr className="lp-loan"><td>{t.loan}</td><td>RM {fmt(price - picked.down)}</td></tr>
                  <tr><td>{t.rate}</td><td>{fmtRate(rate)}% {basis === 'flat' ? t.flat : 'EIR'}</td></tr>
                </>)}
              </tbody>
            </table>
          </div>

          {financeable && (<>
            <div className="lp-seg lp-deps" role="group" aria-label={t.deposit}>
              {rows.map((r) => (
                <button key={r.key} type="button" aria-pressed={r.key === picked.key}
                  onClick={() => setPick((p) => ({ ...p, row: r.key }))}>
                  {r.custom ? r.label : t.pctDown(r.key)}
                </button>
              ))}
            </div>

            <div className={showContact && contact ? 'lp-low lp-with' : 'lp-low'}>
              {showContact && contact && (
                <button type="button" className="lp-contact" onClick={() => setShowContact(false)} aria-label={t.hideContact}>
                  {contact.name && <b>{contact.name}</b>}
                  {contact.phone && <span>{contact.phone}</span>}
                </button>
              )}
              <table className="lp-ten">
                <thead><tr><th>{t.tenure}</th><th>{t.monthly}</th></tr></thead>
                <tbody>
                  {TENURES_DESC.map((y) => {
                    const on = y === pickYears;
                    return (
                      <tr key={y} className={on ? 'lp-t lp-def' : 'lp-t'} onClick={() => setPick((p) => ({ ...p, years: y }))}
                        role="button" aria-pressed={on}>
                        <td>{t.years(y)}</td>
                        <td>RM {fmt(monthlyFor(picked.down, y))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {salary && (
              <p className="lp-salary">
                {t.salary(pickYears)}<b>{t.about(`RM ${fmt(salary)}`)}</b>{t.salaryRule(Math.round(SALARY_SHARE * 100))}
              </p>
            )}
            <p className="lp-note" style={{ margin: 0 }}>
              {t.reducing}{basis === 'flat' ? t.flatAsEir(pickYears, fmtRate(rateFor(pickYears))) : ''}.{' '}
              {highValue ? t.highValue : t.subjectBank}
            </p>
          </>)}

          <p className="lp-cta">{t.cta(idx + 1)}</p>
        </div>
        ) : (<>
        {/* Budget: the viewer's number in, the cars that fit out. */}
        <div className="lp-card lp-bud">
          <div className="lp-seg" role="group" aria-label={t.budgetIs}>
            <button type="button" aria-pressed={budgetKind === 'monthly'} onClick={() => setBudgetKind('monthly')}>{t.monthlyBudget}</button>
            <button type="button" aria-pressed={budgetKind === 'pay'} onClick={() => setBudgetKind('pay')}>{t.takeHome}</button>
          </div>
          <label className="lp-money">
            <span>RM</span>
            <input type="number" inputMode="numeric" min="0" value={budgetAmount} placeholder="0"
              aria-label={budgetKind === 'pay' ? t.takeHomeAria : t.monthlyBudget}
              onChange={(e) => setBudgetAmount(e.target.value)} />
          </label>
          <div className="lp-budrow">
            <label>
              {t.depositRm}
              <input className="lp-in" type="number" inputMode="numeric" min="0" placeholder={t.noDepositHint} value={budgetDown}
                onChange={(e) => setBudgetDown(e.target.value)} />
            </label>
            <div className="lp-seg" role="group" aria-label={t.yearsAria}>
              {TENURES.map((y) => (
                <button key={y} type="button" aria-pressed={budgetYears === y} onClick={() => setBudgetYears(y)}>{t.yrsShort(y)}</button>
              ))}
            </div>
          </div>
          {maxMonthly ? (
            <p className="lp-work" style={{ margin: 0 }}>
              {budgetKind === 'pay' && <>RM {fmt(amount)} <em>×</em> {Math.round(SALARY_SHARE * 100)}% <em>=</em> </>}
              {t.upTo}<b>RM {fmt(maxMonthly)}{t.perMonth}</b>
              <br />{bDown > 0 ? t.depositAmt(`RM ${fmt(bDown)}`) : t.noDeposit} · {t.yearsAt(budgetYears, rateTextFor(budgetYears))}
            </p>
          ) : null}
          {budgetKind === 'pay' && maxMonthly ? (
            <p className="lp-salary" style={{ margin: 0 }}>{t.roughRule(Math.round(SALARY_SHARE * 100))}</p>
          ) : null}
        </div>

        <div className="lp-card lp-res">
          {!maxMonthly ? (
            <p className="lp-empty">{t.budgetEmpty}</p>
          ) : (<>
            <h3>{matches.fits.length ? t.fits(matches.fits.length) : t.noneFit}</h3>
            {matches.fits.map((m) => <BudgetRow key={m.car.id} m={m} onOpen={openFromBudget} t={t} />)}
            {matches.above.length > 0 && <h3>{t.justAbove}</h3>}
            {matches.above.map((m) => <BudgetRow key={m.car.id} m={m} over onOpen={openFromBudget} t={t} />)}
            <p className="lp-note" style={{ marginBottom: 8 }}>
              {t.budgetNote}
              {anyHighValue ? t.budgetHigh : ''}
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
function BudgetRow({ m, over, onOpen, t }) {
  const img = Array.isArray(m.car.images) ? m.car.images.find(Boolean) : null;
  return (
    <button type="button" className={over ? 'lp-row lp-over' : 'lp-row'} onClick={() => onOpen(m)}>
      {img ? <img src={img} alt="" /> : <span className="lp-noimg" />}
      <span className="lp-n">#{m.n}</span>
      <span className="lp-rn">
        <b>{carName(m.car)}</b>
        <span>RM {fmt(m.price)}</span>
      </span>
      <span className="lp-m">RM {fmt(m.monthly)}<small>{t.perMonth}</small></span>
    </button>
  );
}

// After the live. Counts only: this can still be on the stream, so no buyer
// name, phone or message ever renders here.
function LiveReport({ report, onDone, t }) {
  if (report.loading) {
    return <div className="lp-report"><p className="lp-note">{t.adding}</p></div>;
  }
  const n = (v) => (v === null || v === undefined ? '-' : fmt(v));
  return (
    <div className="lp-report">
      <h2>{t.yourLive(report.minutes)}</h2>
      <div className="lp-tiles">
        <div className="lp-card lp-tile"><b>{report.eventsFailed ? '-' : n(report.visitors)}</b><span>{t.openedPage}</span></div>
        <div className="lp-card lp-tile"><b>{report.eventsFailed ? '-' : n(report.carTaps)}</b><span>{t.carTaps}</span></div>
        <div className="lp-card lp-tile"><b>{report.eventsFailed ? '-' : n(report.whatsappTaps)}</b><span>{t.waTaps}</span></div>
        <div className="lp-card lp-tile"><b>{n(report.newLeads)}</b><span>{t.newLeads}</span></div>
      </div>
      {report.topCar && (
        <div className="lp-card lp-tile">
          <span>{t.mostTapped}</span>
          <b style={{ fontSize: 22 }}>#{report.topCar.n} {report.topCar.name}</b>
          <span>{t.topTaps(report.topCar.taps)}</span>
        </div>
      )}
      <p className="lp-note">
        {t.reportNote}
      </p>
      <button className="lp-navbtn lp-next" onClick={onDone} style={{ flex: 'none' }}>{t.done}</button>
    </div>
  );
}
