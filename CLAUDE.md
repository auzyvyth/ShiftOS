# ShiftOS — Project Context

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

## Key DB tables
car_listings (dealer_id, assigned_to, status, commission_amount, sold_at, included_services JSONB, included_services_cost numeric)
stock_units (dealer_id, listing_id, purchase_price, recon_cost, status, included_services JSONB)
profiles (role, slug, dealership, site_name, whatsapp_number, brand_color)
  ↳ manager/admin rows also have dealer_id (FK to profiles.id of their parent dealer)
appointments (dealer_id, salesman_id, car_listing_id, appointment_date)
analytics_events (dealer_id, salesman_slug, event_type, car_id)
leads (dealer_id, salesman_id, stage, source, …)
dealer_products (dealer_id, name, category, cost_price, selling_price, is_active)
deal_products (dealer_id, lead_id, listing_id, product_id, sold_price)

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

## Git
- ALWAYS push to both branches after every commit:
  git push origin main && git push origin main:Shiftos --force
- Vercel deploys from Shiftos branch

## Prompt discipline
- Never write more than 80 lines of instructions per prompt
- Always read the target file first before editing
- One concern per session: data OR layout OR styling OR mobile
