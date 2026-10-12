import React, { useCallback, useEffect, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";
import { isLegacyDoc, moveLegacyDocs } from "../../utils/carDocs";

// One-time clean-up, shown on Safety > Posture only while there is something to
// do: car documents uploaded before 2026-10-13 still sit in the PUBLIC
// car-images bucket (anyone with the link can open a geran). This moves them
// into the private car-docs bucket and deletes the public copy
// (src/utils/carDocs.js moveLegacyDocs). Disappears once nothing is left.
export default function PublicDocsMover() {
  const [listings, setListings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("car_listings")
      .select("id, dealer_id, car_documents")
      .not("car_documents", "is", null);
    if (error) { setListings([]); setResult(`Could not check documents: ${error.message}`); return; }
    setListings((data || []).filter((l) => Array.isArray(l.car_documents) && l.car_documents.some(isLegacyDoc)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const count = (listings || []).reduce((n, l) => n + l.car_documents.filter(isLegacyDoc).length, 0);
  if (!listings || (!count && !result)) return null;

  const run = async () => {
    setBusy(true);
    let moved = 0, failed = 0, publicLeft = 0;
    for (const l of listings) {
      const r = await moveLegacyDocs(supabase, l);
      moved += r.moved; failed += r.failed; publicLeft += r.publicLeft;
    }
    setBusy(false);
    setResult(
      `Moved ${moved} document${moved === 1 ? "" : "s"} to private storage.` +
      (failed ? ` ${failed} could not be moved.` : "") +
      (publicLeft ? ` ${publicLeft} public cop${publicLeft === 1 ? "y" : "ies"} could not be deleted.` : ""),
    );
    load();
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.25)" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
          {count ? `${count} car document${count === 1 ? " is" : "s are"} in public storage` : "Car documents"}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
          {result || "Uploaded before documents went private. Anyone with the link can open them. Move them once; sellers see no change."}
        </p>
      </div>
      {count > 0 && (
        <button onClick={run} disabled={busy}
          style={{ background: "#dc2626", border: "none", borderRadius: 8, color: "#fff", fontSize: 12.5, fontWeight: 700, padding: "8px 14px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}>
          {busy ? "Moving…" : "Move to private storage"}
        </button>
      )}
    </div>
  );
}
