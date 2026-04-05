# ShiftOS — Project Context

## Stack
React + Vite, Supabase, Tailwind CSS, deployed on Vercel

## Supabase project
Project ID: lemdkdizdlcirhbzqlos

## Design system
- Background: #080C14 / bg-gray-950
- Accent: red-600 / #dc2626
- Font: DM Sans (body), Bebas Neue (display)
- Cards: bg-gray-900, border-gray-800

## Key files
- src/pages/HomePage.jsx — public XDrive marketplace
- src/pages/CarDetailPage.jsx — single car listing page
- src/pages/SalesmanPanel.jsx — salesman role dashboard
- src/pages/DashboardPage.jsx — owner/admin dashboard
- src/components/HeroCarousel.jsx — homepage hero
- src/hooks/useRoleRedirect.js — role-based routing hook
- src/hooks/useSiteProfile.js — dealer profile context

## Roles
owner/superadmin → /dashboard
salesman → /salesman
admin → /admin
accountant → /accounts

## Key DB tables
car_listings (dealer_id, assigned_to, status, commission_amount, sold_at)
profiles (role, slug, dealership, site_name, whatsapp_number, brand_color)
appointments (dealer_id, salesman_id, car_listing_id, appointment_date)
analytics_events (dealer_id, salesman_slug, event_type, car_id)

## Multi-tenancy
All queries scoped by dealer_id via RLS + frontend .eq('dealer_id', userId)
Public car_listings SELECT is open (for XDrive marketplace)

## Prompt discipline
- Never write more than 80 lines of instructions per prompt
- Always read the target file first before editing
- One concern per session: data OR layout OR styling OR mobile
