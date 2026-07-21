# XDrive / ShiftOS — SEO & AI-SEO Action Plan

Your task list to get XDrive + ShiftOS recommended when people search Google **and**
when they ask ChatGPT / Perplexity / Google AI Overviews / Copilot about used-car
dealer software, salesman apps, or cars in Malaysia.

**What's already done in code (this session):** llms.txt rewritten and accurate,
sitemap now lists every acquisition page, robots hardened, and the Organization
entity graph (with your social profiles) is wired into structured data. Your on-page
technical SEO was already strong — the work below is the off-page + config half that
only you can do. Do it top to bottom; earlier tiers unlock the later ones.

Pricing to keep identical everywhere (single source of truth):
Salesman Lite RM0 · Salesman Premium RM20/mo · Dealer Starter RM299/mo ·
Dealer Growth RM599/mo · Dealer Pro RM1,199/mo · Dealer Group RM2,999/mo.

---

## TIER 0 — Ship the code changes (5 min, do this first)

Nothing below matters until the new SEO code is live on xdrive.my.

- [ ] **0.1** Tell Claude (next session): "push the marketing-user-acquisition branch
  to production." It goes staging → PR → prod. Until then the improvements sit on
  the `claude/marketing-user-acquisition-9jeaat` branch only.
- [ ] **0.2** After it's live, confirm in a browser:
  - `https://xdrive.my/llms.txt` shows the new curated file (starts with "# XDrive").
  - `https://xdrive.my/sitemap.xml` loads and includes `/for-salesmen` and `/guides`.
  - `https://xdrive.my/robots.txt` loads and lists the Sitemap line.

---

## TIER 1 — Get indexed (do this weekend; biggest, fastest wins)

### 1. Google Search Console  (https://search.google.com/search-console)
- [ ] **1.1** Add a **Domain** property for `xdrive.my` (not URL-prefix). Verify by
  adding the TXT record it gives you in your domain DNS (Namecheap/Cloudflare/wherever
  xdrive.my is registered). A Domain property automatically covers **every dealer
  subdomain** too (sentimas.xdrive.my etc).
- [ ] **1.2** Sitemaps → submit `sitemap.xml`. (It's a sitemap index — Google will
  find the main sitemap + every dealer storefront sitemap from it.)
- [ ] **1.3** URL Inspection → paste `https://xdrive.my/shiftos` → "Request indexing".
  Repeat for `/for-salesmen`, `/`, `/showroom`, and each of your 8 `/articles/...` pages.
- [ ] **1.4** Bookmark the **Performance** tab — in ~1 week it shows the exact search
  queries bringing people in. This tells you which articles to write next.

### 2. Bing Webmaster Tools  (https://www.bing.com/webmasters)  ← AI-SEO critical
Bing's index powers **ChatGPT Search and Microsoft Copilot**. Skipping Bing = invisible
to ChatGPT web results.
- [ ] **2.1** Add `xdrive.my`. Fastest path: "Import from Google Search Console" (one click).
- [ ] **2.2** Submit `sitemap.xml`.
- [ ] **2.3** Use "Submit URLs" to push your top 10 pages for instant indexing.

---

## TIER 2 — AI-SEO / entity building (the "get recommended" tier)

AI engines recommend brands they can (a) verify are real and (b) find described
consistently across trusted third-party sites. This tier builds both.

### 3. Verify your own social profiles are real & active
I put these into your structured data as your official profiles — make sure each
exists, is public, has your logo, and links back to xdrive.my:
- [ ] **3.1** facebook.com/xdrive.my
- [ ] **3.2** instagram.com/xdrive.my
- [ ] **3.3** tiktok.com/@xdrive.my
  (If any handle is wrong/inactive, tell Claude the correct one — it's referenced in
  the code and should match reality. A `sameAs` to a dead profile hurts more than helps.)

### 4. Software directories AI engines cite for "best X software"
When someone asks an AI "best used car dealer software Malaysia," it pulls from these.
Create a listing on each with the **exact same** name, one-line description, and the
**full pricing ladder above** (Lite → Dealer Group). Free tiers on all of these:
- [ ] **4.1** Capterra  (capterra.com — vendor listing)
- [ ] **4.2** G2  (g2.com/products/new)
- [ ] **4.3** GetApp  (getapp.com)
- [ ] **4.4** SoftwareSuggest / SaaSworthy (both index Asian SaaS heavily)
- [ ] **4.5** Product Hunt launch (producthunt.com) — even a modest launch creates a
  permanent, high-authority citation page.
- [ ] For each: name = "ShiftOS", category = "Auto Dealer / DMS / Automotive CRM",
  tagline = "Used-car dealer software for Malaysia — inventory, leads CRM, sales &
  salesman commission." Mention it's by XDrive and works for both dealers AND
  individual salesmen (Lite free / Premium RM20).

### 5. Company entity pages (cheap, permanent trust signals)
- [ ] **5.1** LinkedIn Company Page for XDrive (logo, description, xdrive.my link).
- [ ] **5.2** Crunchbase — free company profile.
- [ ] **5.3** Google Business Profile (business.google.com) — pick "Software company"
  or your real Malaysian business address. Adds you to Google Maps + the local entity
  graph, which AI Overviews leans on for "Malaysia" queries.

### 6. Show up where the questions are actually asked (highest AI-SEO ROI)
AI engines crawl forums and communities constantly. Genuine, helpful answers that
mention ShiftOS become the source they quote. **Be helpful first, not spammy.**
- [ ] **6.1** Lowyat.NET forum — the Malaysian go-to. Find/answer threads on car
  dealer tools, salesman commission, running a used-car business.
- [ ] **6.2** Facebook groups for Malaysian car dealers & salesmen — answer "how do
  you track stock/commission" questions; mention the free Salesman Lite tier as the
  low-friction hook.
- [ ] **6.3** Reddit r/malaysia, r/MalaysianPF, r/cars threads where relevant.
- [ ] **6.4** Your cold-call/text outreach already reaches dealers — when someone's
  interested, send them the `/shiftos` link and (for their salesmen) `/for-salesmen`.
  These shares create real traffic + backlinks Google rewards.

---

## TIER 3 — Config that converts the traffic (do at a computer)

Traffic is wasted if signup is broken. These are TODO.md items only you can set.

- [ ] **7.1  Reliable signup emails (RF-C3).** Default Supabase email is rate-limited
  and drops mail at volume. In Supabase → Auth → SMTP, set custom SMTP via Resend:
  host `smtp.resend.com`, user `resend`, pass = your `RESEND_API_KEY`, sender a
  verified `@xdrive.my` address. Test with a real (non-`+`-alias) email.
- [ ] **7.2  Google One Tap signup (ACT-4).** One-tap signup for marketplace visitors
  is built but dormant. (1) Vercel env: `VITE_GOOGLE_CLIENT_ID=<your Google web
  client id>`. (2) Google Cloud Console → that client → add `https://xdrive.my` to
  Authorized JavaScript origins. (3) Supabase → Auth → Google provider → add the same
  client ID under Authorized Client IDs.
- [ ] **7.3  Leaked-password protection (ACT-6).** Supabase → Auth → Settings →
  Password → enable "Check against HaveIBeenPwned". One toggle.

---

## TIER 4 — Measure organic (so you know what's working)

You're not running ads, but you still need to see which pages/queries bring signups.
- [ ] **8.1** Add lightweight analytics. Recommendation: **Plausible** or **Umami** —
  no cookie banner needed (simpler under Malaysia's PDPA) and won't slow the site.
  GA4 is fine too if you want Google's funnel data. Tell Claude which one and it wires
  it in (~15 min). Skip Meta/TikTok pixels until you actually run ads.
- [ ] **8.2** Weekly ritual: check Search Console Performance + your analytics. The
  winning queries tell you the next article to write.

---

## TIER 5 — Content to commission next (Claude can build; needs your go-ahead)

Highest-ROI content gaps for AI recommendation, ranked. Green-light any and Claude
writes it (with schema) next session:
- [ ] **9.1** A comparison page: "Best used-car dealer software Malaysia" / "ShiftOS
  vs Excel vs manual" — AI engines cite comparison content heavily. (Needs your input
  on which competitors, if any, to name — I won't invent competitor claims.)
- [ ] **9.2** A dedicated **Salesman Premium** section/page (Lite has `/for-salesmen`;
  Premium at RM20 has no standalone SEO surface yet).
- [ ] **9.3** 2–3 more buyer-intent articles targeting queries Search Console surfaces
  after a couple of weeks live.

---

### Fastest path if you only have one hour this weekend
Do **0.1, 1.1, 1.2, 2.1, 2.2** (ship the code + submit both sitemaps). That alone gets
everything indexed by Google and Bing/ChatGPT. Everything else compounds from there.
