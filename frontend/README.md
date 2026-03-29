This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

`npm run dev` usa **Webpack** (`next dev --webpack`). En este repo hay dos `package-lock.json` (raíz y `frontend/`); Next infiere el workspace en la raíz y **Turbopack** puede indexar todo el monorepo y consumir mucha CPU/RAM. Si querés probar Turbopack igual: `npm run dev:turbo`.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Vista Satelital (mapa)

La ruta `/satelite` usa [Leaflet](https://leafletjs.com/) con teselas públicas. **No hace falta ninguna variable de entorno** para el mapa (demo hackathon).

- **Calles:** datos © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- **Satelital (imagen):** teselas © Esri, Maxar, Earthstar Geographics y la comunidad GIS (uso razonable; revisá términos del proveedor si escalás tráfico).

Leaflet se carga en el cliente con import dinámico dentro de `components/satellite-map.tsx`.

El formulario **Nuevo lote** (`components/lot-polygon-map-picker.tsx`) usa las mismas capas satelital (Esri) y calles (OSM), con vista satelital por defecto.

## Registro (Supabase)

El formulario de **Crear cuenta** usa la ruta interna `POST /api/auth/register`, que registra usuarios con la **Admin API** (`auth.admin.createUser`) y evita el *rate limit* del endpoint público `/auth/v1/signup`.

En `frontend/.env.local` (y en el hosting, p. ej. Vercel) configurá **solo en servidor**:

- `SUPABASE_SERVICE_ROLE_KEY` — la *service role* del proyecto (Dashboard → Project Settings → API). **No** uses el prefijo `NEXT_PUBLIC_`; no la subas al repositorio.

Sin esa variable, el registro responde error de configuración. La clave ya la usás para Edge Functions; reutilizá el mismo valor en el entorno de Next.js.

Si preferís no usar service role en Next, podés volver al flujo solo con `signUp` en cliente y ajustar límites en **Authentication** del dashboard de Supabase.

## Eliminar cuenta (Supabase)

La Edge Function **`delete-account`** borra el usuario de Auth con `auth.admin.deleteUser` (requiere **service role** en el servidor, no en el cliente). Podés invocarla con el cliente de Supabase (`supabase.functions.invoke`) o desde tu propia herramienta, una vez desplegada y configurada.

1. Desplegá la función: `supabase functions deploy delete-account` (desde la carpeta del proyecto Supabase).
2. Configurá el secret **`SUPABASE_SERVICE_ROLE_KEY`** para las Edge Functions (Dashboard de Supabase → Edge Functions → Secrets, o `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`). **No** subas esa clave al repositorio.

Sin el secret o sin despliegue, la función responde error (p. ej. «Edge Function returned a non-2xx status code» o fallo de red al invocarla).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
