# EvoAgro

MVP EvoAgro — HackITBA 2026.

A continuacion, se detalla como ejecutar localmente el proyecto.

## Frontend

Primero, se debe contar con `NodeJS` para poder utilizar el comando `npm`. 
Luego, dentro de la carpeta `frontend/` instalar dependencias:

```bash
npm install
```

### Variables de entorno

Se debe contar con un archivo `.env.local` con las variables de entorno requeridas, estas son:

- SUPABASE_SERVICE_ROLE_KEY(Desde el panel de Supabase)
- EOS_API_KEY(Desde el panel de EOSDA API)
- NEXT_PUBLIC_SUPABASE_URL(Desde el panel de Supabase)
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY(Desde el panel de Supabase)

Se deben completar con los valores obtenidos de las distintas herramientas. Por ejemplo:

```
SUPABASE_SERVICE_ROLE_KEY=sb_secret_XXXXXXXXXXXXXXXXXX
EOS_API_KEY=apk.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_XXXXXXXXXXXXXXXXXXXXxxX
```

--- 

Finalmente, levantar el servidor:

```bash
npm run dev
```

Por defecto escucha en `http://localhost:3000`.

## Backend

Debido a que no es posible integrar las liberias de TensorFlow con Supabase, se requiere levantar una API, 
hecha con **FastAPI**. Primero, se debe contar con `Python3` para utilizar el comando `pip`, luego en el directorio 
`backend/` se deben instalar las dependencias requeridas:

```
pip install -r requirements.txt
```

Luego, correr con:

```
fastapi run main.py
```

Por defecto escucha en `http://localhost:8000`.

> **Nota**: En caso de correr la API localmente, se debera cambiar la URL utilizada en las **Edge Functions** 
de Supabase por `http://localhost:8000`.

## Supabase

Hay muchas cosas que quedaron en Supabase, cualquier duda hacerla de lo implementado en dicha plataforma contactar a los participantes del 
equipo.