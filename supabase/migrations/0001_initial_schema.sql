create extension if not exists "pgcrypto";

-- Companies
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active bool not null default true,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Locations
create table locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  address text,
  slug text not null,
  timezone text not null default 'America/Denver',
  is_hiring bool not null default true,
  manager_user_id uuid references auth.users(id),
  active_question_set_id uuid,
  slot_shortage_sms_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id, slug)
);

-- User profiles
create table profiles (
  id uuid primary key references auth.users(id),
  company_id uuid not null references companies(id),
  location_id uuid references locations(id),
  role text not null check (role in ('company_admin', 'location_manager')),
  name text not null,
  phone text unique,
  notification_prefs jsonb not null default
    '{"sms_interview_reminder": true, "sms_post_interview_prompt": true}',
  calendar_token_encrypted text,
  calendar_token_created_at timestamptz
);

-- Question sets
create table question_sets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  job_title text not null,
  pass_threshold int not null default 70 check (pass_threshold between 0 and 100),
  is_active bool not null default true,
  created_at timestamptz not null default now()
);

alter table locations add constraint locations_active_question_set_id_fkey
  foreign key (active_question_set_id) references question_sets(id);

-- Questions
create table questions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references question_sets(id) on delete cascade,
  type text not null check (type in ('hard_filter', 'scored', 'informational')),
  variants text[] not null check (array_length(variants, 1) between 1 and 4),
  rubric text,
  weight int not null default 1 check (weight between 1 and 5),
  fail_value text,
  order_index int not null default 0,
  deleted_at timestamptz
);

-- Shifts
create table shifts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  label text,
  is_critical bool not null default false
);

-- Applicants
create table applicants (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  email text,
  name text not null,
  sms_opted_out bool not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Applications
create table applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id),
  company_id uuid not null references companies(id),
  location_id uuid not null references locations(id),
  question_set_id uuid not null references question_sets(id),
  availability jsonb not null,
  has_transportation bool not null,
  status text not null default 'applied' check (status in (
    'applied','sms_sent','screen_link_clicked','screening','screen_complete',
    'passed','failed','scheduled','interviewed','hired','no_show','rejected'
  )),
  source text not null default 'direct',
  is_overridden bool not null default false,
  override_reason text,
  created_at timestamptz not null default now()
);

-- Magic links
create table magic_links (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('screen', 'schedule')),
  application_id uuid not null references applications(id),
  token text not null unique,
  expires_at timestamptz,
  clicked_at timestamptz,
  completed_at timestamptz,
  used_at timestamptz,
  earliest_bookable timestamptz,
  is_reschedule bool not null default false,
  replaces_interview_id uuid,
  reminder_4h_sent bool not null default false,
  reminder_20h_sent bool not null default false,
  created_at timestamptz not null default now()
);

-- Screen calls
create table screen_calls (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  screen_link_id uuid not null references magic_links(id),
  vapi_call_id text unique,
  status text not null default 'initiated' check (status in
    ('initiated','in_progress','completed','failed','disconnected')),
  transcript text,
  inflection_notes text,
  started_at timestamptz,
  ended_at timestamptz,
  cost_usd numeric(10,4)
);

-- Screen answers
create table screen_answers (
  id uuid primary key default gen_random_uuid(),
  screen_call_id uuid not null references screen_calls(id),
  question_id uuid not null references questions(id),
  answer_text text not null,
  score int check (score between 0 and 100),
  ai_reasoning text,
  order_index int not null default 0,
  unique(screen_call_id, question_id)
);

-- Screen results
create table screen_results (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id),
  passed bool not null,
  hard_fail_question_id uuid references questions(id),
  hard_fail_answer text,
  qualitative_summary text not null,
  manager_briefing text,
  scores_json jsonb not null default '{}',
  total_score int not null default 0,
  threshold_at_time int not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Interview slots
create table interview_slots (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  manager_user_id uuid not null references auth.users(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_available bool not null default true,
  google_event_id text,
  created_at timestamptz not null default now()
);

-- Interviews
create table interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  slot_id uuid not null references interview_slots(id),
  status text not null default 'scheduled' check (status in
    ('scheduled','completed','no_show','cancelled','rescheduled')),
  manager_rating text check (manager_rating in ('thumbs_up','thumbs_down','maybe')),
  rescheduled_from_id uuid references interviews(id),
  google_event_id text,
  reminder_day_before_sent bool not null default false,
  reminder_1h_before_sent bool not null default false,
  fit_prompt_sent bool not null default false,
  created_at timestamptz not null default now()
);

-- Talent pool
create table talent_pool (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id),
  location_id uuid not null references locations(id),
  tag text not null check (tag in
    ('didnt_engage','failed_screen','passed_no_schedule','no_show','future_opening')),
  added_at timestamptz not null default now(),
  notified_at timestamptz,
  unique(applicant_id, location_id)
);

-- Retention check-ins
create table retention_checkins (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  period_days int not null check (period_days in (30, 60, 90)),
  scheduled_for date not null,
  sent_at timestamptz,
  is_retained bool,
  responded_at timestamptz,
  unique(application_id, period_days)
);

-- Inbound events (outbox for Vapi/Twilio webhooks)
create table inbound_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('vapi', 'twilio')),
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  failed_at timestamptz,
  error_text text,
  retry_count int not null default 0
);

-- SMS log
create table sms_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id),
  to_phone text not null,
  message_type text not null,
  direction text not null default 'outbound' check (direction in ('outbound','inbound')),
  twilio_sid text,
  status text,
  cost_usd numeric(10,4),
  created_at timestamptz not null default now()
);

-- Pending SMS (quiet-hours queue)
create table pending_sms (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id),
  to_phone text not null,
  body text not null,
  message_type text not null,
  timezone text not null,
  send_after timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Scheduled calls (callback-later feature)
create table scheduled_calls (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  screen_link_id uuid not null references magic_links(id),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','initiated','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- book_slot RPC: advisory lock prevents application-level double-booking
create or replace function book_slot(
  p_slot_id uuid,
  p_application_id uuid
) returns uuid language plpgsql as $$
declare v_interview_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_application_id::text));
  if exists (select 1 from interviews where application_id = p_application_id and status = 'scheduled') then
    raise exception 'Already booked' using errcode = 'P0010';
  end if;
  update interview_slots set is_available = false where id = p_slot_id and is_available = true;
  if not found then raise exception 'Slot taken' using errcode = 'P0011'; end if;
  insert into interviews (application_id, slot_id, status)
  values (p_application_id, p_slot_id, 'scheduled') returning id into v_interview_id;
  return v_interview_id;
end; $$;

-- get_screen_sla_stats RPC: speed-to-call metrics for dashboard
create or replace function get_screen_sla_stats(p_location_id uuid)
returns table(median_minutes numeric, pct_under_10_min numeric)
language sql as $$
  select
    round(cast(percentile_cont(0.5) within group (
      order by extract(epoch from (sc.started_at - a.created_at))/60
    ) as numeric), 1) as median_minutes,
    round(100.0 * count(*) filter (
      where extract(epoch from (sc.started_at - a.created_at)) < 600
    ) / nullif(count(*), 0), 1) as pct_under_10_min
  from screen_calls sc
  join applications a on a.id = sc.application_id
  where a.location_id = p_location_id
    and sc.started_at is not null
    and a.created_at > now() - interval '7 days'
$$;

-- Indexes
create index on applications(applicant_id);
create index on applications(location_id, status);
create index on applications(company_id, created_at desc);
create index on magic_links(token);
create index on magic_links(application_id, type);
create index on screen_calls(vapi_call_id);
create index on screen_calls(application_id);
create index on interview_slots(location_id, start_time) where is_available = true;
create index on talent_pool(location_id, tag);
create index on sms_log(application_id);
create index on sms_log(twilio_sid);
create index on inbound_events(processed_at, failed_at, retry_count);
create index on scheduled_calls(scheduled_for, status);

-- Enable RLS on all tables
alter table companies enable row level security;
alter table locations enable row level security;
alter table profiles enable row level security;
alter table question_sets enable row level security;
alter table questions enable row level security;
alter table shifts enable row level security;
alter table applicants enable row level security;
alter table applications enable row level security;
alter table magic_links enable row level security;
alter table screen_calls enable row level security;
alter table screen_answers enable row level security;
alter table screen_results enable row level security;
alter table interview_slots enable row level security;
alter table interviews enable row level security;
alter table talent_pool enable row level security;
alter table retention_checkins enable row level security;
alter table inbound_events enable row level security;
alter table sms_log enable row level security;
alter table pending_sms enable row level security;
alter table scheduled_calls enable row level security;

-- RLS Policies

-- companies: company_admin only
create policy "company_admin_companies" on companies for all using (
  id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
);

-- locations
create policy "manager_locations" on locations for all using (
  manager_user_id = auth.uid()
  or company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
);

-- profiles: own row only
create policy "own_profile" on profiles for all using (id = auth.uid());

-- question_sets
create policy "manager_question_sets" on question_sets for all using (
  company_id in (select company_id from profiles where id = auth.uid())
);

-- questions
create policy "manager_questions" on questions for all using (
  question_set_id in (
    select id from question_sets
    where company_id in (select company_id from profiles where id = auth.uid())
  )
);

-- shifts
create policy "manager_shifts" on shifts for all using (
  location_id in (select id from locations where manager_user_id = auth.uid())
  or location_id in (
    select id from locations
    where company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- applicants: via applications at manager's location
create policy "manager_applicants" on applicants for all using (
  id in (
    select applicant_id from applications
    where location_id in (select id from locations where manager_user_id = auth.uid())
    or company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- applications
create policy "manager_applications" on applications for all using (
  location_id in (select id from locations where manager_user_id = auth.uid())
  or company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
);

-- magic_links: via application
create policy "manager_magic_links" on magic_links for all using (
  application_id in (
    select id from applications
    where location_id in (select id from locations where manager_user_id = auth.uid())
    or company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- screen_calls
create policy "manager_screen_calls" on screen_calls for all using (
  application_id in (
    select id from applications
    where location_id in (select id from locations where manager_user_id = auth.uid())
    or company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- screen_answers
create policy "manager_screen_answers" on screen_answers for all using (
  screen_call_id in (
    select sc.id from screen_calls sc
    join applications a on a.id = sc.application_id
    where a.location_id in (select id from locations where manager_user_id = auth.uid())
    or a.company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- screen_results
create policy "manager_screen_results" on screen_results for all using (
  application_id in (
    select id from applications
    where location_id in (select id from locations where manager_user_id = auth.uid())
    or company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- interview_slots
create policy "manager_interview_slots" on interview_slots for all using (
  location_id in (select id from locations where manager_user_id = auth.uid())
  or location_id in (
    select id from locations
    where company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- interviews
create policy "manager_interviews" on interviews for all using (
  application_id in (
    select id from applications
    where location_id in (select id from locations where manager_user_id = auth.uid())
    or company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- talent_pool
create policy "manager_talent_pool" on talent_pool for all using (
  location_id in (select id from locations where manager_user_id = auth.uid())
  or location_id in (
    select id from locations
    where company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- retention_checkins
create policy "manager_retention_checkins" on retention_checkins for all using (
  application_id in (
    select id from applications
    where location_id in (select id from locations where manager_user_id = auth.uid())
    or company_id = (select company_id from profiles where id = auth.uid() and role = 'company_admin')
  )
);

-- inbound_events, sms_log, pending_sms, scheduled_calls: service-role only
-- No user-facing SELECT policy — these tables are accessed only via service-role client in webhooks/crons
