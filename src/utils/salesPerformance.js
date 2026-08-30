// Sales performance analytics for the Salesman Premium "Performance" tab.
//
// Everything here is PURE — leads and stage-history rows in, numbers out — so
// it can be unit-tested in node without React or Supabase (tests/salesPerformance.test.mjs).
//
// Why this exists at all: Premium's Performance tab only ever showed marketing
// traffic (views, WhatsApp taps, tap-through). It never touched `leads`, so the
// paid tier could not answer the two questions a salesman actually pays for —
// "where am I losing deals" and "what should I change". Salesman Lite answered
// more of that than Premium did.
//
// The line this module holds: it produces DIAGNOSIS (patterns across many
// leads), never a call list. Who to phone today is already owned by "This week"
// (src/utils/thisWeek.js) on the dashboard, and duplicating it here would put a
// third to-do list in front of the same rep.

// The six working stages, in order. `won` is appended as the funnel's last step
// (a sale is the point of the funnel); the two lost stages sit outside it —
// a lost deal is attributed to the stage it DIED at, not to a "lost" bucket.
export const FUNNEL_STAGES = ["new", "contacted", "viewing_booked", "test_drive", "negotiating", "deposit_taken"];
export const WON_STAGES = ["won", "closed_won"];
export const LOST_STAGES = ["lost", "closed_lost"];

export const STAGE_LABEL = {
  new: "New",
  contacted: "Contacted",
  viewing_booked: "Viewing booked",
  test_drive: "Test drive",
  negotiating: "Negotiating",
  deposit_taken: "Deposit taken",
  won: "Won",
};

// Ordering used to work out how far a lead ever got. `won` outranks every
// working stage; the lost stages deliberately have NO rank — see furthestStage.
const RANK = FUNNEL_STAGES.reduce((m, s, i) => ({ ...m, [s]: i }), { won: 6, closed_won: 6 });

const isWon = (l) => WON_STAGES.includes(l.stage);
const isLost = (l) => LOST_STAGES.includes(l.stage);
const isSettled = (l) => isWon(l) || isLost(l);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function median(values) {
  const rows = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
}

// Group stage_changed activity rows by lead. Rows are {lead_id, to_stage}.
export function indexStageHistory(rows) {
  const byLead = new Map();
  (rows || []).forEach((r) => {
    if (!r?.lead_id || !r?.to_stage) return;
    if (!byLead.has(r.lead_id)) byLead.set(r.lead_id, []);
    byLead.get(r.lead_id).push(r.to_stage);
  });
  return byLead;
}

// How far this lead EVER got, as a rank into RANK.
//
// This is the whole reason the funnel is trustworthy. Reading only
// `leads.stage` would put every lost deal at rank 0 and make the drop-off
// look like it all happens at "New" — the stage history says a lead that is
// now `lost` had actually reached `test_drive` before it died, so the loss is
// charged to the step that lost it.
export function furthestRank(lead, historyByLead) {
  const seen = historyByLead?.get?.(lead.id) || [];
  let best = 0; // every lead reached `new` by existing
  seen.forEach((s) => {
    const r = RANK[s];
    if (Number.isFinite(r) && r > best) best = r;
  });
  const own = RANK[lead.stage];
  if (Number.isFinite(own) && own > best) best = own;
  return best;
}

// Funnel with real drop-off between consecutive steps.
export function buildFunnel(leads, historyByLead) {
  const steps = [...FUNNEL_STAGES, "won"];
  const reached = steps.map((_, i) => leads.filter((l) => furthestRank(l, historyByLead) >= i).length);

  const rows = steps.map((stage, i) => {
    const from = reached[i];
    const to = i < steps.length - 1 ? reached[i + 1] : null;
    // Of everyone who got this far, how many never took the next step.
    const lostHere = to === null ? 0 : from - to;
    return {
      stage,
      label: STAGE_LABEL[stage],
      reached: from,
      lostHere,
      dropOffPct: to === null || from === 0 ? null : Math.round((lostHere / from) * 100),
    };
  });

  // The weakest step is the one that sheds the most PEOPLE, not the highest
  // percentage — a 100% drop-off on a single lead is noise, and acting on it
  // would send the rep to fix a stage they have been to once.
  const candidates = rows.filter((r) => r.dropOffPct !== null && r.reached >= 4 && r.lostHere > 0);
  const weakest = candidates.length
    ? candidates.reduce((a, b) => (b.lostHere > a.lostHere ? b : a))
    : null;

  return { rows, weakest };
}

// Time from lead created to first reply, and what replying fast is worth.
export function buildResponseSpeed(leads) {
  const timed = leads
    .filter((l) => l.created_at && l.first_response_at)
    .map((l) => {
      const mins = (new Date(l.first_response_at) - new Date(l.created_at)) / 60000;
      return { lead: l, mins };
    })
    // A negative gap means the columns disagree (a backfill, a manual edit).
    // Averaging that in would quietly corrupt the median.
    .filter((r) => Number.isFinite(r.mins) && r.mins >= 0);

  const tracked = timed.length;
  const coverage = leads.length ? Math.round((tracked / leads.length) * 100) : 0;
  const medianMins = median(timed.map((r) => r.mins));

  // Two buckets, not three: the question is "did you get back to them the same
  // hour or not", and splitting thinner just makes every bucket too small to
  // draw a conclusion from.
  const bucket = (rows) => {
    const settled = rows.filter((r) => isSettled(r.lead));
    const won = settled.filter((r) => isWon(r.lead)).length;
    return {
      total: rows.length,
      settled: settled.length,
      won,
      closeRate: settled.length ? Math.round((won / settled.length) * 100) : null,
    };
  };
  const fast = bucket(timed.filter((r) => r.mins <= 60));
  const slow = bucket(timed.filter((r) => r.mins > 60));

  return { tracked, coverage, medianMins, fast, slow };
}

// Why deals die. Reads `leads.loss_reason`, which nothing else surfaces.
export function buildLossReasons(leads) {
  const lost = leads.filter(isLost);
  const counts = new Map();
  lost.forEach((l) => {
    const key = (l.loss_reason || "").trim() || "Not recorded";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const rows = [...counts.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      pct: lost.length ? Math.round((count / lost.length) * 100) : 0,
      recorded: reason !== "Not recorded",
    }))
    .sort((a, b) => b.count - a.count);
  const recorded = lost.filter((l) => (l.loss_reason || "").trim()).length;
  const top = rows.find((r) => r.recorded) || null;
  return { rows, lostTotal: lost.length, recorded, top };
}

// Which sources are worth the rep's time — volume AND close rate AND the money
// actually won. Lite ranks sources by volume alone, which flatters whichever
// channel is noisiest rather than whichever one pays.
export function buildSourceQuality(leads) {
  const bySource = new Map();
  leads.forEach((l) => {
    const key = l.lead_source || "manual";
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(l);
  });

  const rows = [...bySource.entries()]
    .map(([source, rows_]) => {
      const won = rows_.filter(isWon);
      const settled = rows_.filter(isSettled);
      return {
        source,
        total: rows_.length,
        won: won.length,
        settled: settled.length,
        closeRate: settled.length ? Math.round((won.length / settled.length) * 100) : null,
        valueWon: won.reduce((s, l) => s + num(l.car_listings?.selling_price), 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  // Only sources with enough settled deals to mean anything can be called best
  // or worst. Below that they are ranked but never quoted in an insight.
  const rated = rows.filter((r) => r.settled >= 3 && r.closeRate !== null);
  const best = rated.length ? rated.reduce((a, b) => (b.closeRate > a.closeRate ? b : a)) : null;
  const worst = rated.length > 1 ? rated.reduce((a, b) => (b.closeRate < a.closeRate ? b : a)) : null;

  return { rows, best, worst: worst && best && worst.source !== best.source ? worst : null };
}

// Close rate overall, plus the last 30 days against the 30 before them.
export function buildCloseRate(leads, now = Date.now()) {
  const won = leads.filter(isWon);
  const lost = leads.filter(isLost);
  const settled = won.length + lost.length;
  const rate = settled ? Math.round((won.length / settled) * 100) : null;

  const DAY = 86400000;
  const windowRate = (fromDaysAgo, toDaysAgo) => {
    const rows = leads.filter((l) => {
      if (!isSettled(l) || !l.updated_at) return false;
      const age = (now - new Date(l.updated_at).getTime()) / DAY;
      return age >= toDaysAgo && age < fromDaysAgo;
    });
    if (rows.length < 3) return null;
    return Math.round((rows.filter(isWon).length / rows.length) * 100);
  };
  const current = windowRate(30, 0);
  const previous = windowRate(60, 30);

  return {
    won: won.length,
    lost: lost.length,
    settled,
    total: leads.length,
    rate,
    current,
    previous,
    trend: current !== null && previous !== null ? current - previous : null,
  };
}

// Active leads that have sat at the same stage too long. Counted here as a
// PATTERN ("a third of your pipeline is frozen"), not as a list of names —
// the names belong to "This week" on the dashboard.
export function buildStuck(leads, now = Date.now(), thresholdDays = 14) {
  const active = leads.filter((l) => !isSettled(l));
  const stuck = active.filter((l) => {
    const ts = l.updated_at || l.created_at;
    if (!ts) return false;
    return (now - new Date(ts).getTime()) / 86400000 >= thresholdDays;
  });
  return {
    active: active.length,
    stuck: stuck.length,
    pct: active.length ? Math.round((stuck.length / active.length) * 100) : 0,
    thresholdDays,
  };
}

export function formatDuration(mins) {
  if (mins === null || !Number.isFinite(mins)) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = mins / 60;
  if (h < 24) return `${h < 10 ? h.toFixed(1).replace(/\.0$/, "") : Math.round(h)}h`;
  const d = h / 24;
  return `${d < 10 ? d.toFixed(1).replace(/\.0$/, "") : Math.round(d)}d`;
}

// Ranked coaching insights.
//
// Rules that keep this from turning into horoscope text:
//   - every insight quotes a real number the rep can go and verify
//   - every insight has a minimum sample size; below it the card says
//     "not enough data yet" instead of inventing a pattern
//   - no invented money. No projected revenue, no "this is costing you RM x" —
//     nothing here knows a rep's commission rate (same rule as AI drafts).
//   - severity ordering, so the top card is the one worth acting on today
export function buildInsights({ funnel, speed, loss, sources, closeRate, stuck }) {
  const out = [];

  if (funnel.weakest) {
    const w = funnel.weakest;
    // Every lead "reaches" New by existing, so the generic wording ("of the
    // leads that reached New") reads like nonsense. When the leak is at the
    // very top it has a plainer name: those buyers were never contacted.
    const atTop = w.stage === "new";
    out.push({
      key: "weak_stage",
      tone: "warn",
      severity: 100 + w.dropOffPct,
      title: atTop
        ? `${w.dropOffPct}% of your leads were never contacted`
        : `${w.dropOffPct}% of deals stop at ${w.label}`,
      body: atTop
        ? `${w.lostHere} of your ${w.reached} leads never moved past New — nobody has worked them at all. That is the cheapest gap on this page to close: they are buyers who already put their hand up.`
        : `${w.lostHere} of the ${w.reached} leads that reached ${w.label} never got past it. That is the single step costing you the most deals — worth looking at what you say and do there before changing anything else.`,
      cta: "Open pipeline",
      ctaTab: "leads",
    });
  }

  if (speed.fast.closeRate !== null && speed.slow.closeRate !== null
      && speed.fast.settled >= 3 && speed.slow.settled >= 3
      && speed.fast.closeRate > speed.slow.closeRate) {
    out.push({
      key: "reply_speed",
      tone: "tip",
      severity: 90 + (speed.fast.closeRate - speed.slow.closeRate),
      title: `Replying within the hour closes ${speed.fast.closeRate}% vs ${speed.slow.closeRate}%`,
      body: `Leads you answered inside an hour closed at ${speed.fast.closeRate}%. The ones that waited longer closed at ${speed.slow.closeRate}%. Your typical first reply takes ${formatDuration(speed.medianMins)}.`,
      cta: null,
    });
  } else if (speed.coverage < 50 && closeRate.total >= 8) {
    out.push({
      key: "speed_untracked",
      tone: "tip",
      severity: 40,
      title: "Reply speed is only tracked on some leads",
      body: `First-reply time is recorded on ${speed.coverage}% of your leads. Replying from inside the app — the WhatsApp button or a logged call — stamps it, and once most leads carry it this page can tell you what answering faster is actually worth.`,
      cta: null,
    });
  }

  if (stuck.stuck >= 3 && stuck.pct >= 30) {
    out.push({
      key: "frozen_pipeline",
      tone: "warn",
      severity: 80 + stuck.pct,
      title: `${stuck.pct}% of your open pipeline has gone quiet`,
      body: `${stuck.stuck} of ${stuck.active} open leads have had no movement in ${stuck.thresholdDays}+ days. Either they need a nudge or they need closing as lost — leaving them open makes every rate on this page look better than it is.`,
      cta: "Open pipeline",
      ctaTab: "leads",
    });
  }

  if (loss.top && loss.recorded >= 3) {
    out.push({
      key: "loss_reason",
      tone: "tip",
      severity: 70,
      title: `${loss.top.reason} is your most common reason for losing`,
      body: `${loss.top.count} of the ${loss.recorded} losses you gave a reason for came down to ${loss.top.reason.toLowerCase()}. That is the objection to have an answer ready for.`,
      cta: null,
    });
  } else if (loss.lostTotal >= 4 && loss.recorded < loss.lostTotal / 2) {
    out.push({
      key: "loss_untracked",
      tone: "tip",
      severity: 35,
      title: "Most lost deals have no reason recorded",
      body: `${loss.lostTotal - loss.recorded} of ${loss.lostTotal} lost deals were closed without a reason. Picking one when you mark a deal lost is what turns this into a pattern you can fix.`,
      cta: null,
    });
  }

  if (sources.best && sources.worst && sources.best.closeRate > sources.worst.closeRate) {
    out.push({
      key: "source_gap",
      tone: "tip",
      severity: 60 + (sources.best.closeRate - sources.worst.closeRate),
      title: `${sourceLabel(sources.best.source)} leads close ${sources.best.closeRate}% — ${sourceLabel(sources.worst.source)} close ${sources.worst.closeRate}%`,
      body: `Not every lead is worth the same hour. ${sourceLabel(sources.best.source)} converted ${sources.best.won} of ${sources.best.settled} settled deals; ${sourceLabel(sources.worst.source)} converted ${sources.worst.won} of ${sources.worst.settled}.`,
      cta: null,
    });
  }

  if (closeRate.trend !== null && Math.abs(closeRate.trend) >= 10) {
    const up = closeRate.trend > 0;
    out.push({
      key: "close_trend",
      tone: up ? "good" : "warn",
      severity: up ? 50 : 85,
      title: `Your close rate ${up ? "rose" : "fell"} ${Math.abs(closeRate.trend)} points this month`,
      body: `${closeRate.current}% of the deals you settled in the last 30 days were won, against ${closeRate.previous}% the 30 days before.`,
      cta: null,
    });
  }

  if (!out.length) {
    const enough = closeRate.settled >= 3;
    out.push({
      key: enough ? "on_track" : "need_data",
      tone: enough ? "good" : "tip",
      severity: 0,
      title: enough ? "Nothing is obviously leaking" : "Not enough closed deals to spot a pattern yet",
      body: enough
        ? `${closeRate.won} won and ${closeRate.lost} lost, a ${closeRate.rate}% close rate, and no single stage is shedding more than its share. Keep the pipeline moving.`
        : `This page gets sharper the more deals you close out. You have settled ${closeRate.settled} so far — mark deals won or lost as they finish and the funnel, reply-speed and loss-reason numbers below start telling you where to focus.`,
      cta: null,
    });
  }

  return out.sort((a, b) => b.severity - a.severity);
}

export function sourceLabel(source) {
  const map = {
    walk_in: "Walk-in",
    whatsapp: "WhatsApp",
    referral: "Referral",
    drevo_enquiry: "Marketplace",
    enquiry: "Enquiry form",
    manual: "Added by hand",
    chat: "In-app chat",
  };
  return map[source] || String(source || "Unknown").replace(/_/g, " ");
}

// One call that builds the whole Performance model.
export function buildSalesPerformance(leads, stageRows, now = Date.now()) {
  const rows = (leads || []).filter((l) => l && !l.is_deleted);
  const historyByLead = indexStageHistory(stageRows);

  const funnel = buildFunnel(rows, historyByLead);
  const speed = buildResponseSpeed(rows);
  const loss = buildLossReasons(rows);
  const sources = buildSourceQuality(rows);
  const closeRate = buildCloseRate(rows, now);
  const stuck = buildStuck(rows, now);
  const insights = buildInsights({ funnel, speed, loss, sources, closeRate, stuck });

  return { funnel, speed, loss, sources, closeRate, stuck, insights, hasLeads: rows.length > 0 };
}
