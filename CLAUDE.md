# ShiftOS — Project Context

## Pending tasks — session start protocol
1. Read `TODO.md` at the start of every session.
2. Present the pending items to the user and ask which one to work on first.
3. After completing an item, delete it from `TODO.md`, commit the updated file, and push.
4. Do not start work without asking the user which item to tackle.

## Stack
React + Vite, Supabase, Tailwind CSS, deployed on Vercel

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
- `npm run lint` — ESLint (quiet)

## Supabase project
Project ID: lemdkdizdlcirhbzqlos

## Design system
- Background: #080C14 / bg-gray-950
- Accent: red-600 / #dc2626
- Font: DM Sans (body), Bebas Neue (display)
- Cards: bg-gray-900, border-gray-800

## Key files
- src/pages/HomePage.jsx — public XDrive marketplace
- src/pages/CarDetailPage.jsx — single car listing page (has "What's Included" services strip)
- src/pages/SalesmanPanel.jsx — salesman role dashboard (file: Salesmanpanel.jsx)
- src/pages/DashboardPage.jsx — owner/admin dashboard (see nav tabs below)
- src/pages/RevOpsPage.jsx — dealer revenue analytics dashboard (userId prop)
- src/pages/ServicesPage.jsx — dealer product catalogue + add-on revenue stats (userId prop)
- src/pages/LeadsPage.jsx — leads CRM board (embedded in dashboard)
- src/components/HeroCarousel.jsx — homepage hero
- src/components/CarForm.jsx — multi-step listing form (8 steps; step 6 has Included Services)
- src/components/leads/LeadDrawer.jsx — right-side lead detail panel (collapsible add-ons section)
- src/hooks/useProfile.js — logged-in user's own profile row; exports useProfile() + getDealerIdFromProfile(profile)
- src/hooks/useTenant.js — subdomain/tenant detection; exports getSubdomain(), isSubdomain(), useTenant()
- src/hooks/useRoleRedirect.js — role-based routing hook
- src/hooks/useSiteProfile.js — dealer profile context
- src/utils/serviceCategories.js — shared icon/color/label map for service categories

## Roles
owner / superadmin / dealer → /dashboard
salesman → /salesman
admin → /admin
manager → /manager
accountant → /accountant
fi_officer → /fi

## Dashboard nav tabs (DashboardPage.jsx)
listings, add, leads, analytics, team, hero, stock, enquiries, bookings, documents, revops, services, settings
Dealer dashboard NAV (DashboardPage.jsx NAV array): overview, crm, listings, add, stock, hp, handover, analytics, team, customers, outreach, ai_manager, documents, storefront, oversight
  ↳ handover = post-sale lifecycle board (PostSaleBoard). Salesman panel also has a "handover" tab scoped to their own won deals.

## Post-sale handover (Module A)
- Won deal (lead.stage = won/closed_won) → DB trigger `auto_create_customer_on_won` fires immediately: creates customers row (name/phone/IC/email/car/plate/price) AND pre-seeds 8-step post_sale_tasks checklist (B7 auto-NA if not financed). Idempotent — safe to re-trigger.
- src/components/postsale/{PostSaleBoard,PostSaleChecklist}.jsx + src/hooks/usePostSaleTasks.js + src/utils/postSaleSteps.js
- Malaysian sequence (fees are official rates, editable): loan settlement → buyer insurance → Puspakom B5 (RM30) → B7 (RM60, financed only, auto-NA if not financed) → JPJ pindah milik (RM100, biometric both parties, buyer within 7 days) → road tax → geran collection → handover
- Handover processing costs (sum of non-NA step costs) are deducted from per-unit gross in StockTab P&L modal
- F&I add-ons (Module C) already live in LeadDrawer (deal_products); revenue/gross (Module B) in RevOpsPage; customer expiry reminders (Module D) in CustomersTab

## Key DB tables
car_listings (dealer_id, assigned_to, status, commission_amount, sold_at, included_services JSONB, included_services_cost numeric)
stock_units (dealer_id, listing_id, purchase_price, recon_cost, status, included_services JSONB, puspakom_b5_date, puspakom_b7_date, encumbrance_status[clear|under_hp|unknown])
profiles (role, slug, dealership, site_name, whatsapp_number, brand_color)
  ↳ manager/admin rows also have dealer_id (FK to profiles.id of their parent dealer)
appointments (dealer_id, salesman_id, car_listing_id, appointment_date)
analytics_events (dealer_id, salesman_slug, event_type, car_id)
leads (dealer_id, salesman_id, stage, source, buyer_name, phone, buyer_email, buyer_ic, buyer_address, loan_bank, loan_amount, loan_status, …)
dealer_products (dealer_id, name, category, cost_price, selling_price, is_active)
deal_products (dealer_id, lead_id, listing_id, product_id, sold_price)
salesman_listings (dealer_id, salesman_id, listing_id) — many-to-many; a salesman features a dealer car on their own listings WITHOUT creating a lead. Pipeline = real buyers only.
post_sale_tasks (dealer_id, lead_id, listing_id, salesman_id, step_key, status[pending|in_progress|done|na], owner_role, due_date, cost, notes, sort_order) — handover checklist per won deal. Steps in src/utils/postSaleSteps.js. Auto-seeded by DB trigger on won + lazy-seeded on first board open. UNIQUE(lead_id, step_key).
customers (dealer_id, lead_id, listing_id, name, phone, email, ic_number, purchase_date, car_brand, car_model, car_year, car_plate, selling_price, payment_type, road_tax_expiry, insurance_expiry, notes) — auto-created by trigger on won. UNIQUE(lead_id).
service_packages (dealer_id, customer_id, lead_id, listing_id, package_name, total_visits, used_visits, valid_months, sold_price, sold_at, expires_at[generated]) — prepaid service bundles per customer. Managed in CustomersTab.

## Service categories (serviceCategories.js)
Keys: protection, tint, window_tint, warranty, insurance, road_tax, service, accessories, workshop, other
Usage: import { getCategoryCfg } from '../utils/serviceCategories'
Each entry: { icon: LucideComponent, color: hex, twColor: tailwind-class, label: string }

## Multi-tenancy
All queries scoped by dealer_id via RLS + frontend .eq('dealer_id', dealerId)
Public car_listings SELECT is open (for XDrive marketplace)
Never use session.user.id / user.id in queries — always derive via getDealerIdFromProfile(profile):
  - manager or admin role → profile.dealer_id
  - superadmin / dealer / owner role → profile.id
Subdomain detection: xdrive.my and www.xdrive.my → tenant=null (public marketplace)
  Only <sub>.xdrive.my triggers dealer profile lookup (useTenant.js)

## Deployment pipeline — 3 stages
```
local (main) → staging branch → production (main on GitHub)
```
- **local main**: all development happens here, commits stay local until staged
- **staging**: `git push origin main:staging --force` → triggers Vercel preview URL
- **production**: NEVER push to origin/main directly — always via temp branch → PR → merge
- NEVER deploy to production without explicit user instruction ("push to prod" / "go live")
- Every feature or fix must go to staging first and be confirmed before production

## Git workflow (web session — proxy restriction)
This session's git proxy blocks direct push to origin/main. Use this workflow every time:
1. Commit to local main
2. `git push origin main:staging --force` → user reviews on Vercel preview
3. When user says to push to prod:
   a. `git checkout -b temp/<name> && git push -u origin temp/<name>`
   b. Create PR via mcp__github__create_pull_request (base: main)
   c. Merge via mcp__github__merge_pull_request (squash)
   d. `git checkout main && git fetch origin main && git reset --hard origin/main`
   e. Delete temp branch
- Before starting any work: git status → must say "up to date with origin/main"
- If git status shows divergence, STOP and warn the user before doing anything else.
- Never use --force on main without warning the user.
- Never run git reset --hard without warning the user that local changes will be lost.

## DB migrations
- Schema changes (ALTER TABLE, CREATE VIEW) go directly to the live Supabase DB via MCP apply_migration
- Always update public_car_listings VIEW after adding columns to car_listings
- Supabase branch (isolated staging DB) available at ~$9.70/month — ask user before enabling

## Edge functions (Supabase)
- send-telegram — sends Telegram message server-side; reads bot token from DB, never exposed to client
- telegram-notify — webhook; auto-posts new listings to dealer Telegram channel
- invites — creates auth user + profile for manager/admin/accountant/fi_officer roles
- send-document — emails issued dealer_documents to buyer via Resend. BLOCKED: needs RESEND_API_KEY + RESEND_FROM_EMAIL secrets set in Supabase dashboard
- expiry-reminders — daily cron (00:00 UTC = 8am KL); fires dealer_notifications for road tax/insurance expiring in 30 or 7 days, and for overdue post_sale_tasks steps. Also notifies salesman_notifications. 24h dedup.
- ai-proxy — proxies Claude API calls for AI features

## P&L model (StockTab)
fetchPnl in DashboardPage.jsx computes per-unit gross in two parts:
- Front gross = sale price − purchase price − recon cost − included services − commission − handover processing costs
- Back gross = F&I add-on revenue − add-on cost (deal_products)
- Total gross = front + back
Both displayed in separate labelled sections in the P&L modal.

## RLS policy safety
- NEVER write an RLS policy on a table whose USING/CHECK expression does a subquery on that SAME table — it causes infinite recursion and breaks every read (symptom: profile fetch fails → app redirects to login in a loop)
- For any policy that needs to reference `profiles` (especially policies ON profiles), use a SECURITY DEFINER helper that bypasses RLS: `get_my_dealer_id()`, `is_superadmin()`, `is_linked_salesman()`, `is_active_salesman()`
- Dealer profile rows have `dealer_id = NULL` (they own themselves) — to grant a salesman read access to their dealer, match `id = get_my_dealer_id()`, NOT `dealer_id = get_my_dealer_id()`
- leads.lead_source CHECK only allows: walk_in, whatsapp, referral, drevo_enquiry, enquiry, manual — any other value rejects the whole insert
- After adding any policy, test it with a real row read before shipping

## Mobile-first requirement
- Every UI change must be mobile-friendly — test at 375px width before considering done
- Dashboard background is #080C14 — never use white/light text colors without a dark background wrapper
- Sidebar/panel layouts: use `hidden md:block` for desktop sidebar, horizontal scrolling pill nav for mobile
- Fixed pixel widths on layout containers are banned — use flex/grid with minWidth: 0 on flex children
- Inline style colors for text must account for the dark background: use rgba(255,255,255,x) not rgba(0,0,0,x)

## Prompt discipline
- Never write more than 80 lines of instructions per prompt
- Always read the target file first before editing
- One concern per session: data OR layout OR styling OR mobile
- Never use emojis in UI code, commit messages, or responses
