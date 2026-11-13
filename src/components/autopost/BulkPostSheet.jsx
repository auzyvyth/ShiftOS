// Post SEVERAL queued cars at once (SOCIAL-1, owner 2026-11-13: "check each, then approve all").
// The owner sees every car's text, sets TikTok's choices ONCE (who can see, comments, one consent tick that
// covers the posts just previewed, or the TikTok inbox), and approves ONCE. The cars then go one after another
// (each call is the same checked `publish` as the single sheet: the server still re-checks the seller's
// consent, the text rules and the TikTok options for every car). A failure never blocks the rest; failed
// cars stay in the queue and can be retried from the summary.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SITE_URL } from '../../config/site';
import { cdnImg } from '../../utils/img';
import { premiumDark as P } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';
import { buildPost, validateText, carLink, carTitle, money } from '../../../supabase/functions/_shared/postCaption.js';
import { callZernioPost, explain } from './zernioApi';
import { TikTokChoices } from './PostToSocialsSheet';

const MAX_CARS = 10; // the server allows 10 live posts per 24 h
const NAMES = { facebook: 'Facebook Page', tiktok: 'TikTok' };
const isBad = (s) => ['failed', 'error'].includes(String(s || '').toLowerCase());
// Errors that mean "stop the whole batch", not "this car had a problem".
const HALT = ['daily_limit', 'tiktok_cannot_post', 'forbidden', 'not_configured', 'unauthorized'];

export default function BulkPostSheet({ cars: all, accounts, client, onClose }) {
  const cars = useMemo(() => all.slice(0, MAX_CARS), [all]);
  const font = 'var(--xd-font-body, Outfit, system-ui, sans-serif)';
  const hasFb = accounts.some((a) => a.platform === 'facebook');
  const ttAcc = accounts.find((a) => a.platform === 'tiktok');
  const hasTt = !!ttAcc;

  const [phase, setPhase] = useState('review'); // review | confirm | running | done
  useModalHistory(true, () => { if (phase !== 'running') onClose(); });
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // What each car would say, from the same caption builder the single sheet uses.
  const built = useMemo(() => Object.fromEntries(cars.map((c) => {
    const url = carLink(SITE_URL, c, c.seller_slug);
    const credit = c.seller_name || '';
    return [c.id, {
      facebook: hasFb ? buildPost('facebook', c, url, { credit }) : null,
      tiktok: hasTt ? buildPost('tiktok', c, url, { credit }) : null,
    }];
  })), [cars, hasFb, hasTt]);
  const [edits, setEdits] = useState(() => Object.fromEntries(cars.map((c) => [c.id, {
    on: true,
    facebook: built[c.id].facebook?.text || '',
    tiktok: built[c.id].tiktok?.text || '',
    title: built[c.id].tiktok?.title || '',
  }])));
  const setEdit = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  const [openId, setOpenId] = useState('');
  const [netOn, setNetOn] = useState({ facebook: true, tiktok: true });
  const fbActive = hasFb && netOn.facebook;
  const ttActive = hasTt && netOn.tiktok;

  const [tt, setTt] = useState({ privacy: '', comment: null, consent: false, inbox: false });
  const [ttOpts, setTtOpts] = useState(hasTt ? undefined : null);
  useEffect(() => {
    if (!hasTt) return undefined;
    let dead = false;
    callZernioPost({ action: 'tiktok_options' }, client).then(({ data, err }) => { if (!dead) setTtOpts(err || !data ? false : data); });
    return () => { dead = true; };
  }, [hasTt, client]);

  const included = cars.filter((c) => edits[c.id]?.on);
  const problems = (c) => {
    const e = edits[c.id]; const out = [];
    if (fbActive) {
      if (!validateText('facebook', e.facebook).ok) out.push('Facebook text needs fixing');
      else if (!e.facebook.includes(`/showroom/${encodeURIComponent(c.slug)}`)) out.push("Facebook text lost the car's link");
    }
    if (ttActive) {
      if (!(Array.isArray(c.images) && c.images.length)) out.push('No photo, TikTok needs one');
      else if (!validateText('tiktok', e.tiktok, { title: e.title }).ok) out.push('TikTok text or title needs fixing');
    }
    return out;
  };
  const ttMissing = !ttActive ? '' : !ttOpts ? (ttOpts === false ? 'Could not read your TikTok options. Close and reopen this screen.' : 'Loading your TikTok options...')
    : !tt.inbox && !ttOpts.can_post_more ? 'TikTok says this account cannot post more right now.'
    : !tt.inbox && !tt.privacy ? 'Pick who can see the TikTok posts.'
    : !tt.inbox && tt.comment === null && ttOpts.comment?.enabled !== false ? 'Choose whether people can comment on TikTok.'
    : !tt.inbox && !tt.consent ? 'Tick the TikTok confirmation box.' : '';
  const anyNetwork = fbActive || ttActive;
  const carsOk = included.length > 0 && included.every((c) => problems(c).length === 0);
  const ready = anyNetwork && carsOk && !ttMissing;

  const itemsFor = (c) => {
    const e = edits[c.id]; const out = [];
    if (fbActive) out.push({ platform: 'facebook', text: e.facebook });
    if (ttActive) out.push({ platform: 'tiktok', text: e.tiktok, title: e.title, privacy: tt.privacy, allow_comment: tt.comment === true, consent: tt.consent, inbox: tt.inbox });
    return out;
  };

  const [results, setResults] = useState({});
  const setRes = (id, v) => setResults((r) => ({ ...r, [id]: v }));
  const stop = useRef(false);
  const run = async (list) => {
    setPhase('running'); stop.current = false;
    for (let i = 0; i < list.length; i += 1) {
      const c = list[i];
      if (stop.current) { list.slice(i).forEach((x) => setRes(x.id, { state: 'skipped', msg: 'Stopped before this one.' })); break; }
      setRes(c.id, { state: 'posting' });
      // eslint-disable-next-line no-await-in-loop
      const { data, err } = await callZernioPost({ action: 'publish', listing_id: c.id, draft: false, items: itemsFor(c) }, client);
      if (err) {
        setRes(c.id, { state: 'failed', msg: explain(err) });
        if (HALT.includes(err.error)) {
          list.slice(i + 1).forEach((x) => setRes(x.id, { state: 'skipped', msg: 'Stopped: ' + explain(err) }));
          break;
        }
        continue; // eslint-disable-line no-continue
      }
      const ps = data.platforms || [];
      if (ps.length && ps.every((p) => isBad(p.status))) {
        setRes(c.id, { state: 'failed', msg: String(ps.find((p) => p.error)?.error || 'The network refused it.').slice(0, 160) });
      } else {
        setRes(c.id, { state: 'ok', partial: ps.some((p) => isBad(p.status)), platforms: ps });
      }
    }
    setPhase('done');
  };

  const done = Object.values(results);
  const okN = done.filter((r) => r.state === 'ok').length;
  const failedList = cars.filter((c) => ['failed', 'skipped'].includes(results[c.id]?.state));
  const running = phase === 'running';
  const wide = typeof window !== 'undefined' && window.innerWidth >= 700;
  const pill = (active) => ({ height: 34, padding: '0 14px', borderRadius: P.radius.pill, border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 13, fontWeight: 600, background: active ? P.text : P.raised, color: active ? P.card : P.textSec });
  const ghost = { height: 44, padding: '0 18px', borderRadius: P.radius.pill, border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 14, fontWeight: 600, background: P.raised, color: P.text };
  const redBtn = (on) => ({ height: 48, borderRadius: P.radius.pill, border: 'none', color: P.onAccent, fontSize: 15, fontWeight: 700, cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : 0.45, fontFamily: font });
  const area = { width: '100%', boxSizing: 'border-box', resize: 'vertical', background: P.card, color: P.text, border: 'none', borderRadius: P.radius.row, padding: 10, fontSize: 14, lineHeight: 1.45, fontFamily: font, outline: 'none', display: 'block', marginTop: 6 };
  const nets = [fbActive && NAMES.facebook, ttActive && (tt.inbox ? 'your TikTok inbox' : NAMES.tiktok)].filter(Boolean);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Post several cars"
      onClick={(e) => { if (e.target === e.currentTarget && !running) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center', fontFamily: font }}>
      <div style={{ width: '100%', maxWidth: 680, maxHeight: wide ? '90dvh' : '95dvh', display: 'flex', flexDirection: 'column', background: P.card, color: P.text, borderRadius: wide ? P.radius.card : `${P.radius.card}px ${P.radius.card}px 0 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px 10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: P.textMuted, fontWeight: 600, letterSpacing: '.04em' }}>POST SEVERAL CARS</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {phase === 'done' ? `${okN} of ${cars.length} posted` : running ? `Posting ${Math.min(done.filter((r) => r.state !== 'posting').length + 1, included.length)} of ${included.length}...` : `${included.length} car${included.length === 1 ? '' : 's'} selected`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" disabled={running}
            style={{ width: 36, height: 36, borderRadius: P.radius.pill, border: 'none', background: P.raised, color: P.textSec, cursor: running ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', padding: '4px 18px 12px', flex: 1, minHeight: 0 }}>
          {(phase === 'review' || phase === 'confirm') && (
            <>
              {all.length > MAX_CARS && <div style={{ fontSize: 12.5, color: P.textSec, marginBottom: 8 }}>Only the first {MAX_CARS} are in this batch (the daily limit is {MAX_CARS} posts).</div>}
              <div style={{ background: P.raised, borderRadius: P.radius.row, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Post to</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {hasFb ? <button type="button" aria-pressed={netOn.facebook} onClick={() => setNetOn((n) => ({ ...n, facebook: !n.facebook }))} style={pill(netOn.facebook)}>Facebook Page {netOn.facebook ? 'On' : 'Off'}</button>
                    : <span style={{ fontSize: 12.5, color: P.textMuted, alignSelf: 'center' }}>Facebook Page: not connected in Zernio</span>}
                  {hasTt ? <button type="button" aria-pressed={netOn.tiktok} onClick={() => setNetOn((n) => ({ ...n, tiktok: !n.tiktok }))} style={pill(netOn.tiktok)}>TikTok {netOn.tiktok ? 'On' : 'Off'}</button> : null}
                </div>
                {ttActive && <TikTokChoices photoCount={1} opts={ttOpts} tt={tt} setTt={setTt} disabled={phase !== 'review'} font={font} pill={pill} count={included.length} />}
              </div>

              {cars.map((c) => {
                const e = edits[c.id]; const probs = e.on ? problems(c) : [];
                const img = Array.isArray(c.images) && c.images[0] ? cdnImg(c.images[0], 120, 70) : null;
                const shown = fbActive ? e.facebook : e.tiktok;
                const isOpen = openId === c.id;
                return (
                  <div key={c.id} style={{ background: P.raised, borderRadius: P.radius.row, padding: 12, marginBottom: 10, opacity: e.on ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input type="checkbox" checked={e.on} disabled={phase !== 'review'} onChange={(ev) => setEdit(c.id, { on: ev.target.checked })} aria-label={`Include ${carTitle(c)}`} style={{ width: 20, height: 20, accentColor: '#dc2626', flexShrink: 0 }} />
                      {img && <img src={img} alt="" width="44" height="44" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: P.card, flexShrink: 0 }} />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{carTitle(c)}</div>
                        <div style={{ fontSize: 12.5, color: P.textSec }}>{money(c.selling_price) || 'No price'} · {c.seller_name || 'Seller'}</div>
                      </div>
                      <button type="button" onClick={() => setOpenId(isOpen ? '' : c.id)} style={{ ...pill(false), height: 30, fontSize: 12.5 }}>{isOpen ? 'Hide' : 'Edit text'}</button>
                    </div>
                    {e.on && (
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45, color: P.textSec, whiteSpace: 'pre-line', maxHeight: isOpen ? 'none' : 58, overflow: 'hidden' }}>{ttActive && !fbActive ? e.title + '\n' + shown : shown}</div>
                    )}
                    {e.on && isOpen && (
                      <div>
                        {fbActive && <textarea aria-label={`Facebook text for ${carTitle(c)}`} rows={6} value={e.facebook} onChange={(ev) => setEdit(c.id, { facebook: ev.target.value })} style={area} />}
                        {ttActive && (
                          <>
                            <input aria-label={`TikTok title for ${carTitle(c)}`} value={e.title} onChange={(ev) => setEdit(c.id, { title: ev.target.value })} style={{ ...area, resize: 'none' }} />
                            <textarea aria-label={`TikTok description for ${carTitle(c)}`} rows={5} value={e.tiktok} onChange={(ev) => setEdit(c.id, { tiktok: ev.target.value })} style={area} />
                          </>
                        )}
                      </div>
                    )}
                    {probs.map((x) => <div key={x} style={{ marginTop: 6, fontSize: 12.5, color: P.accentText }}>{x}</div>)}
                  </div>
                );
              })}
            </>
          )}

          {(phase === 'running' || phase === 'done') && cars.filter((c) => edits[c.id].on).map((c) => {
            const r = results[c.id] || { state: 'waiting' };
            const label = { waiting: 'Waiting', posting: 'Posting...', ok: r.partial ? 'Partly posted' : 'Posted', failed: 'Not posted', skipped: 'Skipped' }[r.state];
            return (
              <div key={c.id} style={{ background: P.raised, borderRadius: P.radius.row, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{carTitle(c)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: r.state === 'ok' && !r.partial ? P.up : ['failed', 'skipped'].includes(r.state) || r.partial ? P.accentText : P.textSec }}>{label}</div>
                </div>
                {r.msg && <div style={{ marginTop: 4, fontSize: 12.5, color: P.accentText }}>{r.msg}</div>}
              </div>
            );
          })}
          {phase === 'done' && failedList.length > 0 && (
            <div style={{ fontSize: 12.5, color: P.textSec, margin: '4px 0 8px', lineHeight: 1.45 }}>
              Cars that did not post stay in the queue. An &quot;Internal error&quot; comes from the network itself, so trying again often works.
            </div>
          )}
        </div>

        <div style={{ padding: '10px 18px calc(14px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {phase === 'review' && (
            <>
              {!ready && ttMissing && carsOk && <div style={{ fontSize: 13, color: P.textSec }}>{ttMissing}</div>}
              <button className="lk-red" disabled={!ready} onClick={() => setPhase('confirm')} style={redBtn(ready)}>{ready ? `Post ${included.length} car${included.length === 1 ? '' : 's'}` : (included.length ? 'Fix the items above to post' : 'Select at least one car')}</button>
            </>
          )}
          {phase === 'confirm' && (
            <>
              <div style={{ fontSize: 14, lineHeight: 1.45 }}>
                {tt.inbox && !fbActive
                  ? <>The photos of <b>{included.length}</b> car{included.length === 1 ? '' : 's'} go to your <b>TikTok inbox</b>. Nothing is published until you finish each one in the TikTok app.</>
                  : <>This goes <b>public right now</b> on {nets.join(' and ')} for <b>{included.length}</b> car{included.length === 1 ? '' : 's'}, one after another. Keep this screen open until it finishes. Instagram and TikTok posts cannot be taken down from here.</>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPhase('review')} style={{ ...ghost, flex: 1 }}>Back</button>
                <button className="lk-red" onClick={() => run(included)} style={{ ...redBtn(true), flex: 2, height: 44 }}>Yes, post them</button>
              </div>
            </>
          )}
          {phase === 'running' && (
            <button onClick={() => { stop.current = true; }} style={ghost}>Stop after this one</button>
          )}
          {phase === 'done' && (
            <>
              {failedList.length > 0 && <button className="lk-red" onClick={() => run(failedList)} style={redBtn(true)}>Try the {failedList.length} that did not post again</button>}
              <button onClick={onClose} style={{ ...ghost, height: 46 }}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
