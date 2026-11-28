import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { SALESMAN_PREMIUM_FEATURES } from "../../utils/plans";
import { PLAN_CONFIG } from "../../utils/planConfig";
import PremiumPayBox, { PREMIUM_PRICE } from "./PremiumPayBox";
import PagePreview from "./PagePreview";
import { useTranslation } from "react-i18next";

// The Lite -> Premium door (migration 20261004b). Before this, Lite had no
// upgrade control at all and /plans looped a signed-in Lite seller back to
// Lite. Two states:
//   - free trial not used yet: one button, start_premium_trial(), which sets
//     a 7-day plan_expires_at server side, then we go to the Premium panel;
//   - free trial used / lapsed: how to pay. Payment is still confirmed by
//     hand (WhatsApp + DuitNow QR); the owner logs it in the console and the
//     seller lands on Premium on their next load.
// Dark seller-panel surface.

const PRICE = PREMIUM_PRICE;
const LITE_CAP = PLAN_CONFIG.salesman_lite?.listingCap ?? 10;
const PREMIUM_CAP = PLAN_CONFIG.salesman_full?.listingCap ?? 30;

export default function PremiumUpgradeCard({ profile, cars, onRefer }) {
  const { t } = useTranslation();
  const [offer, setOffer] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.rpc("get_my_premium_offer").then(({ data, error }) => {
      // On error (e.g. not deployed yet) fall back to the pay instructions,
      // which work regardless.
      if (alive) setOffer(error || !data ? { trial_available: false } : data);
    });
    return () => { alive = false; };
  }, []);

  const startTrial = async () => {
    setStarting(true);
    const { data, error } = await supabase.rpc("start_premium_trial");
    setStarting(false);
    if (error) { toast.error(t("premiumCard.trialFailed")); return; }
    if (data === "ok" || data === "already_premium") {
      // Full load: the Premium panel re-reads the profile and its gates.
      window.location.href = "/salesman-premium";
      return;
    }
    if (data === "used") {
      setOffer((o) => ({ ...o, trial_available: false, trial_used: true }));
      toast.error(t("premiumCard.trialUsed"));
      return;
    }
    toast.error(t("premiumCard.trialBlocked"));
  };

  const card = { padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 };

  return (
    <div style={card}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{t("premiumCard.title", { price: PRICE })}</p>
      {PLAN_CONFIG.salesman_full?.listPrice ? (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>
          {t("premiumCard.founding", { spots: PLAN_CONFIG.salesman_full.foundingSpots, list: PLAN_CONFIG.salesman_full.listPrice })}
        </p>
      ) : null}
      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
        {t("premiumCard.comesWithYou")}
      </p>
      {/* The page is the one difference a seller with no buyers yet can see. */}
      <div style={{ marginTop: 14 }}>
        <PagePreview profile={profile} cars={cars} />
      </div>
      <ul style={{ margin: "14px 0 0", padding: "0 0 0 18px", fontSize: 12.5, color: "#d1d5db", lineHeight: 1.8 }}>
        <li>{t("premiumCard.upTo", { premium: PREMIUM_CAP, lite: LITE_CAP })}</li>
        {/* AI lines are left out while AI_FEATURES_ENABLED is off. */}
        {SALESMAN_PREMIUM_FEATURES.filter((f) => !/\bAI\b/.test(f)).slice(0, 5).map((f) => <li key={f}>{f}</li>)}
      </ul>

      {offer === null ? null : offer.trial_available ? (
        <>
          <button type="button" onClick={startTrial} disabled={starting}
            style={{ marginTop: 14, padding: "11px 16px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: starting ? "wait" : "pointer", opacity: starting ? 0.7 : 1, fontFamily: "inherit" }}>
            {starting ? t("premiumCard.starting") : t("premiumCard.tryFree")}
          </button>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
            {t("premiumCard.noPayment")}
          </p>
        </>
      ) : (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <PremiumPayBox profile={profile} lead={offer.trial_used ? t("premiumCard.trialEnded") : ""} />
        </div>
      )}

      {onRefer && (
        <p style={{ margin: "14px 0 0", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
          {t("premiumCard.earnFree")}{" "}
          <button type="button" onClick={onRefer}
            style={{ padding: 0, border: "none", background: "none", color: "#f87171", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
            {t("premiumCard.invite")}
          </button>
        </p>
      )}
    </div>
  );
}
