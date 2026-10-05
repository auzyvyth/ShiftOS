// What state is this account in? Answered ONCE, for every platform-console tab.
//
// The console used to read raw columns and paint them: a dimmed row for
// is_active=false, "Expired" in red for subscription_status='expired', "cannot
// reach their dashboard" for approval_status='pending'. Several of those columns
// no longer mean what the console assumed:
//   * approval_status='pending' does not lock anyone out (20260912b/c lifted the
//     gate) -- it means "nobody has checked their identity yet".
//   * subscription_status means nothing for a standalone salesman. Lite is free
//     forever; Premium runs on plan_expires_at (is_salesman_premium ignores it).
//     A free Lite seller showed as red "Expired".
//   * is_active=false without suspended_at is NOT a suspension. Two dealers sat
//     like that, greyed out in Billing with no word, green "Active" in Accounts.
//   * subscription_status='active' on a dealer is a dropdown someone set, not a
//     payment. It counted in "Paying" and MRR whether money arrived or not.
//
// So an account is three separate answers, each with words:
//   access   can they use their dashboard?
//   review   has a person checked who they are?
//   billing  what are they on, and has money arrived?
// Every coloured or dimmed thing in the console must come from one of these.
// Pure (no imports) so `npm run test:accountstate` runs it in plain node.

const DAY = 86400000;
const TONE = { ok: "#4ade80", warn: "#facc15", bad: "#f87171", info: "#60a5fa", muted: "#9ca3af" };

const ms = (d) => (d ? new Date(d).getTime() : null);
const shortDate = (d) => new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short" });

// "dealer_id IS NULL means they are their own dealer" -- the rule the whole
// platform turns on, named once.
export function accountKind(a) {
  if (["dealer", "owner", "superadmin"].includes(a.role)) return "dealer";
  return a.dealer_id ? "linked" : "solo";
}

// The platform's own account(s). Not a customer: never a dealer count, never revenue.
export function isPlatformAccount(a) {
  return a.role === "superadmin" || a.plan === "superadmin";
}

export function accessState(a, now = Date.now()) {
  if (a.account_status === "deleted") {
    const left = a.deleted_at ? Math.max(0, 30 - Math.floor((now - ms(a.deleted_at)) / DAY)) : null;
    return { id: "deleted", text: left !== null ? `Deleted · purges in ${left}d` : "Deleted", color: TONE.muted };
  }
  if (a.is_active === false && a.suspended_at) return { id: "suspended", text: "Suspended", color: TONE.bad };
  if (a.approval_status === "rejected") return { id: "rejected", text: "Rejected · can't list cars", color: TONE.bad };
  if (!a.onboarding_complete) return { id: "unfinished", text: "Never finished signing up", color: TONE.muted };
  if (a.is_active === false) {
    return {
      id: "off", color: TONE.warn,
      text: "Switched off · no reason recorded",
      why: "This account is switched off but was never suspended, so there is no reason on file and the seller was never told. Its cars are hidden from the marketplace. Suspend it with a reason, or switch it back on.",
    };
  }
  return { id: "in", text: "Using their dashboard", color: TONE.ok };
}

// Only self-signup sellers (dealers, standalone salesmen) go through review. A
// salesman under a dealer was vouched for by that dealer.
export function reviewState(a) {
  if (accountKind(a) === "linked" || isPlatformAccount(a)) return null;
  if (a.approval_status === "pending") {
    if (!a.onboarding_complete) return null; // nothing to check yet
    // Wording must match what is actually enforced: a salesman's car is held
    // for Cars to approve (CarForm needsApproval), a dealer's car is published
    // straight away, and the only thing approval gates is find_me_reply.
    return {
      id: "pending", text: "Waiting on your ID check", color: TONE.warn,
      why: accountKind(a) === "dealer"
        ? "They are already in their dashboard, and a dealer's cars go live on the marketplace straight away, before this check. Approving them unlocks answering Find me posts."
        : "They are already in their dashboard and can list cars; each car still waits for you in Cars to approve. Approving them unlocks answering Find me posts.",
    };
  }
  if (a.approval_status === "rejected") return { id: "rejected", text: "Rejected", color: TONE.bad };
  return { id: "approved", text: "Checked", color: TONE.ok };
}

export function billingState(a, now = Date.now()) {
  if (isPlatformAccount(a)) return { id: "platform", text: "Platform account", color: TONE.muted, paying: false };
  const kind = accountKind(a);
  if (kind === "linked") return { id: "via_dealer", text: "Covered by their dealer", color: TONE.muted, paying: false };

  if (kind === "solo") {
    if (a.plan !== "salesman_full") return { id: "lite", text: "Lite · free", color: TONE.muted, paying: false };
    if (a.payment_status === "received") {
      // Pre-REFER-1 flag: it never expired. Still counts, but say what it is.
      return { id: "paid", text: "Premium · paid (old flag, no end date)", color: TONE.ok, paying: true };
    }
    const exp = ms(a.plan_expires_at);
    if (exp && exp > now) {
      const started = ms(a.premium_trial_started_at);
      // start_premium_trial / the signup trigger set both stamps 30 days apart;
      // a logged payment moves plan_expires_at further out.
      const freeMonth = started && Math.abs(exp - started - 30 * DAY) < DAY;
      return freeMonth
        ? { id: "free_month", text: `Free month · until ${shortDate(exp)}`, color: TONE.info, paying: false }
        : { id: "paid", text: `Premium · paid until ${shortDate(exp)}`, color: TONE.ok, paying: true };
    }
    if (exp) return { id: "lapsed", text: `Premium lapsed ${shortDate(exp)} · on Lite limits`, color: TONE.bad, paying: false };
    return { id: "unpaid", text: "Picked Premium · never paid", color: TONE.bad, paying: false };
  }

  // Dealer
  if (a.subscription_status === "trial") {
    const end = ms(a.trial_ends_at);
    if (end === null) return { id: "trial", text: "Trial", color: TONE.info, paying: false };
    const left = Math.ceil((end - now) / DAY);
    return left < 0
      ? { id: "lapsed", text: `Trial ended ${shortDate(end)}`, color: TONE.bad, paying: false }
      : { id: "trial", text: `Trial · ${left}d left`, color: TONE.info, paying: false };
  }
  if (a.subscription_status === "expired") return { id: "lapsed", text: "Expired", color: TONE.bad, paying: false };
  if (a.payment_status === "received") return { id: "paid", text: "Paid", color: TONE.ok, paying: true };
  if (a.subscription_status === "active") {
    return {
      id: "unconfirmed", text: "Marked active · no payment logged", color: TONE.warn, paying: false,
      why: "Someone set this account to active, but no payment was ever marked received. It is not counted as revenue.",
    };
  }
  return { id: "unpaid", text: "No plan", color: TONE.muted, paying: false };
}

// The one line a table row shows: a blocking access problem wins, otherwise
// the billing answer. Review rides alongside as its own pill, never replaces it.
export function headlineState(a, now = Date.now()) {
  const acc = accessState(a, now);
  return acc.id === "in" ? billingState(a, now) : acc;
}

// Status filter ids for the Accounts tab. Each matches on the answer it names.
export const STATUS_FILTERS = [
  { id: "all", label: "Any status" },
  { id: "review", label: "Waiting on ID check" },
  { id: "paid", label: "Paying" },
  { id: "free", label: "Free month / trial" },
  { id: "lite", label: "Lite (free)" },
  { id: "money", label: "Lapsed / never paid / unconfirmed" },
  { id: "off", label: "Suspended / switched off" },
  { id: "unfinished", label: "Never finished signing up" },
  { id: "deleted", label: "Deleted" },
];

export function matchesStatusFilter(a, f, now = Date.now()) {
  if (f === "all") return true;
  const acc = accessState(a, now);
  if (f === "deleted") return acc.id === "deleted";
  if (f === "unfinished") return acc.id === "unfinished";
  if (f === "off") return acc.id === "suspended" || acc.id === "off";
  if (f === "review") return reviewState(a)?.id === "pending";
  if (acc.id === "deleted") return false;
  const b = billingState(a, now).id;
  if (f === "paid") return b === "paid";
  if (f === "free") return b === "free_month" || b === "trial";
  if (f === "lite") return b === "lite";
  if (f === "money") return b === "lapsed" || b === "unpaid" || b === "unconfirmed";
  return true;
}
