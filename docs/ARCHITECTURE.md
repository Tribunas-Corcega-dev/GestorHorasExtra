# Architecture

## Overview

This project is a Next.js App Router monolith:

- UI pages and components under `app/` and `components/`
- Backend API routes under `app/api/`
- Shared domain utilities in `lib/`

The app uses PostgreSQL (hosted in Supabase) with Prisma as the ORM. Supabase is kept for Storage operations only.

## Runtime model

- One process (`next dev` / `next start`) serves frontend and backend routes
- No separate backend server is required for Prisma
- Optional second terminal is useful for `prisma studio`, lint, or scripts

## Main layers

- `app/`: route-based UI and API endpoints
- `lib/apiAuth.js`: request token parsing and user lookup
- `lib/permissions.js`: role-based authorization rules
- `lib/calculations.js`: overtime, surcharge, and payroll computations
- `lib/prisma.js`: singleton Prisma client with Postgres adapter
- `lib/logger.js`: audit log writer

## Authentication and authorization

- JWT cookie: `auth_token`
- User source: table `usuarios`
- Access control: role checks from `lib/permissions.js`
- Middleware performs protected-route checks; route handlers enforce role-level actions

## Data architecture

- ORM: Prisma client generated to `lib/generated/prisma`
- Schema: `prisma/schema.prisma`
- Config: `prisma.config.ts` (prefers `DIRECT_URL`, falls back to `DATABASE_URL`)
- Migration SQL: `prisma/migrations/`

Core tables used by business flow:

- `usuarios`
- `historial_salarios` (nuevo historial salarial normalizado por fecha de vigencia)
- `jornadas`
- `solicitudes_tiempo`
- `historial_bolsa`
- `resumen_horas_extra`
- `aprobaciones_periodo`
- `apelaciones`
- `cierres_quincenales`

## Storage boundaries

Supabase Storage remains in use for:

- Profile pictures
- Appeal attachments (PDF/images)

DB reads/writes are handled through Prisma.

## Salary History Design

- El historial salarial ya no depende operativamente de `usuarios.hist_salarios` JSONB.
- La fuente de verdad es `historial_salarios` con indices por `(usuario_id, fecha_vigencia DESC)`.
- La compatibilidad legacy en payload de APIs ya fue retirada; `hist_salarios` queda solo como dato historico legado en BD.

## Consistency and transactions

High-impact compensatory flows use Prisma transactions with serializable isolation where race conditions can affect balances.

## Recommended future evolution

- Add integration tests for compensatory race paths and role authorization
- Add endpoint-level API docs with request/response examples for all role-sensitive routes
- Keep constraints and indexes versioned in migrations as business rules evolve


## Deferred UI Modules

The following modules are implemented at route/API level but intentionally hidden from the active sidebar UI:

- `Aprobaciones` (`/aprobaciones`)
- `Apelaciones` (`/apelaciones`)

Reason:

- They were created during earlier workflow design but are currently considered deferred features.
- The current UX keeps those sections out of user navigation while business flow is consolidated in other views.

Status:

- Code remains in repository for future reactivation/refactor.
- They should be treated as "created but not currently implemented in active UI navigation".