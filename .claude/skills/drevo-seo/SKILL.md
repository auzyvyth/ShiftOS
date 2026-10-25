---
name: drevo-seo
description: "The Drevo (formerly XDrive) SEO playbook. Use when the owner asks for SEO work: 'do SEO', 'get us ranking', 'more traffic from Google', 'backlinks', 'write an article', 'content plan', 'why don't we show up on Google', 'AI search / ChatGPT mentions'. Covers the audit, the pipeline from brand facts to published page, the topic bank, and the guardrails specific to this repo."
metadata:
  version: 1.0.0
  source: "Distilled 2026-10-25 from a FameHero campaign preview the owner shared (screenshots), stripped of what does not apply here."
---

# Drevo SEO playbook

Plain goal: a Malaysian car buyer who searches for a car, a price, or a how-to finds
a Drevo page, and that page is ours (on our domain), true, and useful.

## 0. Before anything
- Read `TODO.md` BRAND-1. Until switch day the domain is still xdrive.my. New copy
  says "Drevo"; domains come from `src/config/site.js` (`SITE_URL`), never typed.
- Backlink work (directories, outreach, pitches) is PAUSED until the name is live
  (`TODO.md` BRAND-1). Content on our own domain is NOT paused: it carries over by 301.

## 1. Audit (the FameHero "step 2" report, done with real checks)
Report it in this shape, each line with evidence (a query, a URL, a file:line):
- **Search presence**: what shows for the brand name and for 3 money queries
  (e.g. "harga alphard recon", "kereta terpakai bawah 50k", "apa itu recon").
  Note who outranks us. The brand-name problem (BMW xDrive) is solved by the rename,
  not by content; do not spend work fighting it.
- **Crawlability**: every public route has a crawler entry in `api/og.js`, is in
  `api/sitemap.js`, and is allowed by `api/robots.js`. Bots never run the SPA.
- **Strengths / Weaknesses / Opportunities**: three bullets each, max. Each must be a
  fact about the site, never a vibe ("mixed sentiment") without a source.
- **Goal**: pick ONE per round. Default = "Sales & leads": visitors ready to buy.

## 2. The pipeline (the FameHero graph, adapted)
```
Brand facts + our own assets
        -> Plan (one goal, one query cluster)
        -> Select assets (rights checked)
        -> Draft (Malay by default)
        -> three branches:
             SEO pages      (our domain: articles, model hubs, calculators)
             News coverage  (earned: a human pitches a real story to a real writer)
             Authority      (citations: directories, profiles; paused until rename)
        -> Publish: a HUMAN approves every page. Never automated publication.
```
- **Brand facts** = what the DB and code can prove: live car count, brands, states,
  features that exist. Read them (`get_marketplace_stats`, the repo), never invent.
- **Assets** = only photos we have the right to use: the owner's own, or a brand's
  written permission. Sellers' listing photos belong to sellers: never in marketing.

## 3. Where each page type lives (do not build a second system)
- Articles: new file in `src/pages/articles/` + route in `App.jsx`, then
  `npm run articles:build`, bump `dateModified`. Crawler HTML is generated
  (`src/config/articlePages.generated.js`); `npm test` fails if stale.
- Model hubs `/used-cars/:brand/:model`: `src/utils/modelHubs.js` owns URL + copy.
  Only quote numbers from live rows. No live car = 404, never an empty page.
- Other public pages: copy in a `src/config/*Copy.js` file shared with `api/og.js`.
- AI answer engines: `public/llms.txt`. Keep it true and short.

## 4. Topic bank (from the preview, with a verdict each)
- "What is a recon car in Malaysia" -> EXISTS (`ReconArticle.jsx`). Improve, do not
  duplicate. Never say "certified": nothing on the platform certifies a car.
- "How to buy a used car online safely" -> GOOD. Puspakom, loan checks, never pay
  before seeing the car. Link `PuspakomB5B7Article.jsx`, `FlatRateVsEirArticle.jsx`.
- "Top 10 used cars in Malaysia" -> GOOD only if ranked by OUR data (most listed /
  most viewed this month) and dated. No "best" claims we cannot back.
- "Family SUVs / MPVs available now" -> BETTER as a model hub or a filtered page,
  which stays true as stock changes. An article listing cars goes stale in a week.
- "Drevo revolutionises car buying / your trusted hub" -> SKIP. Self-praise ranks for
  nothing and "trusted" is a claim we must not make.
- Price articles ("Harga X recon") -> PROVEN pattern (`HargaAlphardReconArticle.jsx`,
  `HargaHarrierReconArticle.jsx`). Repeat for the next most-listed models.

## 5. Guardrails (each one has bitten this repo before)
- No promise about listings the platform does not check (Puspakom, documents,
  "verified", "certified", "trusted"). Only `is_verified` / `docs_verified` may say so.
- No invented price, rate, instalment or approval. Loan maths only via
  `src/utils/financing.js` (EIR).
- No paid links, link farms or bulk press-release syndication: Google treats paid
  links as a link scheme. Earned and relevant, or nothing.
- AI may draft; the owner reads and approves before it goes live.
- Legal or regulated topic (loans, HP Act, PDPA, insurance): web-search the real rule
  first, cite it in the article.

## 6. Done means
Page live on staging, `npm test` green, crawler HTML present (curl the URL with a bot
user agent), in the sitemap, and the owner has read it. Report each with file:line.
