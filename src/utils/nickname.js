// A seller's nickname = their social media name ("fedaus"), NICKNAME-1 (owner, 2026-11-15). It is NOT the
// page name (`slug`, locked: it is the ?ref= key, the analytics key and the invite code) and NOT the
// full name. It is shown as "@fedaus" and told to Google so a buyer who knows the seller by it can find them.
// ONE place words the rules; the database enforces the same ones (migration 20261116b: nickname_problem()
// + trigger guard_profile_nickname), so a typed rule here is only a courtesy, never the lock.
// Pure: `npm run test:nickname`.
export const NICK_MIN = 2;
export const NICK_MAX = 30;
const BANNED = /(official|authori[sz]ed|verified|drevo|admin|support|moderator)/;

/** What the seller typed, made into what is saved: no @, no spaces. */
export function cleanNickname(v) {
  return String(v ?? '').trim().replace(/^@+/, '').replace(/\s+/g, '');
}

/** null when fine, else the reason (same codes as the database's nickname_problem). */
export function nicknameProblem(v) {
  const p = cleanNickname(v);
  if (!p) return null; // empty = no nickname, which is allowed
  if (p.length < NICK_MIN) return 'too_short';
  if (p.length > NICK_MAX) return 'too_long';
  if (!/^[A-Za-z0-9._]+$/.test(p) || /^\./.test(p) || /\.$/.test(p) || /\.\./.test(p)) return 'characters';
  const bare = p.replace(/[._]/g, '');
  if (/[0-9]{9,}/.test(bare)) return 'phone';
  if (BANNED.test(bare.toLowerCase())) return 'reserved';
  return null;
}

export const NICK_WORDS = {
  too_short: `At least ${NICK_MIN} characters.`,
  too_long: `At most ${NICK_MAX} characters.`,
  characters: 'Letters, numbers, a dot or an underscore only. No spaces, and no dot at the start, end or twice in a row.',
  phone: 'That looks like a phone number. Your number is never shown on your page.',
  reserved: 'That word is not allowed (official, verified, Drevo, admin and similar).',
  taken: 'Someone already uses that name. Try another.',
  sellers_only: 'Only sellers have a nickname.',
};

/** The database's exception text -> the same codes. */
export function nicknameErrorCode(error) {
  const msg = String(error?.message || '');
  const m = msg.match(/nickname_(too_short|too_long|characters|phone|reserved|taken|sellers_only)/);
  if (m) return m[1];
  if (error?.code === '23505' || /profiles_nickname_unique/.test(msg)) return 'taken';
  return null;
}
