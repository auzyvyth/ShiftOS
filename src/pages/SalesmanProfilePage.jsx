import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { captureRef } from '../utils/refTracking';
import { Phone, MessageCircle, Instagram, Globe, Facebook } from 'lucide-react';

const fmt = (n) => Number(n).toLocaleString('en-MY');

export default function SalesmanProfilePage() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    captureRef();
  }, []);

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

      // For both lite and full: show cars assigned to this salesman
      const { data: lst } = await supabase
        .from('car_listings')
        .select('id,slug,year,brand,model,variant,selling_price,images,mileage,transmission,fuel_type,state,status,is_recon')
        .eq('assigned_to', p.id)
        .neq('status', 'sold')
        .order('created_at', { ascending: false });

      setListings(lst || []);
      setLoading(false);
    }
    load();
  }, [slug]);

  const waPhone = (profile?.whatsapp_number || '').replace(/\D/g, '');
  const waHref = waPhone
    ? `https://wa.me/${waPhone.startsWith('6') ? waPhone : '6' + waPhone}`
    : null;
  const firstName = (profile?.full_name || 'Agent').split(' ')[0];

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#dc2626', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#060c14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif", padding: '0 24px', textAlign: 'center', color: '#fff' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap');`}</style>
      <p style={{ fontSize: 15, color: '#4b5563', marginBottom: 24 }}>Agent not found.</p>
      <Link to="/cars" style={{ fontSize: 13, color: '#dc2626', textDecoration: 'none' }}>← Browse cars</Link>
    </div>
  );

  const availableCount = listings.filter(c => c.status === 'available').length;

  return (
    <>
      <Helmet>
        <title>{profile.full_name} · Car Agent on XDrive</title>
        <meta name="description" content={profile.about_text || `Browse cars from ${profile.full_name} on XDrive. ${availableCount} cars available.`} />
      </Helmet>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060c14; }
        .sp-root { min-height: 100vh; background: #060c14; font-family: 'DM Sans', sans-serif; color: #fff; padding-bottom: 80px; }
        .sp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .sp-card { background: #0a1220; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; display: block; transition: border-color 0.2s, transform 0.2s; }
        .sp-card:hover { border-color: rgba(220,38,38,0.3); transform: translateY(-2px); }
        .sp-wa-float { position: fixed; bottom: 20px; right: 20px; z-index: 50; background: #22c55e; border: none; border-radius: 50px; padding: 14px 22px; color: white; font-weight: 700; font-size: 14px; font-family: 'DM Sans', sans-serif; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 8px 32px rgba(34,197,94,0.35); border-top: 2px solid #16a34a; text-decoration: none; }
        @media (max-width: 680px) { .sp-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
        @media (max-width: 400px) { .sp-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="sp-root">

        {/* ── Back bar ── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Link to="/cars" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back to marketplace
          </Link>
        </div>

        {/* ── Hero ── */}
        <div style={{ background: 'linear-gradient(180deg, #0a1220 0%, #060c14 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '40px 24px 36px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>

            {/* Avatar */}
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name}
                style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 18px', border: '2px solid rgba(220,38,38,0.4)' }} />
            ) : (
              <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: '#fff', margin: '0 auto 18px' }}>
                {(profile.full_name || 'S')[0].toUpperCase()}
              </div>
            )}

            {/* Name */}
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2rem,7vw,2.8rem)', letterSpacing: '2px', color: '#fff', lineHeight: 1, marginBottom: 6 }}>
              {profile.full_name}
            </h1>

            {profile.job_title && (
              <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {profile.job_title}
              </p>
            )}

            {/* Location */}
            {(profile.city || profile.state) && (
              <p style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
                <MapPin size={12} /> {[profile.city, profile.state].filter(Boolean).join(', ')}
              </p>
            )}

            {/* Bio */}
            {profile.about_text && (
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.8, maxWidth: 480, margin: '0 auto 20px' }}>
                {profile.about_text}
              </p>
            )}

            {/* Stats pills */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
              <span style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#f87171', fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 20 }}>
                <Car size={11} style={{ display: 'inline', marginRight: 5 }} />{availableCount} Cars Available
              </span>
              <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 12, padding: '5px 14px', borderRadius: 20 }}>
                XDrive Agent
              </span>
            </div>

            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {waHref && (
                <a href={waHref} target="_blank" rel="noopener noreferrer"
                  style={{ background: '#22c55e', borderTop: '2px solid #16a34a', color: '#fff', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <MessageCircle size={16} /> WhatsApp {firstName}
                </a>
              )}
              {waPhone && (
                <a href={`tel:+${waPhone}`}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Phone size={15} /> Call
                </a>
              )}
              {profile.instagram && (
                <a href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Instagram size={15} /> Instagram
                </a>
              )}
              {profile.tiktok && (
                <a href={`https://tiktok.com/@${profile.tiktok.replace(/^@/, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
                  TikTok
                </a>
              )}
              {profile.facebook && (
                <a href={`https://facebook.com/${profile.facebook.replace(/^@/, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Facebook size={15} /> Facebook
                </a>
              )}
              {profile.website && (
                <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Globe size={15} /> Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── Listings ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
            <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.8rem', letterSpacing: '1px', color: '#fff', borderLeft: '3px solid #dc2626', paddingLeft: 12 }}>
              My Cars
            </h2>
            <span style={{ fontSize: 12, color: '#334155' }}>{listings.length} listing{listings.length !== 1 ? 's' : ''}</span>
          </div>

          {listings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
              <p style={{ fontSize: 14 }}>No cars listed yet.</p>
              {waHref && (
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ color: '#22c55e', textDecoration: 'none' }}>
                    Ask {firstName} on WhatsApp →
                  </a>
                </p>
              )}
            </div>
          ) : (
            <div className="sp-grid">
              {listings.map(car => {
                const img = Array.isArray(car.images) ? car.images[0] : null;
                return (
                  <Link key={car.id} to={`/cars/${car.slug}`} className="sp-card">
                    {/* Image */}
                    <div style={{ position: 'relative', paddingTop: '62%', background: '#080f18', overflow: 'hidden' }}>
                      {img ? (
                        <img src={img} alt={`${car.brand} ${car.model}`} loading="lazy"
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🚗</div>
                      )}
                      {car.is_recon && (
                        <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(168,85,247,0.9)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Recon</span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '12px 14px' }}>
                      <p style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 3 }}>
                        {car.brand}
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[car.year, car.model, car.variant].filter(Boolean).join(' ')}
                      </p>
                      {car.selling_price > 0 && (
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                          RM {fmt(car.selling_price)}
                        </p>
                      )}
                      <p style={{ fontSize: 11, color: '#475569' }}>
                        {[car.mileage ? `${fmt(car.mileage)} km` : null, car.transmission, car.fuel_type].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ marginTop: 60, borderTop: '1px solid rgba(255,255,255,0.04)', padding: '20px 0', textAlign: 'center' }}>
          <Link to="/cars" style={{ fontSize: 12, color: '#1e293b', textDecoration: 'none' }}>
            Powered by <span style={{ color: '#dc2626', fontWeight: 600 }}>XDrive</span>
          </Link>
        </div>
      </div>

      {/* Floating WhatsApp */}
      {waHref && (
        <a href={waHref} target="_blank" rel="noopener noreferrer" className="sp-wa-float">
          <MessageCircle size={18} /> Chat with {firstName}
        </a>
      )}
    </>
  );
}
