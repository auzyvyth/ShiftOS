# Dealer roles: what the owner and the manager need (research, 2026-11-12)

Owner: "research how a dealership actually works, what the owner needs to see, what the manager
needs to see, finish those 2 roles first, what data they need, what authority each has, and
whether we can customize it per dealership." Sources are listed at the end; most are job posts,
vendor guides and Malaysian news, so they describe typical practice, not one shop's rules. Check
the defaults below against 2-3 real dealers before building (questions at the end).

## 1. How a used / recon dealership works (Malaysia)
- Small: many are sole proprietorships. In a one-shop dealer the **owner usually IS the general
  manager**; a separate manager appears when there is a second branch or the owner steps back.
- Capital-heavy: cars are paid in full before delivery, often with a **floor-stocking loan**, so
  every day a car sits costs interest. Money tied up in stock is the owner's biggest worry.
- Sales staff: basic salary + commission per car (ads show RM5k-15k a month for good sellers).
  Branch / sales managers: about RM6-7k + incentives, judged on units and gross.
- The daily loop: buy (auction / trade-in / import) -> recon -> list and advertise -> leads ->
  test drive -> negotiate (price, trade-in, deposit, loan) -> loan approval -> sale -> transfer
  (Puspakom, JPJ) -> handover -> after-sales (road tax, insurance, service).

## 2. The two roles

### Owner (dealer principal): "Is my money growing, and where is it stuck?"
Sees everything, decides money and people. Daily / weekly:
| Needs to see | Our source (see ARCHITECTURE.md section 8) |
|---|---|
| Gross profit this month vs last month, vs target | sum of `carPnl()` over cars sold this month |
| Units sold, revenue | `car_listings` sold + `sold_at` |
| Money tied up in stock, and what it costs per day | sum of buy + recon of unsold cars; sum of `perDay` |
| Ageing stock: cars over 60 days, losing money, break-even price | `daysHeld()`, `carPnl().breakeven` |
| Deals waiting for the owner's OK (price under the limit) | `deal_price_approvals` |
| Team: who sells, who is idle | `_team_health()` |
| Cash risks: loans stuck at the bank, cars still under HP | `deal_financing`, `encumbrance_status` |
Authority: everything. Sets the rules for everyone else: discount limit, commission rates, cost
settings, who sees cost and profit, who may approve what. Final say on buying and repricing.

### Manager (sales / general manager): "What do we push today?"
Runs the floor. Daily:
| Needs to see | Our source |
|---|---|
| Leads not answered, leads going cold | `leads` + `lead_activities` |
| Today's test drives and bookings | `appointments` |
| Deals waiting for approval within their limit | `deal_price_approvals` |
| Each salesman: activity, pipeline, closes | `_team_health()`, `gm_salesman_scores` |
| Cars to push: oldest, most viewed with no enquiry, losing money | `daysHeld()`, `get_dealer_car_analytics`, `carPnl()` |
| Recon status, listings waiting to go live | `recon_jobs`, listings `pending_approval` |
| Month progress vs target (units, gross if allowed) | same sums as the owner |
Authority (typical): assign and reassign leads and cars, approve listings, approve deals up to a
discount limit, appraise trade-ins, schedule recon, coach staff. Usually NOT: change cost settings,
commission rates, undo a sale, delete stock, see other managers' pay. Whether a manager sees buy
price and profit varies by shop: a used-car manager who appraises trade-ins needs cost; some
owners still hide it. So it must be a switch, not a fixed rule.

## 3. Can it be customized per dealership? Yes: templates + switches + limits
How the big systems do it (RouteOne, DMP, dealer-group tools): a few **preset roles** with sensible
defaults, then the dealership admin turns individual **permissions** on or off, and group-level
tools lock some settings centrally. That maps onto what we already have:
- `role_permissions` (one row per dealer + role) + `src/lib/permissions.js` (`CAPABILITIES`,
  defaults, `usePermissions`). Owner/dealer are always full access.
- Numeric limit: `dealer_cost_settings.discount_limit_amount` / `_pct`, enforced by
  `close_deal_at_price` + `deal_price_approvals`.
Proposed shape:
1. **Pick a setup** when the dealer joins: "I run it myself" (owner = manager, no manager role
   shown) / "I have a manager" (defaults below) / later "Several branches".
2. **Switches per role**, grouped by what they protect: Money (see buy price, see profit, see
   commission of others, export), People (assign leads, assign cars, invite staff), Stock (approve
   listings, change price, mark sold, delete), Deals (approve up to the limit).
3. **Limits as numbers**: manager discount limit (RM and %), above it goes to the owner.
4. **Enforced in the database, not only hidden on screen** (CLAUDE.md DMS audit rule 3): a switch
   that only hides a tile protects nothing. Each money switch needs the matching row rule.

### Proposed manager defaults (owner can change every one)
| Permission | Default |
|---|---|
| See buy price, recon, profit per car | ON |
| See salesman commission | ON |
| Export | OFF |
| Assign / reassign leads and cars | ON |
| Approve listings | ON |
| Change asking price | ON, within the discount limit |
| Approve deals | up to the discount limit; above = owner |
| Mark sold / undo sale / delete car | OFF (sale goes through the won deal) |
| Edit cost settings, commission rates, plan | OFF (owner only) |
| Invite / remove staff | OFF |

## 4. What we have today, and the gaps
- Live accounts (2026-11-12): 2 dealers, 1 owner, 2 managers, 1 admin, 1 accountant, 1 F&I. Mostly
  test accounts, so nothing here is proven with a real dealer yet.
- **The manager has a separate 2,854-line panel** (`src/pages/ManagerPanel.jsx`) with its own copies
  of numbers (total clicks, enquiries, customers this month). That breaks the "one engine, sums up to
  Overview" rule. Recommendation: the manager uses the SAME dealer dashboard, with tabs and numbers
  hidden by permission (the LINKED-PREMIUM idea: one body, permissions decide what shows), and
  `ManagerPanel.jsx` is retired after the owner tests it on staging.
- Only 5 capabilities exist today (`view_commission`, `view_all_leads`, `view_cost`, `view_gross`,
  `export_data`). The switches in section 3 need adding, and each money one needs a DB rule.
- Overview must split into an owner view and a manager view of the SAME numbers (the manager view
  leads with today's work, the owner view with money).

## 5. Questions to ask 2-3 real dealers before building
1. Do you have a manager, or do you run the floor yourself?
2. Should your manager see the buy price and profit of each car?
3. How much discount can your manager give without asking you (RM or %)?
4. Who may change a car's price, mark it sold, or remove it?
5. What do you look at first every morning? What does your manager look at?

## Sources
- AutoAlert, dealer principal role: https://www.autoalert.com/dealer-principal/
- AutoAlert, GM first 90 days: https://www.autoalert.com/dealership-gm-first-90-days/
- Rework, dealership KPI dashboards: https://resources.rework.com/vi/libraries/automotive-sales-growth/dealership-kpi-dashboard
- Rework, desking and deal structure: https://resources.rework.com/vi/libraries/automotive-sales-growth/desking-deal-structure
- Digital Dealer, used car manager's time: https://digitaldealer.com/latest-news/how-much-is-a-used-car-managers-time-worth
- Used car manager job posts (Paylocity): https://recruiting.paylocity.com/Recruiting/Jobs/Details/3576113
- Business Today MY, used car industry transparency: https://www.businesstoday.com.my/2021/09/02/transparency-key-to-used-car-industry-future/
- FMT, used car dealers and financing: https://www.freemalaysiatoday.com/category/nation/2018/01/26/struggling-used-car-dealers-look-to-new-online-market-overseas-financiers
- Mudah, used car salesman pay ads: https://www.mudah.my/hiring-used-car-salesman-salesgirl-rm5000-rm15000-115633178.htm
- Hiredly, used car branch manager: https://my.hiredly.com/jobs/jobs-malaysia-hiredly-x-job-branch-manager-used-car-johor-jaya
- RouteOne, access and permission templates: https://routeone.com/node/17321
- DMP, preset roles: https://www.dmp.com/resources/news-updates/are-you-taking-a-chance
- DriveAgent, dealer group settings: https://driveagent-website.pages.dev/features/dealer-groups
