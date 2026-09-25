// Shared wording for "Find me" posts (FINDME-1): the board, the post page and
// (step 3) the seller inbox all name a post the same way.

export const MAX_SELLERS_PER_POST = 5;   // mirrors find_me_reply's cap
export const NOTE_MAX = 280;             // mirrors find_me_posts.note check

export function postTitle(p) {
  const car = [p.brand, p.model].filter(Boolean).join(' ') || 'Any car';
  if (p.min_year && p.max_year) {
    return p.min_year === p.max_year ? `${p.min_year} ${car}` : `${p.min_year}–${p.max_year} ${car}`;
  }
  if (p.min_year) return `${p.min_year} or newer ${car}`;
  if (p.max_year) return `${car}, ${p.max_year} or older`;
  return car;
}

export const postBudget = (p) =>
  Number(p.max_budget) > 0 ? `Up to RM ${Number(p.max_budget).toLocaleString('en-MY')}` : 'Budget open';

export const postPlace = (p) => p.state || 'Anywhere in Malaysia';

export function postAge(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function postDaysLeft(iso) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return Math.max(0, days);
}

// DB error codes (raised by the find_me_* functions) -> what the person reads.
const ERRORS = {
  sign_in_required: 'Please sign in first.',
  buyers_only: 'Posts are for buyer accounts. You are signed in as a seller.',
  invalid_brand: 'Pick a brand.',
  invalid_model: 'That model name is too long.',
  invalid_year: 'Check the years.',
  invalid_budget: 'Budget must be between RM 1,000 and RM 10,000,000.',
  note_too_long: `Keep the note under ${NOTE_MAX} characters.`,
  too_many_open_posts: 'You already have 3 open posts. Mark one as found or close it first.',
  rate_limited: 'You have posted 5 times today. Try again tomorrow.',
  not_a_seller: 'Only dealers and agents can answer posts.',
  seller_under_review: 'Your seller account is still being reviewed. You can answer posts once it is approved.',
  post_closed: 'This post is closed.',
  own_post: 'This is your own post.',
  invalid_message: 'Write a short message first.',
  post_full: `${MAX_SELLERS_PER_POST} sellers have already answered this post.`,
  daily_limit: 'You have answered 10 posts today. Try again tomorrow.',
};

export function findMeError(err) {
  const msg = String(err?.message || err || '');
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  return key ? ERRORS[key] : 'Something went wrong. Please try again.';
}
