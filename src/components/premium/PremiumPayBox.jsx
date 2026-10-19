import React from "react";
import { PLAN_CONFIG } from "../../utils/planConfig";

// How to pay for Premium: DuitNow QR + "I've paid" WhatsApp. Payment is still
// confirmed by hand; the owner logs it in the console (record_subscription_payment)
// and Premium moves forward a month. Shared by the Lite upgrade card and the
// Premium "paid until" banner so there is one pay screen, not two.
// Dark seller-panel surface.

export const OPS_WHATSAPP = "601111521742";
export const PREMIUM_PRICE = PLAN_CONFIG.salesman_full?.price ?? 35;

export default function PremiumPayBox({ profile, lead = "" }) {
  const ref = profile?.slug || profile?.full_name || profile?.email || "";
  const waText = `Hi, I've paid RM${PREMIUM_PRICE} for XDrive Premium. My page: ${ref}`;
  return (
    <div>
      <p style={{ margin: 0, fontSize: 12.5, color: "#e5e7eb", lineHeight: 1.6 }}>
        {lead}
        Scan to pay RM{PREMIUM_PRICE}, then send us a WhatsApp. We switch you to Premium as soon as we see it.
      </p>
      <img src="/payment-qr.png" alt="DuitNow payment QR" width="180" height="180"
        style={{ display: "block", width: 180, height: 180, marginTop: 12, borderRadius: 8, background: "#fff", padding: 6 }} />
      <a href={`https://wa.me/${OPS_WHATSAPP}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-block", marginTop: 12, padding: "10px 16px", borderRadius: 8, background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        I've paid, tell XDrive
      </a>
    </div>
  );
}
