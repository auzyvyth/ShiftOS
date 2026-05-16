import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const fmt = (n) => Number(n).toLocaleString('en-MY');

export default function SalesmanProfilePage() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
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

      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(p);

      // salesman_lite own their listings (dealer_id = p.id)
      // regular salesmen are assigned listings (assigned_to = p.id)
      const [ownedRes, assignedRes] = await Promise.all([
        supabase
          .from('car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,status')
          .eq('dealer_id', p.id)
          .eq('status', 'available')
          .order('created_at', { ascending: false }),
        supabase
          .from('car_listings')
          .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,status')
          .eq('assigned_to', p.id)
          .eq('status', 'available')
          .order('created_at', { ascending: false }),
      ]);
      const seen = new Set();
      const lst = [...(ownedRes.data || []), ...(assignedRes.data || [])].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      setListings(lst || []);
      setLoading(false);
    }
    load();
  }, [slug]);

  const waPhone = (profile?.whatsapp_number || '').replace(/\D/g, '');
  const waHref  = waPhone ? `https://wa.me/${waPhone.startsWith('6') ? waPhone : '6' + waPhone}` : null;
  const firstName = (profile?.full_name || 'Agent').split(' ')[0];

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#05070e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#2563eb', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#05070e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif", padding: '0 24px', textAlign: 'center' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap');`}</style>
      <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 8 }}>Profile not found</p>
      <p style={{ fontSize: 13, color: '#374151', marginBottom: 24 }}>
        This salesman hasn't unlocked their profile page yet.
      </p>
      {waHref && (
        <a href={waHref} target="_blank" rel="noopener noreferrer"
          style={{ background: '#25D366', color: '#fff', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          WhatsApp {firstName}
        </a>
      )}
    </div>
  );

  return (
    <>
      <Helmet>
        <title>{profile.full_name} · XDrive</title>
        <meta name="description" content={profile.about_text || `Browse cars from ${profile.full_name} on XDrive`} />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .sp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 640px) { .sp-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#05070e', fontFamily: "'DM Sans',sans-serif", color: '#fff' }}>

        {/* ── Hero ── */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '56px 24px 40px', textAlign: 'center' }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name}
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 16px' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', margin: '0 auto 16px' }}>
              {(profile.full_name || 'S')[0].toUpperCase()}
            </div>
          )}

          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: '2px', color: '#fff', marginBottom: 4 }}>
            {profile.full_name}
          </h1>

          {profile.job_title && (
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>{profile.job_title}</p>
          )}

          {profile.about_text && (
            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7, marginTop: 12, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
              {profile.about_text}
            </p>
          )}

          {/* CTA + socials row */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer"
                style={{ background: '#25D366', color: '#fff', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Chat with {firstName}
              </a>
            )}
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                target="_blank" rel="noopener noreferrer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', borderRadius: 8, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>
                Instagram
              </a>
            )}
            {profile.tiktok && (
              <a href={`https://tiktok.com/@${profile.tiktok.replace(/^@/, '')}`}
                target="_blank" rel="noopener noreferrer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', borderRadius: 8, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>
                TikTok
              </a>
            )}
          </div>
        </div>

        {/* ── Listings ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 }}>
            My Listings ({listings.length})
          </p>

          {listings.length === 0 ? (
            <p style={{ fontSize: 13, color: '#374151', padding: '40px 0', textAlign: 'center' }}>
              No active listings at the moment.
            </p>
          ) : (
            <div className="sp-grid">
              {listings.map(car => {
                const img = Array.isArray(car.images) ? car.images[0] : null;
                return (
                  <Link key={car.id} to={`/cars/${car.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div
                      style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
                    >
                      <div style={{ position: 'relative', paddingTop: '62%', background: '#111', overflow: 'hidden' }}>
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
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[car.year, car.brand, car.model].filter(Boolean).join(' ')}
                        </p>
                        {car.selling_price > 0 && (
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>
                            RM {fmt(car.selling_price)}
                          </p>
                        )}
                        <p style={{ fontSize: 10, color: '#4b5563' }}>
                          {[car.mileage ? `${fmt(car.mileage)} km` : null, car.transmission].filter(Boolean).join(' · ')}
                        </p>
                        <p style={{ fontSize: 11, color: '#3b82f6', marginTop: 8 }}>View Listing →</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '20px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#374151' }}>Powered by XDrive</p>
        </div>

      </div>
    </>
  );
}
