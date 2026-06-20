import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share2, MessageCircle, Facebook, Music2, Link2 } from 'lucide-react';
import { toast } from 'sonner';

// Per-channel share dropdown. Each option opens/copies a link tagged with
// ?src=<channel> so the analytics dashboard can attribute clicks by platform.
// Portal-rendered + fixed-positioned so a card's overflow can't clip it.
const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp',            Icon: MessageCircle, color: '#25D366' },
  { key: 'facebook', label: 'Facebook',            Icon: Facebook,      color: '#1877F2' },
  { key: 'tiktok',   label: 'TikTok — copy for bio', Icon: Music2,      color: '#111827' },
  { key: 'copy',     label: 'Copy link',           Icon: Link2,         color: '#6b7280' },
];

export default function ShareMenu({ baseUrl, refSlug, waCaption, dark = false, label = 'Share', compact = false, style }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  const buildUrl = (channel) => {
    let u;
    try { u = new URL(baseUrl, window.location.origin); }
    catch { return baseUrl; }
    if (refSlug) u.searchParams.set('ref', refSlug);
    u.searchParams.set('src', channel);
    return u.toString();
  };

  const toggle = (e) => {
    e?.stopPropagation?.();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const width = 232;
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)), width });
    }
    setOpen((o) => !o);
  };

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
    } else if (channel === 'tiktok') {
      navigator.clipboard?.writeText(url);
      toast.success('Link copied — paste it in your TikTok bio or caption');
    } else {
      navigator.clipboard?.writeText(url);
      toast.success('Link copied');
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
        <Share2 size={13} style={{ flexShrink: 0 }} />{!compact && label}
      </button>

      {open && pos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 4000 }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 4001, background: menuTheme.bg, border: menuTheme.border, borderRadius: 12, boxShadow: menuTheme.shadow, padding: 6, fontFamily: "'Outfit', sans-serif" }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: dark ? '#6b7280' : '#9ca3af', padding: '6px 10px 4px', margin: 0 }}>Share via</p>
            {CHANNELS.map(({ key, label: l, Icon, color }) => (
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
                {l}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
