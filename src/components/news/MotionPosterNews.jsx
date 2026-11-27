import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../supabaseClient';
import { useModalHistory } from '../../hooks/useModalHistory';
import { markStarterTask } from '../../utils/starterTasks';
import { OPS_WHATSAPP } from '../../utils/planConfig';
import { PREMIUM_PRICE, SaveQrButton } from '../premium/PremiumPayBox';

// NEWS-2 (owner, 2026-11-28): the once-per-account Moving poster pop-up.
// Premium: "Show me" starts MotionPosterGuide. Lite: 7-day trial when unused
// (get_my_premium_offer), else Get Premium -> QR -> "I've paid" -> WhatsApp.
// The app cannot tell whether money arrived: the owner confirms by hand.
// Lite and Premium have separate seen keys, so a seller who starts the trial
// still gets the Premium walkthrough. Never in the same visit as the
// "new look" pop-up (NEWS-1). `?news=poster` forces it, for testing.

const LOOK_SEEN_KEY = 'news_premium_look_1';
const VIDEO = '/news/moving-poster.mp4';
const STILL = '/news/moving-poster.jpg';

const COPY = {
  en: {
    eyebrow: 'New in Premium', title: 'Did you know?',
    body: 'You can now get a video of the loan calculations for your car, ready to post or send to a buyer.',
    premiumTitle: 'Meet Moving poster',
    premiumBody: 'Did you know? You can now get a video of your loan calculations, ready to post or send to a buyer.',
    show: 'Show me', trial: 'Try Premium free for 7 days',
    trialNote: 'No card needed. After 7 days you go back to Lite unless you pay.',
    ended: 'Your free trial has ended.', get: `Get Premium · RM${PREMIUM_PRICE}/month`, later: 'Maybe later',
    payTitle: `Pay RM${PREMIUM_PRICE}`, payBody: 'Scan with your bank or e-wallet app.', paid: 'I’ve paid',
    lastTitle: 'One last step',
    lastBody: 'Send us a WhatsApp and attach your receipt. We switch you to Premium once we’ve checked the payment.',
    wa: 'WhatsApp: I’ve paid', back: 'Back to QR', close: 'Close',
  },
  ms: {
    eyebrow: 'Baru dalam Premium', title: 'Tahukah anda?',
    body: 'Kini anda boleh dapatkan video kiraan loan kereta anda, sedia untuk dipost atau dihantar kepada pembeli.',
    premiumTitle: 'Kenali Poster bergerak',
    premiumBody: 'Tahukah anda? Kini anda boleh dapatkan video kiraan loan, sedia untuk dipost atau dihantar kepada pembeli.',
    show: 'Tunjukkan saya', trial: 'Cuba Premium percuma 7 hari',
    trialNote: 'Tiada kad diperlukan. Selepas 7 hari anda kembali ke Lite jika tidak membayar.',
    ended: 'Percubaan percuma anda telah tamat.', get: `Dapatkan Premium · RM${PREMIUM_PRICE}/bulan`, later: 'Nanti dulu',
    payTitle: `Bayar RM${PREMIUM_PRICE}`, payBody: 'Scan dengan app bank atau e-wallet anda.', paid: 'Saya dah bayar',
    lastTitle: 'Satu langkah lagi',
    lastBody: 'Hantar WhatsApp kepada kami bersama resit. Kami aktifkan Premium selepas semak bayaran.',
    wa: 'WhatsApp: Saya dah bayar', back: 'Kembali ke QR', close: 'Tutup',
  },
};

export default function MotionPosterNews({ userId, profile, isPremium, blocked, onShowMe }) {
  const forced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('news') === 'poster';
  const seenKey = isPremium ? 'news_motion_poster_premium' : 'news_motion_poster_lite';
  const seen = !!profile?.starter_tasks?.[seenKey];
  // Decided once, from the first profile load: if NEWS-1 was still unseen then,
  // this visit is its visit.
  const lookPending = useRef(null);
  if (profile && lookPending.current === null) lookPending.current = !profile.starter_tasks?.[LOOK_SEEN_KEY];
  const want = !!userId && !!profile && (forced || (!seen && lookPending.current === false)) && !blocked;

  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState('intro'); // intro | pay | paid
  const [offer, setOffer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [videoOk, setVideoOk] = useState(true);
  const { i18n } = useTranslation();
  const c = COPY[String(i18n?.language || 'en').startsWith('ms') ? 'ms' : 'en'];

  useEffect(() => {
    if (!want || open || done) return undefined;
    const id = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(id);
  }, [want, open, done]);

  useEffect(() => {
    if (!open || forced || seen) return undefined;
    const id = setTimeout(() => { markStarterTask(userId, seenKey, profile?.starter_tasks); }, 1500);
    return () => clearTimeout(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || isPremium) return undefined;
    let alive = true;
    supabase.rpc('get_my_premium_offer').then(({ data, error }) => {
      if (alive) setOffer(error || !data ? { trial_available: false } : data);
    });
    return () => { alive = false; };
  }, [open, isPremium]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // `done` stops it reopening in this visit (the profile in memory still says unseen).
  const close = () => { setOpen(false); setDone(true); };
  useModalHistory(open, close);

  const startTrial = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('start_premium_trial');
    setBusy(false);
    if (error) { toast.error("Couldn't start your free trial. Try again."); return; }
    if (data === 'ok' || data === 'already_premium') { window.location.href = '/salesman-premium'; return; }
    setOffer((o) => ({ ...o, trial_available: false, trial_used: data === 'used' || o?.trial_used }));
    toast.error(data === 'used' ? 'Your free trial has already been used.' : "This account can't start a free trial.");
  };

  if (!open) return null;
  const ref = profile?.slug || profile?.full_name || profile?.email || '';
  const waText = `Hi, I've paid RM${PREMIUM_PRICE} for Drevo Premium. My page: ${ref}`;
  const btn = { display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', width: '100%', minHeight: 48, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', color: '#fff', textDecoration: 'none' };
  const ghost = { ...btn, marginTop: 4, minHeight: 44, background: 'transparent', color: 'rgba(244,245,247,.6)', fontWeight: 600, fontSize: 14 };
  const text = { margin: '0 0 14px', fontSize: 14.5, lineHeight: 1.5, color: 'rgba(244,245,247,.8)' };
  const title = (t) => <h2 id="poster-news-title" style={{ margin: '6px 44px 8px 0', fontFamily: "'Bebas Neue', sans-serif", fontWeight: 400, fontSize: 34, lineHeight: 1 }}>{t}</h2>;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="poster-news-title" onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(5,6,8,.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'var(--xd-font-body)' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: 'min(400px, 100%)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', background: '#111318', color: '#f4f5f7', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
        <button type="button" onClick={close} aria-label={c.close}
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 1, width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={18} />
        </button>
        {step === 'intro' && (
          <div style={{ background: '#08090b', height: 'min(46dvh, 420px)' }}>
            {videoOk ? (
              // React does not set the muted attribute reliably, and iOS only autoplays a muted video.
              <video ref={(v) => { if (v) v.muted = true; }} src={VIDEO} poster={STILL} autoPlay loop muted playsInline preload="auto"
                onError={() => setVideoOk(false)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            ) : (
              <img src={STILL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            )}
          </div>
        )}
        <div style={{ padding: '18px 20px 16px' }}>
          {step === 'intro' && (
            <>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,245,247,.6)' }}>{c.eyebrow}</p>
              {title(isPremium ? c.premiumTitle : c.title)}
              <p style={text}>{isPremium ? c.premiumBody : c.body}</p>
              {isPremium ? (
                <button type="button" className="lk-red" style={btn} onClick={() => { close(); onShowMe?.(); }}>{c.show}</button>
              ) : offer === null ? (
                <div style={{ height: 48 }} />
              ) : offer.trial_available ? (
                <>
                  <button type="button" className="lk-red" style={btn} disabled={busy} onClick={startTrial}>{busy ? '...' : c.trial}</button>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(244,245,247,.6)', textAlign: 'center' }}>{c.trialNote}</p>
                </>
              ) : (
                <>
                  {offer.trial_used && <p style={{ margin: '-4px 0 10px', fontSize: 13, color: '#fca5a5' }}>{c.ended}</p>}
                  <button type="button" className="lk-red" style={btn} onClick={() => setStep('pay')}>{c.get}</button>
                </>
              )}
              <button type="button" onClick={close} style={ghost}>{c.later}</button>
            </>
          )}
          {step === 'pay' && (
            <>
              {title(c.payTitle)}
              <p style={text}>{c.payBody}</p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 14 }}>
                <img src="/payment-qr.png" alt="DuitNow payment QR" width="220" height="340"
                  style={{ display: 'block', width: 220, height: 'auto', borderRadius: 8, background: '#fff' }} />
                <SaveQrButton />
              </div>
              <button type="button" className="lk-red" style={btn} onClick={() => setStep('paid')}>{c.paid}</button>
            </>
          )}
          {step === 'paid' && (
            <>
              {title(c.lastTitle)}
              <p style={text}>{c.lastBody}</p>
              <a href={`https://wa.me/${OPS_WHATSAPP}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"
                style={{ ...btn, background: '#0f7a3d' }}>{c.wa}</a>
              <button type="button" onClick={() => setStep('pay')} style={ghost}>{c.back}</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
