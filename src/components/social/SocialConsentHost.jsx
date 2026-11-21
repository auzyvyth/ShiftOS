// The one-question consent sheet for Drevo's own social pages (SOCIAL-1). Mounted once in App.jsx.
// Rules it keeps (2026-11-22: ONE standing answer for all the seller's cars, see socialStanding.js):
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
import { readStanding, saveStanding, setConsentFor, unansweredCarIds } from './socialStanding';

function Sheet({ ask, onClose }) {
  useModalHistory(true, onClose);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const [state, setState] = useState('ask'); // ask | saving | thanks
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null); // [done, total]

  const answer = async (yes) => {
    setState('saving'); setError('');
    // One answer for ALL the seller's cars, now and later (owner 2026-11-22). Save it first, then write it
    // on this car(s) and on every other car never asked about.
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    // The standing answer is saved FIRST: if the tab closes half way through the cars, the answer still
    // counts and the next publish carries it on.
    if (uid && !(await saveStanding(uid, yes ? 'yes' : 'no'))) {
      setError('Could not save your answer. Please try again.');
      setState('ask');
      return;
    }
    const ids = Array.from(new Set([...(ask.ids?.length ? ask.ids : [ask.id]), ...(uid ? await unansweredCarIds(uid) : [])]));
    setProgress([0, ids.length]);
    const failed = await setConsentFor(ids, yes, (d, n) => setProgress([d, n]));
    if (failed === 'missing') { onClose(); return; }
    if (failed) {
      setError(`Could not save the answer for ${failed} of ${ids.length} cars. Please try again.`);
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
            <b>Thank you.</b> We will not ask again. Your cars, now and any you add later, can be featured on Drevo&apos;s pages. Nothing is posted before we approve it.
          </p>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', color: '#6b7280', marginBottom: 4 }}>ASKED ONCE, COVERS ALL YOUR CARS</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, marginBottom: 10 }}>Want Drevo to feature your cars on our Facebook Page and TikTok?</div>
            <p style={{ margin: '0 0 8px', fontSize: 14.5, lineHeight: 1.5, color: '#374151' }}>
              More buyers see your cars. This answer covers every car you have now and any you add later, so we will not ask again. We only post a car after we approve it.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: '#4b5563' }}>
              <li>We post your photos, price and car details, and credit you by name.</li>
              <li>Never your phone number. Buyers come to your Drevo page.</li>
              <li>Change your mind any time: <a href={waLink(`Please stop featuring my cars on Drevo's pages`)} target="_blank" rel="noopener noreferrer" style={{ color: '#dc2626' }}>message us</a> and we take them down.</li>
            </ul>
            {error && <div role="alert" style={{ marginBottom: 10, fontSize: 13.5, color: '#b91c1c' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => answer(false)} disabled={state === 'saving'}
                style={{ flex: 1, height: 48, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>No thanks</button>
              <button onClick={() => answer(true)} disabled={state === 'saving'}
                style={{ flex: 2, height: 48, borderRadius: 999, border: 'none', background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: font, opacity: state === 'saving' ? 0.7 : 1 }}>
                {state === 'saving' ? (progress && progress[1] > 10 ? `Saving ${progress[0]} of ${progress[1]} cars...` : 'Saving...') : 'Yes, feature all my cars'}
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
    const on = async (e) => {
      if (!e.detail?.id) return;
      // Already answered once? A yes is applied quietly to the car(s) just published; a no is final.
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      const standing = uid ? await readStanding(uid) : null;
      if (standing === 'yes') {
        // Also sweeps any car a closed tab left unanswered, so "covers all your cars" stays true.
        const ids = Array.from(new Set([...(e.detail.ids?.length ? e.detail.ids : [e.detail.id]), ...(await unansweredCarIds(uid))]));
        setConsentFor(ids, true);
        return;
      }
      if (standing === 'no') return;
      setAsk(e.detail);
    };
    window.addEventListener(ASK_SOCIAL_EVENT, on);
    return () => window.removeEventListener(ASK_SOCIAL_EVENT, on);
  }, []);
  if (!ask) return null;
  return <Sheet key={ask.id} ask={ask} onClose={() => setAsk(null)} />;
}
