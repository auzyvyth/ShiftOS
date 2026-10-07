import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, LayoutDashboard, MapPin, ChevronRight, Radio, User, X, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ReviewsSection from '../components/reviews/ReviewsSection';
import { routeForProfile, isSellerRole, ROUTE_PROFILE_COLUMNS } from '../hooks/useRoleRedirect';
import { trackEvent } from '../utils/analytics';
import { captureRef } from '../utils/refTracking';
import { agentPageTitle, agentPageDescription } from '../utils/agentSeo';
import { useAgentTrust } from '../hooks/useAgentTrust';
import { replyTimeLabel, docsCheckedLine, termsLines, soldMonthLabel } from '../utils/agentTrust';
import ReportListingButton from '../components/ReportListingButton';
import { calcMonthly } from '../utils/financing';
import { sellerWaUrl, hasWhatsApp } from '../utils/sellerWhatsApp';
import { groupByModel, priceBasis, rm } from '../utils/newCars';

// Seller-only, so buyers never download it.
const LivePresenter = lazy(() => import('../components/live/LivePresenter'));

const fmt = (n) => Number(n).toLocaleString('en-MY');

// Owner-only setup nudge: closing it dismisses only the CURRENT next step —
// stored against that step's key, not a flat yes/no. So closing "Add a
// profile photo" and later actually adding one clears the photo step out of
// setupTodo, the stored key stops matching the new next step, and the nudge
// comes back for whatever's next. Closing it is never "gone for good" while
// something real is still missing.
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
function MonthlyLine({ price }) {
  const m = calcMonthly(Number(price));
  if (!m) return null;
  return (
    <span className="ap-mo">est. <b>RM {fmt(m)}/mo</b></span>
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

// One car card, per docs/mockups/agent-page-light.html. Deliberately not
// ShowroomCard: that one carries an "Agent/Dealer" chip (meaningless on the
// agent's own page) and its own WhatsApp gate, which would compete with this
// page's single contact button. "#N" is the live-presentation number.
function AgentCarCard({ car, num, onClick }) {
  const imgs = Array.isArray(car.images) ? car.images.filter(Boolean) : [];
  const cond = car.condition ? car.condition.charAt(0).toUpperCase() + car.condition.slice(1) : null;
  return (
    <Link to={`/showroom/${car.slug}`} onClick={onClick} className="ap-card ap-car">
      <div className="ap-ph">
        {imgs[0]
          ? <img src={imgs[0]} alt={[car.year, car.brand, car.model].filter(Boolean).join(' ')} loading="lazy" />
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
            <b>{car.selling_price > 0 ? `RM ${fmt(car.selling_price)}` : 'Price on request'}</b>
            <MonthlyLine price={car.selling_price} />
          </div>
          <span className="ap-st"><i style={{ background: car.status === 'reserved' ? '#b45309' : '#15803d' }} />{car.status === 'reserved' ? 'Reserved' : 'Available'}</span>
        </div>
      </div>
    </Link>
  );
}

export default function SalesmanProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  // Back = wherever the visitor was before this page. A buyer who arrived
  // straight from a TikTok / WhatsApp link has no in-app history (the router's
  // history.state.idx is 0), so they go to the marketplace instead of being
  // thrown out of the site.
  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate('/');
  };
  const [profile, setProfile] = useState(null);
  const [dealer, setDealer] = useState(null);
  const [listings, setListings] = useState([]);
  // NEWCAR-1: variants a new-car advisor sells, priced for THEIR zone by the DB
  // (get_seller_new_models). Not listings: they never sell out and never count
  // toward "For sale".
  const [newModels, setNewModels] = useState([]);
  const [soldCount, setSoldCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const bioRef = useRef(null);
  const [bioOverflows, setBioOverflows] = useState(false);
  const [viewerHome, setViewerHome] = useState(null);
  // Who is looking. Only ever compared against the profile's own id, to decide
  // whether the "finish your page" note renders — it must never be shown to a
  // buyer sitting on someone else's page.
  const [viewerId, setViewerId] = useState(null);
  // The viewer's OWN number, read from their own row. The public page no longer
  // carries the seller's number (CDP-3), but the presenter shows it to its owner.
  const [viewerPhone, setViewerPhone] = useState(null);
  // Fire the mini-page visit exactly once per mount (StrictMode double-invokes).
  const visitTracked = useRef(false);
  // Live presentation (owner only) and the car it is showing right now. The
  // presenter writes that car via set_live_listing; this page reads it back by
  // slug for every visitor, so a viewer arriving from a TikTok bio link sees
  // the car on screen pinned at the top. See src/components/live/LivePresenter.jsx.
  const [presenting, setPresenting] = useState(false);
  const [liveListingId, setLiveListingId] = useState(null);
  // Newest (the query order, which is also the #N order) or cheapest first.
  const [sortBy, setSortBy] = useState('newest');
  // Review tally handed up by ReviewsSection (onSummary) for the stats row, so
  // the page does not query reviews a second time.
  const [reviewSummary, setReviewSummary] = useState(null);

  // Detect the arrival platform (Instagram/Facebook/TikTok/WhatsApp… via the
  // in-app browser UA or referrer) and stash it so every footprint we log below
  // carries a channel. Runs first, before any trackEvent fires.
  useEffect(() => { captureRef(); }, []);

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
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data?.session?.user?.id;
      if (!uid || cancelled) return;
      setViewerId(uid);
      const { data: viewer } = await supabase
        .from('profiles').select(`${ROUTE_PROFILE_COLUMNS}, whatsapp_number, phone`).eq('id', uid).maybeSingle();
      if (cancelled || !viewer?.role) return;
      setViewerPhone(viewer.whatsapp_number || viewer.phone || null);
      setViewerHome({
        to: routeForProfile(viewer),
        label: isSellerRole(viewer.role) ? 'Dashboard' : 'My Account',
        seller: isSellerRole(viewer.role),
        // Live presentation is not part of Salesman Lite: the button showed
        // there and did nothing, so Lite does not get it at all.
        lite: routeForProfile(viewer) === '/salesman-lite',
      });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Look up the agent, retrying on transient RPC failures. A mobile tab woken
    // from the background re-mounts this page and fires the RPC while the
    // network is still coming back — a FAILED request must not be shown as
    // "Agent not found". That verdict is only correct for a clean lookup that
    // returns no row. Retry a few times before giving up; a manual refresh used
    // to be the only way out of the false not-found.
    async function load(attempt = 0) {
      const { data: p, error } = await supabase
        .rpc('get_salesman_by_slug', { p_slug: slug })
        .maybeSingle();
      if (cancelled) return;

      if (error) {
        if (attempt < 3) {
          setTimeout(() => { if (!cancelled) load(attempt + 1); }, 1000 * (attempt + 1));
        }
        // else: leave the loader up rather than a wrong "not found"; a later
        // refresh / tab-focus re-mount retries.
        return;
      }

      if (!p) { setNotFound(true); setLoading(false); return; }
      setProfile(p);

      // Log the mini-page visit (footprint). Keyed on the agent's slug so it
      // shows in their own dashboard; dealer_id so the parent dealer sees it.
      if (!visitTracked.current) {
        visitTracked.current = true;
        trackEvent(supabase, 'minipage_view', {
          salesman_slug: slug,
          dealer_id: p.dealer_id || p.id,
        });
      }

      const [ownedRes, assignedRes, featuredRes, soldStatsRes, newModelsRes] = await Promise.all([
        supabase.from('public_car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour,dealer_id,docs_verified,condition,state,status')
          .eq('dealer_id', p.id).in('status', ['available', 'reserved']).order('created_at', { ascending: false }),
        supabase.from('public_car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour,dealer_id,docs_verified,condition,state,status')
          .eq('assigned_to', p.id).in('status', ['available', 'reserved']).order('created_at', { ascending: false }),
        // Linked salesmen feature dealer cars via salesman_listings (car stays
        // owned by the dealer, assigned_to null) — the two queries above miss
        // those, so pull them via a SECURITY DEFINER RPC.
        supabase.rpc('get_salesman_featured_listings', { p_salesman_id: p.id }),
        // Sold count comes from seller_public_stats — the SAME source the
        // marketplace card reads as public_car_listings.seller_sold_count.
        // This used to be two counts (dealer_id + assigned_to) added together,
        // which double-counted every car where the seller is BOTH owner and
        // assignee (14 of 26 sold cars live), so the mini page claimed roughly
        // twice what the card showed for the same seller. The view does a
        // count(DISTINCT listing_id) over the union, so it cannot double-count.
        supabase.from('seller_public_stats').select('sold_count').eq('seller_id', p.id).maybeSingle(),
        supabase.rpc('get_seller_new_models', { p_slug: slug }),
      ]);
      if (cancelled) return;

      if (p.dealer_id) {
        const { data: d } = await supabase
          .rpc('get_dealer_profile_by_id', { p_dealer_id: p.dealer_id })
          .maybeSingle();
        if (cancelled) return;
        setDealer(d);
      }

      const seen = new Set();
      const lst = [...(ownedRes.data || []), ...(assignedRes.data || []), ...(featuredRes.data || [])].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      setSoldCount(Number(soldStatsRes.data?.sold_count) || 0);
      setListings(lst);
      setNewModels(newModelsRes.data || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Trust signals (measured reply time, recently sold, the agent's own terms).
  // Above the early returns: hooks cannot sit below a conditional return.
  const trust = useAgentTrust(profile?.id);
  const replyLabel = replyTimeLabel(trust.reply);
  const terms = termsLines(trust.seller);
  const docsLine = docsCheckedLine(listings);

  useEffect(() => {
    if (bioRef.current) {
      setBioOverflows(bioRef.current.scrollHeight > bioRef.current.clientHeight + 2);
    }
  }, [profile?.bio, bioExpanded]);

  // Poll rather than subscribe: the state lives in a no-policy table that only
  // SECURITY DEFINER functions read, so anon cannot use realtime on it. 15s is
  // fast enough for "the car he's talking about" and costs one tiny RPC. A
  // missing function (migration not applied yet) just means no banner.
  useEffect(() => {
    if (!profile?.id) return undefined;
    let cancelled = false;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.rpc('get_salesman_live', { p_slug: slug }).then(({ data, error }) => {
        if (!cancelled && !error) setLiveListingId(data || null);
      }, () => {});
    };
    check();
    const t = setInterval(check, 15000);
    document.addEventListener('visibilitychange', check);
    return () => { cancelled = true; clearInterval(t); document.removeEventListener('visibilitychange', check); };
  }, [profile?.id, slug]);

  // The number is never in this page (CDP-3): /api/wa resolves it on tap.
  const hasWa = hasWhatsApp(profile) && !!profile?.slug;
  const firstName = (profile?.full_name || 'Agent').split(' ')[0];
  const waMessage = `Hi ${firstName}, I came across your listings on ShiftOS and would like to know more.`;
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
  const isOwner = !!viewerId && !!profile && viewerId === profile.id;
  const setupTodo = !isOwner ? [] : [
    listings.length === 0 && { key: 'car', label: 'List your first car', tab: 'listings' },
    !profile.avatar_url && { key: 'avatar', label: 'Add a profile photo', tab: 'settings' },
    !profile.cover_url && { key: 'cover', label: 'Add a banner image', tab: 'settings' },
    !(profile.bio || '').trim() && { key: 'bio', label: 'Write a short bio', tab: 'settings' },
  ].filter(Boolean);
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
  const metaDescription = agentPageDescription(profile, listings.length);
  const pageTitle = agentPageTitle(profile);

  // "#N" is fixed to the query order (newest first), the same array the live
  // presenter walks, so re-sorting by price never renumbers a car mid-live.
  const numById = new Map(listings.map((c, i) => [c.id, i + 1]));
  const sortedListings = sortBy === 'price'
    ? [...listings].sort((a, b) => (Number(a.selling_price) || Infinity) - (Number(b.selling_price) || Infinity))
    : listings;

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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.08)', borderTopColor: '#dc2626', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--xd-font-body)', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Agent not found</p>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This page doesn't exist or has been removed.</p>
      <Link to="/showroom" style={{ fontSize: 13, fontWeight: 600, color: '#111827', textDecoration: 'underline', textUnderlineOffset: 3 }}>Browse all cars</Link>
    </div>
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
  const newModelGroups = groupByModel(newModels);
  const newBrand = newModels[0]?.brand || '';
  const newCarWa = (model) => (hasWa
    ? sellerWaUrl({ slug: profile.slug, text: `Hi ${firstName}, I'm interested in the new ${newBrand} ${model}. Can you tell me more?` })
    : null);
  const trackNewCarWa = (model) => trackEvent(supabase, 'whatsapp_click', {
    dealer_id: profile.dealer_id || profile.id,
    salesman_slug: slug,
    metadata: { source: 'minipage_newcar', model: `${newBrand} ${model}` },
  });
  const eyebrow = [sellerKind, locationState || locationCity].filter(Boolean).join(' · ');
  const malayLine = profile.seller_type !== 'private' && locationStr ? `Ejen kereta di ${locationStr}` : null;
  const initial = (profile.full_name || 'A')[0].toUpperCase();
  const nameWords = (profile.full_name || '').trim().split(/\s+/);
  const nameTail = nameWords.pop() || '';
  const nameHead = nameWords.length ? `${nameWords.join(' ')} ` : '';
  const hasReviews = (reviewSummary?.count || 0) > 0;
  // Only real numbers: Sold hides at 0, rating hides with no reviews.
  const stats = [
    { key: 'sale', n: listings.length, l: 'For sale' },
    soldCount > 0 && { key: 'sold', n: soldCount, l: 'Sold' },
    hasReviews && { key: 'rating', n: reviewSummary.avg.toFixed(1), suffix: '/5', l: `${reviewSummary.count} review${reviewSummary.count === 1 ? '' : 's'}` },
  ].filter(Boolean);

  return (
    <>
      <Helmet>
        {/* Same title as the crawler render (api/og.js buildSalesmanHtml), name
            first so a search for the agent's name matches the title. */}
        <title>{pageTitle}</title>
        {/* `bio` only — `about_text` is the dealer storefront's "About us". */}
        <meta name="description" content={metaDescription} />
        {/* Shared as a link constantly, so it needs its own canonical + og:url. */}
        <link rel="canonical" href={`https://xdrive.my/s/${encodeURIComponent(profile.slug || slug)}`} />
        <meta property="og:url" content={`https://xdrive.my/s/${encodeURIComponent(profile.slug || slug)}`} />
        <meta property="og:type" content="profile" />
        <meta property="og:site_name" content="XDrive" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        {/* The wide cover makes the better link preview; avatar as fallback. */}
        {(profile.cover_url || profile.avatar_url) && (
          <meta property="og:image" content={profile.cover_url || profile.avatar_url} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      {/* Light, per DESIGN.md and docs/mockups/agent-page-light.html (MINI-LIGHT-1).
          Classes are ap- prefixed: this <style> is global while mounted. */}
      <style>{`
        .ap { min-height: 100vh; background: #F7F6F2; color: #111827; font-family: var(--xd-font-body); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
        .ap *, .ap *::before, .ap *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .ap a { color: inherit; }
                .ap-shell { max-width: 1360px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 48px); }
        .ap-cover { height: 150px; margin-top: 12px; border-radius: 16px; position: relative; overflow: hidden; border: 1px solid rgba(0,0,0,.06); background: linear-gradient(115deg, #DCE8F2 0%, #EEF0EA 45%, #F6E3CF 100%); }
        .ap-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        /* Scoped to the wave art ONLY. Plain '.ap-cover svg' also caught the
           icons inside the owner buttons and blew them up across the cover. */
        .ap-cover > svg.ap-waves { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 70%; }
        .ap-back { position: absolute; top: 12px; left: 12px; z-index: 2; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,.94); color: #0f1115; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 1px 3px rgba(15,23,42,.16); }
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
        .ap-grid { display: flex; flex-wrap: wrap; gap: 16px; }
        .ap-car { flex: 1 1 280px; max-width: 100%; overflow: hidden; text-decoration: none; display: block; transition: box-shadow .2s, transform .2s; }
        .ap-car:hover { box-shadow: 0 12px 32px rgba(15,23,42,.14); transform: translateY(-3px); }
        .ap-ph { aspect-ratio: 4 / 3; position: relative; background: #EDEAE3; overflow: hidden; }
        .ap-ph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .ap-nophoto { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #9ca3af; }
        .ap-ov { position: absolute; background: rgba(15,17,21,.78); color: #fff; font-size: 11px; font-weight: 600; padding: 4px 7px; border-radius: 4px; font-variant-numeric: tabular-nums; }
        .ap-tl { left: 10px; top: 10px; } .ap-br { right: 10px; bottom: 10px; }
        .ap-cb { padding: 14px 16px 16px; }
        .ap-cn { font-size: 15px; font-weight: 600; line-height: 1.3; color: #111827; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ap-cs { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12px; color: #6b7280; margin-top: 6px; font-variant-numeric: tabular-nums; }
        .ap-cs span + span::before { content: ''; display: inline-block; width: 3px; height: 3px; border-radius: 50%; background: #9ca3af; margin-right: 10px; vertical-align: middle; }
        .ap-pr { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,.06); }
        .ap-pr b { display: block; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: #0f1115; }
        .ap-mo { display: block; font-size: 12px; color: #6b7280; margin-top: 2px; font-variant-numeric: tabular-nums; }
        .ap-mo b { display: inline; font-size: 12px; font-weight: 600; color: #111827; }
        .ap-st { font-size: 12px; color: #4b5563; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .ap-st i { width: 6px; height: 6px; border-radius: 50%; }
        .ap-live { padding: 14px; margin-bottom: 8px; }
        .ap-live-h { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #111827; margin-bottom: 12px; }
        .ap-live-h i { width: 6px; height: 6px; border-radius: 50%; background: #dc2626; }
        .ap-live a.ap-live-car { display: flex; gap: 12px; text-decoration: none; min-width: 0; }
        .ap-live-ph { position: relative; width: 112px; flex-shrink: 0; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: #EDEAE3; }
        .ap-live-ph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .ap-live .ap-btn { margin-top: 12px; height: 44px; font-size: 14px; }
        .ap-nc { display: flex; flex-direction: column; gap: 12px; }
        .ap-nc-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,.06); }
        .ap-nc-h b { font-size: 15px; color: #111827; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ap-nc-h a { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,.1); color: #111827; font-size: 13px; font-weight: 600; text-decoration: none; }
        .ap-nc-h a svg { width: 15px; height: 15px; }
        .ap-nc-r { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 16px; font-size: 14px; }
        .ap-nc-r + .ap-nc-r { border-top: 1px solid rgba(0,0,0,.05); }
        .ap-nc-r span:first-child { color: #374151; min-width: 0; }
        .ap-nc-r span:last-child { flex-shrink: 0; color: #111827; font-weight: 600; font-variant-numeric: tabular-nums; }
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
        @media (min-width: 1024px) {
          .ap-cover { height: 220px; }
          .ap-cols { display: grid; grid-template-columns: 400px minmax(0, 1fr); gap: 48px; align-items: start; }
          .ap-left { position: sticky; top: 20px; }
          .ap-id { padding: 24px; }
          .ap-car { flex: 0 0 calc(50% - 8px); max-width: calc(50% - 8px); }
          .ap-sticky { display: none; }
          .ap-foot { padding-bottom: 48px; }
        }
      `}</style>

      <div className="ap">
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
            The page is the agent's own; XDrive is credited in the footer. */}

        <div className="ap-shell">
          {/* Cover: the agent's own photo, else the sky-to-sand fallback with the
              marketplace's warm wave bands (colour lives here and nowhere else). */}
          <div className="ap-cover">
            {profile.cover_url ? (
              <img src={profile.cover_url} alt="" />
            ) : (
              <svg className="ap-waves" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 70 C300 20 600 120 1200 50 V160 H0z" fill="#F2E6D6" fillOpacity=".85" />
                <path d="M0 110 C350 60 750 150 1200 90 V160 H0z" fill="#EDE5D8" />
                <path d="M0 135 C400 105 800 160 1200 125 V160 H0z" fill="#F7F6F2" />
              </svg>
            )}
            <button className="ap-back" onClick={goBack} aria-label="Back"><ArrowLeft size={18} /></button>
            {/* Logged-in visitor's way home; the owner also gets Live presentation. */}
            {viewerHome && (
              <div className="ap-owner">
                <Link to={viewerHome.to} style={ownerChip}>
                  {viewerHome.seller ? <LayoutDashboard size={12} /> : <User size={12} />} {viewerHome.label}
                </Link>
                {isOwner && !viewerHome.lite && listings.length > 0 && (
                  <button onClick={() => setPresenting(true)} style={ownerChip}>
                    <Radio size={12} /> Live presentation
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="ap-cols">
            <div className="ap-left">
              <div className="ap-card ap-id">
                <div className="ap-av">
                  {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name} /> : <div>{initial}</div>}
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
                      <svg viewBox="0 0 24 24" role="img" aria-label="Verified by XDrive"><circle cx="12" cy="12" r="10" fill="#111827" /><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </span>
                </h1>
                {profile.job_title && <p className="ap-role">{profile.job_title}</p>}
                {malayLine && <p className="ap-my">{malayLine}</p>}
                {/* Backed by a real business: name it and link its storefront. */}
                {dealer?.dealership && (
                  <p className="ap-works">
                    Works at{' '}
                    {dealer.subdomain
                      ? <a href={`https://${dealer.subdomain}.xdrive.my`}>{dealer.dealership}</a>
                      : <b>{dealer.dealership}</b>}
                  </p>
                )}
                {(isVerified || replyLabel) && (
                  <div className="ap-creds">
                    {isVerified && <span className="ap-cred"><ShieldCheck size={14} strokeWidth={2.2} />ID verified by XDrive</span>}
                    {/* Reply time is MEASURED from chat (get_agent_reply_time), never typed. */}
                    {replyLabel && <span className="ap-cred" title="Measured on XDrive chat"><Clock size={14} strokeWidth={2.2} />{replyLabel}</span>}
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

                {profile.bio && (
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

                {profile.specializations?.length > 0 && (
                  <div className="ap-tags">
                    {profile.specializations.map((spec, i) => <span key={i} className="ap-tag">{spec}</span>)}
                  </div>
                )}

                {/* The agent's own terms, only the parts they set (agentTrust.js). */}
                {terms.length > 0 && (
                  <div className="ap-terms">
                    <p className="ap-eb">My terms</p>
                    {terms.map((t) => (
                      <div key={t.key} className="ap-term"><span>{t.label}</span><span>{t.text}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="ap-right">
              {/* Live now: the car on the agent's live stream right now. Viewers
                  land here from the TikTok bio link, so it leads the column. */}
              {liveCar && (
                <>
                  <div className="ap-sec"><h2>On my live now</h2></div>
                  <div className="ap-card ap-live">
                    <p className="ap-live-h"><i />Showing #{liveIdx + 1}</p>
                    <Link to={`/showroom/${liveCar.slug}`} onClick={() => trackCardClick(liveCar)} className="ap-live-car">
                      <div className="ap-live-ph">
                        {Array.isArray(liveCar.images) && liveCar.images[0] && <img src={liveCar.images[0]} alt="" />}
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

              {/* New-car price list (NEWCAR-1). Official brand prices for the
                  advisor's zone; a zone with no price says "ask", never the
                  Peninsular number. No link to the public model page from
                  here: that page lists every advisor, and this is theirs. */}
              {newModelGroups.length > 0 && (
                <>
                  <div className="ap-sec"><h2>New {newBrand} prices</h2></div>
                  <p className="ap-docs">{priceBasis(newModels[0]?.price_zone)}</p>
                  <div className="ap-nc">
                    {newModelGroups.map((g) => {
                      const href = newCarWa(g.model);
                      return (
                        <div key={g.model} className="ap-card">
                          <div className="ap-nc-h">
                            <b>{newBrand} {g.model}</b>
                            {href && (
                              <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => trackNewCarWa(g.model)}>
                                {WA_ICON}<span>Ask</span>
                              </a>
                            )}
                          </div>
                          {g.variants.map((v) => (
                            <div key={v.model_id} className="ap-nc-r">
                              <span>{v.variant}</span>
                              <span>{rm(v.price) || 'Ask for price'}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {!(newModelGroups.length > 0 && listings.length === 0) && (
              <>
              <div className="ap-sec">
                <h2>Cars for sale{listings.length > 0 && <> <span>{listings.length}</span></>}</h2>
                {listings.length > 1 && (
                  <div className="ap-seg" role="group" aria-label="Sort cars">
                    <button aria-pressed={sortBy === 'newest'} onClick={() => setSortBy('newest')}>Newest</button>
                    <button aria-pressed={sortBy === 'price'} onClick={() => setSortBy('price')}>Price</button>
                  </div>
                )}
              </div>
              {/* Only cars a superadmin checked (car_listings.docs_verified). */}
              {docsLine && (
                <p className="ap-docs"><ShieldCheck size={14} style={{ flexShrink: 0, color: '#15803d' }} />{docsLine}</p>
              )}

              {listings.length > 0 ? (
                <div className="ap-grid">
                  {sortedListings.map((car) => (
                    <AgentCarCard key={car.id} car={car} num={numById.get(car.id)} onClick={() => trackCardClick(car)} />
                  ))}
                </div>
              ) : (
                <div className="ap-card" style={{ padding: '40px 20px', textAlign: 'center', fontSize: 14, color: '#6b7280' }}>
                  No cars for sale right now.
                </div>
              )}
              </>
              )}

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

              {/* Location: the agent's own address, else (linked) the dealership's. */}
              {mapLocationStr && (
                <>
                  <div className="ap-sec"><h2>{ownLocationStr ? 'Find me' : `Visit ${dealer?.dealership || 'the dealership'}`}</h2></div>
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

              {/* Seller reviews (same feature as CarDetailPage, seller-scoped). Its
                  tally feeds the stats row via onSummary. */}
              <ReviewsSection
                dealerId={profile.id}
                sellerName={profile.full_name || firstName || 'this seller'}
                isXdrive
                th={LIGHT_REVIEW_TH}
                onSummary={setReviewSummary}
              />
            </div>
          </div>

          {/* Buyer safety — XDrive takes no payment for any car — beside the way
              to flag this agent (report_seller). */}
          <div className="ap-safe">
            <p>XDrive never collects payment for a car. See the car and its geran before you pay any deposit, and get the deposit terms in writing.</p>
            <ReportListingButton sellerId={profile.id} th={LIGHT_SHEET_TH} />
          </div>
          <p className="ap-foot">{profile.full_name} sells through <a href="https://xdrive.my">XDrive</a> · <Link to="/showroom">Browse all used cars</Link></p>
        </div>

        {/* Mobile only: the contact button must not scroll away under the cars. */}
        {waHref && (
          <div className="ap-sticky">
            <div className="ap-mini">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}</div>
            <p className="ap-who"><b>{profile.full_name}</b>{replyLabel || `${listings.length} ${listings.length === 1 ? 'car' : 'cars'} for sale`}</p>
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="ap-btn">{WA_ICON}WhatsApp</a>
          </div>
        )}
      </div>

      {presenting && (
        <Suspense fallback={null}>
          <LivePresenter listings={listings} slug={slug} sellerId={profile?.id}
            sellerName={profile?.full_name} sellerPhone={isOwner ? viewerPhone : null} onClose={() => setPresenting(false)} />
        </Suspense>
      )}
    </>
  );
}
