import { ShieldCheck, Clock } from "lucide-react";

/**
 * Tells a seller their cars are hidden until their ID is checked, with a
 * button to the VerifyIdentity card in Settings.
 *
 * Since 2026-10-11 this is not a badge nudge any more: public_car_listings
 * only shows cars whose seller has profiles.is_verified (migration
 * 20261011b), so an unchecked seller's cars are invisible to buyers. The
 * prompt used to say "Get the Verified badge", be dismissible, and go quiet
 * once an ID was submitted, so a hidden seller had no way to know why
 * nobody could see their cars. Now:
 *   - not submitted -> "hidden until we check your ID" + Verify ID
 *   - submitted     -> "we're checking it, your cars go live after"
 *   - verified      -> nothing
 * No dismiss: the state it describes is real until it is fixed.
 *
 * Shown on the screen a seller actually opens (their listings / home), not
 * only in Settings, which nobody opens.
 */
export default function VerifyBadgePrompt({ profile, onStart, theme = "dark" }) {
  if (!profile || profile.is_verified) return null;
  const inReview = !!profile.kyc_submitted_at;

  const dark = theme !== "light";
  const c = dark
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
            Your cars show on XDrive as soon as it's approved.
          </>
        ) : (
          <>
            <strong style={{ color: c.strong, fontWeight: 600 }}>Buyers can't see your cars yet.</strong>{" "}
            XDrive only shows cars from sellers whose ID we've checked.
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
    </div>
  );
}
