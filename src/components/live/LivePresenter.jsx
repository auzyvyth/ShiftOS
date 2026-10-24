import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Contact, Expand, Info, Lock, Maximize2, Pencil, Shrink, SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../supabaseClient';
import {
  monthlyPayment, loanTotals, DEFAULT_EIR, DEFAULT_LOAN_RATIO, MAX_TENURE_YEARS, HIGH_VALUE_THRESHOLD,
} from '../../utils/financing';
import {
  salaryGuide, eirForTenure, fmtRate, liveReport, SALARY_SHARE, maxMonthlyFromPay, budgetMatches, budgetAll,
  netPrice, carLabel, isLocalNew, LOCAL_NEW_EIR, rebatesForMonth, myMonth, monthEnd, clampRateInput, RATE_MAX, tenuresFor, maxTenureYears, depositToFit, rateWarning, eirCap, MAX_CAR_AGE_AT_END,
  tightCapFromPay, shortVariantNames, dsrOf, DSR_TIGHT,
} from '../../utils/liveMaths';
import {
  LIVE_COPY, initialLiveLang, saveLiveLang, initialLiveCta, saveLiveCta, ctaLine, CTA_MAX,
  initialLiveOffer, saveLiveOffer, OFFER_MAX, initialLiveInsFigures, saveLiveInsFigures, initialLiveBio, saveLiveBio, initialLiveRebates, saveLiveRebates,
  initialLiveRate, saveLiveRate, LIVE_RATE_LOCAL_KEY,
} from './liveCopy';
import { NCD_TIERS, motorPremium, insuranceRegion, ncdLabel } from '../../utils/motorInsurance';
import { ACCENT_PRESETS, accentTheme, initialLiveAccent, saveLiveAccent } from '../../utils/liveAccent';
import { useNewCarInfo, useNewCarInfos, useNewCarVariant, pickNewCarVariant } from '../newcar/NewCarListingInfo';
import { useModalHistory } from '../../hooks/useModalHistory';
import { setLiveOpen } from '../../lib/onlinePresence';
import { cdnImg, imgFallback } from '../../utils/img';
import { SITE_URL } from '../../config/site';

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
// The Cars screen (redesign, owner 2026-10-22): one big number, the picked
// monthly, at the top beside the photo, out of TikTok's comment area (it
// covers the bottom-left of the stream). Under it the deposit chips, then the
// working (price - rebate - deposit = loan at rate) and the rest. One formula
// (financing.js). The default (10% down, 7 years) is the same estimate the
// mini page card shows, so the two never disagree.
//
// Controls and answers are kept apart (owner, 2026-10-22). What a VIEWER asks
// about is a tap on stage: deposit chips (the first chip takes a typed amount,
// in place), tenure tiles, variant, NCD. What the SELLER sets once is in
// Adjust: rate, rebates (one list for every car), insurance, offer. The
// working is read-only. It used to turn into input boxes when tapped
// (2026-10-17), so nobody could tell a setting from a result.
//
// One accent colour (the seller's pick) on exactly what is selected and the
// big monthly; everything else is ink on white. The tinted rows and the
// gradient (2026-10-13) read as six colours fighting on one screen.
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

// Photos go through the resizer (img.js): the raw uploads are 2-5 MB, and a
// tap to the next photo kept the old one on screen until the new file landed,
// so three quick taps showed nothing new until the last arrived. 960px is
// sharp on the zoomed desktop stage; the phone box is smaller.
const PHOTO_W = 960;
const photoUrl = (u) => cdnImg(u, PHOTO_W, 75);
// The preloaded Image objects are KEPT (not just fired and forgotten): a
// live image is what lets the browser reuse the download for the <img> with
// the same URL, whatever cache headers the resizer sends. Capped so a long
// live does not hold every photo of every car.
const preloaded = new Map();
const PRELOAD_MAX = 60;
const preload = (u) => {
  if (!u || preloaded.has(u) || typeof Image === 'undefined') return;
  const im = new Image();
  im.decoding = 'async';
  im.src = photoUrl(u);
  preloaded.set(u, im);
  if (preloaded.size > PRELOAD_MAX) preloaded.delete(preloaded.keys().next().value);
};

const Money = ({ n }) => <><span className="lp-rm">RM</span>{fmt(n)}</>;
const TENURES = [5, 7, MAX_TENURE_YEARS];
const DEFAULT_DOWN = Math.round((1 - DEFAULT_LOAN_RATIO) * 100); // 10
const DOWN_ROWS = [DEFAULT_DOWN, 20, 30];
// Budget deposit chips after the typed one: none, RM 10k, RM 20k.
const BUDGET_DOWNS = [0, 10000, 20000];
const DEFAULT_TENURE = 7;
const HEARTBEAT_MS = 4 * 60 * 1000; // live_until window is 10 min server-side
const REPORT_MIN_MS = 60 * 1000;     // a quick peek at the presenter is not a live

// The key a typed insurance figure is saved under: the listing, plus the
// variant on a model card (each variant's premium differs with its price).
const insKey = (c, variantId) => (variantId ? `${c?.id}:${variantId}` : c?.id);

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
  // Full view of the car photo. It fills the STAGE, not the browser window, so
  // it is never wider than the calculator (owner, 2026-10-22): on a phone that
  // is the portrait stage, on desktop the zoomed 750px stage the camera films.
  const [photoFull, setPhotoFull] = useState(false);
  const [rateInfo, setRateInfo] = useState(false);
  const photoTouchX = useRef(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  // ONE close button, top right, always (owner, 2026-10-22). It closes what is
  // open first (full photo, then Adjust); only with nothing open does it offer
  // to end the live, and that asks first. A seller aiming for Adjust's own
  // close hit the live's X a row above it and ended the stream.
  const [confirmEnd, setConfirmEnd] = useState(false);
  const requestExit = () => {
    if (photoFull) setPhotoFull(false);
    else if (adjustOpen) setAdjustOpen(false);
    else if (budgetSetOpen) setBudgetSetOpen(false);
    else setConfirmEnd(true);
  };
  // Adjust closes on a tap anywhere outside it, or Escape (owner, 2026-10-21).
  // 'click', not 'pointerdown': the tapped control acts first, then the panel
  // closes, so the layout never shifts under a finger mid-tap. Anything that
  // OPENS the panel (the sliders button, the Rebate line) carries
  // data-adjust-open, or the click that opened it would close it again.
  const adjustRef = useRef(null);
  useEffect(() => {
    if (!adjustOpen) return undefined;
    // composedPath is fixed at dispatch, so a control that re-renders out of
    // the DOM during its own click still counts as inside.
    const onClick = (e) => {
      const path = e.composedPath();
      const opener = path.some((n) => n?.dataset?.adjustOpen !== undefined);
      if (!path.includes(adjustRef.current) && !opener) setAdjustOpen(false);
    };
    // Esc closes Adjust and stops there: React re-renders between listeners,
    // so the presenter's own Esc (on window) would otherwise see Adjust shut
    // and offer to end the live.
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setAdjustOpen(false); } };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [adjustOpen]);
  const [showContact, setShowContact] = useState(false); // off every time: see header
  // Two rates, each set once and remembered per device (liveCopy.js
  // initialLiveRate): new Proton/Perodua (isLocalNew, 4.8% EIR to start) and
  // every other car. Each car is worked on its own group's rate.
  const [rates, setRates] = useState(() => {
    const std = { eir: String(DEFAULT_EIR), basis: 'eir' };
    const local = { eir: String(LOCAL_NEW_EIR), basis: 'eir' };
    if (embedded) return { std, local };
    return { std: initialLiveRate(DEFAULT_EIR, RATE_MAX), local: initialLiveRate(LOCAL_NEW_EIR, RATE_MAX, LIVE_RATE_LOCAL_KEY) };
  });
  const setRate = (group, patch) => setRates((r) => ({ ...r, [group]: { ...r[group], ...patch } }));
  useEffect(() => {
    if (embedded) return;
    saveLiveRate(rates.std.eir, rates.std.basis);
    saveLiveRate(rates.local.eir, rates.local.basis, LIVE_RATE_LOCAL_KEY);
  }, [rates, embedded]);
  // The rate rows Adjust shows: only the groups this live actually has.
  const rateGroups = [
    listings.some(isLocalNew) && 'local',
    (!listings.length || listings.some((c) => !isLocalNew(c))) && 'std',
  ].filter(Boolean);
  const rateOf = (c) => {
    const r = rates[isLocalNew(c) ? 'local' : 'std'];
    return { rate: Math.max(0, Number(r.eir) || 0), basis: r.basis };
  };
  const [customDown, setCustomDown] = useState('');
  // Rebate per car, never saved to the listing (promos change monthly). Every
  // car's rebate is remembered on this device until the month ends, Malaysia
  // time (owner, 2026-10-22; it was model cards only), so the seller types
  // this month's numbers once in Adjust > Rebates, not every live.
  const [rebates, setRebates] = useState(() => (embedded ? {} : initialLiveRebates(rebatesForMonth)));
  const listingIds = listings.map((c) => c.id).join(',');
  useEffect(() => {
    // No cars yet = nothing to compare against; saving now would wipe the list.
    if (embedded || !listingIds) return;
    const ids = new Set(listingIds.split(','));
    const keep = Object.fromEntries(Object.entries(rebates).filter(([id, v]) => ids.has(id) && Number(v) > 0));
    saveLiveRebates(keep, myMonth());
  }, [rebates, listingIds, embedded]);
  const [pick, setPick] = useState({ row: DEFAULT_DOWN, years: DEFAULT_TENURE });
  // The first deposit chip is typed into, in place.
  const [depEdit, setDepEdit] = useState(false);
  const [adjustTab, setAdjustTab] = useState('fin'); // 'fin' | 'rebates' | 'look'
  // The Rebate line on the sheet is typed into in place (owner, 2026-10-22: a
  // seller found opening Adjust for one car's rebate slower than the old way).
  // Adjust > Rebates stays for setting every car before a live.
  const [rebateEdit, setRebateEdit] = useState(false);
  // Adjust > "Fit a monthly": a target monthly works out the deposit it needs.
  const [target, setTarget] = useState('');
  // Insurance in the loan (motorInsurance.js): on/off remembered per device;
  // the NCD is the viewer's, picked on the pills under the working; a typed
  // figure (the seller's insurer quote, or an EV) wins for that car. Typed on
  // the Insurance line in place, like the rebate, and remembered on this
  // device until changed (owner, 2026-10-24). A model card keeps one figure
  // per VARIANT (insKey): the premium follows the variant's price.
  const [ncd, setNcd] = useState(0);
  const [insTyped, setInsTyped] = useState(() => (embedded ? {} : initialLiveInsFigures()));
  const [insEdit, setInsEdit] = useState(false);
  useEffect(() => {
    // Same guard as rebates: no cars yet = nothing to compare against.
    if (embedded || !listingIds) return;
    const ids = new Set(listingIds.split(','));
    const keep = Object.fromEntries(Object.entries(insTyped)
      .filter(([k, v]) => ids.has(k.split(':')[0]) && Number(v) > 0));
    saveLiveInsFigures(keep);
  }, [insTyped, listingIds, embedded]);
  // Budget mode: what the viewer said in the chat.
  const [budgetKind, setBudgetKind] = useState('monthly'); // 'monthly' | 'pay'
  const [budgetAmount, setBudgetAmount] = useState('');
  // What the viewer already pays a month (take-home mode only): it comes off
  // the same 35%, and every car gets a DSR verdict (owner, 2026-10-24).
  const [budgetCommit, setBudgetCommit] = useState('');
  // Budget settings (deposit, years, rates) are a pop-up behind the Change
  // button on the summary line, on every screen size (owner, 2026-10-24: the
  // panel that stayed open on desktop pushed the cars below the fold).
  const [budgetSetOpen, setBudgetSetOpen] = useState(false);
  // Budget deposit: a preset (RM, 0 = none) or 'c', the typed first chip.
  const [budgetDep, setBudgetDep] = useState(0);
  const [budgetCustom, setBudgetCustom] = useState('');
  const [budgetDepEdit, setBudgetDepEdit] = useState(false);
  const [budgetYears, setBudgetYears] = useState(DEFAULT_TENURE);
  // Variant picked on a model card's Budget row, by #N. Only a variant that
  // fits can be picked; one that stops fitting falls back to the row's own.
  const [budgetPick, setBudgetPick] = useState({});
  // Every car is on one screen, never a scroll (owner, 2026-10-24): a column
  // that holds more cars than fit shows them a page at a time, one tap per page.
  // Pages belong to one budget: `key` is the inputs they were turned under, and
  // a new number or setting starts every column on its first page again.
  const [budgetPage, setBudgetPage] = useState({ key: '', fit: 0, side: 0 });
  const pickBudgetVariant = (n, variantId) => setBudgetPick((p) => ({ ...p, [n]: variantId }));
  const [report, setReport] = useState(null); // null = presenting; {loading} | result
  // Back while presenting asks first (a stray swipe must not end a live),
  // then ends it the same way the X does: the report shows, and Back again
  // closes. finish is declared below; the callback only runs on a gesture.
  useModalHistory(!embedded && !report, () => finish(), { isDirty: () => true });
  useModalHistory(!embedded && !!report, onClose);
  // Back closes the photo first, then (asking) the live.
  useModalHistory(!embedded && photoFull, () => setPhotoFull(false));
  useModalHistory(!embedded && confirmEnd, () => setConfirmEnd(false));
  // Back closes the Settings pop-up, never the live.
  useModalHistory(!embedded && adjustOpen, () => setAdjustOpen(false));
  useModalHistory(!embedded && budgetSetOpen, () => setBudgetSetOpen(false));
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
  // "Link in bio" under the comment line, on unless switched off (liveCopy.js).
  const [bioOn, setBioOn] = useState(() => (embedded ? true : initialLiveBio()));
  const changeBio = (on) => { setBioOn(on); if (!embedded) saveLiveBio(on); };
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
  // Full screen (desktop): hides the browser's tabs and address bar so the
  // stage the camera films gets that height too. The zoom follows on resize.
  const canFull = !embedded && typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    if (!canFull) return undefined;
    const on = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, [canFull]);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
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
  // on a phone, 65% on desktop (any smaller and the camera cannot read it),
  // then lets the page scroll.
  // Budget fits the same way: its cars page, they never scroll (2026-10-24).
  // Style is set directly so the measurement never costs a re-render.
  const fit = useRef(() => {});
  fit.current = () => {
    // Desktop goes to 65%: the stage is magnified to the screen and its figures
    // are drawn large, so 65% still reads on camera; the owner wants it never
    // to scroll (2026-10-24).
    const MIN = deskZoom ? 0.65 : 0.8;
    const el = fitRef.current;
    const body = el?.parentElement;
    if (!el || !body) return;
    el.style.zoom = '1';
    if (mode === 'docs') return;
    const pad = parseFloat(getComputedStyle(body).paddingTop) * 2 || 0;
    const avail = body.clientHeight - pad;
    const need = el.offsetHeight;
    if (need > avail && avail > 0) {
      // Shrinking widens the columns, which makes aspect-ratio boxes (the
      // photo) taller, so one measurement undershoots: step down until
      // nothing spills, never under the floor.
      let z = Math.max(MIN, avail / need);
      el.style.zoom = String(z);
      while (z > MIN && body.scrollHeight > body.clientHeight) {
        z = Math.max(MIN, z - 0.01);
        el.style.zoom = String(z);
      }
      // Wider columns also unwrap long names, so the first guess can land
      // smaller than needed: grow back while nothing spills.
      while (z < 1 && body.scrollHeight <= body.clientHeight) {
        z = Math.min(1, z + 0.01);
        el.style.zoom = String(z);
      }
      if (body.scrollHeight > body.clientHeight && z > MIN) {
        z = Math.max(MIN, z - 0.01);
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
  // One rebate box per listing: a model card's covers every variant.
  const rk = car?.id;
  const phoneText = fmtPhone(sellerPhone);
  const contact = !embedded && (sellerName || phoneText)
    ? { name: (sellerName || '').trim(), phone: phoneText } : null;
  // One row of chips on a phone: the words every variant shares are dropped.
  const variantChips = shortVariantNames(variants.map((v) => v.variant));
  const images = Array.isArray(car?.images) ? car.images.filter(Boolean) : [];
  const nImages = images.length;
  const stepPhoto = useCallback((d) => {
    if (nImages > 1) setImgIdx((i) => (i + d + nImages) % nImages);
  }, [nImages]);
  // Fetch this car's photos ahead of the taps, plus the first photo of the
  // cars either side, so swiping shows a photo that is already downloaded.
  useEffect(() => {
    if (!listings.length) return;
    const pics = (c) => (Array.isArray(c?.images) ? c.images.filter(Boolean) : []);
    pics(listings[idx]).slice(0, 12).forEach(preload);
    preload(pics(listings[(idx + 1) % listings.length])[0]);
    preload(pics(listings[(idx - 1 + listings.length) % listings.length])[0]);
  }, [idx, listings]);
  // price = asking, net = what the loan is worked from (asking - rebate).
  const { price, rebate, net } = netPrice(shown, rebates);
  // This car's rate group, its rate and how it was quoted.
  const rateGroup = isLocalNew(shown) ? 'local' : 'std';
  const { rate, basis } = rateOf(shown);
  // Insurance for a car: typed figure first, else the tariff estimate off the
  // price before rebate (the car's value) and its engine cc (a model card's
  // cc is on the picked variant). null = no cc (EV / not filled): tap to type.
  const insFor = (c, value, cc, variantId) => {
    const typed = insTyped[insKey(c, variantId)];
    if (typed !== undefined && typed !== '') return Math.max(0, Number(typed) || 0);
    const est = motorPremium({ sumInsured: value, cc, ncd, region: insuranceRegion(c?.state) });
    return est ? est.total : null;
  };
  const insK = insKey(car, variant?.model_id);
  const insIsTyped = (insTyped[insK] ?? '') !== '';
  const ins = insFor(car, price, variant?.specs?.engine_cc ?? car?.engine_cc, variant?.model_id);
  const insAmt = ins || 0;

  const go = useCallback((d) => {
    setIdx((i) => (i + d + listings.length) % listings.length);
    setImgIdx(0);
    setPhotoFull(false);
    setDepEdit(false);
    setRebateEdit(false);
    setInsEdit(false);
  }, [listings.length]);

  // Exit: a live of a minute or more ends on its report; a peek just closes.
  const finish = useCallback(async () => {
    const endedAt = new Date();
    if (endedAt - startedAt.current < REPORT_MIN_MS || !slug) { onClose(); return; }
    setReport({ loading: true });
    const since = startedAt.current.toISOString();
    const [ev, ld] = await Promise.all([
      supabase.from('analytics_events')
        .select('event_type,session_id,car_id,metadata')
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
      if (photoFull) {
        if (e.key === 'Escape') setPhotoFull(false);
        else if (e.key === 'ArrowRight') stepPhoto(1);
        else if (e.key === 'ArrowLeft') stepPhoto(-1);
        return;
      }
      if (confirmEnd) { if (e.key === 'Escape') setConfirmEnd(false); return; }
      if (e.key === 'Escape') { if (adjustOpen) setAdjustOpen(false); else if (budgetSetOpen) setBudgetSetOpen(false); else setConfirmEnd(true); }
      else if (mode !== 'cars') return;
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, report, mode, embedded, photoFull, stepPhoto, confirmEnd, adjustOpen, budgetSetOpen]);

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
  // A deposit at or above the price stays on screen as typed and the loan
  // reads zero; it used to drop the row and quietly fall back to 10%, so the
  // box and the working showed two different deposits.
  // Chips: the typed amount first, then None, then the percentages.
  const custom = customDown === '' ? null : Math.max(0, Number(customDown) || 0);
  const rows = [
    ...(custom !== null ? [{ key: 'c', down: custom, custom: true }] : []),
    { key: 0, down: 0 },
    ...DOWN_ROWS.map((pct) => ({ key: pct, down: net * pct / 100 })),
  ];
  const financeable = net > 0;
  const highValue = price > HIGH_VALUE_THRESHOLD;
  const rateFor = (y) => eirForTenure(rate, basis, y);
  const monthlyFor = (down, y) => monthlyPayment(net + insAmt - down, rateFor(y), y * 12);
  const picked = rows.find((r) => r.key === pick.row) || rows.find((r) => r.key === DEFAULT_DOWN);
  // Typing in the first chip picks it as soon as there is a number. Leaving it
  // empty, or typing 0, means no deposit: that is the None chip.
  const typeDeposit = (v) => {
    const d = String(v).replace(/\D/g, '').slice(0, 7);
    setCustomDown(d);
    if (d !== '') setPick((p) => ({ ...p, row: 'c' }));
  };
  const closeDeposit = () => {
    setDepEdit(false);
    if (!(Number(customDown) > 0)) {
      setCustomDown('');
      setPick((p) => (p.row === 'c' ? { ...p, row: 0 } : p));
    }
  };
  const loanAmt = Math.max(0, net + insAmt - picked.down);
  const noLoan = financeable && loanAmt <= 0;
  // Only the tenures a bank gives on a car this age (liveMaths.tenuresFor);
  // [] = too old for a car loan. Longest first, like the poster.
  const tenures = tenuresFor(TENURES, shown);
  const tenuresDesc = [...tenures].reverse();
  const tenureCapped = tenures.length > 0 && maxTenureYears(shown) < MAX_TENURE_YEARS;
  const pickYears = tenures.includes(pick.years) ? pick.years
    : tenures.includes(DEFAULT_TENURE) ? DEFAULT_TENURE : tenures[tenures.length - 1];
  const canLoan = financeable && !noLoan && tenures.length > 0;
  const answer = canLoan ? monthlyFor(picked.down, pickYears) : 0;
  const salary = salaryGuide(answer);
  const totals = canLoan ? loanTotals(loanAmt, rateFor(pickYears), pickYears * 12) : null;
  const rateWarn = canLoan ? rateWarning(rate, basis, pickYears) : null;
  const applyTarget = (v) => {
    setTarget(v);
    const dep = depositToFit({ price: net, extra: insAmt, cap: Number(v), eir: rateFor(pickYears), years: pickYears });
    if (dep === null) return;
    setCustomDown(String(dep));
    setPick((p) => ({ ...p, row: 'c' }));
  };

  // Budget mode. "pay" runs the 35% rule backwards; the line under the input
  // always prints that rule, the same way the tenure pick does.
  const amount = Math.max(0, Number(budgetAmount) || 0);
  const budgetOn = amount > 0;
  const payMode = budgetKind === 'pay' && budgetOn;
  const commit = payMode ? Math.max(0, Number(budgetCommit) || 0) : 0;
  // Pay mode: 35% of pay minus commitments, which can be 0 (no comfortable room
  // left; the cars still get a tight / heavy verdict).
  const maxMonthly = budgetKind === 'pay' ? maxMonthlyFromPay(amount, commit) : (amount || null);
  const digits = (v, n) => String(v).replace(/\D/g, '').slice(0, n);
  const bDown = budgetDep === 'c' ? Math.max(0, Number(budgetCustom) || 0) : budgetDep;
  const typeBudgetDeposit = (v) => {
    const d = String(v).replace(/\D/g, '').slice(0, 7);
    setBudgetCustom(d);
    if (d !== '') setBudgetDep('c');
  };
  const closeBudgetDeposit = () => {
    setBudgetDepEdit(false);
    if (!(Number(budgetCustom) > 0)) {
      setBudgetCustom('');
      setBudgetDep((k) => (k === 'c' ? 0 : k));
    }
  };
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
  const budgetOpts = {
    maxMonthly, deposit: bDown, years: budgetYears, rate, basis, rebates, rateOf,
    extraFor: (c) => insFor(c, Number(c.selling_price) || 0, c.engine_cc, c._variantId) || 0,
    // The same tenure rows the Cars screen offers this car, so the row and the
    // car it opens show the same monthly.
    yearsFor: (c) => { const ok = tenuresFor(TENURES, c); return ok.filter((y) => y <= budgetYears).pop() ?? ok[0] ?? 0; },
    // "Fits at 9 years": the longer tenures this car can still take.
    tenureOptions: TENURES,
    maxYearsFor: (c) => Math.max(0, ...tenuresFor(TENURES, c)),
    // Pay mode: "just above" / tight ends at a 60% DSR, not 25% over budget.
    nearCap: payMode ? tightCapFromPay(amount, commit) : undefined,
  };
  // Every car once with a verdict (liveMaths budgetAll), split into the three
  // groups the screen shows side by side: fits (dearest first), tight / just
  // above, and over (a short list). budgetMatches only lends a model card's
  // variants (`options`), so its row can still switch variant.
  const matches = budgetMatches(budgetCars, budgetOpts);
  const optionsByN = new Map([...matches.fits, ...matches.above].filter((m) => m.options).map((m) => [m.n, m.options]));
  const allRows = budgetOn ? budgetAll(budgetCars, budgetOpts) : [];
  const groups = { fit: [], near: [], over: [] };
  allRows.forEach((m) => { groups[m.status].push(optionsByN.has(m.n) ? { ...m, options: optionsByN.get(m.n) } : m); });
  // The right column pages tight and over-budget rows as one list.
  groups.side = [...groups.near, ...groups.over];
  // Rows per page: what fits the stage with no scroll (desktop stage vs phone).
  const pageSize = deskZoom ? { fit: 4, side: 3 } : { fit: 3, side: 2 };
  const pageKey = [budgetAmount, budgetCommit, budgetKind, bDown, budgetYears].join('|');
  const curPage = (st) => (budgetPage.key === pageKey ? budgetPage[st] : 0);
  const pageOf = (st) => {
    const pages = Math.max(1, Math.ceil(groups[st].length / pageSize[st]));
    const p = Math.min(curPage(st), pages - 1);
    return { p, pages, rows: groups[st].slice(p * pageSize[st], (p + 1) * pageSize[st]) };
  };
  const nextPage = (st, pages) => setBudgetPage({
    key: pageKey, fit: curPage('fit'), side: curPage('side'), [st]: (Math.min(curPage(st), pages - 1) + 1) % pages,
  });
  // Take-home pay mode: each row's commitments as a share of pay, coloured by
  // its own band (it follows the variant a model card row is switched to).
  const dsrFor = (monthly) => (payMode ? dsrOf(monthly, commit, amount) : null);
  const budgetKindSwitch = (
    <div className="lp-chips lp-chips2 lp-ink lp-bkind" role="group" aria-label={t.budgetIs}>
      <button type="button" className="lp-chip" aria-pressed={budgetKind === 'monthly'} onClick={() => setBudgetKind('monthly')}>{t.monthlyBudget}</button>
      <button type="button" className="lp-chip" aria-pressed={budgetKind === 'pay'} onClick={() => setBudgetKind('pay')}>{t.takeHome}</button>
    </div>
  );
  // The rate settings, one row per rate group on this live. ONE store (rates,
  // saved per device) shown in two places: Adjust > Financing and the Budget
  // tab's Change panel (owner, 2026-10-24), so the two can never disagree.
  const rateRow = (g, idPrefix) => {
    const r = rates[g];
    return (
      <div className="lp-wide lp-rate" key={g}>
        <label htmlFor={`${idPrefix}-${g}`}>{rateGroups.length > 1 ? (g === 'local' ? t.rateLocal : t.rateOther) : t.rateLabel}</label>
        <div className="lp-rate-row">
          <span className="lp-rate-in">
            <input id={`${idPrefix}-${g}`} type="number" inputMode="decimal" step="0.01" min="0" max={RATE_MAX}
              value={r.eir} onChange={(e) => setRate(g, { eir: clampRateInput(e.target.value) })} />
            <span>%</span>
          </span>
          <div className="lp-seg" role="group" aria-label={t.rateQuoted}>
            <button type="button" aria-pressed={r.basis === 'eir'} onClick={() => setRate(g, { basis: 'eir' })}>EIR</button>
            <button type="button" aria-pressed={r.basis === 'flat'} onClick={() => setRate(g, { basis: 'flat' })}>{t.flat}</button>
          </div>
        </div>
        {r.basis === 'flat' && (
          <small className="lp-hint">
            {t.flatHint(TENURES.map((y) => `${t.yrsShort(y)} ${fmtRate(eirForTenure(Math.max(0, Number(r.eir) || 0), 'flat', y))}%`).join(', '))}
          </small>
        )}
      </div>
    );
  };
  // Budget prices each car on its own group's rate, so its summary line names
  // every rate in play ("4.8% / 6.5% EIR"), not just the car on the Cars screen.
  const budgetRateText = rateGroups.map((g) => {
    const r = rates[g];
    return `${fmtRate(Math.max(0, Number(r.eir) || 0))}% ${r.basis === 'flat' ? t.flat : 'EIR'}`;
  }).join(' / ');
  // The viewer's number and commitments, shared by the phone and desktop layouts.
  const moneyIn = (
    <label className="lp-money">
      <span>RM</span>
      <input type="text" inputMode="numeric" value={budgetAmount} placeholder="0"
        aria-label={budgetKind === 'pay' ? t.takeHomeAria : t.monthlyBudget}
        onChange={(e) => setBudgetAmount(digits(e.target.value, 6))} />
    </label>
  );
  const commitIn = (
    <label className="lp-money lp-money-sm">
      <small>{t.commitShort}</small>
      <span className="lp-money-in"><span>RM</span>
        <input type="text" inputMode="numeric" value={budgetCommit} placeholder="0" aria-label={t.commitments}
          onChange={(e) => setBudgetCommit(digits(e.target.value, 6))} />
      </span>
    </label>
  );
  // The seller's settings are one line; Change opens them in a pop-up.
  const budgetSetLine = (
    <div className="lp-bsetline">
      <span>{bDown > 0 ? t.depositAmt(`RM ${fmt(bDown)}`) : t.noDeposit} · {t.yearsAt(budgetYears, budgetRateText)}</span>
      <button type="button" className="lp-bchange" onClick={() => setBudgetSetOpen(true)}>{t.changeSet}</button>
    </div>
  );
  const stLabel = (st) => (payMode ? t.dsrSt[st] : { fit: t.stFit, near: t.stNear, over: t.stOver }[st]);
  const openFromBudget = (m) => {
    if (m.car._variantId) pickNewCarVariant(m.car.id, m.car._variantId);
    setIdx(m.n - 1);
    setImgIdx(0);
    // A "just above" car opens with the extra deposit that makes it fit.
    const dep = bDown + (m.topUp || 0);
    setCustomDown(dep > 0 ? String(dep) : '');
    setPick({ row: dep > 0 ? 'c' : 0, years: m.years });
    setDepEdit(false);
    setMode('cars');
  };
  const anyHighValue = allRows.some((m) => m.status !== 'over' && m.price > HIGH_VALUE_THRESHOLD);
  // Adjust > Rebates: how many cars have one, and the day the saved list clears.
  const rebateCount = listings.filter((c) => Number(rebates[c.id]) > 0).length;
  const endLabel = monthEnd(myMonth()).toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  const screen = (
    <div className={`lp${embedded ? ' lp-embed' : ''}${deskZoom ? ' lp-desk' : ''}`} style={{ '--lp-a': theme.accent, '--lp-a2': theme.dark, '--lp-rgb': theme.rgb }}>
      {/* Phones and tablets: ONE portrait stage, 9:16 at most, sized in
          container units so it fits a 375px phone with no scroll.
          Desktop (mouse, 1024px+): the phone's height, TWICE its width
          (DESK_W x STAGE_H, about square), magnified with CSS zoom to the
          monitor's full height. Sellers film the monitor with a phone held
          upright: the 2026-10-04 full-screen wide sheet spilled out of that
          frame, and the phone-shaped column (2026-10-18) was too small to read
          on camera. Owner, 2026-10-18: double the width, no wider. */}
      <style>{`
        .lp { position: fixed; inset: 0; z-index: 1000; background: #DEDCD8; color: #111827; font-family: var(--xd-font-body); -webkit-font-smoothing: antialiased; }
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
        /* Inputs: never under 16px (iOS zooms the page into a smaller field and
           never zooms back, mid-live), and no number-box arrows on camera. */
        .lp input { font-size: max(16px, 1em); }
        .lp input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
        .lp input::-webkit-inner-spin-button, .lp input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        /* Embedded demo: fills its parent box instead of the viewport. */
        .lp.lp-embed { position: absolute; z-index: auto; }
        .lp-embed .lp-stage { width: 100%; }
        /* One neutral stage, ink on white cards (owner, 2026-10-22). The seller's
           colour (--lp-a) marks exactly three things: the #N badge, whatever is
           selected, and the big monthly. The red corner glow (2026-10-05) and
           the tinted rows (2026-10-13) put six colours on one screen. */
        .lp-stage { position: relative; height: 100%; width: min(100%, calc(100dvh * 9 / 16)); margin: 0 auto; background: #EEEDEA; display: flex; flex-direction: column; container-type: size; }
        .lp-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; background: #EEEDEA; border-bottom: 1px solid rgba(33,31,30,.08); flex-shrink: 0; }
        .lp-count { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; }
        .lp-iconbtn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #E5E7EB; background: #fff; color: #111827; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .lp-lang { font-size: 13px; font-weight: 800; letter-spacing: .04em; font-family: inherit; }
        .lp-iconbtn[aria-pressed="true"] { background: #0f1115; border-color: transparent; color: #fff; }
        .lp-body { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .lp-body > * { flex-shrink: 0; }
        .lp-card { background: #fff; border-radius: 16px; border: 1px solid rgba(33,31,30,.06); box-shadow: 0 1px 2px rgba(17,24,39,.06); }
        .lp-fit { display: flex; flex-direction: column; gap: 10px; }

        /* Head: #N + title, and the comment line. Phone: the comment line is a
           bar under the title. Desktop: a pill on the title's right. Either way
           it is at the TOP: the bottom of the stream is under the comments. */
        .lp-sheet { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
        .lp-desk .lp-sheet { padding: 10px 16px; gap: 6px; }
        .lp:not(.lp-desk) .lp-sheet { gap: 6px; padding: 9px 11px; }
        .lp:not(.lp-desk) .lp-body { padding: 10px; }
        .lp:not(.lp-desk) .lp-grid { row-gap: 6px; }
        .lp:not(.lp-desk) .lp-ans { gap: 4px; }
        .lp-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; min-width: 0; }
        .lp-head > .lp-title, .lp-head > .lp-name { flex: 1 1 55%; min-width: 0; }
        .lp-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .lp-num { font-family: 'Bebas Neue', sans-serif; font-size: clamp(24px, 7cqw, 40px); line-height: 1; letter-spacing: .02em; color: #fff; background: var(--lp-a); border-radius: 8px; padding: 6px 9px 3px; flex-shrink: 0; }
        .lp-tt { min-width: 0; }
        .lp-name { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(22px, 6.8cqw, 38px); line-height: .95; letter-spacing: .015em; margin: 0; color: #0f1115; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        /* Year + make + model + variant can be long ("2022 Lexus IS 300 2.0L(T) F-Sport"): two lines, never cut mid-name. */
        .lp-name-car { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .lp-var { color: #6b7280; }
        .lp-spec { font-size: clamp(11px, 3cqw, 14px); color: #6b7280; margin: 3px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-cta { flex: 1 1 100%; margin: 0; padding: 7px 12px; border-radius: 999px; background: #0f1115; color: #fff; text-align: center; font-size: clamp(11px, 3cqw, 14px); font-weight: 800; letter-spacing: .06em; line-height: 1.25; text-transform: uppercase; overflow-wrap: anywhere; }
        .lp-desk .lp-head > .lp-cta { flex: 0 1 auto; max-width: 44%; padding: 9px 16px; font-size: 13px; }
        /* Second line of the same pill: quieter, never the accent (one accent rule). */
        .lp-bio { display: block; margin-top: 2px; font-size: .78em; font-weight: 700; letter-spacing: .04em; opacity: .72; }
        .lp-desk .lp-name { font-size: 34px; }
        .lp-desk .lp-num { font-size: 32px; }
        .lp-desk .lp-spec { font-size: 14px; }
        /* A model card's variant chips name the variant, so the title drops it. */
        .lp-has-vars .lp-var { display: none; }

        /* The Cars grid. Phone: answer, chips, photo | working, the rest.
           Desktop: photo | answer, chips across, working | the rest. */
        .lp-grid { display: grid; grid-template-columns: minmax(0, 36fr) minmax(0, 64fr); grid-template-areas: "ans ans" "dep dep" "photo work" "ncd ncd" "rest rest"; gap: 8px 10px; align-items: start; }
        .lp-desk .lp-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "photo ans" "dep dep" "work rest"; column-gap: 18px; row-gap: 12px; }
        /* The frame is a fixed size; the photo fits INSIDE it, never cropped
           (owner, 2026-10-21). White bars melt into studio shots. */
        .lp-photo { grid-area: photo; position: relative; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: inset 0 0 0 1px rgba(33,31,30,.10); }
        /* Desktop: the photo fills its column's height, so no empty band sits
           under it beside a taller answer (a model card's variants). */
        .lp-desk .lp-photo { aspect-ratio: auto; align-self: stretch; min-height: 200px; }
        .lp-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
        .lp-expand { position: absolute; top: 6px; right: 6px; z-index: 2; width: 32px; height: 32px; border: none; border-radius: 8px; background: rgba(15,17,21,.55); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .lp-dots { position: absolute; bottom: 6px; left: 0; right: 0; display: flex; justify-content: center; gap: 4px; pointer-events: none; }
        .lp-dots span { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 2px rgba(0,0,0,.4); }
        .lp-dots span[data-on="1"] { background: #fff; }

        /* The answer: the one big number on the sheet, then the three tenures. */
        .lp-ans { grid-area: ans; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .lp-desk .lp-ans { align-self: stretch; justify-content: space-between; gap: 8px; }
        .lp-ans-lbl { margin: 0; font-size: clamp(12px, 3.5cqw, 15px); font-weight: 600; color: #4b5563; font-variant-numeric: tabular-nums; }
        .lp-ans-msg { margin: 0; font-size: clamp(14px, 4cqw, 18px); font-weight: 700; color: #0f1115; line-height: 1.35; }
        .lp-big { margin: 0; display: flex; align-items: baseline; color: var(--lp-a); font-size: clamp(40px, 14cqw, 60px); font-weight: 800; line-height: .95; letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .lp-big .lp-rm { font-size: .32em; opacity: 1; margin-right: .3em; }
        .lp-big small { margin-left: .35em; font-size: .24em; font-weight: 600; letter-spacing: 0; color: #6b7280; }
        .lp-desk .lp-big { font-size: 72px; }
        /* Camera-safe desktop (LIVE-CAM, owner 2026-10-24). Sellers either film
           the monitor with a phone held upright (the sides get cut) or put the
           screen under their camera in a split (TikTok's comments cover the
           bottom half). Only the top-centre is safe in both, so everything a
           viewer reads sits there: title, comment line, monthly, tenures,
           deposit. Photo and working go to the bottom, where losing them costs
           nothing. */
        /* Cars sheet only: a column head on Budget or Docs turns every flex
           basis into a HEIGHT (the 340px-tall kind switch, 2026-10-24). */
        .lp-desk .lp-sheet .lp-head { flex-direction: column; flex-wrap: nowrap; align-items: center; text-align: center; gap: 8px; }
        .lp-desk .lp-sheet .lp-head > .lp-title { flex: none; max-width: 64%; justify-content: center; }
        /* The spec line rides beside the name (wraps under it when long): one
           line less above the monthly. */
        .lp-desk .lp-sheet .lp-tt { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; column-gap: 10px; }
        .lp-desk .lp-sheet .lp-spec { margin: 0; }
        .lp-desk .lp-sheet .lp-head > .lp-cta { flex: none; max-width: 64%; }
        .lp-desk .lp-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "ans ans" "dep dep" "photo work" "photo ncd" "rest rest"; row-gap: 6px; }
        .lp-desk .lp-ans { justify-self: center; width: 64%; align-items: center; justify-content: flex-start; gap: 6px; }
        .lp-desk .lp-ans > .lp-tens { align-self: stretch; }
        .lp-desk .lp-ans > .lp-vars { justify-content: center; }
        .lp-desk .lp-deprow { justify-self: center; width: 64%; }
        .lp-desk .lp-photo { min-height: 120px; }
        /* Under photo | working: totals beside the salary guide, notes across. */
        .lp-desk .lp-rest { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 18px; align-items: center; }
        .lp-desk .lp-rest > * { grid-column: 1 / -1; }
        .lp-desk .lp-rest > .lp-totals { grid-column: 1; }
        .lp-desk .lp-rest > .lp-salary { grid-column: 2; margin: 0; }
        .lp-desk .lp-ans-lbl { font-size: 15px; }
        .lp-tens { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
        .lp-ten { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; padding: 5px 8px; border-radius: 10px; border: 1.5px solid #F4F3F1; background: #F4F3F1; color: #111827; font: inherit; text-align: left; cursor: pointer; font-variant-numeric: tabular-nums; }
        .lp-ten span { font-size: clamp(10px, 2.8cqw, 12px); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
        .lp-ten b { font-size: clamp(14px, 4.2cqw, 18px); font-weight: 800; white-space: nowrap; }
        .lp-ten[aria-pressed="true"] { background: rgba(var(--lp-rgb),.10); border-color: var(--lp-a); color: var(--lp-a2); }
        .lp-desk .lp-ten { padding: 5px 10px; }
        .lp-desk .lp-ten span { font-size: 13px; }
        .lp-desk .lp-ten b { font-size: 26px; }

        /* Chips: one row, equal heights. The first deposit chip is wider: it
           holds a typed amount. Selected = the accent, filled. */
        .lp-deprow { grid-area: dep; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .lp-desk .lp-deprow { flex-direction: row; align-items: center; gap: 10px; }
        .lp-desk .lp-deprow > .lp-lbl { width: 76px; flex-shrink: 0; }
        .lp-desk .lp-deprow > .lp-chips { flex: 1; }
        .lp-lbl { font-size: clamp(10px, 2.8cqw, 12px); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; }
        .lp-desk .lp-lbl { font-size: 12px; }
        .lp-chips { display: grid; gap: 5px; min-width: 0; }
        .lp-chips2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .lp-chips3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .lp-chips4 { grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr)); }
        .lp-chips5 { grid-template-columns: minmax(0, 1.6fr) repeat(4, minmax(0, 1fr)); }
        /* Variants: ONE row (a second row pushed the model card off a phone),
           scrolling sideways if they still do not fit. */
        .lp-chips.lp-vars { display: flex; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
        .lp-chips.lp-vars::-webkit-scrollbar { display: none; }
        .lp-vars .lp-chip { flex: 1 0 auto; width: auto; padding: 4px 12px; white-space: nowrap; }
        .lp-desk .lp-chips.lp-vars { flex-wrap: wrap; overflow: visible; gap: 5px; }
        /* Desktop variant chips size to their name: stretched, six of them took
           two tall rows and pushed the sheet past the stage. */
        .lp-desk .lp-vars .lp-chip { flex: 0 0 auto; min-height: 30px; padding: 2px 12px; font-size: 14px; }
        .lp-chip { display: flex; align-items: center; justify-content: center; gap: 5px; width: 100%; min-width: 0; min-height: 34px; padding: 4px 6px; border-radius: 10px; border: 1.5px solid #E5E7EB; background: #fff; color: #111827; font: inherit; font-size: clamp(12px, 3.4cqw, 15px); font-weight: 700; line-height: 1.15; text-align: center; cursor: pointer; font-variant-numeric: tabular-nums; }
        .lp-chip[aria-pressed="true"] { background: var(--lp-a); border-color: var(--lp-a); color: #fff; }
        .lp-chip svg { flex-shrink: 0; opacity: .7; }
        .lp-chip-edit { justify-content: flex-start; padding: 0 8px; border-color: var(--lp-a); cursor: text; }
        .lp-chip-edit span { color: #6b7280; }
        .lp-chip-edit input { flex: 1; width: 100%; min-width: 0; padding: 0; border: none; outline: none; background: transparent; font: inherit; font-size: max(16px, 1em); color: #0f1115; }
        /* The seller's settings (Budget deposit / years / view, Docs): picked =
           ink. The accent stays on the viewer's number and the answer. */
        .lp-ink .lp-chip[aria-pressed="true"] { background: #0f1115; border-color: #0f1115; color: #fff; }
        .lp-desk .lp-chip { min-height: 36px; font-size: 15px; }

        /* The working: read-only lines, a receipt's rule above the loan. */
        .lp-brkwrap { grid-area: work; position: relative; min-width: 0; }
        .lp-brk { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
        .lp-brk td { padding: 3px 0; font-size: clamp(12px, 3.5cqw, 16px); color: #4b5563; border-bottom: 1px solid #EFEEEC; }
        .lp-brk td:last-child { text-align: right; font-weight: 700; color: #0f1115; white-space: nowrap; }
        .lp-brk tr.lp-r-reb td:last-child { color: #047857; }
        .lp-brk tr.lp-loan td { padding-top: 6px; border-top: 2px solid #0f1115; border-bottom: none; font-weight: 700; color: #0f1115; }
        .lp-brk tr.lp-loan td:last-child { font-size: clamp(15px, 4.4cqw, 20px); font-weight: 800; }
        .lp-brk tr.lp-r-rate td { padding-top: 1px; border-bottom: none; font-size: clamp(11px, 3cqw, 14px); color: #6b7280; }
        .lp-brk tr.lp-r-rate td:last-child { color: #374151; font-weight: 600; }
        /* The seller reads these aloud mid-live ("rebat berapa?"): figures large,
           labels quiet (owner, 2026-10-24, after a rival's sheet read faster). */
        .lp-desk .lp-brk td { padding: 2px 0; font-size: 15px; }
        .lp-desk .lp-brk td:last-child { font-size: 21px; }
        .lp-desk .lp-brk tr.lp-loan td:last-child { font-size: 27px; }
        .lp-desk .lp-brk tr.lp-r-rate td { font-size: 14px; }
        .lp-desk .lp-brk tr.lp-r-rate td:last-child { font-size: 17px; }
        /* "RM" is a unit, not the number: smaller and lighter so the digits lead. */
        .lp-rm { font-size: .7em; font-weight: 700; opacity: .62; margin-right: .22em; letter-spacing: .02em; }
        .lp-info { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; margin-left: 4px; padding: 0; border: none; border-radius: 50%; background: rgba(15,17,21,.08); color: #4b5563; vertical-align: middle; cursor: pointer; }
        .lp-tip { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 4; margin: 0; padding: 10px 12px; border-radius: 10px; background: #0f1115; color: #fff; font-size: clamp(12px, 3.2cqw, 15px); font-weight: 500; line-height: 1.45; box-shadow: 0 10px 30px rgba(15,17,21,.3); }

        /* Everything else: smaller, quieter, and fine to sit under the comments. */
        .lp-rest { grid-area: rest; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .lp-desk .lp-rest { gap: 6px; }
        .lp-totals { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
        .lp-totals > div { display: flex; flex-direction: column; min-width: 0; padding: 6px 10px; border-radius: 8px; background: #F4F3F1; }
        .lp-totals span { font-size: clamp(10px, 2.7cqw, 12px); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #6b7280; }
        .lp-totals b { font-size: clamp(14px, 4.2cqw, 18px); font-weight: 800; color: #0f1115; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .lp-totals small { font-size: clamp(10px, 2.6cqw, 12px); color: #6b7280; }
        /* Phone: the two figures only; how they are made up is on desktop. */
        .lp:not(.lp-desk) .lp-totals small { display: none; }
        .lp-desk .lp-totals > div { padding: 4px 10px; }
        .lp-salary { font-size: clamp(12px, 3.1cqw, 14px); color: #4b5563; margin: 0; line-height: 1.4; }
        .lp-salary b { color: #0f1115; font-variant-numeric: tabular-nums; }
        .lp-note { font-size: clamp(11px, 2.8cqw, 13px); color: #6b7280; line-height: 1.4; margin: 0; }
        .lp-offer { margin: 0; padding: 7px 12px; border-radius: 8px; background: #F4F3F1; color: #0f1115; font-size: clamp(12px, 3.3cqw, 16px); font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
        .lp-offer b { margin-right: 8px; font-size: .8em; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #4b5563; }
        .lp-head > .lp-contact { flex: 1 1 100%; }
        .lp-contact { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 5px 12px; border: none; border-radius: 8px; background: var(--lp-a); font: inherit; color: #fff; text-align: left; min-width: 0; }
        .lp-c-who { display: flex; flex-direction: column; min-width: 0; }
        .lp-c-who small { font-family: 'Bebas Neue', sans-serif; font-size: clamp(14px, 3.8cqw, 18px); line-height: 1; letter-spacing: .04em; }
        .lp-c-who b { min-width: 0; font-size: clamp(10px, 2.6cqw, 12px); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-c-ph { flex-shrink: 0; font-family: 'Bebas Neue', sans-serif; font-size: clamp(18px, 5.2cqw, 24px); line-height: 1; letter-spacing: .03em; font-variant-numeric: tabular-nums; white-space: nowrap; }
        /* Desktop head is a column: "fill 100%" would mean its HEIGHT there. */
        .lp-desk .lp-sheet .lp-head > .lp-contact { flex: none; width: auto; max-width: 64%; padding: 4px 14px; gap: 16px; }
        /* Desktop: one slim line, "CONTACT ME  NAME ... PHONE" (owner, 2026-10-24:
           the two-line banner pushed the sheet past the stage). */
        .lp-desk .lp-c-who { flex-direction: row; align-items: baseline; gap: 8px; }
        .lp-desk .lp-c-who small { font-size: 16px; }
        .lp-desk .lp-c-who b { font-size: 11px; }
        .lp-desk .lp-c-ph { font-size: 20px; }
        .lp-warn { margin: 0; padding: 6px 10px; border-radius: 8px; background: rgba(245,158,11,.14); color: #92400e; font-size: clamp(11px, 3cqw, 14px); font-weight: 700; line-height: 1.35; }
        .lp-warn button { margin-left: 8px; padding: 2px 8px; border: none; border-radius: 6px; background: #92400e; color: #fff; font: inherit; font-size: .9em; cursor: pointer; }
        /* NCD pills: the viewer's pick, six on one phone row. */
        .lp-seg.lp-ncd { grid-area: ncd; align-items: center; padding: 3px; }
        .lp-seg.lp-ncd > span { padding: 0 6px 0 4px; font-size: clamp(10px, 2.8cqw, 12px); font-weight: 800; letter-spacing: .08em; color: #4b5563; }
        .lp-seg.lp-ncd button { flex: 1 1 0; min-width: 0; padding: 0 2px; height: 26px; font-size: clamp(11px, 3cqw, 13px); }
        .lp-seg.lp-ncd button[aria-pressed="true"] { background: var(--lp-a); color: #fff; }
        .lp-desk .lp-salary { font-size: 14px; line-height: 1.35; }
        .lp-desk .lp-note { font-size: 12px; }

        /* Full photo: fills the stage, never the window (owner, 2026-10-22). */
        .lp-full { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; background: #0f1115; color: #fff; }
        .lp-full-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; flex-shrink: 0; }
        .lp-full-top span { min-width: 0; font-family: 'Bebas Neue', sans-serif; font-size: clamp(20px, 6cqw, 32px); letter-spacing: .02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-full-img { position: relative; flex: 1; min-height: 0; }
        .lp-full-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
        .lp-full-half { position: absolute; top: 0; bottom: 0; width: 50%; display: flex; align-items: center; padding: 0 8px; border: none; background: none; color: rgba(255,255,255,.85); filter: drop-shadow(0 1px 3px rgba(0,0,0,.7)); cursor: pointer; }
        .lp-full-count { margin: 0; padding: 8px 0 calc(10px + env(safe-area-inset-bottom)); text-align: center; font-size: 14px; font-weight: 700; color: rgba(255,255,255,.7); font-variant-numeric: tabular-nums; }

        /* Adjust: the seller's settings, never on the viewer's screen for long. */
        .lp-adjust { padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lp-adjhead { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; }
        .lp-adjhead .lp-adjtabs { flex: 1; min-width: 0; }
        /* Settings pop-up: over the whole stage, top bar included, so the live's
           X cannot be hit while it is open. */
        .lp-modal { position: absolute; inset: 0; z-index: 6; display: flex; align-items: flex-start; justify-content: center; padding: 12px; background: rgba(15,17,21,.35); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); overflow-y: auto; }
        .lp-modal .lp-adjust { width: 100%; max-width: 560px; margin: auto 0; box-shadow: 0 16px 40px rgba(0,0,0,.25); }
        .lp-adjclose { flex-shrink: 0; width: 44px; height: 44px; border: none; border-radius: 10px; background: #dc2626; color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .lp-rate { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: #4b5563; }
        .lp-rate-row { display: flex; gap: 8px; align-items: center; }
        .lp-rate-in { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; height: 44px; padding: 0 12px; border: 1px solid rgba(0,0,0,.12); border-radius: 10px; background: #fff; }
        .lp-rate-in input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }
        .lp-rate-in span { font-size: 14px; font-weight: 700; color: #6b7280; }
        .lp-rate-row .lp-seg { flex-shrink: 0; }
        .lp-confirm { position: absolute; inset: 0; z-index: 6; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,17,21,.45); }
        .lp-confirm-card { width: 100%; max-width: 320px; padding: 18px; border-radius: 14px; background: #fff; color: #0f1115; box-shadow: 0 12px 32px rgba(0,0,0,.25); }
        .lp-confirm-card h2 { margin: 0 0 4px; font-size: 18px; font-weight: 800; }
        .lp-confirm-card p { margin: 0 0 14px; font-size: 14px; color: #4b5563; }
        .lp-confirm-btns { display: flex; gap: 8px; }
        .lp-confirm-btns button { flex: 1; height: 44px; border-radius: 10px; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
        .lp-confirm-keep { border: none; background: var(--lp-a); color: #fff; }
        .lp-confirm-end { border: 1.5px solid #d1d5db; background: #fff; color: #0f1115; }
        .lp-brk tr.lp-tap { cursor: pointer; }
        .lp-cellin { font-size: max(16px, 1em) !important; box-sizing: border-box; width: 100%; min-width: 0; max-width: 7.5em; height: 1.9em; padding: 0 6px; border: 2px solid var(--lp-a); border-radius: 6px; background: #fff; color: #0f1115; font: inherit; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
        /* Tailwind preflight makes every svg display:block, which dropped the pen onto
           its own line under the number. Inline, and BEFORE the number so the
           figures keep one right edge. */
        .lp-brk .lp-pen { display: inline-block; margin-right: 6px; vertical-align: -1px; opacity: .55; }
        .lp-adjust label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: #4b5563; min-width: 0; }
        .lp-in { width: 100%; height: 44px; background: #fff; border: 1px solid rgba(0,0,0,.12); border-radius: 10px; color: #111827; padding: 0 12px; font-size: 16px; font-family: inherit; font-variant-numeric: tabular-nums; }
        .lp-in:focus { outline: none; border-color: #0f1115; }
        .lp-in:disabled { opacity: .5; }
        .lp-seg { display: flex; gap: 4px; padding: 4px; background: rgba(33,31,30,.08); border-radius: 10px; }
        .lp-adjust .lp-seg { grid-column: 1 / -1; }
        .lp-seg button { flex: 1; height: 34px; padding: 0 12px; border: none; border-radius: 7px; background: transparent; font: inherit; font-size: 13px; font-weight: 700; color: #4b5563; cursor: pointer; white-space: nowrap; }
        .lp-seg button[aria-pressed="true"] { background: #fff; color: #0f1115; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
        .lp-adjust .lp-wide { grid-column: 1 / -1; }
        .lp-adjust .lp-wide .lp-hint { font-weight: 500; }
        .lp-hint { grid-column: 1 / -1; font-size: 12px; color: #6b7280; line-height: 1.5; margin: 0; }
        .lp-insadj { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: #4b5563; }
        /* Adjust > Rebates: every car, one box each, set before the live. */
        .lp-rebs { display: flex; flex-direction: column; }
        .lp-rebs-h { margin: 0 0 6px; font-size: 12px; color: #4b5563; line-height: 1.45; }
        .lp-rebs-h b { display: block; margin-bottom: 2px; font-size: 15px; color: #0f1115; }
        .lp-reb { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid #EFEEEC; }
        .lp-badge { flex-shrink: 0; min-width: 34px; padding: 5px 5px 3px; border-radius: 7px; background: #F1F0EE; color: #374151; font-family: 'Bebas Neue', sans-serif; font-size: 19px; line-height: 1; text-align: center; }
        .lp-adjust .lp-reb-car { flex: 1; gap: 1px; min-width: 0; }
        .lp-reb-car b { font-size: 14px; line-height: 1.25; color: #0f1115; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .lp-reb-car small { font-size: 12px; font-weight: 500; color: #6b7280; }
        .lp-reb-in { display: flex; align-items: center; gap: 4px; height: 40px; padding: 0 10px; border-radius: 10px; border: 1.5px solid #E5E7EB; background: #fff; flex-shrink: 0; }
        .lp-reb-in.lp-on { border-color: #047857; background: rgba(4,120,87,.06); }
        .lp-reb-in span { font-size: 13px; font-weight: 700; color: #6b7280; white-space: nowrap; }
        .lp-reb-in input { width: 64px; padding: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; font-weight: 700; color: #0f1115; text-align: right; font-variant-numeric: tabular-nums; }
        .lp-reb-x { flex-shrink: 0; width: 32px; height: 32px; border-radius: 8px; border: 1px solid #E5E7EB; background: #fff; color: #374151; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        span.lp-reb-x { border: none; background: none; cursor: default; }
        .lp-colours { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .lp-colours > span { flex-basis: 100%; font-size: 12px; font-weight: 700; color: #4b5563; }
        .lp-sw { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.15); cursor: pointer; padding: 0; flex-shrink: 0; position: relative; overflow: hidden; }
        .lp-sw[aria-pressed="true"], .lp-sw[data-on="1"] { box-shadow: 0 0 0 2px #0f1115; }
        .lp-sw-any { background: conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444); }
        .lp-sw-any input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }

        /* Docs: the privacy line first, then the list as tiles. */
        .lp-docs { padding: 14px; display: flex; flex-direction: column; gap: 12px; width: 100%; }
        .lp-docs .lp-name { white-space: normal; }
        .lp-docs .lp-head > .lp-chips { flex: 1 1 220px; }
        .lp-privacy { margin: 0; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; background: #0f1115; color: #fff; font-size: clamp(13px, 3.8cqw, 16px); font-weight: 700; line-height: 1.3; }
        .lp-privacy svg { flex-shrink: 0; }
        .lp-docs ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
        .lp-desk .lp-docs ol { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .lp-docs li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: #F4F3F1; font-size: clamp(15px, 4.4cqw, 18px); font-weight: 700; color: #0f1115; line-height: 1.25; }
        .lp-desk .lp-docs li { min-height: 60px; font-size: 18px; }
        .lp-docs li span { flex-shrink: 0; width: 1.8em; height: 1.8em; border-radius: 50%; background: var(--lp-a); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: .85em; font-variant-numeric: tabular-nums; }

        /* Budget: the viewer's number is the big one, then the cars that fit. */
        .lp-bud { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
        .lp-money { display: flex; align-items: center; gap: 8px; height: clamp(56px, 15cqw, 76px); padding: 0 14px; border: 1.5px solid #E5E7EB; border-radius: 12px; background: #fff; }
        .lp-money:focus-within { border-color: var(--lp-a); }
        .lp-money span { font-size: clamp(18px, 5.6cqw, 24px); font-weight: 700; color: var(--lp-a); }
        .lp-money input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: transparent; font: inherit; font-size: clamp(30px, 11cqw, 56px); font-weight: 800; letter-spacing: -.02em; color: var(--lp-a); font-variant-numeric: tabular-nums; }
        .lp-desk .lp-money { height: 76px; }
        /* Take-home pay mode: pay and commitments side by side. */
        .lp-moneys { display: flex; gap: 8px; min-width: 0; }
        .lp-moneys > .lp-money { flex: 1 1 0; min-width: 0; }
        .lp-moneys2 > .lp-money:first-child { flex-grow: 1.4; }
        .lp-money.lp-money-sm { flex-direction: column; align-items: stretch; justify-content: center; gap: 0; padding: 4px 12px; }
        .lp-money-sm small { font-size: clamp(10px, 2.7cqw, 12px); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lp-money-in { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .lp-money-sm .lp-money-in > span { font-size: clamp(13px, 3.8cqw, 16px); color: #4b5563; }
        .lp .lp-money.lp-money-sm input { height: auto; font-size: clamp(20px, 6.5cqw, 32px); color: #0f1115; }
        .lp-desk .lp-money.lp-money-sm input { font-size: 32px; }
        /* Verdict colours: muted, and only on the column dots. */
        .lp-s-fit { --st: #15803d; --st-bg: rgba(21,128,61,.12); }
        .lp-s-near { --st: #b45309; --st-bg: rgba(180,83,9,.13); }
        .lp-s-over { --st: #b91c1c; --st-bg: rgba(185,28,28,.10); }
        .lp-desk .lp-money input { font-size: 52px; }
        .lp-work { font-size: clamp(13px, 3.6cqw, 17px); font-weight: 600; color: #374151; margin: 0; font-variant-numeric: tabular-nums; line-height: 1.6; }
        .lp-work em { font-style: normal; color: #9ca3af; font-weight: 500; }
        /* The result of the 35% sum (or the budget itself): the number the list is cut at. */
        .lp-hl { padding: 2px 8px; border-radius: 6px; background: rgba(var(--lp-rgb),.12); color: var(--lp-a2); font-weight: 800; white-space: nowrap; }
        .lp-res { border-top: 1px solid #EFEEEC; padding-top: 2px; }
        .lp-res h3 { font-size: clamp(11px, 2.8cqw, 13px); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #374151; margin: 8px 0 2px; }
        .lp-vchips { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 10px; }
        .lp-vchips button { min-height: 30px; padding: 3px 10px; border-radius: 8px; border: 1.5px solid #E5E7EB; background: #fff; color: #111827; font: inherit; font-size: clamp(12px, 3.4cqw, 15px); font-weight: 700; line-height: 1.15; cursor: pointer; }
        .lp-vchips button[aria-pressed="true"] { background: var(--lp-a); border-color: var(--lp-a); color: #fff; }
        .lp-vchips button:disabled { border: 1px dashed rgba(0,0,0,.18); background: transparent; color: #9ca3af; text-decoration: line-through; font-weight: 600; cursor: default; }
        .lp-empty { font-size: 14px; color: #6b7280; line-height: 1.5; margin: 10px 0; }

        /* Budget input: the kind switch, then the viewer's number (and
           commitments); one row on the desktop stage. */
        .lp-bin { display: flex; flex-direction: column; gap: 8px; }
        /* Desktop: one centred sum, [pay] x 35% - [commitments] = [up to],
           then the comment line beside the settings line (the mockup). */
        .lp-bsum { display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 0; }
        .lp-bsum > .lp-bkind { display: flex; flex-direction: column; gap: 3px; flex: none; padding: 3px; border-radius: 10px; background: #F4F3F1; }
        .lp-bsum > .lp-bkind .lp-chip { min-height: 28px; padding: 2px 10px; border: none; font-size: 12px; white-space: nowrap; }
        .lp-bsum > .lp-money { flex: 1 1 240px; max-width: 330px; min-width: 0; height: 64px; padding: 0 10px; border: 2px solid #0f1115; }
        .lp-bsum > .lp-money input { min-width: 4ch; font-size: 38px; }
        .lp-bsum > .lp-money-sm { flex: 0 0 136px; max-width: none; overflow: hidden; border-width: 1.5px; border-color: #D1D5DB; }
        .lp .lp-bsum > .lp-money-sm input { min-width: 0; height: 28px; font-size: 22px; }
        /* The label must keep its line: in a fixed-height column the box
           shrank it to 0px and viewers saw a bare "RM 0" (2026-10-24). */
        .lp-money-sm small, .lp-money-sm .lp-money-in { flex: none; }
        .lp-bop { flex: none; font-size: 17px; font-weight: 700; color: #9ca3af; white-space: nowrap; }
        .lp-bop small { font-size: 15px; }
        .lp-bres { flex: none; display: flex; flex-direction: column; justify-content: center; min-height: 64px; padding: 4px 12px; border-radius: 12px; background: var(--lp-a); color: #fff; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .lp-bres small { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .85; }
        .lp-bres b { font-size: 25px; font-weight: 800; white-space: nowrap; }
        .lp-bres b span { font-size: 13px; font-weight: 600; }
        .lp-bsetrow { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .lp-bsetrow > .lp-cta { flex: none; max-width: 42%; padding: 8px 16px; font-size: 13px; }
        .lp-bsetrow > .lp-bsetline { flex: 1; min-width: 0; }
        /* The seller's settings as one line; Change opens the pop-up. */
        .lp-bsetline { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 5px 5px 12px; border-radius: 10px; background: #F4F3F1; font-size: clamp(12px, 3.4cqw, 14px); color: #374151; font-variant-numeric: tabular-nums; }
        .lp-bsetline > span { min-width: 0; }
        .lp-bchange { flex-shrink: 0; min-height: 34px; padding: 0 16px; border: 1.5px solid #0f1115; border-radius: 999px; background: #fff; color: #0f1115; font: inherit; font-weight: 800; cursor: pointer; }
        .lp-modal .lp-bsetpop { max-width: 460px; }
        .lp-bsetpop > .lp-wide { display: flex; flex-direction: column; gap: 6px; }
        .lp-bsettitle { flex: 1; margin: 0; font-size: 18px; font-weight: 800; color: #0f1115; }
        .lp-bsetpop > .lp-bdone { display: flex; align-items: center; justify-content: center; }
        .lp-bdone { min-height: 46px; border: none; border-radius: 12px; background: #0f1115; color: #fff; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer; }
        /* Results: fits | tight + over, side by side on the desktop stage, one
           column on a phone. A long column pages (lp-bmore), never scrolls. */
        .lp-bcols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding-top: 8px; }
        .lp-desk .lp-bcols { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 14px; }
        .lp-bcolr { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .lp-bh { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 30px; }
        .lp-bh h3 { display: flex; align-items: center; gap: 6px; margin: 0; }
        .lp-res h3 i { width: 8px; height: 8px; border-radius: 50%; background: var(--st); flex-shrink: 0; }
        .lp-bmore { display: inline-flex; align-items: center; gap: 2px; min-height: 30px; padding: 0 8px 0 12px; border: 1.5px solid #0f1115; border-radius: 999px; background: #fff; color: #0f1115; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums; }
        /* One car: the photo fills the row's height, so no row is mostly blank. */
        .lp-brow { border: 1.5px solid #E5E7EB; border-radius: 12px; overflow: hidden; background: #fff; }
        .lp-brow.lp-over { background: #FBF8F1; }
        .lp-brow-main { display: flex; align-items: stretch; gap: 10px; width: 100%; min-height: clamp(62px, 17cqw, 70px); padding: 7px 10px 7px 7px; border: none; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
        .lp-desk .lp-brow-main { min-height: 64px; }
        /* The photo sits inset in the card with its own rounded frame, never
           flush against the card's edge. */
        .lp-bimg { position: relative; flex: 0 0 clamp(92px, 27cqw, 112px); min-height: clamp(56px, 16cqw, 66px); border-radius: 9px; overflow: hidden; background: #EDEAE3; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
        .lp-desk .lp-bimg { flex-basis: 104px; }
        .lp-bimg img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .lp-bimg .lp-n { position: absolute; top: 4px; left: 4px; min-width: 28px; padding: 3px 4px 1px; border-radius: 6px; background: rgba(255,255,255,.94); color: #111827; font-family: 'Bebas Neue', sans-serif; font-size: clamp(15px, 4.4cqw, 18px); line-height: 1; text-align: center; }
        .lp-brow-main .lp-rn { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 2px; padding: 1px 0; }
        .lp-bdsr { font-size: 12px; font-weight: 800; color: var(--st); font-variant-numeric: tabular-nums; }
        .lp-brow-main .lp-rn b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: clamp(13px, 3.6cqw, 15px); font-weight: 700; line-height: 1.2; color: #111827; }
        .lp-bfoot { display: flex; align-items: baseline; justify-content: space-between; gap: 2px 8px; min-width: 0; flex-wrap: wrap; }
        .lp-bfoot > span:first-child { min-width: 0; font-size: 12px; line-height: 1.3; color: #6b7280; font-variant-numeric: tabular-nums; }
        .lp-bfoot .lp-m { margin-left: auto; }
        .lp-bfoot > .lp-fitdep { color: #0f1115; font-weight: 700; }
        .lp-bfoot .lp-m { flex-shrink: 0; font-size: clamp(16px, 4.6cqw, 19px); font-weight: 800; color: #0f1115; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .lp-bfoot .lp-m small { font-size: 11px; font-weight: 600; color: #6b7280; }
        .lp-brow .lp-vchips { padding: 0 7px 8px; }
        /* Desktop stage: a smaller title and tighter gaps, so the cars get the height. */
        .lp-desk .lp-bud { gap: 8px; padding: 12px 14px; }
        .lp-desk .lp-bud .lp-name { font-size: 26px; }
        .lp-desk .lp-bud .lp-work { font-size: 15px; line-height: 1.4; }
        .lp-desk .lp-bud .lp-bkind .lp-chip { min-height: 30px; font-size: 14px; }
        .lp-desk .lp-bcols { padding-top: 4px; }
        .lp-desk .lp-bud .lp-note { margin: 0; }

        /* Top bar + nav: ink for what is picked, never the accent. */
        .lp-top > .lp-seg { min-width: 0; background: #fff; border: 1px solid #E5E7EB; }
        .lp-top > .lp-seg button { flex: 1 1 auto; padding: 0 8px; font-size: 13px; }
        .lp-top > .lp-seg button[aria-pressed="true"] { background: #0f1115; color: #fff; box-shadow: none; }
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
        .lp-nav { display: flex; gap: 10px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: #EEEDEA; border-top: 1px solid rgba(33,31,30,.08); flex-shrink: 0; }
        .lp-navbtn { flex: 1; height: 48px; border-radius: 12px; border: 1px solid #E5E7EB; background: #fff; color: #111827; font-size: 16px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-family: inherit; font-variant-numeric: tabular-nums; }
        .lp-navbtn.lp-next { background: #0f1115; border-color: transparent; color: #fff; }
        .lp-report { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 16px; }
        .lp-report h2 { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 40px; line-height: 1; letter-spacing: .015em; color: #0f1115; margin: 0; }
        .lp-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .lp-tile { padding: 16px; }
        .lp-tile b { display: block; font-size: 32px; font-weight: 800; color: #0f1115; font-variant-numeric: tabular-nums; line-height: 1.1; }
        .lp-tile span { display: block; font-size: 13px; color: #4b5563; margin-top: 4px; }
        .lp-copy { margin-top: 12px; height: 40px; padding: 0 16px; border: none; border-radius: 10px; background: #0f1115; color: #fff; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
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
          {deskZoom && canFull && (
            <button className="lp-iconbtn" onClick={toggleFull} aria-label={isFull ? t.exitFullScreen : t.fullScreen} aria-pressed={isFull}>
              {isFull ? <Shrink size={17} /> : <Expand size={17} />}
            </button>
          )}
          {!report && mode !== 'docs' && (
            <button data-adjust-open="" className="lp-iconbtn" onClick={() => setAdjustOpen((v) => !v)} aria-label={t.adjust} aria-pressed={adjustOpen}>
              <SlidersHorizontal size={17} />
            </button>
          )}
          {!embedded && (
            <button className="lp-iconbtn" onClick={report ? onClose : requestExit}
              aria-label={!report && adjustOpen ? t.closeAdjust : t.exit}><X size={18} /></button>
          )}
        </div>
      </div>

      {report ? <LiveReport report={report} onDone={onClose} t={t} slug={slug} /> : (<>
      <div className="lp-body" onTouchStart={mode === 'cars' ? onTouchStart : undefined} onTouchEnd={mode === 'cars' ? onTouchEnd : undefined}>
        <div className="lp-fit" ref={fitRef}>
        {mode === 'cars' ? (
        <div className="lp-card lp-sheet">
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
                  ).filter(Boolean).join(' · ') || ' '}
                </p>
              </div>
            </div>
            {/* The comment line sits at the top: the bottom of the stream is under TikTok's comments. */}
            <p className="lp-cta">{ctaLine(ctaCustom, idx + 1, t.cta(idx + 1))}{bioOn && <span className="lp-bio">{t.bioLine}</span>}</p>
            {/* Contact sits at the TOP, under the comment line (2026-10-24): at
                the foot of the card it fell below the fold on a model card and
                sat under TikTok's comments on every other car. Not a button
                (owner, 2026-10-22): the top-bar contact button is the one switch. */}
            {showContact && contact && (
              <div className="lp-contact">
                <span className="lp-c-who"><small>{t.contactMe}</small>{contact.name && <b>{contact.name}</b>}</span>
                {contact.phone && <span className="lp-c-ph">{contact.phone}</span>}
              </div>
            )}
          </div>

          {/* One grid, two arrangements. Desktop: photo | answer, the deposit
              chips across, working | the rest. Phone: answer, chips, then photo |
              working, then the rest (grid-template-areas in the styles). */}
          <div className="lp-grid">
            {/* Photo: tap the left / right half to step through this car's photos. */}
            <div className="lp-photo">
              {images[imgIdx]
                // Keyed by photo: a new tap shows the new photo (or the blank
                // frame while it lands), never the old one under the new dot.
                ? <img key={images[imgIdx]} src={photoUrl(images[imgIdx])} alt={carLabel(shown)}
                    decoding="async" onError={imgFallback(images[imgIdx])} />
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
              {images[imgIdx] && (
                <button type="button" className="lp-expand" aria-label={t.fullPhoto} onClick={() => setPhotoFull(true)}>
                  <Maximize2 size={16} />
                </button>
              )}
            </div>

            {/* The answer: the picked monthly, big, and the three tenures under it. */}
            <div className="lp-ans">
              {variants.length > 1 && (
                <div className="lp-chips lp-vars" role="group" aria-label={t.variant}>
                  {variants.map((v, i) => (
                    <button key={v.model_id} type="button" className="lp-chip" aria-pressed={v.model_id === variant?.model_id}
                      onClick={() => chooseVariant(v.model_id)}>{variantChips[i]}</button>
                  ))}
                </div>
              )}
              {!financeable ? null
                : noLoan ? <p className="lp-ans-msg">{t.depositCovers}</p>
                : !tenures.length ? <p className="lp-ans-msg">{t.tooOld(MAX_CAR_AGE_AT_END)}</p> : (<>
                  <p className="lp-ans-lbl">
                    {t.years(pickYears)} · {picked.down > 0 ? t.depositAmt(`RM ${fmt(picked.down)}`) : t.noDeposit}
                  </p>
                  <p className="lp-big"><span className="lp-rm">RM</span>{fmt(answer)}<small>{t.perMonth}</small></p>
                  {/* As many columns as tenures: an old car's lone "1 year" tile
                      fills the row and says it is the most a bank gives. */}
                  <div className="lp-tens" role="group" aria-label={t.tenure}
                    style={{ gridTemplateColumns: `repeat(${tenuresDesc.length}, minmax(0, 1fr))` }}>
                    {tenuresDesc.map((y) => (
                      <button key={y} type="button" className="lp-ten" aria-pressed={y === pickYears}
                        onClick={() => setPick((p) => ({ ...p, years: y }))}>
                        <span>{tenuresDesc.length === 1 && tenureCapped ? t.yearsMax(y) : t.years(y)}</span>
                        <b><Money n={monthlyFor(picked.down, y)} /></b>
                      </button>
                    ))}
                  </div>
                </>)}
            </div>

            {financeable && (
              <div className="lp-deprow">
                <span className="lp-lbl">{t.deposit}</span>
                <div className="lp-chips lp-chips5" role="group" aria-label={t.deposit}>
                  <DepositChip editing={depEdit} value={customDown} pressed={picked.custom === true}
                    label={custom > 0 ? `RM ${fmt(custom)}` : t.other} aria={t.customDeposit}
                    onOpen={() => setDepEdit(true)} onType={typeDeposit} onClose={closeDeposit} />
                  {rows.filter((r) => !r.custom).map((r) => (
                    <button key={r.key} type="button" className="lp-chip" aria-pressed={r.key === picked.key}
                      onClick={() => { setDepEdit(false); setPick((p) => ({ ...p, row: r.key })); }}>
                      {r.key === 0 ? t.none : `${r.key}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* The working, line by line: price - rebate - deposit = loan, at this rate.
                Rebate is typed in place on its line; rate is set in Adjust, the deposit on the chips. */}
            <div className="lp-brkwrap">
              <table className="lp-brk">
                <tbody>
                  <tr><td>{t.price}</td><td>{price > 0 ? <Money n={price} /> : t.onRequest}</td></tr>
                  {/* Insurance is typed in place too, and the figure stays on this
                      device until changed (per variant on a model card). */}
                  {price > 0 && (
                    insEdit ? (
                      <tr>
                        <td>{t.insurance}</td>
                        <td>
                          <input className="lp-cellin" autoFocus type="text" inputMode="numeric" placeholder={ins ? String(ins) : '0'}
                            aria-label={t.insuranceEdit} value={insTyped[insK] ?? ''}
                            onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setInsTyped((m) => ({ ...m, [insK]: d })); }}
                            onBlur={() => setInsEdit(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }} />
                        </td>
                      </tr>
                    ) : (
                      <tr className="lp-tap" role="button" tabIndex={0} aria-label={t.insuranceEdit}
                        onClick={() => setInsEdit(true)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInsEdit(true); } }}>
                        <td>{insIsTyped ? t.insurance : t.insuranceEst}</td>
                        <td><Pencil size={12} aria-hidden="true" className="lp-pen" />{ins > 0 ? <>+ <Money n={ins} /></> : '-'}</td>
                      </tr>
                    )
                  )}
                  {/* New cars always show the Rebate line (brands run promos every
                      month); tapping it turns the number into a box, typed in place. */}
                  {price > 0 && (rebate > 0 || shown.condition === 'new' || rebateEdit) && (
                    rebateEdit ? (
                      <tr className="lp-r-reb">
                        <td>{t.rebate}</td>
                        <td>
                          <input className="lp-cellin" autoFocus type="text" inputMode="numeric" placeholder="0"
                            aria-label={t.rebateEdit} value={rebates[rk] ?? ''}
                            onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setRebates((r) => ({ ...r, [rk]: d })); }}
                            onBlur={() => setRebateEdit(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }} />
                        </td>
                      </tr>
                    ) : (
                      <tr className="lp-r-reb lp-tap" role="button" tabIndex={0} aria-label={t.rebateEdit}
                        onClick={() => setRebateEdit(true)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRebateEdit(true); } }}>
                        <td>{t.rebate}</td>
                        <td><Pencil size={12} aria-hidden="true" className="lp-pen" />{rebate > 0 ? <>- <Money n={rebate} /></> : t.none}</td>
                      </tr>
                    )
                  )}
                  {financeable && (<>
                    <tr><td>{t.deposit}</td><td>{picked.down > 0 ? <>- <Money n={picked.down} /></> : t.none}</td></tr>
                    <tr className="lp-loan"><td>{t.loan}</td><td><Money n={loanAmt} /></td></tr>
                    <tr className="lp-r-rate">
                      <td>
                        {t.rate}
                        {/* What the rate means: hover on a mouse, tap on a phone. */}
                        <button type="button" className="lp-info" aria-label={t.rateInfoLabel} aria-expanded={rateInfo}
                          onClick={() => setRateInfo((v) => !v)}
                          onPointerEnter={(e) => { if (e.pointerType === 'mouse') setRateInfo(true); }}
                          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setRateInfo(false); }}>
                          <Info size={13} />
                        </button>
                      </td>
                      <td>{fmtRate(rate)}% {basis === 'flat' ? t.flat : 'EIR'}</td>
                    </tr>
                  </>)}
                </tbody>
              </table>
              {rateInfo && <p className="lp-tip" role="tooltip">{t.rateInfo(fmtRate(rate), basis === 'flat')}</p>}
            </div>

            {/* The viewer's NCD: tap, never type. Hidden once a figure is typed
                for this car (the typed quote already has its NCD in it). Its own grid
                area: under the working on desktop, so the photo keeps the whole row
                (under the photo it shrank the photo, 2026-10-24). */}
            {price > 0 && !insIsTyped && ins !== null && (
              <div className="lp-seg lp-ncd" role="group" aria-label={t.ncd}>
                <span>{t.ncd}</span>
                {NCD_TIERS.map((n) => (
                  <button key={n} type="button" aria-pressed={n === ncd} onClick={() => setNcd(n)}>{ncdLabel(n)}</button>
                ))}
              </div>
            )}

            <div className="lp-rest">
              {/* A typed rate that is probably a mistake: a flat number on the EIR
                  switch, or above the Hire-Purchase Act cap. */}
              {rateWarn && (
                <p className="lp-warn">
                  {rateWarn === 'looksFlat'
                    ? <>{t.looksFlat}<button type="button" onClick={() => setRate(rateGroup, { basis: 'flat' })}>{t.switchFlat}</button></>
                    : t.aboveCap(eirCap(pickYears))}
                </p>
              )}
              {/* Total counter (owner, 2026-10-22): what the buyer pays in all,
                  deposit + every instalment, and the interest inside it. */}
              {totals && (
                <div className="lp-totals">
                  <div><span>{t.totalPay}</span><b><Money n={picked.down + totals.totalRepayment} /></b><small>{t.totalPayHow(pickYears * 12)}</small></div>
                  <div><span>{t.interest}</span><b><Money n={totals.totalInterest} /></b><small>{t.interestHow(fmtRate(rateFor(pickYears)))}</small></div>
                </div>
              )}
              {salary && (
                <p className="lp-salary">
                  {t.salary(pickYears)}<b>{t.about(`RM ${fmt(salary)}`)}</b>{t.salaryRule(Math.round(SALARY_SHARE * 100))}
                </p>
              )}
              {financeable && (
                <p className="lp-note">
                  {tenureCapped ? `${t.tenureCap(Math.max(...tenures), MAX_CAR_AGE_AT_END)} ` : ''}{officialNew && car.condition === 'new' ? `${t.newPriceNote} ` : ''}{t.reducing}{basis === 'flat' ? t.flatAsEir(pickYears, fmtRate(rateFor(pickYears))) : ''}.{' '}
                  {highValue ? t.highValue : t.subjectBank}
                </p>
              )}
              {offer.trim() && <p className="lp-offer"><b>{t.offer}</b>{offer.trim()}</p>}
            </div>
          </div>
        </div>
        ) : mode === 'docs' ? (
        /* Docs: what the bank asks the BUYER for. The car (new, used, recon)
           does not change it; how the buyer earns does. The privacy line sits
           at the top, where TikTok's comments do not cover it. */
        <div className="lp-card lp-docs">
          <div className="lp-head">
            <h2 className="lp-name">{t.docsTitle}</h2>
            <div className="lp-chips lp-chips2 lp-ink" role="group" aria-label={t.docsTitle}>
              <button type="button" className="lp-chip" aria-pressed={docsKind === 'employee'} onClick={() => setDocsKind('employee')}>{t.docsEmployee}</button>
              <button type="button" className="lp-chip" aria-pressed={docsKind === 'self'} onClick={() => setDocsKind('self')}>{t.docsSelf}</button>
            </div>
          </div>
          <p className="lp-privacy"><Lock size={18} aria-hidden="true" />{t.docsPrivacy}</p>
          <ol>
            {t.docsList[docsKind].map((d, i) => <li key={d}><span>{i + 1}</span>{d}</li>)}
          </ol>
          <p className="lp-note">{t.docsAnyCar} {t.docsNote}</p>
        </div>
        ) : (
        /* Budget: the viewer's number in, the cars that fit out. Take-home
           pay mode also takes their commitments and scores every car by DSR. */
        <div className="lp-card lp-bud">
          {deskZoom ? (<>
            {/* Desktop (the mockup): the sum on one centred line, then the
                comment line beside the seller's settings. */}
            <div className="lp-bsum">
              {budgetKindSwitch}
              {moneyIn}
              {budgetKind === 'pay' && <>
                <span className="lp-bop">× {Math.round(SALARY_SHARE * 100)}% −</span>
                {commitIn}
              </>}
              {budgetOn && <>
                <span className="lp-bop">=</span>
                <div className="lp-bres">
                  <small>{t.upTo.trim()}</small>
                  <b>RM {fmt(maxMonthly)}<span>{t.perMonth}</span></b>
                </div>
              </>}
            </div>
            <div className="lp-bsetrow">
              <p className="lp-cta">{t.budgetCta}</p>
              {budgetSetLine}
            </div>
          </>) : (<>
          <div className="lp-head">
            <h2 className="lp-name">{t.budgetTitle}</h2>
            <p className="lp-cta">{t.budgetCta}</p>
          </div>
          <div className="lp-bin">
            {budgetKindSwitch}
            <div className={budgetKind === 'pay' ? 'lp-moneys lp-moneys2' : 'lp-moneys'}>
              {moneyIn}
              {budgetKind === 'pay' && commitIn}
            </div>
          </div>
          {budgetOn && (
            /* What they can pay a month, worked out in front of them: for
               take-home pay, 35% of it minus what they already pay. */
            <p className="lp-work">
              {payMode && <>RM {fmt(amount)} <em>×</em> {Math.round(SALARY_SHARE * 100)}%{commit > 0 && <> <em>−</em> RM {fmt(commit)} {t.commitWord}</>} <em>=</em> </>}
              <mark className="lp-hl">{t.upTo}RM {fmt(maxMonthly)}{t.perMonth}</mark>
            </p>
          )}
          {budgetSetLine}
          </>)}

          <div className="lp-res">
            {!budgetOn ? (
              <p className="lp-empty">{t.budgetEmpty}</p>
            ) : (<>
              {payMode && maxMonthly === 0 && <p className="lp-warn">{t.noRoom(Math.round(SALARY_SHARE * 100))}</p>}
              {/* Every car on one screen: fits on the left, tight / just above
                  and over on the right. A long column pages, it never scrolls. */}
              <div className="lp-bcols">
                {['fit', 'side'].map((st) => {
                  const { p, pages, rows } = pageOf(st);
                  const head = (g) => <h3><i aria-hidden="true" />{stLabel(g)} · {groups[g].length}</h3>;
                  const more = pages > 1 && (
                    <button type="button" className="lp-bmore" aria-label={t.morePage} onClick={() => nextPage(st, pages)}>
                      {p + 1}/{pages}<ChevronRight size={14} aria-hidden="true" />
                    </button>
                  );
                  const rowOf = (m) => (
                    <BudgetRow key={`${m.car.id}-${m.car._variantId || ''}`} m={m} over={m.status !== 'fit'} years={budgetYears} dsrFor={dsrFor}
                      pay={payMode} pick={budgetPick[m.n]} onPick={pickBudgetVariant} onOpen={openFromBudget} t={t} />
                  );
                  if (st === 'fit') {
                    return (
                      <div key={st} className="lp-bcolr lp-s-fit">
                        <div className="lp-bh">{head('fit')}{more}</div>
                        {rows.map(rowOf)}
                      </div>
                    );
                  }
                  // Right column: tight rows, then over-budget rows, as full
                  // rows (owner, 2026-10-24: the over list was only #N chips).
                  const near = rows.filter((m) => m.status === 'near');
                  const over = rows.filter((m) => m.status === 'over');
                  return (
                    <div key={st} className="lp-bcolr">
                      <div className="lp-s-near lp-bh">{head('near')}{more}</div>
                      {near.map(rowOf)}
                      {groups.over.length > 0 && (near.length < rows.length || p === pages - 1) && (
                        <div className="lp-s-over lp-bh">{head('over')}</div>
                      )}
                      {over.map(rowOf)}
                    </div>
                  );
                })}
              </div>
              <p className="lp-note">
                {t.budgetNote}
                {anyHighValue ? t.budgetHigh : ''}
                {budgetKind === 'pay' ? ` ${t.dsrRule(Math.round(SALARY_SHARE * 100))}` : ''}
              </p>
            </>)}
          </div>
        </div>
        )}
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

      {/* Full photo, inside the stage: contained, uncropped, never wider than
          the calculator. Tap a half (or swipe, or arrow keys) for the next. */}
      {photoFull && images[imgIdx] && !report && (
        <div className="lp-full" role="dialog" aria-label={carLabel(shown)}
          onTouchStart={(e) => { photoTouchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (photoTouchX.current == null) return;
            const dx = e.changedTouches[0].clientX - photoTouchX.current;
            photoTouchX.current = null;
            if (Math.abs(dx) > 50) stepPhoto(dx < 0 ? 1 : -1);
          }}>
          <div className="lp-full-top">
            <span>#{idx + 1} {carLabel(shown)}</span>
            <button type="button" className="lp-iconbtn" onClick={() => setPhotoFull(false)} aria-label={t.closePhoto}><X size={18} /></button>
          </div>
          <div className="lp-full-img">
            <img key={images[imgIdx]} src={photoUrl(images[imgIdx])} alt={carLabel(shown)}
              decoding="async" onError={imgFallback(images[imgIdx])} />
            {images.length > 1 && (<>
              <button type="button" className="lp-full-half" style={{ left: 0 }} aria-label={t.prevPhoto} onClick={() => stepPhoto(-1)}><ChevronLeft size={28} /></button>
              <button type="button" className="lp-full-half" style={{ right: 0, justifyContent: 'flex-end' }} aria-label={t.nextPhoto} onClick={() => stepPhoto(1)}><ChevronRight size={28} /></button>
            </>)}
          </div>
          {images.length > 1 && <p className="lp-full-count">{imgIdx + 1} / {images.length}</p>}
        </div>
      )}

        {budgetSetOpen && mode === 'budget' && !report && (
          // Budget settings: the same pop-up as Adjust (it covers the top bar, so
          // the live's X cannot be hit), opened by Change on the summary line.
          // A tap on the backdrop or Esc closes it.
          <div className="lp-modal" onClick={(e) => { if (e.target === e.currentTarget) setBudgetSetOpen(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setBudgetSetOpen(false); } }}>
          <div className="lp-card lp-adjust lp-bsetpop" role="dialog" aria-modal="true" aria-label={t.budgetSetTitle}>
            <div className="lp-adjhead">
              <h2 className="lp-bsettitle">{t.budgetSetTitle}</h2>
              <button type="button" className="lp-adjclose" onClick={() => setBudgetSetOpen(false)} aria-label={t.done}>
                <X size={20} />
              </button>
            </div>
            <div className="lp-wide">
              <span className="lp-lbl">{t.deposit}</span>
              <div className="lp-chips lp-chips4 lp-ink" role="group" aria-label={t.deposit}>
                <DepositChip editing={budgetDepEdit} value={budgetCustom} pressed={budgetDep === 'c'}
                  label={Number(budgetCustom) > 0 ? `RM ${fmt(budgetCustom)}` : t.other} aria={t.customDeposit}
                  onOpen={() => setBudgetDepEdit(true)} onType={typeBudgetDeposit} onClose={closeBudgetDeposit} />
                {BUDGET_DOWNS.map((d) => (
                  <button key={d} type="button" className="lp-chip" aria-pressed={budgetDep === d}
                    onClick={() => { setBudgetDepEdit(false); setBudgetDep(d); }}>
                    {d === 0 ? t.none : `RM ${d / 1000}k`}
                  </button>
                ))}
              </div>
            </div>
            <div className="lp-wide">
              <span className="lp-lbl">{t.yearsAria}</span>
              <div className="lp-chips lp-chips3 lp-ink" role="group" aria-label={t.yearsAria}>
                {[...TENURES].reverse().map((y) => (
                  <button key={y} type="button" className="lp-chip" aria-pressed={budgetYears === y} onClick={() => setBudgetYears(y)}>{t.years(y)}</button>
                ))}
              </div>
            </div>
            {/* Interest rate: the same saved setting as Adjust > Financing. */}
            {rateGroups.map((g) => rateRow(g, 'lp-brate'))}
            <button type="button" className="lp-bdone lp-wide" onClick={() => setBudgetSetOpen(false)}>{t.done}</button>
          </div>
          </div>
        )}

        {adjustOpen && mode !== 'docs' && !report && (
          // A pop-up over the stage (owner, 2026-10-22): blurred backdrop, its own
          // red close. The backdrop covers the top bar, so a miss-tap can only
          // close Settings, never end the live. A tap on the backdrop closes it.
          <div className="lp-modal">
          <div ref={adjustRef} className="lp-card lp-adjust" role="dialog" aria-modal="true" aria-label={t.adjust}>
            {/* Three tabs: Financing (rates, monthly budget, insurance), Rebates
                (every car), Look (colour, comment line, offer). */}
            <div className="lp-adjhead">
              <div className="lp-seg lp-adjtabs" role="group" aria-label={t.adjust}>
                <button type="button" aria-pressed={adjustTab === 'fin'} onClick={() => setAdjustTab('fin')}>{t.adjFin}</button>
                <button type="button" aria-pressed={adjustTab === 'rebates'} onClick={() => setAdjustTab('rebates')}>
                  {t.adjRebates}{rebateCount > 0 ? ` · ${rebateCount}` : ''}
                </button>
                <button type="button" aria-pressed={adjustTab === 'look'} onClick={() => setAdjustTab('look')}>{t.adjLook}</button>
              </div>
              <button type="button" className="lp-adjclose" onClick={() => setAdjustOpen(false)} aria-label={t.closeAdjust}>
                <X size={20} />
              </button>
            </div>

            {adjustTab === 'fin' && (<>
              {/* One row per rate group the seller actually has on this live. */}
              {rateGroups.map((g) => rateRow(g, 'lp-rate'))}
              {/* Monthly budget sits under the rates (owner, 2026-10-22): type what the
                  viewer can pay, the deposit it needs fills the first chip. */}
              {mode === 'cars' && (
                <label className="lp-wide">
                  {t.targetMonthly}
                  <input className="lp-in" type="number" inputMode="numeric" min="0" value={target}
                    disabled={!canLoan} onChange={(e) => applyTarget(e.target.value)} />
                  <small className="lp-hint">{t.targetHint}</small>
                </label>
              )}
              {mode === 'cars' && car && (<>
                <p className="lp-hint">{t.carRateNote(`#${idx + 1}`, `${fmtRate(rate)}% ${basis === 'flat' ? t.flat : 'EIR'}`)}</p>
              </>)}
            </>)}

            {adjustTab === 'rebates' && (
              <div className="lp-wide lp-rebs">
                <p className="lp-rebs-h"><b>{t.rebatesTitle}{rebateCount > 0 ? ` · ${rebateCount}` : ''}</b>{embedded ? t.rebatesHintDemo : t.rebatesHint(endLabel)}</p>
                {listings.map((c, i) => {
                  const v = rebates[c.id] ?? '';
                  const on = Number(v) > 0;
                  const kind = c.is_model_card ? t.allVariants
                    : c.condition === 'new' ? t.newTag : c.condition === 'recon' ? t.recon : t.used;
                  return (
                    <div className="lp-reb" key={c.id}>
                      <span className="lp-badge">#{i + 1}</span>
                      <label className="lp-reb-car" htmlFor={`lp-reb-${c.id}`}>
                        <b>{carLabel(c)}</b>
                        <small>{kind}{on && !embedded ? ` · ${t.savedUntil(endLabel)}` : ''}</small>
                      </label>
                      <span className={on ? 'lp-reb-in lp-on' : 'lp-reb-in'}>
                        <span>- RM</span>
                        <input id={`lp-reb-${c.id}`} type="text" inputMode="numeric" placeholder="0" value={v}
                          onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setRebates((r) => ({ ...r, [c.id]: d })); }} />
                      </span>
                      {on
                        ? <button type="button" className="lp-reb-x" onClick={() => setRebates((r) => { const n = { ...r }; delete n[c.id]; return n; })}
                            aria-label={`${t.clear} ${carLabel(c)}`}><X size={15} /></button>
                        : <span className="lp-reb-x" aria-hidden="true" />}
                    </div>
                  );
                })}
                <p className="lp-hint">{t.rebateModelNote}</p>
              </div>
            )}

            {adjustTab === 'look' && (<>
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
              <label className="lp-wide">
                {t.ctaLabel}
                <input className="lp-in" type="text" maxLength={CTA_MAX} placeholder={t.cta('')}
                  value={ctaCustom} onChange={(e) => changeCta(e.target.value)} />
                <small className="lp-hint">{t.ctaHint}</small>
              </label>
              <div className="lp-wide lp-insadj">
                <span>{t.bioLabel}</span>
                <div className="lp-seg" role="group" aria-label={t.bioLabel}>
                  <button type="button" aria-pressed={!bioOn} onClick={() => changeBio(false)}>{t.bioOff}</button>
                  <button type="button" aria-pressed={bioOn} onClick={() => changeBio(true)}>{t.bioOn}</button>
                </div>
                <small className="lp-hint">{t.bioHint}</small>
              </div>
              <label className="lp-wide">
                {t.offerLabel}
                <input className="lp-in" type="text" maxLength={OFFER_MAX} value={offer} onChange={(e) => changeOffer(e.target.value)} />
                <small className="lp-hint">{t.offerHint}</small>
              </label>
            </>)}
          </div>
          </div>
        )}

      {/* Ending the live always asks. Keep presenting is the focused, accent
          button, so a stray Enter or second tap keeps the stream going. */}
      {confirmEnd && !report && (
        <div className="lp-confirm" role="alertdialog" aria-modal="true" aria-labelledby="lp-confirm-h"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmEnd(false); }}>
          <div className="lp-confirm-card">
            <h2 id="lp-confirm-h">{t.endTitle}</h2>
            <p>{t.endBody}</p>
            <div className="lp-confirm-btns">
              <button type="button" className="lp-confirm-end" onClick={() => { setConfirmEnd(false); finish(); }}>{t.endYes}</button>
              <button type="button" className="lp-confirm-keep" autoFocus onClick={() => setConfirmEnd(false)}>{t.endKeep}</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
  return embedded ? screen : createPortal(screen, document.body);
}

// One budget result. Tapping it opens that car on the Cars screen with the
// same deposit and years picked, so the big number matches this row.
// A car the budget's tenure is too long for is priced at its own limit, and
// the row says which; a "just above" car says the longer tenure, or else the
// deposit, that makes it fit. In take-home pay mode it also says its DSR.
// A model card shows its variants on top: the ones this budget buys are
// tappable (the row's price and monthly follow the pick, and so does the car
// it opens); the rest are dimmed and struck through. Never blurred: on a
// camera filming a screen, blur reads as a glitch.
// One car in a Budget column: a photo that fills the row's height, #N, the
// name (a model card names the variant it is priced at, and lists the others
// that fit as chips), the price, and the monthly. A tight / just-above row
// says what would make it fit instead of the price.
function BudgetRow({ m, over, years, dsrFor, pay, pick, onPick, onOpen, t }) {
  const row = m.options?.find((o) => o.car._variantId === pick && o.fits) || m;
  const img = Array.isArray(m.car.images) ? m.car.images.find(Boolean) : null;
  const names = m.options ? shortVariantNames(m.options.map((o) => o.car.variant)) : [];
  const fix = !over ? null
    : row.fitYears ? t.fitIfYears(row.fitYears, pay)
    : row.topUp > 0 ? (pay ? t.topUpComfort(`RM ${fmt(row.topUp)}`) : t.topUp(`RM ${fmt(row.topUp)}`))
    : null;
  const dsr = dsrFor(row.monthly);
  const band = dsr == null ? null : dsr <= SALARY_SHARE ? 'fit' : dsr <= DSR_TIGHT ? 'near' : 'over';
  return (
    <div className={over ? 'lp-brow lp-over' : 'lp-brow'}>
      <button type="button" className="lp-brow-main" onClick={() => onOpen(row)}>
        <span className="lp-bimg">
          {img ? <img src={cdnImg(img, 320, 70)} alt="" decoding="async" onError={imgFallback(img)} /> : null}
          <span className="lp-n">#{m.n}</span>
        </span>
        {/* The name gets the row's full width (it carries the variant); the
            price, or what would make it fit, shares the last line with the monthly. */}
        <span className="lp-rn">
          <b>{carLabel(m.options ? { ...row.car, variant: null } : row.car)}</b>
          {band && <span className={`lp-bdsr lp-s-${band}`}>{t.dsrLine(Math.round(dsr * 100))}</span>}
          <span className="lp-bfoot">
            <span className={fix ? 'lp-fitdep' : undefined}>
              {fix || `RM ${fmt(row.price)}`}{row.years !== years ? ` · ${t.yrsShort(row.years)}` : ''}
            </span>
            <span className="lp-m">RM {fmt(row.monthly)}<small>{t.perMonth}</small></span>
          </span>
        </span>
      </button>
      {m.options && (
        <div className="lp-vchips" role="group" aria-label={t.variant}>
          {m.options.map((o, i) => (
            <button key={o.car._variantId} type="button" disabled={!o.fits}
              aria-pressed={o.car._variantId === row.car._variantId}
              onClick={() => onPick(m.n, o.car._variantId)}>{names[i]}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// After the live. Counts only: this can still be on the stream, so no buyer
// name, phone or message ever renders here.
function LiveReport({ report, onDone, t, slug }) {
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard?.writeText(`${SITE_URL}/s/${slug}`).then(() => setCopied(true), () => {});
  };
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
      {/* Where the viewers came from. None from TikTok/IG = the bio link is
          probably missing, so the fix is offered right here. */}
      {!report.eventsFailed && (report.fromBio > 0 ? (
        <p className="lp-note"><b>{fmt(report.fromBio)}</b> {t.fromBio}</p>
      ) : slug ? (
        <div className="lp-card lp-tile">
          <span>{t.noBioTitle}</span>
          <span>{t.noBioBody}</span>
          <button type="button" className="lp-copy" onClick={copyLink}>{copied ? t.bioCopied : t.bioCopy}</button>
        </div>
      ) : null)}
      <p className="lp-note">
        {t.reportNote}
      </p>
      <button className="lp-navbtn lp-next" onClick={onDone} style={{ flex: 'none' }}>{t.done}</button>
    </div>
  );
}

// The first deposit chip: shows the typed amount (or "Other") with a pencil;
// tapped, it turns into an RM box the same size, in the same slot, so the row
// never moves. The sheet follows each keystroke; Enter or tapping away sets it.
function DepositChip({ editing, value, pressed, label, aria, onOpen, onType, onClose }) {
  if (editing) {
    return (
      <label className="lp-chip lp-chip-edit">
        <span>RM</span>
        <input autoFocus type="text" inputMode="numeric" aria-label={aria} value={value} placeholder="0"
          onChange={(e) => onType(e.target.value)} onBlur={onClose}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }} />
      </label>
    );
  }
  return (
    <button type="button" className="lp-chip" aria-pressed={pressed} onClick={onOpen}>
      {label}<Pencil size={13} aria-hidden="true" />
    </button>
  );
}
