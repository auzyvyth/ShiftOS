// Shared localStorage cache rules for the salesman panels (Lite + Premium).
//
// Both panels cache their listings/leads/enquiries/appointments in localStorage
// so the panel paints instantly on the next visit. Two rules govern what is
// allowed to sit there, and they live here because they were previously a
// per-file copy: Lite had lead redaction and Premium never got it, so the PAID
// tier was the one writing buyer IC numbers to disk.
//
// 1. Redact before writing. localStorage is plaintext, readable by any script
//    on the origin, and has no expiry of its own (the panels' 30-minute TTL is
//    only checked on READ — the row stays on disk until something overwrites
//    it). Identity documents and home addresses do not go there.
// 2. Purge on logout. Signing out must not leave the previous user's buyer list
//    on a shared or borrowed device.

// Data caches holding buyer PII, per panel. Prefix match — each key ends in the
// user id (e.g. `sp_leads_<uuid>`), so a purge clears every account's copy on
// this device, which is the point on a shared machine.
export const PANEL_DATA_CACHE_PREFIXES = [
  "sp_listings_", "sp_leads_", "sp_enquiries_", "sp_appts_",
  "slite_listings_", "slite_leads_", "slite_enquiries_", "slite_appts_",
];

// Strip the fields that must never be written to disk. `buyer_ic` is a
// Malaysian identity-card number and `buyer_address` is a home address; neither
// is needed to render a pipeline card, and both are re-fetched from the server
// the moment the panel actually needs them.
export const redactLeadsForCache = (rows) =>
  (rows || []).map(({ buyer_ic, buyer_address, ...rest }) => rest);

// Drop every cached buyer list on this device. Called on sign-out. Deliberately
// leaves non-PII preferences (goal, tour-seen, dismissed banners) alone — those
// are harmless and losing them on logout is a worse experience for no gain.
export const clearPanelDataCache = () => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (PANEL_DATA_CACHE_PREFIXES.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    // A blocked/full localStorage must not strand the user on the panel —
    // signing out matters more than the purge succeeding.
    console.error("clearPanelDataCache:", e);
  }
};
