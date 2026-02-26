# Operations Runbook

## Prerequisites

- Node.js 20+
- Access to PostgreSQL (Supabase project)
- Environment variables configured in `.env`

## Local setup

```bash
npm install --legacy-peer-deps
npm run prisma:generate
npm run dev
```

## Validation commands

```bash
npm run lint
npm run build
```

## Prisma workflow

Introspect schema from DB:

```bash
npm run prisma:pull
```

Regenerate client after schema changes:

```bash
npm run prisma:generate
```

Open Prisma Studio:

```bash
npm run prisma:studio
```

## Database hardening scripts

### 1) Add performance/integrity indexes

File: `scripts/add_performance_and_integrity_indexes.sql`

Includes:

- indexes for high-traffic tables (`jornadas`, `solicitudes_tiempo`, `historial_bolsa`, `apelaciones`)
- guarded partial unique index for one active request per user/day

### 2) Detect and optionally clean duplicate active requests

File: `scripts/cleanup_duplicate_active_requests.sql`

- Section A: diagnostics only (safe)
- Section B: cleanup (commented; run only after review)

## Production checklist

- [ ] `npm run lint` clean (or known warnings accepted)
- [ ] `npm run build` passes
- [ ] Prisma client generated and committed if required by deployment flow
- [ ] Migration SQL reviewed and applied
- [ ] Role-sensitive flows smoke-tested:
  - login/me
  - jornadas CRUD
  - compensatory request/approval
  - appeal upload/approval
  - period closure preview/create

## Troubleshooting

### Peer dependency install errors

Use:

```bash
npm install --legacy-peer-deps
```

### Date appears in wrong quincena

Use local date-only parsing for `YYYY-MM-DD` filtering logic instead of direct `new Date("YYYY-MM-DD")` when grouping by day boundaries.

### Pending compensatory requests not visible to approvers

Managers should access `Aprobaciones` from sidebar/mobile nav. Endpoint used: `GET /api/compensatorios/gestionar`.
