import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";

// Quiet nudge for a missing IC — NOT a gate. Used to be a full-screen modal
// that force-opened itself the moment `icEnforced` (SalesmanLite.jsx) went
// true, which fired on first paint against the CACHED profile seed (panelCache
// strips the raw ic_hash before it touches disk, so the very first frame reads
// `ic_hash: undefined` even for a seller who verified at onboarding — the popup
// fired on every landing until the live fetch caught up and closed nothing back
// down). Same shape/tone as AccountReviewBanner: small, inline, dismissible.
//
// Dismissal is DAY-SCOPED, not permanent: closing it hides it until midnight,
// then it's back if the IC still isn't on file. localStorage only (no DB
// column for this) — losing the dismiss on a new device just means one extra
// day of seeing the banner, not a real cost.
const dismissKey = (userId) => `ic_banner_dismissed_${userId}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function IcVerifyBanner({ profile, userId, onVerify }) {
  const [dismissedNow, setDismissedNow] = useState(false);

  if (!profile || profile.ic_hash) return null;
  if (dismissedNow) return null;
  try {
    if (userId && localStorage.getItem(dismissKey(userId)) === today()) return null;
  } catch { /* private mode — just show it */ }

  const enforced = !!(
    profile.created_at &&
    (Date.now() - new Date(profile.created_at).getTime()) >= 7 * 86400000
  );

  const dismiss = () => {
    setDismissedNow(true);
    try { if (userId) localStorage.setItem(dismissKey(userId), today()); } catch { /* ignore */ }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 11,
        alignItems: "flex-start",
        padding: "12px 14px",
        marginBottom: 16,
        borderRadius: 10,
        background: "rgba(220,38,38,0.06)",
        border: "1px solid rgba(220,38,38,0.2)",
      }}
    >
      <ShieldCheck size={16} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#f1f5f9" }}>
          {enforced ? "Your IC is required to keep listing" : "Add your IC to list cars"}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
          Buyers need to know they're dealing with a real, accountable seller. It's a
          one-time number entry — never shown to buyers.
        </p>
        <button
          onClick={onVerify}
          style={{ marginTop: 9, fontSize: 12.5, fontWeight: 700, color: "#f87171", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
        >
          Add IC number →
        </button>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss for today"
        style={{ flexShrink: 0, background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
