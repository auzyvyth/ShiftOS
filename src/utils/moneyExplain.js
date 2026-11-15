// "Click any number and see where it comes from" (owner, 2026-11-15). One function, `explain()`, turns
// a figure on Overview into its parts: a list of rows, biggest first, each with its share, and every
// list adds up to 100%. It reads the SAME per-car rows `ownerMoney()` totals, so a breakdown can never
// disagree with the number that opened it. Pure: no React, no Supabase. `npm run test:moneyexplain`.
//
// A row is { label, sub?, value, kind?, pct?, tone? }. `pct` is the row's share of its section (one
// decimal, largest-remainder rounded so the section adds to exactly 100.0), or null for a row that is a
// sign / result rather than a share (a loss, an overhead line). `kind` is 'rm' (default), 'count' or 'days'.

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Shares of `den` for `values`, in tenths of a percent, rounded so they add to exactly 100.0 whenever
 * the values add up to `den` (largest remainder). Rows that are 0 get 0.
 */
export function shares(values, den) {
  const total = den === undefined ? values.reduce((s, v) => s + v, 0) : den;
  if (!(Math.abs(total) > 0)) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 1000); // tenths of a percent
  const floors = raw.map(Math.floor);
  let left = Math.round(values.reduce((s, v) => s + v, 0) / total * 1000) - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - floors[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && k < order.length * 2; k++, left--) floors[order[k % order.length][1]] += 1;
  return floors.map((f) => f / 10);
}

// A section: rows sorted biggest first, with their shares. `den` defaults to the rows' own total.
function section(heading, rows, { den, sort = true, note } = {}) {
  const list = rows.filter((r) => r != null);
  if (sort) list.sort((a, b) => b.value - a.value);
  const pcts = shares(list.map((r) => r.value), den);
  return { heading, note: note || null, rows: list.map((r, i) => ({ kind: 'rm', pct: pcts[i], ...r })) };
}

function groupBy(rows, keyFn, build) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].map(([k, list]) => build(k, list));
}

const sumOf = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
const lineVal = (r, k) => r.p.lines.find((x) => x.key === k)?.val || 0;
const plural = (c, one, many) => `${c} ${c === 1 ? one : many}`;
const COST_LABEL = { purchase: 'Buy price', recon: 'Recon', holding: 'Holding (days on lot)', ads: 'Advertising', services: 'Included services', commission: 'Commission', transfer: 'Transfer and handover', admin: 'Admin and documents', warranty: 'Warranty reserve' };
const SPEND_NAME = { recon: 'Recon', holding: 'Holding (days on lot)', ads: 'Advertising', commission: 'Commission', transfer: 'Transfer and road tax', admin: 'Admin and documents', warranty: 'Warranty reserve', services: 'Included services' };

/**
 * @param m          the result of ownerMoney()
 * @param periodKey  'week' | 'month' | 'year'
 * @param key        which figure: sales, units, addons, gross, commission, overhead, net, tied, avgdays,
 *                   holding, over60, losing, nocost, stock_brand, or `spend:<line>`
 * @returns { key, title, total, kind, sections, note, empty }
 */
export function explain(m, periodKey, key) {
  const P = m.periods[periodKey] || m.periods.month;
  const cur = P.cur;
  const sold = cur.rowsSold;
  const when = { week: 'this week', month: 'this month', year: 'this year' }[P.kind];
  const stock = m.stock.rows || [];
  const out = (title, total, kind, sections, note) => ({ key, title, total, kind, sections: sections.filter((s) => s.rows.length), note: note || null, empty: sections.every((s) => !s.rows.length) });

  if (key === 'sales') {
    return out(`Sales ${when}`, cur.revenue, 'rm', [
      section('By car', sold.map((r) => ({ label: r.title, sub: r.brokerItems.length ? `Sold through ${r.brokerItems[0].name}` : null, value: r.p.revenue }))),
      section('By brand', groupBy(sold, (r) => r.brand, (k, l) => ({ label: k, sub: plural(l.length, 'car', 'cars'), value: sumOf(l, (r) => r.p.revenue) }))),
    ], 'What the cars sold for. Add-on money is counted separately, under Add-ons.');
  }

  if (key === 'units') {
    const brokerNames = new Map();
    for (const r of sold) {
      if (!r.brokerItems.length && !(r.brokerCommission > 0)) continue;
      const name = r.brokerItems[0]?.name || 'A broker';
      brokerNames.set(name, (brokerNames.get(name) || 0) + 1);
    }
    const viaBrokers = [...brokerNames.values()].reduce((s, v) => s + v, 0);
    return out(`Cars sold ${when}`, cur.units, 'count', [
      section('Who sold them', [
        ...[...brokerNames.entries()].map(([name, count]) => ({ label: name, sub: 'Broker', value: count, kind: 'count' })),
        cur.units - viaBrokers > 0 ? { label: 'Your team and direct sales', value: cur.units - viaBrokers, kind: 'count' } : null,
      ]),
      section('By brand', groupBy(sold, (r) => r.brand, (k, l) => ({ label: k, value: l.length, kind: 'count' }))),
    ]);
  }

  if (key === 'addons') {
    const items = new Map();
    for (const r of sold) for (const it of r.addonItems) {
      const x = items.get(it.name) || { rev: 0, cost: 0, count: 0 };
      x.rev += n(it.rev); x.cost += n(it.cost); x.count += 1;
      items.set(it.name, x);
    }
    return out(`Add-ons ${when}`, cur.addonRevenue, 'rm', [
      section('Which add-ons earn the most', [...items.entries()].map(([name, x]) => ({
        label: name,
        sub: `${plural(x.count, 'sold', 'sold')} · profit ${Math.round(x.rev - x.cost).toLocaleString('en-MY')} after cost`,
        value: x.rev,
      }))),
    ], 'Add-ons sold with the cars sold in this period (tint, warranty, insurance and the rest).');
  }

  if (key === 'gross') {
    const costed = sold.filter((r) => !r.costMissing);
    const den = sumOf(costed, (r) => r.p.revenue + r.addonRevenue);
    const costRows = ['purchase', 'recon', 'holding', 'ads', 'services', 'commission', 'transfer', 'admin', 'warranty']
      .map((k) => ({ label: COST_LABEL[k], value: sumOf(costed, (r) => lineVal(r, k)) }))
      .filter((x) => x.value > 0);
    const addonCost = sumOf(costed, (r) => r.addonRevenue - r.p.back);
    if (addonCost > 0) costRows.push({ label: 'Add-on costs', value: addonCost });
    const grossRow = { label: 'Gross profit', value: cur.gross, tone: cur.gross >= 0 ? 'good' : 'bad' };
    const rows = [...costRows.sort((a, b) => b.value - a.value), grossRow];
    const pcts = shares(rows.map((r) => r.value), den);
    // Each car's share of the gross only means something while the gross is a profit; a loss has no 100%.
    const byCar = section('By car', costed.map((r) => ({ label: r.title, sub: r.p.margin == null ? null : `${r.p.margin.toFixed(1)}% margin`, value: r.p.net, tone: r.p.net < 0 ? 'bad' : null })), { den: cur.gross > 0 ? cur.gross : undefined });
    if (!(cur.gross > 0)) byCar.rows.forEach((r) => { r.pct = null; });
    return out(`Gross profit ${when}`, cur.gross, 'rm', [
      { heading: 'Where each RM 100 of sales went', note: null, rows: rows.map((r, i) => ({ kind: 'rm', pct: pcts[i], ...r })) },
      byCar,
    ], cur.leftOut > 0 ? `${plural(cur.leftOut, 'sold car is', 'sold cars are')} left out because the buy price is missing.` : 'Cars sold with a buy price entered. Commission here includes what brokers are owed.');
  }

  if (key === 'commission') {
    const brokers = new Map();
    for (const r of sold) for (const it of r.brokerItems) {
      const x = brokers.get(it.name) || { amount: 0, paid: 0, owed: 0, cars: 0 };
      x.amount += n(it.amount); x.cars += 1;
      if (it.paid) x.paid += n(it.amount); else x.owed += n(it.amount);
      brokers.set(it.name, x);
    }
    const teamRows = cur.teamCommission > 0 ? [{ label: 'Your salesmen', sub: 'Commission set on each car', value: cur.teamCommission }] : [];
    return out(`Commission ${when}`, cur.commission, 'rm', [
      section('Who it goes to', [
        ...teamRows,
        ...[...brokers.entries()].map(([name, x]) => ({ label: name, sub: `Broker · ${plural(x.cars, 'car', 'cars')} · ${x.owed > 0 ? `RM ${Math.round(x.owed).toLocaleString('en-MY')} still owed` : 'all paid'}`, value: x.amount })),
      ]),
      section('By car', sold.filter((r) => lineVal(r, 'commission') > 0).map((r) => ({ label: r.title, sub: r.brokerCommission > 0 ? 'Includes a broker' : null, value: lineVal(r, 'commission') }))),
    ], 'Cars sold in this period. A broker is counted only after you approved the sale.');
  }

  if (key === 'overhead') {
    return out(`Overhead ${when}`, P.overhead, 'rm', [
      section('How it is counted', [{ label: 'Monthly overhead (Settings, Costs)', sub: 'Rent, salaries and the rest, spread by the day', value: P.overhead }]),
    ], 'It is a monthly bill, not a cost on one car, so it is counted by the day and taken off the gross profit.');
  }

  if (key === 'net') {
    return out(`After overhead ${when}`, P.net, 'rm', [
      { heading: 'How it adds up', note: null, rows: [
        { kind: 'rm', label: 'Gross profit', value: cur.gross, pct: null },
        { kind: 'rm', label: 'Overhead', value: -P.overhead, pct: null, tone: P.overhead > 0 ? 'bad' : null },
        { kind: 'rm', label: 'What is left', value: P.net, pct: null, tone: P.net >= 0 ? 'good' : 'bad' },
      ] },
    ]);
  }

  if (key.startsWith('spend:')) {
    const k = key.slice(6);
    const costed = sold.filter((r) => !r.costMissing);
    const total = (cur.spend.find((x) => x.key === k) || {}).val || 0;
    return out(`${SPEND_NAME[k] || k} ${when}`, total, 'rm', [
      section('By car', costed.filter((r) => lineVal(r, k) > 0).map((r) => ({ label: r.title, value: lineVal(r, k) }))),
    ], 'Costs of the cars sold in this period that have a buy price entered.');
  }

  // ── stock: what is on the lot right now (not tied to a period) ──
  const costedStock = stock.filter((r) => !r.costMissing);
  if (key === 'tied') {
    return out('Money tied up in stock', m.stock.atCost, 'rm', [
      section('By car', costedStock.map((r) => ({ label: r.title, sub: r.p.days == null ? null : `${r.p.days} days on the lot`, value: r.cost }))),
    ], m.stock.noCost > 0 ? `${plural(m.stock.noCost, 'car has', 'cars have')} no buy price yet, so ${m.stock.noCost === 1 ? 'it is' : 'they are'} left out.` : 'Buy price plus recon, for the cars in stock.');
  }
  if (key === 'avgdays') {
    const known = stock.filter((r) => r.p.days != null);
    const bucket = (r) => (r.p.days <= 30 ? '0 to 30 days' : r.p.days <= 60 ? '31 to 60 days' : r.p.days <= 90 ? '61 to 90 days' : 'Over 90 days');
    const order = ['0 to 30 days', '31 to 60 days', '61 to 90 days', 'Over 90 days'];
    return out('Average days in stock', m.stock.avgDays ?? 0, 'days', [
      section('How long the cars have been here', groupBy(known, bucket, (k, l) => ({ label: k, value: l.length, kind: 'count', sub: plural(l.length, 'car', 'cars') })).sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)), { sort: false }),
    ], 'Counted from the day each car was added.');
  }
  if (key === 'holding') {
    return out('Holding cost per day', m.stock.perDay, 'rm', [
      section('By car', stock.filter((r) => r.p.perDay.total > 0).map((r) => ({ label: r.title, sub: r.p.days == null ? null : `${r.p.days} days on the lot`, value: r.p.perDay.total }))),
    ], 'Floor-plan interest plus a share of the monthly overhead, for each car standing on the lot.');
  }
  if (key === 'over60') {
    const old = stock.filter((r) => (r.p.days || 0) > 60);
    return out('Over 60 days in stock', old.length, 'count', [
      section('Oldest first, by money tied up', old.filter((r) => !r.costMissing).sort((a, b) => b.p.days - a.p.days).map((r) => ({ label: r.title, sub: `${r.p.days} days`, value: r.cost })), { sort: false }),
    ], 'Share is each car\'s part of the money tied up in these cars.');
  }
  if (key === 'losing') {
    const lose = costedStock.filter((r) => r.p.revenue > 0 && r.p.net < 0);
    return out('Losing money at the asking price', lose.length, 'count', [
      { heading: 'Cars that lose money if sold today', note: null, rows: lose.sort((a, b) => a.p.net - b.p.net).map((r) => ({ kind: 'rm', label: r.title, sub: `Asking RM ${Math.round(r.p.revenue).toLocaleString('en-MY')}`, value: r.p.net, pct: null, tone: 'bad' })) },
    ]);
  }
  if (key === 'nocost') {
    const none = stock.filter((r) => r.costMissing);
    return out('No buy price yet', none.length, 'count', [
      section('Add the buy price so their profit counts', none.map((r) => ({ label: r.title, sub: 'Asking price', value: r.p.revenue || 0 })), { note: null }),
    ]);
  }
  if (key === 'stock_brand') {
    return out('Active listings', stock.length, 'count', [
      section('By brand', groupBy(stock, (r) => r.brand, (k, l) => ({ label: k, value: l.length, kind: 'count' }))),
    ]);
  }
  return out('Details', 0, 'rm', []);
}

/** A plain count split into rows (open leads by stage or source). Rows add to 100%. */
export function explainCounts(key, title, total, groups, note) {
  return { key, title, total, kind: 'count', note: note || null, empty: !groups.length, sections: groups.filter((g) => g.rows.length).map((g) => section(g.heading, g.rows.map((r) => ({ kind: 'count', ...r })))) };
}
