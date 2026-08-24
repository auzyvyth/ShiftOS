// "This week" — the one call list.
//
// Everything a salesman should contact today, from four sources that were each
// built on their own screen and so were never actually looked at:
//   leads never replied to · leads going quiet · their own due nudges ·
//   past buyers with a renewal due or an ageing car
//
// Ranking rule: money that is already on the floor comes first. A buyer who
// asked about a car and got no answer is worth more than a three-year-old
// trade-up hunch, so `never_replied` outranks everything.
//
// NOTHING here invents a number. Every draft is a fixed opener with no price,
// instalment, discount, trade-in value, rate or approval in it — same rule the
// AI drafts follow. The salesman opens WhatsApp and presses send himself.

// Stages that are still live. A won or lost lead is finished and must never
// appear on a call list.
export const OPEN_STAGES = ["contacted", "viewing_booked", "test_drive", "negotiating", "deposit_taken"];
const DEAD_STAGES = ["won", "closed_won", "lost", "closed_lost"];

const NEVER_REPLIED_DAYS = 2;   // an enquiry older than this with no reply at all
const QUIET_DAYS = 5;           // an open lead untouched this long
const EXPIRY_DAYS = 45;         // road tax / insurance running out within this
const OWNED_READY_Y = 3;
const VEHICLE_READY_Y = 5;

const DAY = 86400000;
const daysAgo = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : null);
const daysUntil = (iso) => (iso ? (new Date(iso).getTime() - Date.now()) / DAY : null);

// A wa.me link built from junk ("601", "1212112") just opens a dead chat.
export const usablePhone = (raw) => {
  const d = String(raw || "").replace(/\D/g, "");
  return d.length >= 9 ? d : null;
};

export const waLink = (phone, message) => {
  const d = usablePhone(phone);
  if (!d) return null;
  return `https://wa.me/${d.startsWith("6") ? d : "6" + d}?text=${encodeURIComponent(message)}`;
};

const carName = (c) => [c?.year, c?.brand, c?.model].filter(Boolean).join(" ");
const firstName = (full) => String(full || "").trim().split(" ")[0] || "";
const signoff = (repName) => (repName ? `${repName} here from XDrive` : "reaching out from XDrive");
const round = (n) => Math.max(1, Math.round(n));

export function buildThisWeek({ leads = [], customers = [], nudges = [], repName = "" } = {}) {
  const me = firstName(repName);
  const items = [];

  for (const l of leads) {
    if (DEAD_STAGES.includes(l.stage)) continue;
    const car = carName(l.car_listings || l.car_listing);
    const who = firstName(l.buyer_name) || "there";
    const age = daysAgo(l.created_at);
    const touched = daysAgo(l.last_contacted_at);

    // Never replied — they asked, nobody answered. The most expensive row here.
    if (l.stage === "new" && !l.last_contacted_at && age !== null && age >= NEVER_REPLIED_DAYS) {
      items.push({
        id: `lead-new-${l.id}`, kind: "never_replied", rank: 0, age,
        leadId: l.id, name: l.buyer_name || "Unknown buyer", phone: l.phone,
        why: `Never replied · ${round(age)}d ago`, sub: car,
        message: `Hi ${who}, ${signoff(me)}.${car ? ` You asked about the ${car}.` : ""} Sorry for the slow reply — is it still something you are looking at? Happy to answer any questions.`,
      });
      continue;
    }

    // Going quiet — an open lead nobody has touched in a while.
    const since = touched !== null ? touched : age;
    if (OPEN_STAGES.includes(l.stage) && since !== null && since >= QUIET_DAYS) {
      items.push({
        id: `lead-quiet-${l.id}`, kind: "going_quiet", rank: 2, age: since,
        leadId: l.id, name: l.buyer_name || "Unknown buyer", phone: l.phone,
        why: `No contact for ${round(since)}d`, sub: car,
        message: `Hi ${who}, ${signoff(me)}. Just checking in${car ? ` on the ${car}` : ""} — are you still considering it, or has something changed? Either way is fine, I just did not want to leave you hanging.`,
      });
    }
  }

  // Their own reminders, already drafted when they set them.
  for (const n of nudges) {
    if (n.status !== "ready") continue;
    const l = n.lead || {};
    items.push({
      id: `nudge-${n.id}`, kind: "reminder", rank: 1, age: daysAgo(n.scheduled_for) || 0,
      nudgeId: n.id, leadId: n.lead_id, name: l.buyer_name || "Unknown buyer", phone: l.phone,
      why: n.reason ? `Your reminder · ${n.reason}` : "Your reminder is due", sub: carName(l.car_listing),
      message: n.draft_message || "",
    });
  }

  for (const c of customers) {
    const who = firstName(c.name) || "there";
    const car = carName({ year: c.car_year, brand: c.car_brand, model: c.car_model });
    const plate = c.car_plate ? ` (${c.car_plate})` : "";

    for (const [field, label] of [["road_tax_expiry", "Road tax"], ["insurance_expiry", "Insurance"]]) {
      const d = daysUntil(c[field]);
      if (d === null || d > EXPIRY_DAYS) continue;
      const when = new Date(c[field]).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
      const gone = d < 0;
      items.push({
        id: `cust-${field}-${c.id}`, kind: "renewal", rank: 2, age: EXPIRY_DAYS - d,
        customerId: c.id, name: c.name || "Unknown buyer", phone: c.phone,
        why: gone ? `${label} expired ${when}` : `${label} due ${when} · ${round(d)}d`, sub: car,
        message: `Hi ${who}, ${signoff(me)}. Your ${label.toLowerCase()} on the ${car || "car"}${plate} ${gone ? `expired on ${when}` : `is due ${when}`}. Want me to help you sort the renewal?`,
      });
    }

    // Trade-up. Ownership age is the classic cycle; vehicle age is the one that
    // fires while the platform is still young (nobody has owned three years yet).
    const owned = c.purchase_date ? daysAgo(c.purchase_date) / 365.25 : null;
    const vAge = c.car_year ? new Date().getFullYear() - Number(c.car_year) : null;
    const reasons = [];
    if (owned !== null && owned >= OWNED_READY_Y) reasons.push(`owned ${Math.floor(owned)}y`);
    if (vAge !== null && vAge >= VEHICLE_READY_Y) reasons.push(`${c.car_year} car · ${vAge} yrs`);
    if (reasons.length) {
      items.push({
        id: `cust-trade-${c.id}`, kind: "trade_up", rank: 3, age: (owned || 0) * 2 + (vAge || 0),
        customerId: c.id, name: c.name || "Unknown buyer", phone: c.phone,
        why: `Trade-up ready · ${reasons.join(" · ")}`, sub: car,
        message: `Hi ${who}, ${signoff(me)}. You have had ${car ? `the ${car}` : "your car"} a while now — if you are thinking about changing, I can take a look at it and tell you what your options are. No obligation.`,
      });
    }
  }

  // Most urgent kind first, then longest-waiting inside each kind.
  items.sort((a, b) => a.rank - b.rank || b.age - a.age);

  // Collapse to one row per person. This is a call list: one human, one call,
  // even when three separate reasons fired for them. The most urgent reason
  // wins the row and the rest ride along as `also`.
  const seen = new Map();
  for (const it of items) {
    const key = it.customerId ? `c:${it.customerId}` : `l:${it.leadId}` ;
    const prev = seen.get(key);
    if (prev) { (prev.also ||= []).push(it.why); continue; }
    seen.set(key, it);
  }
  return [...seen.values()];
}

export const KIND_LABEL = {
  never_replied: "Never replied",
  reminder: "Your reminders",
  going_quiet: "Going quiet",
  renewal: "Renewals due",
  trade_up: "Trade-up ready",
};
