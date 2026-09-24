-- SynapseVault Database Schema

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  title text not null,
  slug text not null,
  lecture_date date not null default current_date,
  content_markdown text not null,
  author_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  owner_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique(room_id, user_email)
);

create table if not exists public.room_folders (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  parent_id uuid references public.room_folders(id) on delete cascade,
  name text not null,
  folder_type text not null check (folder_type in ('year', 'semester', 'course', 'section', 'project', 'custom')),
  course_code text,
  sort_order integer not null default 0,
  created_by_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.room_notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  folder_id uuid not null references public.room_folders(id) on delete cascade,
  source_note_id uuid references public.notes(id) on delete set null,
  title text not null,
  content_markdown text not null,
  author_email text not null,
  imported_at timestamptz not null default now()
);

create table if not exists public.room_master_summaries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  folder_id uuid not null references public.room_folders(id) on delete cascade unique,
  content_markdown text not null default '',
  version integer not null default 1,
  last_updated_at timestamptz not null default now(),
  updated_by_email text,
  sources_count integer not null default 0,
  model_used text not null default 'gemini-3.8-flash'
);

create table if not exists public.room_project_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  folder_id uuid not null references public.room_folders(id) on delete cascade unique,
  content_markdown text not null default '',
  last_updated_at timestamptz not null default now(),
  updated_by_email text
);

-- Indexes
create index if not exists idx_notes_course_code on public.notes(course_code);
create index if not exists idx_notes_created_at on public.notes(created_at desc);
create index if not exists idx_notes_slug on public.notes(slug);
create index if not exists idx_notes_author on public.notes(author_email);
create index if not exists idx_study_rooms_slug on public.study_rooms(slug);
create index if not exists idx_room_members_user on public.room_members(user_email);
create index if not exists idx_room_members_room on public.room_members(room_id);
create index if not exists idx_room_folders_room on public.room_folders(room_id);
create index if not exists idx_room_folders_parent on public.room_folders(parent_id);
create index if not exists idx_room_notes_folder on public.room_notes(folder_id);
create index if not exists idx_room_notes_room on public.room_notes(room_id);
create index if not exists idx_room_master_folder on public.room_master_summaries(folder_id);

-- Triggers
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
  before update on public.notes
  for each row
  execute function public.handle_updated_at();

-- Row Level Security
alter table public.courses enable row level security;
alter table public.notes enable row level security;
alter table public.study_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_folders enable row level security;
alter table public.room_notes enable row level security;
alter table public.room_master_summaries enable row level security;
alter table public.room_project_logs enable row level security;

-- Policies: Courses
drop policy if exists "Authenticated users can view courses" on public.courses;
create policy "Authenticated users can view courses" on public.courses for select to authenticated using (true);

drop policy if exists "Authenticated users can insert courses" on public.courses;
create policy "Authenticated users can insert courses" on public.courses for insert to authenticated with check (true);

-- Policies: Notes
drop policy if exists "Authenticated users can view notes" on public.notes;
create policy "Authenticated users can view notes" on public.notes for select to authenticated using (true);

drop policy if exists "Authenticated users can insert notes" on public.notes;
create policy "Authenticated users can insert notes" on public.notes for insert to authenticated with check (true);

drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes" on public.notes for update to authenticated
  using (author_email = (auth.jwt() ->> 'email'))
  with check (author_email = (auth.jwt() ->> 'email'));

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes" on public.notes for delete to authenticated
  using (author_email = (auth.jwt() ->> 'email'));

-- Policies: Study Rooms
drop policy if exists "Authenticated users can view study rooms" on public.study_rooms;
create policy "Authenticated users can view study rooms" on public.study_rooms for select to authenticated using (true);

drop policy if exists "Authenticated users can create study rooms" on public.study_rooms;
create policy "Authenticated users can create study rooms" on public.study_rooms for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update study rooms" on public.study_rooms;
create policy "Authenticated users can update study rooms" on public.study_rooms for update to authenticated using (true) with check (true);

-- Policies: Room Members
drop policy if exists "Authenticated users can view room members" on public.room_members;
create policy "Authenticated users can view room members" on public.room_members for select to authenticated using (true);

drop policy if exists "Authenticated users can manage room members" on public.room_members;
create policy "Authenticated users can manage room members" on public.room_members for all to authenticated using (true) with check (true);

-- Policies: Room Folders
drop policy if exists "Authenticated users can view room folders" on public.room_folders;
create policy "Authenticated users can view room folders" on public.room_folders for select to authenticated using (true);

drop policy if exists "Authenticated users can manage room folders" on public.room_folders;
create policy "Authenticated users can manage room folders" on public.room_folders for all to authenticated using (true) with check (true);

-- Policies: Room Notes
drop policy if exists "Authenticated users can view room notes" on public.room_notes;
create policy "Authenticated users can view room notes" on public.room_notes for select to authenticated using (true);

drop policy if exists "Authenticated users can insert room notes" on public.room_notes;
create policy "Authenticated users can insert room notes" on public.room_notes for insert to authenticated with check (true);

drop policy if exists "Authenticated users can manage room notes" on public.room_notes;
create policy "Authenticated users can manage room notes" on public.room_notes for all to authenticated using (true) with check (true);

-- Policies: Room Master Summaries
drop policy if exists "Authenticated users can view master summaries" on public.room_master_summaries;
create policy "Authenticated users can view master summaries" on public.room_master_summaries for select to authenticated using (true);

drop policy if exists "Authenticated users can manage master summaries" on public.room_master_summaries;
create policy "Authenticated users can manage master summaries" on public.room_master_summaries for all to authenticated using (true) with check (true);

-- Policies: Room Project Logs
drop policy if exists "Authenticated users can view project logs" on public.room_project_logs;
create policy "Authenticated users can view project logs" on public.room_project_logs for select to authenticated using (true);

drop policy if exists "Authenticated users can manage project logs" on public.room_project_logs;
create policy "Authenticated users can manage project logs" on public.room_project_logs for all to authenticated using (true) with check (true);

-- Seed Data
insert into public.courses (name, code) values
  ('Gestão', 'GESTA'),
  ('Segurança Informática', 'SEINF'),
  ('Redes e Sistemas de Comunicações', 'REDSC'),
  ('Vibração e Ondas', 'VIBON'),
  ('Sistemas Distribuídos', 'SIDIS'),
  ('Telecomunicações na Aeronáutica', 'STAER'),
  ('Sistemas Gráficos e Interação', 'SGRAI'),
  ('Administração de Sistemas', 'ASSIST')
on conflict (code) do nothing;
