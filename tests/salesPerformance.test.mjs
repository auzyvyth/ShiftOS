// Unit tests for src/utils/salesPerformance.js — the maths behind the Salesman
// Premium Performance tab. Run: npm run test:perf
//
// These guard the two things most likely to break quietly:
//   1. a lost deal must be charged to the stage it DIED at (stage history),
//      not to "new" — get this wrong and the funnel blames the wrong step
//   2. every insight has a minimum sample size, so a rep with 3 leads is never
//      told a pattern that isn't there
import assert from "node:assert/strict";

const mod = await import("../src/utils/salesPerformance.js");
const {
  buildFunnel, buildResponseSpeed, buildLossReasons, buildSourceQuality,
  buildCloseRate, buildStuck, buildInsights, buildSalesPerformance,
  indexStageHistory, furthestRank, median, formatDuration, sourceLabel,
} = mod;

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; }
  catch (err) { console.error(`FAIL: ${name}\n  ${err.message}`); process.exitCode = 1; }
};

const DAY = 86400000;
const NOW = Date.UTC(2026, 7, 30);
const ago = (days) => new Date(NOW - days * DAY).toISOString();

// ---------------------------------------------------------------- helpers

test("median handles even, odd and empty", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([NaN, 2]), 2);
});

test("formatDuration switches units", () => {
  assert.equal(formatDuration(30), "30m");
  assert.equal(formatDuration(90), "1.5h");
  assert.equal(formatDuration(60 * 48), "2d");
  assert.equal(formatDuration(null), "—");
});

test("sourceLabel maps known keys and humanises unknown ones", () => {
  assert.equal(sourceLabel("drevo_enquiry"), "Marketplace");
  assert.equal(sourceLabel("some_new_thing"), "some new thing");
  assert.equal(sourceLabel(null), "Unknown");
});

// ------------------------------------------------------------ stage history

test("furthestRank credits a lost lead with the stage it reached", () => {
  const history = indexStageHistory([
    { lead_id: "a", to_stage: "contacted" },
    { lead_id: "a", to_stage: "test_drive" },
    { lead_id: "a", to_stage: "lost" },
  ]);
  // Current stage is `lost`, which has no rank — history says it got to
  // test_drive (rank 3). Reading leads.stage alone would score this 0.
  assert.equal(furthestRank({ id: "a", stage: "lost" }, history), 3);
});

test("furthestRank falls back to the lead's own stage with no history", () => {
  const empty = indexStageHistory([]);
  assert.equal(furthestRank({ id: "b", stage: "negotiating" }, empty), 4);
  assert.equal(furthestRank({ id: "c", stage: "new" }, empty), 0);
  // A lost lead with no history is only known to have existed.
  assert.equal(furthestRank({ id: "d", stage: "lost" }, empty), 0);
});

// -------------------------------------------------------------------- funnel

test("funnel drop-off blames the stage that actually shed the deals", () => {
  // 6 leads all reach test_drive; 5 of them die there, 1 goes on to win.
  const leads = [];
  const rows = [];
  for (let i = 0; i < 5; i += 1) {
    leads.push({ id: `l${i}`, stage: "lost" });
    rows.push({ lead_id: `l${i}`, to_stage: "test_drive" });
  }
  leads.push({ id: "w", stage: "won" });

  const { rows: steps, weakest } = buildFunnel(leads, indexStageHistory(rows));
  const byStage = Object.fromEntries(steps.map((s) => [s.stage, s]));

  assert.equal(byStage.test_drive.reached, 6);
  assert.equal(byStage.negotiating.reached, 1, "only the won lead went past test drive");
  assert.equal(byStage.test_drive.lostHere, 5);
  assert.equal(byStage.test_drive.dropOffPct, 83);
  assert.equal(weakest.stage, "test_drive");
});

test("weakest stage ignores a 100% drop-off on a tiny sample", () => {
  // One lead stalls at negotiating (100% drop) while four stall at contacted.
  const leads = [
    { id: "n", stage: "negotiating" },
    ...Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, stage: "contacted" })),
  ];
  const { weakest } = buildFunnel(leads, indexStageHistory([]));
  // negotiating sheds 1 person off a base of 1; contacted sheds 4 off 5.
  assert.equal(weakest.stage, "contacted", "should follow people lost, not percentage");
});

// ------------------------------------------------------------ response speed

test("response speed splits fast vs slow close rates", () => {
  const mk = (id, mins, stage) => ({
    id, stage,
    created_at: ago(10),
    first_response_at: new Date(NOW - 10 * DAY + mins * 60000).toISOString(),
  });
  const leads = [
    mk("f1", 10, "won"), mk("f2", 20, "won"), mk("f3", 30, "lost"),
    mk("s1", 600, "lost"), mk("s2", 700, "lost"), mk("s3", 800, "won"),
  ];
  const speed = buildResponseSpeed(leads);
  assert.equal(speed.tracked, 6);
  assert.equal(speed.coverage, 100);
  assert.equal(speed.fast.closeRate, 67);
  assert.equal(speed.slow.closeRate, 33);
});

test("response speed drops a negative gap rather than averaging it in", () => {
  const leads = [
    { id: "ok", stage: "won", created_at: ago(5), first_response_at: ago(4) },
    // first_response_at BEFORE created_at — a backfill artefact.
    { id: "bad", stage: "won", created_at: ago(2), first_response_at: ago(6) },
  ];
  const speed = buildResponseSpeed(leads);
  assert.equal(speed.tracked, 1);
  assert.equal(speed.coverage, 50);
  assert.ok(speed.medianMins > 0);
});

// ------------------------------------------------------------- loss reasons

test("loss reasons rank recorded reasons and count the blanks", () => {
  const leads = [
    { id: "1", stage: "lost", loss_reason: "Price" },
    { id: "2", stage: "lost", loss_reason: "Price" },
    { id: "3", stage: "lost", loss_reason: "Timing" },
    { id: "4", stage: "lost", loss_reason: "  " },
    { id: "5", stage: "won" },
  ];
  const loss = buildLossReasons(leads);
  assert.equal(loss.lostTotal, 4);
  assert.equal(loss.recorded, 3);
  assert.equal(loss.top.reason, "Price");
  assert.equal(loss.top.count, 2);
  assert.ok(loss.rows.some((r) => r.reason === "Not recorded" && r.count === 1));
});

// ----------------------------------------------------------- source quality

test("source quality ranks by close rate, not volume", () => {
  const leads = [
    // chat: 3 settled, 3 won
    ...Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, stage: "won", lead_source: "chat", car_listings: { selling_price: 50000 } })),
    // whatsapp: lots of noise, 4 settled, 1 won
    ...Array.from({ length: 3 }, (_, i) => ({ id: `w${i}`, stage: "lost", lead_source: "whatsapp" })),
    { id: "w4", stage: "won", lead_source: "whatsapp", car_listings: { selling_price: 30000 } },
    ...Array.from({ length: 5 }, (_, i) => ({ id: `wn${i}`, stage: "new", lead_source: "whatsapp" })),
  ];
  const q = buildSourceQuality(leads);
  assert.equal(q.rows[0].source, "whatsapp", "rows stay ordered by volume");
  assert.equal(q.best.source, "chat");
  assert.equal(q.best.closeRate, 100);
  assert.equal(q.worst.source, "whatsapp");
  assert.equal(q.worst.closeRate, 25);
  assert.equal(q.best.valueWon, 150000);
});

test("source quality refuses to name a best source on a thin sample", () => {
  const leads = [
    { id: "a", stage: "won", lead_source: "chat" },
    { id: "b", stage: "lost", lead_source: "whatsapp" },
  ];
  const q = buildSourceQuality(leads);
  assert.equal(q.best, null);
  assert.equal(q.worst, null);
});

// --------------------------------------------------------------- close rate

test("close rate compares the last 30 days with the 30 before", () => {
  const recent = Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, stage: i === 0 ? "lost" : "won", updated_at: ago(5) }));
  const older = Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, stage: i === 0 ? "won" : "lost", updated_at: ago(45) }));
  const cr = buildCloseRate([...recent, ...older], NOW);
  assert.equal(cr.current, 75);
  assert.equal(cr.previous, 25);
  assert.equal(cr.trend, 50);
  assert.equal(cr.settled, 8);
});

test("close rate windows stay null below three settled deals", () => {
  const cr = buildCloseRate([{ id: "a", stage: "won", updated_at: ago(2) }], NOW);
  assert.equal(cr.current, null);
  assert.equal(cr.trend, null);
  assert.equal(cr.rate, 100);
});

// -------------------------------------------------------------------- stuck

test("stuck counts only open leads with no movement", () => {
  const leads = [
    { id: "a", stage: "contacted", updated_at: ago(30) },
    { id: "b", stage: "contacted", updated_at: ago(20) },
    { id: "c", stage: "new", updated_at: ago(1) },
    { id: "d", stage: "won", updated_at: ago(90) },
  ];
  const s = buildStuck(leads, NOW);
  assert.equal(s.active, 3);
  assert.equal(s.stuck, 2);
  assert.equal(s.pct, 67);
});

// ----------------------------------------------------------------- insights

test("insights stay silent on a brand-new account", () => {
  const perf = buildSalesPerformance(
    [{ id: "a", stage: "new", created_at: ago(1) }],
    [],
    NOW,
  );
  assert.equal(perf.insights.length, 1);
  assert.equal(perf.insights[0].key, "need_data");
});

test("insights lead with the weakest funnel stage", () => {
  const leads = [];
  const rows = [];
  for (let i = 0; i < 6; i += 1) {
    leads.push({ id: `l${i}`, stage: "lost", updated_at: ago(3), loss_reason: "Price" });
    rows.push({ lead_id: `l${i}`, to_stage: "negotiating" });
  }
  leads.push({ id: "w", stage: "won", updated_at: ago(3) });
  const perf = buildSalesPerformance(leads, rows, NOW);
  assert.equal(perf.insights[0].key, "weak_stage");
  assert.match(perf.insights[0].title, /Negotiating/);
  // The loss-reason insight rides along behind it.
  assert.ok(perf.insights.some((i) => i.key === "loss_reason"));
});

test("insights never quote a money figure", () => {
  const leads = Array.from({ length: 12 }, (_, i) => ({
    id: `l${i}`,
    stage: i % 3 === 0 ? "won" : "lost",
    updated_at: ago(4),
    loss_reason: "Price",
    lead_source: i % 2 ? "chat" : "whatsapp",
    car_listings: { selling_price: 88000 },
  }));
  const perf = buildSalesPerformance(leads, [], NOW);
  perf.insights.forEach((ins) => {
    const text = `${ins.title} ${ins.body}`;
    assert.ok(!/RM\s?\d/.test(text), `insight ${ins.key} quotes money: ${text}`);
  });
});

test("buildSalesPerformance ignores soft-deleted leads", () => {
  const perf = buildSalesPerformance(
    [{ id: "a", stage: "won", is_deleted: true }, { id: "b", stage: "new" }],
    [],
    NOW,
  );
  assert.equal(perf.closeRate.total, 1);
  assert.equal(perf.closeRate.won, 0);
});

test("buildSalesPerformance survives null input", () => {
  const perf = buildSalesPerformance(null, null, NOW);
  assert.equal(perf.hasLeads, false);
  assert.equal(perf.insights.length, 1);
});

test("a leak at the top of the funnel is worded as 'never contacted'", () => {
  // Mirrors the real shape found in production: most leads sit untouched at New.
  const leads = [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, stage: "new" })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, stage: "won", updated_at: ago(3) })),
  ];
  const perf = buildSalesPerformance(leads, [], NOW);
  const weak = perf.insights.find((i) => i.key === "weak_stage");
  assert.equal(perf.funnel.weakest.stage, "new");
  assert.match(weak.title, /never contacted/);
  assert.ok(!/reached New/.test(weak.body), "should not say 'reached New'");
});

if (!process.exitCode) console.log(`salesPerformance: ${passed} tests passed`);
