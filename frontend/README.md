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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
