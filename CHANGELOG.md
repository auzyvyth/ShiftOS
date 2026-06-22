# Changelog

All notable changes to ShiftOS / XDrive. Dates are release-to-production dates.

## 2026-06-22

### SEO / AEO (answer-engine optimization)
- **Crawler prerender rebuilt (`api/og.js`).** Bots were served one generic, near-empty stub for every non-car URL, so `/marketplace`, `/showroom`, `/shiftos`, `/articles/*` and `/compare` looked like thin duplicates to Google and went unindexed. The prerender now returns unique, content-rich HTML per route: listing pages render live car links + `ItemList` schema (so sublinks are discoverable), `/shiftos` and articles emit their real meta + `SoftwareApplication`/`FAQPage`/`Article` JSON-LD, and personal pages (`/saved`, `/account`) are `noindex`.
- **ShiftOS landing page (`/shiftos`)** now has keyword-led meta, a bilingual FAQ, and `SoftwareApplication` + `FAQPage` JSON-LD targeting the BM/Manglish + English vocabulary Malaysian used-car dealers actually search.
- **5 new BM dealer-software guides** under a new "Urus Dealer" category, each with `Article` + `FAQPage` schema and internal cross-links: what is a DMS, digital stock management, best dealer app 2025, salesman commission calculation, and used-car sales agreements.
- **Sitemap** now includes `/marketplace`, `/shiftos`, `/compare`, `/articles` and all article URLs; removed the dead static `public/robots.txt` (served dynamically by `api/robots.js`).
- **Per-page tab titles** fixed (Saved, Account, Compare no longer inherit the previous page's title).

### Dealer dashboard & analytics
- **Analytics tab reorg:** moved the engagement spike chart and salesman-performance card out of Listings into the Performance tab; listing rows now link to the internal car-detail page; Revenue tab widened to use full content width; the analytics header/sub-tab bar slimmed down.
- **RevOps:** clarified the lead-count cards so all-time vs 30-day vs per-salesman windows are unambiguous.
- **Data reconciliation:** units-sold now reads consistently across Revenue/Listings/Overview (stock and listing ledgers aligned; orphaned won deals backfilled; test/junk records removed).

### Marketplace, buyer accounts & auth
- Dedicated buyer login/signup with realtime password-requirement checklist; fixed a buyer privilege leak and the blank buyer account homepage.
- Marketplace header rebuilt with mega-menus + a Compare link; sign-in buyer/seller dropdown and Google One Tap on the marketplace.
- Compare tool for similar cars; filter Search button; anonymous-hero fix.
- Onboarding "Change plan" picker.

### Listings, stock & operations
- Stock tools consolidated into a Listings "Tools" dropdown (Stock nav tab dropped); compact Stock P&L stats strip and connected cost columns; true net P&L.
- Edit / mark-sold / price changes now reflect instantly in the detail panel.
- Puspakom B5/B7 badges show date + year and flag staleness; full per-car history timeline with backfilled creation events.
- Oversight revenue drill-down + what-sells trends; per-salesman assigned-cars with assign/unassign.

### Infrastructure / CI
- **Playwright workflow fixed.** It previously ran only the default scaffold test against `playwright.dev` (not ShiftOS). Replaced with real chromium smoke tests of `/`, `/shiftos` and `/compare` against a local preview build, which also guard the SEO titles from regressing.
- PWA: clean stale precache + claim clients to stop post-deploy white-screens.
