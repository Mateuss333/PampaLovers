alter table public.plots add column if not exists sowing_date date;

comment on column public.plots.sowing_date is
    'Fecha de siembra del cultivo en el lote.';
