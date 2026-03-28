-- Contorno real del lote: array JSON [[lon, lat], ...] (mínimo 3 vértices).
alter table public.plots add column if not exists polygon jsonb;

comment on column public.plots.polygon is
    'Vértices [longitud, latitud] del contorno; el mapa satelital los usa con prioridad sobre la vista aproximada por centroide.';
