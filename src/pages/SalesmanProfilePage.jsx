import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';

const fmt = (n) => Number(n).toLocaleString('en-MY');

const ghostBtn = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#9ca3af',
  borderRadius: 99,
  padding: '9px 18px',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  transition: 'border-color 0.15s',
  whiteSpace: 'nowrap',
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

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('slug', slug)
        .eq('role', 'salesman')
        .maybeSingle();

      if (!p) { setNotFound(true); setLoading(false); return; }
      setProfile(p);

      const [ownedRes, assignedRes, soldOwnedRes, soldAssignedRes] = await Promise.all([
        supabase.from('car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour')
          .eq('dealer_id', p.id).eq('status', 'available').order('created_at', { ascending: false }),
        supabase.from('car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour')
          .eq('assigned_to', p.id).eq('status', 'available').order('created_at', { ascending: false }),
        supabase.from('car_listings').select('id', { count: 'exact', head: true }).eq('dealer_id', p.id).eq('status', 'sold'),
        supabase.from('car_listings').select('id', { count: 'exact', head: true }).eq('assigned_to', p.id).eq('status', 'sold'),
      ]);

      if (p.dealer_id) {
        const { data: d } = await supabase.from('profiles')
          .select('dealership, city, state')
          .eq('id', p.dealer_id).maybeSingle();
        setDealer(d);
      }

      const seen = new Set();
      const lst = [...(ownedRes.data || []), ...(assignedRes.data || [])].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      setSoldCount((soldOwnedRes.count || 0) + (soldAssignedRes.count || 0));
      setListings(lst);
      setLoading(false);
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (bioRef.current) {
      setBioOverflows(bioRef.current.scrollHeight > bioRef.current.clientHeight + 2);
    }
  }, [profile?.bio, bioExpanded]);

  const waPhone = (profile?.whatsapp_number || '').replace(/\D/g, '');
  const waHref = waPhone ? `https://wa.me/${waPhone.startsWith('6') ? waPhone : '6' + waPhone}` : null;
  const firstName = (profile?.full_name || 'Agent').split(' ')[0];
  const isVerified = !!(profile?.ic_number);
  const locationCity = profile?.city || dealer?.city;
  const locationState = profile?.state || dealer?.state;
  const locationStr = [locationCity, locationState].filter(Boolean).join(', ');

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#05070e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#2563eb', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#05070e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif", padding: '0 24px', textAlign: 'center' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap');`}</style>
      <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 8 }}>Agent not found</p>
      <p style={{ fontSize: 13, color: '#374151' }}>This page doesn't exist or has been removed.</p>
    </div>
  );

  const featured = listings[0] || null;
  const rest = listings.slice(1);

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
        <meta property="og:title" content={`${profile.full_name} · Car Agent on XDrive`} />
        <meta property="og:description" content={profile.about_text || `${listings.length} cars available`} />
        {profile.avatar_url && <meta property="og:image" content={profile.avatar_url} />}
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .sp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 640px) { .sp-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
        .sp-card { transition: border-color 0.18s, transform 0.18s; }
        .sp-card:hover { border-color: rgba(255,255,255,0.18) !important; transform: translateY(-2px); }
        .social-btn:hover { border-color: rgba(255,255,255,0.22) !important; color: #e5e7eb !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#05070e', fontFamily: "'DM Sans',sans-serif", color: '#fff' }}>

        {/* ── Hero ── */}
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px 32px', textAlign: 'center' }}>

          {/* Avatar */}
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name}
              style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 18px', border: '2px solid rgba(255,255,255,0.12)', boxShadow: '0 0 0 4px rgba(255,255,255,0.04)' }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#fff', margin: '0 auto 18px', boxShadow: '0 0 0 4px rgba(255,255,255,0.04)' }}>
              {(profile.full_name || 'S')[0].toUpperCase()}
            </div>
          )}

          {/* Name */}
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, letterSpacing: '2.5px', color: '#f1f5f9', marginBottom: 4, lineHeight: 1 }}>
            {profile.full_name}
          </h1>

          {/* Job title */}
          {profile.job_title && (
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
              {profile.job_title}
            </p>
          )}

          {/* Dealership name */}
          {dealer?.dealership && (
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4, fontWeight: 500 }}>
              {dealer.dealership}
            </p>
          )}

          {/* Location */}
          {locationStr && (
            <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {locationStr}
            </p>
          )}

          {/* Specializations */}
          {profile.specializations && profile.specializations.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
              {profile.specializations.map((spec, i) => (
                <span key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: '#d1d5db', borderRadius: 99, padding: '4px 12px', fontSize: 11, fontWeight: 500, letterSpacing: '0.02em' }}>
                  {spec}
                </span>
              ))}
            </div>
          )}

          {/* Stats strip */}
          <div style={{ display: 'inline-flex', gap: 0, background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', marginBottom: (profile.about_text || profile.bio) ? 18 : 22 }}>
            <div style={{ padding: '10px 20px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{listings.length}</p>
              <p style={{ margin: '3px 0 0', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Available</p>
            </div>
            {soldCount > 0 && (
              <div style={{ padding: '10px 20px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{soldCount}</p>
                <p style={{ margin: '3px 0 0', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sold</p>
              </div>
            )}
            {isVerified && (
              <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0, boxShadow: '0 0 6px #10b981' }} />
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#10b981', lineHeight: 1 }}>Verified</p>
                  <p style={{ margin: '2px 0 0', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>XDrive</p>
                </div>
              </div>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div style={{ marginBottom: 18, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', textAlign: 'left' }}>
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
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, marginBottom: 22, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
              {profile.about_text}
            </p>
          )}

          {/* Response Time */}
          {profile.response_time && (
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Clock size={12} strokeWidth={2} style={{ flexShrink: 0, color: '#4b5563' }} />
              {profile.response_time}
            </p>
          )}

          {/* Social / CTA row */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="social-btn"
                style={{ ...ghostBtn, background: '#25D366', border: '1px solid #25D366', color: '#fff', fontWeight: 700, borderRadius: 9, padding: '11px 22px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.054 23.7a.5.5 0 0 0 .613.613l5.848-1.478A11.956 11.956 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.956 9.956 0 0 1-5.052-1.374l-.362-.214-3.742.948.963-3.619-.236-.373A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                Chat with {firstName}
              </a>
            )}
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                target="_blank" rel="noopener noreferrer" className="social-btn" style={ghostBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                Instagram
              </a>
            )}
            {profile.tiktok && (
              <a href={`https://tiktok.com/@${profile.tiktok.replace(/^@/, '')}`}
                target="_blank" rel="noopener noreferrer" className="social-btn" style={ghostBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.95a8.16 8.16 0 0 0 4.77 1.52V7.01a4.85 4.85 0 0 1-1-.32z"/></svg>
                TikTok
              </a>
            )}
            {facebookHref && (
              <a href={facebookHref} target="_blank" rel="noopener noreferrer" className="social-btn" style={ghostBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </a>
            )}
            {websiteHref && (
              <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="social-btn" style={ghostBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Website ↗
              </a>
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
        </div>

        {/* ── Featured Listing ── */}
        {featured && (
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 24px 0' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Featured</p>
            <Link to={`/showroom/${featured.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div className="sp-card" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ position: 'relative', paddingTop: '48%', background: '#0a0e18', overflow: 'hidden' }}>
                  {featured.images?.[0] ? (
                    <img src={featured.images[0]} alt={`${featured.brand} ${featured.model}`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 12, color: '#374151' }}>No photo</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,17,23,0.9) 0%, transparent 50%)' }} />
                  <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', letterSpacing: '0.06em' }}>
                    ⭐ FEATURED
                  </div>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[featured.year, featured.brand, featured.model, featured.variant].filter(Boolean).join(' ')}
                    </p>
                    <p style={{ fontSize: 11, color: '#4b5563' }}>
                      {[featured.mileage ? `${fmt(featured.mileage)} km` : null, featured.transmission, featured.colour].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {featured.selling_price > 0 && (
                      <p style={{ fontSize: 22, fontWeight: 800, color: '#60a5fa', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        RM {fmt(featured.selling_price)}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: '#3b82f6', marginTop: 5, fontWeight: 600 }}>View details →</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* ── All Listings ── */}
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 80px' }}>
          {rest.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>
                All Listings{listings.length > 1 ? ` (${listings.length})` : ''}
              </p>
              <div className="sp-grid">
                {rest.map(car => {
                  const img = Array.isArray(car.images) ? car.images[0] : null;
                  return (
                    <Link key={car.id} to={`/showroom/${car.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '22px 0', textAlign: 'center' }}>
          <a href="https://xdrive.my" style={{ fontSize: 12, color: '#374151', textDecoration: 'none' }}>
            Powered by <span style={{ color: '#3b82f6', fontWeight: 700 }}>XDrive</span>
          </a>
        </div>

      </div>
    </>
  );
}
