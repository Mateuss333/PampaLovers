-- Permite guardar multiples estimaciones por lote y consultar su historial por fecha.
alter table public.plot_prediction
    drop constraint if exists plot_prediction_plot_id_key;

create index if not exists idx_plot_prediction_plot_id_created_at
    on public.plot_prediction(plot_id, created_at desc);
