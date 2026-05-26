-- ============================================================
--  Work Effort Tracker — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── TABLES ───────────────────────────────────────────────────

create table if not exists public.projects (
  id          text        primary key default gen_random_uuid()::text,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  name        text        not null,
  color       text        not null default '#6366f1',
  created_at  timestamptz default now()
);

create table if not exists public.customers (
  id          text        primary key default gen_random_uuid()::text,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  name        text        not null,
  type        text        check (type in ('internal','external')) not null default 'internal',
  color       text        not null default '#3b82f6',
  created_at  timestamptz default now()
);

create table if not exists public.entries (
  id          text        primary key default gen_random_uuid()::text,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  title       text        not null,
  project_id  text        references public.projects(id)  on delete set null,
  customer_id text        references public.customers(id) on delete set null,
  hours       numeric     not null default 0,
  status      text        check (status in ('pending','in-progress','completed')) default 'pending',
  date        date,
  notes       text,
  created_at  timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

alter table public.projects  enable row level security;
alter table public.customers enable row level security;
alter table public.entries   enable row level security;

-- Each user can only read/write their own rows
create policy "own projects"  on public.projects  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own customers" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own entries"   on public.entries   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── INDEXES (performance) ─────────────────────────────────────

create index if not exists projects_user_idx  on public.projects  (user_id);
create index if not exists customers_user_idx on public.customers (user_id);
create index if not exists entries_user_idx   on public.entries   (user_id);
create index if not exists entries_date_idx   on public.entries   (date desc);
