// Drevo Pro (IDEA-34, 2026-11-13): the tier above Premium that holds "Post to socials".
// ONE place for its words and price, so the locked sheet, the console and any future pricing
// card read the same thing. It is NOT in PLAN_CONFIG on purpose: that map mirrors the
// `plan_config` table and renders in plan pickers; Pro has no self-serve signup yet.
//
// Owner's terms: paid upfront, no free trial, no pay = no use. Entitlement lives in the DB
// (`pro_subscriptions`, migration 20261114a; written only by `record_pro_payment`).
// Nothing here is a promise about WHEN a seller's own accounts are connected: until
// per-seller connect ships (docs/DREVO_ACTION_PLAN.md Z1) the posting engine only reaches
// the owner's test accounts, so the copy says "we connect your accounts after payment".
export const SOCIAL_PRO = {
  name: 'Drevo Pro',
  price: 129, // RM per month, PROPOSED 2026-11-13 (covers ~3-4 Zernio accounts per seller + margin); change here only
  networks: ['Facebook Page', 'Instagram', 'Threads', 'TikTok'],
  terms: 'Paid upfront. No free trial.',
  waText: 'Hi, I want Drevo Pro (Post to socials).',
};
