# Despacho Gas

Plataforma de Despacho Inteligente de Gas. Next.js (App Router) + TypeScript + Tailwind + Prisma + PostgreSQL. API integrada en rutas de Next. Wrapper configurable para WhatsApp Business API.

## Requisitos
- Node.js 18+
- PostgreSQL 14+

## Configuración
1. Copia variables de entorno:
   - Crea `.env.local` en la raíz con:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
WHATSAPP_API_BASE_URL="https://graph.facebook.com/v20.0"
WHATSAPP_TOKEN="<token>"
WHATSAPP_PHONE_NUMBER_ID="<phone_number_id>"
```
2. Instalar dependencias:
```
npm install
```
3. Generar Prisma e inicializar BD:
```
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```
4. Ejecutar en desarrollo:
```
npm run dev
```

## Vistas
- Portal público (`/`): crear pedido sin login.
- Admin (`/admin`): filtrar por sector, listar pedidos, asignar repartidor.
- Repartidor (`/driver`): ver entregas asignadas y actualizar estado.

## API principal
- POST `/api/orders`: crear pedido público.
- GET `/api/admin/sectors`: listar sectores.
- GET `/api/admin/drivers`: listar repartidores.
- GET `/api/admin/orders`: listar pedidos.
- POST `/api/admin/assign`: asignar pedido a repartidor (crea/actualiza `Delivery`).
- GET `/api/driver/deliveries`: entregas (demo sin auth).
- PATCH `/api/driver/deliveries/[id]/status`: actualizar estado entrega.

## WhatsApp Business API
El wrapper `src/lib/whatsapp.ts` usa variables de entorno y no envía mensajes si no hay configuración.

## Despliegue
### Vercel (Web)
1. Importa el repositorio en Vercel.
2. Configura variables de entorno (mismas que `.env.local`).
3. Deploy.

### Railway (Base de datos PostgreSQL)
1. Crea un proyecto PostgreSQL en Railway.
2. Copia la URL como `DATABASE_URL` en Vercel.
3. Ejecuta migraciones desde local o CI:
```
npx prisma migrate deploy
```

## Scripts útiles
- `npm run dev`: desarrollo
- `npm run build` / `npm start`: producción
- `npm run prisma:generate` / `npm run prisma:migrate` / `npm run prisma:seed`

## Licencia
MIT


