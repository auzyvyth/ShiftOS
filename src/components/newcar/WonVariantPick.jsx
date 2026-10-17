import { useEffect } from "react";
import { useNewCarInfo } from "./NewCarListingInfo";
import { rm } from "../../utils/newCars";

// "Which variant did they buy?" inside the mark-won confirm (owner,
// 2026-10-17). A new-car card covers every variant of a model (20261017c), so
// the win has to say which one: new_car_unit_on_won records the sold unit with
// the variant written to leads.new_car_model_id (checked server side: it must
// be a variant of the card's model). Renders nothing for a used car, a card
// with one variant, or before the migration (no `variants` yet), and then the
// unit takes the card's own variant as before.
//
// Starts on the cheapest, the card's "from" price, so a seller who just taps
// "Yes" records exactly what the card showed.
export default function WonVariantPick({ listingId, value, onChange }) {
  const info = useNewCarInfo(listingId);
  const variants = Array.isArray(info?.variants) ? info.variants.filter((v) => v.price != null) : [];
  const first = variants[0]?.model_id || null;
  useEffect(() => {
    if (first && !variants.some((v) => v.model_id === value)) onChange(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first]);
  if (variants.length < 2) return null;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, margin: "0 0 16px", fontSize: 12, fontWeight: 600, color: "#9ca3af" }}>
      Which {info.model} did they buy?
      <select value={value || first || ""} onChange={(e) => onChange(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 8, background: "#0b1220", border: "1px solid rgba(255,255,255,0.12)", color: "#f1f5f9", fontSize: 14, fontFamily: "inherit" }}>
        {variants.map((v) => (
          <option key={v.model_id} value={v.model_id}>{v.variant} · {rm(v.price)}</option>
        ))}
      </select>
    </label>
  );
}
