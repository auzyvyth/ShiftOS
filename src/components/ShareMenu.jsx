import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share2, MessageCircle, Facebook, Instagram, Music2, Link2, AtSign } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Per-channel share dropdown. Each option opens/copies a link tagged with
// ?src=<channel> so the analytics dashboard can attribute clicks by platform.
// Portal-rendered + fixed-positioned so a card's overflow can't clip it.
const CHANNELS = [
  { key: 'whatsapp',  label: 'WhatsApp',                 Icon: MessageCircle, color: '#25D366' },
  { key: 'facebook',  label: 'Facebook',                 Icon: Facebook,      color: '#1877F2' },
  { key: 'threads',   label: 'Threads',                  Icon: AtSign,        color: '#111827' },
  { key: 'instagram', label: 'Instagram — copy for bio', tk: 'shareMenu.instagram', Icon: Instagram,     color: '#E4405F' },
  { key: 'tiktok',    label: 'TikTok — copy for bio',    tk: 'shareMenu.tiktok', Icon: Music2,        color: '#111827' },
  { key: 'copy',      label: 'Copy link',                tk: 'shareMenu.copyLink', Icon: Link2,         color: '#6b7280' },
];

// imageUrl (optional): the seller's page card (api/agent-card, the SAME picture the link
// preview uses). Instagram and TikTok have no "post this link" address, so with an image the
// phone's share sheet gets the picture + caption (navigator.share with files); where it cannot
// take files (desktop, in-app browsers) the picture is downloaded and the caption copied.
export default function ShareMenu({ baseUrl, refSlug, waCaption, imageUrl, dark = false, label, compact = false, style }) {
  const { t } = useTranslation();
  const shareLabel = label ?? t('shareMenu.share');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const imgBlob = useRef(null);

  const buildUrl = (channel) => {
    let u;
    try { u = new URL(baseUrl, window.location.origin); }
    catch { return baseUrl; }
    if (refSlug) u.searchParams.set('ref', refSlug);
    u.searchParams.set('src', channel);
    return u.toString();
  };

  // The share must start inside the tap (about 5s of grace on phones), so the picture is
  // fetched when the menu opens, never after the tap.
  const prefetchImage = () => {
    if (!imageUrl || imgBlob.current?.url === imageUrl) return;
    imgBlob.current = { url: imageUrl, blob: null };
    fetch(imageUrl).then((r) => (r.ok ? r.blob() : null)).then((b) => {
      if (imgBlob.current?.url === imageUrl) imgBlob.current.blob = b;
    }).catch(() => { imgBlob.current = null; });
  };

  const shareImage = async (channel, url) => {
    const text = waCaption ? waCaption(url) : url;
    const blob = imgBlob.current?.blob;
    const file = blob ? new File([blob], 'drevo-page.jpg', { type: blob.type || 'image/jpeg' }) : null;
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); } catch { /* closed the sheet */ }
      return;
    }
    // No file sharing here: save the picture, keep the words on the clipboard.
    try { await navigator.clipboard?.writeText(text); } catch { /* ignore */ }
    if (blob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'drevo-page.jpg';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.success(t(channel === 'tiktok' ? 'shareMenu.imageSavedTt' : 'shareMenu.imageSavedIg'));
    } else {
      toast.success(t(channel === 'tiktok' ? 'shareMenu.copiedTt' : 'shareMenu.copiedIg'));
    }
  };

  const toggle = (e) => {
    e?.stopPropagation?.();
    prefetchImage();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const width = 232;
      // anchorTop/anchorBottom let the layout effect below flip the menu
      // upward once its real height is known.
      setPos({ top: r.bottom + 6, anchorTop: r.top, anchorBottom: r.bottom, left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)), width });
    }
    setOpen((o) => !o);
  };

  // Always opening DOWNWARD pushed the menu off-screen whenever the button sat
  // near the bottom of the viewport (the Lite win card is a bottom sheet, so
  // every channel below WhatsApp was cut off). Measure the menu before paint
  // and open upward when there is not room below.
  useLayoutEffect(() => {
    if (!open || !pos || !menuRef.current) return;
    const h = menuRef.current.offsetHeight;
    const vh = window.innerHeight;
    let top = pos.anchorBottom + 6;
    if (top + h > vh - 8) {
      const above = pos.anchorTop - 6 - h;
      top = above >= 8 ? above : Math.max(8, vh - 8 - h);
    }
    if (top !== pos.top) setPos((p) => (p ? { ...p, top } : p));
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (e, channel) => {
    e.stopPropagation();
    const url = buildUrl(channel);
    if (channel === 'whatsapp') {
      const text = waCaption ? waCaption(url) : url;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } else if (channel === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,width=620,height=540');
    } else if (channel === 'threads') {
      const text = waCaption ? waCaption(url) : url;
      window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } else if ((channel === 'instagram' || channel === 'tiktok') && imageUrl) {
      shareImage(channel, url);
    } else if (channel === 'instagram') {
      navigator.clipboard?.writeText(url);
      toast.success(t('shareMenu.copiedIg'));
    } else if (channel === 'tiktok') {
      navigator.clipboard?.writeText(url);
      toast.success(t('shareMenu.copiedTt'));
    } else {
      navigator.clipboard?.writeText(url);
      toast.success(t('shareMenu.copied'));
    }
    setOpen(false);
  };

  const trigger = dark
    ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }
    : { background: '#ffffff', border: '1px solid #e5e7eb', color: '#374151' };

  const menuTheme = dark
    ? { bg: '#14161c', border: '1px solid rgba(255,255,255,0.1)', text: '#e5e7eb', hover: 'rgba(255,255,255,0.06)', shadow: '0 18px 50px rgba(0,0,0,0.5)' }
    : { bg: '#ffffff', border: '1px solid #e5e7eb', text: '#111827', hover: '#f4f3ef', shadow: '0 18px 50px rgba(15,23,42,0.18)' };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', padding: compact ? '7px 9px' : '7px 12px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', ...trigger, ...style }}
      >
        <Share2 size={13} style={{ flexShrink: 0 }} />{!compact && shareLabel}
      </button>

      {open && pos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 4000 }} />
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 4001, background: menuTheme.bg, border: menuTheme.border, borderRadius: 12, boxShadow: menuTheme.shadow, padding: 6, fontFamily: "'Outfit', sans-serif" }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: dark ? '#6b7280' : '#9ca3af', padding: '6px 10px 4px', margin: 0 }}>{t('shareMenu.via')}</p>
            {CHANNELS.map(({ key, label: l, tk, Icon, color }) => (
              <button
                key={key}
                onClick={(e) => pick(e, key)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 10px', borderRadius: 8, color: menuTheme.text, fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = menuTheme.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                <span style={{ width: 28, height: 28, borderRadius: 8, background: `${color}1a`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} />
                </span>
                {imageUrl && (key === 'instagram' || key === 'tiktok') ? t(`shareMenu.${key}Image`) : tk ? t(tk) : l}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
