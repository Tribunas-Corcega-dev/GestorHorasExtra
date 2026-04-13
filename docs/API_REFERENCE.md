# API Reference (Core)

This file summarizes the most used API modules and their intent.

## Auth

- `POST /api/auth/login`: validate credentials and issue JWT cookie
- `POST /api/auth/logout`: clear auth cookie
- `GET /api/auth/me`: current authenticated user profile
- `POST /api/auth/register`: create user account

## Employees

- `GET /api/empleados`: list active employees with filters
- `POST /api/empleados`: create employee
- `GET /api/empleados/:id`: employee detail (salary history is exposed only in `salary_history`)
- `PUT /api/empleados/:id`: update employee profile and derived values (writes normalized salary history entries by effective date)
- `DELETE /api/empleados/:id`: soft-delete employee (`is_active = false`)

## Workdays and overtime

- `GET /api/jornadas`: list workdays (`empleado_id` optional)
- `POST /api/jornadas`: create workday record
- `PUT /api/jornadas`: update workday by `empleado_id + fecha`
- `DELETE /api/jornadas`: delete workday by `empleado_id + fecha`

## Compensatory time

- `POST /api/compensatorios/solicitar`: request time usage (or manager direct redemption)
- `POST /api/compensatorios/gestionar`: approve/reject banking/redemption requests
- `GET /api/compensatorios/gestionar`: pending queues and history for approvals view
- `POST /api/compensatorios/acumular`: submit banking request from one workday
- `POST /api/compensatorios/acumular-batch`: batch accumulation workflow
- `GET /api/compensatorios/saldo`: balance and movement history
- `GET /api/compensatorios/resumen`: summarized overtime balance structure

## Approvals and signatures

- `GET /api/aprobaciones/firma`: period approvals lookup
- `POST /api/aprobaciones/firma`: create/update signed approval snapshot
- `GET /api/usuarios/firma`: read current user signature
- `POST /api/usuarios/firma`: update current user signature

## Appeals

UI note: appeals are currently treated as deferred/inactive in active navigation and operario detail actions.
- `POST /api/apelaciones`: create appeal and upload files to storage
- `GET /api/apelaciones`: list appeals by role/scope
- `GET /api/apelaciones/:id`: appeal detail with signed file URLs
- `PATCH /api/apelaciones/:id`: approve/reject appeal

## Reports and payroll closure

- `GET /api/reportes/horas-extra`: accumulated overtime report
- `GET /api/reportes/empleados-activos`: active employee ids in period
- `GET /api/cierres/calcular`: calculate closure preview for period using effective salary from normalized history
- `POST /api/cierres`: create quincena closure record

## Configuration catalog endpoints

- `GET/POST /api/parametros`
- `GET/POST /api/horarios`
- `GET/PUT /api/recargos`
- `GET /api/roles`

## Notes

- Most endpoints are role-protected and rely on JWT session cookie.
- Prisma is the primary DB access layer.
- Supabase SDK is used for Storage-related operations only.

