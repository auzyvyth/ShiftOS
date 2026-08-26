-- Buyer-facing document checklist, opened from a link the salesman sends.
-- Solves the real round trip: the buyer turns up with two of the seven papers
-- because nobody wrote the list down.
--
-- Deliberately a narrow SECURITY DEFINER function rather than widening
-- loan_application_share_view. A share link is bearer access - anyone holding
-- the URL is "the buyer" - so what travels with it is the minimum.
-- (20260826g later widens this to per-bank outcomes, still sanitised, and
--  20260826i drops the view this note contrasts against.)

create or replace function public.ensure_loan_share_token(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  -- Only the owner of the application may mint its link.
  select share_token into v_token
    from loan_applications
   where id = p_id and salesman_id = auth.uid();

  if not found then
    raise exception 'not found';
  end if;

  if v_token is null or length(v_token) < 32 then
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update loan_applications set share_token = v_token, updated_at = now() where id = p_id;
  end if;

  return v_token;
end;
$$;

revoke all on function public.ensure_loan_share_token(uuid) from public, anon;
grant execute on function public.ensure_loan_share_token(uuid) to authenticated;

create or replace function public.get_loan_share(p_token text)
returns table (
  buyer_name            text,
  car_model             text,
  car_price             numeric,
  loan_amount           numeric,
  loan_tenure           integer,
  down_payment          numeric,
  buyer_employment_type text,
  status                text,
  doc_ic_front          boolean,
  doc_ic_back           boolean,
  doc_payslip_1         boolean,
  doc_payslip_2         boolean,
  doc_payslip_3         boolean,
  doc_epf               boolean,
  doc_bank_statement    boolean,
  doc_employment_letter boolean,
  doc_ssm               boolean,
  doc_tax_form          boolean,
  doc_ccris_ctos        boolean,
  salesman_name         text,
  salesman_whatsapp     text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    la.buyer_name, la.car_model, la.car_price, la.loan_amount, la.loan_tenure,
    la.down_payment, la.buyer_employment_type, la.status,
    la.doc_ic_front, la.doc_ic_back, la.doc_payslip_1, la.doc_payslip_2,
    la.doc_payslip_3, la.doc_epf, la.doc_bank_statement, la.doc_employment_letter,
    la.doc_ssm, la.doc_tax_form, la.doc_ccris_ctos,
    p.full_name, p.whatsapp_number
  from loan_applications la
  left join profiles p on p.id = la.salesman_id
  where la.share_token = p_token
    and length(p_token) >= 32;   -- refuse to scan on a short/guessable token
$$;

grant execute on function public.get_loan_share(text) to anon, authenticated;
