import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AdminPage() {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role !== 'superadmin') { navigate('/'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, dealership, role, created_at')
        .eq('role', 'dealer')
        .order('created_at', { ascending: false });

      setDealers(data || []);
      setLoading(false);
    }
    init();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  function fmtDate(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d0d; }
        .adm-root { min-height: 100vh; background: #0d0d0d; font-family: 'DM Sans', sans-serif; color: #f5f5f5; }
        .adm-header { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 56px; background: rgba(8,12,20,0.95); border-bottom: 1px solid rgba(255,255,255,0.07); position: sticky; top: 0; z-index: 10; }
        .adm-logo { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px; color: white; }
        .adm-logo span { color: #dc2626; }
        .adm-signout { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #9ca3af; font-family: 'DM Sans', sans-serif; font-size: 13px; padding: 7px 16px; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
        .adm-signout:hover { background: rgba(255,255,255,0.09); color: white; }
        .adm-back-btn { background: none; border: none; color: #a0a0a0; font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer; padding: 0; transition: color 0.2s; }
        .adm-back-btn:hover { color: white; }
        .adm-body { max-width: 1100px; margin: 0 auto; padding: 40px 24px 80px; }
        .adm-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; margin-bottom: 6px; }
        .adm-h2 { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 0.05em; color: white; margin-bottom: 24px; }
        .adm-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid rgba(255,255,255,0.07); }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        thead th { text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; font-weight: 600; white-space: nowrap; }
        tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
        tbody tr:last-child { border-bottom: none; }
        tbody tr:hover { background: rgba(255,255,255,0.02); }
        tbody td { padding: 13px 16px; color: #e5e7eb; vertical-align: middle; }
        .adm-empty { text-align: center; padding: 48px 16px; color: #4b5563; font-size: 14px; }
        .adm-loading { text-align: center; padding: 80px 16px; color: #4b5563; font-size: 14px; }
        .adm-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: rgba(220,38,38,0.12); color: #f87171; border: 1px solid rgba(220,38,38,0.2); }
      `}</style>

      <div className="adm-root">
        <header className="adm-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div className="adm-logo">Shift<span>OS</span> <span style={{ color: '#6b7280', fontSize: 14, letterSpacing: 1, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>Admin</span></div>
            <button className="adm-back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          </div>
          <button className="adm-signout" onClick={handleSignOut}>Sign out</button>
        </header>

        <div className="adm-body">
          <p className="adm-section-title">Management</p>
          <h2 className="adm-h2">Dealers</h2>

          {loading ? (
            <p className="adm-loading">Loading…</p>
          ) : (
            <div className="adm-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Dealership</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {dealers.length === 0 ? (
                    <tr><td colSpan={4} className="adm-empty">No dealers found.</td></tr>
                  ) : dealers.map(d => (
                    <tr key={d.id}>
                      <td>{d.full_name || <span style={{ color: '#4b5563' }}>—</span>}</td>
                      <td>{d.dealership || <span style={{ color: '#4b5563' }}>—</span>}</td>
                      <td><span className="adm-badge">{d.role}</span></td>
                      <td style={{ color: '#9ca3af' }}>{fmtDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
