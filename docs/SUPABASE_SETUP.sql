-- AOAS CRM Supabase Setup
-- Run this script once in Supabase SQL Editor for your project.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.crm_sections (
  id text primary key,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default ''
);

create table if not exists public.crm_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default ''
);

create table if not exists public.crm_participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  contact_number text not null default '',
  email text not null default '',
  gender text not null default '',
  address text not null default '',
  age integer,
  birthdate date,
  skills jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  status text not null default 'talent_pool' check (status in ('talent_pool', 'shortlisted', 'on_hold', 'inactive')),
  notes text not null default '',
  resume jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

create index if not exists idx_crm_sections_name on public.crm_sections (lower(name));
create index if not exists idx_crm_accounts_username on public.crm_accounts (lower(username));
create index if not exists idx_crm_participants_updated on public.crm_participants (updated_at desc);
create index if not exists idx_crm_participants_status on public.crm_participants (status);
create index if not exists idx_crm_participants_sections on public.crm_participants using gin (sections);

drop trigger if exists trg_crm_sections_touch on public.crm_sections;
create trigger trg_crm_sections_touch
before update on public.crm_sections
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_crm_accounts_touch on public.crm_accounts;
create trigger trg_crm_accounts_touch
before update on public.crm_accounts
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_crm_participants_touch on public.crm_participants;
create trigger trg_crm_participants_touch
before update on public.crm_participants
for each row execute procedure public.touch_updated_at();

-- Backend uses server-side env keys to access these tables.
-- Keep RLS disabled unless you explicitly create policies for your chosen key/role.
alter table public.crm_sections disable row level security;
alter table public.crm_accounts disable row level security;
alter table public.crm_participants disable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all on table public.crm_sections to anon, authenticated, service_role;
grant all on table public.crm_accounts to anon, authenticated, service_role;
grant all on table public.crm_participants to anon, authenticated, service_role;
