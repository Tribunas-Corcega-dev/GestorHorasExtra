-- Create the audit_logs table
create table public.audit_logs (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  user_id uuid null,
  user_email text null,
  action text not null,
  entity text not null,
  entity_id text null,
  details jsonb null,
  ip_address text null,
  constraint audit_logs_pkey primary key (id),
  constraint audit_logs_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null
);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Policies
-- 1. Admins/HR (Jefe, Talento Humano) can read all logs.
create policy "Admins can view all audit logs"
on public.audit_logs
for select
using (
  exists (
    select 1 from public.usuarios
    where usuarios.id = auth.uid()
    and usuarios.rol in ('JEFE', 'TALENTO_HUMANO')
  )
);

-- 2. Service Role (Server-side) can insert logs.
-- (Supabase Service Role bypasses RLS, but if inserting via client with anon key, we might need a policy or use a function)
-- For now, we assume inserts happen via server-side API routes using Service Role or authenticated users.

-- Allow authenticated users to insert (e.g. if logging from client, though backend is preferred)
-- Ideally, only backend should insert. But let's allow auth users to insert their *own* actions if needed?
-- Better: "Authenticated users can insert" (for the API to work if using RLS/Auth context).
create policy "Users can insert audit logs"
on public.audit_logs
for insert
with check (
  auth.uid() = user_id OR user_id IS NULL
);
