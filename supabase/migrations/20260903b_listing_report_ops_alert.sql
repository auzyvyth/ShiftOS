-- Route new listing reports into the existing ops alert channel.
--
-- Without this the Reports queue is SILENT: a buyer reports a scam listing and
-- it sits in /platform until someone happens to open the tab. Every other
-- operator-facing event (new signup, pending listing, error, anomaly) already
-- goes through notify_ops(), which owns the 15-minute throttle, the Telegram
-- post and the web push to every superadmin. This just adds the fifth producer
-- rather than inventing a second alerting path.
--
-- Notes on shape, matching notify_admin_on_pending_listing:
--  - The message is written as "headline\ndetail..." because notify_ops takes
--    the FIRST LINE as the push title and the rest as the body.
--  - The alert key is unique per report, so two different reports never
--    throttle each other. The push TAG is derived from the key's first segment
--    ('ops:listing_report'), so repeats still replace on the device instead of
--    stacking.
--  - INSERT only. A status change is the operator's own action; alerting on it
--    would push them about their own click.
--  - Errors are swallowed. This runs inside report_listing()'s transaction and
--    an alerting failure must never cost a buyer their report.
--  - The buyer's note is included but truncated. It is untrusted text typed by
--    a stranger, so it must not be able to dominate the message.

CREATE OR REPLACE FUNCTION public.notify_ops_on_listing_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_reason   text;
  v_car      text;
  v_seller   text;
  v_reporter text;
  v_msg      text;
BEGIN
  v_reason := CASE NEW.reason
    WHEN 'sold_elsewhere'  THEN 'Already sold / unavailable'
    WHEN 'wrong_info'      THEN 'Wrong or misleading details'
    WHEN 'scam_suspicious' THEN 'Looks like a scam'
    WHEN 'duplicate'       THEN 'Duplicate listing'
    WHEN 'offensive'       THEN 'Offensive / inappropriate'
    ELSE 'Something else'
  END;

  v_car := NULLIF(btrim(
    coalesce(NEW.listing_snapshot->>'year', '')   || ' ' ||
    coalesce(NEW.listing_snapshot->>'brand', '')  || ' ' ||
    coalesce(NEW.listing_snapshot->>'model', '')  || ' ' ||
    coalesce(NEW.listing_snapshot->>'variant', '')
  ), '');

  SELECT coalesce(full_name, dealership, email, '—') INTO v_seller
    FROM profiles WHERE id = NEW.dealer_id;

  SELECT coalesce(full_name, email, 'A buyer') INTO v_reporter
    FROM profiles WHERE id = NEW.reporter_id;

  v_msg :=
    'Listing reported: ' || v_reason || E'\n' ||
    coalesce(v_car, 'Listing') || E'\n' ||
    'Seller: ' || coalesce(v_seller, '—') || E'\n' ||
    'By: ' || coalesce(v_reporter, '—') ||
    coalesce(E'\n"' || left(btrim(NEW.note), 140) || '"', '');

  PERFORM notify_ops('listing_report:' || NEW.id::text, v_msg);
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notify_ops_on_listing_report ON public.listing_reports;
CREATE TRIGGER trg_notify_ops_on_listing_report
  AFTER INSERT ON public.listing_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_ops_on_listing_report();
