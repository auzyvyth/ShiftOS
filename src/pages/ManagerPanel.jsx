import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ACCENT = '#f97316';

export default function ManagerPanel() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('team');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { navigate('/login'); return; }
      const { data: p } = await supabase
        .from('profiles').select('*')
        .eq('id', data.session.user.id).maybeSingle();
      if (!p || p.role !== 'manager') { navigate('/login'); return; }
      setProfile(p);
      setLoading(false);
    });
  }, [navigate]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#05070e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#6b7280', fontFamily: "'DM Sans',sans-serif" }}>Loading...</p>
    </div>
  );

  const NAV = [
    { id: 'team',      label: 'Team' },
    { id: 'listings',  label: 'Listings' },
    { id: 'bookings',  label: 'Bookings' },
    { id: 'leads',     label: 'Leads' },
    { id: 'analytics', label: 'Analytics' },
  ];

  const SECTIONS = {
    team: [
      { label: 'Team Overview', desc: 'Salesperson status and performance cards' },
      { label: 'Active Members', desc: 'Who is currently active' },
      { label: 'Performance Ranking', desc: 'Top performers this month' },
      { label: 'Commission Summary', desc: 'Total commissions earned' },
    ],
    listings: [
      { label: 'Active Listings', desc: 'All live car listings' },
      { label: 'Pending Review', desc: 'Listings awaiting approval' },
      { label: 'Sold This Month', desc: 'Recently closed deals' },
      { label: 'Draft Listings', desc: 'Unpublished inventory' },
    ],
    bookings: [
      { label: "Today's Bookings", desc: 'Scheduled appointments' },
      { label: 'Upcoming', desc: 'Next 7 days' },
      { label: 'Past Bookings', desc: 'Historical appointments' },
      { label: 'Cancellations', desc: 'Cancelled or no-show' },
    ],
    leads: [
      { label: 'New Leads', desc: 'Fresh enquiries' },
      { label: 'In Progress', desc: 'Leads being worked' },
      { label: 'Follow-up Due', desc: 'Overdue follow-ups' },
      { label: 'Closed', desc: 'Won or lost leads' },
    ],
    analytics: [
      { label: 'Traffic Overview', desc: 'Page views and visits' },
      { label: 'Conversion Rate', desc: 'Lead to sale ratio' },
      { label: 'Top Listings', desc: 'Most viewed cars' },
      { label: 'Salesman Activity', desc: 'Individual performance metrics' },
    ],
  };

  return (
    <div style={{ minHeight: '100vh', background: '#05070e', fontFamily: "'DM Sans',sans-serif", color: '#f0f2f5' }}>
      {/* Header */}
      <header style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} />
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: ACCENT }}>MANAGER PANEL</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280' }}>{profile?.full_name}</span>
        <button
          onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
          style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Logout
        </button>
      </header>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', display: 'flex', gap: 0 }}>
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => setActiveNav(n.id)}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeNav === n.id ? `2px solid ${ACCENT}` : '2px solid transparent',
              color: activeNav === n.id ? ACCENT : '#6b7280',
              fontSize: 13,
              fontWeight: activeNav === n.id ? 600 : 400,
              cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif",
              transition: 'all 0.15s',
            }}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* Main */}
      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {(SECTIONS[activeNav] || []).map(s => (
            <div
              key={s.label}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: 20,
                minHeight: 140,
              }}
            >
              <p style={{ fontSize: 11, color: ACCENT, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>{s.label}</p>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>{s.desc}</p>
              <div style={{ height: 60, background: 'rgba(255,255,255,0.02)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: '#1f2937' }}>Coming soon</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
