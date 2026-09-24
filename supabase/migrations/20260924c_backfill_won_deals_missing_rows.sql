-- SWEEP-6: won leads from before auto_create_customer_on_won existed (Apr-Jun
-- 2026) were missing the rows the trigger now creates: 3 had no customers row,
-- 4 had no post_sale_tasks. Backfill exactly what the trigger writes, for live
-- (not soft-deleted) won leads only.
--
-- One deliberate difference: backfilled handover steps get due_date NULL. These
-- deals are months old; real due dates would all be in the past and the nightly
-- expiry-reminders job would fire "overdue" pushes for every step at once.

insert into customers (
  dealer_id, lead_id, listing_id, name, phone, email, ic_number, purchase_date,
  car_brand, car_model, car_year, car_plate, selling_price, payment_type, road_tax_expiry
)
select coalesce(l.dealer_id, l.salesman_id, l.assigned_to), l.id, l.car_listing_id,
       l.buyer_name, l.phone, l.buyer_email, l.buyer_ic, l.updated_at::date,
       c.brand, c.model, c.year, c.plate_number,
       coalesce(c.selling_price, 0), c.payment_type, c.road_tax_expiry
  from leads l
  left join car_listings c on c.id = l.car_listing_id
 where l.stage in ('won', 'closed_won')
   and coalesce(l.is_deleted, false) = false
   and not exists (select 1 from customers cu where cu.lead_id = l.id)
on conflict (lead_id) do nothing;

insert into post_sale_tasks
  (dealer_id, lead_id, listing_id, salesman_id, step_key, status, owner_role, cost, sort_order, due_date)
select coalesce(l.dealer_id, l.salesman_id, l.assigned_to), l.id, l.car_listing_id,
       coalesce(l.salesman_id, l.assigned_to), s.step_key,
       case when s.step_key = 'puspakom_b7'
             and not (l.loan_bank is not null or l.loan_amount is not null or l.loan_status is not null)
            then 'na' else 'pending' end,
       s.owner_role, s.cost, s.sort_order, null::date
  from leads l
  cross join (values
    ('loan_settlement',  'dealer',   null::numeric, 0),
    ('insurance',        'customer', null,          1),
    ('puspakom_b5',      'runner',   30,            2),
    ('puspakom_b7',      'runner',   60,            3),
    ('jpj_transfer',     'runner',   100,           4),
    ('road_tax',         'runner',   null,          5),
    ('geran_collection', 'customer', null,          6),
    ('handover',         'salesman', null,          7)
  ) as s(step_key, owner_role, cost, sort_order)
 where l.stage in ('won', 'closed_won')
   and coalesce(l.is_deleted, false) = false
   and not exists (select 1 from post_sale_tasks p where p.lead_id = l.id);
