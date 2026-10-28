# Parked SQL — written, NOT applied

SQL that is ready but serves nobody yet. Owner's rule (2026-10-28): before any migration, check
whether a surface with real users will use it; if not, it waits here. Not in `supabase/migrations/`
on purpose: nothing should treat these as pending or apply them by accident.

When the surface goes live, re-check each file against the live DB (things drift), give it a fresh
dated name, move it to `supabase/migrations/`, and apply it in the after-midnight window.

| File | What it does | Waiting for | Parked |
|---|---|---|---|
| `drop_dead_sql.sql` | Drops 20 unused functions + empty tables (car hunts, workshops, `broadcast_logs`, `dealer_products.workshop_id`). Re-verified 2026-10-28: no code or DB object uses any of it, all tables 0 rows. | Dealer dashboard in use (it unblocks a dealer's hard-delete of a car) or a DB cleanup round. | 2026-10-28 |
