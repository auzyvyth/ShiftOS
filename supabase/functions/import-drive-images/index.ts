import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// import-drive-images
// -------------------
// Self-serve stock importer helper. Given a batch of { id, url } where url is a
// public Google Drive FILE or FOLDER link, it resolves the images with a
// server-held Drive API KEY (no dealer OAuth), downloads them under strict
// caps, uploads them to the car-images bucket under the CALLER's own folder,
// and returns the public URLs. It never writes to car_listings — the client
// patches images through its own RLS-scoped session, so listing ownership is
// enforced by the database, not by trust in this function.
//
// Safety posture ("safest way"):
//  - JWT-verified, role-gated caller (dealer/owner/superadmin only).
//  - SSRF-proof: we never fetch the user-supplied URL. We extract only a Drive
//    ID (regex) and hit googleapis.com with it — arbitrary hosts are impossible.
//  - Hard caps on items/images/bytes so a giant or crafted folder can't run away.
//  - Storage path is namespaced to the caller's uid; a dealer can only ever
//    write under car-images/<their-uid>/...

const STORAGE_BUCKET = "car-images";
const MAX_ITEMS_PER_REQUEST = 20;   // client batches larger imports
const MAX_IMAGES_PER_CAR = 40;      // "all images" — but bounded
const MAX_IMAGES_PER_REQUEST = 300; // total across the batch
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DRIVE = "https://www.googleapis.com/drive/v3";

const ALLOWED_ORIGINS = [
  "https://xdrive.my",
  "https://www.xdrive.my",
  "http://localhost:3000",
  "http://localhost:5173",
];

function corsHeaders(origin: string | null) {
  const allowed =
    origin && ALLOWED_ORIGINS.some((o) => origin === o || origin.endsWith(".xdrive.my"))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// Only ever accept links whose host is Google Drive; then extract just the ID.
function parseDrive(url: string): { id: string; type: "folder" | "file" } | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (!/(^|\.)(drive|docs)\.google\.com$/.test(host) && !/(^|\.)googleusercontent\.com$/.test(host)) {
    return null;
  }
  let m = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return { id: m[1], type: "folder" };
  m = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) || url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) || url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return { id: m[1], type: "file" };
  return null;
}

const extFor = (mime: string, name: string) => {
  const fromName = (name.match(/\.([a-z0-9]{3,4})$/i)?.[1] || "").toLowerCase();
  if (fromName) return fromName;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
};

async function listFolderImages(folderId: string, key: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  const out: { id: string; name: string; mimeType: string }[] = [];
  let pageToken = "";
  for (let guard = 0; guard < 20; guard++) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const url =
      `${DRIVE}/files?q=${q}&key=${key}` +
      `&fields=nextPageToken,files(id,name,mimeType)&pageSize=100` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    for (const f of data.files || []) {
      if ((f.mimeType || "").startsWith("image/")) out.push(f);
    }
    if (out.length >= MAX_IMAGES_PER_CAR) return out.slice(0, MAX_IMAGES_PER_CAR);
    pageToken = data.nextPageToken || "";
    if (!pageToken) break;
  }
  // Stable gallery order
  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return out.slice(0, MAX_IMAGES_PER_CAR);
}

async function downloadImage(fileId: string, key: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const res = await fetch(`${DRIVE}/files/${fileId}?alt=media&key=${key}&supportsAllDrives=true`);
  if (!res.ok) return null;
  const mime = res.headers.get("content-type") || "image/jpeg";
  if (!mime.startsWith("image/")) return null;
  const len = Number(res.headers.get("content-length") || 0);
  if (len && len > MAX_IMAGE_BYTES) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
  return { bytes: buf, mime };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, origin);

  try {
    const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!DRIVE_KEY) return json({ error: "drive_key_missing", detail: "GOOGLE_DRIVE_API_KEY is not set" }, 500, origin);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401, origin);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "unauthorized" }, 401, origin);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || !["dealer", "owner", "superadmin"].includes(profile.role)) {
      return json({ error: "forbidden" }, 403, origin);
    }

    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items || items.length === 0) return json({ error: "no_items" }, 400, origin);
    if (items.length > MAX_ITEMS_PER_REQUEST) {
      return json({ error: "too_many_items", max: MAX_ITEMS_PER_REQUEST }, 400, origin);
    }

    const results: Record<string, string[]> = {};
    let totalImages = 0;

    for (const item of items) {
      const listingId = String(item?.id || "");
      const url = String(item?.url || "");
      if (!listingId || !url) continue;
      results[listingId] = [];

      const drive = parseDrive(url);
      if (!drive) continue; // non-Drive / unparseable → skip (SSRF-safe: never fetched)

      let files: { id: string; name: string; mimeType: string }[] = [];
      if (drive.type === "folder") {
        files = await listFolderImages(drive.id, DRIVE_KEY);
      } else {
        const res = await fetch(`${DRIVE}/files/${drive.id}?key=${DRIVE_KEY}&fields=id,name,mimeType&supportsAllDrives=true`);
        if (res.ok) {
          const f = await res.json();
          if ((f.mimeType || "").startsWith("image/")) files = [f];
        }
      }

      let n = 0;
      for (const f of files) {
        if (totalImages >= MAX_IMAGES_PER_REQUEST) break;
        const dl = await downloadImage(f.id, DRIVE_KEY);
        if (!dl) continue;
        const ext = extFor(dl.mime, f.name || "");
        const path = `${user.id}/${listingId}/${n}.${ext}`;
        const { error: upErr } = await admin.storage.from(STORAGE_BUCKET).upload(path, dl.bytes, {
          contentType: dl.mime,
          upsert: true,
        });
        if (upErr) continue;
        const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        if (pub?.publicUrl) {
          results[listingId].push(pub.publicUrl);
          n++;
          totalImages++;
        }
      }
    }

    return json({ results, totalImages }, 200, origin);
  } catch (e) {
    return json({ error: "server_error", detail: String((e as Error)?.message || e) }, 500, origin);
  }
});
