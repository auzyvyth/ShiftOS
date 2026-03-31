import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import { useRoleRedirect } from '../hooks/useRoleRedirect';
import TikTokGenerator from '../components/TikTokGenerator';
import {
  LogOut, Copy, Check, Eye, MessageSquare,
  ShoppingBag, Clock, AlertCircle, Car, Sparkles,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatApptDate(iso) {
  const d = new Date(iso);
  return {
    day:   d.toLocaleDateString('en-MY', { day: '2-digit' }),
    month: d.toLocaleDateString('en-MY', { month: 'short' }),
    time:  d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

function StatusBadge({ status }) {
  const styles = {
    available: 'bg-green-500/15 text-green-400 border-green-500/30',
    reserved:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    pending:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize flex-shrink-0 ${styles[status] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SalesmanPanel() {
  const navigate        = useNavigate();
  const { t }           = useTranslation();
  const redirectByRole  = useRoleRedirect('salesman');

  const [profile,        setProfile]        = useState(null);
  const [userId,         setUserId]         = useState(null);
  const [loading,        setLoading]        = useState(true);

  // ── unique-link copy state
  const [copied,         setCopied]         = useState(false);

  // ── stats
  const [myClicks,       setMyClicks]       = useState(0);
  const [myEnquiries,    setMyEnquiries]    = useState(0);
  const [soldCount,      setSoldCount]      = useState(0);
  const [soldLoading,    setSoldLoading]    = useState(true);

  // ── commission strip  (null = still loading)
  const [commission,     setCommission]     = useState(null);

  // ── my listings
  const [myListings,     setMyListings]     = useState([]);
  const [listingCopied,  setListingCopied]  = useState({}); // { [carId]: 'link' | 'wa' | null }
  const [tiktokListing,  setTiktokListing]  = useState(null);

  // ── appointments
  const [appointments,   setAppointments]   = useState([]);

  // ── page title
  useEffect(() => {
    document.title = t('salesman.meta.title', { defaultValue: 'ShiftOS · My Panel' });
  }, [t]);

  // ── auth + profile ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error || !data.session) { navigate('/login'); return; }

      const uid = data.session.user.id;
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (!profileData) { navigate('/login'); return; }
      if (redirectByRole(profileData.role)) return;

      setProfile(profileData);
      setUserId(uid);
      setLoading(false);

      if (profileData.slug && profileData.slug.trim() !== '') {
        const { data: evts } = await supabase
          .from('analytics_events')
          .select('event_type')
          .eq('salesman_slug', profileData.slug);
        if (evts) {
          setMyClicks(evts.filter(e => e.event_type === 'link_visit' || e.event_type === 'car_view').length);
          setMyEnquiries(evts.filter(e => e.event_type === 'whatsapp_click' || e.event_type === 'call_click').length);
        }
      }
    });
  }, [navigate]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── userId-dependent data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    // Personal sold count with realtime subscription
    const fetchSold = async () => {
      setSoldLoading(true);
      const { count } = await supabase
        .from('car_listings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sold')
        .eq('assigned_to', userId);
      setSoldCount(count || 0);
      setSoldLoading(false);
    };
    fetchSold();
    const ch = supabase
      .channel('salesman_sold')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'car_listings' }, fetchSold)
      .subscribe();

    // Active listings assigned to me — full detail for rich cards
    supabase
      .from('car_listings')
      .select('id, year, brand, model, variant, selling_price, status, images, colour, mileage, transmission, fuel_type, body_type, specs, features, options, city, condition')
      .eq('assigned_to', userId)
      .neq('status', 'sold')
      .order('created_at', { ascending: false })
      .then(({ data }) => setMyListings(data || []));

    // All-time commission — no sold_at column yet, date filter removed
    supabase
      .from('car_listings')
      .select('commission_amount')
      .eq('assigned_to', userId)
      .eq('status', 'sold')
      .then(({ data }) => {
        const total = (data || []).reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0);
        setCommission(total);
      });

    // Upcoming appointments
    supabase
      .from('appointments')
      .select('id, buyer_name, buyer_phone, appointment_date, notes, status, car_listings(year, brand, model)')
      .eq('salesman_id', userId)
      .gte('appointment_date', new Date().toISOString())
      .order('appointment_date', { ascending: true })
      .limit(5)
      .then(({ data }) => setAppointments(data || []));

    return () => supabase.removeChannel(ch);
  }, [userId]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const uniqueLink = profile?.slug
    ? `${window.location.origin}/cars?ref=${profile.slug}`
    : null;

  const handleCopy = () => {
    if (!uniqueLink) return;
    navigator.clipboard.writeText(uniqueLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleListingCopy = (car, type) => {
    const link = `${window.location.origin}/cars/${car.id}?ref=${profile?.slug || ''}`;
    let text = link;
    if (type === 'wa') {
      const price = Number(car.selling_price || 0);
      text = [
        `🚗 ${car.year} ${car.brand} ${car.model}${car.variant ? ' ' + car.variant : ''}`,
        `💰 RM ${price.toLocaleString()}`,
        `📍 ${car.city || profile?.location || 'Malaysia'}`,
        `🔢 ${car.mileage ? Number(car.mileage).toLocaleString() + ' km' : '—'} · ${car.colour || '—'} · ${car.transmission || '—'}`,
        ``,
        `✅ Condition: ${car.condition || 'Good'}`,
        ``,
        `Berminat? Whatsapp saya sekarang 👇`,
        link,
      ].join('\n');
    }
    navigator.clipboard.writeText(text);
    setListingCopied(prev => ({ ...prev, [car.id]: type }));
    setTimeout(() => setListingCopied(prev => ({ ...prev, [car.id]: null })), 1500);
  };

  const AvatarDisplay = () => {
    if (profile?.avatar_url) return (
      <img src={profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-full object-cover border-2 border-red-600/30" />
    );
    const initial = (profile?.full_name || 'S')[0].toUpperCase();
    return (
      <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center font-bold text-2xl">
        {initial}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm tracking-widest uppercase">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      {/* Top bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center font-bold text-sm"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >S</div>
          <span className="font-bold tracking-wide text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '3px' }}>SHIFTOS</span>
          <span className="text-gray-600 text-xs ml-1">· My Panel</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </header>

      {/* ── Main two-column layout ── */}
      <main className="px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ══ LEFT COLUMN: Profile · Stats · Appointments ══ */}
          <div className="space-y-5">

            {/* Profile card (with commission + copy link) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-4">
                <AvatarDisplay />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white leading-tight">{profile?.full_name || '—'}</p>
                  <p className="text-gray-400 text-sm capitalize">{profile?.role || 'Salesperson'}</p>
                  {profile?.dealership && (
                    <p className="text-gray-600 text-xs mt-0.5">{profile.dealership}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {profile?.is_active === false && (
                    <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-400">
                      Inactive
                    </span>
                  )}
                  {uniqueLink && (
                    <button
                      onClick={handleCopy}
                      title="Copy your unique tracking link — share it anywhere to track clicks"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all"
                      style={{
                        background:  copied ? 'rgba(22,163,74,0.1)'  : 'rgba(255,255,255,0.04)',
                        borderColor: copied ? 'rgba(22,163,74,0.3)'  : 'rgba(255,255,255,0.1)',
                        color:       copied ? '#4ade80'              : '#9ca3af',
                      }}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                  )}
                </div>
              </div>

              {/* Commission row */}
              <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-500">Total commission</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: commission && commission > 0 ? '#f87171' : '#6b7280' }}
                >
                  {commission === null ? '—' : `RM ${Number(commission).toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Slug guard banner */}
            {!profile?.slug && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <p className="text-xs text-yellow-400">
                  Your account doesn't have a unique link yet. Contact your manager to set one up.
                </p>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">{myClicks}</p>
                <p className="text-xs text-gray-500 mt-1">Link Clicks</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-yellow-600/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <MessageSquare className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-2xl font-bold text-white">{myEnquiries}</p>
                <p className="text-xs text-gray-500 mt-1">WA Clicks</p>
              </div>
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
                  style={{ background: 'rgba(22,163,74,0.15)' }}
                >
                  <ShoppingBag className="w-4 h-4 text-green-400" />
                </div>
                {soldLoading ? (
                  <div className="w-5 h-5 border-2 border-green-600/30 border-t-green-400 rounded-full animate-spin mx-auto my-1" />
                ) : (
                  <p className="text-2xl font-bold text-green-400">{soldCount}</p>
                )}
                <p className="text-xs mt-1" style={{ color: 'rgba(74,222,128,0.6)' }}>My Sales</p>
              </div>
            </div>

            {/* Upcoming Appointments */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-red-400" />
                <p className="text-sm font-medium text-white">Upcoming Appointments</p>
              </div>
              {appointments.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No upcoming viewings yet.</p>
                  <p className="text-gray-600 text-xs mt-1">Bookings from your listings will appear here.</p>
                </div>
              ) : (
                <div>
                  {appointments.map((appt, i) => {
                    const apptCar     = appt.car_listings;
                    const apptCarName = apptCar ? `${apptCar.year} ${apptCar.brand} ${apptCar.model}` : null;
                    const dt          = formatApptDate(appt.appointment_date);
                    const phone       = appt.buyer_phone?.replace(/\D/g, '') || '';
                    const waText      = encodeURIComponent(
                      `Hi ${appt.buyer_name || 'there'}, this is ${profile?.full_name || 'your salesperson'} from ${profile?.dealership || 'our dealership'}. Confirming your viewing appointment on ${dt.day} ${dt.month} at ${dt.time}${apptCarName ? ` for the ${apptCarName}` : ''}. See you then! 😊`
                    );
                    const statusColor = {
                      confirmed:   'bg-green-500/15 text-green-400 border-green-500/30',
                      cancelled:   'bg-red-500/15 text-red-400 border-red-500/30',
                      rescheduled: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
                    }[appt.status] ?? 'bg-gray-700/40 text-gray-400 border-gray-600';

                    return (
                      <div
                        key={appt.id}
                        className={`flex items-start gap-4 py-3 ${i < appointments.length - 1 ? 'border-b border-gray-800' : ''}`}
                      >
                        <div className="w-14 flex-shrink-0 text-center">
                          <p className="text-2xl font-bold text-red-400 leading-none">{dt.day}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{dt.month}</p>
                          <p className="text-xs text-gray-500">{dt.time}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-white truncate">{appt.buyer_name || '—'}</p>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border capitalize flex-shrink-0 ${statusColor}`}>
                              {appt.status || 'confirmed'}
                            </span>
                          </div>
                          {apptCarName && <p className="text-xs text-gray-400 truncate">{apptCarName}</p>}
                          {appt.buyer_phone && <p className="text-xs text-gray-500 mt-0.5">📞 {appt.buyer_phone}</p>}
                          {appt.notes && <p className="text-xs text-gray-600 italic mt-0.5 truncate">💬 "{appt.notes}"</p>}
                        </div>
                        {phone && (
                          <button
                            onClick={() => window.open(`https://wa.me/${phone.startsWith('6') ? phone : '6' + phone}?text=${waText}`, '_blank')}
                            className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                            style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#4ade80' }}
                          >
                            <MessageSquare className="w-3 h-3" />
                            WA
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>{/* end left column */}

          {/* ══ RIGHT COLUMN: My Listings ══ */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Car className="w-4 h-4 text-red-400" />
              <p className="text-sm font-medium text-white">My Listings</p>
              {myListings.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                  {myListings.length}
                </span>
              )}
            </div>

            {myListings.length === 0 ? (
              <div className="text-center py-16">
                <Car className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No listings assigned yet.</p>
                <p className="text-gray-600 text-xs mt-1">Ask your manager to assign cars to you.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map(car => {
                  const listCopied = listingCopied[car.id];
                  const price      = Number(car.selling_price || 0);

                  return (
                    <div key={car.id} className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-3">
                      <div className="flex gap-3 mb-3">
                        {car.images?.[0] ? (
                          <img src={car.images[0]} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-700" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-700/80 flex items-center justify-center flex-shrink-0">
                            <Car className="w-6 h-6 text-gray-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-bold text-white leading-tight">
                              {car.year} {car.brand} {car.model}
                              {car.variant ? <span className="font-normal text-gray-400"> {car.variant}</span> : null}
                            </p>
                            <StatusBadge status={car.status} />
                          </div>
                          <p className="text-sm font-semibold text-red-400 mb-1">RM {price.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">
                            {[
                              car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null,
                              car.colour,
                              car.transmission,
                            ].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleListingCopy(car, 'link')}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-all"
                        >
                          {listCopied === 'link'
                            ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></>
                            : <><Copy className="w-3 h-3" />Copy Link</>
                          }
                        </button>
                        <button
                          onClick={() => handleListingCopy(car, 'wa')}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-all"
                        >
                          {listCopied === 'wa'
                            ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></>
                            : <><MessageSquare className="w-3 h-3" />WA Caption</>
                          }
                        </button>
                        <button
                          onClick={() => setTiktokListing(car)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.30)', color: '#f87171' }}
                        >
                          <Sparkles className="w-3 h-3" />
                          TikTok Slide
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>{/* end right column */}

        </div>
      </main>

      {/* TikTok Studio modal */}
      {tiktokListing && (
        <TikTokGenerator
          listing={tiktokListing}
          onClose={() => setTiktokListing(null)}
        />
      )}
    </div>
  );
}
