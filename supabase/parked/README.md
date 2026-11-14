# Parked SQL — written, NOT applied

SQL that is ready but serves nobody yet. Owner's rule (2026-10-28): before any migration, check
whether a surface with real users will use it; if not, it waits here. Not in `supabase/migrations/`
on purpose: nothing should treat these as pending or apply them by accident.

When the surface goes live, re-check each file against the live DB (things drift), give it a fresh
dated name, move it to `supabase/migrations/`, and apply it in the after-midnight window.

| File | What it does | Waiting for | Parked |
|---|---|---|---|
| `chat_thread_ref_slug.sql` | In-app chat passes the visit's `?ref=` to `resolve_lead_salesman`, so a chat started from a salesman's page goes to that salesman (WhatsApp, booking and enquiry already do). Replaces `start_chat_thread(uuid)` with `(uuid, text default null)`. Then the client passes `p_ref_slug: getRef()` in `useChat.js` (NOT before: the old function rejects the extra argument). | The owner's go-ahead for the after-midnight window. Used by live buyers + linked salesmen, so it is not "unused"; parked only because the owner asked for all DB changes to wait (2026-11-11). | 2026-11-11 |
| `drop_dead_sql.sql` | Drops 20 unused functions + empty tables (car hunts, workshops, `broadcast_logs`, `dealer_products.workshop_id`). Re-verified 2026-10-28: no code or DB object uses any of it, all tables 0 rows. | Dealer dashboard in use (it unblocks a dealer's hard-delete of a car) or a DB cleanup round. | 2026-10-28 |
| `new_car_auto_cards.sql` | NEWCAR-4: a brand advisor gets every model of their brand on their page by itself: at onboarding (covers console-made accounts too) and when a model gets its first photos. Never re-adds a model the advisor took off. Then run `select _new_car_fill_seller(id) from profiles where new_car_brand in (Toyota,Honda)` once for advisors who joined before photos existed (1 Toyota advisor has 0 cards). | The owner's go-ahead (declined once, 2026-11-13). Until then signup still adds every model with photos from the browser (`SalesmanOnboarding.jsx:617`). | 2026-11-13 |
| `pro_tier.sql` | IDEA-34: `pro_subscriptions` (paid-until per seller) + `record_pro_payment` / `revoke_pro` / `my_pro_status`, superadmin-written. Parked 2026-11-13 when posting moved to the owner's console (SOCIAL-1): no seller posts to socials any more, so there is no Pro feature to gate. | Per-seller Zernio connect and a decision to sell it. Rename to a dated migration and re-check the guards first. | 2026-11-13 |
