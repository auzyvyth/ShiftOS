import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { Clock, LayoutDashboard, MapPin, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ReviewsSection from '../components/reviews/ReviewsSection';
import { ROLE_ROUTES } from '../hooks/useRoleRedirect';
import { trackEvent } from '../utils/analytics';
import { captureRef } from '../utils/refTracking';

const fmt = (n) => Number(n).toLocaleString('en-MY');

// Dark-surface theme tokens for ReviewsSection on the mini pages.
const DARK_REVIEW_TH = {
  text: '#e8edf5', textSec: 'rgba(255,255,255,0.62)', textMuted: 'rgba(255,255,255,0.42)',
  border: 'rgba(255,255,255,0.08)', borderSec: 'rgba(255,255,255,0.05)',
  card: 'rgba(255,255,255,0.03)', inputBg: 'rgba(255,255,255,0.05)',
};

// Icon-only social link — no label, no pill background, just the mark.
const iconLink = {
  background: 'none',
  border: 'none',
  color: '#9ca3af',
  padding: 0,
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'color 0.15s',
};

export default function SalesmanProfilePage() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [dealer, setDealer] = useState(null);
  const [listings, setListings] = useState([]);
  const [soldCount, setSoldCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const bioRef = useRef(null);
  const [bioOverflows, setBioOverflows] = useState(false);
  const [viewerDashboardRoute, setViewerDashboardRoute] = useState(null);
  // Fire the mini-page visit exactly once per mount (StrictMode double-invokes).
  const visitTracked = useRef(false);

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
      metadata: { source: 'minipage_card' },
    });
  };

  // If the visitor is logged in, surface a quick way back to their own
  // dashboard — most useful when a salesman previews their own mini page
  // and would otherwise have no way back without hitting the browser's
  // back button.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data?.session?.user?.id;
      if (!uid || cancelled) return;
      const { data: viewer } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
      if (cancelled || !viewer?.role) return;
      setViewerDashboardRoute(ROLE_ROUTES[viewer.role] ?? null);
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

      const [ownedRes, assignedRes, featuredRes, soldOwnedRes, soldAssignedRes] = await Promise.all([
        supabase.from('public_car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour,dealer_id')
          .eq('dealer_id', p.id).in('status', ['available', 'reserved']).order('created_at', { ascending: false }),
        supabase.from('public_car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour,dealer_id')
          .eq('assigned_to', p.id).in('status', ['available', 'reserved']).order('created_at', { ascending: false }),
        // Linked salesmen feature dealer cars via salesman_listings (car stays
        // owned by the dealer, assigned_to null) — the two queries above miss
        // those, so pull them via a SECURITY DEFINER RPC.
        supabase.rpc('get_salesman_featured_listings', { p_salesman_id: p.id }),
        supabase.from('public_car_listings').select('id', { count: 'exact', head: true }).eq('dealer_id', p.id).eq('status', 'sold'),
        supabase.from('public_car_listings').select('id', { count: 'exact', head: true }).eq('assigned_to', p.id).eq('status', 'sold'),
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

      setSoldCount((soldOwnedRes.count || 0) + (soldAssignedRes.count || 0));
      setListings(lst);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (bioRef.current) {
      setBioOverflows(bioRef.current.scrollHeight > bioRef.current.clientHeight + 2);
    }
  }, [profile?.bio, bioExpanded]);

  const waPhone = (profile?.whatsapp_number || '').replace(/\D/g, '');
  const firstName = (profile?.full_name || 'Agent').split(' ')[0];
  const waMessage = `Hi ${firstName}, I came across your listings on ShiftOS and would like to know more.`;
  const waHref = waPhone ? `https://wa.me/${waPhone.startsWith('6') ? waPhone : '6' + waPhone}?text=${encodeURIComponent(waMessage)}` : null;
  const isVerified = !!(profile?.is_verified);
  const locationCity = profile?.city || dealer?.city;
  const locationState = profile?.state || dealer?.state;
  const locationStr = [locationCity, locationState].filter(Boolean).join(', ');

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
    <div style={{ minHeight: '100vh', background: '#0b0e15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#2563eb', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#0b0e15', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "system-ui,sans-serif", padding: '0 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 8 }}>Agent not found</p>
      <p style={{ fontSize: 13, color: '#374151' }}>This page doesn't exist or has been removed.</p>
    </div>
  );

  const facebookHref = profile.facebook
    ? (profile.facebook.startsWith('http') ? profile.facebook : `https://facebook.com/${profile.facebook.replace(/^@/, '')}`)
    : null;
  const websiteHref = profile.website
    ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`)
    : null;

  return (
    <>
      <Helmet>
        <title>{profile.full_name} · XDrive</title>
        <meta name="description" content={profile.about_text || `Browse cars from ${profile.full_name} on XDrive`} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={`${profile.full_name} · Car Agent on XDrive`} />
        <meta property="og:description" content={profile.about_text || `${listings.length} cars available`} />
        {/* Prefer the cover banner (a wide, landscape image) for the link
            preview so a shared mini-page shows the agent's own banner, not a
            square avatar or the generic site image. */}
        {(profile.cover_url || profile.avatar_url) && (
          <meta property="og:image" content={profile.cover_url || profile.avatar_url} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        /* minmax(0,1fr) — not plain 1fr — so a long non-wrapping car name can't
           blow a column past its share and push the grid wider than the screen
           (that overflow, clipped by the page's overflowX:hidden, was cutting
           the right-hand cards). Columns stay exactly equal. */
        .sp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        @media (max-width: 640px) { .sp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
        .sp-card { transition: border-color 0.18s, transform 0.18s; }
        .sp-card:hover { border-color: rgba(255,255,255,0.18) !important; transform: translateY(-2px); }
        .social-btn:hover { color: #e5e7eb !important; }
      `}</style>

      <div style={{ minHeight: '100vh', position: 'relative', background: '#0b0e15', fontFamily: "system-ui,sans-serif", color: '#fff', overflowX: 'hidden' }}>

        {/* Decorative backdrop — soft warm-gold glow in the top-left melting into
            a cool dark slate, matching the reference. Fixed to the viewport so it
            stays put on a long listings page. Pure gradients = naturally soft, no
            hard lines. */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 95% 78% at 2% -12%, rgba(216,178,94,0.42) 0%, rgba(178,150,90,0.14) 33%, transparent 62%),
            radial-gradient(ellipse 90% 70% at 104% 106%, rgba(12,16,24,0.65) 0%, transparent 55%),
            linear-gradient(150deg, #1b202b 0%, #141822 46%, #0b0e15 100%)
          `,
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Cover banner — Facebook/blog-post style: capped to the same
            max width as the content below (not full-bleed across the
            viewport — on desktop that stretched into a thin "ribbon" and
            left the avatar, which is positioned against this same wrapper,
            stranded far to the left of the centered name/content column).
            The avatar is positioned absolutely against this wrapper (not a
            sibling with a negative margin) so it can never end up painted
            behind the banner regardless of DOM/stacking edge cases. ── */}
        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <div style={{
            width: '100%', height: 'clamp(150px, 30vw, 190px)', overflow: 'hidden',
            background: profile.cover_url
              ? `center / cover no-repeat url(${profile.cover_url})`
              : 'linear-gradient(135deg, #2a3142 0%, #1b202b 55%, #10131b 100%)',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(11,14,21,0.5) 100%)' }} />
          </div>

          {/* Quick way back for a logged-in visitor (most often the agent
              themselves previewing this page) — jumps to whichever
              dashboard their own role resolves to. */}
          {viewerDashboardRoute && (
            <Link to={viewerDashboardRoute}
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(11,14,21,0.72)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 99, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
              <LayoutDashboard size={13} /> Dashboard
            </Link>
          )}

          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name}
              style={{ position: 'absolute', left: 'clamp(14px, 5vw, 24px)', bottom: -46, zIndex: 2, width: 92, height: 92, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '4px solid #0b0e15', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }} />
          ) : (
            <div style={{ position: 'absolute', left: 'clamp(14px, 5vw, 24px)', bottom: -46, zIndex: 2, width: 92, height: 92, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 700, color: '#fff', border: '4px solid #0b0e15', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
              {(profile.full_name || 'S')[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* ── Hero ── */}
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 clamp(14px, 5vw, 24px) 28px' }}>

          {/* Name (+ verified badge) and listing count sit in the space the
              avatar overlaps — name padded clear of the avatar, count
              anchored to the right, both bottom-aligned with the banner. */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, minHeight: 46, marginBottom: 14 }}>
            <div style={{ minWidth: 0, paddingLeft: 106 }}>
              <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: '1.5px', color: '#f1f5f9', lineHeight: 1.05, display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.full_name}</span>
                {isVerified && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6" style={{ flexShrink: 0 }} title="Verified by XDrive">
                    <circle cx="12" cy="12" r="11"/>
                    <path d="M7.5 12.5l2.8 2.8 6-6.5" stroke="#0b0e15" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                )}
              </h1>
              {profile.job_title && (
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.job_title}
                </p>
              )}
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{listings.length}</p>
              <p style={{ margin: '2px 0 0', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Available</p>
              {soldCount > 0 && (
                <p style={{ margin: '3px 0 0', fontSize: 10, color: '#4ade80', fontWeight: 700 }}>{soldCount} sold</p>
              )}
            </div>
          </div>

          {/* Dealership + location */}
          {(dealer?.dealership || locationStr) && (
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              {dealer?.dealership && <span style={{ fontWeight: 600 }}>{dealer.dealership}</span>}
              {dealer?.dealership && locationStr && <span style={{ color: '#374151' }}>·</span>}
              {locationStr && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#4b5563' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {locationStr}
                </span>
              )}
            </p>
          )}

          {/* Specializations */}
          {profile.specializations && profile.specializations.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {profile.specializations.map((spec, i) => (
                <span key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: '#d1d5db', borderRadius: 99, padding: '4px 12px', fontSize: 11, fontWeight: 500, letterSpacing: '0.02em' }}>
                  {spec}
                </span>
              ))}
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <div style={{ marginBottom: 18, maxWidth: 460 }}>
              <p
                ref={bioRef}
                style={{
                  fontSize: 13,
                  color: '#94a3b8',
                  lineHeight: 1.75,
                  margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: bioExpanded ? 'unset' : 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: bioExpanded ? 'visible' : 'hidden',
                }}
              >
                {profile.bio}
              </p>
              {(bioOverflows || bioExpanded) && (
                <button
                  onClick={() => setBioExpanded(v => !v)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 0 0', display: 'inline-block' }}
                >
                  {bioExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* About */}
          {profile.about_text && (
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, marginBottom: 22, maxWidth: 440 }}>
              {profile.about_text}
            </p>
          )}

          {/* Response Time */}
          {profile.response_time && (
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} strokeWidth={2} style={{ flexShrink: 0, color: '#4b5563' }} />
              {profile.response_time}
            </p>
          )}

          {/* Primary CTA (WhatsApp) + icon-only social links, all inline on
              the same row so the icons sit on the button's y-axis. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer"
                style={{ background: '#25D366', color: '#fff', fontWeight: 700, fontSize: 12, borderRadius: 8, padding: '9px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.054 23.7a.5.5 0 0 0 .613.613l5.848-1.478A11.956 11.956 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.956 9.956 0 0 1-5.052-1.374l-.362-.214-3.742.948.963-3.619-.236-.373A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                Chat with {firstName}
              </a>
            )}
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                target="_blank" rel="noopener noreferrer" className="social-btn" style={iconLink} title="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            )}
            {profile.tiktok && (
              <a href={`https://tiktok.com/@${profile.tiktok.replace(/^@/, '')}`}
                target="_blank" rel="noopener noreferrer" className="social-btn" style={iconLink} title="TikTok">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.95a8.16 8.16 0 0 0 4.77 1.52V7.01a4.85 4.85 0 0 1-1-.32z"/></svg>
              </a>
            )}
            {facebookHref && (
              <a href={facebookHref} target="_blank" rel="noopener noreferrer" className="social-btn" style={iconLink} title="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            )}
            {websiteHref && (
              <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="social-btn" style={iconLink} title="Website">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </a>
            )}
          </div>

          {/* Location moved below the listings grid (see "Find Me Here" block
              after All Listings) so the cars lead the page. */}
        </div>

        {/* ── Divider ── */}
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 clamp(14px, 5vw, 24px)' }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
        </div>

        {/* ── All Listings ── */}
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px clamp(14px, 5vw, 24px) 80px' }}>
          {listings.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>
                Listings{listings.length > 1 ? ` (${listings.length})` : ''}
              </p>
              <div className="sp-grid">
                {listings.map(car => {
                  const img = Array.isArray(car.images) ? car.images[0] : null;
                  return (
                    <Link key={car.id} to={`/showroom/${car.slug}`} onClick={() => trackCardClick(car)} style={{ textDecoration: 'none', color: 'inherit', display: 'block', minWidth: 0 }}>
                      <div className="sp-card"
                        style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ position: 'relative', paddingTop: '65%', background: '#0a0e18', overflow: 'hidden' }}>
                          {img ? (
                            <img src={img} alt={`${car.brand} ${car.model}`} loading="lazy"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 11, color: '#374151' }}>No photo</span>
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[car.year, car.brand, car.model].filter(Boolean).join(' ')}
                          </p>
                          {car.variant && (
                            <p style={{ fontSize: 10, color: '#4b5563', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {car.variant}
                            </p>
                          )}
                          {car.selling_price > 0 && (
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>
                              RM {fmt(car.selling_price)}
                            </p>
                          )}
                          <p style={{ fontSize: 10, color: '#374151' }}>
                            {[car.mileage ? `${fmt(car.mileage)} km` : null, car.transmission].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {listings.length === 0 && (
            <p style={{ fontSize: 13, color: '#374151', padding: '48px 0', textAlign: 'center' }}>
              No active listings at the moment.
            </p>
          )}

          {/* ── Location — moved below the car cards. The agent's own address,
              or (linked salesmen with none set) the dealership's. Capped at the
              hero width and centered so it doesn't stretch across the wide grid. ── */}
          {mapLocationStr && (
            <div style={{ maxWidth: 640, margin: '36px auto 0' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                {ownLocationStr ? 'Find Me Here' : `Visit ${dealer?.dealership || 'the dealership'}`}
              </p>
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <iframe
                  title={ownLocationStr ? 'My location' : 'Dealership location'}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(mapLocationStr)}&output=embed`}
                  width="100%" height="150" loading="lazy"
                  style={{ border: 0, display: 'block', filter: 'grayscale(0.2) contrast(1.05)' }}
                />
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(mapLocationStr)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#0d1117', color: '#93c5fd', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  <MapPin size={13} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mapLocationStr}</span>
                  <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
                </a>
              </div>
            </div>
          )}

          {/* ── Seller reviews (same feature as CarDetailPage, seller-scoped) ── */}
          <ReviewsSection
            dealerId={profile.id}
            sellerName={profile.full_name || firstName || 'this seller'}
            isXdrive={false}
            th={DARK_REVIEW_TH}
          />
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '22px 0', textAlign: 'center' }}>
          <a href="https://xdrive.my" style={{ fontSize: 12, color: '#374151', textDecoration: 'none' }}>
            Powered by <span style={{ color: '#3b82f6', fontWeight: 700 }}>XDrive</span>
          </a>
        </div>

        </div>
      </div>
    </>
  );
}
