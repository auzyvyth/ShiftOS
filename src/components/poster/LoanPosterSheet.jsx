// Loan poster sheet (POSTER-1, 2026-10-16). Opened from a car's menu in
// Salesman Lite, Salesman Premium and the linked-salesman panel.
//
// The seller types three things (price, deposit, rate) and gets the poster.
// The preview is free; the clean file costs one credit, claimed server side by
// claim_loan_poster(): Lite gets LITE_POSTERS_PER_MONTH cars a month, Premium
// and dealer-linked salesmen unlimited. Remaking the same car in the same
// month is free, so changing the deposit never costs a second credit.
//
// Portalled to document.body with body scroll locked (overlay rules 1 + 2).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Share2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../supabaseClient';
import { SITE_URL } from '../../config/site';
import { DEFAULT_EIR } from '../../utils/financing';
import {
  loanPosterNumbers, defaultDeposit, posterTitle,
  POSTER_ERRORS, LITE_POSTERS_PER_MONTH,
} from '../../utils/loanPoster';
import { renderLoanPoster, posterBlob } from './renderLoanPoster';
import { useModalHistory } from '../../hooks/useModalHistory';

const LANG_KEY = 'xd_poster_lang';
const readLang = () => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ms'; } catch { return 'ms'; } };

const S = {
  bg: '#0f141c', panel: '#151b26', border: 'rgba(255,255,255,0.10)',
  text: '#f1f5f9', sub: 'rgba(241,245,249,0.62)', faint: 'rgba(241,245,249,0.4)',
  accent: '#dc2626', field: '#0b1018',
};

const fileName = (car) => `loan-${posterTitle(car).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.jpg`;

// onDownloaded: called once a clean file was saved or shared (the Premium
// poster intro ends on it).
export default function LoanPosterSheet({ car, seller, onClose, onUpgrade, onDownloaded }) {
  useModalHistory(true, onClose);
  const [price, setPrice] = useState(() => String(car?.selling_price || car?.price || ''));
  const [deposit, setDeposit] = useState(() => String(defaultDeposit(car?.selling_price || car?.price)));
  const [rate, setRate] = useState(String(DEFAULT_EIR));
  const [basis, setBasis] = useState('eir');
  const [lang, setLang] = useState(readLang);
  const [quota, setQuota] = useState(null);
  const [busy, setBusy] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const previewRef = useRef(null);

  const numbers = useMemo(() => loanPosterNumbers({ price, deposit, rate, basis }), [price, deposit, rate, basis]);
  const pageUrl = seller?.slug ? `${SITE_URL}/s/${seller.slug}` : null;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    let live = true;
    supabase.rpc('loan_poster_quota').then(({ data }) => { if (live && data) setQuota(data); });
    return () => { live = false; };
  }, []);

  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* private mode */ } }, [lang]);

  // Redraw the preview shortly after typing stops.
  useEffect(() => {
    if (!numbers.ok || !previewRef.current) return undefined;
    const id = setTimeout(() => {
      renderLoanPoster(previewRef.current, { car, seller, numbers, lang, pageUrl, preview: true, dpr: 1 })
        .catch((e) => console.error('loan poster preview', e));
    }, 180);
    return () => clearTimeout(id);
  }, [numbers, lang, car, seller, pageUrl]);

  const left = quota && !quota.unlimited ? Math.max(0, (quota.limit || LITE_POSTERS_PER_MONTH) - (quota.used || 0)) : null;

  const makeFile = async () => {
    const { data, error } = await supabase.rpc('claim_loan_poster', { p_listing: car.id });
    if (error || !data) { toast.error('Could not make the poster. Check your connection and try again.'); return null; }
    if (!data.ok) {
      if (data.error === 'limit') { setLimitHit(true); return null; }
      toast.error(data.error === 'not_your_car' ? 'This car is not on your listings.' : 'Could not make the poster.');
      return null;
    }
    if (!data.reused && quota && !quota.unlimited) setQuota((q) => ({ ...q, used: (q?.used || 0) + 1 }));
    const canvas = document.createElement('canvas');
    await renderLoanPoster(canvas, { car, seller, numbers, lang, pageUrl, preview: false, dpr: 2 });
    const blob = await posterBlob(canvas);
    return blob ? new File([blob], fileName(car), { type: 'image/jpeg' }) : null;
  };

  const run = async (mode) => {
    if (!numbers.ok || busy) return;
    setBusy(true);
    try {
      const file = await makeFile();
      if (!file) return;
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); onDownloaded?.(); } catch { /* closed the share sheet */ }
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success('Poster saved');
      onDownloaded?.();
    } catch (e) {
      console.error('loan poster', e);
      toast.error('Could not make the poster.');
    } finally {
      setBusy(false);
    }
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
    && (() => { try { return navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] }); } catch { return false; } })();

  const field = (label, value, set, { suffix, hint } = {}) => (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.sub, marginBottom: 6 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', background: S.field, border: `1px solid ${S.border}`, borderRadius: 10, padding: '0 12px' }}>
        {!suffix && <span style={{ color: S.faint, fontSize: 14, marginRight: 6 }}>RM</span>}
        <input
          inputMode="decimal" value={value}
          onChange={(e) => set(e.target.value.replace(/[^0-9.,]/g, ''))}
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: S.text, fontSize: 16, fontWeight: 700, padding: '11px 0' }}
        />
        {suffix && <span style={{ color: S.faint, fontSize: 14, marginLeft: 6 }}>{suffix}</span>}
      </div>
      {hint && <span style={{ display: 'block', fontSize: 11, color: S.faint, marginTop: 5 }}>{hint}</span>}
    </label>
  );

  const pill = (active, label, onClick) => (
    <button type="button" onClick={onClick}
      style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${active ? 'rgba(255,255,255,0.28)' : S.border}`,
        background: active ? 'rgba(255,255,255,0.10)' : 'transparent', color: active ? S.text : S.sub }}>
      {label}
    </button>
  );

  const pctChip = (pct) => {
    const p = Number(String(price).replace(/[^0-9.]/g, '')) || 0;
    const value = Math.round((p * pct) / 100 / 100) * 100;
    const active = p > 0 && Number(String(deposit).replace(/[^0-9.]/g, '')) === value;
    return (
      <button key={pct} type="button" onClick={() => setDeposit(String(value))} disabled={!p}
        style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 999, cursor: p ? 'pointer' : 'default',
          border: `1px solid ${active ? 'rgba(255,255,255,0.28)' : S.border}`,
          background: active ? 'rgba(255,255,255,0.10)' : 'transparent', color: active ? S.text : S.sub }}>
        {pct}%
      </button>
    );
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 880, maxHeight: '94dvh', overflowY: 'auto', background: S.bg, color: S.text,
          borderRadius: '18px 18px 0 0', border: `1px solid ${S.border}`, borderBottom: 'none', fontFamily: 'var(--xd-font-body)' }} className="xd-poster-sheet">
        <style>{'.xd-poster-sheet button, .xd-poster-sheet input { font-family: inherit; }'}</style>
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: S.bg, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Loan poster</p>
            <p style={{ margin: 0, fontSize: 12, color: S.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{posterTitle(car)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${S.border}`, background: 'transparent', color: S.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: 16 }}>
          <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
            {numbers.ok ? (
              <canvas ref={previewRef} style={{ width: '100%', maxWidth: 'min(380px, 72vw)', aspectRatio: '1080 / 1350', borderRadius: 10, background: '#fff', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
            ) : (
              <div style={{ width: '100%', maxWidth: 'min(380px, 72vw)', aspectRatio: '1080 / 1350', borderRadius: 10, border: `1px dashed ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: S.sub, fontSize: 13 }}>
                {POSTER_ERRORS[numbers.error]}
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div data-tour-id="poster-numbers" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {field('Car price', price, setPrice)}
            <div>
              {field('Deposit', deposit, setDeposit)}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>{[10, 15, 20].map(pctChip)}</div>
            </div>
            <div>
              {field('Interest rate', rate, setRate, { suffix: '%', hint: basis === 'flat'
                ? 'Brochure (flat) rate: the monthly is worked out the lawful way, per tenure.'
                : 'EIR, the yearly rate banks must quote since June 2026.' })}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {pill(basis === 'eir', 'EIR', () => setBasis('eir'))}
                {pill(basis === 'flat', 'Flat', () => setBasis('flat'))}
              </div>
            </div>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.sub, marginBottom: 6 }}>Poster language</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {pill(lang === 'ms', 'Bahasa Melayu', () => setLang('ms'))}
                {pill(lang === 'en', 'English', () => setLang('en'))}
              </div>
            </div>

            {limitHit ? (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 12, padding: 14, background: S.panel }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={14} /> {LITE_POSTERS_PER_MONTH} free posters used this month</p>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: S.sub }}>Cars you already made a poster for stay free. Premium makes posters for every car.</p>
                {onUpgrade && (
                  <button onClick={() => { onClose(); onUpgrade(); }} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: S.accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    See Premium
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button data-tour-id="poster-download" onClick={() => run('download')} disabled={!numbers.ok || busy}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 0', borderRadius: 10, border: 'none',
                    background: numbers.ok ? S.accent : 'rgba(220,38,38,0.3)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: numbers.ok && !busy ? 'pointer' : 'default' }}>
                  <Download size={15} /> {busy ? 'Making...' : 'Download poster'}
                </button>
                {canShare && (
                  <button onClick={() => run('share')} disabled={!numbers.ok || busy} aria-label="Share poster"
                    style={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.text, cursor: numbers.ok && !busy ? 'pointer' : 'default' }}>
                    <Share2 size={16} />
                  </button>
                )}
              </div>
            )}

            {left !== null && !limitHit && (
              <p style={{ margin: 0, fontSize: 11, color: S.faint }}>
                {left} of {quota.limit || LITE_POSTERS_PER_MONTH} free posters left this month. The same car again is free.
              </p>
            )}
            <p style={{ margin: 0, fontSize: 11, color: S.faint }}>
              The poster prints your name, photo and WhatsApp number from your profile{pageUrl ? ', and your page link' : ''}.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
