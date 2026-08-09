# Deploy: Railway (Postgres) + Vercel (Next.js)

Arquitectura:

- **Railway** → PostgreSQL (`pintando` / servicio Postgres)
- **Vercel** → app Next.js desde GitHub + **Blob** para fotos/comprobantes

## Variables en Vercel

| Variable | Origen |
|----------|--------|
| `DATABASE_URL` | Railway → TCP público (`DATABASE_PUBLIC_URL` / `*.proxy.rlwy.net`) |
| `NEXTAUTH_URL` | URL de producción de Vercel (`https://….vercel.app`) |
| `NEXTAUTH_SECRET` | Secreto aleatorio largo |
| `BLOB_READ_WRITE_TOKEN` | Vercel Storage → Blob (se crea al conectar el store) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token Mapbox (geocodificación) |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Igual que el anterior |
| `NEXT_PUBLIC_MAPBOX_STYLE` | opcional |

En local las subidas van a `public/uploads`. En Vercel, si existe `BLOB_READ_WRITE_TOKEN`, van a Blob.

## Railway

Proyecto ya creado: **pintando** con Postgres + TCP proxy público.

```bash
railway link   # si hace falta
railway variables --service Postgres
# Usa la URL pública (proxy) en Vercel, no la *.railway.internal
```

Schema / seed (una vez):

```bash
# con DATABASE_URL = URL pública de Railway
npx prisma db push
npm run db:seed
```

## Vercel (desde GitHub)

1. Importa el repo `EborjaRangel/pintando` en [vercel.com/new](https://vercel.com/new)
2. Añade las variables de arriba
3. Crea Storage → Blob (público) y conéctalo al proyecto
4. Deploy

O con CLI (ya autenticado):

```bash
npx vercel link --yes --project pintando
npx vercel git connect https://github.com/EborjaRangel/pintando.git
npx vercel blob create-store pintando-uploads --access public --yes --environment production --environment preview
npx vercel --prod
```

Cada push a `main` vuelve a desplegar en Vercel. El `build` corre `prisma db push` para mantener el esquema.

## Cuentas demo (después del seed)

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Admin | `admin@pintura.local` | `admin123` |
| Autorización | `autorizacion@pintura.local` | `autoriza123` |
| Usuario | `usuario@pintura.local` | `usuario123` |
