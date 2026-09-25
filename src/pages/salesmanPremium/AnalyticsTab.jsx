import React, { useState } from "react";
import {
  BarChart2, Plus, TrendingUp, ChevronDown, ChevronUp, ChevronRight, Target,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { panel as C, panelType as T, panelRadius as R } from "../../theme/tokens";
import ChannelBreakdown from "../../components/ChannelBreakdown";
import { CARD, CARD_HEADER, EYEBROW, STAT, SOFT, SubTabs } from "./shared";
import useStageHistory from "../../hooks/useStageHistory";
import { buildSalesPerformance, formatDuration, sourceLabel } from "../../utils/salesPerformance";

// Performance tab.
//
// Two halves, because "performance" was answering only one of the two questions
// a rep has. They are sibling sub-views rather than one long scroll:
//
//   Selling  — how am I converting? Funnel drop-off, reply speed, why deals
//              die, which sources are worth the hour. All of it derived from
//              `leads` + stage history in src/utils/salesPerformance.js.
//   Listings — how are my cars performing? The traffic metrics this tab used
//              to be, unchanged.
//
// Everything in Selling is new. Premium previously showed marketing traffic and
// nothing else, so the paid tier could say less about a rep's actual selling
// than Salesman Lite could. What it deliberately does NOT do is list who to
// call — "This week" on the dashboard owns that, and a second call list here
// would just be the same names in a worse place.
//
// Colour rule: grey by default, red ONLY for the one thing to fix (weakest
// funnel step, a low tap-through). Green/red appear on a signed trend and
// nowhere else. Every number used to carry a green/amber/red verdict plus blue
// bars, so nothing stood out. Order is "what to fix" first, then the numbers
// behind it, with the supporting detail folded under "More detail".
export default function AnalyticsTab({
 carStatsMap, enquiries, thisMonthSales, commission, soldCount, myListings,
 channelMap, commissionDetails, isMobile, onAddListing, leads = [], onOpenTab,
 minipageStats = { visits: 0, cardClicks: 0, byChannel: [] },
}) {
  const [sub, setSub] = useState("selling");
  // Which slice of "where did my traffic come from" is on screen. Car pages and
  // the mini page are two different journeys — a tap from an Instagram bio link
  // lands on the mini page, a shared listing link lands on a car — so they are
  // shown apart as well as together rather than silently summed into one bar.
  const [trafficView, setTrafficView] = useState("all");
  const [openInsights, setOpenInsights] = useState(() => new Set());
  const [showDetail, setShowDetail] = useState(false);
  const toggleInsight = (key) => setOpenInsights((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const leadIds = leads.map((l) => l.id);
  const { rows: stageRows, loading: historyLoading, error: historyError } = useStageHistory(leadIds);
  const perf = buildSalesPerformance(leads, stageRows);

  // Area chart with a gradient fill, same shape as the Dashboard tab's traffic
  // and commission charts, so the two tabs read as one product. The old version
  // was a hand-rolled SVG polyline with a neon drop-shadow on a 40px canvas —
  // at that height the glow was most of what you saw.
  // `id` must be unique per rendered chart: several metrics share one hue, and
  // two <linearGradient> defs with the same id is a duplicate DOM id.
  const Spark = ({ data, hue, id }) => {
    const rows = (data || []).map((v, i) => ({ i, v }));
    if (!rows.length || rows.every((r) => r.v === 0)) {
      return <div style={{ height: 46, marginTop: 8 }} />;
    }
    const gid = `sparkFill-${id}`;
    return (
      <div style={{ height: 46, margin: "8px -4px -4px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hue} stopOpacity={0.28} />
                <stop offset="100%" stopColor={hue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone" dataKey="v" stroke={hue} strokeWidth={1.75}
              fill={`url(#${gid})`} dot={false} isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const bucketArr7 = (arr) => {
    const b = Array(7).fill(0);
    const now = Date.now();
    (arr || []).forEach((e) => {
      const d = Math.floor((now - new Date(e.created_at).getTime()) / 86400000);
      if (d >= 0 && d < 7) b[6 - d] += 1;
    });
    return b;
  };

  // Daily views summed across every car (d0 = 6 days ago → d6 = today).
  const viewsD = Array(7).fill(0).map((_, i) =>
    Object.values(carStatsMap).reduce((s, v) => s + (v.daily?.[i] || 0), 0),
  );
  const enqD = bucketArr7(enquiries);
  const totalViews = Object.values(carStatsMap).reduce((s, v) => s + (v.views || 0), 0);
  const totalWA = Object.values(carStatsMap).reduce((s, v) => s + (v.enquiries || 0), 0);
  const cvrNum = totalViews > 0 ? (totalWA / totalViews) * 100 : 0;
  const cvr = totalViews > 0 ? cvrNum.toFixed(1) : null;

  // The one place a traffic number is allowed a colour: it's a verdict, not a
  // category. Below 5% of viewers tapping through is a listing problem.
  // Only a LOW rate is flagged: it is the one reading that asks for action.
  const cvrLow = totalViews >= 20 && cvrNum < 5;

  const money = (n) => `RM ${Number(n || 0).toLocaleString("en-MY")}`;

  // Sparklines are grey: they show a shape, not a verdict.
  const TRAFFIC_HUE = C.textMuted;

  const Metric = ({ label, value, sub: subLabel, data, hue, badge, id }) => (
    <div style={{ ...CARD, padding: "14px 16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={EYEBROW}>{label}</span>
        {badge}
      </div>
      <p style={{ ...STAT, margin: "6px 0 0", fontSize: isMobile ? T.size.stat : T.size.statLg, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      {subLabel && <p style={{ margin: "3px 0 0", fontSize: T.size.sm, color: C.textMuted }}>{subLabel}</p>}
      {data && <Spark data={data} hue={hue || TRAFFIC_HUE} id={id} />}
    </div>
  );

  const hasListings = myListings.length > 0;

  // Car-page traffic by platform, summed across every car.
  const carChannelRows = Object.values(channelMap).flat();
  // Mini-page traffic by platform. The RPC calls them visits/card_clicks; they
  // are the same two ideas as views/enquiries, so they are renamed once here
  // rather than teaching ChannelBreakdown a second row shape.
  const miniChannelRows = (minipageStats.byChannel || []).map((r) => ({
    channel: r.channel,
    views: Number(r.visits) || 0,
    enquiries: Number(r.card_clicks) || 0,
  }));
  const TRAFFIC_VIEWS = [
    { key: "all", label: "All" },
    { key: "cars", label: "Car pages" },
    { key: "minipage", label: "Mini page" },
  ];
  // ChannelBreakdown already sums duplicate channels, so "All" is a plain
  // concat — no need to merge by hand.
  const trafficRows = trafficView === "cars" ? carChannelRows
    : trafficView === "minipage" ? miniChannelRows
    : [...carChannelRows, ...miniChannelRows];

  // A card that cannot say anything useful yet says WHAT unlocks it, rather
  // than drawing an empty chart or a row of zeroes.
  const NotYet = ({ children }) => (
    <p style={{ margin: 0, padding: "18px", fontSize: T.size.base, color: C.textMuted, lineHeight: 1.6 }}>
      {children}
    </p>
  );

  // Tabular figures on every number that changes, so a column of them does
  // not wobble (DASHBOARD_DESIGN.md §3).
  const NUM = { fontVariantNumeric: "tabular-nums" };

  // One row shape for every list on this tab: name + a muted detail line on
  // the left, one number on the right. It replaces the fixed-width column
  // grids that pushed four numbers across a 375px phone.
  const Row = ({ label, detail, value, valueColor, last }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 18px", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: T.size.base, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
        {detail && <p style={{ ...NUM, margin: "2px 0 0", fontSize: T.size.sm, color: C.textMuted }}>{detail}</p>}
      </div>
      <span style={{ ...NUM, flexShrink: 0, fontSize: T.size.base, fontWeight: T.weight.bold, color: valueColor || C.text }}>{value}</span>
    </div>
  );

  const Bar = ({ pct, hue }) => (
    <div style={{ height: 6, borderRadius: R.pill, background: C.fill, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: hue, borderRadius: R.pill }} />
    </div>
  );

  // Neutral bar colour. Red is kept for the one thing the rep should fix, so
  // it only means something if nothing else on the page is coloured.
  const BAR = C.textMuted;

  const renderSelling = () => {
    const { funnel, speed, loss, sources, closeRate, insights } = perf;

    if (!perf.hasLeads) {
      return (
        <div style={{ ...CARD, padding: "22px 20px", textAlign: "center" }}>
          <Target size={20} color={C.textMuted} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>
            No leads to analyse yet
          </p>
          <p style={{ margin: "4px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.5 }}>
            Once buyers start coming in, this page shows where in your process deals are being lost — and what to change.
          </p>
        </div>
      );
    }

    const [focus, ...rest] = insights;
    const others = rest.slice(0, 2);
    const funnelTop = funnel.rows[0]?.reached || 1;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── 1. The one thing to fix. Insights are already ranked most costly
            first (buildInsights), so the top one is shown open with its action
            and the next two sit underneath, collapsed. ── */}
        <div style={CARD}>
          <div style={{ padding: isMobile ? "16px" : "18px 20px" }}>
            <p style={{ ...EYEBROW, margin: 0 }}>{focus.tone === "good" ? "Where you stand" : "Fix this first"}</p>
            <p style={{ ...NUM, margin: "8px 0 0", fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text, lineHeight: 1.35 }}>
              {focus.title}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: T.size.base, color: C.textSec, lineHeight: 1.6 }}>{focus.body}</p>
            {focus.cta && onOpenTab && (
              <button
                onClick={() => onOpenTab(focus.ctaTab)}
                style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, fontSize: T.size.base, fontWeight: T.weight.bold, padding: "9px 16px", borderRadius: R.md, background: C.accent, border: "none", color: C.onAccent, cursor: "pointer", fontFamily: "inherit" }}
              >
                {focus.cta} <ChevronRight size={14} />
              </button>
            )}
          </div>
          {others.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.line}` }}>
              <p style={{ ...EYEBROW, margin: 0, padding: "12px 18px 4px" }}>Also worth a look</p>
              {others.map((ins, i) => {
                const open = openInsights.has(ins.key);
                return (
                  <div key={ins.key} style={{ borderBottom: i < others.length - 1 ? `1px solid ${C.line}` : "none" }}>
                    <button
                      onClick={() => toggleInsight(ins.key)}
                      aria-expanded={open}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                    >
                      <span style={{ ...NUM, flex: 1, minWidth: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>{ins.title}</span>
                      {open
                        ? <ChevronUp size={15} style={{ color: C.textMuted, flexShrink: 0 }} />
                        : <ChevronDown size={15} style={{ color: C.textMuted, flexShrink: 0 }} />}
                    </button>
                    {open && (
                      <div style={{ padding: "0 18px 13px" }}>
                        <p style={{ margin: 0, fontSize: T.size.base, color: C.textSec, lineHeight: 1.6 }}>{ins.body}</p>
                        {ins.cta && onOpenTab && (
                          <button
                            onClick={() => onOpenTab(ins.ctaTab)}
                            style={{ marginTop: 10, fontSize: T.size.sm, fontWeight: T.weight.semibold, padding: "6px 12px", borderRadius: R.sm, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, color: C.textSec, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            {ins.cta}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 2. Close rate: one number, its trend, and the counts behind it
            on one line. It used to be four equal tiles, each in its own colour. ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>Close rate</span>
            <span style={{ fontSize: T.size.xs, fontWeight: T.weight.normal, letterSpacing: 0, textTransform: "none", color: C.textDim }}>
              All time
            </span>
          </div>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ ...STAT, ...NUM, fontSize: T.size.statLg }}>
                {closeRate.rate !== null ? `${closeRate.rate}%` : "—"}
              </span>
              {closeRate.trend !== null && (
                <span style={{ ...NUM, fontSize: T.size.sm, fontWeight: T.weight.semibold, color: closeRate.trend >= 0 ? C.successText : C.dangerText }}>
                  {closeRate.trend >= 0 ? "+" : "−"}{Math.abs(closeRate.trend)} pts
                  <span style={{ fontWeight: T.weight.normal, color: C.textMuted }}> last 30 days ({closeRate.current}% vs {closeRate.previous}%)</span>
                </span>
              )}
            </div>
            <p style={{ ...NUM, margin: "8px 0 0", fontSize: T.size.sm, color: C.textMuted }}>
              {closeRate.won} won · {closeRate.lost} lost · {closeRate.total} leads in total. Only won and lost deals count, so open leads do not drag it down.
            </p>
          </div>
        </div>

        {/* ── 3. Funnel. Grey bars; the weakest step is the only red thing. ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>Where deals stop</span>
            <span style={{ fontSize: T.size.xs, fontWeight: T.weight.normal, letterSpacing: 0, textTransform: "none", color: C.textDim }}>
              Furthest stage reached
            </span>
          </div>
          {historyError ? (
            <NotYet>
              Could not load stage history, so this funnel would blame the wrong step. Reload the tab to try again.
            </NotYet>
          ) : (
            <div style={{ padding: "6px 18px 14px" }}>
              {funnel.rows.map((row) => {
                const isWeak = funnel.weakest?.stage === row.stage;
                const pct = Math.round((row.reached / funnelTop) * 100);
                return (
                  <div key={row.stage} style={{ padding: "8px 0" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: T.size.base, color: C.text, fontWeight: isWeak ? T.weight.semibold : T.weight.normal, minWidth: 0 }}>
                        {row.label}
                        {isWeak && (
                          <span style={{ marginLeft: 8, fontSize: T.size.xs, fontWeight: T.weight.bold, color: C.dangerText, textTransform: "uppercase", letterSpacing: T.track.label }}>
                            Weakest
                          </span>
                        )}
                      </span>
                      <span style={{ ...NUM, fontSize: T.size.base, fontWeight: T.weight.bold, color: C.text, flexShrink: 0 }}>
                        {row.reached}
                      </span>
                    </div>
                    <Bar pct={pct} hue={isWeak ? C.danger : BAR} />
                    {row.dropOffPct !== null && row.lostHere > 0 && (
                      <p style={{ ...NUM, margin: "5px 0 0", fontSize: T.size.sm, color: isWeak ? C.dangerText : C.textMuted }}>
                        {row.lostHere} stopped here ({row.dropOffPct}%)
                      </p>
                    )}
                  </div>
                );
              })}
              <p style={{ margin: "8px 0 0", fontSize: T.size.sm, color: C.textDim, lineHeight: 1.5 }}>
                {historyLoading
                  ? "Loading stage history…"
                  : "A lost deal counts at the stage it actually reached, not where it ended up."}
              </p>
            </div>
          )}
        </div>

        {/* ── 4. Supporting detail, folded away. Reply speed, loss reasons and
            lead sources explain the number above; they are not what the rep
            opened the tab for, so they no longer compete with it. ── */}
        <button
          onClick={() => setShowDetail((v) => !v)}
          aria-expanded={showDetail}
          style={{ ...CARD, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 18px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
        >
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>More detail</span>
            <span style={{ display: "block", marginTop: 2, fontSize: T.size.sm, color: C.textMuted }}>Reply speed, why deals are lost, lead sources</span>
          </span>
          {showDetail ? <ChevronUp size={16} color={C.textMuted} /> : <ChevronDown size={16} color={C.textMuted} />}
        </button>

        {showDetail && (
          <>
            <div style={CARD}>
              <div style={CARD_HEADER}><span>Reply speed</span></div>
              {speed.tracked === 0 ? (
                <NotYet>
                  No first-reply times recorded yet. Messaging a buyer from inside the app — the WhatsApp button on a lead, or a logged call — stamps when you first got back to them, and this card then shows what replying faster is worth.
                </NotYet>
              ) : (
                <>
                  <Row label="Typical first reply" detail={`Median across ${speed.tracked} leads`} value={formatDuration(speed.medianMins)} />
                  <Row
                    label="Answered within 1 hour"
                    detail={speed.fast.settled ? `Closed ${speed.fast.won} of ${speed.fast.settled}` : "None settled yet"}
                    value={speed.fast.closeRate !== null ? `${speed.fast.closeRate}%` : "—"}
                  />
                  <Row
                    label="Answered later"
                    detail={speed.slow.settled ? `Closed ${speed.slow.won} of ${speed.slow.settled}` : "None settled yet"}
                    value={speed.slow.closeRate !== null ? `${speed.slow.closeRate}%` : "—"}
                    last={speed.coverage >= 100}
                  />
                  {speed.coverage < 100 && (
                    <p style={{ margin: 0, padding: "10px 18px", fontSize: T.size.sm, color: C.textDim }}>
                      Based on the {speed.coverage}% of your leads that have a first reply recorded.
                    </p>
                  )}
                </>
              )}
            </div>

            <div style={CARD}>
              <div style={CARD_HEADER}><span>Why deals are lost</span></div>
              {loss.lostTotal === 0 ? (
                <NotYet>Nothing marked lost yet. Closing dead leads as lost — with a reason — is what fills this in.</NotYet>
              ) : (
                <div style={{ padding: "6px 18px 14px" }}>
                  {loss.rows.map((row) => (
                    <div key={row.reason} style={{ padding: "8px 0" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                        <span style={{ fontSize: T.size.base, color: row.recorded ? C.text : C.textDim, minWidth: 0 }}>{row.reason}</span>
                        <span style={{ ...NUM, fontSize: T.size.base, fontWeight: T.weight.bold, color: C.text, flexShrink: 0 }}>
                          {row.count} <span style={{ fontSize: T.size.sm, fontWeight: T.weight.normal, color: C.textMuted }}>({row.pct}%)</span>
                        </span>
                      </div>
                      <Bar pct={row.pct} hue={row.recorded ? BAR : C.textDim} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span>Lead sources</span>
                <span style={{ fontSize: T.size.xs, fontWeight: T.weight.normal, letterSpacing: 0, textTransform: "none", color: C.textDim }}>
                  Close rate
                </span>
              </div>
              {sources.rows.map((row, idx) => (
                <Row
                  key={row.source}
                  label={sourceLabel(row.source)}
                  detail={`${row.total} lead${row.total === 1 ? "" : "s"}${row.valueWon ? ` · ${money(row.valueWon)} won` : ""}`}
                  value={row.closeRate !== null ? `${row.closeRate}%` : "—"}
                  valueColor={row.closeRate === null ? C.textDim : undefined}
                  last={idx === sources.rows.length - 1}
                />
              ))}
              <p style={{ margin: 0, padding: "10px 18px", borderTop: `1px solid ${C.line}`, fontSize: T.size.sm, color: C.textDim, lineHeight: 1.5 }}>
                Close rate counts settled deals only, so a source with leads still open is not punished for them.
              </p>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderListings = () => (
    <div>
      {/* Traffic */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        {/* "All time" was wrong on these three: get_salesman_analytics defaults
            to a rolling `now() - 30 days` cutoff and the caller passes none, so
            the numbers have always been last-30-days. The channel breakdown
            below IS all-time, which is why the two never reconciled. */}
        <Metric label="Listing views" value={totalViews} sub="Last 30 days" data={viewsD} id="views" />
        <Metric label="WhatsApp taps" value={totalWA} sub="Last 30 days" />
        <Metric
          label="Tap-through"
          value={cvr !== null ? `${cvr}%` : "—"}
          sub="Taps per view"
          badge={cvrLow && (
            <span style={{ ...SOFT(C.danger), fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "2px 7px", borderRadius: R.pill }}>
              Low
            </span>
          )}
        />
        <Metric label="Enquiries" value={enquiries.length} sub="All messages" data={enqD} id="enq" />
      </div>

      {/* Nothing listed yet — every number above is a zero and no chart can
          have anything in it. Say the one thing that changes that. */}
      {!hasListings && (
        <div style={{ ...CARD, padding: "22px 20px", marginBottom: 12, textAlign: "center" }}>
          <TrendingUp size={20} color={C.textMuted} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>
            No traffic to report yet
          </p>
          <p style={{ margin: "4px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.5 }}>
            List your stock and this page fills in on its own — views, tap-through and where buyers came from.
          </p>
          {onAddListing && (
            <button
              onClick={onAddListing}
              style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, fontSize: T.size.base, fontWeight: T.weight.bold, padding: "9px 16px", borderRadius: R.md, background: C.accent, border: "none", color: C.onAccent, cursor: "pointer", fontFamily: "inherit" }}
            >
              <Plus size={14} /> Add a listing
            </button>
          )}
        </div>
      )}

      {hasListings && (
        <div style={{ ...CARD, marginBottom: 12 }}>
          <div style={CARD_HEADER}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <BarChart2 size={13} /> Tap-through by car
            </span>
            {/* Same rolling window as the tiles above — this table reads the
                same carStatsMap, so it was mislabelled for the same reason. */}
            <span style={{ fontSize: T.size.xs, fontWeight: T.weight.normal, letterSpacing: 0, textTransform: "none", color: C.textDim }}>
              Last 30 days
            </span>
          </div>
          {/* Most-viewed first. Rows, not a 4-column grid, so a phone never
              squeezes three number columns beside a car name. */}
          {[...myListings]
            .sort((a, b) => (carStatsMap[b.id]?.views || 0) - (carStatsMap[a.id]?.views || 0))
            .map((car, idx, arr) => {
              const s = carStatsMap[car.id] ?? {};
              const v = s.views || 0;
              const w = s.enquiries || 0;
              const rate = v > 0 ? (w / v) * 100 : null;
              const low = v >= 20 && rate !== null && rate < 5;
              return (
                <Row
                  key={car.id}
                  label={[car.year, car.brand, car.model].filter(Boolean).join(" ")}
                  detail={`${v} view${v === 1 ? "" : "s"} · ${w} WhatsApp tap${w === 1 ? "" : "s"}`}
                  value={rate !== null ? `${rate.toFixed(1)}%` : "—"}
                  valueColor={low ? C.dangerText : rate === null ? C.textDim : undefined}
                  last={idx === arr.length - 1}
                />
              );
            })}
        </div>
      )}

      {/* Where the traffic actually came from. Two sources, shown apart and
          together: car listing pages (a shared car link) and the mini page
          (xdrive.my/s/<slug> — the Instagram/TikTok bio link). The Analytics
          tab previously showed only the car half, so every visit that arrived
          through a bio link was invisible here even though the dashboard
          already had the numbers. */}
      {(carChannelRows.length > 0 || miniChannelRows.length > 0) && (
        <div style={{ ...CARD, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={EYEBROW}>Traffic by platform</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TRAFFIC_VIEWS.map(({ key, label }) => {
                const on = trafficView === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTrafficView(key)}
                    style={{
                      fontSize: T.size.sm, fontWeight: T.weight.semibold, padding: "4px 10px",
                      borderRadius: R.pill, cursor: "pointer", fontFamily: "inherit",
                      background: on ? C.fillStrong : "transparent",
                      border: `1px solid ${on ? C.borderStrong : C.border}`,
                      color: on ? C.text : C.textMuted,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <ChannelBreakdown
            rows={trafficRows}
            metric="views"
            title=""
            viewsLabel={trafficView === "minipage" ? "visits" : "views"}
            enquiriesLabel={trafficView === "minipage" ? "clicks" : "WA"}
            emptyHint={
              trafficView === "minipage"
                ? "No mini-page visits attributed yet — share your profile link with the buttons in Listings to tag them."
                : "No attributed traffic yet — share a listing with the share menu to start tracking."
            }
          />
          <p style={{ margin: "10px 0 0", fontSize: T.size.sm, color: C.textDim, lineHeight: 1.5 }}>
            A platform only shows up when the visit arrived through a tagged share link. Everything else counts as Direct.
          </p>
        </div>
      )}

      {commissionDetails.length > 0 && (
        <div style={CARD}>
          <div style={CARD_HEADER}><span>Recent sales</span></div>
          {commissionDetails.map((c, i) => (
            <div
              key={i}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < commissionDetails.length - 1 ? `1px solid ${C.line}` : "none" }}
            >
              <span style={{ fontSize: T.size.base, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[c.year, c.brand, c.model].filter(Boolean).join(" ")}
              </span>
              <span style={{ flexShrink: 0, fontSize: T.size.base, fontWeight: T.weight.bold, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                +{money(c.commission_amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: T.size.xl, fontWeight: T.weight.bold, color: C.text, letterSpacing: T.track.tight }}>
          Performance
        </p>
        <span style={{ fontSize: T.size.sm, color: C.textMuted }}>
          {sub === "selling" ? "Based on every lead you have worked" : "Charts show the last 7 days"}
        </span>
      </div>

      {/* Sales first — it is the number the rep actually came for, and it is
          true of both halves, so it sits above the switcher. */}
      {/* On a phone the three figures wrapped into a ragged 2+1 grid of equal
          weight. Commission is the headline; the two counts ride on one line.
          Commission is ALL TIME (every sold car, SalesmanPremium.jsx
          refreshSales), so it is labelled that way. */}
      <div style={{ ...CARD, padding: isMobile ? "16px" : "18px 20px", marginBottom: 12, fontVariantNumeric: "tabular-nums" }}>
        {isMobile ? (
          <>
            <p style={{ ...EYEBROW, margin: 0 }}>Commission, all time</p>
            <p style={{ ...STAT, margin: "6px 0 0", fontSize: T.size.hero }}>
              {commission !== null ? money(commission) : "—"}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: T.size.base, color: C.textSec }}>
              <b style={{ color: C.text }}>{thisMonthSales}</b> sold this month · <b style={{ color: C.text }}>{soldCount}</b> all time
            </p>
          </>
        ) : (
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            <div>
              <p style={{ ...EYEBROW, margin: 0 }}>Commission, all time</p>
              <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.hero }}>
                {commission !== null ? money(commission) : "—"}
              </p>
            </div>
            <div>
              <p style={{ ...EYEBROW, margin: 0 }}>This month</p>
              <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.hero }}>
                {thisMonthSales}
                <span style={{ fontSize: T.size.base, fontWeight: T.weight.normal, color: C.textMuted, marginLeft: 6 }}>sold</span>
              </p>
            </div>
            <div>
              <p style={{ ...EYEBROW, margin: 0 }}>All time</p>
              <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.hero }}>
                {soldCount}
                <span style={{ fontSize: T.size.base, fontWeight: T.weight.normal, color: C.textMuted, marginLeft: 6 }}>cars</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <SubTabs
        value={sub}
        onChange={setSub}
        items={[
          { key: "selling", label: "Selling" },
          { key: "listings", label: "Listings" },
        ]}
      />

      {sub === "selling" ? renderSelling() : renderListings()}
    </div>
  );
}
