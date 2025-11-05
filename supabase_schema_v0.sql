-- ===============================================
-- Supabase Schema v0 - Sistema de Horarios y Horas Extra
-- ===============================================

-- Enums
create type role_type as enum ('boss','hr','assistant','coordinator','worker');
create type area_type as enum ('acueducto','aseo','alcantarillado');

-- Perfiles (extiende auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role role_type not null,
  area area_type,
  base_salary numeric(14,2),
  fixed_shift_minutes int,
  avatar_url text,
  created_at timestamptz default now()
);

-- Jornadas
create table if not exists public.shifts (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  start_morning timestamptz,
  end_morning timestamptz,
  start_afternoon timestamptz,
  end_afternoon timestamptz,
  total_minutes int,
  created_at timestamptz default now()
);

-- Horas extra
do $$ begin
  create type overtime_kind as enum (
    'diurna',
    'nocturna',
    'dominical_festiva',
    'extra_diurna_dominical_festiva',
    'extra_nocturna_dominical_festiva'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.overtime (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  kind overtime_kind not null,
  minutes int not null check (minutes >= 0),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz
);

-- Aprobaciones (documento firmado)
create table if not exists public.approvals (
  id bigserial primary key,
  overtime_id bigint not null references public.overtime(id) on delete cascade,
  signed_pdf_url text,
  created_at timestamptz default now()
);

-- Apelaciones
do $$ begin
  create type appeal_status as enum ('pendiente','resuelta','rechazada');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.appeals (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shift_id bigint references public.shifts(id) on delete set null,
  message text not null,
  status appeal_status not null default 'pendiente',
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Parámetros (TH)
create table if not exists public.parameters (
  id bigserial primary key,
  min_wage numeric(14,2),
  mult_diurna numeric(8,4) default 1.0,
  mult_nocturna numeric(8,4) default 1.0,
  mult_dominical numeric(8,4) default 1.0,
  mult_extra_diurna_dom numeric(8,4) default 1.0,
  mult_extra_nocturna_dom numeric(8,4) default 1.0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

-- Auditoría
create table if not exists public.audit_log (
  id bigserial primary key,
  actor uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz default now()
);

-- Vistas
create or replace view public.v_overtime_decimal as
select
  o.user_id,
  o.work_date,
  o.kind,
  round(o.minutes::numeric / 60.0, 2) as hours_decimal,
  o.minutes
from public.overtime o;

-- === RLS ===
alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.overtime enable row level security;
alter table public.approvals enable row level security;
alter table public.appeals enable row level security;
alter table public.parameters enable row level security;
alter table public.audit_log enable row level security;

-- Helpers
create or replace function public.current_role() returns role_type
language sql stable as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_area() returns area_type
language sql stable as $$
  select area from public.profiles where id = auth.uid()
$$;

-- Policies
drop policy if exists profiles_select_self_or_by_role on public.profiles;
create policy profiles_select_self_or_by_role on public.profiles
for select using (
  auth.uid() = id
  or public.current_role() in ('boss','hr','assistant')
  or (public.current_role() = 'coordinator' and area = public.current_area())
);

drop policy if exists shifts_select_policy on public.shifts;
create policy shifts_select_policy on public.shifts
for select using (
  user_id = auth.uid()
  or public.current_role() in ('boss','hr','assistant')
  or (
    public.current_role() = 'coordinator'
    and exists (
      select 1 from public.profiles p
      where p.id = shifts.user_id and p.area = public.current_area()
    )
  )
);

drop policy if exists overtime_select_policy on public.overtime;
create policy overtime_select_policy on public.overtime
for select using (
  user_id = auth.uid()
  or public.current_role() in ('boss','hr','assistant')
  or (
    public.current_role() = 'coordinator'
    and exists (
      select 1 from public.profiles p
      where p.id = overtime.user_id and p.area = public.current_area()
    )
  )
);

drop policy if exists appeals_select_policy on public.appeals;
create policy appeals_select_policy on public.appeals
for select using (
  user_id = auth.uid()
  or public.current_role() in ('boss','hr','assistant')
  or public.current_role() = 'coordinator'
);

drop policy if exists shifts_insert_self on public.shifts;
create policy shifts_insert_self on public.shifts
for insert with check (
  user_id = auth.uid()
  or public.current_role() in ('boss','hr','assistant','coordinator')
);

-- Nota: añade políticas de UPDATE/DELETE específicas por rol en sprints siguientes.

-- Seeds básicos (opcionales)
insert into public.parameters (min_wage, mult_diurna, mult_nocturna, mult_dominical, mult_extra_diurna_dom, mult_extra_nocturna_dom)
values (1300000, 1.25, 1.75, 1.35, 2.00, 2.50)
on conflict do nothing;
