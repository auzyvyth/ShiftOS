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

## Same-town check: design only (stage 4, NOT built: it needs a database function)
What the dealer sees: under "Your look" in Storefront > Layout, after any change to the top banner,
cars or font: "Acme Motors in Shah Alam already uses this mix. Shuffle?" with the Shuffle button.
It never blocks saving: a warning, not a rule.
- **Fingerprint** = top banner version + cars version + font, e.g. `c|a|bold` (the three things a
  buyer sees first). Order and lower sections are left out: two sites with the same first screen look
  the same whatever is below.
- **Why a DB function:** a dealer cannot read another dealer's `profiles` row (RLS), and the public
  lookup `get_dealer_profile_by_subdomain` goes by subdomain, not by town. So: one
  `security definer` function `storefront_look_taken(p_hero text, p_cars text, p_font text)`
  returning at most ONE row `(site_name, city)`: another dealer (not the caller) in the caller's
  `state`, with a subdomain and at least one available car, whose cleaned layout has the same
  fingerprint (a NULL layout = `a|a|modern`). Granted to `authenticated` only; the caller must be a
  dealer / owner. It returns only what that dealer's own site already shows publicly (name, town),
  never their layout or any other field. The arguments are checked against the fixed lists
  (`a`/`b`/`c`, the font ids); anything else returns nothing.
- **Mirror rule:** the function's font list and the "NULL = default" rule must match
  `storefrontLayout.js` (`FONT_IDS`, `DEFAULT_FONT`); `npm run test:storefrontlayout` should read the
  SQL file and compare, the same way it checks `storefront_layout_ok` today.
- **Editor:** call it 600 ms after the last look change (not on every tap), show the first match only.
  The default look will match many dealers; say so plainly ("3 dealers in Selangor use the usual look").
- **When:** the dealer dashboard has no live users yet (CLAUDE.md "check it will be used"), so the SQL
  goes to `supabase/parked/` with a README row when built, and into a dated migration in the
  after-midnight window only once dealers use the editor. One migration, no table, no index (a few
  hundred dealers per state at most).

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
| 2 | DONE 2026-11-20 (DB part queued in `20261120a`): `profiles.storefront_layout` + `storefront_layout_ok`, rules in `src/utils/storefrontLayout.js`, lazy sections, editor Storefront > Layout with a page map + "See it on my site" (unsaved preview via `?layout=`). A framed live preview inside the dashboard needs a frame-ancestors exception: left for stage 3 | editor | 2 |
| 3 | DONE 2026-11-20 (needs no migration): top banner A Slides / B Split / C Showroom wall, cars A Grid / B Rail / C Spotlight; editor "Look" picker; only the picked version downloads | yes | 2 |
| 4 | FIRST SLICE DONE 2026-11-20 (local commits, not on staging; needs no migration): versions B/C for About (Side by side / Opening line), Why us (Side by side / Numbered), By the numbers (Big numbers / Colour band), How it works (Timeline / In a row), reviews (Side by side / Framed), one lazy file each; 4 heading fonts (Modern / Bold / Classic / Sharp, body stays Outfit), 4 ready looks (Original / Showroom / Boutique / Quick browse), Shuffle, all in `storefrontLayout.js` with tests. `font` is a top-level key the live `storefront_layout_ok` already allows. Default page pixel-identical before/after. SECOND SLICE 2026-11-20 (no migration): site theme. Free Background/Cards/Accent pickers were built, then cut by the owner the same day to TWO themes, Dark or Light, plus one optional accent (a red or blue page had no card edges); saved as `theme: {mode, accent}` on the same jsonb; Light is a fixed palette in `src/utils/storefrontTheme.js` with a solid card border, every word >= 4.5:1 (`npm run test:storefronttheme`); every dealer-site colour is `var(--sf-x, <old>)`, so no theme = pixel-identical. Not themed: /cars, car pages, Compare, Calculator (only their shared Header follows, and only when vars are set, which is the home page only), photo overlays in the banner. STILL OPEN: B/C for strip, video, hot deals, testimonials, calculator, contact; theme + fonts on /cars and car pages; the same-town check (designed below, needs a DB function); fonts on /cars and car pages | yes | 3 |
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
