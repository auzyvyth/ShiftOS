import React from "react";
import { X, CheckCircle2 } from "lucide-react";

const T = {
  btnRed: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(29,78,216,0.95))',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};

export default function MarkSoldModal({ listing, onClose, onConfirm, loading }) {
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
            <h3 className="font-semibold text-white">Mark as Sold?</h3>
            <p className="text-gray-500 text-xs mt-0.5">
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
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
          style={{
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.18)",
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-emerald-300 text-sm font-semibold">
              Sold count will update automatically
            </p>
            <p className="text-emerald-500/60 text-xs mt-0.5">
              This listing moves to "Sold" and the sold counter updates in
              real-time.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn-shimmer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg,#16a34a,#15803d)",
              boxShadow: "0 2px 10px rgba(22,163,74,0.3)",
            }}
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
