import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";

/**
 * One-line nudge to submit an ID, shown on the screen a seller actually opens
 * (their listings), with a button that takes them to the full VerifyIdentity
 * card in Settings.
 *
 * Why this exists: the upload step lived only in Salesman Lite's Settings, so
 * dealers and Salesman Premium had NO way to submit at all, and the marketplace
 * Verified tick was unearnable for them. Settings on its own is not enough
 * either — it is the screen nobody opens (the same reason PushToggle sat in
 * Settings and no seller ever found it).
 *
 * Dismissal is sessionStorage, deliberately: not component state (it would
 * reappear on every tab switch and become noise inside one sitting), and not
 * permanent localStorage (one reflexive tap would silence for good the single
 * prompt whose whole job is to be found). It comes back next sign-in, and stops
 * for good the moment an ID is submitted or the badge is granted.
 */
const KEY = "xd_verify_prompt_dismissed";

export default function VerifyBadgePrompt({ profile, onStart, theme = "dark" }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
  });

  // Nothing to ask for once the badge is granted or an ID is already in review.
  if (!profile || profile.is_verified || profile.kyc_submitted_at) return null;
  if (dismissed) return null;

  const dark = theme !== "light";
  const c = dark
    ? { bg: "rgba(37,99,235,0.07)", border: "rgba(37,99,235,0.22)", icon: "#60a5fa", text: "#cbd5e1", strong: "#e5e7eb", x: "#6b7280" }
    : { bg: "#eff6ff", border: "#bfdbfe", icon: "#2563eb", text: "#4b5563", strong: "#111827", x: "#9ca3af" };

  const close = () => {
    setDismissed(true);
    try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode — session-only is fine */ }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px",
      padding: "9px 12px", borderRadius: 10, background: c.bg,
      border: `1px solid ${c.border}`,
    }}>
      <ShieldCheck size={15} style={{ color: c.icon, flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 12.5, color: c.text, flex: 1, lineHeight: 1.45 }}>
        <strong style={{ color: c.strong, fontWeight: 600 }}>Get the Verified badge.</strong>{" "}
        Buyers are far more willing to message a seller whose identity has been checked.
      </p>
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
      <button
        onClick={close}
        aria-label="Dismiss"
        style={{ background: "none", border: "none", color: c.x, cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
