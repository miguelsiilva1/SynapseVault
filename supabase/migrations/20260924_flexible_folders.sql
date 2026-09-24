-- ==============================================================================
-- SynapseVault Migration: Flexible Folders, Project Subfolders & Group Logs
-- ==============================================================================

-- 1. Remove check constraint on folder_type to allow 'section', 'project', and custom subfolders
alter table if exists public.room_folders drop constraint if exists room_folders_folder_type_check;

alter table if exists public.room_folders
  add constraint room_folders_folder_type_check
  check (folder_type in ('year', 'semester', 'course', 'section', 'project', 'custom'));

-- 2. Add created_by_email to room_folders if not present
alter table if exists public.room_folders
  add column if not exists created_by_email text;

-- 3. Tabela de Log de Projeto Colaborativo (Chat / Scratchpad sem IA)
create table if not exists public.room_project_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  folder_id uuid not null references public.room_folders(id) on delete cascade unique,
  content_markdown text not null default '',
  last_updated_at timestamptz not null default now(),
  updated_by_email text
);

create index if not exists idx_room_project_logs_folder on public.room_project_logs(folder_id);

alter table public.room_project_logs enable row level security;

drop policy if exists "Authenticated users can view project logs" on public.room_project_logs;
create policy "Authenticated users can view project logs"
  on public.room_project_logs for select to authenticated using (true);

drop policy if exists "Authenticated users can manage project logs" on public.room_project_logs;
create policy "Authenticated users can manage project logs"
  on public.room_project_logs for all to authenticated using (true) with check (true);
