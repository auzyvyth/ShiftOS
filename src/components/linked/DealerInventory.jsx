// Linked-Premium "Dealer cars" tab: the dealer's open stock, and a one-tap way to feature a
// car on MY listings (salesman_listings) or take it off again. Moved out of the old
// dealer SalesmanPanel (renderInventory / addCarToMyDeals) so the Premium panel has the
// same dealer connection. Rules kept from there:
//  - a car the dealer assigned to one rep is closed to everyone else (assigned_to is null)
//  - featuring a car does NOT create a lead
//  - a salesman never sees cost; a margin-based commission shows as "set by dealer"
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Car } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { premiumDark as PD } from "../../theme/tokens";
import { suggestCommission } from "../../utils/commission";

const COLS = "id, slug, year, brand, model, variant, selling_price, images, mileage, transmission, fuel_type, commission_amount, assigned_to, status";

export default function DealerInventory({ dealerId, userId, myCarIds, onFeatured, onUnfeatured }) {
  const [cars, setCars] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(false);
  const [commConfig, setCommConfig] = useState(null);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!dealerId) return undefined;
    let live = true;
    supabase.from("car_listings").select(COLS)
      .eq("dealer_id", dealerId).eq("status", "available").is("assigned_to", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!live) return;
        if (error) { setLoadError(true); setCars([]); return; }
        setCars(data || []);
      });
    supabase.from("profiles").select("commission_config").eq("id", dealerId).maybeSingle()
      .then(({ data }) => { if (live && data?.commission_config) setCommConfig(data.commission_config); });
    return () => { live = false; };
  }, [dealerId]);

  const commission = (car) => {
    const explicit = Number(car?.commission_amount) || 0;
    if (explicit > 0) return explicit;
    if (!commConfig) return null;
    return suggestCommission(commConfig, { sell: car?.selling_price }); // no cost passed: a margin rule gives null
  };

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !cars) return cars || [];
    return cars.filter((c) => [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" ").toLowerCase().includes(s));
  }, [cars, q]);

  const feature = async (car) => {
    if (busyId) return;
    setBusyId(car.id);
    const { error } = await supabase.from("salesman_listings").insert({ dealer_id: dealerId, salesman_id: userId, listing_id: car.id });
    setBusyId(null);
    if (error && error.code !== "23505") { toast.error("Could not add this car to your listings"); return; }
    onFeatured?.(car);
    toast.success(`${[car.year, car.brand, car.model].filter(Boolean).join(" ")} added to your listings`);
  };

  const unfeature = async (car) => {
    if (busyId) return;
    setBusyId(car.id);
    const { data, error } = await supabase.from("salesman_listings").delete()
      .eq("salesman_id", userId).eq("listing_id", car.id).select("listing_id");
    setBusyId(null);
    if (error || !data?.length) { toast.error("Could not remove this car"); return; }
    onUnfeatured?.(car);
  };

  const card = { background: PD.card, borderRadius: PD.radius.card, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 };

  return (
    <div style={{ maxWidth: 1100 }}>
      <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: PD.text }}>Dealer cars</p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: PD.textMuted }}>
        The dealership's open stock. Add a car to your listings to share it and work its buyers.
      </p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search make, model, year"
        style={{ width: "100%", maxWidth: 360, marginBottom: 16, background: PD.raised, border: "none", borderRadius: PD.radius.row, color: PD.text, fontSize: 14, padding: "11px 14px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      {cars === null ? (
        <p style={{ fontSize: 13, color: PD.textMuted }}>Loading dealer cars...</p>
      ) : loadError ? (
        <p style={{ fontSize: 13, color: PD.accentText }}>Could not load the dealer's cars. Pull to refresh and try again.</p>
      ) : shown.length === 0 ? (
        <p style={{ fontSize: 13, color: PD.textMuted }}>{cars.length === 0 ? "No open cars right now." : "No cars match your search."}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))", gap: 14 }}>
          {shown.map((car) => {
            const mine = myCarIds.has(car.id);
            const comm = commission(car);
            const img = Array.isArray(car.images) ? car.images[0] : null;
            return (
              <div key={car.id} style={card}>
                <div style={{ aspectRatio: "16 / 10", background: PD.raised }}>
                  {img
                    ? <img src={img} alt="" loading="lazy" width="400" height="250" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: PD.textMuted }}><Car size={28} /></div>}
                </div>
                <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: PD.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {[car.year, car.brand, car.model].filter(Boolean).join(" ")}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: PD.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {[car.variant, car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null, car.transmission].filter(Boolean).join(" · ")}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: PD.text, fontVariantNumeric: "tabular-nums" }}>
                    {car.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : "Ask for price"}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: comm != null ? PD.up : PD.textMuted }}>
                    {comm != null ? `Earn RM ${comm.toLocaleString("en-MY")}` : "Commission set by dealer"}
                  </p>
                  <div style={{ marginTop: "auto", paddingTop: 8 }}>
                    {mine ? (
                      <button type="button" onClick={() => unfeature(car)} disabled={busyId === car.id}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: PD.radius.row, background: PD.raised, color: PD.textSec, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {busyId === car.id ? "Removing..." : "On your listings. Remove"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => feature(car)} disabled={busyId === car.id}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: PD.radius.row, background: PD.accent, color: PD.onAccent, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: busyId === car.id ? 0.6 : 1 }}>
                        {busyId === car.id ? "Adding..." : "Add to my listings"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
