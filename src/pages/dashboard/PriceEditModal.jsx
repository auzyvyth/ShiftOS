import React, { useState } from "react";
import { X, Flame } from "lucide-react";
import { supabase } from "../../supabaseClient";

const T = {
  divider: { borderBottom: '1px solid rgba(255,255,255,0.048)' },
  btnRed: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(29,78,216,0.95))',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};

export default function PriceEditModal({ listing, onClose, onSave }) {
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
      onSave(data?.[0] ?? { ...listing, ...payload });
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
            <h3 className="font-semibold text-white">Adjust Price</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {listing.brand} {listing.model} {listing.variant || ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1 transition-colors"
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
              <span className="font-semibold grad-white">
                RM {cur.toLocaleString()}
              </span>
              {orig && (
                <span className="text-blue-400 text-xs font-medium bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
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
                className="w-full pl-12 pr-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white text-lg font-semibold focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/15 transition-all"
              />
            </div>
          </div>
          {npv > 0 && npv !== cur && (
            <div
              className={`px-4 py-3 rounded-xl border text-sm ${isReset ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" : isUp ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : isHot ? "bg-blue-500/10 border-red-500/20 text-blue-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}
            >
              {isReset && (
                <p className="font-medium">Price raised — discount badge removed</p>
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
            <p className="text-blue-400 text-xs bg-blue-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              ⚠ {err}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.09)" }}
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
