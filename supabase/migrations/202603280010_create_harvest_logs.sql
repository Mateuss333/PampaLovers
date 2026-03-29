create table public.harvest_logs (
    id uuid primary key default gen_random_uuid(),
    plot_id uuid not null references public.plots(id) on delete cascade,
    farm_id uuid not null references public.farms(id) on delete cascade,

    plot_name text not null,
    crop_type text,
    area_ha numeric,
    sowing_date date,

    harvest_date date not null,
    yield_kg_per_hectare numeric not null check (yield_kg_per_hectare >= 0),

    soil_moisture_percent numeric,
    soil_ph numeric,
    temperature_c numeric,
    rainfall_mm numeric,
    humidity_percent numeric,
    sunlight_hours numeric,
    ndvi_index numeric,
    irrigation_type text,
    fertilizer_type text,
    pesticide_usage_ml numeric,
    crop_disease_status text,
    notes text,

    created_at timestamptz not null default now()
);

create index idx_harvest_logs_plot_id on public.harvest_logs(plot_id);
create index idx_harvest_logs_farm_id on public.harvest_logs(farm_id);

grant select, insert, delete on public.harvest_logs to authenticated;

alter table public.harvest_logs enable row level security;

create policy "harvest_logs_select_own"
on public.harvest_logs
for select
using (
    exists (
        select 1
        from public.farms f
        where f.id = harvest_logs.farm_id
          and f.user_id = auth.uid()
    )
);

create policy "harvest_logs_insert_own"
on public.harvest_logs
for insert
with check (
    exists (
        select 1
        from public.farms f
        where f.id = harvest_logs.farm_id
          and f.user_id = auth.uid()
    )
);

create policy "harvest_logs_delete_own"
on public.harvest_logs
for delete
using (
    exists (
        select 1
        from public.farms f
        where f.id = harvest_logs.farm_id
          and f.user_id = auth.uid()
    )
);
