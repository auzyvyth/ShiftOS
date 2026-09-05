-- Body type ("type" in the source) is Malay: motokar, jip, pick_up, window_van,
-- motokar_pelbagai_utiliti. Kept raw here; the UI owns the English labels.
alter table public.reg_car_month add column if not exists body_type text not null default '';
alter table public.reg_car_month drop constraint reg_car_month_pkey;
alter table public.reg_car_month add primary key (month, maker, model, colour, fuel, body_type);
