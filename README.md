# Pintando Coyoacán

Sistema para registrar casas a pintar en Coyoacán: 3 fotografías, comprobante de domicilio, geolocalización, expediente completo, usuarios/admin y mapa Mapbox por colonias.

## Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, Formik, Yup
- **Backend:** API Routes de Next.js
- **Base de datos:** PostgreSQL + Prisma
- **Auth:** NextAuth (credenciales) con roles `USER` y `ADMIN`
- **Mapa:** Mapbox GL con secciones electorales INE de Coyoacán (mismo GeoJSON/token que `control`)

## Requisitos

- Node.js 20+
- PostgreSQL (Docker Compose o `npx prisma dev`)

## Arranque rápido

```bash
# 1) Dependencias
npm install

# 2) Variables de entorno
cp .env.example .env
# Edita DATABASE_URL y NEXTAUTH_SECRET

# 3) Base de datos
# Opción A — Prisma Dev (sin Docker):
npx prisma dev --detach

# Opción B — Docker Compose:
docker compose up -d
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pintura?schema=public

# 4) Esquema + datos demo
npx prisma db push
npm run db:seed

# 5) App
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### Cuentas demo

| Rol    | Correo                   | Contraseña  |
|--------|--------------------------|-------------|
| Admin  | `admin@pintura.local`    | `admin123`  |
| Usuario| `usuario@pintura.local`  | `usuario123`|

## Funcionalidad

- Alta de casa con dirección, colonia de Coyoacán, notas y geolocalización (GPS o pin en mapa)
- Checkbox **Expediente completo**
- Subida de **3 fotos** (cámara en móvil) y **comprobante de domicilio**
- Mapa de Coyoacán con colonias:
  - **Verde:** 3 fotos + comprobante + expediente marcado
  - **Naranja:** falta alguno de esos requisitos
- Roles: capturistas ven sus casas; admin ve todo y gestiona usuarios

## Scripts

| Comando            | Descripción              |
|--------------------|--------------------------|
| `npm run dev`      | Servidor de desarrollo   |
| `npm run build`    | Build de producción      |
| `npm run db:push`  | Sincroniza esquema       |
| `npm run db:seed`  | Carga usuarios y demos   |
| `npm run db:studio`| Prisma Studio            |

## Deploy (Railway + Vercel)

Postgres en **Railway**, app en **Vercel** (desde GitHub). Pasos y variables: ver [DEPLOY.md](./DEPLOY.md).
