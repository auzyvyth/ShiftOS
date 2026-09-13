import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Wallet, X, ChevronDown, MessageCircle } from 'lucide-react';
import { calcMonthly, HIGH_VALUE_THRESHOLD } from '../utils/financing';
import { computeAffordability } from '../utils/affordability';

const fmt = (n) => (n != null && !Number.isNaN(n)) ? Math.round(n).toLocaleString('en-MY') : '—';
const num = (v) => parseFloat(v) || 0;

// "Can I afford this?" — a self-contained trigger + popup, same shape as
// BuyerChat.jsx (own open state, own portal, own scroll lock) so it can drop
// next to the price on both the mobile and desktop CTA blocks without
// CarDetailPage wiring any state for it. Entirely client-side: nothing here
// is written to Supabase, so a buyer's salary/commitments never leave their
// browser (deliberate — this is anon-reachable PII with no reason to persist
// it for a v1 estimate tool).
export default function AffordabilityCheck({
  carPrice,
  carName,
  isLight = false,
  onTalkToSeller,
  talkToSellerLabel = 'Talk to the seller',
}) {
  const [open, setOpen] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [income, setIncome] = useState('');
  const [commitments, setCommitments] = useState('');
  const [carLoan, setCarLoan] = useState('');
  const [personalLoan, setPersonalLoan] = useState('');
  const [creditCard, setCreditCard] = useState('');
  const [otherCommit, setOtherCommit] = useState('');

  // Overlay rule 2 — lock the page behind the popup.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // The SAME estimate already printed next to the price on this page
  // (calcMonthly, financing.js) — never a second loan formula here.
  const monthlyInstallment = calcMonthly(carPrice);
  const detailedTotal = [carLoan, personalLoan, creditCard, otherCommit].reduce((sum, v) => sum + num(v), 0);
  const totalCommitments = detailed ? detailedTotal : num(commitments);

  const result = monthlyInstallment
    ? computeAffordability({ netIncome: num(income), existingCommitments: totalCommitments, monthlyInstallment })
    : null;

  const close = () => setOpen(false);
  // Overlay rule 3 — close this popup before anything else opens (e.g. the
  // page's own WhatsApp/chat contact flow).
  const closeAndRun = (fn) => () => { setOpen(false); if (fn) fn(); };

  const c = isLight
    ? { bg: '#ffffff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', inputBg: '#ffffff', inputBorder: '#DDE3EC', card: '#f9fafb', triggerBg: 'rgba(220,38,38,0.06)', triggerBorder: 'rgba(220,38,38,0.2)' }
    : { bg: '#0f1420', border: 'rgba(255,255,255,0.10)', text: '#f3f4f6', sub: 'rgba(255,255,255,0.55)', inputBg: 'rgba(255,255,255,0.04)', inputBorder: 'rgba(255,255,255,0.12)', card: 'rgba(255,255,255,0.04)', triggerBg: 'rgba(220,38,38,0.1)', triggerBorder: 'rgba(220,38,38,0.3)' };

  const inputStyle = {
    width: '100%', background: c.inputBg, border: `1px solid ${c.inputBorder}`, borderRadius: 9,
    color: c.text, fontSize: 13, fontWeight: 600, outline: 'none', padding: '9px 10px 9px 30px',
    fontFamily: "var(--xd-font-body)", boxSizing: 'border-box',
  };
  const fieldLabel = { color: c.sub, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' };

  const Field = ({ label, value, onChange, placeholder }) => (
    <div>
      <p style={fieldLabel}>{label}</p>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: c.sub, fontSize: 12, fontWeight: 600, pointerEvents: 'none' }}>RM</span>
        <input type="number" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      </div>
    </div>
  );

  const sheet = (
    <div
      onClick={e => { if (e.target === e.currentTarget) close(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "var(--xd-font-body)" }}
    >
      <div style={{ width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 20px 4px' }}>
          <div>
            <p style={{ display: 'flex', alignItems: 'center', gap: 7, color: c.text, fontWeight: 700, fontSize: 15, margin: '0 0 3px' }}>
              <Wallet size={16} style={{ color: '#dc2626' }} /> Can I afford this?
            </p>
            {carName && <p style={{ color: c.sub, fontSize: 12, margin: 0 }}>{carName}</p>}
          </div>
          <button onClick={close} aria-label="Close" style={{ background: 'none', border: 'none', color: c.sub, cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!monthlyInstallment ? (
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14 }}>
              <p style={{ color: c.text, fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Above our quick-estimate range</p>
              <p style={{ color: c.sub, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                Cars over RM{Math.round(HIGH_VALUE_THRESHOLD / 1000)}k are usually financed case-by-case. Ask the seller for a proper quote instead of a rule-of-thumb estimate.
              </p>
            </div>
          ) : (
            <>
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: c.sub, fontSize: 12 }}>Estimated installment for this car</span>
                <span style={{ color: c.text, fontSize: 14, fontWeight: 700 }}>RM {fmt(monthlyInstallment)}/mo</span>
              </div>

              <Field label="Your net monthly income" value={income} onChange={setIncome} placeholder="5000" />

              {!detailed ? (
                <Field label="Existing monthly commitments (loans, cards, etc.)" value={commitments} onChange={setCommitments} placeholder="800" />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Car / bike loan" value={carLoan} onChange={setCarLoan} placeholder="0" />
                  <Field label="Personal loan" value={personalLoan} onChange={setPersonalLoan} placeholder="0" />
                  <Field label="Credit card (min. pmt)" value={creditCard} onChange={setCreditCard} placeholder="0" />
                  <Field label="Other commitments" value={otherCommit} onChange={setOtherCommit} placeholder="0" />
                </div>
              )}

              <button
                onClick={() => setDetailed(d => !d)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: c.sub, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0, alignSelf: 'flex-start', fontFamily: "var(--xd-font-body)" }}
              >
                <ChevronDown size={13} style={{ transform: detailed ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                {detailed ? 'Use a single commitments total' : 'Break down my commitments'}
              </button>

              {result && (
                <div style={{ background: `${result.band.color}14`, border: `1px solid ${result.band.color}40`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ color: result.band.color, fontWeight: 700, fontSize: 14 }}>{result.band.label}</span>
                    <span style={{ color: c.sub, fontSize: 11 }}>DSR ≈ {result.dsrPct}%</span>
                  </div>
                  <p style={{ color: c.sub, fontSize: 12, margin: 0 }}>
                    {result.disposable >= 0
                      ? `About RM ${fmt(result.disposable)}/mo left after this car and your other commitments.`
                      : `This would put you about RM ${fmt(Math.abs(result.disposable))}/mo over your income.`}
                  </p>
                  <p style={{ color: c.sub, fontSize: 10.5, lineHeight: 1.5, margin: '10px 0 0', opacity: 0.85 }}>
                    Rough estimate only — not a bank decision. DSR (debt-service ratio) is a common rule of thumb; real approval depends on the bank and your full credit profile.
                  </p>
                </div>
              )}
            </>
          )}

          {onTalkToSeller && (
            <button onClick={closeAndRun(onTalkToSeller)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 10, color: '#25D366', fontSize: 13, fontWeight: 700, padding: '11px', cursor: 'pointer', fontFamily: "var(--xd-font-body)" }}
            >
              <MessageCircle size={14} /> {talkToSellerLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: c.triggerBg, border: `1px solid ${c.triggerBorder}`, borderRadius: 20, color: '#dc2626', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', cursor: 'pointer', fontFamily: "var(--xd-font-body)", whiteSpace: 'nowrap' }}
      >
        <Wallet size={12} /> Can I afford this?
      </button>
      {open && createPortal(sheet, document.body)}
    </>
  );
}
