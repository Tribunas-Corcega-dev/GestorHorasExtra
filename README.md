# Gestor de Horas Extra - Tribunas Corcega

Sistema para gestion de jornadas, horas extra, compensatorios, aprobaciones y cierres quincenales.

## Resumen rapido

- Arquitectura: monolito Next.js (App Router) con frontend + backend en `app/` y `app/api/`
- Base de datos: PostgreSQL (Supabase) con Prisma como ORM principal
- Autenticacion: JWT con usuarios locales en tabla `usuarios` (no Supabase Auth)
- Almacenamiento de archivos: Supabase Storage (`fotos_trabajadores` y `apelaciones`)

## Stack tecnico

- Next.js 16, React 19, Tailwind 4, Shadcn UI
- Prisma 7 + `@prisma/adapter-pg` + `pg`
- Validacion y forms: `zod` + `react-hook-form`
- Fecha/hora: `dayjs`

## Documentacion adicional

- Arquitectura: `docs/ARCHITECTURE.md`
- API (rutas principales y contratos): `docs/API_REFERENCE.md`
- Operacion y mantenimiento: `docs/OPERATIONS.md`

## Roles y permisos

Las reglas estan centralizadas en `lib/permissions.js`.

| Rol | Capacidad principal |
| :-- | :-- |
| `OPERARIO` | Consulta su historial y solicita compensatorios |
| `COORDINADOR` | Gestion diaria de jornadas y solicitudes |
| `JEFE` | Aprobaciones de periodos y supervision |
| `TALENTO_HUMANO` | Gestion de personal, cierres y reportes |
| `ASISTENTE_GERENCIA` | Capacidades de apoyo administrativo |

## Instalacion

1. Clonar repo

```bash
git clone https://github.com/Tribunas-Corcega-dev/GestorHorasExtra.git
cd GestorHorasExtra
```

2. Instalar dependencias

```bash
npm install --legacy-peer-deps
```

3. Configurar `.env`

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

JWT_SECRET=tu-secreto-seguro

DATABASE_URL=postgresql://...   # recomendado para runtime Prisma
DIRECT_URL=postgresql://...     # recomendado para introspeccion/migraciones Prisma
```

4. Preparar Prisma

```bash
npm run prisma:generate
```

5. Ejecutar en desarrollo

```bash
npm run dev
```

## Scripts utiles

- `npm run dev`: servidor Next.js (frontend + API)
- `npm run lint`: linting del proyecto
- `npm run build`: build de produccion
- `npm run prisma:pull`: introspeccion del esquema desde DB
- `npm run prisma:generate`: regenerar cliente Prisma
- `npm run prisma:studio`: explorador visual de datos

## Estado actual de datos

- Rutas de negocio usan Prisma para consultas y escrituras en Postgres
- Se mantiene Supabase solo para Storage y firmado de URLs de archivos

## Mantenimiento DB

Scripts en `scripts/`:

- `add_performance_and_integrity_indexes.sql`
- `cleanup_duplicate_active_requests.sql`
- `create_automatic_balance_trigger.sql`
- `force_populate_resumen.js`
- `check_schema.js`
- `debug_data.js`
- `add_historial_salarios_table.sql`
- `dedupe_historial_salarios.sql`
- `reconcile_historial_salarios.js`

Migraciones versionadas:

- `prisma/migrations/`

## Notas de desarrollo

- Si hay cambios en `prisma/schema.prisma`, vuelve a correr `npm run prisma:generate`
- Para cambios de estructura de DB, usa migraciones SQL versionadas
- Todas las rutas protegidas validan sesion JWT y permisos por rol
