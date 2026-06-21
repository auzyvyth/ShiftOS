import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Bell, ArrowLeft, ArrowRight, LogOut, Store, Check, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useSavedCars } from '../hooks/useSavedCars';
import CarCard from '../components/CarCard';

const CARD_COLS = 'id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,condition,images,status,created_at,dealer_id,auction_grade,interior_grade,is_recon,financing_type,engine_cc,previous_owners';

// Business roles get bounced to their own panel — buyers only ever see /account.
const SELLER_ROUTES = {
  superadmin: '/dashboard', dealer: '/dashboard', owner: '/dashboard',
  manager: '/manager', salesman: '/salesman', accountant: '/accountant',
  fi_officer: '/fi', admin: '/admin',
};

export default function AccountPage() {
  const navigate = useNavigate();
  const { savedIds, ready } = useSavedCars();
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [cars, setCars] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Auth guard. Not logged in -> /login. A seller (business role) -> their own
  // panel, so no one ends up with two dashboards. Buyers stay here.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) { navigate('/login?as=buyer', { replace: true }); return; }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
      if (!active) return;
      const sellerRoute = profile?.role && SELLER_ROUTES[profile.role];
      if (sellerRoute) { navigate(sellerRoute, { replace: true }); return; }
      setSession(data.session);
      setChecking(false);
    });
    return () => { active = false; };
  }, [navigate]);

  // Saved cars (preserve saved order)
  useEffect(() => {
    if (!ready) return;
    const ids = [...savedIds];
    if (!ids.length) { setCars([]); return; }
    supabase.from('public_car_listings').select(CARD_COLS).in('id', ids).then(({ data }) => {
      if (!data) return;
      const map = Object.fromEntries(data.map(c => [c.id, c]));
      setCars(ids.map(id => map[id]).filter(Boolean));
    });
  }, [savedIds, ready]);

  // Saved searches / price alerts (RLS scopes to the signed-in user)
  useEffect(() => {
    if (!session) return;
    supabase.from('price_alerts').select('*').eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setAlerts(data || []));
  }, [session]);

  const deleteAlert = async (id) => {
    await supabase.from('price_alerts').delete().eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/'; };

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans',sans-serif", fontSize: 14 }}>Loading…</div>;
  }

  const email = session?.user?.email || 'Your account';

  return (
    <div style={{ minHeight: '100vh', background: '#080C14', fontFamily: "'DM Sans',sans-serif", color: '#f1f5f9' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, maxWidth: 1200, margin: '0 auto' }}>
        <Link to="/showroom" style={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Browse cars
        </Link>
        <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '8px 14px', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Heading */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: '0.04em', margin: 0 }}>MY ACCOUNT</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{email}</p>
        </div>

        {/* Become a seller — Salesman Lite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', background: 'linear-gradient(135deg, rgba(220,38,38,0.12), rgba(220,38,38,0.03))', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 16, padding: 22, marginBottom: 40 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(220,38,38,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Store size={22} color="#f87171" />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>Want to sell cars on XDrive?</p>
            <p style={{ margin: '5px 0 0', fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              Start free with <strong style={{ color: '#f87171' }}>Salesman Lite</strong> — list up to 10 cars, get leads and a personal showroom. No card needed.
            </p>
          </div>
          <Link to="/salesman-onboarding/lite" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#dc2626', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, padding: '11px 20px', borderRadius: 10, whiteSpace: 'nowrap' }}>
            Start selling free <ArrowRight size={15} />
          </Link>
        </div>

        {/* Saved cars */}
        <section style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Heart size={18} color="#dc2626" fill="#dc2626" />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Saved Cars</h2>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{cars.length}</span>
          </div>
          {cars.length === 0 ? (
            <div style={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>No saved cars yet. Tap the ♥ on any listing to save it.</p>
              <Link to="/showroom" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, background: '#dc2626', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 9 }}>
                Browse cars <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
              {cars.map(car => <CarCard key={car.id} car={car} showDiscountBadge />)}
            </div>
          )}
        </section>

        {/* Saved searches / price alerts */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Bell size={18} color="#dc2626" />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Saved Searches</h2>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <div style={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>No saved searches. On the showroom, filter cars then tap “Save search” to get emailed about new matches.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alerts.map(a => {
                const parts = [a.brand, a.model, a.variant].filter(Boolean);
                const tags = [
                  a.state,
                  a.max_price && `≤ RM ${(a.max_price / 1000).toFixed(0)}k`,
                  a.min_year && `From ${a.min_year}`,
                  a.body_type,
                  a.condition,
                ].filter(Boolean);
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: '#f1f5f9' }}>{parts.length ? parts.join(' · ') : 'All cars'}</p>
                      {tags.length > 0 && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>{tags.join(' · ')}</p>}
                      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(74,222,128,0.7)', display: 'flex', alignItems: 'center', gap: 5 }}><Check size={11} /> Email alerts on</p>
                    </div>
                    <button onClick={() => deleteAlert(a.id)} title="Remove alert" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', flexShrink: 0, display: 'flex', padding: 4 }}>
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
