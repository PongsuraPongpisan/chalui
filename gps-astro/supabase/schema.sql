-- ==========================================
-- GPS Construction Platform — Supabase Schema
-- Adapted from BDI-Bangkok spec, matched to the actual gps-astro app
-- (circle-based zones, no PostGIS/Flutter/FCM — those aren't used here)
-- ==========================================
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ─── ENUMS ───

create type project_status as enum ('completed', 'in-progress', 'delayed', 'planned');
create type work_level as enum ('critical', 'high', 'medium', 'routine');
create type compliance_verdict as enum ('pass', 'fail');
create type admin_decision as enum ('pending', 'confirmed', 'overridden');
create type report_type as enum ('Construction', 'Road Damage', 'Accident', 'Traffic', 'Other');
create type feedback_problem_type as enum ('no_cones', 'no_sign', 'data_mismatch', 'heavy_traffic', 'other');
create type feedback_status as enum ('pending', 'resolved');

-- ─── shared trigger: keep updated_at fresh ───

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── TABLE: projects (construction zones) ───

create table projects (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique, -- keeps the old numeric ids (1..15) for the demo dataset
  name text not null,
  province text not null,
  contractor text not null,
  status project_status not null default 'planned',
  work_level work_level not null default 'medium',
  road_name text,
  lat double precision not null,
  lng double precision not null,
  radius_km numeric(5,2) default 0.3,
  boundary_meters integer default 260,
  start_date date,
  end_date date,

  -- AI compliance audit fields (the app's actual differentiator)
  ai_verdict compliance_verdict,
  ai_confidence integer check (ai_confidence between 0 and 100),
  ai_score integer check (ai_score between 0 and 100),
  compliance_verdict compliance_verdict,
  compliance_score integer,
  compliance_report_id text,
  admin_decision admin_decision default 'pending',
  verified boolean not null default false,
  ai_was_wrong boolean not null default false,
  published_to_drivers boolean not null default true,
  is_dangerous boolean not null default false,
  needs_doh_inspection boolean not null default false,
  needs_reaudit boolean not null default false,
  reject_reason text,
  override_reason text,
  last_audit_at timestamptz,
  validated_by text,
  validated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_status on projects(status);
create index idx_projects_work_level on projects(work_level);
create index idx_projects_compliance_verdict on projects(compliance_verdict);

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ─── TABLE: compliance_audits (full audit history — currently thrown away client-side) ───

create table compliance_audits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  report_id text not null,
  overall_status text not null, -- pass | pass_with_warnings | fail | critical_fail
  overall_score integer not null,
  ai_confidence integer,
  rule_results jsonb not null default '[]',
  detected_objects jsonb not null default '[]',
  recommendations jsonb not null default '[]',
  report_hash text not null,
  inspected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_compliance_audits_project_id on compliance_audits(project_id);
create index idx_compliance_audits_inspected_at on compliance_audits(inspected_at desc);

-- ─── TABLE: reports (citizen reports, from the Reports panel) ───

create table reports (
  id uuid primary key default gen_random_uuid(),
  legacy_id bigint, -- old Date.now() based ids from the client
  project_id uuid references projects(id) on delete set null,
  type report_type not null default 'Other',
  title text not null,
  description text,
  image_url text, -- legacy URL or JSON-encoded photo album (API exposes image + images[])
  lat double precision not null,
  lng double precision not null,
  reporter_name text default 'ประชาชน',
  status feedback_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_reports_project_id on reports(project_id);
create index idx_reports_status on reports(status);
create index idx_reports_created_at on reports(created_at desc);

-- ─── TABLE: feedback (citizen compliance signal → re-audit trigger) ───

create table feedback (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references projects(id) on delete cascade,
  problem_type feedback_problem_type not null default 'other',
  description text,
  photo_url text,
  lat double precision,
  lng double precision,
  status feedback_status not null default 'pending',
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_feedback_zone_id on feedback(zone_id);
create index idx_feedback_status on feedback(status);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
-- Architecture: the browser NEVER talks to Supabase directly. All reads and
-- writes go through the existing Astro API routes (/api/projects, /api/reports),
-- which use the service_role key server-side (bypasses RLS entirely).
-- RLS below is defense-in-depth in case the anon key is ever used client-side.

alter table projects enable row level security;
alter table compliance_audits enable row level security;
alter table reports enable row level security;
alter table feedback enable row level security;

-- Public (anon) can read projects — matches "citizens see active zones"
create policy "projects_public_read" on projects
  for select using (true);

-- No public write policies — writes happen only via service_role in API routes.
-- Same for compliance_audits, reports, feedback: read is public, write is
-- service-role-only by default (no policy = denied for anon/authenticated).

create policy "compliance_audits_public_read" on compliance_audits
  for select using (true);

create policy "reports_public_read" on reports
  for select using (true);

create policy "feedback_public_read" on feedback
  for select using (true);

-- ==========================================
-- SEED DATA — the 15 demo projects currently hardcoded in script.js/projects.js
-- ==========================================

insert into projects (legacy_id, name, province, contractor, status, work_level, road_name, lat, lng, radius_km, start_date, end_date) values
(1,  'Bangkok Pink Line Extension',        'Bangkok',     'Siam Infra JV',          'in-progress', 'critical', 'Chaeng Watthana Road',     13.8952, 100.5792, 0.42, '2026-01-15', '2027-05-30'),
(2,  'Chaeng Watthana Utility Relocation', 'Bangkok',     'Metro Utility Works',    'delayed',     'high',     'Chaeng Watthana Road',     13.8897, 100.5634, 0.38, '2025-11-18', '2026-12-10'),
(3,  'Lak Si Drainage Cutover',            'Bangkok',     'Canal Civil',            'in-progress', 'medium',   'Vibhavadi Rangsit Road',   13.8793, 100.5798, 0.36, '2026-02-01', '2026-11-20'),
(4,  'Ram Inthra Pavement Renewal KM4',    'Bangkok',     'Bangkok Roadcare',       'in-progress', 'medium',   'Ram Inthra Road',          13.8584, 100.6435, 0.44, '2025-08-22', '2027-01-18'),
(5,  'Watcharapol Bridge Bearing Repair',  'Bangkok',     'Eastern Bridge Co.',     'planned',     'critical', 'Ram Inthra Road',          13.8594, 100.6734, 0.32, '2026-09-01', '2027-03-20'),
(6,  'Kasetsart Station Footpath Works',   'Bangkok',     'Green Walk JV',          'completed',   'routine',  'Phahonyothin Road',        13.8428, 100.5716, 0.28, '2025-03-12', '2026-02-28'),
(7,  'Lat Phrao Junction Signal Upgrade',  'Bangkok',     'Signal Thai',            'delayed',     'high',     'Ratchadaphisek Road',      13.8067, 100.5744, 0.40, '2025-06-04', '2027-08-30'),
(8,  'Bang Kapi Bus Lane Improvement',     'Bangkok',     'Urban Move',             'in-progress', 'medium',   'Lat Phrao Road',           13.7668, 100.6439, 0.35, '2026-04-11', '2027-01-09'),
(9,  'Hua Mak Stormwater Main',            'Bangkok',     'Waterline Thai',         'delayed',     'high',     'Srinagarindra Road',       13.7358, 100.6418, 0.34, '2025-07-14', '2026-10-22'),
(10, 'Khae Rai Intersection Resurfacing',  'Nonthaburi',  'North Metro Civil',      'in-progress', 'high',     'Ngam Wong Wan Road',       13.8611, 100.5158, 0.35, '2026-03-03', '2027-02-12'),
(11, 'Pak Kret U-turn Closure',            'Nonthaburi',  'RiverSafe Engineering',  'planned',     'medium',   'Tiwanon Road',             13.9104, 100.4977, 0.30, '2026-10-15', '2028-06-01'),
(12, 'Min Buri Flyover Approach',          'Bangkok',     'East Gate Infra',        'in-progress', 'critical', 'Suwinthawong Road',        13.8131, 100.7332, 0.45, '2025-10-01', '2027-07-19'),
(13, 'Don Mueang Tollway Ramp Works',      'Bangkok',     'Skyway Systems',         'completed',   'critical', 'Vibhavadi Rangsit Road',   13.9147, 100.6031, 0.28, '2025-01-08', '2026-02-20'),
(14, 'Muang Thong Access Road Drainage',   'Nonthaburi',  'Lakefront Civil',        'in-progress', 'medium',   'Bond Street Road',         13.9125, 100.5485, 0.34, '2026-01-05', '2027-06-25'),
(15, 'Ratchayothin Bus Stop Rebuild',      'Bangkok',     'Transit Habitat',        'planned',     'routine',  'Phahonyothin Road',        13.8309, 100.5686, 0.28, '2026-09-18', '2027-12-18');

-- ==========================================
-- GRANTS — required because "Automatically expose new tables" was disabled
-- at project creation. service_role must bypass RLS AND have table privileges.
-- Run this if you get "permission denied for table X" (error 42501).
-- ==========================================

grant usage on schema public to service_role, anon, authenticated;
grant all privileges on all tables in schema public to service_role;
grant select on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to service_role, anon, authenticated;

-- Ensure future tables in this schema get the same grants automatically
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;

-- ==========================================
-- MIGRATION 2 — misc contractor-submitted fields that don't warrant their
-- own columns (workType, photoTheme, statusNote, etc). Keeps schema simple
-- per spec principle "avoid unnecessary normalization" while not losing data.
-- ==========================================

alter table projects add column if not exists extra jsonb not null default '{}';

-- MIGRATION 3 — independent Admin construction approval workflow.
-- This is intentionally separate from project status and AI admin_decision.
alter table projects add column if not exists admin_approval_status text not null default 'pending';
alter table projects add column if not exists admin_rejection_reason text;
alter table projects add column if not exists admin_decided_by text;
alter table projects add column if not exists admin_decided_at timestamptz;

do $$
begin
  alter table projects add constraint projects_admin_approval_status_check
    check (admin_approval_status in ('pending', 'approved', 'rejected'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_projects_admin_approval_status
  on projects(admin_approval_status);

-- MIGRATION 4 — citizen star ratings and public project reviews.
-- The opaque citizen identifier is server-issued and never returned publicly.
create table if not exists public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  citizen_identifier uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 3 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, citizen_identifier)
);

create index if not exists idx_project_reviews_project_created
  on public.project_reviews(project_id, created_at desc);

alter table public.project_reviews enable row level security;
drop policy if exists "project_reviews_public_read" on public.project_reviews;
revoke all privileges on table public.project_reviews from anon, authenticated;
grant all privileges on table public.project_reviews to service_role;

-- MIGRATION 5 — Yanang Traveler service-to-service report queue.
-- Keeps Yanang's string report id as the actual primary key for retry safety.
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
