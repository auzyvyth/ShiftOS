-- HP-EIR: deal_financials.loan_interest_rate held FLAT rates (44 deals, all
-- signed under the old rules). New hire-purchase deals are EIR on the reducing
-- balance (Hire-Purchase (Amendment) Act 2026). Record which one each row is,
-- so the accountant's instalment is computed the way that deal was signed.
alter table public.deal_financials
  add column if not exists loan_rate_basis text
  check (loan_rate_basis in ('flat', 'eir'));

comment on column public.deal_financials.loan_rate_basis is
  'flat = pre-June-2026 hire purchase (interest on full principal); eir = reducing balance. NULL = not set yet; the UI treats it as eir.';

-- Every rate already entered was entered flat. The updated_at trigger is held
-- off so labelling 44 old deals does not make them all look edited today.
alter table public.deal_financials disable trigger trg_deal_financials_updated;
update public.deal_financials
   set loan_rate_basis = 'flat'
 where loan_interest_rate is not null and loan_rate_basis is null;
alter table public.deal_financials enable trigger trg_deal_financials_updated;
