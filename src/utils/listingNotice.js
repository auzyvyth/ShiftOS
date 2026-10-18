// A car's review result arrives as a salesman_notifications row
// (listing_approved / listing_rejected, ref_id = the car). The panels showed
// the toast but kept the car's OLD status, so an approved car sat under
// "Pending" until a full reload (owner, 2026-10-18). One helper for Lite and
// Premium: re-read that car and swap it into the list.
//
// select("*") on purpose: the panels' lists hold every column the edit form
// and the detail popup read (overlay rule 4), and a partial row merged over a
// full one would blank them.
export const LISTING_REVIEW_TYPES = new Set(['listing_approved', 'listing_rejected']);

export function refreshListingFromNotice(client, notice, setListings) {
  if (!notice || !LISTING_REVIEW_TYPES.has(notice.type) || !notice.ref_id) return;
  client.from('car_listings').select('*').eq('id', notice.ref_id).maybeSingle()
    .then(({ data, error }) => {
      if (error || !data) return;
      setListings((rows) => (rows.some((c) => c.id === data.id)
        ? rows.map((c) => (c.id === data.id ? { ...c, ...data } : c))
        : rows));
    }, () => {});
}
