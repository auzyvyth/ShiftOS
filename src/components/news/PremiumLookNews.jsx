import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../supabaseClient';
import { useModalHistory } from '../../hooks/useModalHistory';
import { markStarterTask } from '../../utils/starterTasks';

// NEWS-1 (owner, 2026-11-26): ONE "what's new" pop-up for every salesman (Lite and Premium), shown
// ONCE per account on the first open after release, never again. Seen = profiles.starter_tasks
// [SEEN_KEY], the same bag the tours use (the console handover resets it, which is fine: a new
// owner of the account has not seen it either). The owner records the GIF; until it is in
// public/news/ the pop-up stays off (NEWS_READY), except `?news=1`, which shows it to whoever opens
// that link, for the owner to check it on staging. Lite: "try 7 days free" ONLY when the trial is
// still unused (get_my_premium_offer), else it sends them to the Premium screen, never a free promise
// they cannot get. Words in en + ms.

export const NEWS_READY = true; // owner, 2026-11-26: "apply it". No GIF file = the pop-up simply has no picture area.
const SEEN_KEY = 'news_premium_look_1';
const GIF = '/news/premium-new-look.gif';

const COPY = {
  en: {
    eyebrow: "What's new",
    title: 'Premium has a new look',
    body: 'Your page can now open on a business card: your cars turning on top, your photo, your numbers and one WhatsApp button.',
    trial: 'Try Premium 7 days',
    trialNote: 'No card needed. After 7 days you go back to Lite unless you pay.',
    lite: 'See Premium',
    premium: 'Check it out',
    premiumNote: 'Opens your page.',
    later: 'Maybe later',
  },
  ms: {
    eyebrow: 'Baru',
    title: 'Premium kini ada rupa baru',
    body: 'Page anda kini boleh dibuka dengan kad perniagaan: kereta anda berpusing di atas, gambar anda, angka anda dan satu butang WhatsApp.',
    trial: 'Cuba Premium 7 hari',
    trialNote: 'Tiada kad diperlukan. Selepas 7 hari anda kembali ke Lite jika tidak membayar.',
    lite: 'Lihat Premium',
    premium: 'Tengok sekarang',
    premiumNote: 'Buka page anda.',
    later: 'Nanti dulu',
  },
};

export default function PremiumLookNews({ userId, profile, isPremium, blocked, onPremiumScreen }) {
  const forced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('news') === '1';
  const seen = !!profile?.starter_tasks?.[SEEN_KEY];
  const want = !!userId && !!profile && (forced || (NEWS_READY && !seen)) && !blocked;
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [gifOk, setGifOk] = useState(true);
  const { i18n } = useTranslation();
  const c = COPY[String(i18n?.language || 'en').startsWith('ms') ? 'ms' : 'en'];

  // Open a moment after the panel paints, so it never lands on a half-drawn screen.
  useEffect(() => {
    if (!want || open) return undefined;
    const id = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(id);
  }, [want]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seen once it has been on screen (closing the app counts), like the tours.
  useEffect(() => {
    if (!open || forced || seen) return undefined;
    const id = setTimeout(() => { markStarterTask(userId, SEEN_KEY, profile?.starter_tasks); }, 1500);
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

  const close = () => setOpen(false);
  useModalHistory(open, close);

  const startTrial = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('start_premium_trial');
    setBusy(false);
    if (error) { toast.error("Couldn't start your free trial. Try again."); return; }
    if (data === 'ok' || data === 'already_premium') { window.location.href = '/salesman-premium'; return; }
    setOffer((o) => ({ ...o, trial_available: false }));
    toast.error(data === 'used' ? 'Your free trial has already been used.' : "This account can't start a free trial.");
  };

  if (!open) return null;
  const trial = !isPremium && offer?.trial_available;
  const btn = { width: '100%', minHeight: 48, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="news-title" onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(5,6,8,.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: 'min(420px, 100%)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', background: '#111318', color: '#f4f5f7',
          borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
        <button type="button" onClick={close} aria-label="Close"
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 1, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={18} />
        </button>
        {gifOk && (
          <div style={{ background: '#08090b', borderRadius: '20px 20px 0 0', overflow: 'hidden', height: 'min(48dvh, 460px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={GIF} alt="" onError={() => setGifOk(false)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: '18px 20px 20px' }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,245,247,.55)' }}>{c.eyebrow}</p>
          <h2 id="news-title" style={{ margin: '6px 0 8px', fontFamily: "'Bebas Neue', sans-serif", fontWeight: 400, fontSize: 34, lineHeight: 1 }}>{c.title}</h2>
          <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.55, color: 'rgba(244,245,247,.78)' }}>{c.body}</p>
          {isPremium ? (
            <>
              <button type="button" className="lk-red" style={{ ...btn, color: '#fff' }} onClick={() => { close(); if (profile?.slug) window.open(`/s/${encodeURIComponent(profile.slug)}`, '_blank'); }}>{c.premium}</button>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(244,245,247,.55)', textAlign: 'center' }}>{c.premiumNote}</p>
            </>
          ) : offer === null ? (
            <div style={{ height: 48 }} />
          ) : trial ? (
            <>
              <button type="button" className="lk-red" style={{ ...btn, color: '#fff' }} disabled={busy} onClick={startTrial}>{busy ? '...' : c.trial}</button>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(244,245,247,.55)', textAlign: 'center' }}>{c.trialNote}</p>
            </>
          ) : (
            <button type="button" className="lk-red" style={{ ...btn, color: '#fff' }} onClick={() => { close(); onPremiumScreen?.(); }}>{c.lite}</button>
          )}
          <button type="button" onClick={close} style={{ ...btn, marginTop: 8, minHeight: 40, background: 'transparent', color: 'rgba(244,245,247,.6)', fontWeight: 600, fontSize: 14 }}>{c.later}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
