-- Yanang Traveler → Constructor/Admin integration queue.
-- Safe to run repeatedly in Supabase SQL Editor.
create table if not exists public.yanang_reports (
  id text primary key check (char_length(id) between 1 and 128),
  zone_id bigint check (zone_id is null or zone_id between 1 and 4294967295),
  problem_type feedback_problem_type not null,
  description text not null default '' check (char_length(description) <= 500),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  status feedback_status not null default 'pending',
  created_at timestamptz not null,
  received_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_yanang_reports_status_created
  on public.yanang_reports(status, created_at desc);
create index if not exists idx_yanang_reports_zone_id
  on public.yanang_reports(zone_id);

alter table public.yanang_reports enable row level security;
revoke all privileges on table public.yanang_reports from anon, authenticated;
grant all privileges on table public.yanang_reports to service_role;
