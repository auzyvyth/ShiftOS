-- Loan desk rebuild.
--
-- 1. banks was text[] while the client wrote JS objects into it, so every row
--    stored a JSON *string* ("{\"name\":\"Public Bank\"...}") and reading
--    bank.name/.rate back gave undefined - the saved bank, rate and monthly
--    never rendered on any application. Convert to jsonb, parsing what is
--    already stored so the existing row keeps its data. Done as
--    add-populate-swap because Postgres forbids a subquery in ALTER ... USING.
-- 2. One application is now one BUYER CASE holding multiple bank attempts
--    (declined by one bank -> try the next without retyping the buyer), which
--    is why banks is a jsonb array of attempt objects.
-- 3. buyer_income was collected in the UI and silently dropped (no column).
--    existing_commitments is new and is what makes a real DSR possible.
--
-- loan_application_share_view (built in the dashboard, not in this repo) reads
-- banks, so it is dropped and recreated verbatim around the swap.
--
-- SECURITY NOTE, added retrospectively: recreating that view "verbatim" copied
-- its `grant ... to anon` across without questioning it, and the view had no
-- caller-bound predicate. That was an anonymous dump of every shared loan
-- application, tokens included. Migration 20260826i drops the view. Do not
-- reinstate it, and do not copy grants off an existing object without reading
-- what they allow.

drop view if exists public.loan_application_share_view;

alter table public.loan_applications add column if not exists banks_jsonb jsonb default '[]'::jsonb;

update public.loan_applications
set banks_jsonb = coalesce((
  select jsonb_agg(
    case when btrim(e) like '{%' then e::jsonb else jsonb_build_object('name', e) end
  )
  from unnest(banks) as e
), '[]'::jsonb)
where banks is not null;

update public.loan_applications set banks_jsonb = '[]'::jsonb where banks_jsonb is null;

alter table public.loan_applications drop column banks;
alter table public.loan_applications rename column banks_jsonb to banks;

alter table public.loan_applications
  -- Pre-fill from an existing pipeline lead instead of retyping the buyer.
  add column if not exists lead_id    uuid references public.leads(id)         on delete set null,
  add column if not exists listing_id uuid references public.car_listings(id)  on delete set null,
  -- DSR inputs. Net monthly income + what the buyer already repays each month.
  add column if not exists buyer_income          numeric,
  add column if not exists existing_commitments  numeric,
  -- Why a bank decided what it decided - the one thing worth relaying to the buyer.
  add column if not exists status_reason text,
  add column if not exists decided_at    timestamptz,
  -- Self-employed document set (the existing doc_* columns only cover salaried).
  add column if not exists doc_ssm      boolean default false,
  add column if not exists doc_tax_form boolean default false;

create index if not exists loan_applications_lead_id_idx
  on public.loan_applications (lead_id) where lead_id is not null;

create index if not exists loan_applications_salesman_created_idx
  on public.loan_applications (salesman_id, created_at desc);

-- Recreated exactly as it was. See the security note above: this is the
-- vulnerable object, kept here so the history is readable. 20260826i drops it.
create view public.loan_application_share_view as
 SELECT id,
    share_token,
    car_model,
    car_price,
    loan_amount,
    loan_tenure,
    down_payment,
    banks,
    status,
    created_at,
    updated_at
   FROM public.loan_applications
  WHERE share_token IS NOT NULL AND length(share_token) >= 32;

grant select, insert, update, references, trigger on public.loan_application_share_view to anon;
grant all on public.loan_application_share_view to authenticated;
grant all on public.loan_application_share_view to service_role;
grant all on public.loan_application_share_view to postgres;
