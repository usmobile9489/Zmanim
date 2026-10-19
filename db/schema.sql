-- Zmanim Caller schema (Neon / Postgres)

create table if not exists contacts (
  id serial primary key,
  name text not null,
  phone text not null,
  zip text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id serial primary key,
  name text not null unique
);

create table if not exists group_members (
  group_id int not null references groups(id) on delete cascade,
  contact_id int not null references contacts(id) on delete cascade,
  primary key (group_id, contact_id)
);

create table if not exists schedules (
  id serial primary key,
  name text not null,
  active boolean not null default true,
  recipients jsonb not null default '{"contacts":[],"groups":[]}',
  mode text not null,                -- event | zman | days | daily
  cfg jsonb not null default '{}',   -- time, weekdays, zman, offset, direction, event, daysBefore
  zip text not null default '',
  wording text not null default '',
  repeat int not null default 2,
  pause int not null default 2,
  press_one boolean not null default true,
  voicemail boolean not null default true,
  retry boolean not null default false,
  skip_melacha boolean not null default true,
  skip_chol_hamoed boolean not null default false,
  skip_fasts boolean not null default false,
  blocked_action text not null default 'skip',  -- skip | defer
  next_run_at timestamptz,
  next_meta jsonb,
  last_run_at timestamptz,
  deferred_since timestamptz,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists call_log (
  id serial primary key,
  schedule_id int references schedules(id) on delete set null,
  schedule_name text,
  contact_id int,
  contact_name text,
  phone text,
  status text not null,              -- queued | calling | answered | voicemail | no-answer | busy | failed | skipped | deferred | retry_pending
  reason text,
  message text,
  repeat int not null default 1,
  pause int not null default 2,
  press_one boolean not null default false,
  voicemail boolean not null default true,
  retry boolean not null default false,
  attempt int not null default 1,
  twilio_sid text,
  duration int,
  answered_by text,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists call_log_created_idx on call_log (created_at desc);
create index if not exists call_log_status_idx on call_log (status, scheduled_for);
create index if not exists call_log_sid_idx on call_log (twilio_sid);

create table if not exists zmanim_cache (
  location text not null,
  date date not null,
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (location, date)
);

create table if not exists luach_layouts (
  id serial primary key,
  name text not null,
  config jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists luach_files (
  id serial primary key,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_state (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);
