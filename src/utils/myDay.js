// Malaysia's calendar day as a time range, and a typed date-time turned into a
// real instant. Malaysia is UTC+8 all year (no daylight saving), so the offset is fixed.

// "YYYY-MM-DD" of the given instant in Malaysia.
export function malaysiaDate(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
}

// { start, end } ISO instants for the Malaysian day containing `d`: start is that
// midnight, end is the next midnight. Query with gte(start) + lt(end).
// The old "today" filter used the UTC date (before 8am in Malaysia that is
// yesterday) and had no end, so it counted every future booking too.
export function malaysiaDayBounds(d = new Date()) {
  const day = malaysiaDate(d);
  const start = new Date(`${day}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// A <input type="datetime-local"> value ("2026-11-09T15:00") has no time zone.
// Sent raw, the database reads it as UTC, so 3pm became 11pm in Malaysia.
// Read it in the device's own zone, like the seller panels do, and send the
// instant. Returns null for an empty or unreadable value.
export function localInputToIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
