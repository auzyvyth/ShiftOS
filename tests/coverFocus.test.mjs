import assert from "node:assert/strict";
import { coverFocusY, withCoverFocus, coverObjectPosition, COVER_FOCUS_DEFAULT } from "../src/utils/coverFocus.js";

const base = "https://x.supabase.co/storage/v1/object/public/avatars/u/cover.jpg";
assert.equal(coverFocusY(null), COVER_FOCUS_DEFAULT);
assert.equal(coverFocusY(`${base}?t=1`), 50, "no fy = middle");
assert.equal(coverFocusY(`${base}?t=1&fy=20`), 20);
assert.equal(coverFocusY(`${base}?fy=0&t=1`), 0);
assert.equal(coverFocusY(`${base}?t=1&fy=999`), 100, "clamped");
assert.equal(coverFocusY(`${base}?t=1&xfy=20`), 50, "only the fy param");

assert.equal(withCoverFocus(`${base}?t=1`, 30), `${base}?t=1&fy=30`);
assert.equal(withCoverFocus(`${base}?t=1&fy=30`, 70), `${base}?t=1&fy=70`, "replaced, not added twice");
assert.equal(withCoverFocus(`${base}?fy=30&t=1`, 10), `${base}?t=1&fy=10`);
assert.equal(withCoverFocus(base, 12.6), `${base}?fy=13`, "rounded, first param");
assert.equal(withCoverFocus(`${base}?t=1`, -5), `${base}?t=1&fy=0`);
assert.equal(coverFocusY(withCoverFocus(`${base}?t=9`, 42)), 42, "round trip");
assert.equal(coverObjectPosition(`${base}?t=1&fy=25`), "50% 25%");
assert.equal(withCoverFocus(null, 10), null);
console.log("coverFocus: all passed");
