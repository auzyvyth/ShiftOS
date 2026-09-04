/**
 * Client-side mirror of the DB's redact_for_ai() (used on chat_messages.body_ai).
 *
 * Why this exists: lead scoring sends the rep's own free-text `notes` to the AI
 * (SalesmanPremium.jsx). `phone` was already reduced to "present"/"missing", so
 * someone had thought about the structured fields — but notes are typed by hand
 * and routinely hold a phone number, an IC or an email that the rep jotted down
 * mid-call. Those left the browser in the clear.
 *
 * Same rule as the chat side: the AI never needs to read a real number to do its
 * job, so it does not get one. Masking, not deletion — "call back after 6, IC
 * [ic]" still scores the same as the original.
 */

// Order matters: email before phone, or the digits inside an address get eaten.
const RULES = [
  // Email addresses.
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  // Malaysian IC: 12 digits, optionally hyphenated 6-2-4.
  [/\b\d{6}[-\s]?\d{2}[-\s]?\d{4}\b/g, "[ic]"],
];

// Any other run of digits (hyphens/spaces allowed inside) holding 9 or more
// actual DIGITS — the same 9-digit floor the DB function uses. It sits below
// every real Malaysian mobile number and above a price, a mileage or a year, so
// "budget 120k" and "45,000 - 50,000" survive and "0123456789" does not. The
// digit count is checked in the callback, not by the pattern length: a pattern
// counting CHARACTERS eats a spaced-out price range.
const NUMBER_RUN = /\b\d[\d\s-]{7,}\d\b/g;

export function redactForAI(text) {
  if (!text) return text;
  let out = String(text);
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out.replace(NUMBER_RUN, (run) =>
    (run.match(/\d/g) || []).length >= 9 ? "[number]" : run,
  );
}
