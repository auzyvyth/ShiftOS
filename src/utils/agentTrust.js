// Trust signals on the agent page (/s/:slug) — the wording and thresholds in
// one place. Every line here states something measured or something the seller
// set themselves; nothing is inferred on their behalf.
//
// Pure: no React, no Supabase (tests/agentTrust.test.mjs).

// What a deposit policy means to a buyer. Shared with CarDetailPage's
// DepositTerms so a car page and its agent's page never word one policy two ways.
export const DEPOSIT_POLICY_COPY = {
  refundable: 'Refundable if you decide not to go ahead.',
  refundable_on_loan_rejection:
    'Refunded in full if your loan is rejected. Otherwise it is held against the purchase price.',
  non_refundable: 'Non-refundable once paid.',
};

// Below this many answered-or-expired buyer messages, a median says more about
// luck than about the agent, so the page says nothing.
export const REPLY_MIN_SAMPLES = 5;

// Measured reply time (get_agent_reply_time) as a buyer reads it. Rounded UP
// to a coarse bucket: "within 15 minutes" for a 6-minute median is a promise
// the agent keeps; "6 minutes" invites a stopwatch. Past a day it is not a
// selling point, so it is not shown.
export function replyTimeLabel(reply) {
  const m = Number(reply?.median_minutes);
  const n = Number(reply?.samples);
  if (!Number.isFinite(m) || !(n >= REPLY_MIN_SAMPLES)) return null;
  if (m <= 5) return 'Usually replies within 5 minutes';
  if (m <= 15) return 'Usually replies within 15 minutes';
  if (m <= 60) return 'Usually replies within an hour';
  if (m <= 240) return 'Usually replies within a few hours';
  if (m < 1440) return 'Usually replies within a day';
  return null;
}

// "Documents checked by XDrive on 2 of 3 cars". Only cars a superadmin ticked
// in the review console count (car_listings.docs_verified — set only through
// set_listing_docs_verified, and trg_protect_listing_docs_verified stops a
// seller writing it). None checked = say nothing, rather than advertise a zero.
export function docsCheckedLine(listings) {
  const total = (listings || []).length;
  const checked = (listings || []).filter((c) => c?.docs_verified === true).length;
  if (!total || !checked) return null;
  return checked === total
    ? `Documents checked by XDrive on ${total === 1 ? 'this car' : `all ${total} cars`}`
    : `Documents checked by XDrive on ${checked} of ${total} cars`;
}

// The seller's own terms, only the parts they actually set. handles_roadtax_insurance
// defaults to true in the DB, so only an explicit false is a statement (same
// rule as CarDetailPage's fee breakdown).
export function termsLines(seller) {
  if (!seller) return [];
  const out = [];
  const copy = DEPOSIT_POLICY_COPY[seller.deposit_policy];
  if (copy) out.push({ key: 'deposit', label: 'Deposit', text: copy });
  const fee = seller.processing_fee;
  if (fee !== null && fee !== undefined && fee !== '' && Number.isFinite(Number(fee))) {
    out.push({
      key: 'fee', label: 'Handling fee',
      text: Number(fee) > 0 ? `RM ${Number(fee).toLocaleString('en-MY')}` : 'None charged',
    });
  }
  if (seller.handles_roadtax_insurance === false) {
    out.push({ key: 'rti', label: 'Road tax & insurance', text: 'Buyer arranges' });
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "Sep 2026" from a 'YYYY-MM-DD' month. Parsed by hand: new Date('2026-09-01')
// is UTC midnight and reads as August in any timezone west of it.
export function soldMonthLabel(d) {
  const m = /^(\d{4})-(\d{2})/.exec(String(d || ''));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}
