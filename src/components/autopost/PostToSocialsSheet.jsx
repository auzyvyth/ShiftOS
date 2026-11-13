// Post one car to Drevo's OWN Facebook Page and TikTok (SOCIAL-1). Opened from the console's Social
// queue (a car the seller agreed to share, after the owner approved it). Nothing is sent until the
// owner taps "Post now" and then confirms; "Save as draft" sends it to Zernio without publishing.
// TikTok needs a person to preview and consent to every post, which is what the tick box is.
//
// The words for each network come from the shared caption adjuster
// (supabase/functions/_shared/postCaption.js): the same file the server re-checks with, so
// a text that passes here passes there. The seller can edit every text before sending.
//
// Zernio cannot edit a published post, so afterwards the only controls are "Open post" and
// (Facebook, Threads) "Take it down", here and in the Recent tab (the last 30 days of this login's posts). Instagram / TikTok posts cannot be removed through it.
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
import { callZernioPost, explain } from './zernioApi';

const NETWORK = {
  facebook:  { label: 'Facebook Page', canTakeDown: true,  note: 'Clickable link, up to 8 photos.' },
  tiktok:    { label: 'TikTok',        canTakeDown: false, note: 'Photo post. No clickable link, so it says "link in bio". Cannot be taken down from here.' },
};

const isDone = (s) => ['published', 'failed', 'error', 'removed', 'cancelled'].includes(String(s || '').toLowerCase());
const isGood = (s) => String(s || '').toLowerCase() === 'published';
const isBad = (s) => ['failed', 'error'].includes(String(s || '').toLowerCase());

function ago(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

// "Recent" tab: the posts THIS login sent in the last 30 days (the server finds them by a
// tag on every post, so nothing is stored on our side). Take it down asks twice; a draft can
// be deleted; Instagram posts can only be opened.
export function RecentPosts({ font, ghost, client }) {
  const [rows, setRows] = useState(null);
  const [limit, setLimit] = useState(10);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [ask, setAsk] = useState('');
  const load = useCallback(async () => {
    setErr('');
    const { data, err: e } = await callZernioPost({ action: 'recent' }, client);
    if (e) { setErr(explain(e)); setRows((r) => r || []); return; }
    setRows(data.posts || []); setLimit(data.day_limit || 10);
  }, [client]);
  useEffect(() => { load(); }, [load]);

  const act = async (key, body, after) => {
    setBusy(key); setErr(''); setAsk('');
    const { err: e } = await callZernioPost(body, client);
    setBusy('');
    if (e) { setErr(explain(e)); return; }
    after();
  };
  const markRemoved = (id, platform) => setRows((rs) => rs.map((r) => (r.post_id !== id ? r
    : { ...r, platforms: r.platforms.map((p) => (p.platform === platform ? { ...p, status: 'removed', url: null } : p)) })));

  if (rows === null) return <p style={{ color: P.textSec, fontSize: 14 }}>Loading your posts...</p>;
  const today = rows.filter((r) => r.status !== 'draft' && Date.now() - new Date(r.when).getTime() < 86400000).length;
  return (
    <div>
      <div style={{ fontSize: 12.5, color: P.textMuted, margin: '2px 0 10px' }}>
        Posts you sent in the last 30 days. {today} of {limit} used in the last 24 hours.
      </div>
      {rows.length === 0 && !err && <p style={{ color: P.textSec, fontSize: 14 }}>Nothing posted yet.</p>}
      {rows.map((r) => (
        <div key={r.post_id} style={{ background: P.raised, borderRadius: P.radius.row, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || 'Car post'}</div>
          <div style={{ fontSize: 12.5, color: P.textMuted, marginBottom: 8 }}>{ago(r.when)}{r.status === 'draft' ? ' · Draft, not published' : ''}</div>
          {r.platforms.map((p) => {
            const meta = NETWORK[p.platform] || { label: p.platform, canTakeDown: false };
            const st = String(p.status || 'pending').toLowerCase();
            const key = `${r.post_id}:${p.platform}`;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{meta.label}</div>
                  <div style={{ fontSize: 12.5, color: isGood(st) ? P.up : isBad(st) ? P.accentText : P.textSec }}>
                    {r.status === 'draft' ? 'Draft' : isGood(st) ? 'Published' : isBad(st) ? 'Failed' : st === 'removed' ? 'Taken down' : 'Publishing...'}
                  </div>
                </div>
                {p.url && isGood(st) && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ ...ghost, height: 34, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
                    Open <ExternalLink size={13} />
                  </a>
                )}
                {(isGood(st) && meta.canTakeDown) && (
                  <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {ask !== key && busy !== key && (
                      <button onClick={() => setAsk(key)} disabled={!!busy} style={{ ...ghost, height: 34, fontSize: 13 }}>Take it down</button>
                    )}
                    {ask === key && (
                      <>
                        <span style={{ fontSize: 12.5, color: P.textSec, flex: '1 1 100%' }}>Remove this post from {meta.label}?</span>
                        <button onClick={() => setAsk('')} style={{ ...ghost, height: 34, fontSize: 13 }}>No</button>
                        <button className="lk-red" onClick={() => act(key, { action: 'takedown', post_id: r.post_id, platform: p.platform }, () => markRemoved(r.post_id, p.platform))}
                          style={{ height: 34, padding: '0 14px', borderRadius: P.radius.pill, border: 'none', color: P.onAccent, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>Yes, remove</button>
                      </>
                    )}
                    {busy === key && <span style={{ fontSize: 12.5, color: P.textSec }}>Removing...</span>}
                  </div>
                )}
              </div>
            );
          })}
          {r.status === 'draft' && (
            <button onClick={() => act(r.post_id, { action: 'discard', post_id: r.post_id }, () => setRows((rs) => rs.filter((x) => x.post_id !== r.post_id)))}
              disabled={!!busy} style={{ ...ghost, height: 34, fontSize: 13, marginTop: 4 }}>{busy === r.post_id ? 'Deleting...' : 'Delete draft'}</button>
          )}
          {r.platforms.some((p) => p.platform === 'instagram' || p.platform === 'tiktok') && (
            <div style={{ fontSize: 12, color: P.textMuted, marginTop: 4 }}>Instagram and TikTok posts can only be removed in their own app.</div>
          )}
        </div>
      ))}
      {err && <div role="alert" style={{ marginTop: 6, padding: '10px 12px', borderRadius: P.radius.row, background: P.raised, color: P.accentText, fontSize: 13.5 }}>{err}</div>}
      <button onClick={load} style={{ ...ghost, height: 34, fontSize: 13, marginTop: 4 }}>Refresh</button>
    </div>
  );
}

// TikTok's own choices (its API rules: no defaults for who sees it or for comments, and a
// confirmation for every post). Options come from the connected account itself.
// `count` > 1 = the bulk screen: one consent covers every post the owner has just previewed.
export function TikTokChoices({ photoCount, opts, tt, setTt, disabled, font, pill, count = 1 }) {
  const row = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 };
  const lbl = { fontSize: 12.5, color: P.textMuted, flex: '1 1 100%' };
  if (photoCount === 0) return <div style={{ marginTop: 8, fontSize: 12.5, color: P.accentText }}>TikTok needs at least one photo on this car.</div>;
  if (opts === undefined) return <div style={{ marginTop: 8, fontSize: 12.5, color: P.textSec }}>Loading your TikTok options...</div>;
  if (!opts) return <div style={{ marginTop: 8, fontSize: 12.5, color: P.accentText }}>Could not read your TikTok options. Close and reopen this sheet.</div>;
  return (
    <div>
      <div style={row}>
        <span style={lbl}>Send to</span>
        <button type="button" disabled={disabled} aria-pressed={!tt.inbox} onClick={() => setTt((t) => ({ ...t, inbox: false }))} style={pill(!tt.inbox)}>Post to TikTok</button>
        <button type="button" disabled={disabled} aria-pressed={tt.inbox} onClick={() => setTt((t) => ({ ...t, inbox: true }))} style={pill(tt.inbox)}>My TikTok inbox</button>
        <span style={{ ...lbl, marginTop: 2 }}>{tt.inbox ? 'Nothing is published. You finish and post it in the TikTok app.' : 'Publishes from here.'}</span>
      </div>
      {!tt.inbox && (
        <div style={row}>
          <span style={lbl}>Who can see it (required)</span>
          {opts.privacy.map((l) => (
            <button key={l.value} type="button" disabled={disabled} aria-pressed={tt.privacy === l.value} onClick={() => setTt((t) => ({ ...t, privacy: l.value }))} style={pill(tt.privacy === l.value)}>{l.label}</button>
          ))}
        </div>
      )}
      {!tt.inbox && (
        <div style={row}>
          <span style={lbl}>Comments</span>
          {opts.comment?.enabled === false
            ? <span style={{ fontSize: 12.5, color: P.textSec }}>Switched off in your TikTok settings.</span>
            : (<>
              <button type="button" disabled={disabled} aria-pressed={tt.comment === true} onClick={() => setTt((t) => ({ ...t, comment: true }))} style={pill(tt.comment === true)}>Allowed</button>
              <button type="button" disabled={disabled} aria-pressed={tt.comment === false} onClick={() => setTt((t) => ({ ...t, comment: false }))} style={pill(tt.comment === false)}>Off</button>
            </>)}
        </div>
      )}
      {!tt.inbox && (
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12, fontSize: 13, lineHeight: 1.4, color: P.text, cursor: 'pointer', fontFamily: font }}>
        <input type="checkbox" checked={tt.consent} disabled={disabled} onChange={(e) => setTt((t) => ({ ...t, consent: e.target.checked }))} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0, accentColor: '#dc2626' }} />
        <span>I previewed {count > 1 ? `these ${count} posts` : 'this post'} and agree to {tt.inbox ? (count > 1 ? 'send them to' : 'send it to') : (count > 1 ? 'publish them on' : 'publish it on')} {opts.nickname ? `@${opts.nickname.replace(/^@/, '')}` : 'my TikTok'}. It is not paid or branded content. By posting, you agree to TikTok's Music Usage Confirmation.</span>
      </label>
      )}
    </div>
  );
}

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

export default function PostToSocialsSheet({ car, seller, access, onClose, client }) {
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
    for (const n of networks) out[n.platform] = buildPost(n.platform, car, url, { credit: seller?.name || '' });
    return out;
  }, [networks, car, url, seller?.name]);

  const [picked, setPicked] = useState(() => Object.fromEntries(networks.map((n) => [n.platform, true])));
  const [texts, setTexts] = useState(() => Object.fromEntries(networks.map((n) => [n.platform, built[n.platform].text])));
  // TikTok has its own fields: a title (90 chars), who may see it, comments, a consent tick, and
  // "inbox" = send it to the TikTok app as a draft instead of publishing. TikTok's rules: the
  // poster picks privacy + comments (no default) and confirms every post.
  const hasTikTok = networks.some((n) => n.platform === 'tiktok');
  const [ttTitle, setTtTitle] = useState(() => built.tiktok?.title || '');
  const [tt, setTt] = useState({ privacy: '', comment: null, consent: false, inbox: false });
  const [ttOpts, setTtOpts] = useState(hasTikTok ? undefined : null); // undefined = loading, null = none, false = failed
  useEffect(() => {
    if (!hasTikTok) return undefined;
    let dead = false;
    callZernioPost({ action: 'tiktok_options' }, client).then(({ data, err }) => {
      if (dead) return;
      setTtOpts(err || !data ? false : data);
    });
    return () => { dead = true; };
  }, [hasTikTok]);
  const [phase, setPhase] = useState('edit'); // edit | confirm | sending | result
  const [tab, setTab] = useState('new'); // new | recent
  const showNew = tab === 'new';
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { post_id, platforms[], draft }
  const [busy, setBusy] = useState('');
  const tries = useRef(0);

  const chosen = networks.filter((n) => picked[n.platform]);
  const checks = Object.fromEntries(chosen.map((n) => [n.platform, validateText(n.platform, texts[n.platform], n.platform === 'tiktok' ? { title: ttTitle } : {})]));
  const NO_LINK = ['instagram', 'tiktok'];
  const photoCount = Math.min(8, Array.isArray(car.images) ? car.images.length : 0);
  const ttOn = chosen.some((n) => n.platform === 'tiktok');
  // What TikTok still needs before the Post button works (a draft in Zernio needs none of it).
  const ttMissing = !ttOn ? '' : photoCount === 0 ? 'TikTok needs at least one photo.'
    : !ttOpts ? (ttOpts === false ? 'Could not read your TikTok options. Close and reopen this sheet.' : 'Loading your TikTok options...')
    : !tt.inbox && !ttOpts.can_post_more ? 'TikTok says this account cannot post more right now.'
    : !tt.inbox && !tt.privacy ? 'Pick who can see the TikTok post.'
    : !tt.inbox && tt.comment === null && ttOpts.comment?.enabled !== false ? 'Choose whether people can comment on TikTok.'
    : !tt.inbox && !tt.consent ? 'Tick the TikTok confirmation box.' : '';
  const basicValid = chosen.length > 0 && chosen.every((n) => checks[n.platform].ok)
    && chosen.every((n) => NO_LINK.includes(n.platform) || texts[n.platform].includes(`/showroom/${encodeURIComponent(car.slug)}`));
  const allValid = basicValid && !ttMissing;
  const draftValid = basicValid && !(ttOn && photoCount === 0);

  // ONE place that turns the sheet into what the server needs. TikTok carries its title, privacy,
  // comments, consent and inbox choice; leaving them out made the server refuse a ticked post.
  const buildItems = () => chosen.map((n) => (n.platform === 'tiktok'
    ? { platform: 'tiktok', text: texts.tiktok, title: ttTitle, privacy: tt.privacy, allow_comment: tt.comment === true, consent: tt.consent, inbox: tt.inbox }
    : { platform: n.platform, text: texts[n.platform] }));

  const send = async (draft) => {
    setError(''); setPhase('sending');
    const { data, err } = await callZernioPost({
      action: 'publish', listing_id: car.id, draft,
      items: buildItems(),
    }, client);
    if (err) { setError(explain(err)); setPhase('edit'); return; }
    tries.current = 0;
    setResult({ post_id: data.post_id, platforms: data.platforms || [], draft, ttInbox: ttOn && tt.inbox && !draft });
    setPhase('result');
  };

  const refresh = useCallback(async () => {
    if (!result?.post_id) return;
    const { data, err } = await callZernioPost({ action: 'check', post_id: result.post_id }, client);
    if (!err && data) setResult((r) => ({ ...r, platforms: data.platforms || r.platforms }));
  }, [result?.post_id, client]);

  // Poll every 3 seconds (max ~1 minute) while a network is still publishing.
  useEffect(() => {
    if (phase !== 'result' || result?.draft) return undefined;
    if ((result.platforms || []).every((p) => isDone(p.status)) || tries.current >= 20) return undefined;
    const id = setTimeout(async () => { tries.current += 1; await refresh(); }, 3000);
    return () => clearTimeout(id);
  }, [phase, result, refresh]);

  const takeDown = async (platform) => {
    setBusy(platform); setError('');
    const { err } = await callZernioPost({ action: 'takedown', post_id: result.post_id, platform }, client);
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

        {phase !== 'sending' && phase !== 'result' && (
          <div style={{ display: 'flex', gap: 8, padding: '0 18px 8px' }}>
            <button type="button" onClick={() => setTab('new')} aria-pressed={showNew} style={pill(showNew)}>New post</button>
            <button type="button" onClick={() => setTab('recent')} aria-pressed={!showNew} style={pill(!showNew)}>Recent</button>
          </div>
        )}

        <div style={{ overflowY: 'auto', padding: '4px 18px 12px', flex: 1, minHeight: 0 }}>
          {!showNew && <RecentPosts font={font} ghost={ghost} client={client} />}
          {showNew && phase !== 'result' && networks.length === 0 && (
            <p style={{ color: P.textSec, fontSize: 14 }}>No social account is connected yet.</p>
          )}

          {showNew && phase !== 'result' && networks.map((n) => {
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
                    {n.platform === 'tiktok' && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 12.5, color: P.textMuted, marginBottom: 4 }}>Title (what shows on the photo post)</label>
                        <input value={ttTitle} onChange={(e) => setTtTitle(e.target.value)} disabled={phase === 'sending'} aria-label="TikTok title"
                          style={{ width: '100%', boxSizing: 'border-box', background: P.card, color: P.text, border: 'none', borderRadius: P.radius.row, padding: '11px 12px', fontSize: 16, fontFamily: font, outline: 'none' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12.5 }}>
                          <span style={{ color: P.textMuted }}>No links or hashtags in the title.</span>
                          <span style={{ color: Array.from(ttTitle).length > 90 ? P.accentText : P.textMuted, fontVariantNumeric: 'tabular-nums', fontWeight: Array.from(ttTitle).length > 90 ? 700 : 400 }}>{Array.from(ttTitle).length} / 90</span>
                        </div>
                        <label style={{ display: 'block', fontSize: 12.5, color: P.textMuted, margin: '10px 0 4px' }}>Description</label>
                      </div>
                    )}
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
                    {!NO_LINK.includes(n.platform) && !text.includes(`/showroom/${encodeURIComponent(car.slug)}`) && (
                      <div style={{ marginTop: 4, fontSize: 12.5, color: P.accentText }}>The car's link is missing. Put it back or tap Reset.</div>
                    )}
                    {n.platform === 'tiktok' && (
                      <TikTokChoices photoCount={photoCount} opts={ttOpts} tt={tt} setTt={setTt} disabled={phase === 'sending'} font={font} pill={pill} />
                    )}
                    {(text !== b.text || (n.platform === 'tiktok' && ttTitle !== (b.title || ''))) && (
                      <button type="button" onClick={() => { setTexts((t) => ({ ...t, [n.platform]: b.text })); if (n.platform === 'tiktok') setTtTitle(b.title || ''); }}
                        style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, color: P.textSec, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', fontFamily: font }}>Reset text</button>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {phase === 'result' && result && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 10px' }}>{(() => {
                if (result.draft) return 'Saved as a draft in Zernio. Nothing was published.';
                const ps = result.platforms || [];
                if (ps.length && ps.every((p) => isBad(p.status))) return 'Not posted.';
                if (ps.some((p) => isBad(p.status))) return 'Partly posted.';
                return 'Sent.';
              })()}</div>
              {(result.platforms || []).map((p) => {
                const meta = NETWORK[p.platform] || { label: p.platform };
                const st = String(p.status || 'pending').toLowerCase();
                return (
                  <div key={p.platform} style={{ background: P.raised, borderRadius: P.radius.row, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{meta.label}</div>
                        <div style={{ fontSize: 13, color: isGood(st) ? P.up : isBad(st) ? P.accentText : P.textSec }}>
                          {result.draft ? 'Draft' : (p.platform === 'tiktok' && result.ttInbox && !isBad(st)) ? 'In your TikTok inbox. Open TikTok to finish and post it.' : isGood(st) ? 'Published' : isBad(st) ? 'Failed' : st === 'removed' ? 'Taken down' : 'Publishing...'}
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
              {!result.draft && (result.platforms || []).some((p) => isBad(p.status)) && (
                <div style={{ margin: '0 0 12px' }}>
                  <div style={{ fontSize: 13, color: P.textSec, lineHeight: 1.45, marginBottom: 8 }}>
                    Nothing was published on the network that failed. An &quot;Internal error&quot; comes from the network itself, so trying again often works.
                  </div>
                  <button onClick={() => { tries.current = 0; setResult(null); setError(''); setPhase('edit'); }}
                    style={{ ...ghost, height: 40, fontSize: 14 }}>Try again</button>
                </div>
              )}
              {!result.draft && (result.platforms || []).some((p) => p.platform === 'tiktok' && !isBad(p.status)) && (
                <div style={{ fontSize: 12.5, color: P.textMuted, margin: '0 0 10px' }}>TikTok can take a few minutes to process a post. Check the Recent tab later.</div>
              )}
              {!result.draft && (result.platforms || []).some((p) => !isDone(p.status)) && (
                <button onClick={refresh} style={{ ...ghost, height: 36, fontSize: 13 }}>Check again</button>
              )}
            </div>
          )}

          {error && <div role="alert" style={{ marginTop: 6, padding: '10px 12px', borderRadius: P.radius.row, background: P.raised, color: P.accentText, fontSize: 13.5 }}>{error}</div>}
        </div>

        <div style={{ padding: '10px 18px calc(14px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!showNew && <button onClick={onClose} style={{ ...ghost, height: 46 }}>Done</button>}
          {showNew && phase === 'edit' && (
            <>
              {ttMissing && basicValid && <div style={{ fontSize: 13, color: P.textSec }}>{ttMissing}</div>}
              <button className="lk-red" onClick={() => setPhase('confirm')} disabled={!allValid}
                style={{ height: 48, borderRadius: P.radius.pill, border: 'none', color: P.onAccent, fontSize: 15, fontWeight: 700, cursor: allValid ? 'pointer' : 'not-allowed', opacity: allValid ? 1 : 0.45, fontFamily: font }}>
                {chosen.length ? `Post now to ${chosen.length} place${chosen.length > 1 ? 's' : ''}` : 'Turn a network on'}
              </button>
              <button onClick={() => send(true)} disabled={!draftValid} style={{ ...ghost, height: 40, fontSize: 13, opacity: draftValid ? 1 : 0.45 }}>
                Save as draft in Zernio (does not publish)
              </button>
            </>
          )}
          {showNew && phase === 'confirm' && (
            <>
              <div style={{ fontSize: 14, lineHeight: 1.45, color: P.text }}>
                {chosen.filter((n) => !(n.platform === 'tiktok' && tt.inbox)).length > 0 && (
                  <>This goes <b>public right now</b> on {chosen.filter((n) => !(n.platform === 'tiktok' && tt.inbox)).map((n) => `${NETWORK[n.platform].label} (${n.name})`).join(' and ')}
                  {ttOn && !tt.inbox && ` (TikTok: ${(ttOpts?.privacy || []).find((l) => l.value === tt.privacy)?.label || tt.privacy})`}.</>
                )}
                {ttOn && tt.inbox && <> The photos go to your <b>TikTok inbox</b> ({chosen.find((n) => n.platform === 'tiktok')?.name}). Nothing is published until you finish it in the TikTok app.</>}
                {chosen.some((n) => !NETWORK[n.platform].canTakeDown && !(n.platform === 'tiktok' && tt.inbox)) && ' Instagram and TikTok posts cannot be taken down from here.'}
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
