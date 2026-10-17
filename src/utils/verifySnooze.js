// "Get verified" prompts can be closed; they come back after a week (owner,
// 2026-10-17). The ID check only earns the Verified badge (20261017b), so this
// is a nudge, not a state the seller must fix, and a nudge that never goes
// away is noise. One key per account, per device (xd_* like other prefs).
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const key = (uid) => `xd_verify_snooze_${uid || "anon"}`;

export function isVerifySnoozed(uid) {
  try {
    const at = Number(localStorage.getItem(key(uid)));
    return !!at && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snoozeVerify(uid) {
  try { localStorage.setItem(key(uid), String(Date.now())); } catch { /* private mode: closes for this view only */ }
}
