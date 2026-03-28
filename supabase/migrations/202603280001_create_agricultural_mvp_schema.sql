create extension if not exists pgcrypto;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text,
    email text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.farms (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    description text,
    location_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_farms_user_id on public.farms(user_id);

create table public.plots (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms(id) on delete cascade,
    name text not null,
    description text,
    area_ha numeric(10,2) check (area_ha is null or area_ha > 0),
    status text not null default 'active' check (status in ('active', 'archived')),
    latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
    longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
    crop_type text,
    soil_moisture_percent numeric(5,2)
        check (soil_moisture_percent between 0 and 100),
    soil_ph numeric(4,2)
        check (soil_ph between 0 and 14),
    temperature_c numeric(6,2),
    rainfall_mm numeric(8,2)
        check (rainfall_mm is null or rainfall_mm >= 0),
    humidity_percent numeric(5,2)
        check (humidity_percent between 0 and 100),
    sunlight_hours numeric(5,2)
        check (sunlight_hours >= 0),
    irrigation_type text,
    fertilizer_type text,
    pesticide_usage_ml numeric(10,2)
        check (pesticide_usage_ml >= 0),
    total_days integer
        check (total_days >= 0),
    ndvi_index numeric(6,4)
        check (ndvi_index is null or ndvi_index between -1 and 1),
    crop_disease_status text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_plots_farm_id on public.plots(farm_id);

create table public.plot_previous_yields (
    id uuid primary key default gen_random_uuid(),
    plot_id uuid not null references public.plots(id) on delete cascade,
    position smallint not null check (position between 1 and 10),
    yield_value numeric(12,2) not null check (yield_value > 0),
    yield_unit text not null check (yield_unit in ('kg_ha', 'tn_ha')),
    created_at timestamptz not null default now(),
    unique (plot_id, position)
);

create index idx_plot_previous_yields_plot_id
    on public.plot_previous_yields(plot_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_farms_updated_at
before update on public.farms
for each row
execute function public.set_updated_at();

create trigger set_plots_updated_at
before update on public.plots
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'name', '')
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.farms to authenticated;
grant select, insert, update, delete on public.plots to authenticated;
grant select, insert, update, delete on public.plot_previous_yields to authenticated;

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.plots enable row level security;
alter table public.plot_previous_yields enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "farms_select_own"
on public.farms
for select
using (auth.uid() = user_id);

create policy "farms_insert_own"
on public.farms
for insert
with check (auth.uid() = user_id);

create policy "farms_update_own"
on public.farms
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "farms_delete_own"
on public.farms
for delete
using (auth.uid() = user_id);

create policy "plots_select_own"
on public.plots
for select
using (
    exists (
        select 1
        from public.farms f
        where f.id = plots.farm_id
          and f.user_id = auth.uid()
    )
);

create policy "plots_insert_own"
on public.plots
for insert
with check (
    exists (
        select 1
        from public.farms f
        where f.id = plots.farm_id
          and f.user_id = auth.uid()
    )
);

create policy "plots_update_own"
on public.plots
for update
using (
    exists (
        select 1
        from public.farms f
        where f.id = plots.farm_id
          and f.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.farms f
        where f.id = plots.farm_id
          and f.user_id = auth.uid()
    )
);

create policy "plots_delete_own"
on public.plots
for delete
using (
    exists (
        select 1
        from public.farms f
        where f.id = plots.farm_id
          and f.user_id = auth.uid()
    )
);

create policy "plot_previous_yields_select_own"
on public.plot_previous_yields
for select
using (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_previous_yields.plot_id
          and f.user_id = auth.uid()
    )
);

create policy "plot_previous_yields_insert_own"
on public.plot_previous_yields
for insert
with check (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_previous_yields.plot_id
          and f.user_id = auth.uid()
    )
);

create policy "plot_previous_yields_update_own"
on public.plot_previous_yields
for update
using (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_previous_yields.plot_id
          and f.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_previous_yields.plot_id
          and f.user_id = auth.uid()
    )
);

create policy "plot_previous_yields_delete_own"
on public.plot_previous_yields
for delete
using (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_previous_yields.plot_id
          and f.user_id = auth.uid()
    )
);
