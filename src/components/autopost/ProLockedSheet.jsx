// What "Post to socials" shows to a seller who does not have Drevo Pro (owner, 2026-11-13:
// paid upfront, no free trial, no pay = no use). Rendered by PostToSocialsSheet in place of the
// posting tools, so the menu item can be there from the first tap; the parent sheet already owns
// the scroll lock and the Back-button entry, so this registers neither.
//
// Three states: still asking the server (ready=false), no Pro (offer + WhatsApp), Pro paid but
// this login is not switched on yet (we connect the seller's own accounts after payment).
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { premiumDark as P } from '../../theme/tokens';
import { waLink } from '../../utils/plans';
import { SOCIAL_PRO } from '../../utils/proPlan';

export default function ProLockedSheet({ ready, onClose }) {
  // undefined = asking, null = no Pro, string = paid until (ISO). A missing RPC (migration not
  // applied yet) or any error reads as "no Pro": never as access.
  const [until, setUntil] = useState(undefined);
  useEffect(() => {
    let dead = false;
    supabase.rpc('my_pro_status').then(({ data, error }) => {
      if (!dead) setUntil(!error && data ? String(data) : null);
    }, () => { if (!dead) setUntil(null); });
    return () => { dead = true; };
  }, []);

  const font = 'var(--xd-font-body, Outfit, system-ui, sans-serif)';
  const wide = typeof window !== 'undefined' && window.innerWidth >= 700;
  const paid = until ? new Date(until) : null;
  const loading = !ready || until === undefined;
  const date = paid ? paid.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Drevo Pro"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center', fontFamily: font }}>
      <div style={{ width: '100%', maxWidth: 520, background: P.card, color: P.text, padding: '18px 20px calc(20px + env(safe-area-inset-bottom))',
        borderRadius: wide ? P.radius.card : `${P.radius.card}px ${P.radius.card}px 0 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: P.textMuted, fontWeight: 600, letterSpacing: '.04em' }}>POST TO SOCIALS</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{loading ? 'Checking your plan...' : paid ? `${SOCIAL_PRO.name} is active` : `Part of ${SOCIAL_PRO.name}`}</div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ width: 36, height: 36, borderRadius: P.radius.pill, border: 'none', background: P.raised, color: P.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {!loading && paid && (
          <p style={{ fontSize: 14.5, lineHeight: 1.5, color: P.textSec, margin: '0 0 6px' }}>
            Paid until {date}. We are connecting your own accounts and will message you when posting is switched on for you.
          </p>
        )}

        {!loading && !paid && (
          <>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: P.textSec, margin: '0 0 12px' }}>
              Post a live car to your {SOCIAL_PRO.networks.join(', ')} in one tap. You see a preview and approve every post first.
            </p>
            <div style={{ background: P.raised, borderRadius: P.radius.row, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>RM{SOCIAL_PRO.price}<span style={{ fontSize: 13, fontWeight: 600, color: P.textMuted }}> / month</span></div>
              <div style={{ fontSize: 13, color: P.textSec, marginTop: 4 }}>{SOCIAL_PRO.terms} Includes everything in Premium. We connect your accounts after you pay.</div>
            </div>
            <a className="lk-red" href={waLink(SOCIAL_PRO.waText)} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: P.radius.pill, color: P.onAccent, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
              Ask for Drevo Pro on WhatsApp
            </a>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
