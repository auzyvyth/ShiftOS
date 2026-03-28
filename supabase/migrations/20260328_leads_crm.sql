-- ─── Leads CRM Migration ────────────────────────────────────────────────────

create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  dealer_id        uuid references profiles(id) on delete cascade,
  buyer_name       text not null,
  phone            text not null,
  lead_source      text not null check (lead_source in
                     ('walk_in','whatsapp','referral','drevo_enquiry')),
  car_listing_id   uuid references car_listings(id) on delete set null,
  employment_type  text,
  income_bracket   text,
  stage            text not null default 'new' check (stage in
                     ('new','contacted','test_drive','negotiating',
                      'closed_won','closed_lost')),
  assigned_to      uuid references profiles(id) on delete set null,
  followup_date    date,
  -- TODO: use followup_date to trigger Telegram bot reminders (future scope)
  is_deleted       boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table if not exists lead_activities (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references leads(id) on delete cascade,
  activity_type text not null check (activity_type in
                   ('created','stage_changed','note_added','assigned')),
  note          text,
  from_stage    text,
  to_stage      text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz default now()
);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table leads enable row level security;
alter table lead_activities enable row level security;

create policy "Dealer owns leads"
  on leads for all
  using (dealer_id = auth.uid());

create policy "Dealer owns lead activities"
  on lead_activities for all
  using (
    lead_id in (
      select id from leads where dealer_id = auth.uid()
    )
  );

-- ─── Index for performance ───────────────────────────────────────────────────

create index if not exists leads_dealer_stage_idx on leads(dealer_id, stage);
create index if not exists lead_activities_lead_idx on lead_activities(lead_id, created_at);
