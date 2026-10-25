import { useState } from "react";
import { ShieldCheck, Clock, X } from "lucide-react";
import { isVerifySnoozed, snoozeVerify } from "../../utils/verifySnooze";
import { premiumDark } from "../../theme/tokens";

/**
 * Invites a seller to get the Verified badge, with a button to the
 * VerifyIdentity card in Settings.
 *
 * The ID check is for the BADGE, not a gate on listings (owner, 2026-10-17):
 * cars go live without it (migration 20261017b removed the 20261011b gate on
 * public_car_listings). Never tell a seller their cars are hidden because of it.
 *   - not submitted -> "get the Verified badge" + Verify ID
 *   - submitted     -> "we're checking it, the badge shows after"
 *   - verified      -> nothing
 *
 * Shown on the screen a seller actually opens (their listings / home), not
 * only in Settings, which nobody opens.
 */
// Closeable; comes back after a week (src/utils/verifySnooze.js), shared with
// SellerIdCard so closing one closes both.
export default function VerifyBadgePrompt({ profile, onStart, theme = "dark" }) {
  const [closed, setClosed] = useState(() => isVerifySnoozed(profile?.id));
  if (!profile || profile.is_verified || closed) return null;
  const close = () => { snoozeVerify(profile.id); setClosed(true); };
  const inReview = !!profile.kyc_submitted_at;

  // "premium" = the premiumDark palette (Salesman Premium tabs moved onto it):
  // a tone step up from the canvas, no amber, no outline.
  const c = theme === "premium"
    ? { bg: premiumDark.card, border: "transparent", icon: premiumDark.textSec, text: premiumDark.textSec, strong: premiumDark.text }
    : theme !== "light"
    ? { bg: "rgba(234,179,8,0.07)", border: "rgba(234,179,8,0.22)", icon: "#facc15", text: "#cbd5e1", strong: "#e5e7eb" }
    : { bg: "#fefce8", border: "#fde68a", icon: "#ca8a04", text: "#4b5563", strong: "#111827" };
  const Icon = inReview ? Clock : ShieldCheck;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px",
      padding: "9px 12px", borderRadius: 10, background: c.bg,
      border: `1px solid ${c.border}`,
    }}>
      <Icon size={15} style={{ color: c.icon, flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 12.5, color: c.text, flex: 1, minWidth: 0, lineHeight: 1.45 }}>
        {inReview ? (
          <>
            <strong style={{ color: c.strong, fontWeight: 600 }}>We're checking your ID.</strong>{" "}
            Your Verified badge shows as soon as it's approved.
          </>
        ) : (
          <>
            <strong style={{ color: c.strong, fontWeight: 600 }}>Get the Verified badge.</strong>{" "}
            Buyers trust sellers whose ID has been checked.
          </>
        )}
      </p>
      {!inReview && onStart && (
        <button
          onClick={onStart}
          style={{
            background: "#dc2626", border: "none", borderRadius: 7, color: "#fff",
            fontSize: 12, fontWeight: 700, padding: "6px 12px", cursor: "pointer",
            whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0,
          }}
        >
          Verify ID
        </button>
      )}
      <button type="button" aria-label="Close" onClick={close}
        style={{ background: "none", border: "none", color: c.icon, cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
        <X size={15} />
      </button>
    </div>
  );
}
