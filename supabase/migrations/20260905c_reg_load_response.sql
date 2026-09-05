-- Parses one fetched cars_<year>.csv out of net._http_response into reg_car_month.
-- Deletes the year first so a re-run drops combinations that no longer appear
-- rather than leaving orphans behind.
-- NOTE: superseded later the same day by 20260905f (adds maker_canon).
create or replace function public.reg_load_response(p_request_id bigint, p_year integer)
returns table (rows_parsed integer, rows_written integer, note text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  integer;
  v_err     text;
  v_content text;
  v_parsed  integer := 0;
  v_written integer := 0;
  v_bad     integer := 0;
begin
  select r.status_code, r.error_msg, r.content
    into v_status, v_err, v_content
    from net._http_response r where r.id = p_request_id;

  if not found then
    raise exception 'request % not found (pg_net keeps responses for a short window only)', p_request_id;
  end if;
  if v_status is null or v_status >= 300 then
    raise exception 'fetch failed: status=% err=%', v_status, v_err;
  end if;

  create temp table _reg_rows on commit drop as
  select string_to_array(rtrim(l, E'\r'), ',') as a
    from string_to_table(v_content, E'\n') as l
   where l <> '' and l not like 'date_reg,%';

  select count(*) into v_parsed from _reg_rows;
  select count(*) into v_bad from _reg_rows
   where array_length(a, 1) <> 7 or a[1] !~ '^\d{4}-\d{2}-\d{2}$';

  delete from public.reg_car_month
   where month >= make_date(p_year, 1, 1)
     and month <  make_date(p_year + 1, 1, 1);

  insert into public.reg_car_month (month, body_type, maker, model, colour, fuel, n)
  select date_trunc('month', a[1]::date)::date,
         a[2], a[3], a[4], a[5], a[6], count(*)::integer
    from _reg_rows
   where array_length(a, 1) = 7
     and a[1] ~ '^\d{4}-\d{2}-\d{2}$'
   group by 1, 2, 3, 4, 5, 6;

  get diagnostics v_written = row_count;

  insert into public.reg_ingest_log (source_year, total_bytes, rows_parsed, rows_written, ok, message)
  values (p_year, length(v_content), v_parsed, v_written, true,
          format('%s malformed rows skipped', v_bad));

  return query select v_parsed, v_written,
                      format('%s source rows, %s skipped, %s rollup rows', v_parsed, v_bad, v_written);
end $$;

revoke all on function public.reg_load_response(bigint, integer) from public;
