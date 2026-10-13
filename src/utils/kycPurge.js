// Deletes every MyKad photo a seller has in the private kyc-docs bucket.
//
// Owner's rule: ID photos are kept only until a person at XDrive has looked at
// them. The DB decision functions delete the kyc_documents ROWS, but the image
// bytes can only be removed through the Storage API, so every path that decides
// a seller's ID must call this. It lists the seller's whole folder instead of
// trusting the paths on a kyc_documents row: two decision paths (approve a
// listing + verify the seller, and the account record's Verify toggle) never
// had those paths, and an upload whose submit failed leaves files with no row.
//
// Returns { ok, removed }. ok=false means something may still be there; the
// caller shows that rather than reporting a clean purge. Storage answers a
// delete that RLS blocked with an empty list and NO error, so the count of
// removed files is checked against what the listing found.
export async function purgeKycFiles(client, userId) {
  if (!userId) return { ok: true, removed: 0 };
  const bucket = client.storage.from("kyc-docs");
  const { data: listed, error: listErr } = await bucket.list(userId, { limit: 100 });
  if (listErr) return { ok: false, removed: 0 };
  const paths = (listed || []).filter((f) => f.name).map((f) => `${userId}/${f.name}`);
  if (!paths.length) return { ok: true, removed: 0 };
  const { data: removed, error } = await bucket.remove(paths);
  if (error) return { ok: false, removed: 0 };
  const n = (removed || []).length;
  return { ok: n === paths.length, removed: n };
}

// Safety net, run by the console's ID queue after it loads: deletes MyKad
// photos that no pending ID check points at any more (an account deleted
// before review, an upload whose submit failed). Only files over an hour old,
// so a seller part-way through submitting never loses a photo. `pendingIds`
// is the set of user ids still waiting in the queue. Returns files removed.
const SWEEP_MIN_AGE_MS = 60 * 60 * 1000;
export async function sweepOrphanKycFiles(client, pendingIds) {
  const bucket = client.storage.from("kyc-docs");
  const { data: folders, error } = await bucket.list("", { limit: 1000 });
  if (error) return 0;
  let removed = 0;
  for (const f of folders || []) {
    // Folders come back with id null; skip loose files and anyone still pending.
    if (f.id !== null || !f.name || pendingIds.has(f.name)) continue;
    const { data: files } = await bucket.list(f.name, { limit: 100 });
    const old = (files || []).filter((x) => x.name && x.created_at
      && Date.now() - new Date(x.created_at).getTime() > SWEEP_MIN_AGE_MS);
    if (!old.length) continue;
    const { data: gone } = await bucket.remove(old.map((x) => `${f.name}/${x.name}`));
    removed += (gone || []).length;
  }
  return removed;
}
