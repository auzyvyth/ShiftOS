import React, { useCallback, useEffect, useState } from 'react';
import { Check, ImagePlus, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { premiumDark as PD } from '../../theme/tokens';
import { compressImageFile, photoExt } from '../../utils/compressImage';
import { cdnImg } from '../../utils/img';
import { soldMonthLabel } from '../../utils/agentTrust';
import { cleanCaption, cleanCarName, monthValue, textProblem, DELIVERY_CAP, CAPTION_MAX, CAR_NAME_MAX } from '../../utils/deliveryCaption';
import { useTranslation } from 'react-i18next';

// Premium Settings > Your page > Handover photos (PAGE-SITE 3). Same law and shape as the
// dealer storefront's photo wall (DeliveryPhotos.jsx): a buyer's photo is their personal data
// (PDPA s.6), so every upload needs the consent tick, the database stamps who / when / how
// (agent_handover_photos, migration 20261126a), and delete is one tap (s.38 withdrawal).
// Words = car + month (+ a short caption). Never the buyer's name, number or plate.
// The file goes to car-images/<uid>/handover/, the seller's own folder.

const ERRORS = {
  consent_required: 'Tick that the buyer agreed first.',
  delivery_cap: `You have ${DELIVERY_CAP} photos. Delete one to add another.`,
  future_month: 'That month has not happened yet.',
  not_premium: 'Handover photos are for Premium pages.',
};
const thisMonth = () => new Date().toISOString().slice(0, 7);
const folder = (uid) => `${uid}/handover`;
const pathOf = (url, uid) => {
  const k = `/car-images/${folder(uid)}/`;
  const i = String(url || '').indexOf(k);
  return i < 0 ? null : decodeURIComponent(String(url).slice(i + '/car-images/'.length).split('?')[0]);
};

export default function HandoverPhotosCard({ userId, accent = '#DC2626' }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(undefined);
  const [notReady, setNotReady] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [carName, setCarName] = useState('');
  const [month, setMonth] = useState(thisMonth());
  const [caption, setCaption] = useState('');
  const [how, setHow] = useState('whatsapp');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [status, setStatus] = useState({ kind: '', text: '' });

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('agent_handover_photos')
      .select('id, photo_url, caption, car_name, delivered_month')
      .eq('seller_id', userId).order('delivered_month', { ascending: false }).order('created_at', { ascending: false });
    if (error) { setNotReady(true); setRows([]); return; }
    setRows(data || []);
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const carErr = textProblem(carName, { max: CAR_NAME_MAX, required: false });
  const capErr = textProblem(caption, { max: CAPTION_MAX });
  const full = (rows?.length || 0) >= DELIVERY_CAP;
  const ready = !!file && cleanCarName(carName) && !carErr && !capErr && monthValue(month) && agreed && !busy && !full && !notReady;

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setStatus({ kind: 'bad', text: t("handoverPhotos.pickAPhotoJpgPng") }); return; }
    setFile(f); setPreview(URL.createObjectURL(f)); setStatus({ kind: '', text: '' });
  };

  const upload = async () => {
    if (!ready) return;
    setBusy(true);
    setStatus({ kind: '', text: t("handoverPhotos.uploading") });
    let path = null;
    try {
      const blob = await compressImageFile(file, { maxDim: 1600, quality: 0.82 });
      const type = blob.type || 'image/jpeg';
      path = `${folder(userId)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${photoExt({ type })}`;
      const up = await supabase.storage.from('car-images').upload(path, blob, { contentType: type, upsert: false });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from('car-images').getPublicUrl(path);
      // consent_at / consent_by: the database overwrites both with now() and the signed-in user.
      const { data, error } = await supabase.from('agent_handover_photos').insert({
        seller_id: userId,
        photo_url: pub.publicUrl,
        car_name: cleanCarName(carName),
        caption: cleanCaption(caption) || null,
        delivered_month: monthValue(month),
        consent_at: new Date().toISOString(),
        consent_by: userId,
        consent_how: how,
      }).select('id');
      if (error || !data?.length) throw error || new Error('not saved');
      path = null;
      setFile(null); setPreview(''); setCarName(''); setCaption(''); setAgreed(false); setMonth(thisMonth());
      setStatus({ kind: 'good', text: t("handoverPhotos.addedItShowsOnYour") });
      await load();
    } catch (err) {
      const code = Object.keys(ERRORS).find((k) => String(err?.message || '').includes(k));
      setStatus({ kind: 'bad', text: code ? ERRORS[code] : 'Not uploaded. Check your connection and try again.' });
    } finally {
      // The row did not save: take the file back out so nothing sits in storage without consent.
      if (path) supabase.storage.from('car-images').remove([path]).catch(() => {});
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (deleting) return;
    setDeleting(row.id);
    const { data, error } = await supabase.from('agent_handover_photos').delete().eq('id', row.id).select('id');
    setDeleting(null);
    if (error || !data?.length) { setStatus({ kind: 'bad', text: t("handoverPhotos.notDeletedTryAgain") }); return; }
    const p = pathOf(row.photo_url, userId);
    if (p) supabase.storage.from('car-images').remove([p]).catch(() => {});
    setRows((rs) => (rs || []).filter((r) => r.id !== row.id));
    setStatus({ kind: 'good', text: t("handoverPhotos.deletedItIsOffYour") });
  };

  const card = { background: PD.card, borderRadius: PD.radius.card, padding: 18 };
  const h = { margin: 0, fontSize: 14, fontWeight: 700, color: PD.text };
  const hint = { margin: '4px 0 12px', fontSize: 12.5, lineHeight: 1.5, color: PD.textMuted };
  const input = { boxSizing: 'border-box', width: '100%', minWidth: 0, height: 44, padding: '0 12px', borderRadius: PD.radius.row, border: 'none', background: PD.raised, color: PD.text, fontFamily: 'inherit', fontSize: 14, outline: 'none' };
  const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, padding: '0 16px', borderRadius: PD.radius.pill, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  const chip = (on) => ({ ...btn, minHeight: 40, background: on ? accent : PD.hover, color: on ? '#fff' : PD.textSec });

  return (
    <div style={card}>
      <p style={h}>{t("handoverPhotos.handoverPhotos")}</p>
      <p style={hint}>{t("handoverPhotos.photosOfYouHandingOver")}</p>
      {notReady && <p style={{ ...hint, margin: '0 0 12px' }}>{t("handoverPhotos.handoverPhotosAreNotSwitched")}</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ ...btn, background: PD.raised, color: PD.text, justifySelf: 'start', opacity: notReady || full ? 0.5 : 1, cursor: notReady || full ? 'default' : 'pointer' }}>
          <ImagePlus size={16} /> {file ? t("handoverPhotos.pickAnotherPhoto") : t("handoverPhotos.pickAPhoto")}
          <input type="file" accept="image/*" onChange={pick} disabled={notReady || full} style={{ display: 'none' }} />
        </label>
        {preview && <img src={preview} alt="" style={{ width: 160, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: PD.radius.row }} />}
        <input aria-label={t("handoverPhotos.car")} placeholder={t("handoverPhotos.carEGProtonX50")} maxLength={CAR_NAME_MAX} value={carName} onChange={(e) => setCarName(e.target.value)} style={input} />
        {carErr && carName && <p style={{ margin: 0, fontSize: 12, color: PD.accentText }}>{carErr}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 8 }}>
          <input aria-label={t("handoverPhotos.month")} type="month" max={thisMonth()} value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...input, colorScheme: 'dark' }} />
          <input aria-label={t("handoverPhotos.captionOptional")} placeholder={t("handoverPhotos.captionOptional")} maxLength={CAPTION_MAX} value={caption} onChange={(e) => setCaption(e.target.value)} style={input} />
        </div>
        {capErr && <p style={{ margin: 0, fontSize: 12, color: PD.accentText }}>{capErr}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: PD.textMuted, marginRight: 4 }}>{t("handoverPhotos.theBuyerAgreed")}</span>
          <button type="button" onClick={() => setHow('whatsapp')} style={chip(how === 'whatsapp')}>{t("handoverPhotos.onWhatsapp")}</button>
          <button type="button" onClick={() => setHow('written')} style={chip(how === 'written')}>{t("handoverPhotos.inWriting")}</button>
        </div>
        <button type="button" role="checkbox" aria-checked={agreed} onClick={() => setAgreed((a) => !a)}
          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 0, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.45, color: PD.text }}>
          <i style={{ flexShrink: 0, width: 20, height: 20, marginTop: 1, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: agreed ? accent : 'transparent', border: agreed ? 'none' : `1.5px solid ${PD.textMuted}`, color: '#fff' }}>
            {agreed && <Check size={12} strokeWidth={3} />}
          </i>
          {t("handoverPhotos.theBuyerInThisPhoto")}
        </button>
        <div>
          <button type="button" className="lk-red" onClick={upload} disabled={!ready} style={{ ...btn, background: undefined, color: '#fff', opacity: ready ? 1 : 0.55 }}>{busy ? t("handoverPhotos.uploading") : t("handoverPhotos.addToMyPage")}</button>
        </div>
        {status.text && <p role={status.kind === 'bad' ? 'alert' : 'status'} style={{ margin: 0, fontSize: 12.5, color: status.kind === 'bad' ? PD.accentText : status.kind === 'good' ? PD.up : PD.textMuted }}>{status.text}</p>}
      </div>
      {rows?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginTop: 16 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ background: PD.raised, borderRadius: PD.radius.row, overflow: 'hidden', minWidth: 0 }}>
              <img src={cdnImg(r.photo_url, 300, 70)} alt="" loading="lazy" style={{ display: 'block', width: '100%', aspectRatio: '3 / 4', objectFit: 'cover' }} />
              <div style={{ padding: 8, display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: PD.text, overflowWrap: 'anywhere' }}>{r.car_name}</span>
                <span style={{ fontSize: 11.5, color: PD.textMuted }}>{soldMonthLabel(r.delivered_month)}</span>
                <button type="button" aria-label={t("handoverPhotos.deleteThePhoto", { name: r.car_name })} onClick={() => remove(r)} disabled={deleting === r.id}
                  style={{ ...btn, minHeight: 36, padding: '0 10px', background: PD.hover, color: PD.text, fontSize: 12 }}><Trash2 size={13} /> {deleting === r.id ? t("handoverPhotos.deleting") : t("handoverPhotos.delete")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={{ ...hint, margin: '12px 0 0' }}>{rows?.length || 0} of {DELIVERY_CAP} {t("handoverPhotos.photosYourPageShowsThe")}</p>
    </div>
  );
}
