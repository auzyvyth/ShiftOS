// A seller has a rejection to deal with when a `listing_rejected` notification
// is still unread AND the car it points at is still rejected (a resubmitted car
// has moved back to pending, so the old notification no longer counts).
// Lite and Premium both use it to open the Listings page on the Rejected tab —
// the list defaults to Available, which is where a rejected car "disappeared".
export function hasUnreadRejection(notifications, listings) {
  const rejected = new Set((listings || []).filter((c) => c.status === "rejected").map((c) => c.id));
  if (!rejected.size) return false;
  return (notifications || []).some((n) => !n.is_read && n.type === "listing_rejected" && rejected.has(n.ref_id));
}
