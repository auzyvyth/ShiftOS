import { BadgeCheck, Clock } from "lucide-react";
import AccountReviewBanner from "../AccountReviewBanner";

/**
 * The ONE account-status card at the top of a seller panel (Lite + Premium).
 *
 * A new seller used to get three stacked banners on first landing, all about
 * the same thing: AccountReviewBanner ("under review"), VerifyBadgePrompt
 * ("buyers can't see your cars yet") and IcVerifyBanner ("add your IC"). Three
 * cards, two buttons, one job. Owner, 2026-10-12: "too much". Now:
 *   - rejected            -> AccountReviewBanner (it carries the reason to fix)
 *   - ID not yet checked  -> this card: an invitation to get verified, with
 *                            ONE button to the MyKad upload
 *   - ID checked, account
 *     still pending       -> AccountReviewBanner (Find me is what that gates)
 *   - otherwise           -> nothing
 *
 * Facts, keep them true: cars show to buyers only once is_verified is set by a
 * person at XDrive (public_car_listings, 20261011b). The IC
 * number used to be required too; it is optional since 2026-10-12 (owner: as
 * little friction as possible while we grow), so it is not a step here.
 * Worded as an invitation ("Get verified"), not a demand, but it must stay
 * true: an unverified seller's cars are NOT on the marketplace yet. No
 * dismiss: the state is real until it changes.
 */
export default function SellerIdCard({ profile, t, onUploadId }) {
  if (!profile) return null;
  if (profile.approval_status === "rejected") return <AccountReviewBanner profile={profile} />;
  if (profile.is_verified) return <AccountReviewBanner profile={profile} />;

  const tr = (key, fallback) => (t ? t(`sellerId.${key}`, { defaultValue: fallback }) : fallback);
  const checking = !!profile.kyc_submitted_at;
  const Icon = checking ? Clock : BadgeCheck;

  return (
    <div
      style={{
        display: "flex", gap: 11, alignItems: "center", flexWrap: "wrap",
        padding: "12px 14px",
        marginBottom: 16,
        borderRadius: 10,
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Icon size={18} style={{ color: checking ? "#facc15" : "#4ade80", flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: "1 1 180px" }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#f1f5f9" }}>
          {checking ? tr("checkingTitle", "We're checking your ID") : tr("title", "Get verified")}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.5 }}>
          {checking
            ? tr("checkingBody", "Your cars show to buyers once it's approved. Keep adding cars and taking leads meanwhile.")
            : tr("body", "Verified sellers' cars show to buyers on XDrive. A photo of your MyKad and a selfie, about 2 minutes.")}
        </p>
      </div>
      {!checking && onUploadId && (
        <button
          onClick={onUploadId}
          style={{
            background: "#dc2626", border: "none", borderRadius: 8, color: "#fff",
            fontSize: 12.5, fontWeight: 700, padding: "8px 14px", cursor: "pointer",
            whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0,
          }}
        >
          {tr("cta", "Get verified")}
        </button>
      )}
    </div>
  );
}
