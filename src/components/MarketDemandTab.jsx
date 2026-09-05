import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { canonicalModel } from '../utils/modelKey';
import { TrendingUp, TrendingDown, Search, AlertCircle, RefreshCw, Package } from 'lucide-react';

/*
 * Market Demand — what the whole Malaysian market registered last month, from
 * JPJ open data (data.gov.my), cross-referenced against this dealer's stock.
 *
 * Source is NEW registrations only, so a car's first plate. Recon imports get a
 * first plate here too (Alphard, Harrier, Vellfire and Lexus RX are all in the
 * data), which is why this is useful to a used/recon dealer at all. It is NOT
 * a used-car transfer market: an ownership change does not appear.
 *
 * Every number on this page is a registration count. There is no price, margin
 * or valuation in the source, so this page must never state one.
 */

const COLOUR_HEX = {
  grey: '#6b7280', white: '#ffffff', silver: '#cbd5e1', red: '#dc2626',
  black: '#111827', blue: '#2563eb', brown: '#78350f', green: '#16a34a',
  maroon: '#7f1d1d', orange: '#ea580c', gold: '#ca8a04', yellow: '#eab308',
  pink: '#ec4899', beige: '#d6d3d1', purple: '#7c3aed', titanium: '#94a3b8',
};

// The source spells body type in Malay and fuel in snake_case.
const BODY_LABELS = {
  motokar: 'Sedan / Hatchback', jip: 'SUV',
  motokar_pelbagai_utiliti: 'MPV', pick_up: 'Pick-up', window_van: 'Van',
};
const FUEL_LABELS = {
  petrol: 'Petrol', greendiesel: 'Diesel (B7/B10)', electric: 'Electric',
  hybrid_petrol: 'Hybrid', diesel: 'Diesel', hybrid_diesel: 'Hybrid diesel',
  petrol_ng: 'Petrol / NG', greendiesel_ng: 'Diesel / NG',
  diesel_ng: 'Diesel / NG', other: 'Other',
};

const UP = '#059669';
const DOWN = '#dc2626';
const MUTED = '#6b7280';
const INK = '#111827';
const LINE = '#e5e7eb';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(iso) {
  if (!iso) return '';
  const [y, m] = String(iso).split('-');
  return `${MONTH_ABBR[Number(m) - 1] || ''} ${y}`;
}
function fmtInt(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('en-MY') : '—';
}
// Infinity means "no base to compare against" — growth from zero, which is real
// news, not a blank. Null means both sides are zero and there is nothing to say.
function chg(cur, prev) {
  if (!prev && !cur) return null;
  if (!prev) return Infinity;
  return ((cur - prev) / prev) * 100;
}

function Delta({ value, pp = false, small = false }) {
  if (value === null || value === undefined) {
    return <span style={{ color: MUTED, fontSize: small ? 11 : 12 }}>—</span>;
  }
  if (value === Infinity) {
    return (
      <span style={{ color: UP, fontWeight: 600, fontSize: small ? 11 : 12, letterSpacing: '.04em' }}>
        NEW
      </span>
    );
  }
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span style={{
      color: up ? UP : DOWN, fontWeight: 600, fontSize: small ? 11 : 12,
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontVariantNumeric: 'tabular-nums',
    }}>
      <Icon size={small ? 11 : 12} strokeWidth={2.5} />
      {up ? '+' : ''}{value.toFixed(1)}{pp ? 'pp' : '%'}
    </span>
  );
}

/* Inline sparkline. Hand-rolled rather than a chart library: there is one of
   these per row and they must stay cheap. */
function Spark({ series, w = 92, h = 26 }) {
  if (!series || series.length < 2) return <svg width={w} height={h} />;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const step = w / (series.length - 1);
  const y = (v) => h - 3 - ((v - min) / span) * (h - 6);
  const pts = series.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const rising = series[series.length - 1] >= series[0];
  const stroke = rising ? UP : DOWN;
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      <circle cx={w} cy={y(series[series.length - 1])} r="2" fill={stroke} />
    </svg>
  );
}

function Tile({ label, value, sub, delta, deltaPp }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10,
      padding: '10px 12px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
        color: MUTED, fontWeight: 600, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.15,
        fontVariantNumeric: 'tabular-nums', marginTop: 2,
      }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
        {delta !== undefined && <Delta value={delta} pp={deltaPp} small />}
        {sub && <span style={{ fontSize: 11, color: MUTED }}>{sub}</span>}
      </div>
    </div>
  );
}

const SORTS = {
  vol12: (a, b) => b.n12 - a.n12,
  last: (a, b) => b.last - a.last,
  mom: (a, b) => (b.mom === null ? -Infinity : b.mom) - (a.mom === null ? -Infinity : a.mom),
  yoy: (a, b) => (b.yoy === null ? -Infinity : b.yoy) - (a.yoy === null ? -Infinity : a.yoy),
  name: (a, b) => `${a.maker} ${a.model}`.localeCompare(`${b.maker} ${b.model}`),
};

export default function MarketDemandTab({ dealerId }) {
  const [summary, setSummary] = useState(null);
  const [makers, setMakers] = useState([]);
  const [rows, setRows] = useState([]);
  const [stock, setStock] = useState(new Map());
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState('market');     // market | stock
  const [maker, setMaker] = useState('');
  const [body, setBody] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('vol12');

  /* The dealer's own stock, resolved onto canonical model keys with the same
     resolver the marketplace filter uses, so "you hold 3" lines up with the
     JPJ row even though car_listings.model is free text ("ALPHARD 2.5L"). */
  const loadStock = useCallback(async () => {
    if (!dealerId) return;
    const { data, error } = await supabase
      .from('car_listings')
      .select('brand, model, status')
      .eq('dealer_id', dealerId);
    if (error) return;
    const map = new Map();
    (data || []).forEach((l) => {
      if (l.status === 'sold' || !l.brand || !l.model) return;
      const r = canonicalModel(l.brand, l.model);
      if (!r.matched) return;
      const cur = map.get(r.key) || { count: 0, label: `${r.brand} ${r.model}` };
      cur.count += 1;
      map.set(r.key, cur);
    });
    setStock(map);
  }, [dealerId]);

  const loadRows = useCallback(async (keys) => {
    const { data, error } = await supabase.rpc('get_market_models', {
      p_months: 13,
      p_limit: keys ? 400 : 150,
      p_maker: maker || null,
      p_body: body || null,
      p_keys: keys || null,
    });
    if (error) throw error;
    return data || [];
  }, [maker, body]);

  useEffect(() => { loadStock(); }, [loadStock]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const [s, mk] = await Promise.all([
          supabase.rpc('get_market_summary'),
          supabase.rpc('get_market_makers'),
        ]);
        if (s.error) throw s.error;
        if (!alive) return;
        setSummary(s.data?.[0] || null);
        setMakers(mk.data || []);
      } catch (e) {
        if (alive) setErr(e.message || 'Could not load market data');
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  /* Only the stock view depends on the key list, so the signature is empty in
     market view — otherwise the table refetched the moment stock resolved. */
  const stockKeys = useMemo(() => Array.from(stock.keys()).sort(), [stock]);
  const fetchSig = view === 'stock' ? stockKeys.join(',') : '';

  useEffect(() => {
    let alive = true;
    (async () => {
      // "My stock" is only meaningful once the stock map has resolved.
      if (view === 'stock' && fetchSig === '') { setRows([]); setRowsLoading(false); return; }
      setErr('');
      setRowsLoading(true);
      try {
        const data = await loadRows(view === 'stock' ? fetchSig.split(',') : null);
        if (alive) setRows(data);
      } catch (e) {
        if (alive) setErr(e.message || 'Could not load market data');
      }
      if (alive) setRowsLoading(false);
    })();
    return () => { alive = false; };
  }, [view, fetchSig, loadRows]);

  const openDetail = useCallback(async (key) => {
    setSelected(key);
    setDetailLoading(true);
    setDetail(null);
    const { data, error } = await supabase.rpc('get_market_model_detail', {
      p_model_key: key, p_months: 12,
    });
    setDetailLoading(false);
    if (!error) setDetail(data);
  }, []);

  const market12 = Number(summary?.n_12m) || 0;

  const derived = useMemo(() => {
    const out = (rows || []).map((r) => {
      const s = (r.spark || []).map(Number);
      const last = s[s.length - 1] ?? 0;
      const prev = s[s.length - 2] ?? 0;
      const yearAgo = s[0] ?? 0;
      const n12 = Number(r.n_12m) || 0;
      return {
        ...r, s, last, prev, yearAgo, n12,
        mom: chg(last, prev),
        yoy: chg(last, yearAgo),
        share: market12 ? (n12 / market12) * 100 : 0,
        held: stock.get(r.model_key)?.count || 0,
      };
    });
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? out.filter((r) => `${r.maker} ${r.model}`.toLowerCase().includes(needle))
      : out;
    return filtered.sort(SORTS[sort] || SORTS.vol12);
  }, [rows, market12, stock, q, sort]);

  /* Stock the market data cannot speak to. JPJ does not break out M-variants,
     so a BMW M4 sits inside "4 Series" and has no row of its own. Saying that
     is honest; rendering a zero would read as "nobody wants this car". */
  const untracked = useMemo(() => {
    if (view !== 'stock') return [];
    const have = new Set((rows || []).map((r) => r.model_key));
    return Array.from(stock.entries())
      .filter(([k]) => !have.has(k))
      .map(([k, v]) => ({ key: k, ...v }));
  }, [view, rows, stock]);

  const covered = useMemo(() => {
    if (stock.size === 0) return null;
    const have = new Set((rows || []).map((r) => r.model_key));
    if (view === 'stock') return `${have.size} of ${stock.size} models`;
    return `${stock.size} models`;
  }, [stock, rows, view]);

  const th = {
    fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase',
    color: MUTED, fontWeight: 600, padding: '7px 10px', whiteSpace: 'nowrap',
    background: '#f9fafb', borderBottom: `1px solid ${LINE}`,
    position: 'sticky', top: 0, zIndex: 1, cursor: 'pointer', userSelect: 'none',
  };
  const td = {
    padding: '8px 10px', fontSize: 13, color: INK, whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid #f3f4f6`,
  };

  const SortTh = ({ id, children, align = 'right' }) => (
    <th style={{ ...th, textAlign: align, color: sort === id ? INK : MUTED }}
        onClick={() => setSort(id)}>
      {children}{sort === id ? ' ▾' : ''}
    </th>
  );

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-base" style={{ color: INK }}>Market Demand</h2>
        <p className="text-gray-600 text-xs mt-0.5">
          What Malaysia actually registered last month — JPJ open data, matched against your stock
        </p>
      </div>

      {err && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          borderRadius: 8, padding: '8px 12px', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}

      {/* Quote strip */}
      <div style={{
        display: 'grid', gap: 8,
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      }}>
        <Tile
          label={`Registrations · ${monthLabel(summary?.last_month)}`}
          value={loading ? '···' : fmtInt(summary?.n_last)}
          delta={summary ? chg(Number(summary.n_last), Number(summary.n_prev)) : undefined}
          sub="vs prev month"
        />
        <Tile
          label="Same month last year"
          value={loading ? '···' : fmtInt(summary?.n_year_ago)}
          delta={summary ? chg(Number(summary.n_last), Number(summary.n_year_ago)) : undefined}
          sub="year on year"
        />
        <Tile
          label="EV share of market"
          value={loading ? '···' : `${Number(summary?.ev_last_pct ?? 0).toFixed(1)}%`}
          delta={summary
            ? Number(summary.ev_last_pct) - Number(summary.ev_year_ago_pct)
            : undefined}
          deltaPp
          sub="vs last year"
        />
        <Tile
          label="Models tracked"
          value={loading ? '···' : fmtInt(summary?.models_tracked)}
          sub={covered ? `you stock ${covered}` : 'last 12 months'}
        />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden' }}>
          {[['market', 'Whole market'], ['stock', 'My stock']].map(([id, label]) => (
            <button key={id} onClick={() => { setView(id); setSelected(null); setDetail(null); }}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none',
                background: view === id ? INK : '#fff',
                color: view === id ? '#fff' : MUTED, cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 0 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: MUTED }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search model"
            style={{
              width: '100%', padding: '6px 10px 6px 27px', fontSize: 12,
              border: `1px solid ${LINE}`, borderRadius: 8, color: INK, background: '#fff',
            }}
          />
        </div>

        <select value={maker} onChange={(e) => setMaker(e.target.value)}
          style={{ padding: '6px 8px', fontSize: 12, border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: INK }}>
          <option value="">All brands</option>
          {makers.map((m) => <option key={m.maker} value={m.maker}>{m.maker}</option>)}
        </select>

        <select value={body} onChange={(e) => setBody(e.target.value)}
          style={{ padding: '6px 8px', fontSize: 12, border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: INK }}>
          <option value="">All body types</option>
          {Object.entries(BODY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Watchlist */}
        <div style={{
          flex: '1 1 460px', minWidth: 0, background: '#fff',
          border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }} onClick={() => setSort('name')}>Model</th>
                  <SortTh id="last">{monthLabel(summary?.last_month).split(' ')[0] || 'Last'}</SortTh>
                  <SortTh id="mom">MoM</SortTh>
                  <SortTh id="yoy">YoY</SortTh>
                  <SortTh id="vol12">12M</SortTh>
                  <th style={{ ...th, textAlign: 'right', cursor: 'default' }}>Share</th>
                  <th style={{ ...th, textAlign: 'center', cursor: 'default' }}>13M trend</th>
                </tr>
              </thead>
              <tbody>
                {derived.map((r) => {
                  const active = selected === r.model_key;
                  return (
                    <tr key={r.model_key} onClick={() => openDetail(r.model_key)}
                      style={{ cursor: 'pointer', background: active ? '#f9fafb' : '#fff' }}>
                      <td style={{ ...td, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{r.model}</span>
                          {r.held > 0 && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff',
                              border: '1px solid #bfdbfe', borderRadius: 5, padding: '1px 5px',
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                            }}>
                              <Package size={9} />{r.held}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: MUTED }}>{r.maker}</div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmtInt(r.last)}</td>
                      <td style={{ ...td, textAlign: 'right' }}><Delta value={r.mom} small /></td>
                      <td style={{ ...td, textAlign: 'right' }}><Delta value={r.yoy} small /></td>
                      <td style={{ ...td, textAlign: 'right', color: MUTED }}>{fmtInt(r.n12)}</td>
                      <td style={{ ...td, textAlign: 'right', color: MUTED }}>{r.share.toFixed(2)}%</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}><Spark series={r.s} /></div>
                      </td>
                    </tr>
                  );
                })}
                {!rowsLoading && derived.length === 0 && (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: MUTED, padding: 24 }}>
                    {view === 'stock'
                      ? 'None of your listings resolved to a tracked model yet.'
                      : 'No models match these filters.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <DetailPanel detail={detail} loading={detailLoading} />
        </div>
      </div>

      {untracked.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
            Not tracked separately by JPJ
          </div>
          <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
            {untracked.map((u) => u.label).join(', ')} — the source folds these into a
            parent nameplate (an M4 counts as a 4 Series), so there is no separate
            demand line. This is a gap in the data, not zero demand.
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: MUTED, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <RefreshCw size={11} />
        New vehicle registrations from data.gov.my (JPJ). Recon imports count as a first
        registration and do appear; used-car ownership transfers do not.
        {summary?.refreshed_at && ` Last refreshed ${new Date(summary.refreshed_at).toLocaleDateString('en-MY')}.`}
      </div>
    </div>
  );
}

function DetailPanel({ detail, loading }) {
  const card = {
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: 12,
  };
  if (loading) {
    return <div style={{ ...card, color: MUTED, fontSize: 12 }}>Loading…</div>;
  }
  if (!detail) {
    return (
      <div style={{ ...card, color: MUTED, fontSize: 12, lineHeight: 1.6 }}>
        Pick a model to see its 12-month volume, the colours buyers actually
        registered, and the fuel split.
      </div>
    );
  }

  const series = detail.series || [];
  const colours = detail.colours || [];
  const fuels = detail.fuels || [];
  const total = Number(detail.total) || 0;
  const maxN = Math.max(1, ...series.map((s) => Number(s.n)));
  const colourTotal = colours.reduce((a, c) => a + Number(c.n), 0) || 1;
  const fuelTotal = fuels.reduce((a, f) => a + Number(f.n), 0) || 1;

  return (
    <div style={{ ...card }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>
        {detail.maker} {detail.model}
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>
        {fmtInt(total)} registered in the last 12 months
      </div>

      <div style={{
        fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase',
        color: MUTED, fontWeight: 600, marginBottom: 6,
      }}>Monthly volume</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64, marginBottom: 4 }}>
        {series.map((s) => (
          <div key={s.month} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
               title={`${monthLabel(s.month)}: ${fmtInt(s.n)}`}>
            <div style={{
              height: `${Math.max(2, (Number(s.n) / maxN) * 100)}%`,
              background: '#1f2937', borderRadius: '2px 2px 0 0',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUTED, marginBottom: 12 }}>
        <span>{monthLabel(series[0]?.month)}</span>
        <span>{monthLabel(series[series.length - 1]?.month)}</span>
      </div>

      <div style={{
        fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase',
        color: MUTED, fontWeight: 600, marginBottom: 6,
      }}>Colour demand</div>
      <div style={{ marginBottom: 12 }}>
        {colours.slice(0, 8).map((c) => {
          const pct = (Number(c.n) / colourTotal) * 100;
          return (
            <div key={c.colour} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{
                width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                background: COLOUR_HEX[c.colour] || '#9ca3af',
                border: `1px solid ${c.colour === 'white' ? '#d1d5db' : 'rgba(0,0,0,.12)'}`,
              }} />
              <span style={{ fontSize: 12, color: INK, textTransform: 'capitalize', width: 62, flexShrink: 0 }}>
                {c.colour}
              </span>
              <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, minWidth: 0 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: '#374151', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, color: MUTED, width: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase',
        color: MUTED, fontWeight: 600, marginBottom: 6,
      }}>Fuel</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {fuels.map((f) => (
          <span key={f.fuel} style={{
            fontSize: 11, color: INK, background: '#f9fafb',
            border: `1px solid ${LINE}`, borderRadius: 6, padding: '2px 7px',
          }}>
            {FUEL_LABELS[f.fuel] || f.fuel}
            <span style={{ color: MUTED, marginLeft: 5, fontVariantNumeric: 'tabular-nums' }}>
              {((Number(f.n) / fuelTotal) * 100).toFixed(0)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
