-- Identificador entre comillas: coincide con el nombre expuesto por PostgREST (camelCase).
alter table public.plots add column if not exists "geoJSON" jsonb;

comment on column public.plots."geoJSON" is
    'GeoJSON Polygon (WGS84, anillos [lon, lat]) del contorno del lote.';
