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
2. **The preview promises "edit the post to say SOLD / update price" on every platform.** Several networks do not let an API edit a published post (I expect Instagram and TikTok do not; unverified). Z0 must check each platform. Fallback: a new "SOLD" post, or delete the post.
3. **Overlap:** Telegram auto-post already exists (`telegram_auto_post`, `supabase/functions/telegram-notify`). Telegram stays separate; do not add it to Zernio.
4. **Dealer dashboard has no live users yet**, but it is the stated focus. Build the engine for Premium first (real users), and the dealer screen is the same component with a different owner id.
5. Facebook publishing is for Pages, not personal profiles. Say so on the connect screen.

### What the web search showed (vendor pages only, NOT verified)
Base URL `https://zernio.com/api/v1`, bearer API key. Accounts are grouped in "profiles", one account per platform per profile. `GET /v1/connect/{platform}` takes a profile id and a redirect URL and returns an `authUrl`. Zernio says it handles token refresh, platform app approvals and rate limits. Pricing pages disagree with each other (free tier, a per-account figure, X pass-through). Webhook events and signing were not found.
**Blocked: this session cannot reach zernio.com** (`getaddrinfo ENOTFOUND`). To verify, the owner must allow `zernio.com` and `docs.zernio.com` in the environment network settings (Settings, then Environment). Until then, nothing below that depends on Zernio is confirmed.

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
| Z0 verify | Owner allows hosts, Claude reads docs | One page: per-platform support (create/edit/delete/photo/video), webhook signing, real price per profile and per account, rate limits, TikTok/Meta app-review status, data location | Real unit cost per seller. If RM300 doesn't clear it, stop |
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
1. Allow `zernio.com` + `docs.zernio.com` in the environment network settings (needed for Z0).
2. Is auto-post a separate paid tier or an add-on to Premium? (RM300 is still only a proposal.)
3. Which two platforms first? I suggest Facebook Page + Instagram, because used-car buyers in Malaysia already live there.
4. Approval default: ask before every post (recommended), or auto after the first 5 approved?
