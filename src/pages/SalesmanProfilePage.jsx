import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock, LayoutDashboard, MapPin, ChevronRight, Radio, Share2, User, X, ShieldCheck } from 'lucide-react';
import { supabase, publicClient } from '../supabaseClient';
import { cdnImg, cdnSrcSet } from '../utils/img';
import { useSeeThrough, useFirstSeeThrough } from '../utils/seeThrough';
import { useHeroCarClip } from '../components/agent/useHeroCarClip';
import { coverObjectPosition } from '../utils/coverFocus';
import CarRing, { useRingCars, ringCarsFor } from '../components/agent/site/CarRing';
import { withTimeout } from '../config/marketplaceConfig';
import { carWarmProps } from '../utils/carPrefetch';
import ReviewsSection from '../components/reviews/ReviewsSection';
import { routeForProfile, isSellerRole, ROUTE_PROFILE_COLUMNS } from '../hooks/useRoleRedirect';
import { trackEvent } from '../utils/analytics';
import { captureRef, setRef } from '../utils/refTracking';
import { agentPageTitle, agentPageDescription, agentShareImage, agentCardVersion, agentNickname } from '../utils/agentSeo';
import { SITE_URL } from '../config/site';
import { useAgentTrust } from '../hooks/useAgentTrust';
import { replyTimeLabel, docsCheckedLine, termsLines, soldMonthLabel } from '../utils/agentTrust';
import ReportListingButton from '../components/ReportListingButton';
import { calcMonthly } from '../utils/financing';
import { sellerWaUrl, hasWhatsApp } from '../utils/sellerWhatsApp';
import { starterTodoKeys } from '../components/onboarding/StarterTasks';
import PageCalculator from '../components/agent/PageCalculator';
import PageNav from '../components/agent/PageNav';
import SiteStyle from '../components/agent/site/SiteStyle';
import PageLook from '../components/agent/site/PageLook';
import PromoBoard, { PromoTicker } from '../components/agent/site/PromoBoard';
import ModelPicker from '../components/agent/site/ModelPicker';
import DeliveryBlock from '../components/agent/site/DeliveryBlock';
import HandoverBlock from '../components/agent/site/HandoverBlock';
import StepsBlock from '../components/agent/site/StepsBlock';
import FaqBlock from '../components/agent/site/FaqBlock';
import BookBlock from '../components/agent/site/BookBlock';
import { heroFrame, heroFrameFor, HERO_DESK_MIN_W, withHeroFrame, heroImageUrl, heroPersonStyle, heroCarCandidates, heroCarStyle } from '../utils/heroFrame';
import { withSampleSite, cleanSite, visibleSections, activePromos, flowRows, SECTION_SPAN, rankMonth } from '../utils/pageSite';
import { hasStoredSession } from '../utils/panelCache';
import ErrorScreen from '../components/ErrorScreen';
import LeadAlertsStep from '../components/onboarding/LeadAlertsStep';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { pageAccent } from '../utils/pageAccent';
import { aboutFacts } from '../utils/agentAbout';
import { applyCarOrder, brandFromParam, orderedBrands, brandName } from '../utils/liveMaths';

// Seller-only, so buyers never download it.
const LivePresenter = lazy(() => import('../components/live/LivePresenter'));

const fmt = (n) => Number(n).toLocaleString('en-MY');

// Owner-only setup nudge: closing it dismisses only the CURRENT next step —
// stored against that step's key, not a flat yes/no. So closing "Add a
// profile photo" and later actually adding one clears the photo step out of
// setupTodo, the stored key stops matching the new next step, and the nudge
// comes back for whatever's next. Closing it is never "gone for good" while
// something real is still missing.
const SETUP_TODO = {
  listing: { key: 'listing', label: 'List your first car', tab: 'listings' },
  photo: { key: 'photo', label: 'Add a profile photo', tab: 'settings' },
  bio: { key: 'bio', label: 'Write a short bio', tab: 'settings' },
};
const setupDismissKey = (uid) => `sp_setup_dismissed_${uid}`;

// Light-surface tokens (DESIGN.md) for the shared components on this page.
const LIGHT_REVIEW_TH = {
  text: '#111827', textSec: '#4b5563', textMuted: '#6b7280',
  border: 'rgba(0,0,0,0.08)', borderSec: 'rgba(0,0,0,0.06)',
  card: '#ffffff', inputBg: '#ffffff',
};
// The report sheet is a modal over a dimmed page, so its card must be opaque.
const LIGHT_SHEET_TH = { ...LIGHT_REVIEW_TH, card2: '#F0EEE8', inputBorder: 'rgba(0,0,0,0.12)' };

// Owner controls over the cover (Dashboard, Live presentation). Solid dark at
// 0.78 like every photo overlay on the marketplace: no blur, no pill.
const ownerChip = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(15,17,21,0.78)',
  border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, fontWeight: 600, lineHeight: 1.2,
  color: '#fff', textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit',
};

// Same one-line estimate as the marketplace cards (calcMonthly: 90% loan,
// 7 years, DEFAULT_EIR). null above the high-value threshold -> not shown.
function MonthlyLine({ price, from = false }) {
  const m = calcMonthly(Number(price));
  if (!m) return null;
  return (
    <span className="ap-mo">{from ? 'from' : 'est.'} <b>RM {fmt(m)}/mo</b></span>
  );
}

// Social marks: icon-only circles beside the one primary button.
const SOCIAL_ICONS = {
  instagram: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>,
  tiktok: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>,
  facebook: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v7h4v-7h3l.5-4h-3.5V9c0-.6.4-1 1-1z"/></svg>,
  website: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>,
};
const WA_ICON = <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.2z"/></svg>;

// Device copy of the PUBLIC page (what get_salesman_by_slug and the public car
// view return to anyone; no number is in it, CDP-3). A buyer coming back from a
// car sees the page at once, and the fresh read replaces it a moment later.
const AGENT_CACHE_PREFIX = 'xd_agent_page_v1:';
const AGENT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
function readAgentCache(slug) {
  try {
    const raw = localStorage.getItem(AGENT_CACHE_PREFIX + slug);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c?.profile || Date.now() - (c.at || 0) > AGENT_CACHE_TTL) return null;
    return { profile: c.profile, dealer: c.dealer || null, listings: c.listings || [], soldCount: c.soldCount || 0 };
  } catch { return null; }
}
function writeAgentCache(slug, data) {
  try { localStorage.setItem(AGENT_CACHE_PREFIX + slug, JSON.stringify({ ...data, at: Date.now() })); } catch { /* full or blocked */ }
}
function clearAgentCache(slug) {
  try { localStorage.removeItem(AGENT_CACHE_PREFIX + slug); } catch { /* blocked */ }
}

// Device copy of WHO IS LOOKING (the signed-in viewer's own id, home link and
// number), so Dashboard + Live presentation paint on the first frame instead
// of after getSession and a profiles read. Only seeded while this device holds
// a session, re-checked against the live session, purged on sign-out
// (PANEL_DATA_CACHE_PREFIXES in src/utils/panelCache.js).
const VIEWER_CACHE_KEY = 'ap_viewer_v1';
// The most a signed-in owner's first visit holds the loader for its buttons.
const VIEWER_WAIT_MS = 2000;
function readViewerCache() {
  if (!hasStoredSession()) return null;
  try {
    const v = JSON.parse(localStorage.getItem(VIEWER_CACHE_KEY) || 'null');
    return v?.id && v?.home ? v : null;
  } catch { return null; }
}
function writeViewerCache(v) {
  try {
    if (v) localStorage.setItem(VIEWER_CACHE_KEY, JSON.stringify(v));
    else localStorage.removeItem(VIEWER_CACHE_KEY);
  } catch { /* full or blocked */ }
}

// First-visit loader (owner, 2026-10-21: "preparing your ... gamify it a
// little"). Only shows until the agent is known, usually under a second; the
// cars then fill in on the real page. The bar eases toward 90% and never
// claims done: it is a feeling of progress, not a measurement.
const LOADER_STEPS = ['Unlocking the showroom', 'Washing the cars', 'Lining them up', 'Checking today\'s prices', 'Opening the doors'];
function ShowroomLoader({ slug }) {
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setStep((n) => Math.min(n + 1, LOADER_STEPS.length - 1)), 700);
    const s = setTimeout(() => setSlow(true), 12000);
    return () => { clearInterval(t); clearTimeout(s); };
  }, []);
  const pct = Math.round(90 * (1 - Math.pow(0.55, step + 1)));
  return (
    <div role="status" aria-live="polite" style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', fontFamily: 'var(--xd-font-body)', textAlign: 'center' }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', margin: '0 0 10px' }}>
        Preparing @{slug}&apos;s showroom
      </p>
      <p key={step} className="ap-load-step" style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: '0 0 18px', minHeight: 24 }}>
        {LOADER_STEPS[step]}…
      </p>
      <div style={{ width: 'min(240px, 70vw)', height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <div className="ap-load-bar" style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: '#dc2626' }} />
      </div>
      {slow && (
        <p style={{ fontSize: 13, color: '#6b7280', margin: '18px 0 0', lineHeight: 1.5 }}>
          Taking longer than usual.{' '}
          <button type="button" onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', padding: 0, color: '#dc2626', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
            Try again
          </button>
        </p>
      )}
      <style>{`
        .ap-load-step { animation: ap-step-in .3s ease-out; }
        .ap-load-bar { transition: width .6s cubic-bezier(.22,1,.36,1); }
        @keyframes ap-step-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .ap-load-step { animation: none; } .ap-load-bar { transition: none; } }
      `}</style>
    </div>
  );
}

// One car card, per docs/mockups/agent-page-light.html. Deliberately not
// ShowroomCard: that one carries an "Agent/Dealer" chip (meaningless on the
// agent's own page) and its own WhatsApp gate, which would compete with this
// page's single contact button. "#N" is the live-presentation number.
function AgentCarCard({ car, num, onClick, refSlug }) {
  const imgs = Array.isArray(car.images) ? car.images.filter(Boolean) : [];
  const cond = car.condition ? car.condition.charAt(0).toUpperCase() + car.condition.slice(1) : null;
  return (
    <Link to={`/showroom/${car.slug || car.id}${refSlug ? `?ref=${encodeURIComponent(refSlug)}` : ''}`} {...carWarmProps(car)} onClick={onClick} className="ap-card ap-car">
      <div className="ap-ph">
        {imgs[0]
          ? <img src={cdnImg(imgs[0], 480, 72)} srcSet={cdnSrcSet(imgs[0], [320, 480, 640], 72)}
              sizes="(max-width: 640px) 50vw, 360px" decoding="async"
              alt={[car.year, car.brand, car.model].filter(Boolean).join(' ')} loading="lazy" />
          : <span className="ap-nophoto">No photo</span>}
        <span className="ap-ov ap-tl">#{num}{cond ? ` · ${cond}` : ''}</span>
        {imgs.length > 1 && <span className="ap-ov ap-br">{imgs.length} photos</span>}
      </div>
      <div className="ap-cb">
        <p className="ap-cn">{[car.year, car.brand, car.model, car.variant].filter(Boolean).join(' ')}</p>
        <p className="ap-cs">
          {[car.mileage ? `${fmt(car.mileage)} km` : null, car.transmission, car.state].filter(Boolean).map((t) => <span key={t}>{t}</span>)}
        </p>
        <div className="ap-pr">
          <div>
            {/* A new-car card (is_model_card) is priced at its cheapest variant. */}
            <b>{car.selling_price > 0 ? `${car.is_model_card ? 'From ' : ''}RM ${fmt(car.selling_price)}` : 'Price on request'}</b>
            <MonthlyLine price={car.selling_price} from={!!car.is_model_card} />
          </div>
          <span className="ap-st"><i style={{ background: car.status === 'reserved' ? '#b45309' : '#15803d' }} />{car.status === 'reserved' ? 'Reserved' : 'Available'}</span>
        </div>
      </div>
    </Link>
  );
}

// The hero's place chip, as typed by the seller but tidied for display only: stray spaces and
// commas dropped, an all-lowercase word capitalised ("Wilayah persekutuan ," -> "Wilayah Persekutuan").
function tidyPlace(...parts) {
  return parts
    .map((p) => String(p || '').replace(/[\s,]+$/, '').replace(/^[\s,]+/, '').replace(/\s+/g, ' '))
    .filter(Boolean)
    .map((p) => p.split(' ').map((w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' '))
    .join(', ');
}

export default function SalesmanProfilePage() {
  const { slug } = useParams();
  const heroPreviewMode = typeof window !== 'undefined' && window.parent !== window
    && new URLSearchParams(window.location.search).get('heroPreview') === '1';
  const navigate = useNavigate();
  // Back = wherever the visitor was before this page. With no in-app history
  // (history.state.idx 0) a buyer from a TikTok / WhatsApp link goes to the
  // marketplace, but a signed-in SELLER goes to their own dashboard: the
  // panels open this page in a new tab, so for them "no history" means "came
  // from the dashboard" (owner, 2026-10-18: Back dumped them on the marketplace).
  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else if (viewerHome?.seller) navigate(viewerHome.to);
    else navigate('/');
  };
  // Share: the phone's own share sheet (WhatsApp, Telegram...), which posts the
  // link and lets the app fetch the preview (cover + face, api/agent-card.js).
  // No share sheet (most desktops): copy the link instead.
  // src=share: visits from it count as "Shared link" on the Premium dashboard.
  // v: changes when the preview card does, so WhatsApp fetches the new card
  // instead of the copy it saved for the old link.
  const [shareCopied, setShareCopied] = useState(false);
  const sharePage = async () => {
    const url = `${SITE_URL}/s/${encodeURIComponent(profile?.slug || slug)}?src=share&v=${agentCardVersion(profile)}`;
    trackEvent(supabase, 'share', { salesman_slug: profile?.slug || slug, metadata: { source: 'minipage' } });
    if (navigator.share) {
      try { await navigator.share({ title: profile?.full_name || undefined, url }); } catch { /* closed the sheet */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { window.prompt('Copy this link', url); }
  };
  // A repeat visit paints from the device copy at once and refreshes behind it.
  const [seed] = useState(() => readAgentCache(slug));
  const [profile, setProfile] = useState(seed?.profile || null);
  const [dealer, setDealer] = useState(seed?.dealer || null);
  const [listings, setListings] = useState(seed?.listings || []);
  const [soldCount, setSoldCount] = useState(seed?.soldCount || 0);
  // True until the CARS are in. The page itself renders as soon as the agent
  // is known; only the car grid waits (skeleton cards, never "No cars").
  const [loading, setLoading] = useState(!seed);
  const [notFound, setNotFound] = useState(false);
  // Every retry failed and there is no saved copy to show: say so, with a
  // Try again, rather than a loader that never ends (ERR-1).
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [bioExpanded, setBioExpanded] = useState(false);
  const bioRef = useRef(null);
  const [bioOverflows, setBioOverflows] = useState(false);
  const [viewerSeed] = useState(readViewerCache);
  const [viewerHome, setViewerHome] = useState(viewerSeed?.home || null);
  // False only while a signed-in device with no viewer copy is still finding
  // out who it is. The loader waits on it (at most VIEWER_WAIT_MS) so the page
  // opens with its Dashboard / Live buttons already there. A signed-out buyer
  // never waits: there is nothing to look up.
  const [viewerReady, setViewerReady] = useState(() => !!viewerSeed || !hasStoredSession());
  // Who is looking. Only ever compared against the profile's own id, to decide
  // whether the "finish your page" note renders — it must never be shown to a
  // buyer sitting on someone else's page.
  const [viewerId, setViewerId] = useState(viewerSeed?.id || null);
  // The viewer's OWN number, read from their own row. The public page no longer
  // carries the seller's number (CDP-3), but the presenter shows it to its owner.
  const [viewerPhone, setViewerPhone] = useState(viewerSeed?.phone || null);
  // Fire the mini-page visit exactly once per mount (StrictMode double-invokes).
  const visitTracked = useRef(false);
  // Live presentation (owner only) and the car it is showing right now. The
  // presenter writes that car via set_live_listing; this page reads it back by
  // slug for every visitor, so a viewer arriving from a TikTok bio link sees
  // the car on screen pinned at the top. See src/components/live/LivePresenter.jsx.
  const [presenting, setPresenting] = useState(false);
  // PUSH-ONBOARD: the lead-alerts ask in front of Live presentation.
  const [alertsGate, setAlertsGate] = useState(false);
  // Why Live cannot open yet ('pending' | 'empty'): the presenter shows the
  // cars on this page, and a car waiting for review is not on it.
  const [liveBlock, setLiveBlock] = useState(null);
  const [liveListingId, setLiveListingId] = useState(null);
  // Newest (the query order, which is also the #N order) or cheapest first.
  const [sortBy, setSortBy] = useState('newest');
  // PAGE-BRAND (owner, 2026-11-23): ?brand=proton = a Proton-only page, the link a
  // seller sends Proton buyers so other models never confuse them. Without it, a
  // seller with 2+ brands gets brand tabs and the cars grouped brand by brand.
  const [brandParam] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('brand') || ''; } catch { return ''; }
  });
  const [brandTab, setBrandTab] = useState('all');
  // Review tally handed up by ReviewsSection (onSummary) for the stats row, so
  // the page does not query reviews a second time.
  const [reviewSummary, setReviewSummary] = useState(null);

  // Detect the arrival platform (Instagram/Facebook/TikTok/WhatsApp… via the
  // in-app browser UA or referrer) and stash it so every footprint we log below
  // carries a channel. Runs first, before any trackEvent fires.
  useEffect(() => { captureRef(); setRef(slug); }, [slug]);

  // A card tap is a footprint even though it navigates away — fire-and-forget so
  // navigation isn't blocked. Slug-keyed so it lands in the agent's own analytics;
  // dealer_id lets the parent dealer see it too.
  const trackCardClick = (car) => {
    if (!car) return;
    trackEvent(supabase, 'minipage_card_click', {
      car_id: car.id,
      car_name: [car.year, car.brand, car.model, car.variant].filter(Boolean).join(' '),
      dealer_id: car.dealer_id || profile?.dealer_id || profile?.id || null,
      salesman_slug: slug,
      metadata: { source: liveListingId ? 'minipage_live' : 'minipage_card' },
    });
  };

  // If the visitor is logged in, surface a quick way back to their own home —
  // most useful when a salesman previews their own mini page and would
  // otherwise have no way back without hitting the browser's back button.
  //
  // This button said "Dashboard" to EVERYONE, buyers included, and a shopper
  // sitting on a seller's page pressed it, exactly as the wording invited. It
  // now words itself the way the two headers already do.
  //
  // dealer_id and plan are selected because a standalone salesman's home is
  // /salesman-lite or /salesman-premium, which the role alone cannot say.
  useEffect(() => {
    let cancelled = false;
    const ready = () => { if (!cancelled) setViewerReady(true); };
    const cap = setTimeout(ready, VIEWER_WAIT_MS);
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data?.session?.user?.id;
      if (cancelled) return;
      if (!uid) {
        // Signed out since the copy was saved: take the buttons back down.
        writeViewerCache(null);
        setViewerId(null); setViewerHome(null); setViewerPhone(null);
        ready();
        return;
      }
      setViewerId(uid);
      const { data: viewer } = await supabase
        .from('profiles').select(`${ROUTE_PROFILE_COLUMNS}, whatsapp_number, phone`).eq('id', uid).maybeSingle();
      if (cancelled) return;
      if (!viewer?.role) { ready(); return; }
      const phone = viewer.whatsapp_number || viewer.phone || null;
      const home = {
        to: routeForProfile(viewer),
        label: isSellerRole(viewer.role) ? 'Dashboard' : 'My Account',
        seller: isSellerRole(viewer.role),
      };
      setViewerPhone(phone);
      setViewerHome(home);
      writeViewerCache({ id: uid, home, phone });
      ready();
    }).catch(ready);
    return () => { cancelled = true; clearTimeout(cap); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);

    // Moving from one agent's page to another: show the new agent's device
    // copy (or the loader), never the previous agent.
    const c = readAgentCache(slug);
    if (c && c.profile?.slug !== profile?.slug) {
      setProfile(c.profile); setDealer(c.dealer); setListings(c.listings); setSoldCount(c.soldCount); setLoading(false);
    } else if (!c && profile && profile.slug !== slug) {
      setProfile(null); setDealer(null); setListings([]); setSoldCount(0); setLoading(true);
    }

    // Look up the agent, retrying on transient RPC failures. A mobile tab woken
    // from the background re-mounts this page and fires the RPC while the
    // network is still coming back — a FAILED request must not be shown as
    // "Agent not found". That verdict is only correct for a clean lookup that
    // returns no row. Retry a few times before giving up; a manual refresh used
    // to be the only way out of the false not-found.
    async function load(attempt = 0) {
      // publicClient: a stale login on this phone must not hold up a public page.
      let p = null, error = null;
      try {
        ({ data: p, error } = await withTimeout(
          publicClient.rpc('get_salesman_by_slug', { p_slug: slug }).maybeSingle(), 10000));
      } catch (e) { error = e; }
      if (cancelled) return;

      if (error) {
        if (attempt < 3) {
          setTimeout(() => { if (!cancelled) load(attempt + 1); }, 1000 * (attempt + 1));
        } else if (!c) {
          // Never a wrong "not found". With a saved copy on screen, keep it.
          setLoadError(true);
        }
        return;
      }

      if (!p) { clearAgentCache(slug); setNotFound(true); setLoading(false); return; }
      setProfile(p);

      // Log the mini-page visit (footprint). Keyed on the agent's slug so it
      // shows in their own dashboard; dealer_id so the parent dealer sees it.
      if (!visitTracked.current && !heroPreviewMode) {
        visitTracked.current = true;
        trackEvent(supabase, 'minipage_view', {
          salesman_slug: slug,
          dealer_id: p.dealer_id || p.id,
          ...(brandParam ? { metadata: { brand: brandParam.toLowerCase().slice(0, 40) } } : {}),
        });
      }

      const [ownedRes, assignedRes, featuredRes, soldStatsRes, dealerRes] = await Promise.all([
        publicClient.from('public_car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour,dealer_id,docs_verified,condition,state,status,is_model_card,engine_cc')
          .eq('dealer_id', p.id).in('status', ['available', 'reserved']).order('created_at', { ascending: false }),
        publicClient.from('public_car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour,dealer_id,docs_verified,condition,state,status,is_model_card,engine_cc')
          .eq('assigned_to', p.id).in('status', ['available', 'reserved']).order('created_at', { ascending: false }),
        // Linked salesmen feature dealer cars via salesman_listings (car stays
        // owned by the dealer, assigned_to null) — the two queries above miss
        // those, so pull them via a SECURITY DEFINER RPC.
        publicClient.rpc('get_salesman_featured_listings', { p_salesman_id: p.id }),
        // Sold count comes from seller_public_stats — the SAME source the
        // marketplace card reads as public_car_listings.seller_sold_count.
        // This used to be two counts (dealer_id + assigned_to) added together,
        // which double-counted every car where the seller is BOTH owner and
        // assignee (14 of 26 sold cars live), so the mini page claimed roughly
        // twice what the card showed for the same seller. The view does a
        // count(DISTINCT listing_id) over the union, so it cannot double-count.
        publicClient.from('seller_public_stats').select('sold_count').eq('seller_id', p.id).maybeSingle(),
        // In the same round as the cars: it used to be a third wait after them.
        p.dealer_id
          ? publicClient.rpc('get_dealer_profile_by_id', { p_dealer_id: p.dealer_id }).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setDealer(dealerRes.data || null);

      const seen = new Set();
      const lst = [...(ownedRes.data || []), ...(assignedRes.data || []), ...(featuredRes.data || [])].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      // PIN-1: the seller's pinned cars (up to 4, Premium page only) come first, in the order they pinned
      // them. Its own call: a slow or missing function just leaves the usual order.
      if (!p.page_basic) {
        try {
          const pr = await withTimeout(publicClient.rpc('get_agent_pins', { p_slug: slug }), 6000);
          const pins = !pr?.error && Array.isArray(pr?.data) ? pr.data : [];
          if (pins.length) {
            const rank = (id) => { const i = pins.indexOf(id); return i === -1 ? 999 : i; };
            lst.sort((a, b) => rank(a.id) - rank(b.id)); // stable: everything else keeps its order
          }
        } catch { /* keep the default order */ }
        if (cancelled) return;
      }
      // LIVE-ORDER: the seller's own arrangement of their "#N" numbers (set in the
      // Live presenter), applied last. Its own call: a slow or missing function
      // just leaves the order above.
      try {
        const or = await withTimeout(publicClient.rpc('get_agent_car_order', { p_slug: slug }), 6000);
        if (!or?.error && Array.isArray(or?.data) && or.data.length) {
          const sorted = applyCarOrder(lst, or.data);
          lst.splice(0, lst.length, ...sorted);
        }
      } catch { /* keep the order above */ }
      if (cancelled) return;

      const sold = Number(soldStatsRes.data?.sold_count) || 0;
      setSoldCount(sold);
      setListings(lst);
      setLoading(false);
      // A failed car read must not overwrite a good copy with an empty list.
      if (!ownedRes.error && !assignedRes.error) {
        writeAgentCache(slug, { profile: p, dealer: dealerRes.data || null, listings: lst, soldCount: sold });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug, retryKey]);

  // Trust signals (measured reply time, recently sold, the agent's own terms).
  // Above the early returns: hooks cannot sit below a conditional return.
  const trust = useAgentTrust(profile?.id);
  const replyLabel = replyTimeLabel(trust.reply);
  const terms = termsLines(trust.seller);
  const docsLine = docsCheckedLine(listings);

  // PAGE-PRO 2: the "About me" answers (get_agent_about). Premium pages only;
  // null on a Lite page, and null before migration 20261101a is applied (the
  // call fails quietly and the page just leaves those lines out).
  const [about, setAbout] = useState(null);
  useEffect(() => {
    if (!slug || !profile?.id || profile.page_basic) { setAbout(null); return undefined; }
    let alive = true;
    withTimeout(publicClient.rpc('get_agent_about', { p_slug: slug }).maybeSingle(), 8000)
      .then((res) => { if (alive) setAbout(res?.error ? null : (res?.data || null)); })
      .catch(() => { /* a slow DB just means no About facts this time */ });
    return () => { alive = false; };
  }, [slug, profile?.id, profile?.page_basic]);

  // NICKNAME-1: the seller's social media name (get_agent_nickname), every plan. Its own call, so a missing
  // function (database change not applied yet) or a slow database just means no "@name" this time.
  const [nickname, setNickname] = useState('');
  // PAGE-HERO: the seller's hero photo, its own call (like get_agent_about) so a
  // missing function before tonight's migration just leaves the profile photo.
  const [heroUrl, setHeroUrl] = useState(null);
  useEffect(() => {
    if (!slug || !profile?.id || profile.page_basic) { setHeroUrl(null); return undefined; }
    let off = false;
    withTimeout(publicClient.rpc('get_agent_hero', { p_slug: slug }), 8000)
      .then((r) => { if (!off) setHeroUrl(!r?.error && typeof r?.data === 'string' ? r.data : null); })
      .catch(() => { if (!off) setHeroUrl(null); });
    return () => { off = true; };
  }, [slug, profile?.id, profile?.page_basic]);
  // PAGE-SITE 2: the seller's promos, delivery towns and section order (get_agent_site),
  // its own call like get_agent_hero: before the migration is applied, or when the
  // database is slow, the page simply shows its default sections.
  const [siteRaw, setSiteRaw] = useState(null);
  // The model picker's "Work out my instalment": the calculator opens on THAT model at THAT variant's price.
  const [calcFocus, setCalcFocus] = useState(null);
  const openCalc = (pick) => {
    setCalcFocus({ ...pick, n: Date.now() });
    setTimeout(() => document.getElementById('ap-calc')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  useEffect(() => {
    if (!slug || !profile?.id || profile.page_basic) { setSiteRaw(null); return undefined; }
    let off = false;
    withTimeout(publicClient.rpc('get_agent_site', { p_slug: slug }), 8000)
      .then((r) => { if (!off) setSiteRaw(!r?.error && r?.data && typeof r.data === 'object' ? r.data : null); })
      .catch(() => { if (!off) setSiteRaw(null); });
    return () => { off = true; };
  }, [slug, profile?.id, profile?.page_basic]);
  // PAGE-SITE 3: the seller's handover photos (each with a recorded buyer consent), own call too.
  const [handoverPhotos, setHandoverPhotos] = useState([]);
  useEffect(() => {
    if (!slug || !profile?.id || profile.page_basic) { setHandoverPhotos([]); return undefined; }
    let off = false;
    withTimeout(publicClient.rpc('get_agent_handover_photos', { p_slug: slug }), 8000)
      .then((r) => { if (!off) setHandoverPhotos(!r?.error && Array.isArray(r?.data) ? r.data : []); })
      .catch(() => { if (!off) setHandoverPhotos([]); });
    return () => { off = true; };
  }, [slug, profile?.id, profile?.page_basic]);
  // A .png/.webp name is not proof of see-through (stock new-car photos are
  // .webp on white): read the pixels. The car stands in front of the seller
  // only when the seller is a cut-out too; in front of a framed photo it crowds.
  // HERO-PREVIEW (owner, 2026-11-26: "the preview in dashboard gets the same result it would on the
  // page"): Premium Settings shows THIS page in a frame (`?heroPreview=1`) at a real phone / desktop
  // width and posts the unsaved photo + settings here. Only a parent on our own origin is listened to;
  // the frame shows the buyer's view (no owner buttons) and logs no visit.
  const [heroOverride, setHeroOverride] = useState(null); // { url, cut }
  useEffect(() => {
    if (!heroPreviewMode) return undefined;
    const on = (e) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const d = e.data;
      if (d?.type !== 'xd-hero-preview') return;
      const u = typeof d.url === 'string' && /^(blob:|https:)/.test(d.url) ? d.url : null;
      setHeroOverride(u ? { url: withHeroFrame(u, d.frame || {}), cut: !!d.cut } : null);
    };
    window.addEventListener('message', on);
    window.parent.postMessage({ type: 'xd-hero-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', on);
  }, []);
  const heroUrlShown = heroOverride ? heroOverride.url : heroUrl;
  // PAGE-HERO 2: size, position and which car (or none) ride on the hero URL (src/utils/heroFrame.js).
  // HERO-DESK: desktop has its own size / position / car size (phone's when never set).
  const [heroDesk, setHeroDesk] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(`(min-width: ${HERO_DESK_MIN_W}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(`(min-width: ${HERO_DESK_MIN_W}px)`);
    if (!mq) return undefined;
    const on = () => setHeroDesk(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  const heroFrameSet = heroFrameFor(heroFrame(heroUrlShown), heroDesk);
  const heroImgUrl = heroUrlShown ? heroImageUrl(heroUrlShown) : (profile?.avatar_url || null);
  const heroCutChecked = useSeeThrough(profile && !profile.page_basic && !heroOverride ? heroImgUrl : null);
  const heroCutState = heroOverride ? heroOverride.cut : heroCutChecked;
  const ringAll = useRingCars(profile && !profile.page_basic && heroFrameSet.layout === 'card' ? listings : null);
  const ringCars = useMemo(() => (ringAll ? ringCarsFor(ringAll, heroFrameSet.ringBrand) : null), [ringAll, heroFrameSet.ringBrand]);
  const heroCarUrl = useFirstSeeThrough(heroCutState === true ? heroCarCandidates(listings, heroFrameSet) : []);
  // HERO-CLIP: the seller's photo ends at the car's tyres (nothing of them shows under the car).
  const heroMeRef = useRef(null);
  const heroCarRef = useRef(null);
  const heroClip = useHeroCarClip(heroMeRef, heroCarRef, heroCarUrl,
    [heroImgUrl, heroFrameSet.size, heroFrameSet.x, heroFrameSet.y, heroFrameSet.carSize, heroFrameSet.layout]);

  useEffect(() => {
    if (!slug || !profile?.id) { setNickname(''); return undefined; }
    let alive = true;
    withTimeout(publicClient.rpc('get_agent_nickname', { p_slug: slug }), 8000)
      .then((res) => { if (alive) setNickname(!res?.error && typeof res?.data === 'string' ? res.data : ''); })
      .catch(() => { /* no @name this time */ });
    return () => { alive = false; };
  }, [slug, profile?.id]);

  useEffect(() => {
    if (bioRef.current) {
      setBioOverflows(bioRef.current.scrollHeight > bioRef.current.clientHeight + 2);
    }
  }, [profile?.bio, bioExpanded]);

  // Poll rather than subscribe: the state lives in a no-policy table that only
  // SECURITY DEFINER functions read, so anon cannot use realtime on it. 15s
  // while the seller IS live (the car changes as they talk), 2 min while they
  // are not: almost every visit is the second case, and polling it every 15s
  // was the 4th most-called request on the free database (2026-10-19). A
  // missing function (migration not applied yet) just means no banner.
  useEffect(() => {
    if (!profile?.id) return undefined;
    let cancelled = false;
    let timer = null;
    const schedule = (live) => {
      clearTimeout(timer);
      if (!cancelled) timer = setTimeout(check, live ? 15000 : 120000);
    };
    function check() {
      if (document.visibilityState !== 'visible') return;
      publicClient.rpc('get_salesman_live', { p_slug: slug }).then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setLiveListingId(data || null);
        schedule(!error && !!data);
      }, () => schedule(false));
    }
    check();
    document.addEventListener('visibilitychange', check);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', check); };
  }, [profile?.id, slug]);

  // The number is never in this page (CDP-3): /api/wa resolves it on tap.
  const hasWa = hasWhatsApp(profile) && !!profile?.slug;
  const firstName = (profile?.full_name || 'Agent').split(' ')[0];
  const waMessage = `Hi ${firstName}, I came across your listings on DrevoOS and would like to know more.`;
  const waHref = hasWa ? sellerWaUrl({ slug: profile.slug, text: waMessage }) : null;
  const isVerified = !!(profile?.is_verified);

  // The car the seller is showing on their live right now, if any. Numbers are
  // positions in `listings` — the same array, same order, the presenter uses —
  // so "#3" on the stream is "#3" here.
  const liveIdx = liveListingId ? listings.findIndex((c) => c.id === liveListingId) : -1;
  const liveCar = liveIdx >= 0 ? listings[liveIdx] : null;
  // Slug only: the viewer is messaging THIS agent about the car on their live.
  const liveWaHref = hasWa && liveCar
    ? sellerWaUrl({ slug: profile.slug,
        text: `Hi ${firstName}, I'm watching your live. Interested in #${liveIdx + 1}, the ${[liveCar.year, liveCar.brand, liveCar.model].filter(Boolean).join(' ')}.` })
    : null;
  const trackLiveWhatsApp = () => {
    if (!liveCar) return;
    trackEvent(supabase, 'whatsapp_click', {
      car_id: liveCar.id,
      dealer_id: liveCar.dealer_id || profile?.dealer_id || profile?.id || null,
      salesman_slug: slug,
      metadata: { source: 'minipage_live' },
    });
  };
  const locationCity = profile?.city || dealer?.city;
  const locationState = profile?.state || dealer?.state;
  const locationStr = [locationCity, locationState].filter(Boolean).join(', ');

  // A new seller's page is reachable the moment they have a slug (the RPC stops
  // hiding them while they wait on review — 20260912c), so the first thing many
  // of them ever see of it is an empty shell. This is the nudge that turns that
  // shell into a to-do list, and it renders for the OWNER ONLY: a buyer must
  // never be told what the seller hasn't filled in.
  // Ordered by what actually earns them a buyer — a car first, decoration after.
  const isOwner = !heroPreviewMode && !!viewerId && !!profile && viewerId === profile.id;
  const [showSamples, setShowSamples] = useState(true);
  // LIVE-ORDER: the seller arranged their "#N" numbers in the Live presenter. The
  // page (and so the presenter, the Live now card and every viewer's page) takes
  // the new order at once; the account saves it. A failed save puts it back.
  const saveCarOrder = async (ids) => {
    const before = listings;
    const next = applyCarOrder(before, ids);
    setListings(next);
    try {
      const { data, error } = await withTimeout(supabase.rpc('set_my_car_order', { p_ids: next.map((c) => c.id) }), 8000);
      if (error || !data?.ok) throw new Error('not saved');
    } catch {
      setListings(before);
      return false;
    }
    writeAgentCache(slug, { profile, dealer, listings: next, soldCount });
    return true;
  };
  // PUSH-ONBOARD (owner, 2026-10-31): sellers mostly use Live, and viewers
  // WhatsApp, chat and book during and after it, so the alerts ask sits in
  // front of it, ONCE A DAY per device until alerts are on. Its button closes
  // the ask and opens the presenter at once; the result comes back as a toast
  // (LeadAlertsStep), so it never keeps a seller from their live.
  const ownerPush = usePushNotifications(isOwner ? viewerId : null);
  const todayMy = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const alertsNeeded = () => {
    if (!isOwner || !ownerPush.configured || ownerPush.subscribed) return false;
    try { return localStorage.getItem('xd_live_alerts_day') !== todayMy(); } catch { return true; }
  };
  const startPresenting = () => { setAlertsGate(false); setLiveBlock(null); setPresenting(true); };
  const openLive = async () => {
    if (listings.length > 0) {
      if (alertsNeeded()) {
        try { localStorage.setItem('xd_live_alerts_day', todayMy()); } catch { /* private mode */ }
        setAlertsGate(true);
        return;
      }
      startPresenting();
      return;
    }
    // The owner can read their own rows (RLS), so we can say WHY it is empty.
    const { count } = await supabase.from('car_listings').select('id', { count: 'exact', head: true })
      .eq('dealer_id', viewerId).eq('status', 'pending_approval');
    setLiveBlock(count > 0 ? 'pending' : 'empty');
  };
  // `?live=1` opens Live straight away: the Lite dashboard's "Loan
  // calculator" button lands here, so a new seller does not have to find the
  // Live chip first. Owner only (a buyer with the link just sees the page),
  // once per page load, and the param is dropped so a refresh or Back does
  // not reopen it.
  const liveParamDone = useRef(false);
  useEffect(() => {
    if (liveParamDone.current || loading || !isOwner) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('live') !== '1') return;
    liveParamDone.current = true;
    params.delete('live');
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
    openLive();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isOwner]);
  // Reads the dashboard checklist's own list (StarterTasks), so the page and
  // the dashboard never ask for different things. It used to keep a second
  // list here (car, photo, banner, bio) that disagreed with the dashboard's.
  // A Lite page is the basic page (get_salesman_by_slug.page_basic): its list
  // has no photo or bio step, so it only ever asks for a car.
  const setupTodo = !isOwner ? [] : starterTodoKeys({
    profile, listingCount: listings.length, premium: !profile.page_basic, noBio: !!profile.page_basic,
  }).map((key) => SETUP_TODO[key]).filter(Boolean);
  // viewerHome.to is whichever panel their role resolves to (/salesman-lite,
  // /salesman-premium, /salesman) — both panels take an optional :tab segment.
  // It lands one await LATER than viewerId, so the note waits for it rather
  // than guessing a panel and sending a Premium seller to the Lite one.
  const setupHref = setupTodo.length && viewerHome
    ? `${viewerHome.to}/${setupTodo[0].tab}`
    : null;

  // Was a static row wedged between the banner and the avatar — inserting
  // anything there risked stranding the avatar (see the wrapper's own
  // comment below), and it read as part of the page rather than a nudge.
  // Now a fixed, slide-down strip over the top of the page, closeable
  // per-step (see setupDismissKey above).
  const nextTodoKey = setupTodo[0]?.key || null;
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [setupSlideIn, setSetupSlideIn] = useState(false);
  useEffect(() => {
    if (!isOwner || !profile?.id || !nextTodoKey) { setSetupDismissed(false); return; }
    try {
      setSetupDismissed(localStorage.getItem(setupDismissKey(profile.id)) === nextTodoKey);
    } catch {
      setSetupDismissed(false);
    }
  }, [isOwner, profile?.id, nextTodoKey]);
  useEffect(() => {
    if (!isOwner || !nextTodoKey || setupDismissed) { setSetupSlideIn(false); return undefined; }
    const t = setTimeout(() => setSetupSlideIn(true), 60);
    return () => clearTimeout(t);
  }, [isOwner, nextTodoKey, setupDismissed]);
  const dismissSetupNudge = () => {
    setSetupSlideIn(false);
    setTimeout(() => {
      setSetupDismissed(true);
      try { if (profile?.id && nextTodoKey) localStorage.setItem(setupDismissKey(profile.id), nextTodoKey); } catch { /* ignore */ }
    }, 240);
  };

  // Title + description from agentSeo.js, the same functions the crawler
  // render (api/og.js) and the Premium settings preview run, so Google, a
  // WhatsApp link preview and the agent's own preview never disagree.
  const seoProfile = { ...profile, nickname };
  const metaDescription = agentPageDescription(seoProfile, listings.length, listings);
  const pageTitle = agentPageTitle(seoProfile, listings);

  // "#N" is fixed to the query order (newest first), the same array the live
  // presenter walks, so re-sorting by price never renumbers a car mid-live.
  const numById = new Map(listings.map((c, i) => [c.id, i + 1]));
  const sortedListings = sortBy === 'price'
    ? [...listings].sort((a, b) => (Number(a.selling_price) || Infinity) - (Number(b.selling_price) || Infinity))
    : listings;
  // PAGE-BRAND: a one-brand link locks the page to that brand (a wrong brand in the
  // link shows the whole page); otherwise the tab picks. "#N" never changes.
  const pageBrands = orderedBrands(listings, []);
  const lockedBrand = brandFromParam(listings, brandParam);
  const pickedBrand = lockedBrand || (brandTab !== 'all' && pageBrands.includes(brandTab) ? brandTab : null);
  const shownListings = pickedBrand ? sortedListings.filter((c) => brandName(c) === pickedBrand) : sortedListings;
  const showBrandTabs = !lockedBrand && pageBrands.length > 1;
  // All brands on show: one block per brand, in the seller's order.
  const brandBlocks = !pickedBrand && pageBrands.length > 1
    ? pageBrands.map((b) => ({ brand: b, cars: sortedListings.filter((c) => brandName(c) === b) }))
    : null;

  // The dealership's own address (linked salesmen only) — a full free-text
  // address if the dealer set one, else fall back to city/state.
  const dealerLocationStr = dealer
    ? (dealer.location || [dealer.city, dealer.state].filter(Boolean).join(', '))
    : null;
  // The agent's own address takes priority (every salesman — Lite, Premium,
  // or linked — can set one in their settings); a linked salesman who hasn't
  // set their own falls back to their dealership's address.
  const ownLocationStr = profile?.location || null;
  const mapLocationStr = ownLocationStr || dealerLocationStr;

  if (loadError && !profile) return (
    <ErrorScreen
      variant="load"
      eyebrow="Slow connection"
      title="Hold up, we're stuck in traffic"
      body="We couldn't load this page just now. The agent is still here, give it another go."
      actions={[
        { label: 'Try again', onClick: () => setRetryKey((k) => k + 1) },
        { label: 'Browse all cars', to: '/showroom' },
      ]}
    />
  );

  if ((!profile && !notFound) || !viewerReady) return <ShowroomLoader slug={slug} />;

  if (notFound) return (
    <ErrorScreen
      variant="404"
      eyebrow="Page not found"
      title="Oops, wrong turn"
      body="There's no agent page at this link. It may have been renamed or removed."
      actions={[{ label: 'Browse all cars', to: '/showroom' }]}
    />
  );

  const facebookHref = profile.facebook
    ? (profile.facebook.startsWith('http') ? profile.facebook : `https://facebook.com/${profile.facebook.replace(/^@/, '')}`)
    : null;
  const websiteHref = profile.website
    ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`)
    : null;
  const socials = [
    profile.instagram && { key: 'instagram', href: `https://instagram.com/${profile.instagram.replace(/^@/, '')}`, label: 'Instagram' },
    profile.tiktok && { key: 'tiktok', href: `https://tiktok.com/@${profile.tiktok.replace(/^@/, '')}`, label: 'TikTok' },
    facebookHref && { key: 'facebook', href: facebookHref, label: 'Facebook' },
    websiteHref && { key: 'website', href: websiteHref, label: 'Website' },
  ].filter(Boolean);

  // Identity lines. Eyebrow says what kind of seller this is; the Malay line
  // is the search phrase buyers actually type ("ejen kereta <tempat>").
  const sellerKind = dealer ? 'Sales agent'
    : profile.seller_type === 'private' ? 'Private seller'
    : profile.seller_type === 'new_car' ? 'New car advisor'
    : 'Independent agent';
  const eyebrow = [sellerKind, locationState || locationCity].filter(Boolean).join(' · ');
  const malayLine = profile.seller_type !== 'private' && locationStr ? `Ejen kereta di ${locationStr}` : null;
  const initial = (profile.full_name || 'A')[0].toUpperCase();
  const nameWords = (profile.full_name || '').trim().split(/\s+/);
  const nameTail = nameWords.pop() || '';
  const nameHead = nameWords.length ? `${nameWords.join(' ')} ` : '';
  const hasReviews = (reviewSummary?.count || 0) > 0;
  // Only real numbers: Sold hides at 0, rating hides with no reviews.
  const stats = [
    // A count that is still loading is a dash, never a 0.
    { key: 'sale', n: loading ? '–' : (lockedBrand ? shownListings : listings).length, l: 'For sale' },
    soldCount > 0 && { key: 'sold', n: soldCount, l: 'Sold' },
    hasReviews && { key: 'rating', n: reviewSummary.avg.toFixed(1), suffix: '/5', l: `${reviewSummary.count} review${reviewSummary.count === 1 ? '' : 's'}` },
  ].filter(Boolean);

  const pro = pageAccent(profile);
  // ── Main-column sections. A Lite page keeps its order (recently sold, map,
  // reviews). A Premium page reads like a person after the cars (PAGE-PRO 2):
  // About me, Why buy from me, Track record (recently sold + reviews), Find me.
  const soldSec = (
    <>
              {/* Recently sold — car + month only (get_agent_recent_sales). No price. */}
              {trust.recentSales.length > 0 && (
                <>
                  <div className="ap-sec"><h2>Recently sold</h2></div>
                  <div className="ap-card ap-sold">
                    {trust.recentSales.map((c, i) => (
                      <div key={i}>
                        <span>{[c.year, c.brand, c.model, c.variant].filter(Boolean).join(' ')}</span>
                        <span>Sold {soldMonthLabel(c.sold_month)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
    </>
  );
  const mapSec = (
    <>
              {/* Location: the agent's own address, else (linked) the dealership's. */}
              {mapLocationStr && (
                <>
                  <div className="ap-sec" id="ap-find"><h2>{ownLocationStr ? 'Find me' : `Visit ${dealer?.dealership || 'the dealership'}`}</h2></div>
                  <div className="ap-card ap-map">
                    <iframe
                      title={ownLocationStr ? 'My location' : 'Dealership location'}
                      src={`https://www.google.com/maps?q=${encodeURIComponent(mapLocationStr)}&output=embed`}
                      loading="lazy"
                    />
                    <a className="ap-ml" href={`https://www.google.com/maps/search/${encodeURIComponent(mapLocationStr)}`} target="_blank" rel="noopener noreferrer">
                      <b><MapPin size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{mapLocationStr}</b>
                      <span>Directions</span>
                    </a>
                  </div>
                </>
              )}
    </>
  );
  const reviewsSec = (
    <>
              {/* Seller reviews (same feature as CarDetailPage, seller-scoped). Its
                  tally feeds the stats row via onSummary. */}
              <div className="ap-reviews"><ReviewsSection
                dealerId={profile.id}
                sellerName={profile.full_name || firstName || 'this seller'}
                isXdrive
                th={LIGHT_REVIEW_TH}
                onSummary={setReviewSummary}
              /></div>
    </>
  );
  // Owner-only samples: the seller looking at their own page sees example rows in the empty
  // sections (never saved, never shown to a buyer). "Hide samples" turns them off for this visit.
  const sampleModels = [...new Set(listings.filter((c) => c.is_model_card).map((c) => [c.brand, c.model].filter(Boolean).join(' ')))];
  const sampled = isOwner && pro && showSamples ? withSampleSite(siteRaw, { models: sampleModels }) : null;
  const site = sampled ? sampled.site : cleanSite(siteRaw);
  const sampleNote = sampled && sampled.filled.length > 0 && (
    <div className="ap-sample-note" role="note">
      <span><b>Sample sections, only you see them.</b> Buyers see a section only once you fill it in Settings &gt; Your page.</span>
      <button type="button" onClick={() => setShowSamples(false)}>Hide samples</button>
    </div>
  );
  const facts = aboutFacts(about);
  // PAGE-SITE 3: the seller's own rankings (labelled: Drevo cannot check them) and best sellers.
  const ranks = pro ? site.ranks : [];
  const best = pro ? site.best : '';
  const aboutSec = (profile.bio || facts.length > 0 || ranks.length > 0 || best) && (
    <section id="ap-about" className="ap-pro-sec">
      <div className="ap-sec"><h2>About me</h2></div>
      <div className="ap-card ap-about">
        {profile.bio && <p className="ap-about-bio">{profile.bio}</p>}
        {facts.length > 0 && (
          <ul className="ap-facts">
            {facts.map((f) => <li key={f.key}><Check size={14} strokeWidth={2.6} />{f.text}</li>)}
          </ul>
        )}
        {best && <p className="ap-best"><span>Best sellers</span><b>{best}</b></p>}
        {ranks.length > 0 && (
          <div className="ap-ranks">
            <p className="ap-ranks-h">{site.rankTitle || 'Sales ranking'}</p>
            <div className="ap-ranks-g">
              {ranks.map((r) => (
                <div key={r.m} className={r.n === Math.min(...ranks.map((x) => x.n)) ? 'is-top' : ''}>
                  <b>No. {r.n}</b><span>{rankMonth(r.m)}</span>
                </div>
              ))}
            </div>
            <p className="ap-ranks-f">As stated by {firstName}. Drevo has not checked it.</p>
          </div>
        )}
      </div>
    </section>
  );
  const whySec = (about?.my_promise || profile.specializations?.length > 0 || terms.length > 0) && (
    <section id="ap-why" className="ap-pro-sec">
      <div className="ap-sec"><h2>Why buy from me</h2></div>
      {about?.my_promise && (
        <div className="ap-card ap-promise"><span aria-hidden="true">&ldquo;</span><p>{about.my_promise}</p></div>
      )}
      {profile.specializations?.length > 0 && (
        <div className="ap-specs">
          {profile.specializations.map((spec, i) => <div key={i} className="ap-card ap-spec"><Check size={15} strokeWidth={2.6} /><span>{spec}</span></div>)}
        </div>
      )}
      {terms.length > 0 && (
        <div className="ap-card ap-terms ap-terms--pro">
          <p className="ap-eb">My terms</p>
          {terms.map((tm) => <div key={tm.key} className="ap-term"><span>{tm.label}</span><span>{tm.text}</span></div>)}
        </div>
      )}
    </section>
  );
  const trackSec = (
    <section id="ap-track" className="ap-pro-sec">
      {trust.recentSales.length > 0 && <div className="ap-sec"><h2>Track record</h2></div>}
      {trust.recentSales.length > 0 && (
        <div className="ap-card ap-sold">
          {trust.recentSales.map((c, i) => (
            <div key={i}>
              <span>{[c.year, c.brand, c.model, c.variant].filter(Boolean).join(' ')}</span>
              <span>Sold {soldMonthLabel(c.sold_month)}</span>
            </div>
          ))}
        </div>
      )}
      {reviewsSec}
    </section>
  );

  // Buttons on the top of the page (cover on Lite, hero on Premium).
  const topButtons = (
    <>
      <button className="ap-back" onClick={goBack} aria-label="Back"><ArrowLeft size={18} /></button>
      <button className="ap-share" onClick={sharePage} aria-label="Share this page">
        {shareCopied ? <><Check size={16} /> Link copied</> : <><Share2 size={16} /> Share</>}
      </button>
      {/* Logged-in visitor's way home; the owner also gets Live presentation. */}
      {viewerHome && !heroPreviewMode && (
        <div className="ap-owner">
          <Link to={viewerHome.to} style={ownerChip}>
            {viewerHome.seller ? <LayoutDashboard size={12} /> : <User size={12} />} {viewerHome.label}
          </Link>
          {/* Every seller plan gets it, Lite included (owner, 2026-10-18).
              Always shown to the owner: with no approved car it says why
              instead of vanishing (a new seller looked for it and it was gone). */}
          {isOwner && (
            <button onClick={openLive} style={ownerChip}>
              <Radio size={12} /> Live presentation
            </button>
          )}
          {isOwner && liveBlock && (
            <span role="status" style={{ ...ownerChip, cursor: 'default', whiteSpace: 'normal', maxWidth: 300, lineHeight: 1.4 }}>
              {liveBlock === 'pending'
                ? 'Your car is waiting for approval. Live presentation opens once a car is approved.'
                : 'Add a car first. Live presentation shows the cars on this page.'}
            </span>
          )}
        </div>
      )}
    </>
  );
  // PAGE-HERO (owner, 2026-11-25): on a Premium page the SELLER is the hero.
  // Their photo big on the right (a see-through cut-out stands on the band, an
  // ordinary photo sits in a tall frame), with a car in front only when its photo
  // is a cut-out (a rectangle in front of a person looks broken). Everything the
  // old side card said is said here, once: name, verified, numbers, WhatsApp.
  const heroImg = heroImgUrl;
  const heroCut = heroCutState === true;
  const heroWait = heroCutState === null && !!heroImg;
  const heroBio = profile.bio || malayLine;
  // PAGE-HERO 2 (owner, 2026-11-26): two layouts, picked in Settings > Your photo. 'card' = a white
  // business card: a small round photo beside the name, then the same words, numbers and WhatsApp.
  const heroCard = heroFrameSet.layout === 'card';
  const cardPhoto = profile.avatar_url || heroImg;
  const heroPro = pro && heroCard ? (
    <header className="aph aph--card">
      {/* The card's top band (owner, 2026-11-26: "looks like Lite", white-on-white buttons): the seller's
          cover photo, else their page colour. Both are already set in Settings (cover + Page colour). */}
      {/* CAR-RING (owner, 2026-11-26): the seller's cut-out cars on a turning ring. No cut-out = their cover
          photo, else a dark studio lit in their page colour (never the flat colour band, "same as Lite"). */}
      <div className={`aph-band${ringCars?.length ? ' aph-band--ring' : ''}`}>
        {ringCars?.length
          ? <CarRing cars={ringCars} />
          : profile.cover_url && <img src={cdnImg(profile.cover_url, 1600, 70)} alt="" style={{ objectPosition: coverObjectPosition(profile.cover_url) }} />}
      </div>
      {topButtons}
      <div className="aph-in">
        <div className="aph-bc">
          {cardPhoto
            ? <img className="aph-bc-ph" src={cdnImg(cardPhoto, 240, 80)} alt={profile.full_name} />
            : <div className="aph-bc-ph aph-mono" aria-hidden="true">{initial}</div>}
          <div className="aph-bc-id">
            <div className="aph-name-row">
              <h1 className="aph-name">
                {nameHead}
                <span className="ap-last">{nameTail}{isVerified && (
                  <svg viewBox="0 0 24 24" role="img" aria-label="Verified by Drevo"><circle cx="12" cy="12" r="10" fill="#0f1115" /><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}</span>
              </h1>
              {/* Business card: Share sits on the right, level with the middle of the photo on a phone (owner, 2026-11-26);
                  on desktop it sits next to the name (owner, 2026-11-27). */}
              <button className="ap-share aph-bc-share" onClick={sharePage} aria-label="Share this page">
                {shareCopied ? <><Check size={16} /> Link copied</> : <><Share2 size={16} /> Share</>}
              </button>
            </div>
            {(agentNickname(seoProfile) || profile.job_title) && (
              <p className="aph-role">{[agentNickname(seoProfile) && `@${agentNickname(seoProfile)}`, profile.job_title].filter(Boolean).join(' · ')}</p>
            )}
            {dealer?.dealership && <p className="aph-role">Works at {dealer.dealership}</p>}
          </div>
        </div>
        <div className="aph-chips">
          <span>{sellerKind}</span>
          {(locationCity || locationState) && <span className="aph-locchip"><MapPin size={12} style={{ flexShrink: 0 }} /><i className="aph-loc">{tidyPlace(locationCity, locationState)}</i></span>}
          {isVerified && <span><ShieldCheck size={12} />ID verified by Drevo</span>}
        </div>
        {heroBio && <p className="aph-bio">{heroBio}</p>}
        <div className="aph-stats">
          {stats.map((st) => (
            <div key={st.key}><b>{st.n}{st.suffix && <small>{st.suffix}</small>}</b><span>{st.l}</span></div>
          ))}
          {replyLabel && <div><b className="aph-small">{replyLabel}</b><span>Measured on chat</span></div>}
        </div>
        <div className="aph-cta">
          {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="ap-btn">{WA_ICON}<span>WhatsApp {firstName}</span></a>}
          {socials.map((so) => (
            <a key={so.key} href={so.href} target="_blank" rel="noopener noreferrer" className="aph-ico" title={so.label} aria-label={so.label}>{SOCIAL_ICONS[so.key]}</a>
          ))}
        </div>
      </div>
    </header>
  ) : pro && (
    <header className={`aph${profile.cover_url ? ' aph--cover' : ''}`}>
      {profile.cover_url && (
        <img className="aph-bg" src={cdnImg(profile.cover_url, 1600, 70)} alt="" style={{ objectPosition: coverObjectPosition(profile.cover_url) }} />
      )}
      <span className="aph-glow" aria-hidden="true" />
      {topButtons}
      <div className="aph-in">
        <div className="aph-text">
          <div className="aph-chips">
            <span>{sellerKind}</span>
            {(locationCity || locationState) && <span className="aph-locchip"><MapPin size={12} style={{ flexShrink: 0 }} /><i className="aph-loc">{tidyPlace(locationCity, locationState)}</i></span>}
            {isVerified && <span><ShieldCheck size={12} />ID verified by Drevo</span>}
          </div>
          <h1 className="aph-name">
            {nameHead}
            <span className="ap-last">{nameTail}{isVerified && (
              <svg viewBox="0 0 24 24" role="img" aria-label="Verified by Drevo"><circle cx="12" cy="12" r="10" fill="#fff" /><path d="M7.5 12.5l3 3 6-6.5" stroke="#0f1115" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}</span>
          </h1>
          {(agentNickname(seoProfile) || profile.job_title) && (
            <p className="aph-role">{[agentNickname(seoProfile) && `@${agentNickname(seoProfile)}`, profile.job_title].filter(Boolean).join(' · ')}</p>
          )}
          {dealer?.dealership && <p className="aph-role">Works at {dealer.dealership}</p>}
          {heroBio && <p className="aph-bio">{heroBio}</p>}
          <div className="aph-cta">
            {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="ap-btn">{WA_ICON}<span>WhatsApp {firstName}</span></a>}
            {socials.map((so) => (
              <a key={so.key} href={so.href} target="_blank" rel="noopener noreferrer" className="aph-ico" title={so.label} aria-label={so.label}>{SOCIAL_ICONS[so.key]}</a>
            ))}
          </div>
          <div className="aph-stats">
            {stats.map((st) => (
              <div key={st.key}><b>{st.n}{st.suffix && <small>{st.suffix}</small>}</b><span>{st.l}</span></div>
            ))}
            {replyLabel && <div><b className="aph-small">{replyLabel}</b><span>Measured on chat</span></div>}
          </div>
        </div>
        <div className={`aph-pic keep-alpha${heroCut ? ' aph-pic--cut' : ''}${heroCarUrl ? ' aph-pic--car' : ''}${heroWait ? ' aph-pic--wait' : ''}`}>
          {heroImg
            ? <img ref={heroMeRef} className="aph-me" src={heroCut || heroWait ? heroImg : cdnImg(heroImg, 720, 80)} alt={profile.full_name}
                style={heroCarUrl && heroClip ? { ...heroPersonStyle(heroFrameSet, heroCut), clipPath: heroClip } : heroPersonStyle(heroFrameSet, heroCut)} />
            : <div className="aph-me aph-mono" aria-hidden="true">{initial}</div>}
          {heroCarUrl && <img ref={heroCarRef} className="aph-car" src={heroCarUrl} alt="" style={heroCarStyle(heroFrameSet)} />}
        </div>
      </div>
    </header>
  );

  // The cars grid and the calculator, as values so a Premium page can order them (PAGE-SITE 2).
  const carsSec = (
    <>
              <div className="ap-sec" id="ap-cars">
                <h2>{lockedBrand ? `${lockedBrand} cars` : profile.seller_type === 'new_car' ? 'New cars' : 'Cars for sale'}{shownListings.length > 0 && <> <span>{shownListings.length}</span></>}</h2>
                {shownListings.length > 1 && (
                  <div className="ap-seg" role="group" aria-label="Sort cars">
                    <button aria-pressed={sortBy === 'newest'} onClick={() => setSortBy('newest')}>Newest</button>
                    <button aria-pressed={sortBy === 'price'} onClick={() => setSortBy('price')}>Price</button>
                  </div>
                )}
              </div>
              {showBrandTabs && (
                <div className="ap-brands" role="group" aria-label="Brands">
                  <button type="button" aria-pressed={!pickedBrand} onClick={() => setBrandTab('all')}>All <span>{listings.length}</span></button>
                  {pageBrands.map((b) => (
                    <button key={b} type="button" aria-pressed={pickedBrand === b} onClick={() => setBrandTab(b)}>
                      {b} <span>{listings.filter((c) => brandName(c) === b).length}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* Only cars a superadmin checked (car_listings.docs_verified). */}
              {docsLine && (
                <p className="ap-docs"><ShieldCheck size={14} style={{ flexShrink: 0, color: '#15803d' }} />{docsLine}</p>
              )}

              {loading && listings.length === 0 ? (
                <div className="ap-grid" aria-busy="true" aria-label="Loading cars">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="ap-card ap-car ap-skel">
                      <div className="ap-ph" />
                      <div className="ap-cb"><i /><i /><i /></div>
                    </div>
                  ))}
                </div>
              ) : brandBlocks ? (
                brandBlocks.map((g) => (
                  <section key={g.brand} className="ap-bblock" aria-label={`${g.brand} cars`}>
                    <h3 className="ap-bhead">{g.brand} <span>{g.cars.length}</span></h3>
                    <div className="ap-grid">
                      {g.cars.map((car) => (
                        <AgentCarCard key={car.id} car={car} num={numById.get(car.id)} refSlug={profile?.slug || slug} onClick={() => trackCardClick(car)} />
                      ))}
                    </div>
                  </section>
                ))
              ) : shownListings.length > 0 ? (
                <div className="ap-grid">
                  {shownListings.map((car) => (
                    <AgentCarCard key={car.id} car={car} num={numById.get(car.id)} refSlug={profile?.slug || slug} onClick={() => trackCardClick(car)} />
                  ))}
                </div>
              ) : (
                <div className="ap-card" style={{ padding: '40px 20px', textAlign: 'center', fontSize: 14, color: '#6b7280' }}>
                  No cars for sale right now.
                </div>
              )}
    </>
  );
  const calcSec = (
    <>
              {/* Premium only (PAGE-SITE): the page's one money block, under the cars.
                  A Lite page (page_basic) shows exactly what it showed before. */}
              {pro && !profile.page_basic && shownListings.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <PageCalculator
                    listings={pickedBrand ? shownListings : listings}
                    firstName={firstName}
                    hasWa={hasWa}
                    focus={calcFocus}
                    waUrlFor={(text) => sellerWaUrl({ slug: profile.slug, text })}
                    onWhatsApp={(car) => trackEvent(supabase, 'whatsapp_click', {
                      car_id: car.id,
                      dealer_id: car.dealer_id || profile?.dealer_id || profile?.id || null,
                      salesman_slug: slug,
                      metadata: { source: 'page_calculator' },
                    })}
                  />
                </div>
              )}
    </>
  );
  const hasModels = pro && listings.some((c) => c.is_model_card);
  const calcOk = pro && !profile.page_basic && shownListings.length > 0;
  const siteWa = (source, item) => trackEvent(supabase, 'whatsapp_click', {
    car_id: item?.id || null,
    dealer_id: item?.dealer_id || profile?.dealer_id || profile?.id || null,
    salesman_slug: slug,
    metadata: { source: `page_${source}` },
  });
  const siteWaUrl = (text) => sellerWaUrl({ slug: profile.slug, text });
  const siteNodes = {
    promos: <PromoBoard key="promos" site={site} firstName={firstName} hasWa={hasWa} waUrlFor={siteWaUrl} onWhatsApp={siteWa} />,
    models: <ModelPicker key="models" cars={listings} site={site} firstName={firstName} hasWa={hasWa} waUrlFor={siteWaUrl} onWhatsApp={siteWa} onCalc={calcOk && !site.off.includes('calculator') ? openCalc : null} />,
    cars: <React.Fragment key="cars">{carsSec}</React.Fragment>,
    calculator: <React.Fragment key="calculator">{calcSec}</React.Fragment>,
    delivery: <DeliveryBlock key="delivery" delivery={site.delivery} firstName={firstName} hasWa={hasWa} waUrlFor={siteWaUrl} onWhatsApp={siteWa} />,
    handover: <HandoverBlock key="handover" items={site.handover} photos={handoverPhotos} soldCount={soldCount} firstName={firstName} />,
    steps: <StepsBlock key="steps" steps={site.steps} firstName={firstName} />,
    book: <BookBlock key="book" cars={listings} firstName={firstName} slug={profile.slug || slug} place={mapLocationStr} avatar={profile.avatar_url || null} />,
    faq: <FaqBlock key="faq" faq={site.faq} firstName={firstName} />,
  };
  const siteIds = pro ? visibleSections(site, { models: hasModels, cars: true, calculator: calcOk, photos: handoverPhotos.length > 0, book: listings.some((c) => c.status === 'available' && c.dealer_id) }) : [];
  // The page reads as rows (owner, 2026-11-25: "everything is too wide"): models + cars take a
  // row each, the other sections go two to a row on a wide screen. The fixed sections after
  // the seller's own (About, Why me, Track record, Find me) join the same flow.
  const flowItems = [
    ...siteIds.map((id) => ({ id, span: SECTION_SPAN[id], node: siteNodes[id] })),
    ...(pro ? [
      aboutSec && { id: 'about', span: 'half', node: <React.Fragment key="about">{aboutSec}</React.Fragment> },
      whySec && { id: 'why', span: 'half', node: <React.Fragment key="why">{whySec}</React.Fragment> },
      { id: 'track', span: 'half', node: <React.Fragment key="track">{trackSec}</React.Fragment> },
      mapLocationStr && { id: 'find', span: 'half', node: <React.Fragment key="find">{mapSec}</React.Fragment> },
    ] : []).filter(Boolean),
  ];
  const siteBody = (
    <>
      {sampleNote}
      {flowRows(flowItems).map((row) => (
        <div key={row.map((x) => x.id).join('+')} className={`ps-row${row.length === 2 ? ' ps-row--2' : row[0].span === 'half' ? ' ps-row--half' : ''}`}>
          {row.map((x) => x.node)}
        </div>
      ))}
    </>
  );
  const hasPromos = pro && activePromos(site).length > 0;

  return (
    <>
      <Helmet>
        {/* Same title as the crawler render (api/og.js buildSalesmanHtml), name
            first so a search for the agent's name matches the title. */}
        <title>{pageTitle}</title>
        {/* `bio` only — `about_text` is the dealer storefront's "About us". */}
        <meta name="description" content={metaDescription} />
        {/* Shared as a link constantly, so it needs its own canonical + og:url. */}
        <link rel="canonical" href={`https://drevo.my/s/${encodeURIComponent(profile.slug || slug)}`} />
        <meta property="og:url" content={`https://drevo.my/s/${encodeURIComponent(profile.slug || slug)}`} />
        <meta property="og:type" content="profile" />
        <meta property="og:site_name" content="Drevo" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        {/* The wide cover makes the better link preview; avatar as fallback. */}
        {agentShareImage(profile, SITE_URL) && (
          <meta property="og:image" content={agentShareImage(profile, SITE_URL)} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      {/* Light, per DESIGN.md and docs/mockups/agent-page-light.html (MINI-LIGHT-1).
          Classes are ap- prefixed: this <style> is global while mounted. */}
      <style>{`
        .ap { min-height: 100vh; background: #F7F6F2; color: #111827; font-family: var(--xd-font-body); -webkit-font-smoothing: antialiased; overflow-x: hidden; overflow-x: clip; }
        .ap *, .ap *::before, .ap *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .ap a { color: inherit; }
                .ap-shell { max-width: 1360px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 48px); }
        .ap-cover { height: 150px; margin-top: 12px; border-radius: 16px; position: relative; overflow: hidden; border: 1px solid rgba(0,0,0,.06); background: linear-gradient(115deg, #DCE8F2 0%, #EEF0EA 45%, #F6E3CF 100%); }
        .ap-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        /* Scoped to the wave art ONLY. Plain '.ap-cover svg' also caught the
           icons inside the owner buttons and blew them up across the cover. */
        .ap-cover > svg.ap-waves { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 70%; }
        .ap-back { position: absolute; top: 12px; left: 12px; z-index: 2; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,.94); color: #0f1115; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 1px 3px rgba(15,23,42,.16); }
        .ap-share { position: absolute; top: 12px; left: 56px; z-index: 2; height: 36px; padding: 0 12px; border-radius: 18px; border: none; background: rgba(255,255,255,.94); color: #0f1115; display: flex; align-items: center; gap: 6px; font: 600 13px/1 var(--xd-font-body); cursor: pointer; box-shadow: 0 1px 3px rgba(15,23,42,.16); }
        .ap-owner { position: absolute; top: 12px; right: 12px; z-index: 2; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .ap-card { background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.05); border: 1px solid rgba(0,0,0,.06); }
        .ap-id { padding: 20px; margin-top: -44px; position: relative; }
        .ap-av { width: 96px; height: 96px; border-radius: 50%; padding: 3px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 1px 3px rgba(15,23,42,.08); margin-top: -64px; }
        .ap-av img, .ap-av div { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
        .ap-av div { background: linear-gradient(145deg, #3a3f4a, #15171c); display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 40px; }
        .ap-eb { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #6b7280; }
        .ap-id .ap-eb { margin-top: 16px; display: flex; align-items: center; gap: 8px; }
        .ap-id .ap-eb i { width: 16px; height: 2px; background: #dc2626; display: inline-block; flex-shrink: 0; }
        .ap h1 { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(40px, 11vw, 52px); line-height: .92; letter-spacing: .015em; margin-top: 8px; color: #0f1115; overflow-wrap: anywhere; }
        .ap-last { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
        .ap h1 svg { width: 22px; height: 22px; flex-shrink: 0; margin-top: -4px; }
        .ap-role { font-size: 14px; color: #4b5563; margin-top: 8px; }
        .ap-my { font-size: 13px; color: #6b7280; margin-top: 2px; font-style: italic; }
        .ap-nick { font-size: 15px; font-weight: 600; color: #374151; margin: 2px 0 0; letter-spacing: 0.01em; }
        .ap-works { font-size: 13px; color: #4b5563; margin-top: 6px; }
        .ap-works a { font-weight: 600; color: #111827; text-decoration: underline; text-underline-offset: 3px; }
        .ap-creds { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 14px; }
        .ap-cred { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: #111827; }
        .ap-stats { display: grid; margin: 18px 0; border-top: 1px solid rgba(0,0,0,.06); border-bottom: 1px solid rgba(0,0,0,.06); }
        .ap-stats div { padding: 12px 0 10px; text-align: center; }
        .ap-stats div + div { border-left: 1px solid rgba(0,0,0,.06); }
        .ap-n { font-family: 'Bebas Neue', sans-serif; font-size: 32px; line-height: 1; color: #0f1115; letter-spacing: .02em; font-variant-numeric: tabular-nums; }
        .ap-n small { font-size: 18px; color: #9ca3af; }
        .ap-l { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; margin-top: 4px; }
        .ap-cta { display: flex; gap: 8px; align-items: center; }
        .ap-btn { flex: 1; min-width: 0; height: 48px; border-radius: 10px; background: #dc2626; color: #fff !important; font-weight: 600; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; white-space: nowrap; overflow: hidden; box-shadow: 0 1px 2px rgba(220,38,38,.25), inset 0 -1px 0 rgba(0,0,0,.12); transition: background .15s; }
        .ap-btn:hover { background: #b91c1c; }
        .ap-btn > span { overflow: hidden; text-overflow: ellipsis; }
        .ap-btn svg { width: 17px; height: 17px; flex-shrink: 0; }
        .ap-ico { width: 48px; height: 48px; flex-shrink: 0; border-radius: 50%; border: 1px solid rgba(0,0,0,.12); display: flex; align-items: center; justify-content: center; color: #111827; background: #fff; transition: border-color .15s; }
        .ap-ico:hover { border-color: #111827; }
        .ap-ico svg { width: 18px; height: 18px; }
        /* 3+ socials: four 48px circles left the button ~80px on a phone and
           squeezed the logo out of line, so WhatsApp takes its own row. */
        .ap-cta--stack { flex-wrap: wrap; row-gap: 10px; }
        .ap-cta--stack .ap-btn { flex: 1 1 100%; }
        .ap-bio { font-size: 15px; color: #4b5563; line-height: 1.7; margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(0,0,0,.06); }
        .ap-more { background: none; border: none; color: #111827; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 0 0; text-decoration: underline; text-underline-offset: 3px; font-family: inherit; }
        .ap-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
        .ap-tag { background: #F0EEE8; color: #111827; font-size: 12px; font-weight: 500; padding: 5px 9px; border-radius: 4px; border: 1px solid rgba(0,0,0,.06); }
        .ap-terms { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(0,0,0,.06); }
        .ap-term { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: #6b7280; margin-top: 8px; }
        .ap-term span + span { color: #111827; text-align: right; }
        .ap-sec { display: flex; justify-content: space-between; align-items: flex-end; margin: 40px 0 16px; gap: 12px; }
        .ap h2 { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(28px, 3vw, 40px); line-height: .95; letter-spacing: .015em; color: #0f1115; }
        .ap h2 span { color: #9ca3af; }
        .ap-seg { display: flex; border: 1px solid rgba(0,0,0,.12); border-radius: 8px; overflow: hidden; background: #fff; flex-shrink: 0; }
        .ap-seg button { font-size: 12px; font-weight: 600; padding: 7px 12px; border: none; background: none; color: #4b5563; cursor: pointer; font-family: inherit; }
        .ap-seg button[aria-pressed="true"] { background: #0f1115; color: #fff; }
        .ap-docs { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #4b5563; margin: -6px 0 16px; }
        /* CARDS-SMALL (owner, 2026-11-23): two across on a phone, three from 640px. */
        .ap-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        @media (min-width: 640px) { .ap-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
        .ap-brands { display: flex; gap: 8px; margin: -4px 0 18px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .ap-brands::-webkit-scrollbar { display: none; }
        .ap-brands button { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border: 1px solid rgba(0,0,0,.12); border-radius: 999px; background: #fff; color: #374151; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
        .ap-brands button span { font-weight: 500; color: #9ca3af; font-variant-numeric: tabular-nums; }
        .ap-brands button[aria-pressed="true"] { background: #0f1115; border-color: #0f1115; color: #fff; }
        .ap-brands button[aria-pressed="true"] span { color: rgba(255,255,255,.6); }
        .ap-bblock + .ap-bblock { margin-top: 28px; }
        .ap-bhead { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #111827; }
        .ap-bhead span { font-weight: 500; color: #9ca3af; font-variant-numeric: tabular-nums; }
        .ap-car { min-width: 0; overflow: hidden; text-decoration: none; display: block; transition: box-shadow .2s, transform .2s; }
        .ap-car:hover { box-shadow: 0 8px 22px rgba(15,23,42,.12); transform: translateY(-2px); }
        .ap-ph { aspect-ratio: 4 / 3; position: relative; background: #EDEAE3; overflow: hidden; }
        .ap-ph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        /* PAGE-SITE: a Premium card shows the WHOLE car (a wide photo was cropped at the sides). The grey behind is the card's own. Lite keeps cover. */
        .ap--pro .ap-ph img { object-fit: contain; }
        .ap-skel .ap-ph, .ap-skel .ap-cb i { animation: ap-pulse 1.4s ease-in-out infinite; }
        .ap-skel .ap-cb i { display: block; height: 12px; border-radius: 6px; background: #EDEAE3; margin-bottom: 10px; }
        .ap-skel .ap-cb i:nth-child(1) { width: 80%; } .ap-skel .ap-cb i:nth-child(2) { width: 55%; } .ap-skel .ap-cb i:nth-child(3) { width: 40%; height: 18px; margin-bottom: 0; }
        @keyframes ap-pulse { 50% { opacity: .55; } }
        @media (prefers-reduced-motion: reduce) { .ap-skel .ap-ph, .ap-skel .ap-cb i { animation: none; } }
        .ap-nophoto { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #9ca3af; }
        .ap-ov { position: absolute; background: rgba(15,17,21,.78); color: #fff; font-size: 11px; font-weight: 600; padding: 4px 7px; border-radius: 4px; font-variant-numeric: tabular-nums; }
        .ap-tl { left: 8px; top: 8px; } .ap-br { right: 8px; bottom: 8px; }
        .ap-cb { padding: 10px 12px 12px; }
        .ap-cn { font-size: 14px; font-weight: 600; line-height: 1.3; color: #111827; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ap-cs { display: flex; flex-wrap: wrap; gap: 2px 8px; font-size: 11px; color: #6b7280; margin-top: 4px; font-variant-numeric: tabular-nums; }
        .ap-cs span + span::before { content: ''; display: inline-block; width: 3px; height: 3px; border-radius: 50%; background: #9ca3af; margin-right: 8px; vertical-align: middle; }
        .ap-pr { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 4px 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,.06); }
        .ap-pr b { display: block; font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; color: #0f1115; }
        .ap-mo { display: block; font-size: 11px; color: #6b7280; margin-top: 2px; font-variant-numeric: tabular-nums; }
        .ap-mo b { display: inline; font-size: 11px; font-weight: 600; color: #111827; }
        .ap-st { font-size: 11px; color: #4b5563; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .ap-st i { width: 6px; height: 6px; border-radius: 50%; }
        @media (max-width: 639px) {
          .ap-ov { font-size: 10px; padding: 3px 6px; }
          .ap-br { display: none; }
          .ap-cb { padding: 8px 10px 10px; }
          .ap-cn { font-size: 13px; }
          .ap-pr b { font-size: 15px; }
          .ap-mo b { font-size: 11px; }
          .ap-st { display: none; }
        }
        .ap-live { padding: 14px; margin-bottom: 8px; }
        .ap-live-h { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #111827; margin-bottom: 12px; }
        .ap-live-h i { width: 6px; height: 6px; border-radius: 50%; background: #dc2626; }
        .ap-live a.ap-live-car { display: flex; gap: 12px; text-decoration: none; min-width: 0; }
        .ap-live-ph { position: relative; width: 112px; flex-shrink: 0; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: #EDEAE3; }
        .ap-live-ph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .ap-live .ap-btn { margin-top: 12px; height: 44px; font-size: 14px; }
        .ap-sold div { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; font-size: 14px; }
        .ap-sold div + div { border-top: 1px solid rgba(0,0,0,.06); }
        .ap-sold span:first-child { color: #111827; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ap-sold span:last-child { flex-shrink: 0; font-size: 12px; color: #6b7280; }
        .ap-map { overflow: hidden; }
        .ap-map iframe { display: block; border: 0; width: 100%; height: 170px; filter: grayscale(.35); }
        .ap-ml { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; text-decoration: none; }
        .ap-ml b { font-size: 14px; font-weight: 600; color: #111827; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ap-ml span { font-size: 13px; font-weight: 600; color: #111827; text-decoration: underline; text-underline-offset: 3px; flex-shrink: 0; }
        .ap-safe { text-align: center; padding: 40px 0 8px; max-width: 520px; margin: 0 auto; }
        .ap-safe p { font-size: 13px; color: #6b7280; line-height: 1.6; }
        .ap-foot { text-align: center; font-size: 12px; color: #6b7280; padding: 24px 0 110px; }
        .ap-foot a { color: #111827; font-weight: 600; text-decoration: none; }
        .ap-sticky { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; background: rgba(255,255,255,.98); border-top: 1px solid rgba(0,0,0,.06); box-shadow: 0 -8px 24px rgba(15,23,42,.06); padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); display: flex; gap: 12px; align-items: center; }
        .ap-sticky .ap-mini { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; overflow: hidden; background: linear-gradient(145deg, #3a3f4a, #15171c); color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 18px; display: flex; align-items: center; justify-content: center; }
        .ap-sticky .ap-mini img { width: 100%; height: 100%; object-fit: cover; }
        .ap-who { flex: 1; min-width: 0; font-size: 12px; color: #6b7280; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .ap-who b { display: block; color: #111827; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
        .ap-sticky .ap-btn { flex: 0 0 auto; padding: 0 20px; height: 44px; font-size: 14px; }
        /* PAGE-PRO: Premium pages only (.ap--pro). A taller banner with a soft
           fade, the seller's colour on the main button, the accent line, the
           live dot and a ring round the photo. Lite (.ap alone) is untouched. */
        .ap--pro .ap-cover { height: 210px; border: none; }
        /* The WHOLE page takes the seller's colour, lightly (owner, 2026-11-01:
           "slightly, a little bitty bit"; 4% on the background alone was too faint
           to see). Background 9%, every white surface (cards, sort switch, the
           phone's bottom bar, photo ring gap) 3%, so it reads as one tinted page. */
        .ap--pro { --ap-bg: color-mix(in srgb, var(--ap-a) 9%, #F7F6F2); --ap-surf: color-mix(in srgb, var(--ap-a) 3%, #fff); background: var(--ap-bg); }
        .ap--pro .ap-card, .ap--pro .ap-seg, .ap--pro .ap-ico, .ap--pro .ap-av { background-color: var(--ap-surf); }
        .ap--pro .ap-brands button:not([aria-pressed="true"]) { background-color: var(--ap-surf); }
        .ap--pro .ap-sticky { background: var(--ap-surf); }
        /* No cover yet: the banner is the seller's colour (the wave bands go soft
           white on it), so a Premium page reads as one before any upload. */
        .ap--pro .ap-cover { background: linear-gradient(120deg, var(--ap-a) 0%, var(--ap-a2) 100%); }
        .ap--pro .ap-cover > svg.ap-waves path { fill: #fff; fill-opacity: .10; }
        .ap--pro .ap-cover::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.32) 100%); }
        .ap--pro .ap-back, .ap--pro .ap-share, .ap--pro .ap-owner { z-index: 3; }
        .ap--pro .ap-btn { background: linear-gradient(var(--ap-a), var(--ap-b2)); box-shadow: 0 6px 18px rgba(var(--ap-rgb), .28); }
        .ap--pro .ap-btn:hover { background: var(--ap-b2); }
        .ap--pro .ap-id .ap-eb i { background: var(--ap-a); width: 22px; }
        .ap--pro .ap-av { padding: 3px; background: linear-gradient(145deg, var(--ap-a), var(--ap-a2)); box-shadow: 0 8px 22px rgba(var(--ap-rgb), .30); }
        .ap--pro .ap-av img, .ap--pro .ap-av div { border: 3px solid #fff; }
        .ap--pro .ap-live-h i { background: var(--ap-a); }
        .ap--pro .ap-id { box-shadow: 0 1px 3px rgba(15,23,42,.08), 0 12px 32px rgba(15,23,42,.08); }
        /* Raised keys (owner's reel: "4 shadows, 1 gradient"): a light top edge,
           a dark bottom lip, a tight contact shadow and a soft coloured drop.
           Pressed: the gradient flips, the shadow goes inside, the key sinks. */
        .ap--pro .ap-btn { border-radius: 24px; background: linear-gradient(var(--ap-a), var(--ap-b2));
          box-shadow: inset 0 2px 0 rgb(255 255 255 / .40), inset 0 -3px 0 rgb(9 10 12 / .28), 0 2px 3px rgb(9 10 12 / .40), 0 12px 30px rgba(var(--ap-rgb), .42);
          transition: translate 90ms ease-out, box-shadow 90ms ease-out; -webkit-tap-highlight-color: transparent; }
        .ap--pro .ap-btn:hover { background: linear-gradient(var(--ap-a), var(--ap-b2)); filter: brightness(1.05); }
        .ap--pro .ap-btn:active { background: linear-gradient(var(--ap-b2), var(--ap-a)); box-shadow: inset 0 3px 6px rgb(9 10 12 / .40); translate: 0 2px; filter: none; }
        .ap--pro .ap-back, .ap--pro .ap-share { background: linear-gradient(#ffffff, #eeede9);
          box-shadow: inset 0 1px 0 #fff, inset 0 -2px 0 rgb(9 10 12 / .10), 0 2px 3px rgb(9 10 12 / .25), 0 8px 20px rgb(9 10 12 / .18);
          transition: translate 90ms ease-out, box-shadow 90ms ease-out; }
        .ap--pro .ap-back:active, .ap--pro .ap-share:active { background: linear-gradient(#eeede9, #ffffff); box-shadow: inset 0 2px 5px rgb(9 10 12 / .22); translate: 0 2px; }
        /* PAGE-HERO (2026-11-25): Premium = the seller is the hero (heroPro). */
        .aph { position: relative; margin-top: 12px; border-radius: 24px; overflow: hidden; background: #0c0d10; color: #fff; isolation: isolate; }
        .aph-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -3; }
        .aph--cover::before { content: ''; position: absolute; inset: 0; z-index: -2; background: linear-gradient(180deg, rgba(12,13,16,.55), rgba(12,13,16,.92) 55%); }
        .aph-glow { position: absolute; z-index: -1; left: 50%; top: 40px; width: 360px; height: 360px; translate: -50% 0; border-radius: 50%; background: radial-gradient(circle, rgba(var(--ap-rgb), .95) 0%, rgba(var(--ap-rgb), .35) 42%, rgba(var(--ap-rgb), 0) 70%); }
        /* PHONE (owner, 2026-11-25: "the hero is too long, it doesn't fit the screen"): the hero answers to the
           screen's height (svh), so the name, the WhatsApp button and the numbers show without a scroll. */
        .aph-in { display: flex; flex-direction: column; gap: 10px; padding: 54px 16px 16px; }
        /* PAGE-HERO 2: the business card layout (white, a small round photo beside the name). */
        .ap .aph.aph--card { --k0: #ffffff; --line: rgba(10,10,11,.1); --line2: rgba(10,10,11,.16); --t1: #0f1115; --t2: rgba(15,17,21,.72); --t3: rgba(15,17,21,.52);
          background: #fff; color: #0f1115; border: 1px solid var(--line2); box-shadow: 0 1px 2px rgba(10,10,11,.04), 0 12px 32px rgba(10,10,11,.06); }
        .aph-band { position: absolute; left: 0; right: 0; top: 0; height: 150px; overflow: clip;
          background: radial-gradient(70% 90% at 50% 100%, rgba(var(--ap-rgb), .55), rgba(var(--ap-rgb), 0) 70%), linear-gradient(180deg, #08090b, #16181d); }
        .aph-band > img { width: 100%; height: 100%; object-fit: cover; }
        .aph-band::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,0) 50%, rgba(0,0,0,.22)); }
        /* The ring band is in the flow and as tall as its content (owner: 'too tall'); the card body overlaps it by half the photo. */
        .aph-band--ring { position: relative; height: auto; }
        .aph-band--ring::after { display: none; }
        .ap .aph.aph--card { overflow: clip; }
        /* PageLook's Back/Share are white glass with white text (for the dark hero); on the card they sit on the
           band, so a dark glass keeps them readable on any colour or cover photo. */
        .ap--pro .aph--card .ap-back, .ap--pro .aph--card .ap-share { background: rgba(12,13,16,.42) !important; border-color: rgba(255,255,255,.22) !important; -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
        .aph--card .aph-in { position: relative; gap: 14px; padding: 104px 18px 18px; pointer-events: none; }
        .aph--card .aph-in > * { pointer-events: auto; }
        /* Phone (owner, 2026-11-27): the photo rides up into the band's bottom-left, level with the price on the right. */
        .aph--card:has(.aph-band--ring) .aph-in { padding-top: 0; margin-top: -90px; }
        .aph-band--ring .cring:not(.cring--sm) { padding-bottom: 22px; }
        .aph-name-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; }
        .aph-bc { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-width: 0; }
        .aph--card > .ap-share { display: none; }
        .ap--pro .aph--card .aph-bc .aph-bc-share { position: relative; flex: none; left: auto; right: auto; top: auto; background: #0f1115 !important; color: #fff !important; border-color: #0f1115 !important; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: 0 4px 14px rgba(10,10,11,.18); }
        .aph-bc-ph { flex-shrink: 0; width: 96px; height: 96px; border-radius: 50%; object-fit: cover; object-position: 50% 20%; background: #f1f1f3; border: 4px solid #fff; box-shadow: 0 6px 18px rgba(10,10,11,.18); }
        .aph-bc-ph.aph-mono { display: flex; align-items: center; justify-content: center; font-size: 44px; }
        .aph-bc-id { min-width: 0; }
        .ap .aph--card .aph-name { margin: 0 0 4px; color: #0f1115; font-size: clamp(34px, 9vw, 64px); }
        .aph--card .aph-name svg { width: .34em; height: .34em; }
        .aph--card .aph-role { color: var(--t3); }
        .aph--card .aph-chips span { border-color: var(--line2); background: transparent; color: var(--t2); }
        .aph--card .aph-bio { color: var(--t2); }
        .aph--card .aph-stats { margin-top: 0; border-top-color: var(--line); }
        .aph--card .aph-stats b small { color: var(--t3); }
        .aph--card .aph-stats span { color: var(--t3); }
        .aph--card .aph-ico { color: #0f1115; background: transparent; border-color: var(--line2); }
        .aph--card .aph-cta { margin-top: 0; }
        .aph-pic { order: -1; position: relative; height: clamp(130px, 22svh, 190px); display: flex; align-items: flex-end; justify-content: center; }
        .aph-pic--cut { height: clamp(170px, 31svh, 270px); }
        .aph-pic--wait .aph-me { opacity: 0; }
        .aph-me { transition: opacity .2s; }
        .aph-me { display: block; width: auto; height: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 28px; box-shadow: 0 30px 60px rgba(0,0,0,.5), 0 0 0 6px rgba(var(--ap-rgb), .35); }
        .aph-pic--cut .aph-me { height: 100%; aspect-ratio: auto; max-width: 100%; object-fit: contain; object-position: bottom; border-radius: 0; box-shadow: none; filter: drop-shadow(0 20px 30px rgba(0,0,0,.45)); }
        .aph-mono { display: flex; align-items: center; justify-content: center; background: linear-gradient(150deg, var(--ap-a), var(--ap-a2)); font-family: 'Bebas Neue', sans-serif; font-size: 110px; color: rgba(255,255,255,.92); }
        .aph-pic--car .aph-me { margin-bottom: 22px; }
        .aph-car { position: absolute; z-index: 2; bottom: -6px; left: 50%; translate: -50% 0; width: min(64%, 300px); height: auto; filter: drop-shadow(0 18px 16px rgba(0,0,0,.6)); pointer-events: none; }
        /* index.css paints #fff behind every see-through car photo (cards); not here */
        .aph .aph-pic img.aph-car { background: transparent; }
        .aph-chips { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
        .ap-sample-note { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 14px; margin: 18px 0 4px; padding: 12px 14px; border-radius: 12px; border: 1px dashed rgba(10,10,11,.25); background: #f6f6f7; color: #3a3d44; font-size: 13px; line-height: 1.45; }
        .ap-sample-note b { color: #0f1115; }
        .ap-sample-note button { flex-shrink: 0; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(10,10,11,.2); background: #fff; color: #0f1115; font: inherit; font-weight: 600; cursor: pointer; }
        .aph-chips span { white-space: nowrap; flex: 0 0 auto; }
        .aph-chips .aph-locchip { flex: 0 1 auto; min-width: 0; height: auto !important; min-height: 26px; padding-block: 4px !important; white-space: normal !important; line-height: 1.25; }
        .aph-loc { font-style: normal; min-width: 0; overflow-wrap: anywhere; }
        .aph-chips span:nth-child(n+3) { display: none; } /* the verified tick sits beside the name; the full chip returns from 900px */
        .aph-chips span { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06); font-size: 12px; font-weight: 500; color: rgba(255,255,255,.88); }
        .ap .aph-name { margin: 8px 0 2px; color: #fff; font-size: clamp(46px, 13vw, 96px); line-height: .88; letter-spacing: .01em; }
        .ap .aph-name svg { width: .3em; height: .3em; margin-top: -.08em; }
        .aph-role { margin: 0 0 2px; font-size: 14px; font-weight: 500; color: rgba(255,255,255,.7); }
        .aph-bio { margin: 8px 0 0; max-width: 540px; font-size: 13.5px; line-height: 1.45; color: rgba(255,255,255,.82); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-line; }
        .aph-cta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
        .ap--pro .aph-cta .ap-btn { flex: 1 1 100%; min-width: 0; height: 48px; padding: 0 20px; border-radius: 12px; font-size: 15px; font-weight: 600; }
        .aph-ico { width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); }
        .aph-ico svg { width: 18px; height: 18px; }
        .aph-stats { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.12); }
        .aph-stats b { display: block; font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 26px; line-height: 1; letter-spacing: .02em; font-variant-numeric: tabular-nums; }
        .aph-stats b small { font-size: 18px; color: rgba(255,255,255,.6); }
        .aph-stats b.aph-small { display: flex; align-items: center; height: 26px; font-family: var(--xd-font-body); font-size: 14px; font-weight: 600; line-height: 1; padding: 0; white-space: nowrap; }
        .aph-stats span { display: block; margin-top: 3px; font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.58); }
        @media (max-height: 740px) and (max-width: 899px) { .aph-bio { display: none; } }
        @media (min-width: 900px) {
          .aph-chips { flex-wrap: wrap; }
          .aph-chips span:nth-child(n+3) { display: inline-flex; }
          .aph-in { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr); align-items: end; gap: 32px; min-height: 440px; padding: 76px 48px 36px; }
          .aph--card .aph-in { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'id id' 'chips chips' 'bio bio' 'stats cta';
            align-items: end; min-height: 0; gap: 16px 32px; padding: 76px 40px 32px; }
          .aph--card .aph-bc { grid-area: id; } .aph--card .aph-chips { grid-area: chips; } .aph--card .aph-bio { grid-area: bio; }
          .aph--card .aph-stats { grid-area: stats; } .aph--card .aph-cta { grid-area: cta; justify-self: end; }
          .aph-band { height: 190px; }
          .aph-band.aph-band--ring { height: auto; }
          .aph--card .aph-in { padding-top: 126px; }
          /* The photo rides up into the band's bottom-left corner (owner, 2026-11-27: "let the PFP sit where the price is"), the price starts level with the name, and the section is ~60px shorter. */
          .aph--card:has(.aph-band--ring) .aph-in { padding-top: 0; margin-top: -100px; }
          .aph--card:has(.aph-band--ring) .aph-bc-id { padding-top: 112px; }
          .aph-band .cring-foot { padding-left: 200px; }
          .aph-name-row { justify-content: flex-start; gap: 6px 20px; }
          /* The front car is the star (owner, 2026-11-27): ~half the band wide, the side cars tucked behind it. */
          .aph-band .cring { padding-top: 22px; --spread: 37cqw; --car-w: 39cqw; --side: .14; --under: 22px; }
          .aph-band--ring .cring:not(.cring--sm) { padding-bottom: 28px; }
          .aph-band .cring-label b { font-size: 44px; }
          /* SPLIT TOP (owner, 2026-11-27: "scale the slide to the marked size, the buyer info right beside it"): with the car band
             on desktop the header is two columns, the seller on the left, the slide on the right, so a buyer sees who they are
             dealing with without scrolling. Phones keep the stacked layout. */
          .aph--card:has(.aph-band--ring) { display: grid; grid-template-columns: minmax(340px, 31%) minmax(0, 1fr); align-items: stretch; }
          .aph--card:has(.aph-band--ring) .aph-band { grid-column: 2; grid-row: 1; }
          .aph--card:has(.aph-band--ring) .aph-in { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; margin-top: 0; padding: 56px 24px 22px; min-height: 0; }
          .aph--card:has(.aph-band--ring) .ap-back { left: calc(max(340px, 31%) + 12px); }
          .aph--card:has(.aph-band--ring) .aph-bc { flex-direction: row; align-items: center; gap: 16px; }
          .aph--card:has(.aph-band--ring) .aph-bc-ph { width: 88px; height: 88px; flex: none; }
          .aph--card:has(.aph-band--ring) .aph-bc-id { padding-top: 0; }
          .ap .aph--card:has(.aph-band--ring) .aph-name { font-size: clamp(30px, 3vw, 40px); line-height: .95; }
          .aph--card:has(.aph-band--ring) .aph-name-row { gap: 6px 10px; }
          .aph--card:has(.aph-band--ring) .aph-cta { justify-self: start; justify-content: flex-start; flex-wrap: wrap; }
          .aph--card:has(.aph-band--ring) .aph-stats { flex-wrap: wrap; justify-self: start; justify-content: flex-start; gap: 6px 22px; }
          .aph--card:has(.aph-band--ring) .aph-bio { margin: 0; }
          .aph-band .cring-foot { padding-left: 20px; }
          .aph-band .cring { --spread: 33cqw; --car-w: 56cqw; --side: .16; }
          .aph-band--ring .cring:not(.cring--sm) { padding-bottom: 14px; }
          .aph-bc { flex-direction: row; align-items: flex-start; gap: 24px; }
          .aph-bc-id { padding-top: 76px; }
          .aph-bc-ph { width: 136px; height: 136px; }
          .aph-pic { order: 0; height: 100%; min-height: 340px; }
          .aph-pic--cut { height: 500px; align-self: end; }
          .aph-pic:not(.aph-pic--cut) { align-items: center; }
          .aph-pic:not(.aph-pic--cut) .aph-me { height: auto; width: min(100%, 300px); }
          .aph-text { align-self: center; }
          .aph-glow { left: auto; right: 4%; top: 12%; width: 520px; height: 520px; translate: none; }
          .aph-cta { flex-wrap: nowrap; }
          .ap--pro .aph-cta .ap-btn { flex: 0 0 auto; }
          .aph-ico { width: 48px; height: 48px; }
          .aph-car { left: 46%; bottom: -18px; width: min(140%, 660px); max-width: none; }
          .aph-pic--car .aph-me { margin-bottom: 60px; }
        }
        @media (min-width: 1024px) {
          .ap--pro .ap-cols { display: block; }
          .ap--pro .ap-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        @media (prefers-reduced-motion: reduce) { .ap--pro .ap-btn, .ap--pro .ap-back, .ap--pro .ap-share { transition: none; } .ap--pro .ap-btn:active, .ap--pro .ap-back:active, .ap--pro .ap-share:active { translate: none; } }
        /* PAGE-PRO 2: the person, after the cars. */
        .ap-bio--short p { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ap-bio--short .ap-more { display: inline-block; margin-top: 6px; color: var(--ap-a); text-decoration: none; }
        .ap-pro-sec { scroll-margin-top: 16px; }
        .ap-about { padding: 20px; }
        .ap-about-bio { font-size: 15px; line-height: 1.75; color: #374151; white-space: pre-line; }
        .ap-facts { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        .ap-best { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; margin: 16px 0 0; padding-top: 14px; border-top: 1px solid rgba(0,0,0,.06); font-size: 14px; }
        .ap-best span { font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; }
        .ap-best b { color: #0f1115; font-weight: 600; }
        .ap-ranks { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(0,0,0,.06); }
        .ap-ranks-h { margin: 0 0 10px; font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; }
        .ap-ranks-g { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
        .ap-ranks-g div { padding: 12px; border-radius: 10px; corner-shape: squircle; background: #f4f4f6; color: #0f1115; }
        .ap-ranks-g div.is-top { background: #dc2626; color: #fff; }
        .ap-ranks-g b { display: block; font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 28px; line-height: 1; letter-spacing: .02em; }
        .ap-ranks-g span { display: block; margin-top: 4px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; opacity: .7; }
        .ap-ranks-f { margin: 8px 0 0; font-size: 11.5px; color: #6b7280; }
        .ap-about-bio + .ap-facts { padding-top: 16px; border-top: 1px solid rgba(0,0,0,.06); }
        .ap-facts li { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #111827; background: #F4F2EC; border-radius: 999px; padding: 7px 12px; }
        .ap-facts svg { color: var(--ap-a); flex-shrink: 0; }
        .ap-promise { position: relative; padding: 22px 22px 22px 56px; margin-bottom: 12px; overflow: hidden; }
        .ap-promise span { position: absolute; left: 16px; top: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 72px; line-height: 1; color: var(--ap-a); }
        .ap-promise p { font-size: 18px; font-weight: 600; line-height: 1.45; color: #0f1115; }
        .ap-specs { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 10px; margin-bottom: 12px; }
        .ap-spec { display: flex; align-items: center; gap: 10px; padding: 14px 16px; font-size: 14px; font-weight: 600; color: #111827; }
        .ap-spec svg { flex-shrink: 0; width: 26px; height: 26px; padding: 5px; border-radius: 50%; color: #fff; background: var(--ap-a); }
        .ap-terms--pro { margin-top: 0; padding: 18px 20px; border-top: none; }
        @media (min-width: 1800px) { .ap-shell { max-width: 1640px; } }
        @media (min-width: 1024px) {
          .ap-cover { height: 220px; }
          .ap--pro .ap-cover { height: 300px; }
          .ap-cols { display: grid; grid-template-columns: 400px minmax(0, 1fr); gap: 48px; align-items: start; }
          .ap-left { position: sticky; top: 112px; } /* room for the photo that sits above the card */
          .ap-id { padding: 24px; }
          .ap-sticky { display: none; }
          .ap-foot { padding-bottom: 48px; }
        }
      `}</style>

      {/* PAGE-PRO (2026-11-01): a Premium page gets its own look, a Lite page
          keeps the standard one (owner: "glow up Premium", Lite unchanged).
          The seller's colour comes from pageAccent (src/utils/pageAccent.js). */}
      <div className={pro ? 'ap ap--pro' : 'ap'} style={pro ? { '--ap-a': pro.accent, '--ap-a2': pro.dark, '--ap-b2': pro.btnDark, '--ap-rgb': pro.rgb } : undefined}>
        {/* Owner-only setup nudge — fixed strip, closeable per step (setupDismissKey). */}
        {isOwner && setupHref && !setupDismissed && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60, background: '#0f1115', boxShadow: '0 8px 24px rgba(15,23,42,0.2)', transform: setupSlideIn ? 'translateY(0)' : 'translateY(-100%)', transition: 'transform 0.24s ease' }}>
            <div style={{ maxWidth: 1360, margin: '0 auto', padding: '10px clamp(16px,4vw,48px)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link to={setupHref} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, textDecoration: 'none' }}>
                <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontWeight: 700, flexShrink: 0 }}>Only you</span>
                <span style={{ fontSize: 13, color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {setupTodo[0].label}{setupTodo.length > 1 ? ` (+${setupTodo.length - 1} more)` : ''}
                </span>
                <ChevronRight size={14} color="rgba(255,255,255,0.45)" style={{ flexShrink: 0 }} />
              </Link>
              <button onClick={dismissSetupNudge} aria-label="Dismiss" style={{ flexShrink: 0, background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* No site header (owner, 2026-10-03): just a back button on the cover.
            The page is the agent's own; Drevo is credited in the footer. */}

        <div className="ap-shell">
          {/* Cover: the agent's own photo, else the sky-to-sand fallback with the
              marketplace's warm wave bands (colour lives here and nowhere else). */}
          {pro && <SiteStyle />}
          {pro && <PageLook />}
          {pro ? heroPro : <div className="ap-cover">
            {profile.cover_url ? (
              <img src={cdnImg(profile.cover_url, 1280, 72)} srcSet={cdnSrcSet(profile.cover_url, [640, 960, 1280], 72)} sizes="100vw" alt="" style={{ objectPosition: coverObjectPosition(profile.cover_url) }} />
            ) : (
              <svg className="ap-waves" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 70 C300 20 600 120 1200 50 V160 H0z" fill="#F2E6D6" fillOpacity=".85" />
                <path d="M0 110 C350 60 750 150 1200 90 V160 H0z" fill="#EDE5D8" />
                <path d="M0 135 C400 105 800 160 1200 125 V160 H0z" fill="#F7F6F2" />
              </svg>
            )}
            {topButtons}
          </div>}

          {hasPromos && !site.off.includes('promos') && <PromoTicker site={site} />}

          <div className="ap-cols">
            {!pro && <div className="ap-left">
              <div className="ap-card ap-id">
                <div className="ap-av">
                  {profile.avatar_url ? <img src={cdnImg(profile.avatar_url, 240, 80)} alt={profile.full_name} /> : <div>{initial}</div>}
                </div>
                {eyebrow && <p className="ap-eb"><i />{eyebrow}</p>}
                <h1>
                  {/* The tick rides with the LAST word (nowrap) so it never drops
                      onto a line of its own. is_verified is granted by a person
                      (verified_by); nothing else may be called verified. */}
                  {nameHead}
                  <span className="ap-last">
                    {nameTail}
                    {isVerified && (
                      <svg viewBox="0 0 24 24" role="img" aria-label="Verified by Drevo"><circle cx="12" cy="12" r="10" fill="#111827" /><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </span>
                </h1>
                {agentNickname(seoProfile) && <p className="ap-nick">@{agentNickname(seoProfile)}</p>}
                {profile.job_title && <p className="ap-role">{profile.job_title}</p>}
                {malayLine && <p className="ap-my">{malayLine}</p>}
                {/* Backed by a real business: name it and link its storefront. */}
                {dealer?.dealership && (
                  <p className="ap-works">
                    Works at{' '}
                    {dealer.subdomain
                      ? <a href={`https://${dealer.subdomain}.drevo.my`}>{dealer.dealership}</a>
                      : <b>{dealer.dealership}</b>}
                  </p>
                )}
                {(isVerified || replyLabel) && (
                  <div className="ap-creds">
                    {isVerified && <span className="ap-cred"><ShieldCheck size={14} strokeWidth={2.2} />ID verified by Drevo</span>}
                    {/* Reply time is MEASURED from chat (get_agent_reply_time), never typed. */}
                    {replyLabel && <span className="ap-cred" title="Measured on Drevo chat"><Clock size={14} strokeWidth={2.2} />{replyLabel}</span>}
                  </div>
                )}

                <div className="ap-stats" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
                  {stats.map((st) => (
                    <div key={st.key}>
                      <p className="ap-n">{st.n}{st.suffix && <small>{st.suffix}</small>}</p>
                      <p className="ap-l">{st.l}</p>
                    </div>
                  ))}
                </div>

                {/* ONE primary action; socials are icon-only beside it. */}
                {(waHref || socials.length > 0) && (
                  <div className={`ap-cta${waHref && socials.length >= 3 ? ' ap-cta--stack' : ''}`}>
                    {waHref && (
                      <a href={waHref} target="_blank" rel="noopener noreferrer" className="ap-btn">
                        {WA_ICON}<span>WhatsApp {firstName}</span>
                      </a>
                    )}
                    {socials.map((so) => (
                      <a key={so.key} href={so.href} target="_blank" rel="noopener noreferrer" className="ap-ico" title={so.label} aria-label={so.label}>
                        {SOCIAL_ICONS[so.key]}
                      </a>
                    ))}
                  </div>
                )}

                {/* Premium: a 2-line taste here, the whole story under "About me"
                    below the cars (owner: cars first, then who you are). */}
                {pro && (profile.bio || aboutFacts(about).length > 0 || about?.my_promise) && (
                  <div className="ap-bio ap-bio--short">
                    {profile.bio && <p>{profile.bio}</p>}
                    <a className="ap-more" href="#ap-about" onClick={(e) => { e.preventDefault(); document.getElementById('ap-about')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>More about me</a>
                  </div>
                )}
                {!pro && profile.bio && (
                  <div className="ap-bio">
                    <p
                      ref={bioRef}
                      style={{ display: '-webkit-box', WebkitLineClamp: bioExpanded ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: bioExpanded ? 'visible' : 'hidden', whiteSpace: 'pre-line' }}
                    >
                      {profile.bio}
                    </p>
                    {(bioOverflows || bioExpanded) && (
                      <button className="ap-more" onClick={() => setBioExpanded((v) => !v)}>
                        {bioExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )}

                {!pro && profile.specializations?.length > 0 && (
                  <div className="ap-tags">
                    {profile.specializations.map((spec, i) => <span key={i} className="ap-tag">{spec}</span>)}
                  </div>
                )}

                {/* The agent's own terms, only the parts they set (agentTrust.js). */}
                {!pro && terms.length > 0 && (
                  <div className="ap-terms">
                    <p className="ap-eb">My terms</p>
                    {terms.map((t) => (
                      <div key={t.key} className="ap-term"><span>{t.label}</span><span>{t.text}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>}

            <div className="ap-right">
              {pro && (
                <PageNav items={flowItems.map((x) => ({
                  promos: { id: 'ap-promos', label: 'Promos' }, models: { id: 'ap-models', label: 'Models' }, cars: shownListings.length > 0 && { id: 'ap-cars', label: 'Cars' },
                  calculator: shownListings.some((c) => Number(c.selling_price) > 0) && { id: 'ap-calc', label: 'Calculator' }, delivery: { id: 'ap-delivery', label: 'Delivery' },
                  handover: { id: 'ap-handover', label: 'Handover' }, steps: { id: 'ap-steps', label: 'How to buy' }, book: { id: 'ap-book', label: 'Book' }, faq: { id: 'ap-faq', label: 'FAQ' },
                  about: { id: 'ap-about', label: 'About' }, why: { id: 'ap-why', label: 'Why me' }, track: trust.recentSales.length > 0 && { id: 'ap-track', label: 'Track record' },
                  find: { id: 'ap-find', label: 'Find me' },
                }[x.id]))} />
              )}
              {/* Live now: the car on the agent's live stream right now. Viewers
                  land here from the TikTok bio link, so it leads the column. */}
              {liveCar && (
                <>
                  <div className="ap-sec"><h2>On my live now</h2></div>
                  <div className="ap-card ap-live">
                    <p className="ap-live-h"><i />Showing #{liveIdx + 1}</p>
                    <Link to={`/showroom/${liveCar.slug || liveCar.id}?ref=${encodeURIComponent(profile?.slug || slug)}`} {...carWarmProps(liveCar)} onClick={() => trackCardClick(liveCar)} className="ap-live-car">
                      <div className="ap-live-ph">
                        {Array.isArray(liveCar.images) && liveCar.images[0] && <img src={cdnImg(liveCar.images[0], 320, 72)} alt="" />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p className="ap-cn">{[liveCar.year, liveCar.brand, liveCar.model, liveCar.variant].filter(Boolean).join(' ')}</p>
                        {liveCar.selling_price > 0 && <p style={{ fontSize: 18, fontWeight: 800, color: '#0f1115', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>RM {fmt(liveCar.selling_price)}</p>}
                        <MonthlyLine price={liveCar.selling_price} />
                      </div>
                    </Link>
                    {liveWaHref && (
                      <a href={liveWaHref} target="_blank" rel="noopener noreferrer" onClick={trackLiveWhatsApp} className="ap-btn">
                        {WA_ICON}<span>Ask {firstName} about #{liveIdx + 1}</span>
                      </a>
                    )}
                  </div>
                </>
              )}

              {pro ? siteBody : <>{carsSec}{calcSec}</>}
              {!pro && <>{soldSec}{mapSec}{reviewsSec}</>}
            </div>
          </div>

          {/* Buyer safety — Drevo takes no payment for any car — beside the way
              to flag this agent (report_seller). */}
          <div className="ap-safe">
            <p>Drevo never collects payment for a car. See the car and its geran before you pay any deposit, and get the deposit terms in writing.</p>
            <ReportListingButton sellerId={profile.id} th={LIGHT_SHEET_TH} />
          </div>
          <p className="ap-foot">{profile.full_name} sells through <a href="https://drevo.my">Drevo</a> · <Link to="/showroom">Browse all used cars</Link>
            {/* Basic (Lite) page: the free page carries the invite to make one. */}
            {profile.page_basic && <><br />Selling cars? <Link to="/for-salesmen">Get your own page free</Link></>}
          </p>
        </div>

        {/* Mobile only: the contact button must not scroll away under the cars. */}
        {waHref && (
          <div className="ap-sticky">
            <div className="ap-mini">{profile.avatar_url ? <img src={cdnImg(profile.avatar_url, 96, 80)} alt="" /> : initial}</div>
            <p className="ap-who"><b>{profile.full_name}</b>{replyLabel || (loading ? '' : `${(lockedBrand ? shownListings : listings).length} ${(lockedBrand ? shownListings : listings).length === 1 ? 'car' : 'cars'} for sale`)}</p>
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="ap-btn">{WA_ICON}WhatsApp</a>
          </div>
        )}
      </div>

      {alertsGate && (
        <LeadAlertsStep
          userId={viewerId}
          eyebrow="Before you go live"
          intro="Viewers WhatsApp you, chat and book viewings during the live and after it. Turn on alerts so every one reaches you, even with this page closed."
          onDone={startPresenting}
          onCancel={() => setAlertsGate(false)}
        />
      )}

      {presenting && (
        <Suspense fallback={null}>
          <LivePresenter listings={listings} slug={slug} sellerId={profile?.id}
            onReorder={isOwner ? saveCarOrder : undefined}
            sellerName={profile?.full_name} sellerPhone={isOwner ? viewerPhone : null} onClose={() => setPresenting(false)}
            officialNew={profile?.seller_type === 'new_car' || listings.some((l) => l.is_model_card)}
            // Lite page = Lite seller = the basic presenter (LIVE-BASIC). page_basic
            // comes from salesman_has_full_page, so trials and dealer-linked reps get it all.
            basic={!!profile?.page_basic}
            // IDEA-32: only a standalone seller can invite (claim_referral).
            canInvite={!profile?.dealer_id} />
        </Suspense>
      )}
    </>
  );
}
