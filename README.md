# PampaLovers

Proyecto Pampa Lovers — HackITBA 2026.

## Backend

Instalar dependencias (desde la raíz del repositorio):

```bash
npm install
```

Levantar el servidor:

```bash
cd backend && node index.js
```

Por defecto escucha en `http://localhost:8000`.

### Variables de entorno

Copiar `backend/.env.example` a `backend/.env` y completar con los valores del panel de Supabase (**Settings → API**).

### Supabase y RLS

Si un `select` devuelve filas vacías pero en el Table Editor hay datos, revisar **políticas RLS** para el rol que usa tu clave (`anon` vs `service_role`). La clave `service_role` solo debe usarse en el servidor, nunca en el cliente.

El dashboard (rendimiento por cultivo) espera la tabla `plot_prediction` definida en `supabase/migrations/202603280003_create_plot_prediction.sql`; sin esa migración aplicada, la consulta puede fallar y el gráfico quedará vacío.

El mapa satelital guarda el contorno en la columna `polygon` de `plots` (`supabase/migrations/202603280005_add_plots_polygon.sql`). Hay que aplicar esa migración en el proyecto de Supabase para que los nuevos lotes persistan el polígono real.

### Smoke test

`GET /api/test` consulta la tabla `usuarios`; cambiar el nombre en código cuando definan el esquema real.
