import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const fmt = (n) => Number(n).toLocaleString('en-MY');

const ghostBtn = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#9ca3af',
  borderRadius: 99,
  padding: '0 18px',
  height: 42,
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  cursor: 'pointer',
  fontFamily: "'DM Sans',sans-serif",
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

      const queries = [
        supabase.from('car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour')
          .eq('dealer_id', p.id).eq('status', 'available').order('created_at', { ascending: false }),
        supabase.from('car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,colour')
          .eq('assigned_to', p.id).eq('status', 'available').order('created_at', { ascending: false }),
        supabase.from('car_listings').select('id', { count: 'exact', head: true }).eq('dealer_id', p.id).eq('status', 'sold'),
        supabase.from('car_listings').select('id', { count: 'exact', head: true }).eq('assigned_to', p.id).eq('status', 'sold'),
      ];

      const [ownedRes, assignedRes, soldOwnedRes, soldAssignedRes] = await Promise.all(queries);

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

  const waPhone = (profile?.whatsapp_number || '').replace(/\D/g, '');
  const waHref = waPhone ? `https://wa.me/${waPhone.startsWith('6') ? waPhone : '6' + waPhone}` : null;
  const firstName = (profile?.full_name || 'Agent').split(' ')[0];

  const fbHref = profile?.facebook
    ? (profile.facebook.startsWith('http') ? profile.facebook : `https://facebook.com/${profile.facebook}`)
    : null;
  const webHref = profile?.website
    ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`)
    : null;

  const locationCity = profile?.city || dealer?.city;
  const locationState = profile?.state || dealer?.state;
  const locationStr = [locationCity, locationState].filter(Boolean).join(', ');

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#05070e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#dc2626', animation: 'spin 0.8s linear infinite' }} />
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
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .sp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 640px) { .sp-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
        .sp-card { transition: border-color 0.15s, transform 0.15s; }
        .sp-card:hover { border-color: rgba(255,255,255,0.18) !important; transform: translateY(-1px); }
        .sp-social-btn:hover { background: rgba(255,255,255,0.09) !important; color: #e5e7eb !important; }
        .sp-wa-btn:hover { background: #1cb856 !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#080C14', fontFamily: "'DM Sans',sans-serif", color: '#fff' }}>

        {/* ── Hero ── */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px 32px', textAlign: 'center' }}>

          {/* Avatar */}
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name}
              style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 18px', border: '2px solid rgba(220,38,38,0.4)', boxShadow: '0 0 0 4px rgba(220,38,38,0.08)' }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#fff', margin: '0 auto 18px', border: '2px solid rgba(220,38,38,0.3)' }}>
              {(profile.full_name || 'S')[0].toUpperCase()}
            </div>
          )}

          {/* Name */}
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: '2.5px', color: '#f8fafc', marginBottom: 4, lineHeight: 1 }}>
            {profile.full_name}
          </h1>

          {/* Job title */}
          {profile.job_title && (
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>
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
            <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {locationStr}
            </p>
          )}

          {/* Stats chips */}
          <div style={{ display: 'inline-flex', gap: 0, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', marginBottom: profile.about_text ? 18 : 22 }}>
            <div style={{ padding: '10px 20px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{listings.length}</p>
              <p style={{ margin: '3px 0 0', fontSize: 9, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Available</p>
            </div>
            {soldCount > 0 && (
              <div style={{ padding: '10px 20px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{soldCount}</p>
                <p style={{ margin: '3px 0 0', fontSize: 9, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sold</p>
              </div>
            )}
            {profile.ic_number && (
              <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#10b981', lineHeight: 1 }}>Verified</p>
                  <p style={{ margin: '2px 0 0', fontSize: 9, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>XDrive</p>
                </div>
              </div>
            )}
          </div>

          {/* About */}
          {profile.about_text && (
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, marginBottom: 22, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
              {profile.about_text}
            </p>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="sp-wa-btn"
                style={{ background: '#25D366', color: '#fff', borderRadius: 99, padding: '0 22px', height: 42, fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.054 23.7a.5.5 0 0 0 .613.613l5.848-1.478A11.956 11.956 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.956 9.956 0 0 1-5.052-1.374l-.362-.214-3.742.948.963-3.619-.236-.373A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                Chat with {firstName}
              </a>
            )}
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                target="_blank" rel="noopener noreferrer" className="sp-social-btn"
                style={{ ...ghostBtn, transition: 'background 0.15s, color 0.15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
                Instagram
              </a>
            )}
            {profile.tiktok && (
              <a href={`https://tiktok.com/@${profile.tiktok.replace(/^@/, '')}`}
                target="_blank" rel="noopener noreferrer" className="sp-social-btn"
                style={{ ...ghostBtn, transition: 'background 0.15s, color 0.15s' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.75a4.85 4.85 0 01-1-.06z"/>
                </svg>
                TikTok
              </a>
            )}
            {fbHref && (
              <a href={fbHref} target="_blank" rel="noopener noreferrer" className="sp-social-btn"
                style={{ ...ghostBtn, transition: 'background 0.15s, color 0.15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                </svg>
                Facebook
              </a>
            )}
            {webHref && (
              <a href={webHref} target="_blank" rel="noopener noreferrer" className="sp-social-btn"
                style={{ ...ghostBtn, transition: 'background 0.15s, color 0.15s' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                Website ↗
              </a>
            )}
          </div>
        </div>

        {/* ── Featured Listing ── */}
        {featured && (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 28px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Featured</p>
            <Link to={`/showroom/${featured.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div className="sp-card" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ position: 'relative', paddingTop: '52%', background: '#111', overflow: 'hidden' }}>
                  {featured.images?.[0] ? (
                    <img src={featured.images[0]} alt={`${featured.brand} ${featured.model}`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 12, color: '#374151' }}>No photo</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                    ⭐ Featured
                  </div>
                </div>
                <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[featured.year, featured.brand, featured.model].filter(Boolean).join(' ')}
                    </p>
                    <p style={{ fontSize: 11, color: '#4b5563' }}>
                      {[featured.variant, featured.mileage ? `${fmt(featured.mileage)} km` : null, featured.transmission].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {featured.selling_price > 0 && (
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        RM {fmt(featured.selling_price)}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>View details →</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* ── All Listings ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
          {rest.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
                All Listings{listings.length > 1 ? ` (${listings.length})` : ''}
              </p>
              <div className="sp-grid">
                {rest.map(car => {
                  const img = Array.isArray(car.images) ? car.images[0] : null;
                  return (
                    <Link key={car.id} to={`/showroom/${car.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="sp-card"
                        style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ position: 'relative', paddingTop: '60%', background: '#111', overflow: 'hidden' }}>
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
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 3 }}>
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
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>🚗</p>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>No active listings</p>
              <p style={{ fontSize: 12, color: '#1f2937' }}>Check back soon for new cars from {profile.full_name?.split(' ')[0] || 'this agent'}.</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '22px 0', textAlign: 'center' }}>
          <a href="https://xdrive.my" style={{ fontSize: 12, color: '#374151', textDecoration: 'none', fontFamily: "'DM Sans',sans-serif" }}>
            Powered by <span style={{ color: '#dc2626', fontWeight: 700 }}>XDrive</span>
          </a>
        </div>

      </div>
    </>
  );
}
