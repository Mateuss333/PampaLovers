-- Predicción ML en kg/ha (alineado con pipeline y columna float4 en producción).
-- Si existía ml_predicted_tn_ha (migración 003), se copia a kg/ha y se elimina la columna antigua.

alter table public.plot_prediction
    add column if not exists ml_predicted_kg_ha double precision
        check (ml_predicted_kg_ha is null or ml_predicted_kg_ha >= 0);

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'plot_prediction'
          and column_name = 'ml_predicted_tn_ha'
    ) then
        update public.plot_prediction
        set ml_predicted_kg_ha = ml_predicted_tn_ha * 1000
        where ml_predicted_kg_ha is null
          and ml_predicted_tn_ha is not null;

        alter table public.plot_prediction drop column ml_predicted_tn_ha;
    end if;
end $$;
