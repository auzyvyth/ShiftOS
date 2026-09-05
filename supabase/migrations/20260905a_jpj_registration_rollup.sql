-- JPJ / data.gov.my new-car registration rollup.
-- Source: https://storage.data.gov.my/transportation/cars_<year>.csv (open data,
-- no key, no auth). One row per registration in the source; this table is the
-- only aggregate we keep, so no two rollups can ever disagree.
create table if not exists public.reg_car_month (
  month     date    not null,
  maker     text    not null,
  model     text    not null,
  colour    text    not null,
  fuel      text    not null,
  n         integer not null check (n > 0),
  -- Mirrors keyOf() in src/utils/modelKey.js. GENERATED so nothing can write a
  -- key that disagrees with maker/model; the JS side is the only other copy.
  model_key text generated always as (
    lower(trim(both '-' from regexp_replace(upper(maker), '[^A-Z0-9]+', '-', 'g'))) || ':' ||
    lower(trim(both '-' from regexp_replace(upper(model), '[^A-Z0-9]+', '-', 'g')))
  ) stored,
  primary key (month, maker, model, colour, fuel)
);

create index if not exists reg_car_month_key_month_idx on public.reg_car_month (model_key, month);
create index if not exists reg_car_month_month_idx     on public.reg_car_month (month);
create index if not exists reg_car_month_maker_idx     on public.reg_car_month (maker, month);

alter table public.reg_car_month enable row level security;

-- Public government data: every signed-in seller reads the same rows. There is
-- deliberately no INSERT/UPDATE/DELETE policy - only the ingestion job (service
-- role / SECURITY DEFINER) writes here.
drop policy if exists reg_car_month_read on public.reg_car_month;
create policy reg_car_month_read on public.reg_car_month
  for select to authenticated using (true);

create table if not exists public.reg_ingest_log (
  id           bigserial primary key,
  source_year  integer     not null,
  byte_from    bigint,
  byte_to      bigint,
  total_bytes  bigint,
  rows_parsed  integer,
  rows_written integer,
  ok           boolean     not null default false,
  message      text,
  ran_at       timestamptz not null default now()
);

alter table public.reg_ingest_log enable row level security;
