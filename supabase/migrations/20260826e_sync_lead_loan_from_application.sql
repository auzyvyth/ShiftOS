-- A loan application linked to a lead did not show up anywhere on that lead:
-- the pipeline card, the dealer LeadDrawer and Salesmanpanel all read
-- leads.loan_bank / loan_amount / loan_status, and nothing ever wrote them
-- from loan_applications. The salesman submitted a loan and the pipeline
-- looked untouched.
--
-- Fanned out in the DB, not per client, for the same reason the won-trigger is
-- (see CLAUDE.md "Won = sold"): whichever surface writes the application, the
-- lead has to agree.
--
-- leads.loan_status is CHECK-constrained to none|submitted|approved|rejected|
-- cancelled, while loan_applications.status is Submitted|Pending|Approved|
-- Declined - writing the raw value would fail the constraint and reject the
-- whole update, so the mapping below is mandatory, not cosmetic.
create or replace function public.sync_lead_loan_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bank   text;
  v_status text;
begin
  if new.lead_id is null then
    return new;
  end if;

  -- The bank that matters is the one that said yes; before any decision, the
  -- first bank tried.
  select a->>'name' into v_bank
    from jsonb_array_elements(coalesce(new.banks, '[]'::jsonb)) a
   where a->>'status' = 'Approved'
   limit 1;

  if v_bank is null then
    select a->>'name' into v_bank
      from jsonb_array_elements(coalesce(new.banks, '[]'::jsonb)) a
     limit 1;
  end if;

  v_status := case new.status
                when 'Approved' then 'approved'
                when 'Declined' then 'rejected'
                else 'submitted'
              end;

  update public.leads
     set loan_bank       = coalesce(v_bank, loan_bank),
         loan_amount     = coalesce(new.loan_amount, loan_amount),
         loan_status     = v_status,
         loan_updated_at = now()
   where id = new.lead_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_lead_loan on public.loan_applications;
create trigger trg_sync_lead_loan
after insert or update of status, banks, loan_amount, lead_id
on public.loan_applications
for each row
execute function public.sync_lead_loan_from_application();

-- Backfill anything already linked (nothing today, but keeps the table honest
-- if a row was created between the LoanDesk ship and this trigger).
update public.loan_applications set updated_at = updated_at where lead_id is not null;
