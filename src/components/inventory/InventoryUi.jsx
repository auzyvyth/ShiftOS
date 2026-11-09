// Shared pieces of the dealer Inventory tab (Listings | Stock & costs), drawn in
// premiumLight like Overview: white cards floating on the grey canvas, no
// borders, red only for the one main button and for urgent counts.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap, FileText, Package, Upload, Bot, X, ChevronRight, ChevronDown, Check, PlusCircle } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';

export const INV_CARD = { background: PL.cardBg, borderRadius: PL.radius.card, boxShadow: PL.shadow };
export const INV_MICRO = { fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted, fontWeight: 600, margin: 0 };
export const INV_INPUT = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, color: PL.text, background: PL.raised, border: 'none', borderRadius: PL.radius.row, outline: 'none', fontFamily: 'inherit' };
export const INV_GHOST_BTN = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: PL.text, background: PL.raised, border: 'none', borderRadius: PL.radius.row, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' };

// The ONE red button on each pill.
export function AddCarButton({ onClick, label = 'Add car', className }) {
  return (
    <button onClick={onClick} className={className} style={{ ...INV_GHOST_BTN, background: PL.accent, color: PL.onAccent, fontWeight: 700 }}>
      <PlusCircle style={{ width: 15, height: 15 }} /> {label}
    </button>
  );
}

// Listings | Stock & costs. A segmented switch, not a second row of tabs.
export function InventorySwitch({ tabs, active, onChange }) {
  return (
    <div role="tablist" style={{ display: 'inline-flex', gap: 4, padding: 4, background: PL.hover, borderRadius: PL.radius.pill, marginBottom: 16, maxWidth: '100%' }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => !on && onChange(t.id)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: on ? 700 : 500, border: 'none', cursor: on ? 'default' : 'pointer',
              borderRadius: PL.radius.pill, whiteSpace: 'nowrap', fontFamily: 'inherit',
              background: on ? PL.card : 'transparent', color: on ? PL.text : PL.textSec,
              boxShadow: on ? '0 1px 3px rgba(17,24,39,0.12)' : 'none',
            }}>
            {t.label}
          </button>
        );
      })}
      {/* Phone toolbar rules, shared by both pills (rendered once per pill with the switch).
          .inv-sm-hide: a button's word drops on a phone, its icon stays.
          .inv-add-last: the Add car button sits beside search on a phone, last on desktop. */}
      <style>{`
        @media (max-width: 639px) { .inv-sm-hide { display: none; } }
        @media (min-width: 640px) { .inv-add-last { order: 9; } }
      `}</style>
    </div>
  );
}

// Status filter inside a pill (Available 5 | Reserved 1 ...). Same switch, smaller.
export function StatusPills({ items, active, onChange }) {
  return (
    <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {items.map(({ key, label, count }) => {
        const on = key === active;
        return (
          <button key={key} onClick={() => onChange(key)}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', fontSize: 13,
              fontWeight: on ? 700 : 500, border: 'none', borderRadius: PL.radius.pill, cursor: 'pointer', fontFamily: 'inherit',
              background: on ? PL.text : PL.raised, color: on ? '#fff' : PL.textSec,
            }}>
            {label}
            <span style={{ fontSize: 11, fontWeight: 700, opacity: on ? 0.75 : 1, color: on ? '#fff' : PL.textMuted, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// One number per tile, like Overview's KpiCard.
export function InvTile({ label, value, sub, tone }) {
  return (
    <div style={{ ...INV_CARD, padding: '16px 18px', minWidth: 0 }}>
      <p style={INV_MICRO}>{label}</p>
      <p style={{ fontSize: 'clamp(18px, 4.8vw, 24px)', fontWeight: 700, margin: '8px 0 2px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        color: tone === 'bad' ? PL.accentText : tone === 'good' ? PL.up : PL.text }}>{value ?? '—'}</p>
      {sub && <p style={{ fontSize: 11, color: PL.textMuted, margin: 0, lineHeight: 1.35 }}>{sub}</p>}
    </div>
  );
}

// The one way to add a car. Every former entry point (menu item, Fast, Full
// Form, Add Stock, Tools > Import) opens this.
export function AddCarSheet({ open, onClose, onQuick, onFull, onStock, onCsv, onAi }) {
  useModalHistory(open, onClose);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  const run = (fn) => () => { onClose(); fn?.(); };
  const Row = ({ Icon, title, sub, onClick }) => (
    <button onClick={onClick} className="pl-key"
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '13px 14px', background: PL.card, border: 'none', borderRadius: PL.radius.row + 2, cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: PL.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 17, height: 17, color: PL.text }} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: PL.text }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: PL.textMuted, marginTop: 2 }}>{sub}</span>
      </span>
      <ChevronRight style={{ width: 16, height: 16, color: PL.textMuted, flexShrink: 0 }} />
    </button>
  );
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(17,24,39,0.35)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Add a car"
        style={{ width: '100%', maxWidth: 460, background: PL.canvas, borderRadius: '20px 20px 0 0', padding: '18px 16px calc(18px + env(safe-area-inset-bottom))', margin: '0 auto', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }}
        className="inv-sheet">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: PL.text, margin: 0 }}>Add a car</p>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: PL.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 16, height: 16, color: PL.text }} />
          </button>
        </div>
        <p style={{ ...INV_MICRO, margin: '0 2px 8px' }}>One car</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row Icon={Zap} title="Quick listing" sub="Photos, price and the basics. Live on the marketplace." onClick={run(onQuick)} />
          <Row Icon={FileText} title="Full listing" sub="Every spec, condition report and included services." onClick={run(onFull)} />
          <Row Icon={Package} title="Stock only" sub="Record the car and its costs. Not on the marketplace yet." onClick={run(onStock)} />
        </div>
        <p style={{ ...INV_MICRO, margin: '16px 2px 8px' }}>Many cars</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row Icon={Upload} title="Import a CSV" sub="A spreadsheet in our column format." onClick={run(onCsv)} />
          <Row Icon={Bot} title="AI import" sub="Any stock list, spreadsheet or PDF. AI reads the cars out." onClick={run(onAi)} />
        </div>
      </div>
      <style>{`@media (min-width: 640px) { .inv-sheet { border-radius: 20px !important; margin: auto !important; } }`}</style>
    </div>,
    document.body,
  );
}

// "Needs attention": the stock checks in one menu, each with how many cars it
// matches. Picking checks narrows the list (all picked checks must match).
export function NeedsAttentionMenu({ checks, active, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const btn = useRef(null);
  const total = checks.reduce((t, c) => t + (c.count > 0 ? 1 : 0), 0);
  const toggleOpen = () => {
    if (!open && btn.current) setRect(btn.current.getBoundingClientRect());
    setOpen(o => !o);
  };
  const W = 250;
  return (
    <>
      <button ref={btn} onClick={toggleOpen}
        style={{ ...INV_GHOST_BTN, background: active.size ? PL.text : PL.raised, color: active.size ? '#fff' : PL.text }}>
        Needs attention
        {active.size > 0
          ? <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{active.size} on</span>
          : total > 0 && <span style={{ minWidth: 8, height: 8, borderRadius: 999, background: PL.accent }} aria-label={`${total} checks have cars`} />}
        <ChevronDown style={{ width: 14, height: 14 }} />
      </button>
      {open && rect && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10040 }} />
          <div style={{ position: 'fixed', top: Math.min(rect.bottom + 6, window.innerHeight - 420), left: Math.min(Math.max(8, rect.left), window.innerWidth - 8 - W), width: W, zIndex: 10041, ...INV_CARD, padding: 6, fontFamily: 'system-ui, sans-serif' }}>
            {checks.map(c => {
              const on = active.has(c.key);
              const none = c.count === 0 && !on;
              return (
                <button key={c.key} onClick={() => onToggle(c.key)} disabled={none}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', borderRadius: 10, background: on ? PL.raised : 'transparent', cursor: none ? 'default' : 'pointer', fontFamily: 'inherit', opacity: none ? 0.45 : 1 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? PL.text : PL.raised, boxShadow: on ? 'none' : 'inset 0 0 0 1.5px #d1d5db' }}>
                    {on && <Check style={{ width: 11, height: 11, color: '#fff' }} />}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: on ? 700 : 500, color: PL.text }}>{c.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.count > 0 ? PL.text : PL.textMuted, fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
                </button>
              );
            })}
            {active.size > 0 && (
              <button onClick={() => { onClear(); setOpen(false); }}
                style={{ width: '100%', marginTop: 4, padding: '9px 10px', border: 'none', borderRadius: 10, background: 'transparent', color: PL.accentText, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                Clear checks
              </button>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
