import { useState } from "react";
import { useModalHistory } from "../../hooks/useModalHistory";
import { logActivity } from "../../utils/activityLog";
import { supabase } from "../../supabaseClient";
import { T } from "./shared";
import { border, font } from "../../theme/tokens";
import { X, Flame, Save } from "lucide-react";

export default function PriceEditModal({ listing, onClose, onSave, profile, dealerId }) {
  useModalHistory(true, onClose);
  const cur = listing.selling_price || 0;
  const orig = listing.original_price || null;
  const [np, setNp] = useState(String(cur));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const npv = parseFloat(np) || 0;
  const ref = orig || cur;
  const disc = ref > npv ? ref - npv : 0;
  const pct = ref > 0 ? (disc / ref) * 100 : 0;
  const isHot = pct >= 3,
    isUp = npv > cur,
    isReset = orig && npv >= orig;

  const handleSave = async () => {
    setErr("");
    if (!npv || npv <= 0) {
      setErr("Enter a valid price");
      return;
    }
    if (npv === cur) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      let payload = { selling_price: npv };
      if (isReset) payload.original_price = null;
      else if (!orig && npv < cur) payload.original_price = cur;
      const { data, error } = await supabase
        .from("car_listings")
        .update(payload)
        .eq("id", listing.id)
        .select();
      if (error) throw error;
      // A refused write comes back as 0 rows with no error: never report that as saved.
      if (!data?.length) throw new Error("The price was not saved. You may not have permission to change it.");
      const saved = data[0];
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: listing.id, action: 'price_changed', summary: `Price changed from RM ${cur.toLocaleString()} to RM ${npv.toLocaleString()} — ${listing.brand} ${listing.model} ${listing.year}`, fieldChanges: { selling_price: { from: cur, to: npv } } });
      onSave(saved);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}
    >
      <div
        className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden"
        style={undefined}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={T.divider}
        >
          <div>
            <h3 className="font-semibold text-gray-900">Adjust Price</h3>
            <p className="text-xs text-gray-500 mt-0.5">
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
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Current price</span>
            <div className="flex items-center gap-2">
              {orig && (
                <span className="text-gray-600 line-through text-xs">
                  RM {orig.toLocaleString()}
                </span>
              )}
              <span className="font-semibold text-gray-900">
                RM {cur.toLocaleString()}
              </span>
              {orig && (
                <span className="text-gray-700 text-xs font-medium pl-well px-2 py-0.5 rounded-full">
                  -{Math.round(((orig - cur) / orig) * 100)}%
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              New Selling Price (RM)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">
                RM
              </span>
              <input
                type="number"
                value={np}
                onChange={(e) => {
                  setNp(e.target.value);
                  setErr("");
                }}
                min="0"
                autoFocus
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-lg font-semibold focus:outline-none focus:border-red-400 transition-all"
              />
            </div>
          </div>
          {npv > 0 && npv !== cur && (
            <div
              className={`px-4 py-3 text-sm ${isUp ? "pl-note-bad" : "pl-note"}`}
            >
              {isReset && (
                <p className="font-medium">
                  Price raised — discount badge removed
                </p>
              )}
              {!isReset && isUp && (
                <p className="font-medium">
                  Price raised by RM {(npv - cur).toLocaleString()}
                </p>
              )}
              {!isReset && !isUp && (
                <>
                  <div className="flex items-center gap-2 font-semibold">
                    {isHot && <Flame className="w-4 h-4" />}
                    <span>
                      RM {disc.toLocaleString()} off ({pct.toFixed(1)}%)
                    </span>
                    {isHot && (
                      <span className="text-xs font-normal">Hot Deal!</span>
                    )}
                  </div>
                  <p className="text-xs opacity-70 mt-1">
                    {!orig
                      ? "Original price locked automatically"
                      : "Original stays locked"}
                  </p>
                  {isHot && (
                    <p className="text-xs opacity-70 mt-0.5">
                      Moves to Hot Deals
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {err && (
            <p className="pl-note-bad text-xs px-3 py-2">
              ⚠ {err}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all border border-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !npv || npv <= 0}
              className="btn-shimmer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-40 rounded-xl text-sm text-white font-semibold"
              style={T.btnRed}
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Price"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
