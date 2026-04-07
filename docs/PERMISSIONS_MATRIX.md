# Permissions Matrix

This document summarizes effective permissions by role, considering both `middleware.js` and API route guards.

## Scope

- Roles compared: `TALENTO_HUMANO` and `ASISTENTE_GERENCIA`
- Sources reviewed:
  - `middleware.js`
  - `lib/permissions.js`
  - UI route guards in `app/**`
  - API route guards in `app/api/**`

## High-level comparison

| Capability | TALENTO_HUMANO | ASISTENTE_GERENCIA | Notes |
|---|---|---|---|
| Access `/ajustes` | Yes | Yes | Middleware allows both |
| Access `/empleados` and `/horas-extra` as manager | Yes | Yes | Middleware + `canManageEmployees/canManageOvertime` |
| View and edit employees | Yes | Yes | Coordinators restricted by area; not applicable here |
| Create employee from employee flows | Yes | Yes | API allows manager roles excluding coordinator |
| Access audit logs | Yes | Yes | Explicitly allowed for both profiles |
| Close payroll period (quincena) | Yes | Yes | API enforces both profiles |
| Manage compensatory requests | Yes | Yes | Via `canManageOvertime` |
| Batch accumulation for other users | Yes | Yes | Via `canManageOvertime` |

## Important implementation notes

1. Middleware does not guard `/api` paths by design.
2. API routes must always enforce role checks independently.
3. If UI and API disagree, API is the source of truth for security.

## Maintenance checklist

- When adding a new protected endpoint in `app/api/**`, always:
  1. Require authentication (`getUserFromRequest`).
  2. Enforce role checks in the handler.
  3. Add or update this matrix if role behavior changes.