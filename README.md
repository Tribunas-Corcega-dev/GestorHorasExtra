# Sistema de Gestión de Horarios y Horas Extra

Stack: Next.js (App Router) + TypeScript + Supabase (Auth/DB/Storage) + RLS.

## Pasos iniciales
1. Copia `.env.example` a `.env.local` y completa tus claves de Supabase.
2. Importa `supabase_schema_v0.sql` en tu proyecto Supabase.
3. `npm i` y luego `npm run dev`.

Estructura base con rutas protegidas y helpers de Supabase.

## Funciones Edge y clientes Supabase

### Variables de entorno

#### Web (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

#### Móvil (`mobile/.env` o `app.config`)
```
EXPO_PUBLIC_SUPABASE_URL=tu_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

### Uso en la web (Next.js)
- `lib/edge.ts` expone `callEdge` que firma la petición con el token activo del usuario.
- `hooks/useApproveOvertime.ts` y `hooks/useGenerateReport.ts` consumen las funciones `approve-overtime` y `generate-report`.

```tsx
const { approve, loading } = useApproveOvertime()
await approve(overtimeId)
```

```tsx
const { generateReport } = useGenerateReport()
const { report } = await generateReport({ startDate, endDate })
```

### Uso en móvil (Expo/React Native)
- `mobile/lib/supabase.ts` crea el cliente con las variables `EXPO_PUBLIC_*`.
- `mobile/lib/edge.ts` replica `callEdge` para móvil.
- Hooks equivalentes en `mobile/hooks/`.

```ts
const { approve } = useApproveOvertime()
await approve(overtimeId)
```

```ts
const { generateReport } = useGenerateReport()
const { report } = await generateReport({ startDate, endDate })
```

### Despliegue de funciones Edge
```
supabase login
supabase link --project-ref <project>
supabase secrets set SUPABASE_SERVICE_ROLE=<service_role_key>
supabase functions deploy approve-overtime
supabase functions deploy generate-report
```
