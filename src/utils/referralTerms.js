// Invite reward terms (REFER-2, two-sided). ONE place for the numbers and the
// sentences, shared by ReferralCard (Lite + Premium settings), the /plans
// invite banner and CarForm's "listing cap reached" box.
//
// The numbers MUST match supabase/migrations/20261102b_referral_two_sided.sql
// (referral_grant_bonus: v_days, v_slots, the 10-slot cap, 12 a year) and
// grant_referral_reward (30 days after two payments). Change one, change both.

export const REWARD_DAYS = 7;          // Premium days, each side
export const REWARD_SLOTS = 2;         // extra car slots, each side, kept for good
export const MAX_BONUS_SLOTS = 10;     // most extra slots one seller can hold
export const MAX_REWARDS_PER_YEAR = 12; // inviter side only
export const PAID_BONUS_DAYS = 30;     // inviter, once the friend has paid Premium twice

// What one reward gives, worded for the plan the reader is on now.
export function rewardLines(tier) {
  const premium = tier === 'premium';
  return [
    premium
      ? `${REWARD_DAYS} days added to your Premium`
      : `${REWARD_DAYS} days of Premium free, then you are back on Lite with nothing lost`,
    `${REWARD_SLOTS} extra car slots that stay for good (up to ${MAX_BONUS_SLOTS} extra)`,
  ];
}

// The state of one invited seller, as get_my_referrals().people returns it.
export const PERSON_STATE = {
  waiting: 'Waiting for their first car to go live',
  granted: 'Reward given to you both',
  capped: `Their reward given. Yours was over the ${MAX_REWARDS_PER_YEAR}-a-year limit`,
  ineligible: 'Not counted: both accounts use the same phone number',
};
