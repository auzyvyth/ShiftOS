# STOREFRONT-2: dealer sites worth RM100 a month on their own

Scope written 2026-11-20 (owner: "make it advance as hell that on its own it's worth rm100 a month").
Nothing here is built yet. TODO.md STOREFRONT-2 points here.

## The product in one line
A dealer's own website that looks like no competitor's, fills and refreshes itself from their stock,
gets found on Google, catches every buyer, and shows the dealer each month what it brought in.

## Push back first (read before building)
1. **A look alone is not worth RM100.** Website builders cost about the same and look fine. A dealer
   pays for buyers. The mix-and-match look is the hook that sells the demo; the RM100 is earned by
   layers 3 to 5 (found on Google, catches the buyer, proves it). Every feature below is there
   because it brings or keeps a buyer, or it is cut.
2. **Today nobody visits dealer sites**: 6 page views in 60 days, all on the owner's test site `vyth`
   (`analytics_events`, checked 2026-11-20). Without the Google layer the redesign is decoration.
3. **Price conflict.** Dealer plans are RM299 to RM2,999 a month (`src/utils/planConfig.js`) and the
   site is already part of them. RM100 only works as one of:
   (a) a site-only plan for dealers NOT on the dealer dashboard, the cheap door into Drevo;
   (b) a "Sites Pro" upgrade on top of a basic site that every dealer plan keeps.
   Recommendation: both. Basic site stays in every plan; Sites Pro = RM100, also sold alone.
4. **Sell only what exists** (CPA 1999 s.10, same rule as the pricing cards). The pricing card lists a
   layer only once it ships.
5. **Typed testimonials go.** Settings > Storefront lets a dealer type any testimonial
   (`storefront_testimonials`), which nothing checks: a made-up review on a page we host is a
   misleading claim. Pro shows real buyer reviews only (`reviews` table), plus a "leave a review"
   link the dealer sends after a sale.

## Layer 1: the look ("Rubik's cube")
- Every section of `src/pages/HomePage.jsx` (2,021 lines today) becomes its own component with up to
  3 versions: hero (photo carousel / video / split with search), cars (grid / showroom rail /
  magazine), about, why us, stats, how it works, reviews, finance + trade-in panel, team, visit us.
- Dealer picks a version of each, the order, on/off per section (replaces the "show/hide toggles"
  item), a brand colour (gold `#c9a84c` = never chose) and one of 4 curated font pairs. Cars and
  contact are always on.
- **Presets** (4 named looks) for dealers who will not design, and **Shuffle** for those who want a
  fresh mix in one tap. Live preview, phone and desktop side by side, before saving.
- **No two dealers in one town look the same.** The saved layout has a fingerprint; picking the same
  hero + cars + font as another dealer in the same state shows "Acme Motors in Shah Alam already
  uses this mix" and offers a Shuffle. Cheap to build, and it is the sales line.
- **Seasonal skins** (Raya, CNY, Deepavali, Merdeka, year-end): a skin has a start and end date and
  switches itself off, so a site never shows Raya in July.
- Rules that keep any mix looking designed: one spacing scale, one type scale, the brand colour as
  the only accent, no version may load a library or a heavy effect.

## Layer 2: it fills itself
- Rows built from stock, no typing: "Just arrived" (last 14 days), "Price dropped" (the
  `is_hot_deal` column, one definition), "Under RM 50k" bands, body-type rows. A row with no cars
  hides itself (same rule as the nav).
- Hero falls back to the newest cars' best photos when no banner is set, so it is never empty.
- "Recently sold": car + month only, no price, no buyer (same rule as the agent page).
- Promo banner with start and end dates; an expired promo disappears by itself.

## Layer 3: it gets found (the layer that earns the money)
- Each car gets a page on the dealer's site with Car schema, its own title, and a sitemap per site.
  **Owner decision:** the same car already has a marketplace page (`/showroom/<slug>`). Google picks
  ONE as the original (canonical). Marketplace = Drevo grows; dealer site = the dealer's own Google
  presence grows. Recommendation: dealer site for Sites Pro dealers only.
- Town pages generated from stock ("Used cars in Shah Alam at Acme Motors"), same rules as the model
  hubs (`src/utils/modelHubs.js`): exists only while it has a live car, quotes only real numbers.
- **Own domain** moves into this tier (`acmemotors.com.my`), with Drevo adding it on Vercel through
  their API so the owner does no manual work. Check Vercel plan limits on domains before selling.
- Every crawler page goes through `api/og.js` (bots never run the app), and the `AutoDealer` schema
  already shipped (`src/utils/dealerSchema.js`).
- Speed budget enforced in the build: phone LCP under 2.5 s, first screen under 150 kB of script.

## Layer 4: it catches the buyer
Already built: trade-in form, Check my loan, WhatsApp, chat, bookings. Add:
- **"Tell me when a car like this arrives"**: buyer leaves an email for a brand / budget / body type;
  a new matching car emails them (the marketplace price-alert engine exists, `notify-price-alerts`).
  This is the dealer's own remarketing list with no ad tracking and no cookie problem. Needs consent
  text + unsubscribe link, same as the chat email.
- **Book a viewing with real slots** from the team's availability (the booking engine exists).
- **Languages: English, Malay, Chinese.** Many Malaysian buyers read Chinese first (not measured:
  ask dealers before building). The dealer's own words are drafted in the other languages by AI and approved by the dealer.
- **Sales on duty**: WhatsApp goes to whichever salesman the dealer put on duty today. Must go
  through `resolve_lead_salesman` (the one resolver), never a second rule.

## Layer 5: it proves it (why they keep paying)
- **Monthly report on the 1st**, push + email: "Your site brought 14 enquiries, 3 test drives,
  2 sales worth RM 9,400 gross this month". Counted from leads whose source is the site (enquiry,
  trade_in, loan_check, chat on the subdomain) and the won deal's gross from `carPnl()` (one engine).
  No number that is not counted; a small month says so.
- **Which look sells**: enquiries per 100 visits for each hero version across all Pro dealers, so a
  dealer sees e.g. "the video hero brings more enquiries per visit" once enough visits exist. Below the minimum
  sample it says what unlocks it (same rule as the Performance tab).
- **AI copy assistant**: drafts About / Why us from facts the dealer gives (years open, branches,
  warranty they really give). Never invents a claim ("verified", "best price", "lowest rate"); the
  dealer approves every word.

## Data
- `profiles.storefront_layout` jsonb, one small object
  `{v:1, sections:[{id,variant,on}], font, color, skin, preset}`, checked by one DB function against
  a fixed list, mirrored in a JS file with a shared test (pattern: `dealer_can`).
- `storefront_promos` (dealer, text, link, starts, ends), `storefront_alerts` (dealer, email, what to
  match, consent time, unsubscribe token). Each table joins the next night migration, one migration.
- Plan check: `sites_pro` entitlement read in ONE place (DB helper + JS mirror), like
  `salesman_has_full_page`.

## Stages (one session is roughly one stage unless noted)
| # | Stage | Visible? | Size |
|---|-------|----------|------|
| 1 | DONE 2026-11-20: HomePage split into `src/components/storefront/sections/` (13 sections, HomePage 2,021 -> 330 lines); filled and blank mock dealers pixel- and HTML-identical before/after on desktop + phone | no | 1-2 |
| 2 | Layout JSON + checker + only the chosen versions load + editor with live preview | editor | 2 |
| 3 | Hero x3 and cars x3, mock screenshots first | yes | 2 |
| 4 | Remaining sections x3, fonts, presets, Shuffle, same-town check | yes | 3 |
| 5 | Google layer: dealer car pages, sitemap, town pages, canonical (needs decision) | crawler | 2-3 |
| 6 | Monthly report | yes | 2 |
| 7 | Own domain automation | setup | 2 |
| 8 | Alerts list, viewing slots, sales on duty | yes | 3 |
| 9 | Chinese + Malay, seasonal skins, AI copy assistant | yes | 3 |

Sellable minimum = stages 1 to 6 (about 12 sessions): looks unique, found on Google, proves itself.
Stages 7 to 9 are what keep it ahead once a competitor copies the look.

## Decisions the owner makes before stage 5
1. Price model: add-on, standalone, or both (recommended: both).
2. Canonical: marketplace or the dealer site owns a car's Google result.
3. Remove typed testimonials (recommended: yes).
4. Own domains: Vercel plan cost per domain.
5. Chinese: yes or no.
