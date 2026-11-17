// One way for the dealer dashboard to sell a car TO A BUYER (DASH-TEST 2, SOLD-1).
// Used by both "Mark as Sold" pop-ups (Listings + Stock tab), so neither can drift into
// a status-only sale again. A won lead is the sale: `close_deal_at_price` sets the lead
// to won, and the DB trigger `auto_create_customer_on_won` marks the car sold, makes the
// customer row and seeds the handover steps. Nothing here writes the car's status.
//
// - leadId: a buyer already in the pipeline for this car.
// - newBuyer { name, phone }: a walk-in. A lead is made on this car first (lead_source
//   'walk_in'), then won, so the buyer gets a customer record like any other.
// Returns { status: 'won' | 'pending', leadId }. 'pending' = the price is over the
// discount limit and waits for the owner (the car is not sold yet).
import { supabase } from "../../supabaseClient";
import { toPlus60 } from "../../lib/phone";

export async function sellToBuyer({ dealerId, listingId, leadId = null, newBuyer = null, soldBy = null, soldPrice = null }) {
  let id = leadId;
  if (!id && newBuyer) {
    const { data, error } = await supabase.from("leads").insert({
      dealer_id: dealerId,
      car_listing_id: listingId,
      buyer_name: newBuyer.name.trim(),
      phone: newBuyer.phone ? toPlus60(newBuyer.phone) : null,
      stage: "negotiating",
      lead_source: "walk_in",
      salesman_id: soldBy || null,
    }).select("id");
    if (error) throw error;
    // RLS refuses as "0 rows, no error".
    if (!data?.length) throw new Error("lead_not_saved");
    id = data[0].id;
  }
  if (!id) throw new Error("no_buyer");

  const { data: res, error: rpcErr } = await supabase.rpc("close_deal_at_price", {
    p_lead: id, p_agreed: soldPrice ?? null, p_closer: soldBy || null,
  });
  if (rpcErr && rpcErr.code !== "PGRST202") throw rpcErr;
  if (res?.status === "pending") return { status: "pending", leadId: id };
  if (rpcErr) {
    // Function missing on this database (PGRST202): the old direct win.
    const { data: won, error: winErr } = await supabase
      .from("leads").update({ stage: "won", ...(soldBy ? { salesman_id: soldBy } : {}) }).eq("id", id).select("id");
    if (winErr) throw winErr;
    if (!won?.length) throw new Error("lead update refused");
  }
  return { status: "won", leadId: id };
}

// Words for the errors a sale can hit. Unknown errors get the generic line.
export function saleErrorText(e) {
  const m = String(e?.message || "");
  if (m.includes("car_already_won")) return "This car is already sold to another buyer. Undo that sale first.";
  if (m.includes("bad_price")) return "Enter the price agreed with the buyer.";
  if (m.includes("bad_closer")) return "That salesman is not on your team.";
  if (m.includes("lead_not_saved")) return "Could not save the buyer. You may not have permission.";
  if (m.includes("deal_closed")) return "That buyer's deal is already closed.";
  return "Could not mark the car as sold. Try again.";
}
