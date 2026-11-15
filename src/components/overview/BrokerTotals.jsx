// Overview > Brokers: the dealer's broker numbers as TOTALS (BROKER-2, owner 2026-11-15). Every tile is
// a sum of the per-broker rows (src/utils/brokerTotals.js), the same numbers the columns on
// Team > Brokers show, so the two can never disagree. Shown only when the dealer has a broker (or
// commission is still owed to one). Owner only: the database answers nobody else.
import { premiumLight as PL } from '../../theme/tokens';

const rm = (v) => {
  const x = Math.round(Number(v) || 0);
  const a = Math.abs(x);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${Math.round(a / 1e3)}K` : a.toLocaleString();
  return `RM ${s}`;
};
const card = { background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '14px 16px', minWidth: 0, border: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', width: '100%' };

export default function BrokerTotals({ totals, onNavigate }) {
  if (!totals || !(totals.any || totals.owed > 0 || totals.paid > 0)) return null;
  const go = () => onNavigate?.('team', { sub: 'brokers' });
  const tiles = [
    { k: 'Brokers working', v: String(totals.connected), sub: `${totals.carsOnPages} car${totals.carsOnPages === 1 ? '' : 's'} on their pages${totals.paused ? ` · ${totals.paused} paused` : ''}` },
    totals.complete
      ? { k: 'Buyers being held', v: String(totals.holding), sub: `${totals.buyers} registered in all` }
      : { k: 'Buyers registered', v: String(totals.buyers), sub: 'all time' },
    ...(totals.complete ? [{ k: 'Sales to approve', v: String(totals.toApprove), sub: totals.toApprove ? 'a broker says the buyer bought' : 'nothing waiting', bad: totals.toApprove > 0 }] : []),
    { k: 'Sold through brokers', v: String(totals.sold), sub: 'approved by you' },
    { k: 'Commission owed', v: rm(totals.owed), sub: 'approved, not paid yet', bad: totals.owed > 0 },
    ...(totals.complete ? [{ k: 'Commission paid', v: rm(totals.paid), sub: 'all time' }] : []),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`
        .bt-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        @media(max-width:900px){.bt-tiles{grid-template-columns:1fr 1fr}}
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, margin: '6px 2px 0' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: PL.text, margin: 0 }}>Brokers</h2>
        <span style={{ fontSize: 12, color: PL.textMuted }}>RM · all brokers, all time</span>
      </div>
      <div className="bt-tiles">
        {tiles.map((t) => (
          <button key={t.k} type="button" className="pl-key" onClick={go} style={card}>
            <p style={{ fontSize: 20, fontWeight: 800, margin: 0, color: t.bad ? PL.accentText : PL.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{t.v}</p>
            <p style={{ fontSize: 12, color: PL.text, fontWeight: 600, margin: '2px 0 0' }}>{t.k}</p>
            <p style={{ fontSize: 11.5, color: PL.textMuted, margin: '2px 0 0' }}>{t.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
