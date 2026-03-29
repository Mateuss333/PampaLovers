-- Registro tipo ML / histórico por cosecha (numéricos). plot_id sin default para respetar FK.
create table if not exists public.logs (
    id uuid not null default gen_random_uuid(),
    plot_id uuid not null references public.plots(id) on delete cascade,
    crop_type numeric not null default 0,
    soil_moisture real default 0,
    soil_ph real default 0,
    temperature_c real default 0,
    rainfall_mm numeric default 0,
    humidity_percent real default 0,
    sunlight_hours numeric default 8,
    irrigation_type numeric default 0,
    fertilizer_type numeric default 0,
    pesticide_usage_ml numeric default 0,
    sowing_date date,
    harvest_date date,
    yield_kg_per_hectare numeric default 2000,
    ndvi_index real default 0.1,
    crop_disease_status numeric default 0,
    constraint logs_pkey primary key (id, plot_id)
);

create index if not exists idx_logs_plot_id on public.logs(plot_id);

grant select, insert, delete on public.logs to authenticated;

alter table public.logs enable row level security;

drop policy if exists "logs_select_own" on public.logs;
drop policy if exists "logs_insert_own" on public.logs;
drop policy if exists "logs_delete_own" on public.logs;

create policy "logs_select_own"
on public.logs
for select
using (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = logs.plot_id
          and f.user_id = auth.uid()
    )
);

create policy "logs_insert_own"
on public.logs
for insert
with check (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = logs.plot_id
          and f.user_id = auth.uid()
    )
);

create policy "logs_delete_own"
on public.logs
for delete
using (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = logs.plot_id
          and f.user_id = auth.uid()
    )
);
