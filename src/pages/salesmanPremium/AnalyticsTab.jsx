import React, { useState } from "react";
import {
  BarChart2, Plus, TrendingUp, ChevronDown, ChevronUp, Clock, Target,
  AlertTriangle, Award, Lightbulb, Zap,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";
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
// Colour rule (unchanged from the rebuild): colour is a verdict, never a
// category. Traffic metrics share one hue; the only coloured things in Selling
// are the weakest funnel step, close-rate quality, and insight severity.
export default function AnalyticsTab({
 carStatsMap, enquiries, thisMonthSales, commission, soldCount, myListings,
 channelMap, commissionDetails, isMobile, onAddListing, leads = [], onOpenTab,
}) {
  const [sub, setSub] = useState("selling");
  const [openInsights, setOpenInsights] = useState(() => new Set());
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
  const cvrHue = cvrNum >= 10 ? C.success : cvrNum >= 5 ? C.warn : C.danger;
  const cvrLabel = cvrNum >= 10 ? "Strong" : cvrNum >= 5 ? "Fair" : "Low";

  const money = (n) => `RM ${Number(n || 0).toLocaleString("en-MY")}`;

  // Traffic metrics share ONE hue because they are one family. Distinguishing
  // them by colour would be decoration — the label already does that job.
  const TRAFFIC_HUE = C.info;

  const Metric = ({ label, value, sub: subLabel, data, hue, badge, id }) => (
    <div style={{ ...CARD, padding: "14px 16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={EYEBROW}>{label}</span>
        {badge}
      </div>
      <p style={{ ...STAT, margin: "6px 0 0", fontSize: T.size.statLg }}>{value}</p>
      {subLabel && <p style={{ margin: "3px 0 0", fontSize: T.size.sm, color: C.textMuted }}>{subLabel}</p>}
      {data && <Spark data={data} hue={hue || TRAFFIC_HUE} id={id} />}
    </div>
  );

  const hasListings = myListings.length > 0;

  // A card that cannot say anything useful yet says WHAT unlocks it, rather
  // than drawing an empty chart or a row of zeroes.
  const NotYet = ({ children }) => (
    <p style={{ margin: 0, padding: "18px", fontSize: T.size.base, color: C.textMuted, lineHeight: 1.6 }}>
      {children}
    </p>
  );

  const TONE = {
    warn: { hue: C.danger, text: C.dangerText, icon: AlertTriangle },
    tip: { hue: C.info, text: C.infoText, icon: Lightbulb },
    good: { hue: C.success, text: C.successText, icon: Award },
  };

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

    const rateHue = closeRate.rate === null ? C.textDim
      : closeRate.rate >= 40 ? C.successText
      : closeRate.rate >= 20 ? C.warnText : C.dangerText;

    const funnelTop = funnel.rows[0]?.reached || 1;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── Coaching insights — ranked, most costly first, collapsed so they
            never push the numbers below the fold. Capped at three: a wall of
            advice is advice nobody reads. ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {insights.slice(0, 3).map((ins) => {
            const tone = TONE[ins.tone] || TONE.tip;
            const Icon = tone.icon;
            const open = openInsights.has(ins.key);
            return (
              <div
                key={ins.key}
                style={{ background: withAlpha(tone.hue, 0.07), border: `1px solid ${withAlpha(tone.hue, 0.18)}`, borderRadius: R.md, overflow: "hidden" }}
              >
                <button
                  onClick={() => toggleInsight(ins.key)}
                  aria-expanded={open}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                >
                  <Icon size={14} style={{ color: tone.hue, flexShrink: 0 }} />
                  <span style={{ fontSize: T.size.base, fontWeight: T.weight.bold, color: tone.text, flex: 1, minWidth: 0 }}>
                    {ins.title}
                  </span>
                  {open
                    ? <ChevronUp size={15} style={{ color: tone.hue, flexShrink: 0 }} />
                    : <ChevronDown size={15} style={{ color: tone.hue, flexShrink: 0 }} />}
                </button>
                {open && (
                  <div style={{ padding: "0 14px 13px 37px" }}>
                    <p style={{ margin: 0, fontSize: T.size.base, color: C.textSec, lineHeight: 1.6 }}>{ins.body}</p>
                    {ins.cta && onOpenTab && (
                      <button
                        onClick={() => onOpenTab(ins.ctaTab)}
                        style={{ marginTop: 10, fontSize: T.size.sm, fontWeight: T.weight.semibold, padding: "6px 12px", borderRadius: R.sm, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, color: C.textSec, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {ins.cta} →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Close rate ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>Close rate</span>
            <span style={{ fontSize: T.size.xs, fontWeight: T.weight.normal, letterSpacing: 0, textTransform: "none", color: C.textDim }}>
              All time
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)" }}>
            {[
              { label: "Leads", value: closeRate.total, note: "Ever created" },
              { label: "Won", value: closeRate.won, note: "Deals closed", color: C.successText },
              { label: "Lost", value: closeRate.lost, note: "Did not convert", color: C.dangerText },
              { label: "Close rate", value: closeRate.rate !== null ? `${closeRate.rate}%` : "—", note: "Won of settled", color: rateHue },
            ].map(({ label, value, note, color }, i) => (
              <div
                key={label}
                style={{
                  padding: "16px 18px",
                  borderRight: !isMobile && i < 3 ? `1px solid ${C.line}` : isMobile && i % 2 === 0 ? `1px solid ${C.line}` : "none",
                  borderTop: isMobile && i > 1 ? `1px solid ${C.line}` : "none",
                }}
              >
                <p style={{ ...EYEBROW, margin: 0 }}>{label}</p>
                <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.stat, color: color || C.text }}>{value}</p>
                <p style={{ margin: "3px 0 0", fontSize: T.size.sm, color: C.textMuted }}>{note}</p>
              </div>
            ))}
          </div>
          {closeRate.trend !== null && (
            <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.line}`, fontSize: T.size.base, color: C.textSec }}>
              <span style={{ color: closeRate.trend >= 0 ? C.successText : C.dangerText, fontWeight: T.weight.bold }}>
                {closeRate.trend >= 0 ? "↑" : "↓"} {Math.abs(closeRate.trend)} points
              </span>{" "}
              last 30 days ({closeRate.current}%) vs the 30 before ({closeRate.previous}%)
            </div>
          )}
        </div>

        {/* ── Funnel ── */}
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
                const barHue = row.stage === "won" ? C.success : isWeak ? C.danger : C.info;
                return (
                  <div key={row.stage} style={{ padding: "9px 0" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: T.size.base, color: C.text, fontWeight: isWeak ? T.weight.semibold : T.weight.normal }}>
                        {row.label}
                        {isWeak && (
                          <span style={{ ...SOFT(C.danger), marginLeft: 7, fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "1px 6px", borderRadius: R.pill }}>
                            Weakest step
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: T.size.base, fontWeight: T.weight.bold, color: C.text, flexShrink: 0 }}>
                        {row.reached}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: R.pill, background: C.fill, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: barHue, borderRadius: R.pill }} />
                    </div>
                    {row.dropOffPct !== null && row.lostHere > 0 && (
                      <p style={{ margin: "5px 0 0", fontSize: T.size.sm, color: isWeak ? C.dangerText : C.textMuted }}>
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

        {/* ── Reply speed ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Zap size={13} /> Reply speed
            </span>
          </div>
          {speed.tracked === 0 ? (
            <NotYet>
              No first-reply times recorded yet. Messaging a buyer from inside the app — the WhatsApp button on a lead, or a logged call — stamps when you first got back to them, and this card then shows what replying faster is worth.
            </NotYet>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)" }}>
                <div style={{ padding: "16px 18px", borderRight: !isMobile ? `1px solid ${C.line}` : "none", borderBottom: isMobile ? `1px solid ${C.line}` : "none" }}>
                  <p style={{ ...EYEBROW, margin: 0 }}>Typical first reply</p>
                  <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.stat }}>{formatDuration(speed.medianMins)}</p>
                  <p style={{ margin: "3px 0 0", fontSize: T.size.sm, color: C.textMuted }}>Median across {speed.tracked} leads</p>
                </div>
                <div style={{ padding: "16px 18px", borderRight: !isMobile ? `1px solid ${C.line}` : "none", borderBottom: isMobile ? `1px solid ${C.line}` : "none" }}>
                  <p style={{ ...EYEBROW, margin: 0 }}>Answered within 1h</p>
                  <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.stat, color: speed.fast.closeRate === null ? C.textDim : C.successText }}>
                    {speed.fast.closeRate !== null ? `${speed.fast.closeRate}%` : "—"}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: T.size.sm, color: C.textMuted }}>
                    {speed.fast.settled ? `Closed ${speed.fast.won} of ${speed.fast.settled}` : "None settled yet"}
                  </p>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  <p style={{ ...EYEBROW, margin: 0 }}>Answered later</p>
                  <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.stat, color: speed.slow.closeRate === null ? C.textDim : C.text }}>
                    {speed.slow.closeRate !== null ? `${speed.slow.closeRate}%` : "—"}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: T.size.sm, color: C.textMuted }}>
                    {speed.slow.settled ? `Closed ${speed.slow.won} of ${speed.slow.settled}` : "None settled yet"}
                  </p>
                </div>
              </div>
              {speed.coverage < 100 && (
                <p style={{ margin: 0, padding: "10px 18px", borderTop: `1px solid ${C.line}`, fontSize: T.size.sm, color: C.textDim }}>
                  Based on the {speed.coverage}% of your leads that have a first reply recorded.
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Loss reasons ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Clock size={13} /> Why deals are lost
            </span>
          </div>
          {loss.lostTotal === 0 ? (
            <NotYet>Nothing marked lost yet. Closing dead leads as lost — with a reason — is what fills this in.</NotYet>
          ) : (
            <div style={{ padding: "6px 18px 14px" }}>
              {loss.rows.map((row) => (
                <div key={row.reason} style={{ padding: "8px 0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                    <span style={{ fontSize: T.size.base, color: row.recorded ? C.text : C.textDim }}>{row.reason}</span>
                    <span style={{ fontSize: T.size.base, fontWeight: T.weight.bold, color: C.text, flexShrink: 0 }}>
                      {row.count} <span style={{ fontSize: T.size.sm, fontWeight: T.weight.normal, color: C.textMuted }}>({row.pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: R.pill, background: C.fill, overflow: "hidden" }}>
                    <div style={{ width: `${row.pct}%`, height: "100%", background: row.recorded ? C.danger : C.textDim, borderRadius: R.pill }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Source quality ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>Which leads are worth your time</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 46px 52px" : "1fr 70px 80px 110px", padding: "8px 18px", borderBottom: `1px solid ${C.line}`, gap: 8 }}>
            {(isMobile ? ["Source", "Leads", "Close"] : ["Source", "Leads", "Close rate", "Value won"]).map((h) => (
              <p key={h} style={{ ...EYEBROW, margin: 0, textAlign: h === "Source" ? "left" : "right" }}>{h}</p>
            ))}
          </div>
          {sources.rows.map((row, idx) => {
            const hue = row.closeRate === null ? C.textDim
              : row.closeRate >= 40 ? C.successText
              : row.closeRate >= 20 ? C.warnText : C.dangerText;
            return (
              <div
                key={row.source}
                style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 46px 52px" : "1fr 70px 80px 110px", gap: 8, padding: "10px 18px", alignItems: "center", borderBottom: idx < sources.rows.length - 1 ? `1px solid ${C.line}` : "none" }}
              >
                <p style={{ margin: 0, fontSize: T.size.base, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sourceLabel(row.source)}
                </p>
                <p style={{ margin: 0, fontSize: T.size.base, color: C.textSec, textAlign: "right" }}>{row.total}</p>
                <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: hue, textAlign: "right" }}>
                  {row.closeRate !== null ? `${row.closeRate}%` : "—"}
                </p>
                {!isMobile && (
                  <p style={{ margin: 0, fontSize: T.size.base, color: row.valueWon ? C.text : C.textDim, textAlign: "right" }}>
                    {row.valueWon ? money(row.valueWon) : "—"}
                  </p>
                )}
              </div>
            );
          })}
          <p style={{ margin: 0, padding: "10px 18px", borderTop: `1px solid ${C.line}`, fontSize: T.size.sm, color: C.textDim, lineHeight: 1.5 }}>
            Close rate counts settled deals only, so a source with leads still open is not punished for them.
          </p>
        </div>
      </div>
    );
  };

  const renderListings = () => (
    <div>
      {/* Traffic */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        <Metric label="Listing views" value={totalViews} sub="All time" data={viewsD} id="views" />
        <Metric label="WhatsApp taps" value={totalWA} sub="All time" />
        <Metric
          label="Tap-through"
          value={cvr !== null ? `${cvr}%` : "—"}
          sub="Taps per view"
          badge={cvr !== null && (
            <span style={{ ...SOFT(cvrHue), fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "2px 7px", borderRadius: R.pill }}>
              {cvrLabel}
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
              style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, fontSize: T.size.base, fontWeight: T.weight.bold, padding: "9px 16px", borderRadius: R.md, background: C.accent, border: "none", color: C.onAccent, cursor: "pointer", fontFamily: "system-ui,sans-serif" }}
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
              <BarChart2 size={13} /> Listing performance
            </span>
            <span style={{ fontSize: T.size.xs, fontWeight: T.weight.normal, letterSpacing: 0, textTransform: "none", color: C.textDim }}>
              All time
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 54px 54px 62px", padding: "8px 18px", borderBottom: `1px solid ${C.line}` }}>
            {["Car", "Views", "Taps", "Rate"].map((h) => (
              <p key={h} style={{ ...EYEBROW, margin: 0, textAlign: h === "Car" ? "left" : "center" }}>{h}</p>
            ))}
          </div>
          {myListings.map((car, idx) => {
            const s = carStatsMap[car.id] ?? {};
            const v = s.views || 0;
            const w = s.enquiries || 0;
            const rate = v > 0 ? (w / v) * 100 : null;
            const rateHue = rate === null ? C.textDim : rate >= 10 ? C.successText : rate >= 5 ? C.warnText : C.dangerText;
            return (
              <div
                key={car.id}
                style={{ display: "grid", gridTemplateColumns: "1fr 54px 54px 62px", padding: "10px 18px", alignItems: "center", borderBottom: idx < myListings.length - 1 ? `1px solid ${C.line}` : "none" }}
              >
                <p style={{ margin: 0, fontSize: T.size.base, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[car.year, car.brand, car.model].filter(Boolean).join(" ")}
                </p>
                <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, textAlign: "center" }}>{v}</p>
                <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, textAlign: "center" }}>{w}</p>
                <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: rateHue, textAlign: "center" }}>
                  {rate !== null ? `${rate.toFixed(1)}%` : "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Where the views and enquiries actually came from, summed across cars. */}
      {Object.keys(channelMap).length > 0 && (
        <div style={{ ...CARD, padding: 16, marginBottom: 12 }}>
          <ChannelBreakdown rows={Object.values(channelMap).flat()} metric="views" title="Traffic by platform" />
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
              <span style={{ flexShrink: 0, fontSize: T.size.base, fontWeight: T.weight.bold, color: C.successText }}>
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
          true of both halves, so it sits above the switcher. One card, so the
          three figures read as one story instead of three competing tiles. */}
      <div style={{ ...CARD, padding: isMobile ? "16px" : "18px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: isMobile ? 20 : 40, flexWrap: "wrap" }}>
          <div>
            <p style={{ ...EYEBROW, margin: 0 }}>This month</p>
            <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.hero }}>
              {thisMonthSales}
              <span style={{ fontSize: T.size.base, fontWeight: T.weight.normal, color: C.textMuted, marginLeft: 6 }}>sold</span>
            </p>
          </div>
          <div>
            <p style={{ ...EYEBROW, margin: 0 }}>Commission earned</p>
            <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.hero, color: commission ? C.successText : C.text }}>
              {commission !== null ? money(commission) : "—"}
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
