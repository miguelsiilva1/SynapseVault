-- ==============================================================================
-- SynapseVault: Supabase PostgreSQL Production DDL Schema
-- ==============================================================================

-- 1. Tabela de Cadeiras Académicas
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- 2. Tabela de Notas Sintetizadas (Obsidian Markdown)
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

-- Índices de Desempenho e Pesquisa
create index if not exists idx_notes_course_code on public.notes(course_code);
create index if not exists idx_notes_created_at on public.notes(created_at desc);
create index if not exists idx_notes_slug on public.notes(slug);
create index if not exists idx_notes_author on public.notes(author_email);

-- Trigger para atualização automática de updated_at
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

-- Ativar Row Level Security (RLS)
alter table public.courses enable row level security;
alter table public.notes enable row level security;

-- ==============================================================================
-- Políticas de Segurança (Row Level Security)
-- ==============================================================================

-- Políticas: Cadeiras
drop policy if exists "Authenticated users can view courses" on public.courses;
create policy "Authenticated users can view courses"
  on public.courses for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert courses" on public.courses;
create policy "Authenticated users can insert courses"
  on public.courses for insert
  to authenticated
  with check (true);

-- Políticas: Notas
drop policy if exists "Authenticated users can view notes" on public.notes;
create policy "Authenticated users can view notes"
  on public.notes for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert notes" on public.notes;
create policy "Authenticated users can insert notes"
  on public.notes for insert
  to authenticated
  with check (true);

drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes"
  on public.notes for update
  to authenticated
  using (author_email = (auth.jwt() ->> 'email'))
  with check (author_email = (auth.jwt() ->> 'email'));

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes"
  on public.notes for delete
  to authenticated
  using (author_email = (auth.jwt() ->> 'email'));

-- ==============================================================================
-- Dados Iniciais (Cadeiras Base)
-- ==============================================================================
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
