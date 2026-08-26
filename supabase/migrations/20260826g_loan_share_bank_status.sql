-- The buyer's page becomes "where does my application stand", not just a
-- document list: it now carries the per-bank outcomes the salesman records.
--
-- Two deliberate narrowings, both enforced here rather than in the UI, because
-- whoever holds this token can read the JSON directly:
--   1. Only the attempt fields a buyer may see are rebuilt into the payload.
--      Nothing else from the row leaks in by being added to `banks` later.
--   2. Rate / monthly / tenure / amount appear ONLY on an Approved attempt.
--      A monthly figure shown against a bank that has not answered reads to a
--      buyer as a promise, and they will hold the salesman to it.
-- IC, income, commitments and the salesman's private notes stay out, as before.

drop function if exists public.get_loan_share(text);

create or replace function public.get_loan_share(p_token text)
returns table(
  buyer_name text, car_model text, car_price numeric, loan_amount numeric,
  loan_tenure integer, down_payment numeric, buyer_employment_type text,
  status text, banks jsonb, updated_at timestamptz,
  doc_ic_front boolean, doc_ic_back boolean, doc_payslip_1 boolean,
  doc_payslip_2 boolean, doc_payslip_3 boolean, doc_epf boolean,
  doc_bank_statement boolean, doc_employment_letter boolean, doc_ssm boolean,
  doc_tax_form boolean, doc_ccris_ctos boolean,
  salesman_name text, salesman_whatsapp text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    la.buyer_name, la.car_model, la.car_price, la.loan_amount, la.loan_tenure,
    la.down_payment, la.buyer_employment_type, la.status,
    coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'name',        a.value->>'name',
                 'status',      a.value->>'status',
                 'reason',      nullif(a.value->>'reason', ''),
                 'decided_at',  a.value->>'decided_at',
                 'rate',        case when a.value->>'status' = 'Approved' then a.value->'rate'        end,
                 'monthly',     case when a.value->>'status' = 'Approved' then a.value->'monthly'     end,
                 'tenure',      case when a.value->>'status' = 'Approved' then a.value->'tenure'      end,
                 'loan_amount', case when a.value->>'status' = 'Approved' then a.value->'loan_amount' end
               )
               order by a.ord
             )
      from jsonb_array_elements(
             case when jsonb_typeof(la.banks) = 'array' then la.banks else '[]'::jsonb end
           ) with ordinality as a(value, ord)
    ), '[]'::jsonb) as banks,
    la.updated_at,
    la.doc_ic_front, la.doc_ic_back, la.doc_payslip_1, la.doc_payslip_2,
    la.doc_payslip_3, la.doc_epf, la.doc_bank_statement, la.doc_employment_letter,
    la.doc_ssm, la.doc_tax_form, la.doc_ccris_ctos,
    p.full_name, p.whatsapp_number
  from loan_applications la
  left join profiles p on p.id = la.salesman_id
  where la.share_token = p_token
    and length(p_token) >= 32;   -- refuse to scan on a short/guessable token
$function$;

grant execute on function public.get_loan_share(text) to anon, authenticated, service_role;
