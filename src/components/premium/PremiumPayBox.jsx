import React, { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { PLAN_CONFIG, OPS_WHATSAPP } from "../../utils/planConfig";

// How to pay for Premium: DuitNow QR + "I've paid" WhatsApp. Payment is still
// confirmed by hand; the owner logs it in the console (record_subscription_payment)
// and Premium moves forward a month. Shared by the Lite upgrade card and the
// Premium "paid until" banner so there is one pay screen, not two.
// Dark seller-panel surface.

export { OPS_WHATSAPP };
export const PREMIUM_PRICE = PLAN_CONFIG.salesman_full?.price ?? 35;

const QR_URL = "/payment-qr.png";
const QR_FILE = "premium-payment-qr.png";

// A seller paying on the SAME phone cannot scan their own screen: they save the
// QR, then their bank / e-wallet app's Scan picks it from the gallery. On a phone
// the share sheet offers "Save image" and the banking apps; elsewhere it downloads.
// The file is fetched on mount so the tap itself shares straight away (a fetch
// inside the tap can lose the "user tapped" permission the share sheet needs).
function SaveQrButton() {
  const blob = useRef(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(QR_URL).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (alive) blob.current = b; }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const save = async () => {
    const b = blob.current;
    const file = b ? new File([b], QR_FILE, { type: b.type || "image/png" }) : null;
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Premium payment QR" });
        setSaved(true);
        return;
      }
    } catch (e) {
      if (e?.name === "AbortError") return; // they closed the share sheet
    }
    const a = document.createElement("a");
    a.href = b ? URL.createObjectURL(b) : QR_URL;
    a.download = QR_FILE;
    document.body.appendChild(a); a.click(); a.remove();
    if (b) setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setSaved(true);
  };
  return (
    <>
      <button type="button" onClick={save}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, height: 36, padding: "0 14px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "none", color: "#e5e7eb", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        <Download size={13} /> {saved ? "Saved. Save again" : "Save QR to phone"}
      </button>
      <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#9ca3af", lineHeight: 1.5, maxWidth: 320 }}>
        Paying on this phone? Save the QR, then in your bank or e-wallet app tap Scan and pick it from your gallery.
      </p>
    </>
  );
}

export default function PremiumPayBox({ profile, lead = "" }) {
  const ref = profile?.slug || profile?.full_name || profile?.email || "";
  const waText = `Hi, I've paid RM${PREMIUM_PRICE} for Drevo Premium. My page: ${ref}`;
  return (
    <div>
      <p style={{ margin: 0, fontSize: 12.5, color: "#e5e7eb", lineHeight: 1.6 }}>
        {lead}
        Scan to pay RM{PREMIUM_PRICE}, then send us a WhatsApp. We switch you to Premium as soon as we see it.
      </p>
      <img src="/payment-qr.png" alt="DuitNow payment QR" width="180" height="180"
        style={{ display: "block", width: 180, height: 180, marginTop: 12, borderRadius: 8, background: "#fff", padding: 6 }} />
      <SaveQrButton />
      <a href={`https://wa.me/${OPS_WHATSAPP}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-block", marginTop: 14, padding: "10px 16px", borderRadius: 8, background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        I've paid, tell Drevo
      </a>
    </div>
  );
}
