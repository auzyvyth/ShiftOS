import { ShieldCheck, Clock, Check } from "lucide-react";
import AccountReviewBanner from "../AccountReviewBanner";

/**
 * The ONE account-status card at the top of a seller panel (Lite + Premium).
 *
 * A new seller used to get three stacked banners on first landing, all about
 * the same thing: AccountReviewBanner ("under review"), VerifyBadgePrompt
 * ("buyers can't see your cars yet") and IcVerifyBanner ("add your IC"). Three
 * cards, two buttons, one job. Owner, 2026-10-12: "too much". Now:
 *   - rejected            -> AccountReviewBanner (it carries the reason to fix)
 *   - ID not yet checked  -> this card: one fact, two steps, ONE button that
 *                            goes to the next missing step
 *   - ID checked, account
 *     still pending       -> AccountReviewBanner (Find me is what that gates)
 *   - otherwise           -> nothing
 *
 * Facts, keep them true: cars show to buyers only once is_verified is set by a
 * person at XDrive (public_car_listings, 20261011b); listing a car needs the IC
 * number on file (ic_hash, the IC gate). ic_hash only means a number was typed,
 * so never call it "verified" here. No dismiss: the state is real until fixed.
 */
export default function SellerIdCard({ profile, t, onAddIc, onUploadId }) {
  if (!profile) return null;
  if (profile.approval_status === "rejected") return <AccountReviewBanner profile={profile} />;
  if (profile.is_verified) return <AccountReviewBanner profile={profile} />;

  const tr = (key, fallback) => (t ? t(`sellerId.${key}`, { defaultValue: fallback }) : fallback);

  const icDone = !!profile.ic_hash;
  const idDone = !!profile.kyc_submitted_at;
  const checking = icDone && idDone;

  const steps = [
    { key: "ic", done: icDone, label: tr("stepIc", "IC number") },
    { key: "id", done: idDone, label: tr("stepId", "MyKad photos") },
  ];
  const next = !icDone
    ? { label: tr("ctaIc", "Add IC number"), run: onAddIc || onUploadId }
    : !idDone
      ? { label: tr("ctaId", "Upload MyKad"), run: onUploadId }
      : null;

  const Icon = checking ? Clock : ShieldCheck;

  return (
    <div
      style={{
        padding: "12px 14px",
        marginBottom: 16,
        borderRadius: 10,
        background: "rgba(234,179,8,0.07)",
        border: "1px solid rgba(234,179,8,0.22)",
      }}
    >
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <Icon size={16} style={{ color: "#facc15", flexShrink: 0, marginTop: 2 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#f1f5f9" }}>
            {checking
              ? tr("checkingTitle", "We're checking your ID")
              : tr("title", "Buyers see your cars after we check your ID")}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.55 }}>
            {checking
              ? tr("checkingBody", "Your cars show to buyers once it's approved. Keep adding cars and taking leads meanwhile.")
              : tr("body", "Two quick steps. Everything else works while you wait.")}
          </p>
        </div>
      </div>

      {!checking && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            marginTop: 10, paddingLeft: 27,
          }}
        >
          <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
            {steps.map((s, i) => (
              <span
                key={s.key}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 12, color: s.done ? "#9ca3af" : "#e5e7eb", whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 16, height: 16, borderRadius: 99, flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                    background: s.done ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                    color: s.done ? "#4ade80" : "#9ca3af",
                  }}
                >
                  {s.done ? <Check size={10} strokeWidth={3} /> : i + 1}
                </span>
                {s.label}
              </span>
            ))}
          </div>
          {next?.run && (
            <button
              onClick={next.run}
              style={{
                background: "#dc2626", border: "none", borderRadius: 8, color: "#fff",
                fontSize: 12.5, fontWeight: 700, padding: "8px 14px", cursor: "pointer",
                whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0,
              }}
            >
              {next.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
