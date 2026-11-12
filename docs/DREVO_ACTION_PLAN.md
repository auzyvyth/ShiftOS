# Drevo action plan (2026-11-11): what is left, and Zernio scoped

Built from the three handoff files (SEO plan, product/growth brief, DMS mind map) checked against
the real code (`/home/user/ShiftOS`) and the live database (read-only SELECTs). Anything "done"
below has a file or table behind it. Anything about Zernio is UNVERIFIED (see Part 3, Z0).

---

## PART 1: Already built, so OUT of the plan

| From the handoff | Already there | Evidence |
|---|---|---|
| Domain move XDrive -> Drevo, one-hop 301s | Done 2026-11-04. Every xdrive.my and www.xdrive.my path 301s to drevo.my | `src/config/site.js:15`, `vercel.json` `redirects` |
| Brand text "XDrive" in the app | 0 hits left in `src/` | grep |
| Single place for the domain | `ROOT_DOMAIN`, `SITE_URL`, `isOwnHost` | `src/config/site.js` |
| robots.txt (internal paths blocked, sitemap named) | Dynamic per host | `api/robots.js` |
| Sitemap with cars, seller pages `/s/:slug`, articles, model hubs | Built | `api/sitemap.js:33-102,185-198` |
| Model pages `/used-cars/:brand/:model`, 404 when no live car | Built | `src/utils/modelHubs.js`, `UsedCarsHubPage.jsx` |
| Crawler-readable pages for bots (SPA is invisible to them) | Built | `api/og.js`, `api/shell.js` |
| `Car` structured data on car pages | Built | `CarDetailPage.jsx`, `api/og.js` |
| Seller showroom page that lists the seller's cars | Built | `src/App.jsx:307` `/s/:slug` |
| Article SEO machinery | Built | `tools/generate-article-pages.mjs` |
| Live financing presentation (the Advisor product) | Built, 2 daily users | `src/components/live/LivePresenter.jsx` |
| Advisor CRM / follow-ups / loan check / loan poster | Built | `crm/ThisWeek.jsx`, `loans/`, `poster/` |
| Seller dashboard, showroom, analytics, leads, chat, sold records | Built | CLAUDE.md sections |
| DMS core: stock record (52 columns: purchase price, recon, auction grade/house, import country, Puspakom B5/B7, encumbrance, VIN, service book...) | Built | table `stock_units` |
| DMS money: deal financials, commission rules, expenses, trade-ins, F&I add-ons, documents, handover checklist (8 steps), bank loan applications + loan checks | Built | tables `deal_financials`, `commission_rules`, `expense_entries`, `trade_ins`, `deal_products`, `dealer_documents`, `post_sale_tasks`, `loan_applications`, `loan_checks` |
| Dealer dashboard security lock-down (cost off public view, role checks on money tables) | Applied 2026-11-08/09 | `TODO.md` DMS-AUDIT |
| Dealer dashboard restructure plan (15 tabs -> 6) | Written | `docs/DEALER_DASHBOARD_PLAN.md` |
| Zernio screen (preview only, nothing connects) | Built | `src/components/autopost/AutoPost.jsx`, used at `DashboardPage.jsx:2349` and `:10689` |

Stale line to fix: `TODO.md:228` still shows "Switch to drevo.my" as open. It shipped on 2026-11-04.

## PART 2: What is genuinely left (not Zernio)

Owner-only (Claude cannot see Search Console):
1. SEO-0: verify drevo.my in Search Console, file Change of Address for xdrive.my, export queries/pages.
2. Check the redirect map by hand on 10 real URLs: `/s/premiummotors`, a car, a hub, an article. Must be ONE hop, status 301.
3. 67 `xdrive.my` strings remain in `src`/`api` (mostly allowlists and comments). Review, keep the allowlist ones.

Claude work (from `TODO.md` SEO-PLAN, unchanged order): SEO-1 FAQ pass, SEO-6 seller keywords, SEO-2 loan-hub page, SEO-4 data story. SEO-7 (state/model pages) stays parked until inventory grows (78 live used cars at last count).

Not built in the DMS (no table found by name): consignment, reservation/deposit lock, shipment/import tracking, repair work orders, bank directory. The mind map's own advice stands: Phase 0 is an audit of what exists, then pilot with 3-5 Penang dealers. Do NOT build these before a dealer asks; "dealer is the focus" (CLAUDE.md, 2026-11-08) means fix and finish, not widen.

## PART 3: Zernio scope (Salesman Premium + Dealer dashboard)

### My pushback first
1. **Premium is RM35 (founding). Social posting has a per-account vendor cost.** Do not fold it into RM35 until Z0 gives real numbers. Likely shape: a separate paid tier or add-on. Do not show a card for it until it works (CPA 1999 s.10, already in CLAUDE.md).
<<<<<<< origin/main
2. **The preview promises "edit the post to say SOLD / update price" on every platform.** Several networks do not let an API edit a published post (I expect Instagram and TikTok do not; unverified). Z0 must check each platform. Fallback: a new "SOLD" post, or delete the post.
=======
2. **The preview promises "edit the post to say SOLD / update price" on every platform. Zernio cannot do that for any platform** (verified in its API: published posts cannot be edited). Rules in `AutoPost.jsx` (`AUTOPOST_RULES`) must be reworded when this goes real: "Take the post down when sold" (Facebook, Threads, Google only) and "Post a price-drop update" (a new post).
>>>>>>> HEAD
3. **Overlap:** Telegram auto-post already exists (`telegram_auto_post`, `supabase/functions/telegram-notify`). Telegram stays separate; do not add it to Zernio.
4. **Dealer dashboard has no live users yet**, but it is the stated focus. Build the engine for Premium first (real users), and the dealer screen is the same component with a different owner id.
5. Facebook publishing is for Pages, not personal profiles. Say so on the connect screen.

<<<<<<< origin/main
### What the web search showed (vendor pages only, NOT verified)
Base URL `https://zernio.com/api/v1`, bearer API key. Accounts are grouped in "profiles", one account per platform per profile. `GET /v1/connect/{platform}` takes a profile id and a redirect URL and returns an `authUrl`. Zernio says it handles token refresh, platform app approvals and rate limits. Pricing pages disagree with each other (free tier, a per-account figure, X pass-through). Webhook events and signing were not found.
**Blocked: this session cannot reach zernio.com** (`getaddrinfo ENOTFOUND`). To verify, the owner must allow `zernio.com` and `docs.zernio.com` in the environment network settings (Settings, then Environment). Until then, nothing below that depends on Zernio is confirmed.
=======
### What Zernio's own files say (read 2026-11-12: `zernio.com/pricing.md`, `/llms.txt`, `/openapi.yaml`)
`docs.zernio.com` still does not load from here; the OpenAPI file (6 MB) is the authoritative source and I used that. Still to test for real: everything marked "test" below.

**Model:** base URL `https://zernio.com/api/v1`, bearer key. A *profile* groups accounts; Zernio's own multi-tenant advice is one profile per end customer, with `externalId` = our owner id (`GET /v1/profiles?externalId=`, duplicate returns 409). Posts are sent per `accountId`.

**Connect:** `GET /v1/connect/{platform}?profileId=&redirect_url=` returns `authUrl` (twitter, instagram, facebook, youtube, linkedin, threads, tiktok, pinterest). Facebook then needs a "select page" step (`/v1/connect/facebook/select-page`). Google Business is listed as a posting platform. Disconnect: `DELETE`; a profile can only be deleted when it has no connected accounts.

**Posting:** `POST /v1/posts` (`content`, `mediaItems[{type,url}]`, `platforms[{platform,accountId,customContent}]`, `publishNow` / `scheduledFor` / `isDraft`), `POST /v1/posts/{id}/retry`, media by public `url` or `POST /v1/media/presign`.

**What this changes in the plan (the important part):**
- **A published post cannot be edited.** `PUT /v1/posts/{id}`: published posts only allow a recycling config change. So "update when the price drops" and "edit the post to say SOLD" in the preview are impossible.
- **Unpublish exists for Facebook, Threads, Google Business** (also X, LinkedIn, YouTube, Pinterest, Bluesky, Telegram) and **NOT for Instagram, TikTok, Snapchat.** So on a sale: Facebook/Threads/Google = take the post down; Instagram/TikTok = it stays up, and the link in it lands on our page, which shows Sold. A price drop = a NEW post ("Price drop"), never an edit.
- **Instagram needs a Business account.** Sellers on a personal Instagram cannot connect; the connect screen must say so.
- **TikTok:** photo carousels up to 35 images; the photo title is cut to 90 characters with hashtags/URLs stripped (a link in the caption will not survive); the API requires privacy choice, comment/duet/stitch flags and "confirm content preview and give express consent". So TikTok is **approve-each-post, never automatic.** Cap 15 photo posts a day per account.
- **Image types: JPEG, PNG, GIF only.** Our see-through car photos are WebP (`ALPHA-1`), so the publisher must convert WebP to JPEG before sending.
- Facebook: up to 10 images per post, cannot mix photos and video. Instagram carousel: up to 20, cannot mix. YouTube always needs a video.
- **Webhooks:** `post.published`, `post.failed`, `post.partial` (a `post.failed` can arrive AFTER a `post.published`), `account.connected`, `account.disconnected`, `webhook.test`. Headers `X-Zernio-Event`, `X-Zernio-Event-Id` (dedupe on this), `X-Zernio-Signature` = HMAC-SHA256 when the subscription has a secret. Test: signature encoding (hex vs base64) is not stated in what I read; check it with a `webhook.test` event before relying on it.
- **Rate limits:** 60 requests/min on the free tier, 600/min once paid. Posting volume itself is unlimited. A 15-minute queue is far below this.
- Reddit is currently down (irrelevant to us).

**Cost (from `pricing.md`; US dollars; check today's exchange rate):** you pay per CONNECTED ACCOUNT per month across the whole Drevo team. One Facebook Page = 1 account, one Instagram = 1, one TikTok = 1.
| Connected accounts (all sellers together) | Price per account |
|---|---|
| 1-2 | free |
| 3-10 | $6 |
| 11-100 | $3 |
| 101+ | $1 |
Their examples: 10 accounts = $48/mo, 20 = $78/mo, 100 = $318/mo, 1,000 = $1,218/mo. Analytics, comments, inbox and unlimited posts are included. So a seller with Facebook + Instagram + TikTok costs about $9/mo at the 11-100 tier (about $3 at 101+). That is more than the whole RM35 Premium price at today's rates, so **auto-post cannot be inside RM35**. It also means RM300 is not forced by Zernio's cost; the price is a market question, not a cost question. Our other costs (storage, support, Meta/TikTok review work) are separate.
>>>>>>> HEAD

### Architecture (one engine, two screens)
- **Tenant** = `getDealerIdFromProfile(profile)`. Premium solo seller: own id. Dealer/owner: own id. Linked salesmen do not connect accounts; the dealer does. One Zernio profile per tenant.
- **Tables** (new, one migration, after midnight, nobody live; parked until Z1 starts):
  - `social_profiles` (owner_id, zernio_profile_id)
  - `social_accounts` (owner_id, platform, zernio_account_id, display_name, status `ok|expired|revoked`, connected_at)
  - `autopost_settings` (owner_id, enabled, platforms jsonb, rules jsonb, `approval` default `'ask'`)
  - `social_posts` (owner_id, listing_id, platform, kind `live|price|sold`, caption, zernio_post_id, status `queued|needs_ok|sent|failed|skipped`, error, attempts, created_at)
  - `social_usage` (owner_id, day, posts, est_cost) for cost per seller and a daily cap.
  RLS: owner (via `get_my_dealer_id()`) reads own rows; writes only through SECURITY DEFINER functions or the edge function. `zernio_*_id` is never taken from the client.
- **Edge functions** (new): `zernio-connect` (derives owner from the JWT, returns `authUrl`), `zernio-webhook` (verifies signature, updates `social_posts` and `social_accounts`), `zernio-publish` (sends one queued post). API key lives only in an edge-function secret.
- **Trigger path:** a DB trigger on `car_listings` (live / price drop / sold) inserts a `social_posts` row. A cron sweep on :00/:15/:30/:45 only (IO-5), guarded by `where exists`, calls `zernio-publish`. "Post now" button calls it directly. Posting never starts from a screen.
- **Caption:** a fixed template first. Only numbers from the row (price, year, mileage). No AI in v1. If AI is added later it uses `ai-proxy` with an existing feature key, never invents price/instalment/approval, and a person approves.
- **Public-post rules:** no phone numbers (CDP-3). Link to `/showroom/<slug>?src=autopost&ref=<slug>`; WhatsApp only through `/api/wa`. Only live cars; never `private`, `pending_approval` or model cards. Photos via the same public CDN urls.
- **Safety defaults:** approval ON by default (`needs_ok`), daily post cap per tenant, a kill switch in `autopost_settings`, 3 retries then `failed` with a visible reason, expired connections shown as "Reconnect".
- **Account deletion:** `delete-account` / `purge-deleted-accounts` must also delete the Zernio profile. Privacy page (`/privacy`) must list Zernio and the networks as processors before launch.

### Salesman Premium
- Where: Settings > Auto-post (same pattern as other Premium settings, `theme="premium"` / `premiumDark`) plus a "Post this car" action in the car's `···` menu (`salesmanPremium/ListingsTab.jsx`), plus per-car post status line.
- Scope v1: Facebook Page + Instagram, manual "Post this car" with preview and approve. Then rules (on live, price drop, sold), then TikTok photo posts, Google Business, Threads.
- Seller flow: Settings > Connect (official sign-in via `authUrl`, never a password) > pick platforms > post.
- Lite stays free of this. Lapse to Lite pauses posting, keeps the connections for 30 days.

### Dealer dashboard
- Same `AutoPost.jsx` component, replace the localStorage preview in `useAutoPost` with the DB (`DashboardPage.jsx:9072`). `premiumLight` tokens, one raised red key.
- Dealer difference: roles. Owner and manager connect accounts and set rules; salesmen only see status. Post link carries `?ref=` of the car's `assigned_to` rep so the lead resolves through `resolve_lead_salesman`.
- Consignment/private-purchase cars are never auto-posted without a per-car "OK to advertise" (those tables do not exist yet, so v1 posts only cars with status `available`).

### Phases
| Step | Who | Output | Gate |
|---|---|---|---|
<<<<<<< origin/main
| Z0 verify | Owner allows hosts, Claude reads docs | One page: per-platform support (create/edit/delete/photo/video), webhook signing, real price per profile and per account, rate limits, TikTok/Meta app-review status, data location | Real unit cost per seller. If RM300 doesn't clear it, stop |
=======
| Z0 verify | DONE on paper 2026-11-12 (see above). Left to TEST: signature encoding, Facebook page-select, Instagram Business requirement, WebP to JPEG, TikTok consent flow | A free Zernio account (first 2 accounts free) connected to the owner's own Page + Instagram | Owner posts one real car through the API from a throwaway script |
>>>>>>> HEAD
| Z1 connect + manual post | Claude | Migration, `zernio-connect`, `zernio-publish`, Premium Settings + "Post this car" (FB Page + IG) | Owner's own seller account posts one real car on staging |
| Z2 rules + queue | Claude | Trigger, sweep cron, webhook, retries, caps, usage table | A price drop and a sale each produce exactly one action, none duplicated |
| Pilot | Owner | 3 Premium sellers, free, asked what saved time | At least 2 keep it on after 2 weeks |
| Z3 dealer | Claude | Dealer screen on the same engine, role gating | Manager can; salesman cannot connect |
| Z4 later | Parked | Unified inbox, social analytics, ads, WhatsApp Business | Only if Z2 pilot shows demand |

### Acceptance (Z1 + Z2)
- Seller A can never read, connect, or post to seller B's accounts (probe as two sellers; probe as anon).
- No secret or token in browser, repo, logs or the push/notification text.
- Webhook with a bad signature is rejected.
- A car going live twice, or a retry, never posts twice (unique key on listing + kind + platform).
- Sold/unpublished/private cars never post. Post contains no phone number.
- Expired connection shows "Reconnect" and the queue pauses, not fails silently.
- Account deletion removes the Zernio profile.
- Release: staging first; production only after midnight MYT with `seller_live_state` empty.

### Open owner calls
<<<<<<< origin/main
1. Allow `zernio.com` + `docs.zernio.com` in the environment network settings (needed for Z0).
2. Is auto-post a separate paid tier or an add-on to Premium? (RM300 is still only a proposal.)
3. Which two platforms first? I suggest Facebook Page + Instagram, because used-car buyers in Malaysia already live there.
4. Approval default: ask before every post (recommended), or auto after the first 5 approved?
=======
1. Create the Zernio account and an API key (owner only; give it to Supabase as an edge-function secret, never in chat or the repo). `docs.zernio.com` is optional now.
2. Is auto-post a separate paid tier or an add-on to Premium? (RM300 is still only a proposal.)
3. Which two platforms first? I suggest Facebook Page + Instagram, because used-car buyers in Malaysia already live there.
4. Approval default: ask before every post (recommended), or auto after the first 5 approved?

## PART 4: Connect flow + the caption adjuster (owner asked 2026-11-12)

### Keys: ONE for Drevo, none for sellers
- **One Zernio API key for the whole platform**, created in the Zernio dashboard (zernio.com/signup, then API keys). It lives only in a Supabase edge-function secret (`ZERNIO_API_KEY`), set by the owner in the Supabase dashboard, never in chat, the repo or the browser. Zernio keys appear to be limitable by area (publishing, messages, billing... the spec talks about "resource groups" and "full-scope keys"): create ours with publishing + profiles/accounts ONLY, so a leak cannot read DMs or spend ad money. Confirm in the dashboard.
- **Sellers never see or type a key.** They tap "Connect Facebook", log in on Facebook's own page, and approve. Their password goes to Facebook/TikTok, never to us or Zernio. Zernio keeps the login token; we keep only ids.
- **We do NOT need our own Meta, TikTok or Google developer app.** Zernio's own apps do the platform approvals and token refresh. Cost of that: the consent screen is co-branded with Zernio (we can set `brandName` for the heading). Using our own OAuth app is possible later, but means Meta App Review and business verification: weeks, not now.

### Flow
1. Settings > Auto-post > "Connect Facebook Page" (button calls edge function `zernio-connect`; owner id comes from the login, never from the request).
2. Function finds or creates the seller's Zernio profile (`POST /v1/profiles`, `externalId` = owner id, saved in `social_profiles`), then calls `GET /v1/connect/facebook?profileId=&redirect_url=https://drevo.my/...?connected=facebook` and returns `authUrl`.
3. Seller goes to Facebook, picks the Page, approves, returns to us. (Facebook has an extra "select page" step; test whether Zernio's hosted page handles it.)
4. Webhook `account.connected` (signature checked, deduped on `X-Zernio-Event-Id`) writes `social_accounts`. We do not trust the redirect URL; we confirm with `GET /v1/accounts?profileId=`.
5. Posting-only: ads and inbox are separate Zernio connects (`/connect/{platform}/ads`) that we never call. Check the consent screen at test time shows posting permissions only.
6. `account.disconnected` marks the row "Reconnect" and pauses that platform's queue.
7. Delete account / seller leaves: disconnect every account, then delete the Zernio profile (Zernio refuses to delete a profile that still has accounts).

### Smart adjuster = one pure function, `buildPost(car, seller, platform)`
One file used by the app preview AND the publisher, with unit tests (same pattern as `npm run test:live`). Input: the car row only. Output per platform: `{ text, images, warnings }`. The seller sees the result with a live count ("412 / 500") and can edit before approving.
Always: no phone number (CDP-3); no invented figure; price, year, model come from the row; link built with the existing canonical-car-URL helper (`api/og.js:146`), never hand-typed; `?src=autopost_<platform>&ref=<slug>` so visits are counted (add the new `src` values to `src/utils/detectChannel.js`).

| Platform | Rule | Source |
|---|---|---|
| Facebook Page | Long text fine, link on its own line (clickable). Up to 10 photos | Zernio spec |
| Instagram | Link in a caption is NOT clickable: end with "All my cars: link in bio" (our BIOLINK-1 wording). Up to 20 photos; Business account only. Caption cap about 2,200 (Instagram's rule, test) | Zernio spec + Instagram |
| TikTok | Photo title cut to 90 chars with links/hashtags stripped; description up to 4,000. So: title = "2021 Honda City RM68,000", description = details + "link in bio", NO url. Up to 35 photos, 15 photo posts a day. Always approve-first (TikTok needs consent per post) | Zernio spec |
| Threads | Hard cap about 500 characters (Threads' rule, test). Link counts. | Threads |
| Google Business | Short post, link as the button if Zernio exposes it; about 1,500 chars (Google's rule, test) | Google |
| YouTube Shorts | Needs a video. Not in v1 | Zernio spec |

**Fitting text (all platforms):** build the full text, then if too long drop pieces in this order: description, location, mileage, variant. NEVER cut: year + model, price, the link (or "link in bio"), the word SOLD. If even the shortest form does not fit, do not send; show a warning. Free text is cut only at a word boundary with "...". A number is never cut in half.

**After posting:** price drop = a NEW post ("Price drop"), using only a price the car really had live. Sold = unpublish on Facebook, Threads, Google; Instagram/TikTok stay up and the link shows Sold.

### Where to get what (owner)
| Need | Where | Business registration? |
|---|---|---|
| Zernio API key | zernio.com/signup, then dashboard, API keys. Card needed once past 2 accounts | Not stated in their pricing; check at signup |
| Facebook | Seller makes a free Facebook Page (posting goes to Pages, not personal profiles) | No |
| Instagram | Switch the account to Business/Creator in the Instagram app (free) | No |
| TikTok | A normal TikTok account; Zernio connects through the "TikTok for Business" app | Expected no, confirm at test |
| Threads | Threads account (tied to Instagram) | No |
| Google Business | A verified Business Profile (Google's rule; many individual agents will not have one) | Google verifies the location, not a company |

## PART 5: First live test against the real API (2026-11-12) - findings
Key works (read, create, delete). Nothing published; two far-future test posts were created and deleted; no profile created.
- Owner's Zernio workspace: one profile "Default" with Threads @airyauzy_ and Facebook Page "Xdrive Service" (rename the Page to Drevo before real sellers see it).
- **Free tier blocks a second profile.** `POST /v1/profiles` returned 402 `PAYMENT_REQUIRED` (`free_tier_exceeded`) because 2 accounts exist and no card is on file. A card must be added in Zernio billing before the Premium + dealer two-profile test. Cost still starts only past 2 accounts.
- **Zernio does not enforce the Threads length cap when scheduling** (501 characters accepted). Our `buildPost` must enforce every platform cap; do not rely on Zernio to reject.
- **Default connect is NOT posting-only.** The Facebook connection holds `ads_management`, `business_management`, `pages_messaging`, `leads_retrieval`, `pages_manage_posts`, ...; Threads holds replies/insights/delete as well. `scopes` can only narrow inside our OWN OAuth app (`oauthAppId`), which needs Meta App Review. Plan: pilot on Zernio's app with plain disclosure on the connect screen and `/privacy` ("Drevo only posts; the connection technically allows more, which we do not use"); own app when the seller count justifies the review. Use `expectedPlatformUserId` so a seller can only connect the account they meant to.
- No webhooks registered yet; register after the edge function has a public URL, then test the signature with `webhook.test`.
>>>>>>> HEAD
