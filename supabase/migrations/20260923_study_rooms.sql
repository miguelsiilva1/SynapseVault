-- ==============================================================================
-- Migration: 20260923_study_rooms
-- Description: Add Collaborative Study Rooms, Folder Hierarchy, and
--              AI Living Master Summaries for academic peer workspaces.
-- ==============================================================================

-- 1. Study Rooms Table
create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  owner_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Study Room Members
create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique(room_id, user_email)
);

-- 3. Hierarchical Course Folders (Year -> Semester -> Course)
create table if not exists public.room_folders (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  parent_id uuid references public.room_folders(id) on delete cascade,
  name text not null,
  folder_type text not null check (folder_type in ('year', 'semester', 'course')),
  course_code text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Lecture Notes Imported into Rooms
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

-- 5. Living Master Knowledge Summaries
create table if not exists public.room_master_summaries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  folder_id uuid not null references public.room_folders(id) on delete cascade unique,
  content_markdown text not null default '',
  version integer not null default 1,
  last_updated_at timestamptz not null default now(),
  updated_by_email text,
  sources_count integer not null default 0,
  model_used text not null default 'gemini-3.6-flash'
);

-- Indexes for Fast Lookups
create index if not exists idx_study_rooms_slug on public.study_rooms(slug);
create index if not exists idx_room_members_user on public.room_members(user_email);
create index if not exists idx_room_members_room on public.room_members(room_id);
create index if not exists idx_room_folders_room on public.room_folders(room_id);
create index if not exists idx_room_folders_parent on public.room_folders(parent_id);
create index if not exists idx_room_notes_folder on public.room_notes(folder_id);
create index if not exists idx_room_notes_room on public.room_notes(room_id);
create index if not exists idx_room_master_folder on public.room_master_summaries(folder_id);

-- Enable Row Level Security (RLS)
alter table public.study_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_folders enable row level security;
alter table public.room_notes enable row level security;
alter table public.room_master_summaries enable row level security;

-- Security Policies: Study Rooms
drop policy if exists "Authenticated users can view study rooms" on public.study_rooms;
create policy "Authenticated users can view study rooms"
  on public.study_rooms for select to authenticated using (true);

drop policy if exists "Authenticated users can create study rooms" on public.study_rooms;
create policy "Authenticated users can create study rooms"
  on public.study_rooms for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update study rooms" on public.study_rooms;
create policy "Authenticated users can update study rooms"
  on public.study_rooms for update to authenticated using (true) with check (true);

-- Security Policies: Room Members
drop policy if exists "Authenticated users can view room members" on public.room_members;
create policy "Authenticated users can view room members"
  on public.room_members for select to authenticated using (true);

drop policy if exists "Authenticated users can manage room members" on public.room_members;
create policy "Authenticated users can manage room members"
  on public.room_members for all to authenticated using (true) with check (true);

-- Security Policies: Folders
drop policy if exists "Authenticated users can view room folders" on public.room_folders;
create policy "Authenticated users can view room folders"
  on public.room_folders for select to authenticated using (true);

drop policy if exists "Authenticated users can manage room folders" on public.room_folders;
create policy "Authenticated users can manage room folders"
  on public.room_folders for all to authenticated using (true) with check (true);

-- Security Policies: Room Notes
drop policy if exists "Authenticated users can view room notes" on public.room_notes;
create policy "Authenticated users can view room notes"
  on public.room_notes for select to authenticated using (true);

drop policy if exists "Authenticated users can insert room notes" on public.room_notes;
create policy "Authenticated users can insert room notes"
  on public.room_notes for insert to authenticated with check (true);

-- Security Policies: Master Summaries
drop policy if exists "Authenticated users can view master summaries" on public.room_master_summaries;
create policy "Authenticated users can view master summaries"
  on public.room_master_summaries for select to authenticated using (true);

drop policy if exists "Authenticated users can manage master summaries" on public.room_master_summaries;
create policy "Authenticated users can manage master summaries"
  on public.room_master_summaries for all to authenticated using (true) with check (true);
