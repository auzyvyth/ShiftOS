// Post one live car to the connected social accounts (ZERNIO-1 TEST rig, 2026-11-12).
// Opened from a car's ··· menu in Salesman Premium, and only for logins the edge function
// `zernio-post` allows (useSocialPostAccess). Nothing is sent until the seller taps
// "Post now" and then confirms; "Save as draft" sends it to Zernio without publishing.
//
// The words for each network come from the shared caption adjuster
// (supabase/functions/_shared/postCaption.js): the same file the server re-checks with, so
// a text that passes here passes there. The seller can edit every text before sending.
//
// Zernio cannot edit a published post, so afterwards the only controls are "Open post" and
// (Facebook, Threads) "Take it down". Instagram / TikTok posts cannot be removed through it.
//
// Portalled to document.body with body scroll locked and Back wired (overlay rules 1, 2, 5).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';
import { SITE_URL } from '../../config/site';
import { cdnImg } from '../../utils/img';
import { premiumDark as P } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';
import {
  buildPost, validateText, carLink, carTitle, money, ERROR_TEXT,
} from '../../../supabase/functions/_shared/postCaption.js';
import { callZernioPost } from './useSocialPostAccess';

const NETWORK = {
  facebook:  { label: 'Facebook Page', canTakeDown: true,  note: 'Clickable link, up to 8 photos.' },
  threads:   { label: 'Threads',       canTakeDown: true,  note: '500 characters. The link counts.' },
  instagram: { label: 'Instagram',     canTakeDown: false, note: 'Links are not clickable, so it says "link in bio". Cannot be taken down from here.' },
};

const SERVER_ERRORS = {
  not_connected: 'That account is not connected in Zernio.',
  car_not_live: 'Only a live (Available) car can be posted.',
  car_not_found: 'That car was not found on your account.',
  needs_photo: 'Instagram needs at least one photo.',
  link_missing: 'The text must keep this car\'s link.',
  foreign_link: 'Only drevo.my links are allowed in a post.',
  forbidden: 'This login is not allowed to post.',
  not_configured: 'The Zernio key is not set on the server yet.',
  network: 'Could not reach the server. Try again.',
  unknown_action: 'The server does not know this action. Redeploy the function.',
};
const explain = (e) => (e?.message && e.error === 'text_rejected') ? e.message
  : (e?.error === 'zernio_failed' ? `Zernio said no${e.message ? `: ${e.message}` : ` (${e.status || 'error'})`}.` : SERVER_ERRORS[e?.error] || 'Something went wrong. Nothing was posted.');

const isDone = (s) => ['published', 'failed', 'error', 'removed', 'cancelled'].includes(String(s || '').toLowerCase());
const isGood = (s) => String(s || '').toLowerCase() === 'published';
const isBad = (s) => ['failed', 'error'].includes(String(s || '').toLowerCase());

// A text box that grows to show ALL its text (max 340px, then it scrolls): the car's link is
// the last line, and a box that hides it hides the one thing the seller must keep.
function GrowBox({ value, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 340)}px`;
  }, [value]);
  return <textarea ref={ref} value={value} {...rest} />;
}

export default function PostToSocialsSheet({ car, seller, access, onClose }) {
  useModalHistory(true, onClose);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const networks = useMemo(() => (access.accounts || []).filter((a) => NETWORK[a.platform]), [access.accounts]);
  const url = useMemo(() => carLink(SITE_URL, car, seller?.slug), [car, seller?.slug]);
  const built = useMemo(() => {
    const out = {};
    for (const n of networks) out[n.platform] = buildPost(n.platform, car, url);
    return out;
  }, [networks, car, url]);

  const [picked, setPicked] = useState(() => Object.fromEntries(networks.map((n) => [n.platform, true])));
  const [texts, setTexts] = useState(() => Object.fromEntries(networks.map((n) => [n.platform, built[n.platform].text])));
  const [phase, setPhase] = useState('edit'); // edit | confirm | sending | result
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { post_id, platforms[], draft }
  const [busy, setBusy] = useState('');
  const tries = useRef(0);

  const chosen = networks.filter((n) => picked[n.platform]);
  const checks = Object.fromEntries(chosen.map((n) => [n.platform, validateText(n.platform, texts[n.platform])]));
  const allValid = chosen.length > 0 && chosen.every((n) => checks[n.platform].ok)
    && chosen.every((n) => n.platform === 'instagram' || texts[n.platform].includes(`/showroom/${encodeURIComponent(car.slug)}`));
  const photoCount = Math.min(8, Array.isArray(car.images) ? car.images.length : 0);

  const send = async (draft) => {
    setError(''); setPhase('sending');
    const { data, err } = await callZernioPost({
      action: 'publish', listing_id: car.id, draft,
      items: chosen.map((n) => ({ platform: n.platform, text: texts[n.platform] })),
    });
    if (err) { setError(explain(err)); setPhase('edit'); return; }
    tries.current = 0;
    setResult({ post_id: data.post_id, platforms: data.platforms || [], draft });
    setPhase('result');
  };

  const refresh = useCallback(async () => {
    if (!result?.post_id) return;
    const { data, err } = await callZernioPost({ action: 'check', post_id: result.post_id });
    if (!err && data) setResult((r) => ({ ...r, platforms: data.platforms || r.platforms }));
  }, [result?.post_id]);

  // Poll every 3 seconds (max ~1 minute) while a network is still publishing.
  useEffect(() => {
    if (phase !== 'result' || result?.draft) return undefined;
    if ((result.platforms || []).every((p) => isDone(p.status)) || tries.current >= 20) return undefined;
    const id = setTimeout(async () => { tries.current += 1; await refresh(); }, 3000);
    return () => clearTimeout(id);
  }, [phase, result, refresh]);

  const takeDown = async (platform) => {
    setBusy(platform); setError('');
    const { err } = await callZernioPost({ action: 'takedown', post_id: result.post_id, platform });
    setBusy('');
    if (err) { setError(explain(err)); return; }
    setResult((r) => ({ ...r, platforms: r.platforms.map((p) => (p.platform === platform ? { ...p, status: 'removed', url: null } : p)) }));
  };

  const wide = typeof window !== 'undefined' && window.innerWidth >= 700;
  const photo = Array.isArray(car.images) && car.images[0] ? cdnImg(car.images[0], 200, 70) : null;
  const font = 'var(--xd-font-body, Outfit, system-ui, sans-serif)';
  const pill = (active) => ({
    height: 34, padding: '0 14px', borderRadius: P.radius.pill, border: 'none', cursor: 'pointer', fontFamily: font,
    fontSize: 13, fontWeight: 600, background: active ? P.text : P.raised, color: active ? P.card : P.textSec,
  });
  const ghost = { height: 44, padding: '0 18px', borderRadius: P.radius.pill, border: 'none', cursor: 'pointer', fontFamily: font,
    fontSize: 14, fontWeight: 600, background: P.raised, color: P.text };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Post this car"
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'sending') onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center', fontFamily: font }}>
      <div style={{ width: '100%', maxWidth: 620, maxHeight: wide ? '88dvh' : '94dvh', display: 'flex', flexDirection: 'column',
        background: P.card, color: P.text, borderRadius: wide ? P.radius.card : `${P.radius.card}px ${P.radius.card}px 0 0` }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px 12px' }}>
          {photo && <img src={photo} alt="" width="52" height="52" style={{ width: 52, height: 52, borderRadius: P.radius.row, objectFit: 'cover', background: P.raised, flexShrink: 0 }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: P.textMuted, fontWeight: 600, letterSpacing: '.04em' }}>POST THIS CAR</div>
            <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{carTitle(car)}</div>
            <div style={{ fontSize: 13, color: P.textSec }}>{money(car.selling_price) || 'No price'} · {photoCount} photo{photoCount === 1 ? '' : 's'}</div>
          </div>
          <button onClick={onClose} aria-label="Close" disabled={phase === 'sending'}
            style={{ width: 36, height: 36, borderRadius: P.radius.pill, border: 'none', background: P.raised, color: P.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '4px 18px 12px', flex: 1, minHeight: 0 }}>
          {phase !== 'result' && networks.length === 0 && (
            <p style={{ color: P.textSec, fontSize: 14 }}>No social account is connected yet.</p>
          )}

          {phase !== 'result' && networks.map((n) => {
            const b = built[n.platform];
            const text = texts[n.platform];
            const count = Array.from(text).length;
            const over = count > b.limit;
            const errs = checks[n.platform]?.errors || [];
            const on = !!picked[n.platform];
            return (
              <div key={n.platform} style={{ background: P.raised, borderRadius: P.radius.row, padding: 14, marginBottom: 10, opacity: on ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: on ? 10 : 0 }}>
                  <button type="button" onClick={() => setPicked((p) => ({ ...p, [n.platform]: !on }))} disabled={phase === 'sending'}
                    aria-pressed={on} style={pill(on)}>{on ? 'On' : 'Off'}</button>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{NETWORK[n.platform].label}</div>
                    <div style={{ fontSize: 12.5, color: P.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</div>
                  </div>
                </div>
                {on && (
                  <>
                    <GrowBox value={text} rows={3} disabled={phase === 'sending'} aria-label={`${NETWORK[n.platform].label} text`}
                      onChange={(e) => setTexts((t) => ({ ...t, [n.platform]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', resize: 'none', display: 'block', background: P.card, color: P.text, border: 'none', borderRadius: P.radius.row,
                        padding: 12, fontSize: 16, lineHeight: 1.45, fontFamily: font, outline: 'none' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, fontSize: 12.5 }}>
                      <span style={{ color: P.textMuted }}>{NETWORK[n.platform].note}</span>
                      <span style={{ color: over ? P.accentText : P.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: over ? 700 : 400 }}>{count} / {b.limit}</span>
                    </div>
                    {b.dropped.length > 0 && text === b.text && (
                      <div style={{ marginTop: 4, fontSize: 12.5, color: P.textSec }}>Left out to fit: {b.dropped.join(', ')}.</div>
                    )}
                    {errs.map((e) => (<div key={e} style={{ marginTop: 4, fontSize: 12.5, color: P.accentText }}>{ERROR_TEXT[e] || e}</div>))}
                    {n.platform !== 'instagram' && !text.includes(`/showroom/${encodeURIComponent(car.slug)}`) && (
                      <div style={{ marginTop: 4, fontSize: 12.5, color: P.accentText }}>The car's link is missing. Put it back or tap Reset.</div>
                    )}
                    {text !== b.text && (
                      <button type="button" onClick={() => setTexts((t) => ({ ...t, [n.platform]: b.text }))}
                        style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, color: P.textSec, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', fontFamily: font }}>Reset text</button>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {phase === 'result' && result && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 10px' }}>{result.draft ? 'Saved as a draft in Zernio. Nothing was published.' : 'Sent.'}</div>
              {(result.platforms || []).map((p) => {
                const meta = NETWORK[p.platform] || { label: p.platform };
                const st = String(p.status || 'pending').toLowerCase();
                return (
                  <div key={p.platform} style={{ background: P.raised, borderRadius: P.radius.row, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{meta.label}</div>
                        <div style={{ fontSize: 13, color: isGood(st) ? P.up : isBad(st) ? P.accentText : P.textSec }}>
                          {result.draft ? 'Draft' : isGood(st) ? 'Published' : isBad(st) ? 'Failed' : st === 'removed' ? 'Taken down' : 'Publishing...'}
                        </div>
                        {p.error && <div style={{ fontSize: 12.5, color: P.accentText, marginTop: 2 }}>{String(p.error).slice(0, 160)}</div>}
                      </div>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ ...ghost, height: 36, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
                          Open <ExternalLink size={13} />
                        </a>
                      )}
                      {isGood(st) && meta.canTakeDown && (
                        <button onClick={() => takeDown(p.platform)} disabled={busy === p.platform} style={{ ...ghost, height: 36, fontSize: 13 }}>
                          {busy === p.platform ? 'Removing...' : 'Take it down'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!result.draft && (result.platforms || []).some((p) => !isDone(p.status)) && (
                <button onClick={refresh} style={{ ...ghost, height: 36, fontSize: 13 }}>Check again</button>
              )}
            </div>
          )}

          {error && <div role="alert" style={{ marginTop: 6, padding: '10px 12px', borderRadius: P.radius.row, background: P.raised, color: P.accentText, fontSize: 13.5 }}>{error}</div>}
        </div>

        <div style={{ padding: '10px 18px calc(14px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {phase === 'edit' && (
            <>
              <button className="lk-red" onClick={() => setPhase('confirm')} disabled={!allValid}
                style={{ height: 48, borderRadius: P.radius.pill, border: 'none', color: P.onAccent, fontSize: 15, fontWeight: 700, cursor: allValid ? 'pointer' : 'not-allowed', opacity: allValid ? 1 : 0.45, fontFamily: font }}>
                {chosen.length ? `Post now to ${chosen.length} place${chosen.length > 1 ? 's' : ''}` : 'Turn a network on'}
              </button>
              <button onClick={() => send(true)} disabled={!allValid} style={{ ...ghost, height: 40, fontSize: 13, opacity: allValid ? 1 : 0.45 }}>
                Save as draft in Zernio (does not publish)
              </button>
            </>
          )}
          {phase === 'confirm' && (
            <>
              <div style={{ fontSize: 14, lineHeight: 1.45, color: P.text }}>
                This goes <b>public right now</b> on {chosen.map((n) => `${NETWORK[n.platform].label} (${n.name})`).join(' and ')}.
                {chosen.some((n) => !NETWORK[n.platform].canTakeDown) && ' Instagram posts cannot be taken down from here.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPhase('edit')} style={{ ...ghost, flex: 1 }}>Back</button>
                <button className="lk-red" onClick={() => send(false)} style={{ flex: 2, height: 44, borderRadius: P.radius.pill, border: 'none', color: P.onAccent, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>Yes, post it</button>
              </div>
            </>
          )}
          {phase === 'sending' && (
            <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.textSec, fontSize: 14 }}>Sending... this can take 10 to 20 seconds.</div>
          )}
          {phase === 'result' && (
            <button onClick={onClose} style={{ ...ghost, height: 46 }}>Done</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
