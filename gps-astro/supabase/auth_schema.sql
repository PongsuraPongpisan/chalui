-- ==========================================
-- Auth — Admin & Contractor login only (Traveler stays public, no login)
-- Run this in Supabase SQL Editor after schema.sql
-- ==========================================

create type app_role as enum ('admin', 'contractor');

create table app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null, -- bcrypt hash, never plaintext
  role app_role not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_app_users_updated_at
  before update on app_users
  for each row execute function set_updated_at();

alter table app_users enable row level security;
-- No public policies at all — this table is only ever touched by the
-- server via the service_role key (used in /api/auth/login). Browsers and
-- the anon/authenticated roles have zero access, by design.

-- ==========================================
-- Seed initial accounts — CHANGE THESE PASSWORDS before going live.
-- Password hashes below are placeholders; the app will tell you the actual
-- bcrypt hash to paste here after you run the hash-generator script.
-- ==========================================
-- insert into app_users (username, password_hash, role, full_name) values
--   ('admin', '<bcrypt-hash-here>', 'admin', 'DOH Admin'),
--   ('contractor', '<bcrypt-hash-here>', 'contractor', 'Site Contractor');

-- Grants (service_role needs these, same as schema.sql's grant block)
grant all privileges on app_users to service_role;
