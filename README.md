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

### Smoke test

`GET /api/test` consulta la tabla `usuarios`; cambiar el nombre en código cuando definan el esquema real.
