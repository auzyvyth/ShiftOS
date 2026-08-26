-- A salesman's traffic numbers were readable by anyone, no login needed.
--
-- These three are SECURITY DEFINER, take a public slug as their only scope, and
-- carried EXECUTE for anon. A slug is not a secret - it is in the mini-page URL -
-- so anybody could ask the API how many views and enquiries a given rep's cars
-- pull, and their daily traffic curve. That is a competitor's whole funnel.
--
-- All three are called only from the authenticated dashboards (SalesmanPremium,
-- SalesmanLite, Salesmanpanel). No public page uses them, so anon loses EXECUTE
-- and nothing changes for a logged-in rep.
--
-- NOTE: this migration does not actually work on its own - see 20260826k. The
-- grant is held by PUBLIC, which a role-specific revoke does not touch.
--
-- Still open after this, and deliberately not fixed here: an AUTHENTICATED rep
-- can still pass someone else's slug and read their numbers. The clean fix is a
-- caller check inside each function, but a linked salesman's slug is not always
-- their own profile's slug (Salesmanpanel passes `profileData.slug || ""`), so
-- that needs its own change with the panel tested alongside it.

revoke execute on function public.get_salesman_minipage_stats(text) from anon;
revoke execute on function public.get_salesman_minipage_daily(text) from anon;
revoke execute on function public.get_salesman_channel_breakdown(uuid[], text) from anon;
