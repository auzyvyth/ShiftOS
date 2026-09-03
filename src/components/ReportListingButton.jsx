import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Flag, X, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { markBuyerIntent } from '../lib/buyerAuth';
import { useDialogA11y } from '../hooks/useDialogA11y';

/**
 * "Report this listing" — buyer-facing moderation entry for the public marketplace.
 *
 * Signed-in only, and capped at 3 reports per user per 24h. Both rules are
 * enforced server-side in the report_listing() RPC, not here — this component
 * only translates the RPC's error codes into a message. There is no INSERT
 * policy on listing_reports, so a crafted client cannot bypass either rule.
 *
 * Deliberately low-prominence: a report must never compete with Enquire for
 * attention, and a grid-level report button invites drive-by mass-flagging.
 *
 * Props:
 *   listingId string  — car_listings.id
 *   th        object  — page theme tokens (CarDetailPage runs light on xdrive.my
 *                       and dark on dealer subdomains, so colours come from here)
 *   variant   'icon' | 'link' — 'icon' is an icon-only circle that sits ON the
 *                       photo. It does NOT use `th`: it overlays an arbitrary
 *                       image, so it carries its own dark scrim + white icon in
 *                       both themes, matching the photo-counter pill already on
 *                       the mosaic. 'link' is the text version.
 */

const REASONS = [
  { key: 'sold_elsewhere',  label: 'Already sold or unavailable' },
  { key: 'wrong_info',      label: 'Wrong or misleading details' },
  { key: 'scam_suspicious', label: 'Looks like a scam' },
  { key: 'duplicate',       label: 'Duplicate listing' },
  { key: 'offensive',       label: 'Offensive or inappropriate' },
  { key: 'other',           label: 'Something else' },
];

const ERRORS = {
  rate_limited:     'You have reached the limit of 3 reports in 24 hours. Please try again tomorrow.',
  already_reported: 'You have already reported this listing. We are looking into it.',
  not_signed_in:    'Please sign in to report a listing.',
  listing_not_found:'This listing is no longer available.',
};

export default function ReportListingButton({ listingId, th, variant = 'link' }) {
  const [open, setOpen]       = useState(false);
  const [session, setSession] = useState(null);
  const [reason, setReason]   = useState('');
  const [note, setNote]       = useState('');
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Lock the page behind the sheet. Keyed on `open`, restored on close.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const close = () => {
    setOpen(false);
    setReason(''); setNote(''); setError(''); setDone(false);
  };

  const dialog = useDialogA11y(open, close, 'Report this listing');

  const signIn = async () => {
    sessionStorage.setItem('post_auth_return', window.location.href);
    markBuyerIntent();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true); setError('');
    const { error: rpcError } = await supabase.rpc('report_listing', {
      p_listing_id: listingId,
      p_reason: reason,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      const code = Object.keys(ERRORS).find(k => rpcError.message?.includes(k));
      setError(code ? ERRORS[code] : 'Could not send the report. Please try again.');
      return;
    }
    setDone(true);
  };

  if (!listingId) return null;

  return (
    <>
      {/* stopPropagation matters: the icon variant sits inside the mosaic cell,
          whose own onClick opens the lightbox. Without it, reporting a listing
          would open the photo viewer instead. */}
      {variant === 'icon' ? (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          aria-label="Report this listing"
          title="Report this listing"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: '50%', padding: 0,
            background: 'rgba(6,8,15,0.62)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: 'rgba(255,255,255,0.85)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <Flag size={13} />
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', padding: '8px 4px',
            color: th?.textMuted || '#64748b', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'var(--xd-font-body)',
          }}
        >
          <Flag size={12} />
          Report this listing
        </button>
      )}

      {open && createPortal(
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            ref={dialog.ref}
            {...dialog.dialogProps}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 400, maxHeight: '85vh', overflowY: 'auto',
              outline: 'none',
              background: th?.card || '#0a1220',
              border: `1px solid ${th?.border || 'rgba(255,255,255,0.07)'}`,
              borderRadius: 14, padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: th?.text || '#e2e8f0', fontFamily: 'var(--xd-font-body)' }}>
                {done ? 'Report sent' : 'Report this listing'}
              </p>
              <button onClick={close} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: th?.textMuted || '#64748b', display: 'flex', padding: 2 }}>
                <X size={16} />
              </button>
            </div>

            {done ? (
              <div style={{ paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 16 }}>
                  <Check size={15} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 13, color: th?.textSec || '#94a3b8', lineHeight: 1.6, fontFamily: 'var(--xd-font-body)' }}>
                    Thanks — our team will review this listing. We do not share who reported a listing with the seller.
                  </p>
                </div>
                <button
                  onClick={close}
                  style={{ width: '100%', padding: '10px 0', borderRadius: 9, background: th?.card2 || 'rgba(255,255,255,0.05)', border: `1px solid ${th?.border || 'rgba(255,255,255,0.1)'}`, color: th?.text || '#e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--xd-font-body)' }}
                >
                  Done
                </button>
              </div>
            ) : !session ? (
              <div style={{ paddingTop: 10 }}>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: th?.textSec || '#94a3b8', lineHeight: 1.6, fontFamily: 'var(--xd-font-body)' }}>
                  Sign in to report a listing. This keeps reports accountable and stops false reports being used against sellers.
                </p>
                <button
                  onClick={signIn}
                  style={{ width: '100%', padding: '11px 0', borderRadius: 9, background: '#dc2626', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--xd-font-body)' }}
                >
                  Sign in with Google
                </button>
              </div>
            ) : (
              <>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: th?.textMuted || '#64748b', lineHeight: 1.5, fontFamily: 'var(--xd-font-body)' }}>
                  Tell us what is wrong. Reports go to the XDrive team for review.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
                  {REASONS.map(r => {
                    const active = reason === r.key;
                    return (
                      <label
                        key={r.key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 11px', borderRadius: 9, cursor: 'pointer',
                          background: active ? 'rgba(220,38,38,0.08)' : 'transparent',
                          border: `1px solid ${active ? 'rgba(220,38,38,0.3)' : 'transparent'}`,
                          transition: 'all 0.12s',
                        }}
                      >
                        <input
                          type="radio"
                          name="report-reason"
                          checked={active}
                          onChange={() => { setReason(r.key); setError(''); }}
                          style={{ accentColor: '#dc2626', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 13, color: active ? (th?.text || '#e2e8f0') : (th?.textSec || '#94a3b8'), fontWeight: active ? 600 : 400, fontFamily: 'var(--xd-font-body)' }}>
                          {r.label}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Add any detail that helps us check this (optional)"
                  style={{
                    width: '100%', padding: '10px 11px', borderRadius: 9, resize: 'vertical',
                    background: th?.inputBg || 'rgba(255,255,255,0.05)',
                    border: `1px solid ${th?.inputBorder || 'rgba(255,255,255,0.12)'}`,
                    color: th?.text || '#e2e8f0', fontSize: 13, outline: 'none',
                    fontFamily: 'var(--xd-font-body)', marginBottom: 12,
                  }}
                />

                {error && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, padding: '9px 11px', borderRadius: 9, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
                    <AlertCircle size={13} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: '#f87171', lineHeight: 1.5, fontFamily: 'var(--xd-font-body)' }}>{error}</span>
                  </div>
                )}

                <button
                  onClick={submit}
                  disabled={!reason || busy}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 9, border: 'none',
                    background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: !reason || busy ? 'not-allowed' : 'pointer',
                    opacity: !reason || busy ? 0.5 : 1,
                    fontFamily: 'var(--xd-font-body)',
                  }}
                >
                  {busy ? 'Sending…' : 'Send report'}
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
