import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Bell, ArrowLeft, ArrowRight, LogOut, Store, Check, X, Clock, PackageCheck, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useSavedCars, useSavedCarsDetails } from '../hooks/useSavedCars';
import CarCard from '../components/CarCard';
import { POST_SALE_STEPS, STATUS_CONFIG } from '../utils/postSaleSteps';

const STEP_LABEL = Object.fromEntries(POST_SALE_STEPS.map((s) => [s.key, s.label]));

// Business roles get bounced to their own panel — buyers only ever see /account.
const SELLER_ROUTES = {
  superadmin: '/dashboard', dealer: '/dashboard', owner: '/dashboard',
  manager: '/manager', salesman: '/salesman', accountant: '/accountant',
  fi_officer: '/fi', admin: '/admin',
};

export default function AccountPage() {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'My Account | XDrive'; }, []);
  const { savedIds, ready } = useSavedCars();
  const { cars } = useSavedCarsDetails(savedIds, ready);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const [alerts, setAlerts] = useState([]);

  // Auth guard. Not logged in -> /login. A seller (business role) -> their own
  // panel, so no one ends up with two dashboards. Buyers stay here.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) { navigate('/buyer-login', { replace: true }); return; }
      const { data: prof } = await supabase
        .from('profiles').select('role, full_name, avatar_url, phone')
        .eq('id', data.session.user.id).maybeSingle();
      if (!active) return;
      const sellerRoute = prof?.role && SELLER_ROUTES[prof.role];
      if (sellerRoute) { navigate(sellerRoute, { replace: true }); return; }
      setSession(data.session);
      setProfile(prof || null);
      setChecking(false);
    });
    return () => { active = false; };
  }, [navigate]);

  // Saved searches / price alerts (RLS scopes to the signed-in user)
  useEffect(() => {
    if (!session) return;
    supabase.from('price_alerts').select('*').eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setAlerts(data || []));
  }, [session]);

  // Purchase tracker — the buyer's cars currently going through handover, grouped
  // by deal. Re-fetches when the tab regains focus so the status stays current.
  const [purchases, setPurchases] = useState([]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.rpc('get_my_purchase_tracker');
      if (!active) return;
      const by = {};
      (data || []).forEach((r) => {
        const g = by[r.lead_id] || (by[r.lead_id] = {
          lead_id: r.lead_id, car_label: r.car_label, plate: r.plate,
          purchase_date: r.purchase_date, selling_price: r.selling_price,
          dealership: r.dealership, steps: [],
        });
        g.steps.push({ step_key: r.step_key, status: r.status, sort_order: r.sort_order, due_date: r.due_date });
      });
      Object.values(by).forEach((g) => g.steps.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
      setPurchases(Object.values(by));
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { active = false; window.removeEventListener('focus', onFocus); };
  }, [session]);

  // Editable "Your details" — lets a buyer see/correct the name+phone we captured
  // from Google (avatar/name) or seeded from their first WhatsApp enquiry. These
  // feed ContactGate's prefill so they never retype on the next listing.
  const [detailName, setDetailName] = useState('');
  const [detailPhone, setDetailPhone] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
  useEffect(() => {
    if (!profile) return;
    setDetailName(profile.full_name || '');
    setDetailPhone(profile.phone || '');
  }, [profile]);
  const saveDetails = async () => {
    if (!session || savingDetails) return;
    setSavingDetails(true);
    setDetailsSaved(false);
    const patch = { full_name: detailName.trim() || null, phone: detailPhone.trim() || null };
    const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
    setSavingDetails(false);
    if (!error) {
      setProfile((p) => ({ ...(p || {}), ...patch }));
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 2500);
    }
  };

  const deleteAlert = async (id) => {
    await supabase.from('price_alerts').delete().eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/'; };

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontFamily: "system-ui,sans-serif", fontSize: 14 }}>Loading…</div>;
  }

  const email = session?.user?.email || 'Your account';
  const displayName = profile?.full_name || '';
  const avatarUrl = profile?.avatar_url || '';

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: "system-ui,sans-serif", color: '#111827' }}>
      {/* Minimal top bar — just "back to marketplace", like the car detail page */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
          <Link to="/" style={{ color: '#374151', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to marketplace
          </Link>
          <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9, padding: '8px 14px', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Heading — greet the buyer by name with their Google avatar when we have it */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #e5e7eb' }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={26} color="#dc2626" />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, letterSpacing: '0.04em', margin: 0, color: '#111827', lineHeight: 1 }}>
              {displayName ? displayName.toUpperCase() : 'MY ACCOUNT'}
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</p>
          </div>
        </div>

        {/* Become a seller — Salesman Lite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', background: '#fff', border: '1px solid #fecaca', borderRadius: 16, padding: 22, marginBottom: 40 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Store size={22} color="#dc2626" />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>Want to sell cars on XDrive?</p>
            <p style={{ margin: '5px 0 0', fontSize: 13.5, color: '#6b7280', lineHeight: 1.5 }}>
              Start free with <strong style={{ color: '#dc2626' }}>Salesman Lite</strong> — list up to 10 cars, get leads and a personal showroom. No card needed.
            </p>
          </div>
          <Link to="/salesman-onboarding/lite" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#dc2626', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, padding: '11px 20px', borderRadius: 10, whiteSpace: 'nowrap' }}>
            Start selling free <ArrowRight size={15} />
          </Link>
        </div>

        {/* Your details — name + phone the marketplace pre-fills into enquiries */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <User size={18} color="#dc2626" />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>Your Details</h2>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              We pre-fill these into your enquiries so you don't retype them on every listing.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Name</span>
                <input value={detailName} onChange={(e) => setDetailName(e.target.value)} placeholder="Your name"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#111827', outline: 'none' }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone</span>
                <input value={detailPhone} onChange={(e) => setDetailPhone(e.target.value)} inputMode="tel" placeholder="Phone number"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#111827', outline: 'none' }} />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={saveDetails} disabled={savingDetails}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: savingDetails ? 'default' : 'pointer', opacity: savingDetails ? 0.7 : 1, fontFamily: 'inherit' }}>
                {savingDetails ? 'Saving…' : 'Save'}
              </button>
              {detailsSaved && <span style={{ fontSize: 13, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}><Check size={14} /> Saved</span>}
            </div>
          </div>
        </section>

        {/* Purchase tracker */}
        {purchases.length > 0 && (
          <section style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <PackageCheck size={18} color="#dc2626" />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>Your Purchase{purchases.length > 1 ? 's' : ''}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {purchases.map((p) => {
                const steps = p.steps.filter((s) => s.status !== 'na');
                const doneCount = steps.filter((s) => s.status === 'done').length;
                const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
                const allDone = steps.length > 0 && doneCount === steps.length;
                const currentIdx = steps.findIndex((s) => s.status !== 'done');
                return (
                  <div key={p.lead_id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{p.car_label || 'Your car'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                          {[p.plate, p.dealership].filter(Boolean).join(' · ')}
                          {p.purchase_date ? ` · bought ${new Date(p.purchase_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                        </p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: allDone ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)', color: allDone ? '#059669' : '#dc2626' }}>
                        {allDone ? 'Ready for handover' : `${pct}% done`}
                      </span>
                    </div>
                    {/* progress bar */}
                    <div style={{ height: 6, borderRadius: 99, background: '#f3f4f6', overflow: 'hidden', marginBottom: 16 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: allDone ? '#059669' : '#dc2626', transition: 'width 0.3s' }} />
                    </div>
                    {/* stepper */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {steps.map((s, i) => {
                        const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                        const isCurrent = i === currentIdx && s.status !== 'done';
                        const done = s.status === 'done';
                        const isLast = i === steps.length - 1;
                        return (
                          <div key={s.step_key} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? '#059669' : isCurrent ? '#dc2626' : '#f3f4f6', color: done || isCurrent ? '#fff' : '#9ca3af', border: done || isCurrent ? 'none' : '1px solid #e5e7eb' }}>
                                {done ? <Check size={13} /> : isCurrent ? <Clock size={12} /> : <span style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>}
                              </div>
                              {!isLast && <div style={{ width: 2, flex: 1, minHeight: 14, background: done ? '#059669' : '#e5e7eb' }} />}
                            </div>
                            <div style={{ paddingBottom: isLast ? 0 : 14, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: done ? '#111827' : isCurrent ? '#dc2626' : '#6b7280' }}>{STEP_LABEL[s.step_key] || s.step_key}</p>
                              <p style={{ margin: '1px 0 0', fontSize: 11, color: cfg.color }}>{isCurrent ? 'In progress now' : cfg.label}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Saved cars */}
        <section style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Heart size={18} color="#dc2626" fill="#dc2626" />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>Saved Cars</h2>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>{cars.length}</span>
          </div>
          {cars.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>No saved cars yet. Tap the ♥ on any listing to save it.</p>
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
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>Saved Searches</h2>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>No saved searches. On the showroom, filter cars then tap “Save search” to get emailed about new matches.</p>
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
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: '#111827' }}>{parts.length ? parts.join(' · ') : 'All cars'}</p>
                      {tags.length > 0 && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#6b7280' }}>{tags.join(' · ')}</p>}
                      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}><Check size={11} /> Email alerts on</p>
                    </div>
                    <button onClick={() => deleteAlert(a.id)} title="Remove alert" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', flexShrink: 0, display: 'flex', padding: 4 }}>
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
