import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { validateText, ERROR_TEXT } from "../_shared/postCaption.js";

// Auto-post TEST rig (ZERNIO-1, 2026-11-12). Posts one of the caller's live cars to the
// social accounts connected in the OWNER'S Zernio workspace. It is a prototype on purpose:
//   - Every request uses ONE Zernio workspace (the owner's, free tier, 2 accounts).
//   - So only user ids listed in the edge secret ZERNIO_TEST_USER_IDS may use it. Anyone
//     else gets `allowed:false` from `status` and a 403 from everything else. Without this
//     list ANY logged-in seller could post to the owner's Facebook Page.
//   - Remove an id from the secret = switched off for that person, no deploy needed.
// The real version (one Zernio profile per seller, accounts in a table, posting from the
// database) is in docs/DREVO_ACTION_PLAN.md. The key never leaves this function.
//
// Actions (POST body `{action, ...}`):
//   status                              who am I allowed, which accounts are connected
//   publish {listing_id, items[], draft} items = [{platform, text, title?}]
//   check {post_id}                     per-network status + link of a post
//   takedown {post_id, platform}        Facebook / Threads only (Zernio cannot remove
//                                       an Instagram or TikTok post)
//   tiktok_options                      the connected TikTok account's own choices: privacy
//                                       levels, whether it can post now, the comment toggle
// A TikTok item is {platform:'tiktok', title, text(description), privacy, allow_comment,
//   consent, inbox}. TikTok's rules (Content Posting API): the poster must CHOOSE the privacy
//   level (no default), choose comments, and confirm the preview + consent for each post, so
//   the server refuses a public TikTok post without all of them. `inbox:true` sends the photos
//   to the creator's TikTok inbox as a draft: nothing is published, they finish it in the app.
//   recent                              this login's posts of the last 30 days (max 20)
//   discard {post_id}                   delete a DRAFT (never a published post)
// Limits (no DB table: counted from Zernio itself, by a tag put on every post we send):
//   10 live posts per login per 24h; a car goes to a network once per 24h (unless taken
//   down); check / takedown / discard only touch posts THIS login sent, within 30 days.
// Zernio cannot edit a published post, so there is no "update".

const ZERNIO = "https://zernio.com/api/v1";
const SITE_URL = "https://drevo.my";
const PUBLISH_PLATFORMS = ["facebook", "threads", "instagram", "tiktok"];
// Networks whose text carries no clickable link (Instagram, TikTok say "link in bio").
const NO_LINK = ["instagram", "tiktok"];
const NEEDS_PHOTO = ["instagram", "tiktok"];
const TAKEDOWN_PLATFORMS = ["facebook", "threads"];
const MAX_PHOTOS = 8;
const DAY_LIMIT = 10;                 // live posts per login per 24h
const RECENT_DAYS = 30;               // history shown, and how old a post may be taken down
const RECENT_MAX = 20;
const PUBLIC_PHOTO = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/car-images\//;

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function zernio(method: string, path: string, body?: unknown, timeoutMs = 25000) {
  const key = Deno.env.get("ZERNIO_API_KEY");
  if (!key) throw new Error("zernio_key_missing");
  const res = await fetch(ZERNIO + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  return { ok: res.ok, status: res.status, data };
}

// Zernio reads media by URL. Our car photos can be WebP (see-through cut-outs), which
// Zernio does not take (JPEG, PNG, GIF only), so each one goes through the same free
// resizer the site uses, asked for JPEG on a grey studio background.
function jpegUrl(url: string) {
  const stripped = url.replace(/^https?:\/\//, "");
  return `https://wsrv.nl/?url=${encodeURIComponent("ssl:" + stripped)}&w=1600&q=85&output=jpg&bg=e5e7eb&we`;
}

function shape(post: any) {
  return {
    post_id: post?._id,
    status: post?.status,
    platforms: (post?.platforms || []).map((p: any) => ({
      platform: p.platform,
      status: p.status,
      url: p.platformPostUrl || p.postUrl || p.url || null,
      error: p.errorMessage || p.error || null,
    })),
  };
}

// Every post we send carries this tag, so a login's posts can be found again without a table.
// A hash, not the user id: the tag is visible inside the owner's Zernio dashboard.
async function ownerTag(uid: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("drevo-autopost:" + uid));
  return "u-" + Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

// Mine = carries my tag, or (posts sent before tagging existed) our autopost link with my slug.
function isMine(post: any, tag: string, slug: string | null) {
  if (Array.isArray(post?.tags) && post.tags.includes(tag)) return true;
  const c = String(post?.content || "");
  return !!slug && c.includes("src=autopost") && c.includes(`ref=${slug}`);
}

const LIVE_STATES = ["published", "pending", "scheduled", "publishing", "partial"];

function row(post: any) {
  const c = String(post?.content || "");
  return {
    post_id: post._id,
    when: post.scheduledFor || post.createdAt || null,
    status: post.status,
    title: c.split("\n")[0].slice(0, 80),
    slug: (typeof post?.metadata?.slug === "string" ? post.metadata.slug : null) || (c.match(/\/showroom\/([^?\s]+)/) || [])[1] || null,
    platforms: (post.platforms || []).map((p: any) => ({
      platform: p.platform,
      status: p.status,
      url: p.platformPostUrl || p.postUrl || p.url || null,
      error: p.errorMessage || p.error || null,
    })),
  };
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401, origin);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "unauthorized" }, 401, origin);

    const allow = (Deno.env.get("ZERNIO_TEST_USER_IDS") || "").split(",").map((s) => s.trim()).filter(Boolean);
    const allowed = allow.includes(user.id);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    const action = String(body.action || "");

    // `status` answers politely for everyone so the app can hide the button.
    if (action === "status" && !allowed) {
      // Counts and booleans only, never an id or a key: tells the owner (in the function
      // logs) whether the secrets reached this function at all.
      console.log(`zernio-post status denied uid=${user.id.slice(0, 8)} ids_listed=${allow.length} key_set=${!!Deno.env.get("ZERNIO_API_KEY")}`);
      return json({ allowed: false, configured: allow.length > 0 }, 200, origin);
    }
    if (!allowed) return json({ error: "forbidden" }, 403, origin);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tag = await ownerTag(user.id);
    const { data: me } = await admin.from("profiles").select("slug").eq("id", user.id).maybeSingle();
    const slug: string | null = me?.slug || null;

    // This login's posts of the last 30 days, newest first.
    const listMine = async () => {
      const r = await zernio("GET", "/posts?limit=100&fields=content,platforms,status,tags,scheduledFor,createdAt,metadata");
      if (!r.ok) throw new Error("zernio_posts_" + r.status);
      const since = Date.now() - RECENT_DAYS * 86400000;
      return (r.data?.posts || [])
        .filter((p: any) => isMine(p, tag, slug) && new Date(p.scheduledFor || p.createdAt || 0).getTime() >= since)
        .map(row)
        .sort((a: any, b: any) => String(b.when).localeCompare(String(a.when)))
        .slice(0, RECENT_MAX);
    };
    // One post, only if it is mine and inside the window. Anything else reads as "not found".
    const getMine = async (id: string) => {
      const r = await zernio("GET", `/posts/${id}`);
      const post = r.data?.post;
      if (!r.ok || !post || !isMine(post, tag, slug)) return null;
      if (Date.now() - new Date(post.scheduledFor || post.createdAt || 0).getTime() > RECENT_DAYS * 86400000) return null;
      return post;
    };

    // Which networks are connected (no avatars, ids or tokens leave this function except
    // the account id the next call needs).
    const loadAccounts = async () => {
      const r = await zernio("GET", "/accounts");
      if (!r.ok) throw new Error("zernio_accounts_" + r.status);
      const out: Record<string, { accountId: string; name: string }> = {};
      for (const a of r.data?.accounts || []) {
        if (a.isActive === false || out[a.platform]) continue;
        out[a.platform] = { accountId: a._id, name: a.displayName || a.username || a.platform };
      }
      return out;
    };

    if (action === "status") {
      const acc = await loadAccounts();
      return json({
        allowed: true,
        accounts: PUBLISH_PLATFORMS.filter((p) => acc[p]).map((p) => ({ platform: p, name: acc[p].name })),
      }, 200, origin);
    }

    if (action === "tiktok_options") {
      const acc = await loadAccounts();
      if (!acc.tiktok) return json({ error: "not_connected", platform: "tiktok" }, 409, origin);
      const info = await zernio("GET", `/accounts/${acc.tiktok.accountId}/tiktok/creator-info?mediaType=photo`);
      if (!info.ok) return json({ error: "tiktok_options_failed", status: info.status }, 502, origin);
      const c = info.data?.postingLimits?.interactionSettings?.allow_comment;
      return json({
        ok: true,
        nickname: String(info.data?.creator?.nickname || acc.tiktok.name).slice(0, 60),
        can_post_more: info.data?.creator?.canPostMore !== false,
        privacy: (info.data?.privacyLevels || []).map((l: any) => ({ value: String(l.value), label: String(l.label || l.value) })),
        comment: { enabled: c?.enabled !== false, default: c?.default === true },
      }, 200, origin);
    }

    if (action === "publish") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length || items.length > PUBLISH_PLATFORMS.length) return json({ error: "bad_items" }, 400, origin);
      const seen = new Set<string>();
      for (const it of items) {
        if (!PUBLISH_PLATFORMS.includes(it?.platform) || seen.has(it.platform)) return json({ error: "bad_platform" }, 400, origin);
        seen.add(it.platform);
        const v = validateText(it.platform, it.text, it.platform === "tiktok" ? { title: it.title } : {});
        if (!v.ok) return json({ error: "text_rejected", platform: it.platform, errors: v.errors, message: v.errors.map((e: string) => (ERROR_TEXT as any)[e] || e).join(" ") }, 422, origin);
      }

      // The car must be the caller's own and live right now. Never trust the client's copy.
      const { data: car } = await admin
        .from("car_listings")
        .select("id, slug, status, dealer_id, images, new_car_model_id")
        .eq("id", String(body.listing_id || ""))
        .eq("dealer_id", user.id)
        .maybeSingle();
      if (!car) return json({ error: "car_not_found" }, 404, origin);
      if (car.status !== "available" || car.new_car_model_id) return json({ error: "car_not_live" }, 409, origin);

      const originals: string[] = (Array.isArray(car.images) ? car.images : [])
        .filter((u: unknown) => typeof u === "string" && PUBLIC_PHOTO.test(u as string))
        .slice(0, MAX_PHOTOS);
      // Ask the resizer for JPEGs; if its first answer is not a JPEG (service down), fall
      // back to the originals minus WebP, which Zernio would refuse.
      let photos = originals.map(jpegUrl);
      if (photos.length) {
        let good = false;
        try {
          const probe = await fetch(photos[0], { signal: AbortSignal.timeout(12000) });
          good = probe.ok && (probe.headers.get("content-type") || "").includes("image/jpeg");
          await probe.body?.cancel();
        } catch { /* fall through */ }
        if (!good) photos = originals.filter((u) => !/\.webp(\?|$)/i.test(u));
      }

      const acc = await loadAccounts();
      for (const it of items) {
        if (!acc[it.platform]) return json({ error: "not_connected", platform: it.platform }, 409, origin);
        if (NEEDS_PHOTO.includes(it.platform) && !photos.length) return json({ error: "needs_photo", platform: it.platform }, 409, origin);
      }

      // TikTok: the account's own options decide what is allowed (privacy levels, can it post
      // more today). Checked here, not trusted from the browser.
      const draft = body.draft === true;
      const tt = items.find((it: any) => it.platform === "tiktok");
      let tiktokSettings: Record<string, unknown> | undefined;
      if (tt) {
        const info = await zernio("GET", `/accounts/${acc.tiktok.accountId}/tiktok/creator-info?mediaType=photo`);
        if (!info.ok) return json({ error: "tiktok_options_failed", status: info.status }, 502, origin);
        const inbox = tt.inbox === true;
        const levels: string[] = (info.data?.privacyLevels || []).map((l: any) => l.value);
        if (!draft) {
          if (info.data?.creator?.canPostMore === false) return json({ error: "tiktok_cannot_post" }, 409, origin);
          if (tt.consent !== true) return json({ error: "tiktok_consent" }, 422, origin);
          if (!inbox && !levels.includes(String(tt.privacy))) return json({ error: "tiktok_privacy" }, 422, origin);
        }
        tiktokSettings = {
          mediaType: "photo",
          description: String(tt.text),
          privacyLevel: levels.includes(String(tt.privacy)) ? String(tt.privacy) : (levels.includes("SELF_ONLY") ? "SELF_ONLY" : levels[0]),
          allowComment: tt.allow_comment === true,
          commercialContentType: "none",
          autoAddMusic: false,
          photoCoverIndex: 0,
          contentPreviewConfirmed: tt.consent === true,
          expressConsentGiven: tt.consent === true,
          ...(inbox ? { draft: true } : {}),
        };
      }

      // The text must carry THIS car's link: a seller cannot post a link to somewhere else
      // (Facebook and Threads only; Instagram says "link in bio").
      for (const it of items) {
        if (!NO_LINK.includes(it.platform) && !String(it.text).includes(`${SITE_URL}/showroom/${encodeURIComponent(car.slug)}`)) {
          return json({ error: "link_missing", platform: it.platform }, 422, origin);
        }
        const urls = (String(it.text) + " " + String(it.title || "")).match(/https?:\/\/\S+/g) || [];
        if (urls.some((u) => !u.startsWith(SITE_URL + "/"))) return json({ error: "foreign_link", platform: it.platform }, 422, origin);
      }

      if (!draft) {
        const mine = await listMine();
        const dayAgo = Date.now() - 86400000;
        const recentLive = mine.filter((p: any) => p.status !== "draft" && new Date(p.when).getTime() >= dayAgo);
        if (recentLive.length >= DAY_LIMIT) return json({ error: "daily_limit", limit: DAY_LIMIT }, 429, origin);
        for (const it of items) {
          const dup = recentLive.find((p: any) => p.slug === car.slug && p.platforms.some((x: any) => x.platform === it.platform && LIVE_STATES.includes(String(x.status).toLowerCase())));
          if (dup) return json({ error: "already_posted", platform: it.platform }, 409, origin);
        }
      }
      // A TikTok photo post's "content" is its TITLE; the long text goes in tiktokSettings.description.
      const lead = items.find((it: any) => it.platform !== "tiktok") || items[0];
      const payload: Record<string, unknown> = {
        content: lead.platform === "tiktok" ? lead.title : lead.text,
        timezone: "Asia/Kuala_Lumpur",
        tags: [tag],
        // Which car this post is about, for the one-post-per-car rule: a TikTok text has no link.
        metadata: { slug: car.slug },
        platforms: items.map((it: any) => ({ platform: it.platform, accountId: acc[it.platform].accountId, customContent: it.platform === "tiktok" ? String(it.title) : it.text })),
        ...(tiktokSettings ? { tiktokSettings } : {}),
        mediaItems: photos.map((url: string) => ({ type: "image", url })),
        ...(draft ? { isDraft: true } : { publishNow: true }),
      };
      // Zernio holds this call open until every network has finished publishing, which can pass
      // 25s. A timeout here does NOT mean "not posted" (2026-11-12: the post went out and the
      // seller was told it had not). So wait longer, and if it still times out, look the post up
      // by our tag + this car instead of reporting a failure.
      let r: { ok: boolean; status: number; data: any };
      try {
        r = await zernio("POST", "/posts", payload, 70000);
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        if (name !== "TimeoutError" && name !== "AbortError") throw e;
        console.error("zernio publish timed out, looking the post up");
        const found = (await listMine()).find((p: any) => p.slug === car.slug && new Date(p.when).getTime() >= Date.now() - 5 * 60000);
        if (!found) return json({ error: "publish_unconfirmed" }, 504, origin);
        return json({ ok: true, post_id: found.post_id, status: found.status, platforms: found.platforms }, 200, origin);
      }
      if (!r.ok) {
        console.error("zernio publish failed", r.status, JSON.stringify(r.data).slice(0, 300));
        return json({ error: "zernio_failed", status: r.status, message: String(r.data?.error || r.data?.message || "").slice(0, 200) }, 502, origin);
      }
      return json({ ok: true, ...shape(r.data?.post) }, 200, origin);
    }

    if (action === "check") {
      const id = String(body.post_id || "");
      if (!/^[a-f0-9]{24}$/i.test(id)) return json({ error: "bad_post" }, 400, origin);
      const post = await getMine(id);
      if (!post) return json({ error: "post_not_found" }, 404, origin);
      return json({ ok: true, ...shape(post) }, 200, origin);
    }

    if (action === "takedown") {
      const id = String(body.post_id || "");
      const platform = String(body.platform || "");
      if (!/^[a-f0-9]{24}$/i.test(id)) return json({ error: "bad_post" }, 400, origin);
      if (!TAKEDOWN_PLATFORMS.includes(platform)) return json({ error: "cannot_take_down", platform }, 400, origin);
      const post = await getMine(id);
      if (!post) return json({ error: "post_not_found" }, 404, origin);
      const entry = (post.platforms || []).find((p: any) => p.platform === platform);
      if (!entry || String(entry.status).toLowerCase() !== "published") return json({ error: "not_published", platform }, 409, origin);
      const acc = await loadAccounts();
      const r = await zernio("POST", `/posts/${id}/unpublish`, { platform, accountId: acc[platform]?.accountId });
      if (!r.ok) return json({ error: "zernio_failed", status: r.status, message: String(r.data?.error || r.data?.message || "").slice(0, 200) }, 502, origin);
      return json({ ok: true }, 200, origin);
    }

    if (action === "recent") {
      return json({ ok: true, posts: await listMine(), day_limit: DAY_LIMIT }, 200, origin);
    }

    if (action === "discard") {
      const id = String(body.post_id || "");
      if (!/^[a-f0-9]{24}$/i.test(id)) return json({ error: "bad_post" }, 400, origin);
      const post = await getMine(id);
      if (!post) return json({ error: "post_not_found" }, 404, origin);
      if (post.status !== "draft") return json({ error: "not_a_draft" }, 409, origin);
      const r = await zernio("DELETE", `/posts/${id}`);
      if (!r.ok) return json({ error: "zernio_failed", status: r.status }, 502, origin);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "unknown_action" }, 400, origin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("zernio-post error", msg);
    return json({ error: msg === "zernio_key_missing" ? "not_configured" : "server_error" }, 500, origin);
  }
});
