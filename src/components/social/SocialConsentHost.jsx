// The one-question consent sheet for Drevo's own social pages (SOCIAL-1). Mounted once in App.jsx.
// Rules it keeps:
//   - Ask AFTER the form is done and the car is waiting for approval, never inside the form.
//   - An answer is stored only by set_listing_social_consent (the database checks the car is the caller's).
//   - Closing the sheet WITHOUT answering stores nothing: "no answer" is not consent.
//   - Nothing is posted until the owner approves the car and presses Post in the console.
//   - If the database function is not there yet (migration not applied), close quietly: never say
//     "thanks" for an answer that was not saved.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { useModalHistory } from '../../hooks/useModalHistory';
import { waLink } from '../../utils/plans';
import { ASK_SOCIAL_EVENT } from './askSocialConsent';

function Sheet({ ask, onClose }) {
  useModalHistory(true, onClose);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const [state, setState] = useState('ask'); // ask | saving | thanks
  const [error, setError] = useState('');

  const answer = async (yes) => {
    setState('saving'); setError('');
    const { error: e } = await supabase.rpc('set_listing_social_consent', { p_listing: ask.id, p_consent: yes });
    if (e) {
      if (e.code === 'PGRST202' || e.code === '42883') { onClose(); return; }
      setError('Could not save your answer. Please try again.');
      setState('ask');
      return;
    }
    if (!yes) { onClose(); return; }
    setState('thanks');
    setTimeout(onClose, 2200);
  };

  const font = 'var(--xd-font-body, Outfit, system-ui, sans-serif)';
  const wide = typeof window !== 'undefined' && window.innerWidth >= 700;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Feature this car on Drevo's pages"
      onClick={(e) => { if (e.target === e.currentTarget && state !== 'saving') onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center', fontFamily: font }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', color: '#111827', padding: '22px 22px calc(22px + env(safe-area-inset-bottom))',
        borderRadius: wide ? 16 : '16px 16px 0 0', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        {state === 'thanks' ? (
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>
            <b>Thank you.</b> If we approve {ask.title}, we will feature it on Drevo&apos;s pages. Nothing is posted before it is approved.
          </p>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', color: '#6b7280', marginBottom: 4 }}>YOUR CAR IS WAITING FOR APPROVAL</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, marginBottom: 10 }}>Want Drevo to feature it on our Facebook Page and TikTok?</div>
            <p style={{ margin: '0 0 8px', fontSize: 14.5, lineHeight: 1.5, color: '#374151' }}>
              More buyers see {ask.title}. We only post it after we approve it.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: '#4b5563' }}>
              <li>We post your photos, price and car details, and credit you by name.</li>
              <li>Never your phone number. Buyers come to your Drevo page.</li>
              <li>Change your mind any time: <a href={waLink(`Please stop featuring my car on Drevo's pages: ${ask.title}`)} target="_blank" rel="noopener noreferrer" style={{ color: '#dc2626' }}>message us</a> and we take it down.</li>
            </ul>
            {error && <div role="alert" style={{ marginBottom: 10, fontSize: 13.5, color: '#b91c1c' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => answer(false)} disabled={state === 'saving'}
                style={{ flex: 1, height: 48, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>No thanks</button>
              <button onClick={() => answer(true)} disabled={state === 'saving'}
                style={{ flex: 2, height: 48, borderRadius: 999, border: 'none', background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: font, opacity: state === 'saving' ? 0.7 : 1 }}>
                {state === 'saving' ? 'Saving...' : 'Yes, feature my car'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function SocialConsentHost() {
  const [ask, setAsk] = useState(null);
  useEffect(() => {
    const on = (e) => { if (e.detail?.id) setAsk(e.detail); };
    window.addEventListener(ASK_SOCIAL_EVENT, on);
    return () => window.removeEventListener(ASK_SOCIAL_EVENT, on);
  }, []);
  if (!ask) return null;
  return <Sheet key={ask.id} ask={ask} onClose={() => setAsk(null)} />;
}
