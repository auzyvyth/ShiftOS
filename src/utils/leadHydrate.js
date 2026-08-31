import { supabase } from '../supabaseClient';

/*
 * Re-read one lead WITH its car join and merge it into pipeline state.
 *
 * Why this exists: the pipeline card reads `lead.car_listings` (the joined
 * object), not `lead.car_listing_id`. The bootstrap fetch selects that join —
 * and every other path that put a lead into state did not:
 *   - the realtime INSERT echo hands over `payload.new`, a raw table row
 *   - the client-side inserts used a bare `.select()`
 * So a lead that arrived without a page reload rendered with no car on it,
 * and a refresh "fixed" it. That is the whole bug behind "booked lead has no
 * linked car" and half of "the WhatsApp lead needs a refresh to show".
 *
 * The raw row is still added FIRST by the caller so the card appears instantly;
 * this fills in the car a moment later. Merge order matters: `{ ...existing,
 * ...fresh }` would let a null column in the fresh row blank a field the
 * optimistic write had already set, so the fresh row is the base and only its
 * own values win.
 */
export async function hydrateLeadInto(setLeads, id, select) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('leads')
    .select(select)
    .eq('id', id)
    .maybeSingle();
  // Non-fatal by design: the raw row is already on screen, it just has no car
  // on it. Losing the join is worse than losing the lead, not the other way round.
  if (error || !data) {
    if (error) console.error('hydrateLeadInto:', error);
    return null;
  }
  setLeads((p) => (p.some((l) => l.id === data.id)
    ? p.map((l) => (l.id === data.id ? { ...l, ...data } : l))
    : [data, ...p]));
  return data;
}

export default hydrateLeadInto;
