// The owner's Overview, money first (owner, 2026-11-12, after a mock: "it tells the owner
// everything about the money and revenue"). Every number is a sum of carPnl() over the cars
// (src/utils/ownerMoney.js), so it always equals the cars underneath it. No cash balance, bills
// or receivables: nothing records them yet, and an invented number is worse than none.
// Week | Month | Year comes from Overview (one switch for the whole tab). EVERY number here opens a
// breakdown of where it comes from (MoneyDetailSheet, built by src/utils/moneyExplain.js).
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useCarMoney } from '../../hooks/useCarMoney';
import { PERIOD_TEXT } from '../../utils/ownerMoney';
import { explain } from '../../utils/moneyExplain';
import MoneyDetailSheet from './MoneyDetailSheet';
import { premiumLight as PL } from '../../theme/tokens';
import { worseTone } from '../../theme/plStatus';
import '../../theme/premiumLight.css';

const rm = (v) => {
  const x = Math.round(Number(v) || 0);
  const a = Math.abs(x);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${Math.round(a / 1e3)}K` : a.toLocaleString();
  return `${x < 0 ? '− ' : ''}RM ${s}`;
};
const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
const SPEND_LABEL = { recon: 'Recon', holding: 'Holding (days on lot)', ads: 'Advertising', commission: 'Commission', transfer: 'Transfer and road tax', admin: 'Admin and documents', warranty: 'Warranty reserve', services: 'Included services' };
const FLAG = { no_cost: ['Add buy price', PL.textMuted], no_price: ['No asking price', PL.textMuted], losing: ['Losing money', PL.accentText], ageing: ['Over 60 days', PL.accentText], ok: ['On track', PL.up] };

const card = { background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '16px 18px', minWidth: 0 };
const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: PL.textMuted, margin: 0 };
function Head({ title, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, margin: '6px 2px 0' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: PL.text, margin: 0 }}>{title}</h2>
      {sub && <span style={{ fontSize: 12, color: PL.textMuted }}>{sub}</span>}
    </div>
  );
}
// `vs` is the words for the comparison ("vs this day last month"); with nothing to compare, say so.
function Trend({ v, vs }) {
  if (v == null || !Number.isFinite(v)) return <span style={{ fontSize: 11.5, color: PL.textMuted }}>nothing to compare yet</span>;
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: v >= 0 ? PL.up : PL.accentText }}>{v >= 0 ? '+' : ''}{v.toFixed(1)}% <span style={{ fontWeight: 400, color: PL.textMuted }}>{vs}</span></span>;
}
// A tile you can press: it opens where its number comes from.
function Kpi({ label, value, children, tone, onOpen }) {
  return (
    <button type="button" className="pl-key" onClick={onOpen} aria-label={`${label}: where it comes from`}
      style={{ ...card, border: 'none', textAlign: 'left', width: '100%', fontFamily: 'inherit', cursor: 'pointer' }}>
      <p style={eyebrow}>{label}</p>
      <p style={{ fontSize: 'clamp(19px, 5.2vw, 26px)', fontWeight: 800, color: tone || PL.text, margin: '8px 0 4px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{value}</p>
      <div style={{ fontSize: 11.5, color: PL.textMuted }}>{children}</div>
    </button>
  );
}
// Each row is a button when it has an `open` key: tap a bar, see the cars behind it.
function Bars({ rows, total, onOpen }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {rows.map((r) => {
        const Tag = r.open && onOpen ? 'button' : 'div';
        return (
          <Tag key={r.label} {...(Tag === 'button' ? { type: 'button', onClick: () => onOpen(r.open) } : {})}
            style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: Tag === 'button' ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
              <span style={{ color: PL.textSec }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: r.val < 0 ? PL.accentText : PL.text, fontVariantNumeric: 'tabular-nums' }}>{rm(r.val)}{total > 0 && r.val > 0 ? ` · ${Math.round((r.val / total) * 100)}%` : ''}</span>
            </div>
            <div style={{ height: 7, background: PL.raised, borderRadius: 99, marginTop: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${total > 0 ? Math.max(0, Math.min(100, (r.val / total) * 100)) : 0}%`, background: r.dark ? PL.text : PL.accent, borderRadius: 99 }} />
            </div>
          </Tag>
        );
      })}
    </div>
  );
}

const SERIES_TEXT = { week: 'last 8 weeks', month: 'last 6 months', year: 'last 12 months' };

export default function OwnerMoney({ dealerId, onNavigate, period = 'month' }) {
  const { money: m, failed, cached } = useCarMoney(dealerId);
  const [detail, setDetail] = useState(null);

  if (!m) {
    return (
      <div style={{ ...card, color: PL.textMuted, fontSize: 13 }}>
        {failed && !cached ? 'Could not load the money numbers. Refresh to try again.' : 'Counting the money...'}
      </div>
    );
  }
  const P = m.periods[period] || m.periods.month;
  const T = PERIOD_TEXT[P.kind];
  const mo = P.cur;
  const open = (key) => setDetail(explain(m, P.kind, key));
  const spendTotal = mo.spend.reduce((s, x) => s + x.val, 0) + P.overhead;
  const addonCount = mo.rowsSold.reduce((c, r) => c + r.addonItems.length, 0);
  // Last year is shown only when a car really sold in that window: Drevo is new, nothing is made up.
  const ly = P.lastYear;
  const LY = ({ children }) => (ly ? <div>Last year: {children}</div> : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        .om-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
        .om-two{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px}
        .om-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        @media(max-width:900px){.om-kpis{grid-template-columns:1fr 1fr}.om-two{grid-template-columns:1fr}.om-tiles{grid-template-columns:1fr 1fr}}
      `}</style>

      <Head title={`Money ${T.name}`} sub="RM · sold cars, counted from the day each car was added. Tap a number to see where it comes from." />
      <div className="om-kpis">
        <Kpi label="Gross profit" value={rm(mo.gross)} tone={worseTone(mo.gross, P.before.gross)} onOpen={() => open('gross')}>
          <Trend v={pct(mo.gross, P.before.gross)} vs={T.vs} />{mo.margin != null && <div style={mo.margin < 0 ? { color: PL.accentText, fontWeight: 700 } : undefined}>{mo.margin.toFixed(1)}% margin</div>}
          <LY>{rm(ly?.gross)}</LY>
        </Kpi>
        <Kpi label="Sales" value={rm(mo.revenue)} tone={worseTone(mo.revenue, P.before.revenue)} onOpen={() => open('sales')}>
          <Trend v={pct(mo.revenue, P.before.revenue)} vs={T.vs} />
          <LY>{rm(ly?.revenue)}</LY>
        </Kpi>
        <Kpi label="Cars sold" value={String(mo.units)} tone={worseTone(mo.units, P.before.units)} onOpen={() => open('units')}>
          <Trend v={pct(mo.units, P.before.units)} vs={T.vs} />
          {mo.brokerSold > 0 && <div>{mo.brokerSold} through brokers</div>}
          <LY>{ly?.units} car{ly?.units === 1 ? '' : 's'}</LY>
        </Kpi>
        <Kpi label="Add-ons" value={rm(mo.addonRevenue)} tone={worseTone(mo.addonRevenue, P.before.addonRevenue)} onOpen={() => open('addons')}>
          <Trend v={pct(mo.addonRevenue, P.before.addonRevenue)} vs={T.vs} />
          <div>{addonCount > 0 ? `${addonCount} sold with the cars` : 'none sold yet'}</div>
        </Kpi>
        <Kpi label="Commission" value={rm(mo.commission)} onOpen={() => open('commission')}>
          {mo.brokerCommission > 0 ? `${rm(mo.brokerCommission)} of it for brokers` : mo.commission > 0 ? 'your salesmen' : 'none on these cars'}
        </Kpi>
        <Kpi label="Overhead" value={rm(P.overhead)} onOpen={() => open('overhead')}>
          {P.overhead > 0 ? 'counted by the day (Settings, Costs)' : 'Set your monthly overhead in Settings, Costs'}
        </Kpi>
        <Kpi label="After overhead" value={rm(P.net)} tone={P.net < 0 ? PL.accentText : undefined} onOpen={() => open('net')}>
          gross profit minus overhead
        </Kpi>
        <Kpi label="Money tied up in stock" value={rm(m.stock.atCost)} onOpen={() => open('tied')}>
          {m.stock.perDay > 0 ? `costs about ${rm(m.stock.perDay)} a day` : `${m.stock.count} cars, buy + recon`}
        </Kpi>
      </div>
      {(mo.leftOut > 0 || m.stock.noCost > 0) && (
        <button type="button" onClick={() => onNavigate?.('stock')} style={{ ...card, padding: '12px 16px', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: PL.textSec }}>
          <b style={{ color: PL.text }}>Profit is incomplete.</b>{' '}
          {[mo.leftOut > 0 && `${mo.leftOut} car${mo.leftOut === 1 ? '' : 's'} sold ${T.name}`, m.stock.noCost > 0 && `${m.stock.noCost} car${m.stock.noCost === 1 ? '' : 's'} in stock`].filter(Boolean).join(' and ')} {mo.leftOut + m.stock.noCost === 1 ? 'has' : 'have'} no buy price, so {mo.leftOut + m.stock.noCost === 1 ? 'it is' : 'they are'} left out. Add it in Stock and costs.
        </button>
      )}

      <div className="om-two">
        <div style={card}>
          <p style={eyebrow}>Sales vs gross profit, {SERIES_TEXT[P.kind]}</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={P.series} margin={{ top: 14, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={PL.raised} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PL.textMuted }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: PL.textMuted }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`)} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: 'none', boxShadow: PL.shadow }} formatter={(v, k) => [rm(v), k === 'revenue' ? 'Sales' : 'Gross profit']} />
              <Line type="monotone" dataKey="revenue" stroke={PL.accent} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="gross" stroke={PL.ramp[2]} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: PL.textMuted }}>
            <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: PL.accent, marginRight: 5 }} />Sales</span>
            <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: PL.ramp[2], marginRight: 5 }} />Gross profit</span>
          </div>
        </div>
        <div style={card}>
          <p style={{ ...eyebrow, marginBottom: 14 }}>Where the gross came from</p>
          <Bars onOpen={open} total={mo.carsGross + Math.max(0, mo.addonsGross)} rows={[
            { label: 'Selling the cars', val: mo.carsGross, open: 'gross' },
            { label: 'Add-ons (tint, warranty, insurance...)', val: mo.addonsGross, dark: true, open: 'addons' },
          ]} />
          <p style={{ fontSize: 11.5, color: PL.textMuted, margin: '14px 0 0' }}>Cars sold {T.name} with a buy price entered.</p>
        </div>
      </div>

      <Head title="Money tied up" sub="Cars in stock right now" />
      <div className="om-tiles">
        {[
          ['At cost (buy + recon)', rm(m.stock.atCost), false, 'tied'],
          ['Average days in stock', m.stock.avgDays == null ? '—' : `${m.stock.avgDays} days`, false, 'avgdays'],
          ['Holding cost per day', m.stock.perDay > 0 ? rm(m.stock.perDay) : '—', false, 'holding'],
          ['Over 60 days', String(m.stock.over60), m.stock.over60 > 0, 'over60'],
          ['Losing at asking price', String(m.stock.losing), m.stock.losing > 0, 'losing'],
          ['No buy price yet', String(m.stock.noCost), false, 'nocost'],
        ].map(([k, v, bad, key]) => (
          <button key={k} type="button" className="pl-key" onClick={() => open(key)} aria-label={`${k}: where it comes from`}
            style={{ ...card, padding: '12px 14px', border: 'none', textAlign: 'left', width: '100%', fontFamily: 'inherit', cursor: 'pointer' }}>
            <p style={{ fontSize: 20, fontWeight: 800, margin: 0, color: bad ? PL.accentText : PL.text, fontVariantNumeric: 'tabular-nums' }}>{v}</p>
            <p style={{ fontSize: 12, color: PL.textMuted, margin: '2px 0 0' }}>{k}</p>
          </button>
        ))}
      </div>

      <div className="om-two">
        <div style={card}>
          <p style={{ ...eyebrow, marginBottom: 6 }}>Cars holding the most money, oldest first</p>
          {m.stuck.length === 0 ? <p style={{ fontSize: 13, color: PL.textMuted }}>No cars in stock.</p> : m.stuck.slice(0, 6).map((r, i) => {
            const [word, color] = FLAG[r.flag];
            return (
              <button key={r.id} type="button" onClick={() => onNavigate?.('listings')}
                style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 0', border: 'none', borderTop: i ? `1px solid ${PL.line}` : 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: PL.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: PL.textMuted }}>{r.days == null ? '—' : `${r.days} days`}{r.cost != null ? ` · cost ${rm(r.cost)}` : ''}{r.net != null ? ` · ${r.net < 0 ? 'loses' : 'makes'} ${rm(Math.abs(r.net))} if sold today` : ''}</span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color, background: PL.raised, borderRadius: PL.radius.pill, padding: '4px 10px', whiteSpace: 'nowrap' }}>{word}</span>
              </button>
            );
          })}
        </div>
        <div style={card}>
          <p style={{ ...eyebrow, marginBottom: 14 }}>Where the money went {T.name}</p>
          {spendTotal === 0 ? <p style={{ fontSize: 13, color: PL.textMuted, margin: 0 }}>Nothing counted yet {T.name}.</p> : (
            <Bars total={spendTotal} onOpen={open} rows={[
              ...[...mo.spend].sort((a, b) => b.val - a.val).map((x) => ({ label: SPEND_LABEL[x.key] || x.key, val: x.val, dark: x.key !== 'holding', open: `spend:${x.key}` })),
              ...(P.overhead > 0 ? [{ label: 'Overhead so far (rent, salaries...)', val: P.overhead, dark: true, open: 'overhead' }] : []),
            ]} />
          )}
          <p style={{ fontSize: 11.5, color: PL.textMuted, margin: '14px 0 0' }}>Costs of the cars sold {T.name}, plus your monthly overhead. Buy prices are left out. Commission includes brokers.</p>
        </div>
      </div>
      {detail && <MoneyDetailSheet detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
