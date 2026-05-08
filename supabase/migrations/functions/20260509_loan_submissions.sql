-- Loan Submission Tracker
create table if not exists loan_submissions (
  id               uuid primary key default gen_random_uuid(),
  dealer_id        uuid references profiles(id) on delete cascade,
  lead_id          uuid references leads(id) on delete set null,
  listing_id       uuid references car_listings(id) on delete set null,
  customer_name    text not null,
  bank_name        text not null,
  loan_amount      numeric,
  submission_date  date,
  status           text default 'pending' check (status in ('pending','approved','rejected','disbursed')),
  salesman_id      uuid references profiles(id) on delete set null,
  commission_amount numeric,
  notes            text,
  created_at       timestamptz default now()
);

alter table loan_submissions enable row level security;

create policy "dealer_full_access" on loan_submissions
  for all
  using (dealer_id = auth.uid())
  with check (dealer_id = auth.uid());

create index if not exists loan_submissions_dealer_idx on loan_submissions(dealer_id);
create index if not exists loan_submissions_status_idx on loan_submissions(status);
