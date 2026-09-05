-- data.gov.my and src/data/carData.js spell a few marques differently. Keep the
-- source spelling in `maker` (fidelity) and derive model_key from `maker_canon`
-- so a key built by keyOf() in the browser lands on the right row. Only rows
-- listed here are rewritten; an unknown maker passes through untouched.
create table if not exists public.reg_maker_alias (
  source_maker text primary key,
  canonical    text not null
);

insert into public.reg_maker_alias (source_maker, canonical) values
  ('Mercedes Benz', 'Mercedes')
on conflict (source_maker) do update set canonical = excluded.canonical;

alter table public.reg_maker_alias enable row level security;
drop policy if exists reg_maker_alias_read on public.reg_maker_alias;
create policy reg_maker_alias_read on public.reg_maker_alias
  for select to authenticated using (true);

alter table public.reg_car_month add column if not exists maker_canon text;

update public.reg_car_month r
   set maker_canon = coalesce(a.canonical, r.maker)
  from (select 1) _
  left join public.reg_maker_alias a on true
 where a.source_maker is not distinct from r.maker
    or (a.source_maker is null and r.maker_canon is null);

-- Belt and braces: anything the join above left null falls back to the raw maker.
update public.reg_car_month set maker_canon = maker where maker_canon is null;
alter table public.reg_car_month alter column maker_canon set not null;

drop index if exists reg_car_month_key_month_idx;
alter table public.reg_car_month drop column model_key;
alter table public.reg_car_month add column model_key text generated always as (
  lower(trim(both '-' from regexp_replace(upper(maker_canon), '[^A-Z0-9]+', '-', 'g'))) || ':' ||
  lower(trim(both '-' from regexp_replace(upper(model),       '[^A-Z0-9]+', '-', 'g')))
) stored;
create index reg_car_month_key_month_idx on public.reg_car_month (model_key, month);
