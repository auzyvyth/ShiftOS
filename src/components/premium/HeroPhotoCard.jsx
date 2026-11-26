import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, RotateCcw, Trash2, Smartphone, Monitor } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { premiumDark as PD } from '../../theme/tokens';
import { cutOutBackground, cutoutErrorText, isCutoutModelSaved, CUTOUT_MODEL_BYTES } from '../../lib/cutout';
import { prepareCutout, preparePlain, heroExt, heroErrorText } from '../../utils/heroPhoto';
import { isSeeThroughPhoto, cdnImg } from '../../utils/img';
import { checkSeeThrough } from '../../utils/seeThrough';
import { gradientTheme } from '../../utils/pageAccent';
import { heroFrame, withHeroFrame, heroImageUrl, HERO_SIZE, HERO_SHIFT, HERO_CAR_SIZE } from '../../utils/heroFrame';
import DragSlider from '../studio/DragSlider';
import HeroPreview from './HeroPreview';

// Premium Settings > Hero photo (PAGE-HERO, 2026-11-25). The big photo at the top
// of the seller's page. The background is removed ON THE PHONE (CUTOUT-1, no
// server, no cost); the seller previews it on the hero's dark band and picks:
// the cut-out, the photo as it is (shown in a frame), or another photo. Saved as
// avatars/<uid>/hero.<webp|jpg> through set_my_hero_photo, apart from the round
// profile photo (avatar.jpg), which chat, cards and the contact bar keep using.
// Loads its own saved value in its own query (like NicknameField), so the main
// Settings load can never fail on it.

const MB = Math.round(CUTOUT_MODEL_BYTES / 1e6);

export default function HeroPhotoCard({ userId, accent = '#DC2626' }) {
  const [saved, setSaved] = useState(undefined);      // undefined = loading, null = none
  const [notReady, setNotReady] = useState(false);    // column/function not live yet
  const [modelSaved, setModelSaved] = useState(true);
  const [original, setOriginal] = useState(null);     // the picked File
  const [preview, setPreview] = useState(null);       // { blob, url, kind: 'cut' | 'plain' }
  const [busy, setBusy] = useState(null);             // status text while working
  const [error, setError] = useState(null);
  const [local, setLocal] = useState(null);           // just-saved photo, shown from the phone (no re-download)
  const inputRef = useRef(null);
  // PAGE-HERO 2: size, position and the car in front (src/utils/heroFrame.js), saved on the URL.
  const [frame, setFrame] = useState(heroFrame(''));
  const [view, setView] = useState('phone');
  const [cars, setCars] = useState(null);             // the seller's cars whose first photo is a cut-out
  const [avatar, setAvatar] = useState(null);         // the round profile photo (the business card uses it)
  const [cover, setCover] = useState(null);           // the cover photo (the business card's top band)

  useEffect(() => {
    let off = false;
    supabase.from('car_listings').select('id, brand, model, images, status')
      .or(`dealer_id.eq.${userId},assigned_to.eq.${userId}`).in('status', ['available', 'reserved'])
      .order('created_at', { ascending: false }).limit(40)
      .then(async ({ data }) => {
        const rows = (data || []).filter((c) => Array.isArray(c.images) && c.images[0]);
        const ok = await Promise.all(rows.map((c) => checkSeeThrough(c.images[0]).catch(() => false)));
        if (!off) setCars(rows.filter((_, i) => ok[i]));
      });
    return () => { off = true; };
  }, [userId]);

  useEffect(() => {
    let off = false;
    isCutoutModelSaved().then((v) => { if (!off) setModelSaved(!!v); }).catch(() => {});
    supabase.from('profiles').select('hero_url, avatar_url, cover_url').eq('id', userId).maybeSingle().then(({ data, error: e }) => {
      if (off) return;
      if (e) { setNotReady(true); setSaved(null); return; }
      setSaved(data?.hero_url || null);
      setFrame(heroFrame(data?.hero_url));
      setAvatar(data?.avatar_url || null);
      setCover(data?.cover_url || null);
    });
    return () => { off = true; };
  }, [userId]);

  // Free the preview's object URL when it changes or the card goes away.
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => () => { if (local?.url) URL.revokeObjectURL(local.url); }, [local]);

  const showPreview = (blob, kind) => {
    setPreview({ blob, kind, url: URL.createObjectURL(blob) });
    setFrame((f) => ({ ...f, size: HERO_SIZE.def, x: 0, y: 0 })); // a new photo starts centred; the car pick stays
  };

  const cut = async (file) => {
    setError(null);
    setBusy(modelSaved ? 'Removing the background...' : `Getting the tool, once only (${MB} MB)...`);
    try {
      const png = await cutOutBackground(file, {
        onProgress: (p) => setBusy(p.stage === 'download'
          ? `Getting the tool, once only: ${Math.round(p.loaded / 1e6)} of ${Math.round(p.total / 1e6)} MB`
          : 'Removing the background...'),
      });
      setModelSaved(true);
      showPreview(await prepareCutout(png), 'cut');
    } catch (e) {
      setError(/hero_empty/.test(String(e?.message)) ? heroErrorText(e) : cutoutErrorText(e));
      setPreview(null);
    } finally {
      setBusy(null);
    }
  };

  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setOriginal(file);
    cut(file);
  };

  const usePlain = async () => {
    if (!original) return;
    setError(null);
    setBusy('Preparing the photo...');
    try { showPreview(await preparePlain(original), 'plain'); }
    catch { setError("Couldn't open this photo. Try another one."); }
    finally { setBusy(null); }
  };

  const save = async () => {
    if (!preview) return;
    setError(null);
    setBusy('Saving...');
    try {
      const path = `${userId}/hero.${heroExt(preview.blob)}`;
      const up = await supabase.storage.from('avatars').upload(path, preview.blob, { upsert: true, contentType: preview.blob.type || 'image/jpeg' });
      if (up.error) throw up.error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = withHeroFrame(`${publicUrl}?t=${Date.now()}`, frame);
      const { error: e } = await supabase.rpc('set_my_hero_photo', { p_url: url });
      if (e) throw e;
      setSaved(url);
      setLocal({ url: URL.createObjectURL(preview.blob), cut: preview.kind === 'cut' });
      setPreview(null);
      setOriginal(null);
      setNotReady(false);
    } catch (e) {
      setError(heroErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  // Only the size / position / car changed: same file, new settings on its URL.
  const savedFrame = heroFrame(saved);
  const frameDirty = !!saved && !preview && JSON.stringify(savedFrame) !== JSON.stringify(frame);
  const saveFrame = async () => {
    setError(null);
    setBusy('Saving...');
    const url = withHeroFrame(saved, frame);
    const { error: e } = await supabase.rpc('set_my_hero_photo', { p_url: url });
    setBusy(null);
    if (e) { setError(heroErrorText(e)); return; }
    setSaved(url);
  };

  const remove = async () => {
    setError(null);
    setBusy('Removing...');
    const { error: e } = await supabase.rpc('set_my_hero_photo', { p_url: null });
    setBusy(null);
    if (e) { setError(heroErrorText(e)); return; }
    setSaved(null);
    setLocal(null);
  };

  // What the band shows: the preview, else the saved photo.
  const shown = preview ? { url: preview.url, cut: preview.kind === 'cut' } : local || (saved ? { url: heroImageUrl(saved), cut: isSeeThroughPhoto(saved) } : null);
  const carList = cars || [];
  const carPhoto = frame.car === 'none' ? null
    : (carList.find((c) => c.id === frame.car) || carList[0])?.images?.[0] || null;

  const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, padding: '0 16px', borderRadius: PD.radius.pill, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  const soft = { ...btn, background: PD.hover, color: PD.text };
  const main = { ...btn, background: accent, color: '#fff' };

  return (
    <div style={{ background: PD.card, borderRadius: PD.radius.card, padding: 18 }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: PD.text }}>Your photo on your page</p>
      <p style={{ margin: '4px 0 14px', fontSize: 12.5, lineHeight: 1.5, color: PD.textMuted }}>
        The big photo of you at the top of your page, the first thing buyers see. Stand in good light, waist up, against a plain wall. Your phone removes the background; nothing is uploaded until you save.
      </p>

      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: PD.text }}>Layout</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }} role="radiogroup" aria-label="Layout">
        {[['stage', 'Big photo', 'You on the dark band, a car in front'], ['card', 'Business card', 'Your cover or page colour on top, round photo']].map(([k, t, d]) => {
          const on = frame.layout === k;
          return (
            <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setFrame((f) => ({ ...f, layout: k }))}
              disabled={k === 'card' && !saved && !preview}
              style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: 'none', fontFamily: 'inherit', cursor: 'pointer',
                background: on ? PD.text : PD.hover, color: on ? (PD.canvas || '#0b0c0f') : PD.text, opacity: k === 'card' && !saved && !preview ? 0.5 : 1 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{t}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, opacity: 0.75 }}>{d}</span>
            </button>
          );
        })}
      </div>
      {!saved && !preview && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: PD.textMuted }}>Save a photo first; the layout is saved with it.</p>
      )}
      {frame.layout === 'card' && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: PD.textMuted }}>The card uses your round profile photo{avatar ? '' : ' (you have none yet, so this photo is used)'}. The band on top is your cover photo{cover ? '' : ' (none yet, so your page colour is used)'}: change either one under Cover photo and Page colour.</p>
      )}
      <div style={{ display: 'flex', gap: 6, margin: '10px 0' }} role="group" aria-label="Preview">
        {[['phone', Smartphone, 'Phone'], ['desktop', Monitor, 'Desktop']].map(([k, Icon, label]) => (
          <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}
            style={{ ...btn, minHeight: 36, padding: '0 12px', fontSize: 12.5, background: view === k ? PD.text : PD.hover, color: view === k ? PD.canvas || '#0b0c0f' : PD.text }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        {shown ? (
          <HeroPreview mode={view} url={shown.url} cut={shown.cut} frame={frame} carUrl={shown.cut ? carPhoto : null} accent={accent}
            onMove={(x, y) => setFrame((f) => ({ ...f, x, y }))} avatarUrl={avatar} coverUrl={cover ? cdnImg(cover, 800, 70) : null} accent2={gradientTheme(accent).dark} />
        ) : (
          <div style={{ height: 220, borderRadius: 16, background: '#0c0d10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy || saved === undefined}
              style={{ ...soft, background: 'rgba(255,255,255,.1)', color: '#fff' }}>
              <ImagePlus size={16} /> Choose a photo
            </button>
          </div>
        )}
        {busy && (
          <span role="status" style={{ position: 'absolute', inset: 0, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 13, fontWeight: 700 }}>{busy}</span>
        )}
      </div>

      {shown && frame.layout !== 'card' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: PD.textMuted }}>Drag the photo to move it. The phone and desktop previews use the same settings.</p>
          {[['Size', 'size', HERO_SIZE, '%'], ['Left / right', 'x', HERO_SHIFT, ''], ['Up / down', 'y', HERO_SHIFT, '']].map(([label, key, r, unit]) => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: PD.text }}>
                <span>{label}</span><span style={{ color: PD.textMuted, fontVariantNumeric: 'tabular-nums' }}>{frame[key]}{unit}</span>
              </div>
              <DragSlider value={frame[key]} min={r.min} max={r.max} step={1} accent={accent} onChange={(v) => setFrame((f) => ({ ...f, [key]: v }))} />
            </div>
          ))}
          {(frame.size !== HERO_SIZE.def || frame.x || frame.y) ? (
            <button type="button" onClick={() => setFrame((f) => ({ ...f, size: HERO_SIZE.def, x: 0, y: 0 }))} style={{ ...soft, justifySelf: 'start', minHeight: 36 }}>
              <RotateCcw size={14} /> Reset size and position
            </button>
          ) : null}
        </div>
      )}

      {shown?.cut && frame.layout !== 'card' && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: PD.text }}>Car in front of you</p>
          {cars === null ? (
            <p style={{ margin: 0, fontSize: 12, color: PD.textMuted }}>Looking for your cut-out car photos...</p>
          ) : carList.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: PD.textMuted }}>None of your cars has a cut-out photo (no background) as its first photo, so no car shows.</p>
          ) : (
            <>
            <div className="keep-alpha" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {[{ id: 'auto', label: 'Newest' }, { id: 'none', label: 'No car' }, ...carList.map((c) => ({ id: c.id, label: [c.brand, c.model].filter(Boolean).join(' '), img: c.images[0] }))].map((o) => {
                const on = frame.car === o.id || (o.id === 'auto' && frame.car !== 'none' && !carList.some((c) => c.id === frame.car));
                return (
                  <button key={o.id} type="button" aria-pressed={on} onClick={() => setFrame((f) => ({ ...f, car: o.id }))}
                    style={{ flex: '0 0 auto', width: 96, padding: 6, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: on ? PD.text : PD.hover, color: on ? (PD.canvas || '#0b0c0f') : PD.text }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, fontSize: 11, fontWeight: 700 }}>
                      {o.img ? <img src={cdnImg(o.img, 200, 70)} alt="" style={{ maxWidth: '100%', maxHeight: 44, objectFit: 'contain' }} /> : o.label}
                    </span>
                    {o.img && <span style={{ display: 'block', marginTop: 4, fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>}
                  </button>
                );
              })}
            </div>
            {frame.car !== 'none' && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: PD.text }}>
                  <span>Car size</span><span style={{ color: PD.textMuted, fontVariantNumeric: 'tabular-nums' }}>{frame.carSize}%</span>
                </div>
                <DragSlider value={frame.carSize} min={HERO_CAR_SIZE.min} max={HERO_CAR_SIZE.max} step={1} accent={accent} onChange={(v) => setFrame((f) => ({ ...f, carSize: v }))} />
              </div>
            )}
            </>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPick} />

      {!modelSaved && !preview && !saved && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: PD.textMuted }}>First time only: your phone downloads the cut-out tool ({MB} MB). Use Wi-Fi.</p>
      )}
      {notReady && !error && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: PD.textMuted }}>Saving your photo is not available yet. Try again later.</p>
      )}
      {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12.5, color: PD.danger || '#f87171' }}>{error}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {preview ? (
          <>
            <button type="button" className="lk-red" onClick={save} disabled={!!busy} style={{ ...main, background: undefined }}>Use this</button>
            {preview.kind === 'cut'
              ? <button type="button" onClick={usePlain} disabled={!!busy} style={soft}>Use photo as it is</button>
              : original && <button type="button" onClick={() => cut(original)} disabled={!!busy} style={soft}>Remove the background</button>}
            <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy} style={soft}><RotateCcw size={14} /> Another photo</button>
          </>
        ) : saved ? (
          <>
            {frameDirty && <button type="button" className="lk-red" onClick={saveFrame} disabled={!!busy} style={{ ...main, background: undefined }}>Save changes</button>}
            <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy} style={soft}><ImagePlus size={14} /> Change</button>
            <button type="button" onClick={remove} disabled={!!busy} style={soft}><Trash2 size={14} /> Remove</button>
          </>
        ) : error && original ? (
          <button type="button" onClick={usePlain} disabled={!!busy} style={soft}>Use photo as it is</button>
        ) : null}
      </div>
    </div>
  );
}
