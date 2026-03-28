-- Update plots.status to use agricultural domain values instead of generic active/archived
alter table public.plots drop constraint if exists plots_status_check;

alter table public.plots add constraint plots_status_check
    check (status in ('Sembrado', 'Crecimiento', 'Cosechado', 'Barbecho'));

alter table public.plots alter column status set default 'Sembrado';

-- Add fields needed by the settings page
alter table public.farms add column if not exists size_ha numeric(10,2)
    check (size_ha is null or size_ha > 0);

alter table public.farms add column if not exists timezone text
    default 'america-buenos-aires';

alter table public.farms add column if not exists currency text
    default 'ars';
