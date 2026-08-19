import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  kycTierForProfile,
  KYC_KINDS,
  KYC_LABELS,
  validateKycImage,
  submitFreeKyc,
  submitPremiumKyc,
} from '../lib/kyc';

// Identity-approval gate. Shown to a self-signup seller (dealer / solo salesman)
// whose account is 'pending' or 'rejected'. Free accounts (numbers already
// captured) just wait; premium accounts upload IC front/back + a selfie holding
// their IC into the private bucket. When the superadmin approves, the realtime
// subscription forwards them straight into the dashboard.
//
// This is a SEPARATE, earlier gate from DealerPendingApproval (which is about
// PAYMENT). Identity is checked first; payment/trial gates run after approval.
export default function PendingApproval({ profile, redirectTo = '/dashboard' }) {
  const tier = kycTierForProfile(profile);
  const [status, setStatus] = useState(profile?.approval_status || 'pending');
  const [reason, setReason] = useState(profile?.rejection_reason || '');
  const [submitted, setSubmitted] = useState(Boolean(profile?.kyc_submitted_at));
  const [resubmitting, setResubmitting] = useState(false);

  const [files, setFiles] = useState({ front: null, back: null, selfie: null });
  const [previews, setPreviews] = useState({ front: '', back: '', selfie: '' });
  const [fileErr, setFileErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const freeSubmitFired = useRef(false);

  // Forward the instant an admin approves; reflect a rejection in place.
  useEffect(() => {
    if (!profile?.id) return undefined;
    const ch = supabase
      .channel('user-approval-' + profile.id)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        (payload) => {
          const s = payload.new?.approval_status;
          if (s === 'approved') { window.location.href = redirectTo; return; }
          if (s === 'rejected') {
            setStatus('rejected');
            setReason(payload.new?.rejection_reason || '');
            setResubmitting(false);
          }
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile?.id, redirectTo]);

  // Free tier has nothing to upload — the IC number was captured at onboarding.
  // Auto-mark it submitted once so it lands in the review queue, then wait.
  useEffect(() => {
    if (tier !== 'free' || status !== 'pending' || submitted || freeSubmitFired.current) return;
    freeSubmitFired.current = true;
    submitFreeKyc().then(() => setSubmitted(true)).catch(() => { freeSubmitFired.current = false; });
  }, [tier, status, submitted]);

  // Revoke object URLs on unmount / replacement so previews don't leak memory.
  useEffect(() => () => Object.values(previews).forEach(u => u && URL.revokeObjectURL(u)), [previews]);

  const pickFile = (kind) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after an error
    if (!file) return;
    const v = await validateKycImage(file);
    if (!v.ok) { setFileErr(p => ({ ...p, [kind]: v.error })); return; }
    setFileErr(p => ({ ...p, [kind]: '' }));
    setFiles(p => ({ ...p, [kind]: file }));
    setPreviews(p => {
      if (p[kind]) URL.revokeObjectURL(p[kind]);
      return { ...p, [kind]: URL.createObjectURL(file) };
    });
  };

  const allPicked = KYC_KINDS.every(k => files[k]);

  const submitPremium = async () => {
    setErr('');
    if (!allPicked) { setErr('Please add all three photos.'); return; }
    setBusy(true);
    try {
      await submitPremiumKyc(profile.id, files);
      setSubmitted(true);
      setStatus('pending');
      setResubmitting(false);
    } catch (e) {
      setErr(typeof e?.message === 'string' ? e.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resubmitFree = async () => {
    setErr(''); setBusy(true);
    try { await submitFreeKyc(); setStatus('pending'); setSubmitted(true); }
    catch { setErr('Could not resubmit. Please try again.'); }
    finally { setBusy(false); }
  };

  // ── presentation ───────────────────────────────────────────────────────────
  const wrap = { minHeight: '100vh', background: '#070A12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' };
  const box = { width: 'min(460px, 94%)', background: '#0d1420', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '30px 26px', textAlign: 'center' };
  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };

  const showUpload = tier === 'premium' && (
    (status === 'pending' && !submitted) || (status === 'rejected' && resubmitting)
  );
  const showWaiting = !showUpload && status === 'pending';
  const showRejected = !showUpload && status === 'rejected';

  const ic = profile?.ic_last4 ? `••••••-••-${profile.ic_last4}` : null;

  return (
    <div style={wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{ width: 30, height: 30, background: '#dc2626', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>X</div>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, color: '#E8EDF5' }}>SHIFTOS</span>
      </div>

      <div style={box}>
        {showWaiting && (
          <>
            <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(96,165,250,0.9)', margin: '0 0 12px', fontWeight: 600 }}>Account under review</p>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: 2, color: '#E8EDF5', lineHeight: 1.05, marginBottom: 10 }}>ALMOST THERE</div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7, margin: '0 0 22px' }}>
              We're verifying your details to keep the marketplace trusted. This is usually quick — you'll be let straight in the moment you're approved, no need to refresh.
            </p>
            <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              {[['Name', profile?.full_name], ['Email', profile?.email], ['IC', ic], ['Business', profile?.dealership]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: 12.5 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                  <span style={{ color: '#E8EDF5', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {showRejected && (
          <>
            <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(248,113,113,0.9)', margin: '0 0 12px', fontWeight: 600 }}>Not approved</p>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#E8EDF5', lineHeight: 1.05, marginBottom: 10 }}>WE NEED ANOTHER LOOK</div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7, margin: '0 0 14px' }}>
              Your account couldn't be approved yet.{reason ? '' : ' Please contact support for the details.'}
            </p>
            {reason && (
              <div style={{ textAlign: 'left', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{reason}</p>
              </div>
            )}
            {tier === 'premium' ? (
              <button onClick={() => { setResubmitting(true); setErr(''); }}
                style={{ width: '100%', height: 46, background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: 10 }}>
                Re-upload documents
              </button>
            ) : (
              <button onClick={resubmitFree} disabled={busy}
                style={{ width: '100%', height: 46, background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, marginBottom: 10 }}>
                {busy ? 'Resubmitting…' : 'Resubmit for review'}
              </button>
            )}
          </>
        )}

        {showUpload && (
          <>
            <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(96,165,250,0.9)', margin: '0 0 12px', fontWeight: 600 }}>Verify your identity</p>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 2, color: '#E8EDF5', lineHeight: 1.05, marginBottom: 10 }}>ONE LAST STEP</div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12.5, lineHeight: 1.65, margin: '0 0 20px' }}>
              To activate a paid account, upload a photo of your IC (front and back) and a selfie holding it. Stored privately, seen only by our review team, and deleted the moment you're verified.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              {KYC_KINDS.map(kind => (
                <label key={kind} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: `1px solid ${fileErr[kind] ? 'rgba(248,113,113,0.5)' : files[kind] ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {previews[kind]
                      ? <img src={previews[kind]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 20 }}>+</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#E8EDF5' }}>{KYC_LABELS[kind]}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: fileErr[kind] ? '#f87171' : files[kind] ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                      {fileErr[kind] || (files[kind] ? 'Ready' : 'Tap to add a photo')}
                    </p>
                  </div>
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={pickFile(kind)} style={{ display: 'none' }} />
                </label>
              ))}
            </div>

            {err && <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 12px' }}>{err}</p>}

            <button onClick={submitPremium} disabled={busy || !allPicked}
              style={{ width: '100%', height: 46, background: allPicked ? '#dc2626' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: allPicked ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: busy || !allPicked ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, marginBottom: 10 }}>
              {busy ? 'Submitting…' : 'Submit for review'}
            </button>
          </>
        )}

        <button onClick={logout}
          style={{ width: '100%', height: 44, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Log Out
        </button>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 18, textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
        This page updates automatically once your account is approved.
      </p>
    </div>
  );
}
