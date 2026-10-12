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
