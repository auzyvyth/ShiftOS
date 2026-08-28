import { useState, useRef } from "react";
import { ShieldCheck, Upload, Check, Clock, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";

/**
 * Seller-facing e-KYC submission.
 *
 * This is the step that never existed: the admin REVIEW screen
 * (platform/UserApprovalsTab) and the public "Verified" badge (CarCard,
 * CarDetailPage) were both already built, but nothing let a seller actually
 * upload an ID, so kyc_documents had zero rows and the badge was unearnable.
 *
 * Verification is a carrot, never a punishment: a seller who skips this is
 * simply un-badged. Nothing here blocks listing — the dealer's manual approval
 * of each listing remains the only gate.
 *
 * Photos go to the PRIVATE kyc-docs bucket under the seller's own uid folder
 * (the storage policy and submit_kyc both require that prefix). submit_kyc is
 * SECURITY DEFINER and writes kyc_documents + profiles.kyc_submitted_at in one
 * call. The superadmin's decision purges the images, so they are held only
 * while a review is pending.
 *
 * Do NOT add upsert:true to these uploads. kyc-docs has no owner SELECT
 * policy, and Postgres runs INSERT ... ON CONFLICT DO UPDATE against the
 * SELECT and UPDATE policies too — the exact failure that silently broke every
 * car-images upload. Each file gets a unique path instead.
 */

const SLOTS = [
  { key: "front", label: "MyKad front", hint: "The side with your photo and IC number" },
  { key: "back", label: "MyKad back", hint: "The reverse side" },
  { key: "selfie", label: "Selfie holding your MyKad", hint: "Your face and the card both readable" },
];

// Shrink before upload: phone photos routinely exceed the bucket's 8MB cap.
const compress = (file, maxWidth = 1600, quality = 0.85) =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) =>
          resolve(blob ? new File([blob], "id.jpg", { type: "image/jpeg" }) : file),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

export default function VerifyIdentity({ profile, userId, onSubmitted }) {
  const [files, setFiles] = useState({});      // key -> File
  const [previews, setPreviews] = useState({}); // key -> objectURL
  const [busy, setBusy] = useState(false);
  const inputs = useRef({});

  const verified = !!profile?.is_verified;
  const pending = !verified && !!profile?.kyc_submitted_at;

  const pick = (key) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Use a JPG, PNG or WebP photo.");
      return;
    }
    setFiles((f) => ({ ...f, [key]: file }));
    setPreviews((p) => {
      if (p[key]) URL.revokeObjectURL(p[key]);
      return { ...p, [key]: URL.createObjectURL(file) };
    });
  };

  const submit = async () => {
    if (!userId) return;
    if (!files.front || !files.back) {
      toast.error("Both sides of your MyKad are required.");
      return;
    }
    setBusy(true);
    try {
      const paths = {};
      for (const { key } of SLOTS) {
        if (!files[key]) continue;
        const blob = await compress(files[key]);
        // Unique path per attempt — never upsert (see note at top of file).
        const rand = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
        const path = `${userId}/${key}-${Date.now()}-${rand}.jpg`;
        const { error } = await supabase.storage
          .from("kyc-docs")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw new Error(`Could not upload your ${key} photo: ${error.message}`);
        paths[key] = path;
      }

      const tier = profile?.plan === "salesman_full" ? "premium" : "free";
      // Premium requires all three server-side; ask for the selfie up front
      // rather than letting the RPC reject after the uploads have run.
      if (tier === "premium" && !paths.selfie) {
        throw new Error("A selfie holding your MyKad is required on your plan.");
      }
      const { error: rpcErr } = await supabase.rpc("submit_kyc", {
        p_tier: tier,
        p_front: paths.front ?? null,
        p_back: paths.back ?? null,
        p_selfie: paths.selfie ?? null,
      });
      if (rpcErr) throw rpcErr;

      toast.success("ID submitted — we'll review it shortly.");
      Object.values(previews).forEach((u) => URL.revokeObjectURL(u));
      setFiles({});
      setPreviews({});
      onSubmitted?.();
    } catch (err) {
      toast.error(err?.message || "Could not submit your ID. Please try again.");
    }
    setBusy(false);
  };

  const card = {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: 16,
  };

  if (verified) {
    return (
      <div style={{ ...card, borderColor: "rgba(34,197,94,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={18} style={{ color: "#4ade80", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
              Identity verified
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
              Your listings carry the Verified badge on the marketplace.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (pending) {
    return (
      <div style={{ ...card, borderColor: "rgba(234,179,8,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Clock size={18} style={{ color: "#facc15", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
              ID under review
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
              We'll add your Verified badge once it's checked. You can keep listing in the meantime.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <ShieldCheck size={18} style={{ color: "#60a5fa", flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
          Get the Verified badge
        </p>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
        Verified sellers show a badge on every listing, and buyers are far more willing to
        message a seller whose identity has been checked. Optional — your listings work either way.
      </p>

      {profile?.rejection_reason && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14, padding: "9px 11px", borderRadius: 8, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <AlertCircle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>
            Last submission wasn't accepted: {profile.rejection_reason}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {SLOTS.map(({ key, label, hint }) => (
          <div key={key}>
            <input
              ref={(el) => { inputs.current[key] = el; }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={pick(key)}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => inputs.current[key]?.click()}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 11,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${files[key] ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 9, padding: "10px 12px", cursor: "pointer", textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              {previews[key] ? (
                <img
                  src={previews[key]}
                  alt=""
                  style={{ width: 40, height: 30, objectFit: "cover", borderRadius: 5, flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 40, height: 30, borderRadius: 5, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Upload size={13} style={{ color: "#6b7280" }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>
                  {label}
                  {key === "selfie" && profile?.plan !== "salesman_full" && (
                    <span style={{ color: "#6b7280", fontWeight: 500 }}> · optional</span>
                  )}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {hint}
                </p>
              </div>
              {files[key] && <Check size={15} style={{ color: "#4ade80", flexShrink: 0 }} />}
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={busy || !files.front || !files.back}
        style={{
          width: "100%", marginTop: 14, fontSize: 13, fontWeight: 700, padding: "11px",
          borderRadius: 8, background: "#dc2626", border: "none", color: "#fff",
          cursor: busy || !files.front || !files.back ? "default" : "pointer",
          opacity: busy || !files.front || !files.back ? 0.5 : 1, fontFamily: "inherit",
        }}
      >
        {busy ? "Submitting…" : "Submit for verification"}
      </button>
      <p style={{ margin: "9px 0 0", fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
        Stored privately and deleted the moment your review is decided. Never shown to buyers.
      </p>
    </div>
  );
}
