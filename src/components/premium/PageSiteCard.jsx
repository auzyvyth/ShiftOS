import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { premiumDark as PD } from '../../theme/tokens';
import {
  cleanSite, promoProblem, deliveryProblem, noteProblem, siteErrorText, myToday,
  GROUND_PRESETS, GROUND_ANGLES, DEFAULT_GROUND, groundPaint, mixHex, SECTION_LABEL, PROMO_MAX, DELIVERY_MAX, PROMO_DAYS_MAX, NOTES_MAX, NOTE_MAX,
} from '../../utils/pageSite';

// Premium Settings > "Your page sections" (PAGE-SITE 2). The seller types their
// promos of the month (each with an END DATE: it leaves the page by itself), the
// towns they deliver to (km + minutes, their own estimate), and picks the order
// of the page's sections and which are on. Loads and saves in its own query
// (like HeroPhotoCard / NicknameField), so the main Settings load and save can
// never fail because of it. Rules + words: src/utils/pageSite.js.

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export default function PageSiteCard({ userId, accent = '#DC2626' }) {
  const [saved, setSaved] = useState(undefined);        // undefined = loading
  const [draft, setDraft] = useState(null);
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [myModels, setMyModels] = useState([]);   // the seller's own model cards, to suggest names for a note
  const today = myToday();

  useEffect(() => {
    let off = false;
    supabase.from('profiles').select('page_site').eq('id', userId).maybeSingle().then(({ data, error: e }) => {
      if (off) return;
      if (e) { setNotReady(true); setSaved(cleanSite(null)); setDraft(cleanSite(null)); return; }
      const s = cleanSite(data?.page_site);
      setSaved(s); setDraft(s);
    });
    supabase.from('car_listings').select('model').eq('dealer_id', userId).eq('is_model_card', true).limit(40).then(({ data }) => {
      if (!off && Array.isArray(data)) setMyModels([...new Set(data.map((r) => r.model).filter(Boolean))]);
    }, () => {});
    return () => { off = true; };
  }, [userId]);

  const dirty = useMemo(() => draft && saved && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  if (!draft) return null;

  // The draft keeps raw typed rows (so a half-typed row survives); cleanSite drops the bad ones on save.
  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDone(false); setError(null); };
  const setPromo = (i, patch) => set({ promos: draft.promos.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setNote = (i, patch) => set({ notes: draft.notes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setTown = (i, patch) => set({ delivery: { ...draft.delivery, items: draft.delivery.items.map((t, j) => (j === i ? { ...t, ...patch } : t)) } });
  const move = (i, d) => {
    const o = [...draft.order]; const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    set({ order: o });
  };
  const toggle = (id) => set({ off: draft.off.includes(id) ? draft.off.filter((x) => x !== id) : [...draft.off, id] });

  const problems = [
    ...draft.promos.map((p) => promoProblem(p, today)),
    ...draft.notes.map((x) => noteProblem(x)),
    ...draft.delivery.items.map((t) => deliveryProblem(t)),
  ].filter(Boolean);

  const save = async () => {
    setError(null); setDone(false);
    if (problems.length) { setError(problems[0]); return; }
    const next = cleanSite(draft);
    setBusy(true);
    const { error: e } = await supabase.rpc('set_my_page_site', { p_site: next });
    setBusy(false);
    if (e) { setError(siteErrorText(e)); return; }
    setSaved(next); setDraft(next); setDone(true); setNotReady(false);
  };

  const card = { background: PD.card, borderRadius: PD.radius.card, padding: 18 };
  const h = { margin: 0, fontSize: 14, fontWeight: 700, color: PD.text };
  const hint = { margin: '4px 0 12px', fontSize: 12.5, lineHeight: 1.5, color: PD.textMuted };
  const input = { boxSizing: 'border-box', width: '100%', minWidth: 0, height: 44, padding: '0 12px', borderRadius: PD.radius.row, border: 'none', background: PD.raised, color: PD.text, fontFamily: 'inherit', fontSize: 14, outline: 'none' };
  const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, padding: '0 16px', borderRadius: PD.radius.pill, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  const soft = { ...btn, background: PD.hover, color: PD.text };
  const icon = { ...btn, width: 44, padding: 0, background: PD.raised, color: PD.textSec };
  const row = { boxSizing: 'border-box', background: PD.raised, borderRadius: PD.radius.row, padding: 12, display: 'grid', gap: 8 };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {(() => {
        // Page background: the seller's own two colours + which way the fade runs (owner: "make it customizable").
        const g = draft.ground || DEFAULT_GROUND;
        const paint = groundPaint(g);
        const acc = /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : '#dc2626';
        const presets = [...GROUND_PRESETS, { label: 'My colour', from: mixHex(acc, '#ffffff', 0.95), to: mixHex(acc, '#ffffff', 0.84) }];
        const setG = (patch) => set({ ground: { ...g, ...patch } });
        const DIR = { 180: 'Down', 135: 'Diagonal', 90: 'Across' };
        const colourBox = (label, key) => (
          <label style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '6px 10px', borderRadius: PD.radius.row, background: PD.raised, cursor: 'pointer' }}>
            <input type="color" value={g[key]} onChange={(e) => setG({ [key]: e.target.value })} aria-label={`${label} colour`}
              style={{ width: 36, height: 36, padding: 0, border: 'none', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12, color: PD.textMuted }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: PD.text, fontFamily: 'ui-monospace, monospace' }}>{g[key].toUpperCase()}</span>
            </span>
          </label>
        );
        return (
          <div style={card}>
            <p style={h}>Page background</p>
            <p style={hint}>The light part of your page, behind your cars and sections. Pick any two colours and which way they fade. Very dark colours are lightened a little so buyers can still read your page.</p>
            <div aria-hidden="true" style={{ height: 96, borderRadius: 14, marginBottom: 12, background: `linear-gradient(${paint.angle}deg, ${paint.from}, ${paint.to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ width: 70, height: 44, borderRadius: 10, background: paint.tile }} />
              <span style={{ width: 70, height: 44, borderRadius: 10, background: '#0f1115' }} />
              <span style={{ width: 70, height: 44, borderRadius: 10, background: paint.tile }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {colourBox('Top', 'from')}
              {colourBox('Bottom', 'to')}
            </div>
            <div role="radiogroup" aria-label="Fade direction" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: PD.raised, marginBottom: 12 }}>
              {GROUND_ANGLES.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={g.angle === a} onClick={() => setG({ angle: a })}
                  style={{ ...btn, flex: 1, minHeight: 38, borderRadius: 9, background: g.angle === a ? '#fff' : 'transparent', color: g.angle === a ? '#0f1115' : PD.textSec }}>{DIR[a]}</button>
              ))}
            </div>
            {paint.lightened && <p style={{ margin: '0 0 10px', fontSize: 12, color: PD.textMuted }}>Lightened a little so your page stays readable. The preview shows what buyers will see.</p>}
            <p style={{ margin: '0 0 8px', fontSize: 12, color: PD.textMuted }}>Or start from one of these:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {presets.map((p) => (
                <button key={p.label} type="button" onClick={() => setG({ from: p.from, to: p.to })}
                  style={{ ...soft, minHeight: 36, padding: '0 12px 0 6px', gap: 8, borderRadius: 10 }}>
                  <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(180deg, ${p.from}, ${p.to})`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={card}>
        <p style={h}>Sections on your page</p>
        <p style={hint}>The order buyers scroll through. Switch off what you do not want. A section with nothing in it never shows.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {draft.order.map((id, i) => {
            const on = !draft.off.includes(id);
            return (
              <div key={id} style={{ ...row, gridTemplateColumns: 'minmax(0,1fr) auto auto auto', alignItems: 'center', padding: '8px 8px 8px 14px' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: on ? PD.text : PD.textMuted, overflowWrap: 'anywhere' }}>{SECTION_LABEL[id]}</span>
                <button type="button" aria-label={`Move ${SECTION_LABEL[id]} up`} disabled={i === 0} onClick={() => move(i, -1)} style={{ ...icon, opacity: i === 0 ? 0.35 : 1 }}><ArrowUp size={16} /></button>
                <button type="button" aria-label={`Move ${SECTION_LABEL[id]} down`} disabled={i === draft.order.length - 1} onClick={() => move(i, 1)} style={{ ...icon, opacity: i === draft.order.length - 1 ? 0.35 : 1 }}><ArrowDown size={16} /></button>
                <button type="button" role="switch" aria-checked={on} aria-label={`${SECTION_LABEL[id]} on or off`} onClick={() => toggle(id)}
                  style={{ ...btn, minHeight: 44, width: 64, background: on ? accent : PD.hover, color: on ? '#fff' : PD.textSec }}>{on ? 'On' : 'Off'}</button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={card}>
        <p style={h}>Promos of the month</p>
        <p style={hint}>Your own offers, with the last day. Each one leaves your page by itself after that day ({PROMO_DAYS_MAX} days at most). Do not type phone numbers.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {draft.promos.map((p, i) => {
            const pr = promoProblem(p, today);
            return (
              <div key={i} style={row}>
                <input aria-label="Model" placeholder="Model, e.g. Yaris 1.5G" maxLength={40} value={p.model || ''} onChange={(e) => setPromo(i, { model: e.target.value })} style={input} />
                <input aria-label="What you offer" placeholder="What you offer" maxLength={80} value={p.text || ''} onChange={(e) => setPromo(i, { text: e.target.value })} style={input} />
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                  <input aria-label="From price (optional)" placeholder="From RM" inputMode="numeric" value={p.price ?? ''} onChange={(e) => setPromo(i, { price: e.target.value.replace(/\D/g, '').slice(0, 7) })} style={input} />
                  <input aria-label="Last day" type="date" min={today} max={addDays(today, PROMO_DAYS_MAX)} value={p.until || ''} onChange={(e) => setPromo(i, { until: e.target.value })} style={{ ...input, colorScheme: 'dark' }} />
                </div>
                {pr && <p style={{ margin: 0, fontSize: 12, color: PD.accentText }}>{pr}</p>}
                <button type="button" onClick={() => set({ promos: draft.promos.filter((_, j) => j !== i) })} style={{ ...soft, justifySelf: 'start', minHeight: 36 }}><Trash2 size={14} /> Remove</button>
              </div>
            );
          })}
          {draft.promos.length < PROMO_MAX && (
            <button type="button" onClick={() => set({ promos: [...draft.promos, { model: '', text: '', until: '' }] })} style={{ ...soft, justifySelf: 'start' }}><Plus size={14} /> Add a promo</button>
          )}
        </div>
      </div>

      {myModels.length > 0 && (
        <div style={card}>
          <p style={h}>Your take on each model</p>
          <p style={hint}>One line buyers read under the model, headed with your first name: who it suits and why. It is your opinion, so say it like one. Do not type phone numbers.</p>
          <datalist id="ps-my-models">{myModels.map((m) => <option key={m} value={m} />)}</datalist>
          <div style={{ display: 'grid', gap: 10 }}>
            {draft.notes.map((x, i) => {
              const pr = noteProblem(x);
              return (
                <div key={i} style={row}>
                  <input aria-label="Model" list="ps-my-models" placeholder="Model" maxLength={40} value={x.model || ''} onChange={(e) => setNote(i, { model: e.target.value })} style={input} />
                  <textarea aria-label="Your take" placeholder="Why you would pick it" maxLength={NOTE_MAX} rows={3} value={x.text || ''} onChange={(e) => setNote(i, { text: e.target.value })}
                    style={{ ...input, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.45 }} />
                  <p style={{ margin: 0, fontSize: 11.5, color: PD.textMuted }}>{(x.text || '').length} / {NOTE_MAX}</p>
                  {pr && <p style={{ margin: 0, fontSize: 12, color: PD.accentText }}>{pr}</p>}
                  <button type="button" onClick={() => set({ notes: draft.notes.filter((_, j) => j !== i) })} style={{ ...soft, justifySelf: 'start', minHeight: 36 }}><Trash2 size={14} /> Remove</button>
                </div>
              );
            })}
            {draft.notes.length < NOTES_MAX && (
              <button type="button" onClick={() => set({ notes: [...draft.notes, { model: '', text: '' }] })} style={{ ...soft, justifySelf: 'start' }}><Plus size={14} /> Add a note</button>
            )}
          </div>
        </div>
      )}

      <div style={card}>
        <p style={h}>Delivery to your buyer's town</p>
        <p style={hint}>Where you deliver from, and how far each town is. Your own estimate; the page says so. Do not type phone numbers.</p>
        <input aria-label="Delivering from" placeholder="Delivering from, e.g. Kuala Terengganu" maxLength={40} value={draft.delivery.base} onChange={(e) => set({ delivery: { ...draft.delivery, base: e.target.value } })} style={{ ...input, marginBottom: 10 }} />
        <div style={{ display: 'grid', gap: 10 }}>
          {draft.delivery.items.map((t, i) => {
            const pr = deliveryProblem(t);
            return (
              <div key={i} style={row}>
                <input aria-label="Town" placeholder="Town, e.g. Marang" maxLength={40} value={t.town || ''} onChange={(e) => setTown(i, { town: e.target.value })} style={input} />
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                  <input aria-label="Distance in km" placeholder="Distance (km)" inputMode="numeric" value={t.km ?? ''} onChange={(e) => setTown(i, { km: e.target.value.replace(/\D/g, '').slice(0, 4) })} style={input} />
                  <input aria-label="Drive time in minutes" placeholder="Minutes" inputMode="numeric" value={t.min ?? ''} onChange={(e) => setTown(i, { min: e.target.value.replace(/\D/g, '').slice(0, 4) })} style={input} />
                </div>
                {pr && <p style={{ margin: 0, fontSize: 12, color: PD.accentText }}>{pr}</p>}
                <button type="button" onClick={() => set({ delivery: { ...draft.delivery, items: draft.delivery.items.filter((_, j) => j !== i) } })} style={{ ...soft, justifySelf: 'start', minHeight: 36 }}><Trash2 size={14} /> Remove</button>
              </div>
            );
          })}
          {draft.delivery.items.length < DELIVERY_MAX && (
            <button type="button" onClick={() => set({ delivery: { ...draft.delivery, items: [...draft.delivery.items, { town: '', km: '', min: '' }] } })} style={{ ...soft, justifySelf: 'start' }}><Plus size={14} /> Add a town</button>
          )}
        </div>
      </div>

      {notReady && !error && <p style={{ margin: 0, fontSize: 12, color: PD.textMuted }}>Saving these sections is not available yet. Try again later.</p>}
      {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: PD.accentText }}>{error}</p>}
      {done && <p role="status" style={{ margin: 0, fontSize: 12.5, color: PD.up }}>Saved. Your page now shows this.</p>}
      <div>
        <button type="button" className="lk-red" onClick={save} disabled={busy || !dirty} style={{ ...btn, background: undefined, color: '#fff', opacity: busy || !dirty ? 0.55 : 1 }}>{busy ? 'Saving...' : 'Save page sections'}</button>
      </div>
    </div>
  );
}
