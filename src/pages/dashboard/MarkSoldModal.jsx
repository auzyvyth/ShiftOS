import { useEffect, useState, useRef } from "react";
import { useModalHistory } from "../../hooks/useModalHistory";
import { suggestCommission, describeCommissionRule } from "../../utils/commission";
import { supabase } from "../../supabaseClient";
import { border, font, premiumLight as PL } from "../../theme/tokens";
import "../../theme/premiumLight.css";
import { X, CheckCircle2 } from "lucide-react";

// Asks for the three things a sale needs and nothing else did: who sold it,
// what it actually sold for, and the commission. Without them 18 of 25 sold cars
// showed RM0 commission and 10 had no salesman, so commission and per-rep gross
// were wrong everywhere they are read. Each field starts from the car's own
// values, so a dealer who already filled them in just confirms.
// One popup for every "mark sold" on the dealer dashboard — the listings grid
// and the Stock tab both open it, so a sale always records who closed it, the
// price it went for and the commission. `showDate` + `cost` are the Stock tab's
// extras (it knows the purchase + recon cost; a margin rule needs it). A stock
// unit with no public listing has nowhere to store a closer or commission, so
// those two fields hide.
export default function MarkSoldModal({ listing, salesmen = [], onClose, onConfirm, loading, showDate = false, cost = null }) {
  useModalHistory(true, onClose);
  const hasListing = !!listing.id;
  const [soldDate, setSoldDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [soldBy, setSoldBy] = useState(listing.assigned_to || "");
  const [soldPrice, setSoldPrice] = useState(listing.selling_price != null ? String(listing.selling_price) : "");
  const [commission, setCommission] = useState(Number(listing.commission_amount) > 0 ? String(listing.commission_amount) : "");
  // No commission saved on the car -> fill it from the dealer's rule on the
  // price it actually sold for, and keep following that price until someone
  // types their own figure. A figure already on the car is kept as-is.
  const [commissionConfig, setCommissionConfig] = useState(null);
  // Who bought it: an open lead on this car. Picking one makes the sale a real win
  // (customer, handover steps, renewals); "no buyer" is a car sold off the platform.
  const [buyerLeads, setBuyerLeads] = useState([]);
  const [leadId, setLeadId] = useState("");
  useEffect(() => {
    if (!listing.id) return;
    supabase.from("leads").select("id, buyer_name, stage, salesman_id")
      .eq("car_listing_id", listing.id)
      .not("stage", "in", "(won,closed_won,lost,closed_lost)")
      .then(({ data }) => setBuyerLeads(data || []));
  }, [listing.id]);
  useEffect(() => {
    if (!listing.dealer_id) return;
    supabase.from("profiles").select("commission_config").eq("id", listing.dealer_id).maybeSingle()
      .then(({ data }) => setCommissionConfig(data?.commission_config || null));
  }, [listing.dealer_id]);
  const suggestedCommission = hasListing
    ? suggestCommission(commissionConfig, { sell: soldPrice, cost: cost ?? listing.base_price })
    : null;
  const lastAutoCommission = useRef(null);
  useEffect(() => {
    if (suggestedCommission == null) return;
    if (commission !== "" && commission !== lastAutoCommission.current) return;
    const next = String(suggestedCommission);
    lastAutoCommission.current = next;
    setCommission(next);
  }, [suggestedCommission]); // eslint-disable-line react-hooks/exhaustive-deps
  const fieldCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400";
  const labelCls = "block text-xs font-semibold text-gray-600 mb-1";
  const submit = () => onConfirm({
    soldBy: soldBy || null,
    soldPrice: soldPrice === "" ? null : Number(soldPrice),
    commission: commission === "" ? null : Number(commission),
    soldDate: soldDate || null,
    leadId: leadId || null,
  });
  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}
    >
      <div
        className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
        style={undefined}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Mark as Sold?</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              {listing.brand} {listing.model} {listing.variant || ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 mb-5">
          {hasListing && <div>
            <label className={labelCls}>Who bought it?</label>
            <select value={leadId} onChange={(e) => {
              setLeadId(e.target.value);
              const l = buyerLeads.find((x) => x.id === e.target.value);
              if (l?.salesman_id && !soldBy) setSoldBy(l.salesman_id);
            }} className={fieldCls}>
              <option value="">No buyer on file (sold elsewhere or walk-in)</option>
              {buyerLeads.map((l) => (
                <option key={l.id} value={l.id}>{l.buyer_name || "Unnamed buyer"} ({l.stage})</option>
              ))}
            </select>
            {!leadId && <p className="text-[11px] text-gray-500 mt-1">With no buyer, no customer record or handover steps are made.</p>}
          </div>}
          {hasListing && <div>
            <label className={labelCls}>Sold by</label>
            <select value={soldBy} onChange={(e) => setSoldBy(e.target.value)} className={fieldCls}>
              <option value="">No salesman (sold by the dealership)</option>
              {salesmen.map((sm) => (
                <option key={sm.id} value={sm.id}>{sm.full_name || sm.email || "Salesman"}</option>
              ))}
            </select>
          </div>}
          <div className={hasListing ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label className={labelCls}>Sold for (RM)</label>
              <input type="number" inputMode="numeric" min="0" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} className={fieldCls} />
            </div>
            {hasListing && <div>
              <label className={labelCls}>Commission (RM)</label>
              <input type="number" inputMode="numeric" min="0" value={commission} placeholder="Not set" onChange={(e) => setCommission(e.target.value)} className={fieldCls} />
              {suggestedCommission != null && commission === String(suggestedCommission) && (
                <p className="text-[11px] text-gray-500 mt-1">From your rule ({describeCommissionRule(commissionConfig)})</p>
              )}
            </div>}
          </div>
          {showDate && (
            <div>
              <label className={labelCls}>Sold on</label>
              <input type="date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} className={fieldCls} />
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="pl-btn-grey flex-1 px-4 py-2.5 rounded-xl text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40"
            style={{ background: PL.accent }}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Marking…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm Sold
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
