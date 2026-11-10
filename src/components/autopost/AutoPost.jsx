// Auto-post (ZERNIO-1, owner 2026-11-10): add a car ONCE, it goes out to every
// social account the dealer switched on, and comes back down (or says SOLD) when
// it sells. PREVIEW ONLY for now: nothing is connected and nothing is posted.
// The switches are kept on this device (`xd_autopost_preview_<dealerId>`) so the
// Listings button and Settings agree while the owner looks at it.
//
// When this becomes real (Zernio, zernio.com): the Zernio API key lives in an
// edge function secret, NEVER in the browser; the dealer connects each account
// through Zernio's own sign-in, and we store only Zernio's account ids. Posting
// starts from the DB (a listing going live), not from this screen, so it fires
// whichever screen added the car.
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Facebook, Instagram, Youtube, Share2, MapPin, AtSign, Music2, Check } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';

export const AUTOPOST_PLATFORMS = [
  { key: 'facebook',  label: 'Facebook Page',       icon: Facebook,  note: 'Post + Marketplace-style photo album' },
  { key: 'instagram', label: 'Instagram',           icon: Instagram, note: 'Photo carousel post' },
  { key: 'tiktok',    label: 'TikTok',              icon: Music2,    note: 'Photo slideshow' },
  { key: 'youtube',   label: 'YouTube Shorts',      icon: Youtube,   note: 'Only when the car has a video' },
  { key: 'google',    label: 'Google Business',     icon: MapPin,    note: 'Shows on your Google Maps listing' },
  { key: 'threads',   label: 'Threads',             icon: AtSign,    note: 'Text + photos' },
];

export const AUTOPOST_RULES = [
  { key: 'on_live',  label: 'Post when a car goes live',      note: 'Photos, price, year, mileage and your page link.' },
  { key: 'on_price', label: 'Update when the price drops',    note: 'Edits the same post. No second post.' },
  { key: 'on_sold',  label: 'Mark SOLD when it sells',        note: 'Edits the post to say SOLD, so buyers stop asking.' },
];

const DEFAULTS = {
  enabled: false,
  platforms: Object.fromEntries(AUTOPOST_PLATFORMS.map(p => [p.key, false])),
  rules: { on_live: true, on_price: true, on_sold: true },
};

const storeKey = (id) => `xd_autopost_preview_${id || 'anon'}`;
const EVT = 'xd-autopost-change';

function read(id) {
  try {
    const raw = localStorage.getItem(storeKey(id));
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw);
    return { ...DEFAULTS, ...v, platforms: { ...DEFAULTS.platforms, ...(v.platforms || {}) }, rules: { ...DEFAULTS.rules, ...(v.rules || {}) } };
  } catch { return DEFAULTS; }
}

// One shared state for the button and the Settings section.
export function useAutoPost(dealerId) {
  const [s, setS] = useState(() => read(dealerId));
  useEffect(() => {
    setS(read(dealerId));
    const on = () => setS(read(dealerId));
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, [dealerId]);
  const update = useCallback((fn) => {
    const next = fn(read(dealerId));
    try { localStorage.setItem(storeKey(dealerId), JSON.stringify(next)); } catch { /* preview only */ }
    setS(next);
    window.dispatchEvent(new Event(EVT));
  }, [dealerId]);
  const onCount = s.enabled ? AUTOPOST_PLATFORMS.filter(p => s.platforms[p.key]).length : 0;
  return { state: s, update, onCount };
}

export function Switch({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        position: 'relative', width: 40, height: 22, flexShrink: 0, borderRadius: 999, border: 'none',
        background: on ? PL.text : '#d1d5db', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, transition: 'background .15s', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: 999,
        background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.25)', transition: 'left .15s',
      }} />
    </button>
  );
}

const PreviewNote = () => (
  <div style={{ background: PL.raised, borderRadius: PL.radius.row, padding: '10px 12px', fontSize: 12, color: PL.textSec, lineHeight: 1.45 }}>
    <b style={{ color: PL.text }}>Preview.</b> Nothing is connected yet and nothing gets posted. This shows how it will work.
  </div>
);

// ── Listings toolbar button ────────────────────────────────────────────────
export function AutoPostButton({ onCount, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Auto-post: ${onCount ? `${onCount} on` : 'off'}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: PL.text, background: PL.raised, border: 'none', borderRadius: PL.radius.row, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
    >
      <Share2 style={{ width: 14, height: 14 }} />
      <span className="inv-sm-hide">Auto-post</span>
      <span className="inv-sm-hide" style={{ fontSize: 11, fontWeight: 700, color: onCount ? PL.up : PL.textMuted }}>
        {onCount ? `${onCount} on` : 'Off'}
      </span>
    </button>
  );
}

// ── Sheet the button opens: what happens to a car, and the way to Settings ──
export function AutoPostSheet({ open, onClose, state, onSetup }) {
  useModalHistory(open, onClose);
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  const on = state.enabled ? AUTOPOST_PLATFORMS.filter(p => state.platforms[p.key]) : [];
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(17,24,39,.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div
        onClick={e => e.stopPropagation()}
        className="ap-sheet"
        style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: '20px 20px 0 0', boxShadow: PL.shadow, padding: 20, maxHeight: '88vh', overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }}
      >
        <style>{`@media (min-width: 640px){ .ap-sheet{ border-radius: 20px !important; margin-bottom: 10vh; } }`}</style>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: PL.text }}>Auto-post</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: PL.textSec }}>Add a car once. Every account below follows.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: PL.raised, border: 'none', borderRadius: 999, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: PL.text }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gap: 6 }}>
          {AUTOPOST_PLATFORMS.map(p => {
            const isOn = on.some(o => o.key === p.key);
            const Icon = p.icon;
            return (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: PL.raised, borderRadius: PL.radius.row }}>
                <Icon style={{ width: 16, height: 16, color: PL.text, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: PL.text }}>{p.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: isOn ? PL.up : PL.textMuted }}>{isOn ? 'On' : 'Off'}</span>
              </div>
            );
          })}
        </div>

        <p style={{ ...{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted, fontWeight: 600 }, margin: '18px 0 8px' }}>What happens to each car</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {AUTOPOST_RULES.map(r => (
            <div key={r.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, background: state.rules[r.key] ? PL.text : PL.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {state.rules[r.key] && <Check style={{ width: 11, height: 11, color: '#fff' }} />}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: state.rules[r.key] ? PL.text : PL.textMuted }}>{r.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: PL.textMuted }}>{r.note}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}><PreviewNote /></div>

        <button
          onClick={() => { onClose(); onSetup(); }}
          style={{ marginTop: 14, width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#fff', background: PL.accent, border: 'none', borderRadius: PL.radius.row, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Set up in Settings
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ── Settings > Auto-post: set once, everything follows ─────────────────────
export function AutoPostSettings({ dealerId }) {
  const { state, update } = useAutoPost(dealerId);
  const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: PL.raised, borderRadius: PL.radius.row };
  return (
    <div style={{ display: 'grid', gap: 16, fontFamily: 'system-ui, sans-serif' }}>
      <PreviewNote />

      <div style={row}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: PL.text }}>Auto-post my cars</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: PL.textMuted }}>The one switch. Off = nothing goes out, whatever is below.</p>
        </div>
        <Switch label="Auto-post my cars" on={state.enabled} onChange={v => update(s => ({ ...s, enabled: v }))} />
      </div>

      <div>
        <p style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted, fontWeight: 600, margin: '0 0 8px' }}>Where it posts</p>
        <div style={{ display: 'grid', gap: 6 }}>
          {AUTOPOST_PLATFORMS.map(p => {
            const Icon = p.icon;
            return (
              <div key={p.key} style={{ ...row, opacity: state.enabled ? 1 : 0.55 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 16, height: 16, color: PL.text }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: PL.text }}>{p.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: PL.textMuted }}>{p.note}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: PL.textMuted }}>
                    Not connected ·{' '}
                    <button type="button" disabled title="Coming soon"
                      style={{ fontSize: 12, fontWeight: 600, color: PL.textSec, background: 'none', border: 'none', padding: 0, cursor: 'not-allowed', fontFamily: 'inherit', textDecoration: 'underline' }}>
                      Connect
                    </button>
                  </p>
                </div>
                <Switch label={p.label} disabled={!state.enabled} on={state.platforms[p.key]}
                  onChange={v => update(s => ({ ...s, platforms: { ...s.platforms, [p.key]: v } }))} />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted, fontWeight: 600, margin: '0 0 8px' }}>What it does</p>
        <div style={{ display: 'grid', gap: 6 }}>
          {AUTOPOST_RULES.map(r => (
            <div key={r.key} style={{ ...row, opacity: state.enabled ? 1 : 0.55 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: PL.text }}>{r.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: PL.textMuted }}>{r.note}</p>
              </div>
              <Switch label={r.label} disabled={!state.enabled} on={state.rules[r.key]}
                onChange={v => update(s => ({ ...s, rules: { ...s.rules, [r.key]: v } }))} />
            </div>
          ))}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: PL.textMuted }}>
        Telegram channel posting stays in Settings &gt; Telegram.
      </p>
    </div>
  );
}
