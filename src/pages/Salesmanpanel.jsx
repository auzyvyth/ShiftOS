import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import { LogOut, Link, Copy, Check, Eye, MessageSquare, ShoppingBag, Clock, AlertCircle } from 'lucide-react';

export default function SalesmanPanel() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [profile,    setProfile]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [copied,     setCopied]     = useState(false);
  // ── Live sold count for the dealership ─────────────────────────────────
  const [soldCount,  setSoldCount]  = useState(0);
  const [soldLoading,setSoldLoading]= useState(true);
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    document.title = t('salesman.meta.title', { defaultValue: 'ShiftOS · My Panel' });
  }, [t]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error || !data.session) { navigate('/login'); return; }

      const userId = data.session.user.id;
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profileData) { navigate('/login'); return; }
      if (profileData.role === 'manager') { navigate('/dashboard'); return; }

      setProfile(profileData);
      setLoading(false);
    });
  }, [navigate]);

  // ── Fetch + subscribe to live sold count ────────────────────────────────
  useEffect(() => {
    const fetchSold = async () => {
      setSoldLoading(true);
      const { count } = await supabase
        .from('car_listings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sold');
      setSoldCount(count || 0);
      setSoldLoading(false);
    };

    fetchSold();

    // Real-time: re-count whenever any listing changes status
    const ch = supabase
      .channel('salesman_sold')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'car_listings' }, fetchSold)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, []);
  // ───────────────────────────────────────────────────────────────────────

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
          <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center font-bold text-sm"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>S</div>
          <span className="font-bold tracking-wide text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '3px' }}>SHIFTOS</span>
          <span className="text-gray-600 text-xs ml-1">· My Panel</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-all">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Profile card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center gap-5">
          <AvatarDisplay />
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-white">{profile?.full_name || '—'}</p>
            <p className="text-gray-400 text-sm capitalize">{profile?.role || 'Salesperson'}</p>
            {profile?.dealership && (
              <p className="text-gray-600 text-xs mt-1">{profile.dealership}</p>
            )}
          </div>
          {profile?.is_active === false && (
            <span className="px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-400">
              Inactive
            </span>
          )}
        </div>

        {/* Stats — Sales Closed is now live */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Eye className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">0</p>
            <p className="text-xs text-gray-500 mt-1">Link Clicks</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="w-8 h-8 bg-yellow-600/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <MessageSquare className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-white">0</p>
            <p className="text-xs text-gray-500 mt-1">Enquiries</p>
          </div>

          {/* ── Live sold count card ───────────────────────────────────── */}
          <div className="rounded-xl p-4 text-center" style={{ background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.2)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background:'rgba(22,163,74,0.15)' }}>
              <ShoppingBag className="w-4 h-4 text-green-400" />
            </div>
            {soldLoading ? (
              <div className="w-5 h-5 border-2 border-green-600/30 border-t-green-400 rounded-full animate-spin mx-auto my-1"/>
            ) : (
              <p className="text-2xl font-bold text-green-400">{soldCount}</p>
            )}
            <p className="text-xs mt-1" style={{ color:'rgba(74,222,128,0.6)' }}>Cars Sold</p>
          </div>
          {/* ─────────────────────────────────────────────────────────── */}
        </div>

        {/* Unique link */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link className="w-4 h-4 text-red-400" />
            <p className="text-sm font-medium text-white">Your Unique Link</p>
          </div>
          {uniqueLink ? (
            <>
              <div className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3 mb-3">
                <p className="text-sm text-gray-300 truncate">{uniqueLink}</p>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors flex-shrink-0"
                >
                  {copied
                    ? <><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied!</span></>
                    : <><Copy className="w-4 h-4" />Copy</>
                  }
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Share this on WhatsApp, TikTok, Instagram, or anywhere. Every visitor who clicks it is attributed to you.
              </p>
            </>
          ) : (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-400 font-medium">Link not assigned</p>
                <p className="text-xs text-gray-500 mt-1">
                  Your account was created before the new system. Contact your manager — they can remove and re-add your account to generate your link.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Appointments placeholder */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-red-400" />
            <p className="text-sm font-medium text-white">Upcoming Appointments</p>
          </div>
          <div className="text-center py-6">
            <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No appointments yet</p>
            <p className="text-gray-600 text-xs mt-1">Appointments from your link will appear here</p>
          </div>
        </div>

      </main>
    </div>
  );
}