import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { premiumDark as PD } from '../../theme/tokens';
import { cutOutBackground, cutoutErrorText, isCutoutModelSaved, CUTOUT_MODEL_BYTES } from '../../lib/cutout';
import { prepareCutout, preparePlain, heroExt, heroErrorText } from '../../utils/heroPhoto';
import { isSeeThroughPhoto } from '../../utils/img';

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

  useEffect(() => {
    let off = false;
    isCutoutModelSaved().then((v) => { if (!off) setModelSaved(!!v); }).catch(() => {});
    supabase.from('profiles').select('hero_url').eq('id', userId).maybeSingle().then(({ data, error: e }) => {
      if (off) return;
      if (e) { setNotReady(true); setSaved(null); return; }
      setSaved(data?.hero_url || null);
    });
    return () => { off = true; };
  }, [userId]);

  // Free the preview's object URL when it changes or the card goes away.
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => () => { if (local?.url) URL.revokeObjectURL(local.url); }, [local]);

  const showPreview = (blob, kind) => setPreview({ blob, kind, url: URL.createObjectURL(blob) });

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
      const url = `${publicUrl}?t=${Date.now()}`;
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
  const shown = preview ? { url: preview.url, cut: preview.kind === 'cut' } : local || (saved ? { url: saved, cut: isSeeThroughPhoto(saved) } : null);

  const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, padding: '0 16px', borderRadius: PD.radius.pill, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  const soft = { ...btn, background: PD.hover, color: PD.text };
  const main = { ...btn, background: accent, color: '#fff' };

  return (
    <div style={{ background: PD.card, borderRadius: PD.radius.card, padding: 18 }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: PD.text }}>Your photo on your page</p>
      <p style={{ margin: '4px 0 14px', fontSize: 12.5, lineHeight: 1.5, color: PD.textMuted }}>
        The big photo of you at the top of your page, the first thing buyers see. Stand in good light, waist up, against a plain wall. Your phone removes the background; nothing is uploaded until you save.
      </p>

      <div style={{ position: 'relative', height: 260, borderRadius: 16, overflow: 'hidden', background: '#0c0d10', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: 20, width: 240, height: 240, translate: '-50% 0', borderRadius: '50%', background: `radial-gradient(circle, ${accent}e6 0%, ${accent}55 42%, ${accent}00 70%)` }} />
        {shown ? (
          shown.cut
            ? <img src={shown.url} alt="Your photo" style={{ position: 'relative', height: '100%', maxWidth: '100%', objectFit: 'contain', objectPosition: 'bottom' }} />
            : <img src={shown.url} alt="Your photo" style={{ position: 'relative', height: '86%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 20, marginBottom: '7%' }} />
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy || saved === undefined}
            style={{ ...soft, position: 'relative', alignSelf: 'center', background: 'rgba(255,255,255,.1)', color: '#fff' }}>
            <ImagePlus size={16} /> Choose a photo
          </button>
        )}
        {busy && (
          <span role="status" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 13, fontWeight: 700 }}>{busy}</span>
        )}
      </div>
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
