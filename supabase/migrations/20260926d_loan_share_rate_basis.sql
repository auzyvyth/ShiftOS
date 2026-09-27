-- HP-EIR: loan attempts now carry rate_basis ('eir' since the Hire-Purchase
-- (Amendment) Act 2026 switch; absent = saved the old way = flat). The share
-- page labels the rate from it, so pass it through. Same signature, same
-- token check, same approved-only gating as before; one key added.
CREATE OR REPLACE FUNCTION public.get_loan_share(p_token text)
 RETURNS TABLE(buyer_name text, car_model text, car_price numeric, loan_amount numeric, loan_tenure integer, down_payment numeric, buyer_employment_type text, status text, banks jsonb, updated_at timestamp with time zone, doc_ic_front boolean, doc_ic_back boolean, doc_payslip_1 boolean, doc_payslip_2 boolean, doc_payslip_3 boolean, doc_epf boolean, doc_bank_statement boolean, doc_employment_letter boolean, doc_ssm boolean, doc_tax_form boolean, doc_ccris_ctos boolean, salesman_name text, salesman_whatsapp text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                 'rate_basis',  case when a.value->>'status' = 'Approved' then a.value->'rate_basis'  end,
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
