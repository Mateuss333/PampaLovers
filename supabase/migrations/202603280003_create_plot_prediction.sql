-- Predicción ML por lote (una fila vigente por plot). El cliente combina con
-- plot_previous_yields: position 1 = cosecha más reciente, 10 = más antigua.
create table public.plot_prediction (
    id uuid primary key default gen_random_uuid(),
    plot_id uuid not null references public.plots(id) on delete cascade,
    ml_predicted_tn_ha numeric(12,4)
        check (ml_predicted_tn_ha is null or ml_predicted_tn_ha >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (plot_id)
);

create index idx_plot_prediction_plot_id on public.plot_prediction(plot_id);

create trigger set_plot_prediction_updated_at
before update on public.plot_prediction
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.plot_prediction to authenticated;

alter table public.plot_prediction enable row level security;

create policy "plot_prediction_select_own"
on public.plot_prediction
for select
using (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_prediction.plot_id
          and f.user_id = auth.uid()
    )
);

create policy "plot_prediction_insert_own"
on public.plot_prediction
for insert
with check (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_prediction.plot_id
          and f.user_id = auth.uid()
    )
);

create policy "plot_prediction_update_own"
on public.plot_prediction
for update
using (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_prediction.plot_id
          and f.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_prediction.plot_id
          and f.user_id = auth.uid()
    )
);

create policy "plot_prediction_delete_own"
on public.plot_prediction
for delete
using (
    exists (
        select 1
        from public.plots p
        join public.farms f on f.id = p.farm_id
        where p.id = plot_prediction.plot_id
          and f.user_id = auth.uid()
    )
);
