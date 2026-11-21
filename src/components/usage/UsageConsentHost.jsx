// USAGE-1: the one-time question to a seller: may Drevo count which features you use? (IDEA-43)
// Mounted once in App.jsx. Rules it keeps:
//   - Only a signed-in SELLER (salesman / dealer / owner) who finished signing up and has had the app
//     for a day, and only on their own dashboard routes. Never on a public page, so never in front of a
//     Live presentation (that opens from the seller's public page), never over a buyer.
//   - Never on top of another pop-up (the page lock is on) or in the first seconds of a visit.
//   - "No thanks" and "Yes" are stored (set_usage_consent). Closing it without answering stores NOTHING:
//     no answer is not consent, and we ask again in 7 days (device-only note).
//   - If the database function is not there yet (migration 20261120d queued), stay silent: never ask a
//     question whose answer cannot be saved.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import i18n from 'i18next';
import { supabase } from '../../supabaseClient';
import { useModalHistory } from '../../hooks/useModalHistory';
import { waLink } from '../../utils/plans';
import { usageConsentCopy } from './usageConsentCopy';

const SELLER_PATH = /^\/(salesman-lite|salesman-premium|salesman|dashboard)(\/|$)/;
const SNOOZE_MS = 7 * 86400000;
const snoozeKey = (uid) => `xd_usage_consent_snooze_${uid}`;

function Sheet({ onClose, onSnooze }) {
  useModalHistory(true, onSnooze);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const [state, setState] = useState('ask'); // ask | saving | thanks
  const [error, setError] = useState('');
  const c = usageConsentCopy((i18n.language || 'en').startsWith('ms') ? 'ms' : 'en');

  const answer = async (yes) => {
    setState('saving'); setError('');
    const { error: e } = await supabase.rpc('set_usage_consent', { p_allowed: yes });
    if (e) {
      if (e.code === 'PGRST202' || e.code === '42883') { onClose(); return; }
      setError(c.error); setState('ask');
      return;
    }
    if (!yes) { onClose(); return; }
    setState('thanks');
    setTimeout(onClose, 1800);
  };

  const font = 'var(--xd-font-body, Outfit, system-ui, sans-serif)';
  const wide = typeof window !== 'undefined' && window.innerWidth >= 700;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={c.title}
      onClick={(e) => { if (e.target === e.currentTarget && state !== 'saving') onSnooze(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center', fontFamily: font }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', color: '#111827', padding: '22px 22px calc(22px + env(safe-area-inset-bottom))',
        borderRadius: wide ? 16 : '16px 16px 0 0', boxShadow: '0 20px 60px rgba(0,0,0,.35)', maxHeight: '92vh', overflowY: 'auto' }}>
        {state === 'thanks' ? (
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}><b>{c.thanksBold}</b> {c.thanks}</p>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, marginBottom: 10 }}>{c.title}</div>
            <p style={{ margin: '0 0 8px', fontSize: 14.5, lineHeight: 1.5, color: '#374151' }}>{c.lead}</p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: '#4b5563' }}>
              {c.points.map((p) => <li key={p}>{p}</li>)}
              <li>{c.change[0]} <a href={waLink(c.changeMsg)} target="_blank" rel="noopener noreferrer" style={{ color: '#dc2626' }}>{c.change[1]}</a> {c.change[2]}</li>
            </ul>
            {error && <div role="alert" style={{ marginBottom: 10, fontSize: 13.5, color: '#b91c1c' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => answer(false)} disabled={state === 'saving'}
                style={{ flex: 1, height: 48, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>{c.no}</button>
              <button onClick={() => answer(true)} disabled={state === 'saving'}
                style={{ flex: 2, height: 48, borderRadius: 999, border: 'none', background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: font, opacity: state === 'saving' ? 0.7 : 1 }}>
                {state === 'saving' ? c.saving : c.yes}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function UsageConsentHost() {
  const { pathname } = useLocation();
  const [uid, setUid] = useState(null);
  const done = useRef(new Set()); // uids already checked on this page load

  useEffect(() => {
    if (!SELLER_PATH.test(pathname) || /setup|onboarding/.test(pathname)) { setUid(null); return undefined; }
    let live = true, timer, tries = 0;
    const check = async () => {
      if (!live) return;
      // Another pop-up has the page: wait, do not stack on it.
      if (document.body.style.overflow === 'hidden' && tries < 6) { tries += 1; timer = setTimeout(check, 30000); return; }
      if (document.body.style.overflow === 'hidden') return;
      const { data: { session } } = await supabase.auth.getSession();
      const id = session?.user?.id;
      if (!id || session.user.is_anonymous || done.current.has(id)) return;
      done.current.add(id);
      try { const t = Number(localStorage.getItem(snoozeKey(id))); if (t && Date.now() - t < SNOOZE_MS) return; } catch { /* private mode */ }
      const { data: prof } = await supabase.from('profiles').select('role, created_at, onboarding_complete').eq('id', id).maybeSingle();
      if (!prof || !['salesman', 'dealer', 'owner'].includes(prof.role) || !prof.onboarding_complete) return;
      if (Date.now() - new Date(prof.created_at).getTime() < 86400000) return; // first day belongs to setup + tour
      const { data: row, error } = await supabase.from('seller_usage_consent').select('allowed').eq('user_id', id).maybeSingle();
      if (error || row) return; // table not there yet, or already answered
      if (live && document.body.style.overflow !== 'hidden') setUid(id);
    };
    timer = setTimeout(check, 25000);
    return () => { live = false; clearTimeout(timer); };
  }, [pathname]);

  if (!uid) return null;
  const close = () => setUid(null);
  const snooze = () => {
    try { localStorage.setItem(snoozeKey(uid), String(Date.now())); } catch { /* private mode */ }
    setUid(null);
  };
  return <Sheet onClose={close} onSnooze={snooze} />;
}
