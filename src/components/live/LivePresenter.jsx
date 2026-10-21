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
  netPrice, carLabel,
} from '../../utils/liveMaths';
import {
  LIVE_COPY, initialLiveLang, saveLiveLang, initialLiveCta, saveLiveCta, ctaLine, CTA_MAX,
  initialLiveOffer, saveLiveOffer, OFFER_MAX, initialLiveIns, saveLiveIns,
} from './liveCopy';
import { NCD_TIERS, motorPremium, insuranceRegion, ncdLabel } from '../../utils/motorInsurance';
import { ACCENT_PRESETS, accentTheme, initialLiveAccent, saveLiveAccent } from '../../utils/liveAccent';
import { useNewCarInfo, useNewCarInfos, useNewCarVariant, pickNewCarVariant } from '../newcar/NewCarListingInfo';
import { useModalHistory } from '../../hooks/useModalHistory';
import { setLiveOpen } from '../../lib/onlinePresence';

// Live presentation — the seller's full-screen view of their own cars, built
// to be shown on a TikTok / FB live (camera on the screen, or screen-share).
//
// TikTok can strike a live for a phone number, link, QR code or "WhatsApp me"
// on screen. So the seller's name + number (the contact box) is HIDDEN by
// default and only shows when the seller taps the contact button, for this
// live only; tapping the box hides it again. Never a URL, QR or app logo.
// When it IS on it is loud (owner, 2026-10-17): an accent banner, "Contact
// me" + the number big, like the posters advisors hold up. Loud, still opt-in.
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
// Every number in the working is tappable (owner, 2026-10-17): tap Rebate,
// Deposit or Rate and type, in place, mid-pitch. Adjust still holds them too.
//
// A new-car MODEL card (is_model_card, 20261017c) covers every variant: a
// variant row under the title switches price and spec, the same store the car
// page uses (useNewCarVariant), so a viewer who opens #N sees the same variant.
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
//
// `embedded` = the same screen as a live demo inside a page (the /for-salesmen
// hero). It renders in place instead of full screen, and does nothing a live
// does: no portal or scroll lock, no keyboard, no wake lock, no exit or report,
// no contact box, never calls set_live_listing (a seller browsing the page would
// pin a car on their own mini page), and never saves language or colour.
//
// New-car advisors (NEWCAR-1): their cards are ordinary listings (condition
// 'new'), priced from the brand's official list by the DB. `officialNew` says
// the seller is an advisor, so a new car's note names the price as official.

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-MY');
// Ringgit with the unit set small (.lp-rm) so the digits carry the weight.
// The phone size the desktop stage is laid out at before zooming: the size the
// Cars screen is checked to fit with no scroll.
const STAGE_W = 375;
const STAGE_H = 667;
// Desktop is twice the phone's width (owner, 2026-10-18): the phone column was
// too small on a monitor for the camera to read. Two columns: the car and its
// working on the left, deposit + tenure + everything under it on the right.
const DESK_W = STAGE_W * 2;

const Money = ({ n }) => <><span className="lp-rm">RM</span>{fmt(n)}</>;
const TENURES = [5, 7, MAX_TENURE_YEARS];
const TENURES_DESC = [...TENURES].reverse(); // the poster lists longest first
const DEFAULT_DOWN = Math.round((1 - DEFAULT_LOAN_RATIO) * 100); // 10
const DOWN_ROWS = [DEFAULT_DOWN, 20, 30];
const DEFAULT_TENURE = 7;
const HEARTBEAT_MS = 4 * 60 * 1000; // live_until window is 10 min server-side
const REPORT_MIN_MS = 60 * 1000;     // a quick peek at the presenter is not a live

// Title only: the Cars screen prints the variant beside it in grey (and the
// desktop variant switch names it). Everywhere else uses carLabel, with the variant.
const carName = (c) => [c.year, c.brand, c.model].filter(Boolean).join(' ');

// 0182479790 / 60182479790 -> 018-2479790, the way it is said out loud.
const fmtPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('60')) d = `0${d.slice(2)}`;
  if (d.length < 9) return '';
  return `${d.slice(0, 3)}-${d.slice(3)}`;
};

export default function LivePresenter({ listings, slug, sellerId, sellerName, sellerPhone, onClose, embedded = false, officialNew = false, initialLang }) {
  // "Online now" in the console counts this tab as live (src/lib/onlinePresence.js).
  // Not for the embedded demo on the marketing page, which is not a real live.
  useEffect(() => {
    if (embedded) return undefined;
    setLiveOpen(true);
    return () => setLiveOpen(false);
  }, [embedded]);
  const [mode, setMode] = useState('cars'); // 'cars' | 'budget' | 'docs'
  const [docsKind, setDocsKind] = useState('employee'); // 'employee' | 'self'
  const [idx, setIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  // Adjust closes on a tap anywhere outside it, or Escape (owner, 2026-10-21).
  // 'click', not 'pointerdown': the tapped control acts first, then the panel
  // closes, so the layout never shifts under a finger mid-tap. The sliders
  // button is excluded or its own toggle would reopen the panel.
  const adjustRef = useRef(null);
  const adjustBtnRef = useRef(null);
  useEffect(() => {
    if (!adjustOpen) return undefined;
    // composedPath is fixed at dispatch, so a control that re-renders out of
    // the DOM during its own click still counts as inside.
    const onClick = (e) => {
      const path = e.composedPath();
      if (!path.includes(adjustRef.current) && !path.includes(adjustBtnRef.current)) setAdjustOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setAdjustOpen(false); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [adjustOpen]);
  const [showContact, setShowContact] = useState(false); // off every time: see header
  const [eir, setEir] = useState(String(DEFAULT_EIR));
  const [basis, setBasis] = useState('eir'); // 'eir' | 'flat' — how the seller typed the rate
  const [customDown, setCustomDown] = useState('');
  // Rebate per car, typed during this live only. Promos change monthly, so it
  // is not saved to the listing.
  const [rebates, setRebates] = useState({});
  const [pick, setPick] = useState({ row: DEFAULT_DOWN, years: DEFAULT_TENURE });
  const [editing, setEditing] = useState(null); // null | 'rebate' | 'deposit' | 'rate' | 'ins'
  // Insurance in the loan (motorInsurance.js): on/off remembered per device;
  // the NCD is the viewer's, picked on the pills under the working; a typed
  // figure (the seller's insurer quote, or an EV) wins for that car, this live.
  const [insOn, setInsOn] = useState(() => (embedded ? false : initialLiveIns()));
  const changeIns = (on) => { setInsOn(on); if (!embedded) saveLiveIns(on); };
  const [ncd, setNcd] = useState(0);
  const [insTyped, setInsTyped] = useState({});
  // Budget mode: what the viewer said in the chat.
  const [budgetKind, setBudgetKind] = useState('monthly'); // 'monthly' | 'pay'
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetDown, setBudgetDown] = useState('');
  const [budgetYears, setBudgetYears] = useState(DEFAULT_TENURE);
  const [report, setReport] = useState(null); // null = presenting; {loading} | result
  // Back while presenting asks first (a stray swipe must not end a live),
  // then ends it the same way the X does: the report shows, and Back again
  // closes. finish is declared below; the callback only runs on a gesture.
  useModalHistory(!embedded && !report, () => finish(), { isDirty: () => true });
  useModalHistory(!embedded && !!report, onClose);
  // Presenter language, separate from the app's (liveCopy.js).
  const { i18n } = useTranslation();
  // `initialLang` lets a host page (the /for-salesmen demo) start it in its own language.
  const [lang, setLang] = useState(() => (initialLang === 'ms' || initialLang === 'en' ? initialLang : initialLiveLang(i18n.language)));
  // Accent colour: the seller's pick, kept readable for white text (liveAccent.js).
  const [accentPick, setAccentPick] = useState(initialLiveAccent);
  const theme = accentTheme(accentPick);
  const pickAccent = (hex) => { setAccentPick(hex); if (!embedded) saveLiveAccent(hex); };
  // The seller's own comment line, remembered per device (liveCopy.js ctaLine).
  const [ctaCustom, setCtaCustom] = useState(() => (embedded ? '' : initialLiveCta()));
  const changeCta = (v) => { const next = v.slice(0, CTA_MAX); setCtaCustom(next); if (!embedded) saveLiveCta(next); };
  // The seller's standing offer (free extras), remembered per device (liveCopy.js).
  const [offer, setOffer] = useState(() => (embedded ? '' : initialLiveOffer()));
  const changeOffer = (v) => { const next = v.slice(0, OFFER_MAX); setOffer(next); if (!embedded) saveLiveOffer(next); };
  const t = LIVE_COPY[lang];
  const toggleLang = () => setLang((l) => { const next = l === 'ms' ? 'en' : 'ms'; if (!embedded) saveLiveLang(next); return next; });
  const startedAt = useRef(new Date());
  const touchX = useRef(null);
  const fitRef = useRef(null);

  // Desktop: magnify the phone-sized stage to fill the screen height (see the
  // note above the styles). null = phone/tablet, the stage sizes itself.
  const [deskZoom, setDeskZoom] = useState(null);
  useEffect(() => {
    if (embedded || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
    const update = () => setDeskZoom(mq.matches ? Math.min(window.innerHeight / STAGE_H, window.innerWidth / DESK_W) : null);
    update();
    window.addEventListener('resize', update);
    mq.addEventListener?.('change', update);
    return () => { window.removeEventListener('resize', update); mq.removeEventListener?.('change', update); };
  }, [embedded]);

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
    if (need > avail && avail > 0) {
      // Shrinking widens the columns, which makes aspect-ratio boxes (the
      // photo) taller, so one measurement undershoots: step down until
      // nothing spills, never under the 80% floor.
      let z = Math.max(0.8, avail / need);
      el.style.zoom = String(z);
      while (z > 0.8 && body.scrollHeight > body.clientHeight) {
        z = Math.max(0.8, z - 0.01);
        el.style.zoom = String(z);
      }
    }
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
  // Variants of a model card. The info is checked against the car on screen so
  // the render right after a swipe never prices this car off the last one.
  const rawInfo = useNewCarInfo(car?.is_model_card ? car.id : null);
  const carInfo = rawInfo && car && rawInfo.brand === car.brand && rawInfo.model === car.model ? rawInfo : null;
  const { variants, current: variant, choose: chooseVariant } = useNewCarVariant(car?.id, carInfo);
  // Every model card's variants, for the Budget tab (budgetCars, below).
  const cardInfos = useNewCarInfos(mode === 'budget' ? listings.filter((c) => c.is_model_card).map((c) => c.id) : []);
  const shown = car && variant
    ? { ...car, selling_price: variant.price, variant: variant.variant, transmission: variant.transmission || car.transmission }
    : car;
  const phoneText = fmtPhone(sellerPhone);
  const contact = !embedded && (sellerName || phoneText)
    ? { name: (sellerName || '').trim(), phone: phoneText } : null;
  const images = Array.isArray(car?.images) ? car.images.filter(Boolean) : [];
  // price = asking, net = what the loan is worked from (asking - rebate).
  const { price, rebate, net } = netPrice(shown, rebates);
  const rate = Math.max(0, Number(eir) || 0);
  // Insurance for a car: typed figure first, else the tariff estimate off the
  // price before rebate (the car's value) and its engine cc (a model card's
  // cc is on the picked variant). null = no cc (EV / not filled): tap to type.
  const insFor = (c, value, cc) => {
    if (!insOn) return 0;
    const typed = insTyped[c?.id];
    if (typed !== undefined && typed !== '') return Math.max(0, Number(typed) || 0);
    const est = motorPremium({ sumInsured: value, cc, ncd, region: insuranceRegion(c?.state) });
    return est ? est.total : null;
  };
  const ins = insFor(car, price, variant?.specs?.engine_cc ?? car?.engine_cc);
  const insAmt = ins || 0;

  const go = useCallback((d) => {
    setIdx((i) => (i + d + listings.length) % listings.length);
    setImgIdx(0);
    setEditing(null);
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
    if (embedded) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [embedded]);

  // Keyboard for a laptop running LIVE Studio: arrows swipe, Esc closes.
  useEffect(() => {
    if (embedded) return undefined;
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
  }, [go, onClose, finish, report, mode, embedded]);

  // A live runs 30-60 minutes; a phone that dims and locks mid-pitch kills it.
  useEffect(() => {
    if (embedded) return undefined;
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
  }, [embedded]);

  // Tell the mini page which car is on screen. Debounced so flicking through
  // five cars is one write; heartbeat keeps the 10-minute window open; closing
  // clears it. Errors are ignored on purpose: the presenter must keep working
  // even if the sync is down (or before migration 20261003a is applied).
  // The report screen means the live is over: stop pinning the car right away.
  const carId = report || embedded ? null : (car?.id || null);
  useEffect(() => {
    if (report && !embedded) supabase.rpc('set_live_listing', { p_listing_id: null }).then(() => {}, () => {});
  }, [report, embedded]);
  useEffect(() => {
    if (!carId) return undefined;
    const push = () => { supabase.rpc('set_live_listing', { p_listing_id: carId }).then(() => {}, () => {}); };
    const t = setTimeout(push, 600);
    const hb = setInterval(push, HEARTBEAT_MS);
    return () => { clearTimeout(t); clearInterval(hb); };
  }, [carId]);
  useEffect(() => () => {
    if (!embedded) supabase.rpc('set_live_listing', { p_listing_id: null }).then(() => {}, () => {});
  }, [embedded]);

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
    ...(custom !== null && custom < net
      ? [{ key: 'c', label: custom > 0 ? `RM ${fmt(custom)}` : t.noDeposit, down: custom, custom: true }] : []),
    ...DOWN_ROWS.map((pct) => ({ key: pct, down: net * pct / 100 })),
  ];
  const financeable = net > 0;
  const highValue = price > HIGH_VALUE_THRESHOLD;
  const rateFor = (y) => eirForTenure(rate, basis, y);
  const monthlyFor = (down, y) => monthlyPayment(net + insAmt - down, rateFor(y), y * 12);
  const picked = rows.find((r) => r.key === pick.row) || rows.find((r) => r.key === DEFAULT_DOWN);
  // Tapping the deposit row starts the box at the deposit on screen.
  const openDeposit = () => {
    if (editing === 'deposit') return;
    setCustomDown(String(Math.round(picked.down)));
    setPick((p) => ({ ...p, row: 'c' }));
    setEditing('deposit');
  };
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
  // A model card is priced once per variant, each named, so "fits" says WHICH
  // X50 the budget buys, not the cheapest one under the model's name. Its cc
  // rides along from the variant's specs so insurance is added here too.
  const budgetCars = listings.flatMap((c, i) => {
    const vs = c.is_model_card ? (cardInfos[c.id]?.variants || []).filter((v) => v.price != null) : [];
    if (!vs.length) return [{ ...c, _n: i + 1 }];
    return vs.map((v) => ({
      ...c, _n: i + 1, _variantId: v.model_id, selling_price: v.price, variant: v.variant,
      engine_cc: v.specs?.engine_cc ?? c.engine_cc,
    }));
  });
  const matches = budgetMatches(budgetCars, {
    maxMonthly, deposit: bDown, years: budgetYears, rate, basis, rebates,
    extraFor: (c) => insFor(c, Number(c.selling_price) || 0, c.engine_cc) || 0,
  });
  const openFromBudget = (m) => {
    if (m.car._variantId) pickNewCarVariant(m.car.id, m.car._variantId);
    setIdx(m.n - 1);
    setImgIdx(0);
    setCustomDown(String(bDown));
    setPick({ row: 'c', years: budgetYears });
    setMode('cars');
  };
  const anyHighValue = [...matches.fits, ...matches.above].some((m) => m.price > HIGH_VALUE_THRESHOLD);

  const screen = (
    <div className={`lp${embedded ? ' lp-embed' : ''}${deskZoom ? ' lp-desk' : ''}`} style={{ '--lp-a': theme.accent, '--lp-a1': theme.light, '--lp-a2': theme.dark, '--lp-rgb': theme.rgb }}>
      {/* Near-white glass cards with ink #0f1115 text over the brand cream stage with a red glow;
          one accent gradient (--lp-grad) marks what is selected or tappable.
          Phones and tablets: ONE portrait stage, 9:16 at most, sized in
          container units so it fits a 375px phone with no scroll.
          Desktop (mouse, 1024px+): the phone's height, TWICE its width
          (DESK_W x STAGE_H, about square), magnified with CSS zoom to the
          monitor's full height. Sellers film the monitor with a phone held
          upright: the 2026-10-04 full-screen wide sheet spilled out of that
          frame, and the phone-shaped column (2026-10-18) was too small to read
          on camera. Owner, 2026-10-18: double the width, no wider. Two
          columns (.lp-cols): car + working left, deposit/tenure/rest right. */}
      <style>{`
        .lp { --lp-grad: linear-gradient(120deg, var(--lp-a1) 0%, var(--lp-a) 45%, var(--lp-a2) 100%); position: fixed; inset: 0; z-index: 1000; background: #DEDCD8; color: #111827; font-family: var(--xd-font-body); -webkit-font-smoothing: antialiased; }
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
        /* Embedded demo: fills its parent box instead of the viewport. */
        .lp.lp-embed { position: absolute; z-index: auto; }
        .lp-embed .lp-stage { width: 100%; }
        /* Owner, 2026-10-05: the flat beige felt dead on stream. Colour lives in
           the stage BEHIND the cards (the brand's red glow in the corners of
           brand cream #EBEAE8, marketing/brand/brand.md; owner, 2026-10-05:
           red and cream only, no dark) and in one red gradient; the numbers stay dark on near-white glass so they still
           read through a phone camera filming a monitor. */
        .lp-stage { height: 100%; width: min(100%, calc(100dvh * 9 / 16)); margin: 0 auto;
          background:
            radial-gradient(75% 45% at 0% 0%, rgba(var(--lp-rgb),.30), transparent 70%),
            radial-gradient(70% 45% at 100% 100%, rgba(var(--lp-rgb),.28), transparent 70%),
            radial-gradient(50% 30% at 100% 10%, rgba(var(--lp-rgb),.10), transparent 70%),
            #EBEAE8; display: flex; flex-direction: column; container-type: size; }
        .lp-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; background: rgba(243,242,240,.6); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(33,31,30,.08); flex-shrink: 0; }
        .lp-count { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; }
        .lp-iconbtn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgba(33,31,30,.12); background: #fff; color: #111827; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .lp-lang { font-size: 13px; font-weight: 800; letter-spacing: .04em; font-family: inherit; }
        .lp-iconbtn[aria-pressed="true"] { background: var(--lp-grad); border-color: transparent; color: #fff; }
        .lp-body { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .lp-body > * { flex-shrink: 0; }
        .lp-card { background: rgba(255,255,255,.88); -webkit-backdrop-filter: blur(20px) saturate(1.4); backdrop-filter: blur(20px) saturate(1.4); border-radius: 16px; border: 1px solid rgba(255,255,255,.7); box-shadow: 0 12px 40px rgba(var(--lp-rgb),.14), 0 1px 2px rgba(33,31,30,.08); }
        /* The quotation sheet (the poster sellers hold up on lives): title, then
           photo | price breakdown, then contact | tenure table, then the comment
           bar. Sized in container units so it fits the stage with no scroll. */
        .lp-sheet { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .lp-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .lp-num { font-family: 'Bebas Neue', sans-serif; font-size: clamp(26px, 8cqw, 44px); line-height: 1; letter-spacing: .02em; color: #fff; background: var(--lp-grad); border-radius: 8px; padding: 6px 10px 3px; box-shadow: 0 4px 14px rgba(var(--lp-rgb),.35); flex-shrink: 0; }
        .lp-tt { min-width: 0; }
        .lp-name { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(24px, 7.4cqw, 44px); line-height: .95; letter-spacing: .015em; margin: 0; color: #0f1115; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-spec { font-size: clamp(11px, 3cqw, 15px); color: #6b7280; margin: 3px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-pair { display: grid; grid-template-columns: minmax(0, 42fr) minmax(0, 58fr); gap: 10px; align-items: center; }
        /* The frame is a fixed size; the photo fits INSIDE it, never cropped
           (owner, 2026-10-21: the desktop 2:1 frame cut the roof and wheels off
           a 4:3 photo). The bars are white so they melt into the light sheet
           and into studio shots, which have a white backdrop; the hairline
           keeps the frame's edge visible on camera. */
        .lp-photo { position: relative; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: inset 0 0 0 1px rgba(33,31,30,.10); }
        .lp-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
        /* New-car variant with no photo: the model name, not a grey "no photo". */
        .lp-dots { position: absolute; bottom: 6px; left: 0; right: 0; display: flex; justify-content: center; gap: 4px; pointer-events: none; }
        .lp-dots span { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 2px rgba(0,0,0,.4); }
        .lp-dots span[data-on="1"] { background: #fff; }
        /* The working, one tinted row per number the viewer asks about, so each
           reads as its own field on camera (owner, 2026-10-13, from the Excel
           posters sellers hold up): price neutral, rebate green, deposit blue,
           loan a dark result tile. Low-saturation tints, never a side bar. The
           answer (monthly) is the one accent-coloured thing on the sheet. */
        .lp-brk { width: 100%; border-collapse: separate; border-spacing: 0 4px; margin: -4px 0; font-variant-numeric: tabular-nums; }
        .lp-brk td { padding: 5px 9px; font-size: clamp(12px, 3.3cqw, 19px); font-weight: 600; color: #4b5563; background: #F4F3F1; }
        .lp-brk td:first-child { border-radius: 8px 0 0 8px; }
        .lp-brk td:last-child { border-radius: 0 8px 8px 0; text-align: right; font-weight: 800; color: #0f1115; white-space: nowrap; }
        .lp-brk tr.lp-r-reb td { background: rgba(16,185,129,.11); color: #047857; }
        .lp-brk tr.lp-r-reb td:last-child { color: #047857; }
        .lp-brk tr.lp-r-dep td { background: rgba(59,130,246,.10); color: #1d4ed8; }
        .lp-brk tr.lp-r-dep td:last-child { color: #1d4ed8; }
        .lp-brk tr.lp-loan td { padding-block: 8px; background: #0f1115; color: rgba(255,255,255,.72); }
        .lp-brk tr.lp-loan td:last-child { color: #fff; font-size: clamp(16px, 4.8cqw, 26px); }
        .lp-brk tr.lp-r-ins td { background: rgba(245,158,11,.10); color: #b45309; }
        .lp-brk tr.lp-r-ins td:last-child { color: #b45309; }
        /* NCD pills: six on one phone row, so they shrink and the label leads. */
        .lp-seg.lp-ncd { align-items: center; }
        .lp-seg.lp-ncd > span { padding: 0 6px 0 4px; font-size: clamp(10px, 2.8cqw, 13px); font-weight: 800; letter-spacing: .08em; color: #b45309; }
        .lp-seg.lp-ncd { padding: 3px; }
        .lp-seg.lp-ncd button { flex: 1 1 0; min-width: 0; padding: 0 2px; height: 26px; font-size: clamp(11px, 3cqw, 14px); }
        /* Insurance adds two rows; the photo gives the room back so the sheet
           still fits the camera frame without shrinking. */
        .lp-desk .lp-ins-on .lp-photo { aspect-ratio: 5 / 2; }
        .lp-ins-on .lp-pair { align-items: start; }
        /* Phone: six rows beside the photo; tighter rows keep the sheet on one screen. */
        .lp:not(.lp-desk) .lp-ins-on .lp-brk { border-spacing: 0 2px; margin: -2px 0; }
        .lp:not(.lp-desk) .lp-ins-on .lp-brk td { padding-block: 3px; }
        .lp:not(.lp-desk) .lp-ins-on .lp-brk tr.lp-loan td { padding-block: 5px; }
        .lp:not(.lp-desk) .lp-ins-on .lp-ten td { padding-block: 4px; }
        .lp-insadj { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: #4b5563; }
        .lp-brk tr.lp-r-rate td { background: none; padding-block: 1px; font-size: clamp(11px, 2.9cqw, 15px); color: #6b7280; }
        .lp-brk tr.lp-r-rate td:last-child { color: #374151; font-weight: 700; }
        /* "RM" is a unit, not the number: smaller and lighter so the digits lead. */
        .lp-rm { font-size: .7em; font-weight: 700; opacity: .62; margin-right: .22em; letter-spacing: .02em; }
        /* Four chips must share one phone-width row: "Tanpa deposit" + three
           "Deposit N%" in BM is ~470px of unbreakable text, which pushed the
           whole sheet sideways. Chips shrink equally and wrap onto two lines. */
        .lp-seg.lp-deps button { flex: 1 1 0; min-width: 0; height: auto; min-height: 34px; padding: 4px; white-space: normal; line-height: 1.15; font-size: clamp(11px, 3.3cqw, 13px); }
        .lp-low { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: stretch; }
        .lp-end { display: flex; flex-direction: column; gap: 6px; }
        .lp-contact { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 9px 14px; border: none; border-radius: 10px; background: var(--lp-grad); box-shadow: 0 6px 20px rgba(var(--lp-rgb),.4); font: inherit; color: #fff; text-align: left; cursor: pointer; min-width: 0; }
        .lp-c-who { display: flex; flex-direction: column; min-width: 0; }
        .lp-c-who small { font-family: 'Bebas Neue', sans-serif; font-size: clamp(16px, 4.6cqw, 26px); line-height: 1; letter-spacing: .04em; }
        .lp-c-who b { min-width: 0; font-size: clamp(11px, 3cqw, 16px); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-c-ph { flex-shrink: 0; font-family: 'Bebas Neue', sans-serif; font-size: clamp(24px, 7.4cqw, 40px); line-height: 1; letter-spacing: .03em; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .lp-offer { margin: 0; padding: 7px 12px; border-radius: 8px; background: rgba(16,185,129,.11); color: #065f46; font-size: clamp(12px, 3.3cqw, 18px); font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
        .lp-offer b { margin-right: 8px; font-size: .8em; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #047857; }
        .lp-seg.lp-vars { flex-wrap: wrap; }
        .lp-seg.lp-vars button { flex: 1 1 auto; height: auto; min-height: 34px; padding: 4px 10px; white-space: normal; line-height: 1.15; font-size: clamp(11px, 3.3cqw, 14px); }
        .lp-brk tr.lp-tap { cursor: pointer; }
        .lp-brk tr.lp-tap td:last-child { text-decoration: underline dotted rgba(0,0,0,.25); text-underline-offset: 3px; }
        .lp-cellin { box-sizing: border-box; width: 100%; min-width: 0; max-width: 7.5em; height: 1.9em; padding: 0 6px; border: 2px solid var(--lp-a); border-radius: 6px; background: #fff; color: #0f1115; font: inherit; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
        .lp-ten { width: 100%; border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; }
        .lp-ten th { font-size: clamp(10px, 2.7cqw, 14px); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #9ca3af; padding: 0 10px 4px; text-align: right; }
        .lp-ten th:first-child { text-align: left; }
        .lp-ten td { padding: 6px 10px; font-size: clamp(13px, 3.8cqw, 20px); font-weight: 600; color: #4b5563; border-top: 1px solid rgba(0,0,0,.06); }
        .lp-ten td:last-child { text-align: right; font-size: clamp(17px, 5.2cqw, 28px); font-weight: 800; color: #111827; letter-spacing: -.01em; }
        .lp-ten tr.lp-t { cursor: pointer; }
        .lp-ten tr.lp-t:hover td { background: rgba(15,17,21,.04); }
        /* The picked tenure: the seller's colour as a soft tint, same treatment
           as the rebate row (owner, 2026-10-13: no gradient here). */
        .lp-ten tr.lp-def td, .lp-ten tr.lp-def:hover td { background: rgba(var(--lp-rgb),.12); color: var(--lp-a2); border-top-color: transparent; }
        .lp-ten tr.lp-def td:first-child { font-weight: 800; }
        .lp-ten tr.lp-def td:last-child { color: var(--lp-a2); font-size: clamp(22px, 7cqw, 40px); }
        .lp-ten tr.lp-def td:first-child { border-radius: 8px 0 0 8px; }
        .lp-ten tr.lp-def td:last-child { border-radius: 0 8px 8px 0; }
        .lp-salary { font-size: clamp(12px, 3.1cqw, 16px); color: #4b5563; margin: 0; line-height: 1.4; }
        .lp-salary b { color: #0f1115; font-variant-numeric: tabular-nums; }
        .lp-work { font-size: clamp(13px, 3.4cqw, 18px); font-weight: 600; color: #374151; margin: 0; font-variant-numeric: tabular-nums; line-height: 1.45; }
        .lp-work em { font-style: normal; color: #9ca3af; font-weight: 500; }
        .lp-cta { margin: 0; padding: 8px 10px; border-radius: 8px; background: rgba(var(--lp-rgb),.12); color: var(--lp-a2); overflow-wrap: anywhere; text-align: center; font-size: clamp(11px, 3.1cqw, 16px); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        .lp-note { font-size: clamp(11px, 2.8cqw, 14px); color: #6b7280; line-height: 1.45; margin: 8px 0 0; }
        .lp-fit { display: flex; flex-direction: column; gap: 10px; }
        /* Column wrappers vanish on a phone (the sheet stays one column) and
           become two columns on the desktop stage. */
        .lp-cols, .lp-col { display: contents; }
        .lp-desk .lp-sheet { padding: 12px 16px; gap: 8px; }
        .lp-desk .lp-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
        .lp-desk .lp-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .lp-desk .lp-pair { grid-template-columns: minmax(0, 1fr); gap: 8px; }
        .lp-desk .lp-photo { aspect-ratio: 2 / 1; }
        .lp-desk .lp-brk { border-spacing: 0 4px; }
        .lp-desk .lp-brk td { padding: 5px 12px; font-size: 20px; }
        .lp-desk .lp-brk tr.lp-loan td { padding-block: 8px; }
        .lp-desk .lp-brk tr.lp-loan td:last-child { font-size: 30px; }
        .lp-desk .lp-brk tr.lp-r-rate td { font-size: 16px; }
        .lp-desk .lp-seg.lp-deps button { font-size: 15px; min-height: 36px; }
        .lp-desk .lp-ten td { font-size: 20px; padding: 4px 12px; }
        .lp-desk .lp-ten td:last-child { font-size: 28px; }
        .lp-desk .lp-ten tr.lp-def td:last-child { font-size: 40px; }
        .lp-desk .lp-name { font-size: 38px; }
        .lp-desk .lp-num { font-size: 40px; }
        .lp-desk .lp-seg.lp-vars button { font-size: 15px; }
        /* Desktop: the variant switch sits on the title's line, to its right
           (owner, 2026-10-18), so a model card costs no extra row. Phone: the
           wrapper vanishes and the switch stays under the title. */
        .lp-head { display: contents; }
        .lp-desk .lp-head { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .lp-desk .lp-head .lp-title { flex: 1 1 auto; }
        .lp-desk .lp-head .lp-vars { flex: 0 1 auto; max-width: 60%; justify-content: flex-end; }
        .lp-desk .lp-head .lp-vars button { flex: 0 1 auto; padding: 4px 12px; font-size: 14px; }
        /* The picked button names the variant, so the title drops it here and
           both stay on one line. */
        .lp-desk .lp-has-vars .lp-var { display: none; }
        .lp-desk .lp-cta { font-size: 15px; letter-spacing: .06em; }
        .lp-desk .lp-salary { font-size: 15px; line-height: 1.35; }
        .lp-desk .lp-note { font-size: 13px; line-height: 1.35; }
        .lp-desk .lp-cta { padding-block: 7px; }
        .lp-adjust { padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lp-adjust label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: #4b5563; min-width: 0; }
        .lp-in { width: 100%; height: 44px; background: #fff; border: 1px solid rgba(0,0,0,.12); border-radius: 10px; color: #111827; padding: 0 12px; font-size: 16px; font-family: inherit; font-variant-numeric: tabular-nums; }
        .lp-in:focus { outline: none; border-color: #0f1115; }
        .lp-seg { display: flex; gap: 4px; padding: 4px; background: rgba(33,31,30,.08); border-radius: 10px; }
        .lp-adjust .lp-seg { grid-column: 1 / -1; }
        .lp-seg button { flex: 1; height: 34px; padding: 0 12px; border: none; border-radius: 7px; background: transparent; font: inherit; font-size: 13px; font-weight: 700; color: #4b5563; cursor: pointer; white-space: nowrap; }
        .lp-seg button[aria-pressed="true"] { background: #fff; color: #0f1115; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
        .lp-adjust .lp-wide { grid-column: 1 / -1; }
        .lp-adjust .lp-wide .lp-hint { font-weight: 500; }
        .lp-hint { grid-column: 1 / -1; font-size: 12px; color: #6b7280; line-height: 1.5; margin: 0; }
        .lp-nav { display: flex; gap: 10px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: rgba(243,242,240,.6); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border-top: 1px solid rgba(33,31,30,.08); flex-shrink: 0; }
        .lp-navbtn { flex: 1; height: 48px; border-radius: 12px; border: 1px solid rgba(0,0,0,.12); background: #fff; color: #111827; font-size: 16px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-family: inherit; font-variant-numeric: tabular-nums; }
        .lp-navbtn.lp-next { background: var(--lp-grad); border-color: transparent; color: #fff; box-shadow: 0 6px 20px rgba(var(--lp-rgb),.4); }
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
        .lp-colours { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .lp-colours > span { flex-basis: 100%; font-size: 12px; font-weight: 700; color: #4b5563; }
        .lp-sw { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.15); cursor: pointer; padding: 0; flex-shrink: 0; position: relative; overflow: hidden; }
        .lp-sw[aria-pressed="true"], .lp-sw[data-on="1"] { box-shadow: 0 0 0 2px #0f1115; }
        .lp-sw-any { background: conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444); }
        .lp-sw-any input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }
        .lp-docs { padding: 14px; display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 760px; margin: 0 auto; box-sizing: border-box; }
        .lp-docs .lp-name { white-space: normal; }
        /* Year + make + model + variant can be long ("2022 Lexus IS 300 2.0L(T) F-Sport"): two lines, never cut mid-name. */
        .lp-name-car { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .lp-var { color: #6b7280; }
        .lp-docs ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .lp-docs li { display: flex; align-items: center; gap: 12px; font-size: clamp(16px, 4.8cqw, 26px); font-weight: 700; color: #0f1115; line-height: 1.25; }
        .lp-docs li span { flex-shrink: 0; width: 1.6em; height: 1.6em; border-radius: 8px; background: var(--lp-grad); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: .8em; font-variant-numeric: tabular-nums; }
        .lp-top > .lp-seg { min-width: 0; }
        .lp-top > .lp-seg button { flex: 1 1 auto; padding: 0 8px; font-size: 13px; }
        .lp-tools { display: flex; gap: 8px; flex-shrink: 0; }
        /* Three mode labels + four buttons must share one row on a 360px phone
           (BM "Dokumen" is the longest label), so the bar tightens there. */
        @container (max-width: 400px) {
          .lp-top { padding: 8px; gap: 6px; }
          .lp-tools { gap: 5px; }
          .lp-top .lp-iconbtn { width: 36px; height: 36px; }
          .lp-top > .lp-seg { padding: 3px; gap: 2px; }
          .lp-top > .lp-seg button { padding: 0 6px; font-size: 12px; }
        }
        .lp-empty { font-size: 14px; color: #6b7280; line-height: 1.5; margin: 10px 0; }
        .lp-report { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 16px; }
        .lp-report h2 { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 40px; line-height: 1; letter-spacing: .015em; color: #0f1115; margin: 0; }
        .lp-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .lp-tile { padding: 16px; }
        .lp-tile b { display: block; font-size: 32px; font-weight: 800; color: #0f1115; font-variant-numeric: tabular-nums; line-height: 1.1; }
        .lp-tile span { display: block; font-size: 13px; color: #4b5563; margin-top: 4px; }
      `}</style>

      <div className="lp-stage" style={deskZoom ? { width: DESK_W, height: STAGE_H, zoom: deskZoom } : undefined}>
      {/* Top bar: mode + controls. Contact only shows when the seller turns it on. */}
      <div className="lp-top">
        {report ? <span className="lp-count">{t.liveEnded}</span> : (
          <div className="lp-seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={mode === 'cars'} onClick={() => setMode('cars')}>{t.cars}</button>
            <button type="button" aria-pressed={mode === 'budget'} onClick={() => setMode('budget')}>{t.budget}</button>
            <button type="button" aria-pressed={mode === 'docs'} onClick={() => setMode('docs')}>{t.docs}</button>
          </div>
        )}
        <div className="lp-tools">
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
          {!report && mode !== 'docs' && (
            <button ref={adjustBtnRef} className="lp-iconbtn" onClick={() => setAdjustOpen((v) => !v)} aria-label={t.adjust} aria-pressed={adjustOpen}>
              <SlidersHorizontal size={17} />
            </button>
          )}
          {!embedded && (
            <button className="lp-iconbtn" onClick={report ? onClose : finish} aria-label={t.exit}><X size={18} /></button>
          )}
        </div>
      </div>

      {report ? <LiveReport report={report} onDone={onClose} t={t} /> : (<>
      <div className="lp-body" onTouchStart={mode === 'cars' ? onTouchStart : undefined} onTouchEnd={mode === 'cars' ? onTouchEnd : undefined}>
        <div className="lp-fit" ref={fitRef}>
        {adjustOpen && mode !== 'docs' && (
          <div ref={adjustRef} className="lp-card lp-adjust">
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
                {t.rebateThisCar}
                <input className="lp-in" type="number" inputMode="numeric" min="0" placeholder="0" value={rebates[car.id] ?? ''}
                  onChange={(e) => { const v = e.target.value; setRebates((r) => ({ ...r, [car.id]: v })); }} />
              </label>
            )}
            {mode === 'cars' && (
              <label>
                {t.customDeposit}
                <input className="lp-in" type="number" inputMode="numeric" min="0" placeholder={t.noDepositHint} value={customDown}
                  onChange={(e) => { setCustomDown(e.target.value); if (e.target.value !== '') setPick((p) => ({ ...p, row: 'c' })); }} />
              </label>
            )}
            <div className="lp-wide lp-insadj">
              <span>{t.insuranceLabel}</span>
              <div className="lp-seg" role="group" aria-label={t.insuranceLabel}>
                <button type="button" aria-pressed={!insOn} onClick={() => changeIns(false)}>{t.insOff}</button>
                <button type="button" aria-pressed={insOn} onClick={() => changeIns(true)}>{t.insInLoan}</button>
              </div>
              <small className="lp-hint">{t.insuranceHint}</small>
            </div>
            {mode === 'cars' && (
              <label className="lp-wide">
                {t.ctaLabel}
                <input className="lp-in" type="text" maxLength={CTA_MAX} placeholder={t.cta('')}
                  value={ctaCustom} onChange={(e) => changeCta(e.target.value)} />
                <small className="lp-hint">{t.ctaHint}</small>
              </label>
            )}
            {mode === 'cars' && (
              <label className="lp-wide">
                {t.offerLabel}
                <input className="lp-in" type="text" maxLength={OFFER_MAX} value={offer} onChange={(e) => changeOffer(e.target.value)} />
                <small className="lp-hint">{t.offerHint}</small>
              </label>
            )}
            <div className="lp-colours" role="group" aria-label={t.colour}>
              <span>{t.colour}</span>
              {ACCENT_PRESETS.map((c) => (
                <button key={c} type="button" className="lp-sw" style={{ background: accentTheme(c).accent }}
                  aria-label={c} aria-pressed={theme.accent === accentTheme(c).accent} onClick={() => pickAccent(c)} />
              ))}
              {/* Any colour; a too-light pick is darkened so white text stays readable. */}
              <label className="lp-sw lp-sw-any" aria-label={t.colourAny}
                data-on={ACCENT_PRESETS.every((c) => accentTheme(c).accent !== theme.accent) ? '1' : '0'}>
                <input type="color" value={theme.accent.toLowerCase()} onChange={(e) => pickAccent(e.target.value)} />
              </label>
            </div>
            {basis === 'flat' && (
              <p className="lp-hint">
                {t.flatHint(TENURES.map((y) => `${t.yrsShort(y)} ${fmtRate(rateFor(y))}%`).join(', '))}
              </p>
            )}
          </div>
        )}

        {mode === 'cars' ? (
        <div className={insOn && price > 0 ? 'lp-card lp-sheet lp-ins-on' : 'lp-card lp-sheet'}>
          <div className={variants.length > 1 ? 'lp-head lp-has-vars' : 'lp-head'}>
          <div className="lp-title">
            <span className="lp-num">#{idx + 1}</span>
            <div className="lp-tt">
              {/* The variant sits in the title, next to the model (owner, 2026-10-18):
                  "2.5" alone on the spec line read as a stray number. */}
              <h2 className="lp-name lp-name-car">{carName(car)}{shown.variant ? <span className="lp-var"> {shown.variant}</span> : null}</h2>
              <p className="lp-spec">
                {(shown.condition === 'new'
                  ? [t.newTag, shown.transmission]
                  : [shown.mileage ? `${fmt(shown.mileage)} km` : null, shown.transmission]
                ).filter(Boolean).join(' · ') || '\u00a0'}
              </p>
            </div>
          </div>

          {variants.length > 1 && (
            <div className="lp-seg lp-vars" role="group" aria-label={t.variant}>
              {variants.map((v) => (
                <button key={v.model_id} type="button" aria-pressed={v.model_id === variant?.model_id}
                  onClick={() => chooseVariant(v.model_id)}>{v.variant}</button>
              ))}
            </div>
          )}
          </div>

          <div className="lp-cols">
          <div className="lp-col">
          <div className="lp-pair">
            {/* Photo: tap the left / right half to step through this car's photos. */}
            <div className="lp-photo">
              {images[imgIdx]
                ? <img src={images[imgIdx]} alt={carLabel(shown)} />
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

            {/* The working, line by line: price - rebate - deposit = loan, at this rate.
                Rebate, deposit and rate: tap the row to type a new number in place. */}
            <table className="lp-brk">
              <tbody>
                <tr><td>{t.price}</td><td>{price > 0 ? <Money n={price} /> : t.onRequest}</td></tr>
                {price > 0 && insOn && (
                  <tr className="lp-r-ins lp-tap" onClick={() => setEditing('ins')}>
                    <td>{t.insuranceEst}</td>
                    <td>{editing === 'ins' && !embedded
                      ? <EditCell value={insTyped[car.id] ?? (ins ? String(ins) : '')} aria={t.insuranceThisCar} onDone={() => setEditing(null)}
                          onChange={(v) => setInsTyped((m) => ({ ...m, [car.id]: v }))} />
                      : ins ? <>+ <Money n={ins} /></> : t.insTap}</td>
                  </tr>
                )}
                {price > 0 && (rebate > 0 || shown.condition === 'new' || editing === 'rebate') && (
                  <tr className="lp-r-reb lp-tap" onClick={() => setEditing('rebate')}>
                    <td>{t.rebate}</td>
                    <td>{editing === 'rebate' && !embedded
                      ? <EditCell value={rebates[car.id] ?? ''} aria={t.rebateThisCar} onDone={() => setEditing(null)}
                          onChange={(v) => setRebates((r) => ({ ...r, [car.id]: v }))} />
                      : rebate > 0 ? <>- <Money n={rebate} /></> : t.none}</td>
                  </tr>
                )}
                {financeable && (<>
                  <tr className="lp-r-dep lp-tap" onClick={openDeposit}>
                    <td>{t.deposit}</td>
                    <td>{editing === 'deposit' && !embedded
                      ? <EditCell value={customDown} aria={t.customDeposit} onDone={() => setEditing(null)}
                          onChange={(v) => { setCustomDown(v); setPick((p) => ({ ...p, row: 'c' })); }} />
                      : picked.down > 0 ? <>- <Money n={picked.down} /></> : t.none}</td>
                  </tr>
                  <tr className="lp-loan"><td>{t.loan}</td><td><Money n={net + insAmt - picked.down} /></td></tr>
                  <tr className="lp-r-rate lp-tap" onClick={() => setEditing('rate')}>
                    <td>{t.rate}</td>
                    <td>{editing === 'rate' && !embedded
                      ? <EditCell value={eir} decimal aria={basis === 'flat' ? t.rateFlat : t.rateEir} onDone={() => setEditing(null)} onChange={setEir} />
                      : <>{fmtRate(rate)}% {basis === 'flat' ? t.flat : 'EIR'}</>}</td>
                  </tr>
                </>)}
              </tbody>
            </table>
          </div>
          {/* The viewer's NCD: tap, never type. Hidden once a figure is typed
              for this car (the typed quote already has its NCD in it). */}
          {price > 0 && insOn && (insTyped[car.id] ?? '') === '' && ins !== null && (
            <div className="lp-seg lp-ncd" role="group" aria-label={t.ncd}>
              <span>{t.ncd}</span>
              {NCD_TIERS.map((n) => (
                <button key={n} type="button" aria-pressed={n === ncd} onClick={() => setNcd(n)}>{ncdLabel(n)}</button>
              ))}
            </div>
          )}
          </div>

          <div className="lp-col">
          {financeable && (<>
            <div className="lp-seg lp-deps" role="group" aria-label={t.deposit}>
              {rows.map((r) => (
                <button key={r.key} type="button" aria-pressed={r.key === picked.key}
                  onClick={() => setPick((p) => ({ ...p, row: r.key }))}>
                  {r.custom ? r.label : t.pctDown(r.key)}
                </button>
              ))}
            </div>

            <div className="lp-low">
              <table className="lp-ten">
                <thead><tr><th>{t.tenure}</th><th>{t.monthly}</th></tr></thead>
                <tbody>
                  {TENURES_DESC.map((y) => {
                    const on = y === pickYears;
                    return (
                      <tr key={y} className={on ? 'lp-t lp-def' : 'lp-t'} onClick={() => setPick((p) => ({ ...p, years: y }))}
                        role="button" aria-pressed={on}>
                        <td>{t.years(y)}</td>
                        <td><Money n={monthlyFor(picked.down, y)} /></td>
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
              {officialNew && car.condition === 'new' ? `${t.newPriceNote} ` : ''}{t.reducing}{basis === 'flat' ? t.flatAsEir(pickYears, fmtRate(rateFor(pickYears))) : ''}.{' '}
              {highValue ? t.highValue : t.subjectBank}
            </p>
          </>)}

          {/* Contact (tap to hide) sits on the comment bar's line: one slim row
              in the working's own style, not a box squeezing the tenure table. */}
          <div className="lp-end">
            {offer.trim() && <p className="lp-offer"><b>{t.offer}</b>{offer.trim()}</p>}
            {showContact && contact && (
              <button type="button" className="lp-contact" onClick={() => setShowContact(false)} aria-label={t.hideContact}>
                <span className="lp-c-who"><small>{t.contactMe}</small>{contact.name && <b>{contact.name}</b>}</span>
                {contact.phone && <span className="lp-c-ph">{contact.phone}</span>}
              </button>
            )}
            <p className="lp-cta">{ctaLine(ctaCustom, idx + 1, t.cta(idx + 1))}</p>
          </div>
          </div>
          </div>
        </div>
        ) : mode === 'docs' ? (
        /* Docs: what the bank asks the BUYER for. The car (new, used, recon)
           does not change it; how the buyer earns does. */
        <div className="lp-card lp-docs">
          <h2 className="lp-name">{t.docsTitle}</h2>
          <div className="lp-seg" role="group" aria-label={t.docsTitle}>
            <button type="button" aria-pressed={docsKind === 'employee'} onClick={() => setDocsKind('employee')}>{t.docsEmployee}</button>
            <button type="button" aria-pressed={docsKind === 'self'} onClick={() => setDocsKind('self')}>{t.docsSelf}</button>
          </div>
          <ol>
            {t.docsList[docsKind].map((d, i) => <li key={d}><span>{i + 1}</span>{d}</li>)}
          </ol>
          <p className="lp-note" style={{ margin: 0 }}>{t.docsAnyCar} {t.docsNote}</p>
          <p className="lp-salary" style={{ margin: 0 }}><b>{t.docsPrivacy}</b></p>
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
            {matches.fits.map((m) => <BudgetRow key={`${m.car.id}-${m.car._variantId || ''}`} m={m} onOpen={openFromBudget} t={t} />)}
            {matches.above.length > 0 && <h3>{t.justAbove}</h3>}
            {matches.above.map((m) => <BudgetRow key={`${m.car.id}-${m.car._variantId || ''}`} m={m} over onOpen={openFromBudget} t={t} />)}
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
    </div>
  );
  return embedded ? screen : createPortal(screen, document.body);
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
        <b>{carLabel(m.car)}</b>
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

// One number typed in place on the working (rebate / deposit / rate). Enter or
// tapping away closes it; the value is live while typing. The row's own click
// opens it, so the input stops the click from reaching the row again.
function EditCell({ value, onChange, onDone, aria, decimal = false }) {
  return (
    <input className="lp-cellin" autoFocus type="number" min="0" step={decimal ? '0.01' : '1'}
      inputMode={decimal ? 'decimal' : 'numeric'} aria-label={aria} value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)} onBlur={onDone}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }} />
  );
}
