// "Copy for WhatsApp" for a seller's own car, shared by Lite and Premium.
// Used and recon cars: buildCopyText, instant. New-car cards: the BM caption
// built from the price list (newCarCaption.js), which needs one read first.
//
// The read happens AFTER the tap, and Safari only lets a page write the
// clipboard inside the tap itself. Handing ClipboardItem a PROMISE keeps the
// write inside the tap while the text is still loading; browsers without it
// get a plain writeText once the text is ready.
import { supabase } from "../supabaseClient";
import { buildCopyText } from "./listingCopy";
import { buildNewCarCaption } from "./newCarCaption";

const isNewCarCard = (car) => !!car?.new_car_model_id && !car?.new_car_unit;

async function captionFor(car, link) {
  const plain = `${buildCopyText(car)}\n👉 ${link}`;
  if (!isNewCarCard(car)) return plain;
  try {
    const [info, own] = await Promise.all([
      supabase.rpc("get_new_car_listing_info", { p_listing_id: car.id }).maybeSingle(),
      // The panels' listing selects do not carry description ("What you offer").
      supabase.from("car_listings").select("description, colour").eq("id", car.id).maybeSingle(),
    ]);
    if (info.error || !info.data) return plain;
    return buildNewCarCaption({ listing: { ...car, ...(own.data || {}) }, info: info.data, link });
  } catch {
    return plain;
  }
}

export async function copyListingCaption(car, link) {
  const text = captionFor(car, link);
  if (typeof window !== "undefined" && window.ClipboardItem && navigator.clipboard?.write) {
    try {
      const blob = text.then((t) => new Blob([t], { type: "text/plain" }));
      await navigator.clipboard.write([new window.ClipboardItem({ "text/plain": blob })]);
      return;
    } catch { /* fall through to writeText */ }
  }
  await navigator.clipboard.writeText(await text);
}
