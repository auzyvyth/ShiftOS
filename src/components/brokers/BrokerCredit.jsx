import React from 'react';
import { Users } from 'lucide-react';

// BROKER-1: how the dealer's lead screens show an outside broker's claim. One look everywhere:
// teal for "a broker's lead" (no other lead colour is teal; the team's salesmen are violet), red
// only when two brokers claim the same buyer. Words come from here so the chip, the card and the
// drawer never describe the same lead two ways. Rule + reasons: src/utils/brokerCredit.js.

const TEAL = { fg: '#0e7490', bg: '#ecfeff', line: '#a5f3fc' };
const RED = { fg: '#b91c1c', bg: '#fef2f2', line: '#fecaca' };

const first = (n) => (n ? String(n).split(' ')[0] : null);
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : '');

export function brokerCreditSummary(credit) {
  if (!credit) return '';
  const who = credit.owner.name || 'an outside broker';
  if (credit.conflict) {
    return `Two brokers claim this buyer. ${credit.registration.name || 'A broker'} registered them on ${day(credit.registration.at)} (held until ${day(credit.registration.until)}); the buyer then came through ${credit.page.name ? `${credit.page.name}'s` : 'another broker\'s'} page. The registration holds, so commission goes to ${who}.`;
  }
  if (credit.owner.via === 'registration') {
    return `${who} registered this buyer on ${day(credit.registration.at)} and holds them until ${day(credit.registration.until)}. If it sells, commission goes to ${who}.`;
  }
  return `${who} sent this buyer: they came through ${who === 'an outside broker' ? 'a broker\'s' : 'their'} page. If it sells, commission goes to ${who}.`;
}

export function BrokerChip({ credit, compact = false, style }) {
  if (!credit) return null;
  const c = credit.conflict ? RED : TEAL;
  const name = first(credit.owner.name);
  const label = credit.conflict ? 'Broker clash' : `Broker${name ? ` · ${name}` : ''}`;
  return (
    <span
      title={brokerCreditSummary(credit)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%',
        fontSize: compact ? 9 : 10, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.line}`,
        borderRadius: 6, padding: compact ? '1px 6px' : '2px 7px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        ...style,
      }}
    >
      <Users style={{ width: compact ? 9 : 11, height: compact ? 9 : 11, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </span>
  );
}

// The block at the top of a lead's drawer: who owns it and why, in plain words.
export function BrokerCreditPanel({ credit }) {
  if (!credit) return null;
  const c = credit.conflict ? RED : TEAL;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: c.fg, marginBottom: 4 }}>
        <Users style={{ width: 13, height: 13 }} />
        {credit.conflict ? 'Two brokers claim this buyer' : `Broker lead${credit.owner.name ? ` · ${credit.owner.name}` : ''}`}
      </div>
      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{brokerCreditSummary(credit)}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, lineHeight: 1.4 }}>
        Giving this lead to a team member does not remove the broker's claim. Settle it with them first.
      </div>
    </div>
  );
}
