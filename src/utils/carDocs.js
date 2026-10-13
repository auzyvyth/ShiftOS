// Car documents (geran, loan clearance letter, Puspakom, service history) carry
// the registered owner's name, IC, address and loan balance. They used to go
// into the PUBLIC car-images bucket, where anyone holding the URL could open
// them. New uploads go to the PRIVATE car-docs bucket (migration 20261013a) and
// are opened with a short-lived signed link instead.
//
// A car_documents entry is { type, name, path, bucket } for a private file, or
// the legacy { type, name, url, path? } for a file still in car-images.
// Every reader goes through these helpers so the two shapes never leak out.

export const CAR_DOCS_BUCKET = "car-docs";
const LEGACY_BUCKET = "car-images";
const SIGNED_TTL = 300; // seconds: long enough to read, too short to share

export const isPrivateDoc = (d) => d?.bucket === CAR_DOCS_BUCKET && !!d?.path;
// Only plain http(s): a seller-written `javascript:` URL must never be opened.
export const isLegacyDoc = (d) => !isPrivateDoc(d) && /^https?:\/\//i.test(d?.url || "");

// "Is this a PDF" from the stored path/URL only, never the seller-typed name.
export const isPdfDoc = (d) => /\.pdf($|\?)/i.test((isPrivateDoc(d) ? d.path : d?.url) || "");

// One URL per entry, same order: a signed link for a private file, the stored
// URL for a legacy one, null when it cannot be opened.
export async function resolveDocUrls(client, docs) {
  const list = Array.isArray(docs) ? docs : [];
  const paths = list.filter(isPrivateDoc).map((d) => d.path);
  const signed = {};
  if (paths.length) {
    const { data } = await client.storage.from(CAR_DOCS_BUCKET).createSignedUrls(paths, SIGNED_TTL);
    (data || []).forEach((s) => { if (s?.path && s.signedUrl) signed[s.path] = s.signedUrl; });
  }
  return list.map((d) => (isPrivateDoc(d) ? signed[d.path] || null : isLegacyDoc(d) ? d.url : null));
}

// Opens one document in a new tab. The tab is opened BEFORE the await so a
// popup blocker treats it as part of the tap.
export async function openDoc(client, d) {
  if (isLegacyDoc(d)) { window.open(d.url, "_blank", "noopener"); return; }
  const tab = window.open("", "_blank");
  const [url] = await resolveDocUrls(client, [d]);
  if (url && tab) tab.location.href = url;
  else tab?.close();
}

// Deletes the file behind an entry from whichever bucket holds it.
export function removeDocFile(client, d) {
  if (!d?.path) return Promise.resolve();
  const bucket = isPrivateDoc(d) ? CAR_DOCS_BUCKET : LEGACY_BUCKET;
  return client.storage.from(bucket).remove([d.path]).catch(() => {});
}

// One-time move of a listing's legacy documents into car-docs (platform
// console). Downloads each public file, uploads it under the same owner
// folder, rewrites the listing, then deletes the public copy. Returns
// { moved, failed, publicLeft }. A file that cannot be copied keeps its old
// entry; publicLeft counts public copies storage did not confirm deleting.
export async function moveLegacyDocs(client, listing) {
  const docs = Array.isArray(listing?.car_documents) ? listing.car_documents : [];
  let moved = 0, failed = 0;
  const next = [];
  const oldPaths = [];
  for (const d of docs) {
    if (!isLegacyDoc(d)) { next.push(d); continue; }
    try {
      const res = await fetch(d.url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const legacyPath = d.path || decodeURIComponent(d.url.split(`/${LEGACY_BUCKET}/`)[1] || "");
      // Old uploads with no owner folder (flat docs/...) go under the listing's
      // seller, so the storage policy still lets that seller open them.
      const first = legacyPath.split("/")[0];
      const owner = /^[0-9a-f-]{36}$/i.test(first) ? first : listing.dealer_id;
      const name = legacyPath.split("/").pop() || `${Date.now()}-document`;
      const path = `${owner}/docs/${name}`;
      const { error } = await client.storage.from(CAR_DOCS_BUCKET)
        .upload(path, blob, { contentType: blob.type || undefined });
      if (error) throw error;
      next.push({ type: d.type, name: d.name, path, bucket: CAR_DOCS_BUCKET });
      if (legacyPath) oldPaths.push(legacyPath);
      moved++;
    } catch {
      next.push(d);
      failed++;
    }
  }
  if (!moved) return { moved, failed, publicLeft: 0 };
  const { data, error } = await client.from("car_listings")
    .update({ car_documents: next }).eq("id", listing.id).select("id");
  if (error || !data?.length) return { moved: 0, failed: failed + moved, publicLeft: 0 };
  let publicLeft = 0;
  if (oldPaths.length) {
    const { data: gone } = await client.storage.from(LEGACY_BUCKET).remove(oldPaths);
    publicLeft = oldPaths.length - (gone || []).length;
  }
  return { moved, failed, publicLeft };
}
