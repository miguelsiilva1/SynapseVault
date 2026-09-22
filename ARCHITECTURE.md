# Technical Architecture Specification: SynapseVault

Low-level systems design document detailing data contracts, token economics, security constraints, and Obsidian integration standards.

---

## 1. System Architecture

Decouple heavy I/O ingestion from cognitive LLM operations. Prevent large binary transfers through serverless function runtimes.

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Browser)"]
        UI["Web UI (Next.js / Tailwind)"]
        AudioProcessor["Web Audio API + LameJS\n(16kHz Mono Downsampler)"]
        ObsidianSync["Obsidian Client"]
    end

    subgraph Storage ["Object & Relational Storage"]
        R2["Cloudflare R2 (S3-Compatible)\nDirect PUT via Presigned URL"]
        SupabaseDB["PostgreSQL (Supabase)\nAuth, Metadata, Notes, RLS"]
    end

    subgraph Backend ["Backend Orchestration (Next.js API)"]
        UploadSigner["Presigned URL Generator"]
        PipelineWorker["Pipeline Orchestrator"]
        PDFParser["Text Stream Extractor (pdf-parse)"]
    end

    subgraph AI ["AI Inference Layer"]
        GroqWhisper["Groq Whisper API\n(Low-latency STT, ~12s/90min)"]
        GeminiPro["Gemini Pro API\n(Structured Synthesis, LaTeX, Markdown)"]
    end

    UI -->|1. Raw Audio File| AudioProcessor
    AudioProcessor -->|2. Compressed MP3 (~8MB)| UI
    UI -->|3. Request Presigned URL| UploadSigner
    UploadSigner -->|4. Signed PUT URL| UI
    UI -->|5. Direct Binary Upload| R2

    UI -->|6. Trigger Processing Job| PipelineWorker
    PipelineWorker -->|Fetch Audio Stream| R2
    PipelineWorker -->|Dispatch Audio| GroqWhisper
    GroqWhisper -->|Raw Transcript| PipelineWorker

    PipelineWorker -->|Extract Text| PDFParser
    PDFParser -->|Parsed Slide Text| PipelineWorker

    PipelineWorker -->|Structured Text Payload| GeminiPro
    GeminiPro -->|Obsidian-Formatted Markdown| PipelineWorker
    PipelineWorker -->|Persist Metadata & Output| SupabaseDB
    SupabaseDB -->|Sync / Export .md| ObsidianSync
```

---

## 2. Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| Framework | Next.js 15+ (App Router) | Unified server/client routing, edge middleware, static/dynamic hybrid execution. |
| Language | TypeScript (Strict mode) | End-to-end schema consistency across client, API, and DB boundaries. |
| Styling | Tailwind CSS | Zero runtime CSS overhead, rapid utility-driven layout. |
| Client Audio Processing | Web Audio API + `@breezystack/lamejs` | Eliminates upload bandwidth consumption (80MB -> 8MB) without server CPU cost. |
| Speech-to-Text | Groq Whisper (Whisper-large-v3) | Low latency (~12s per 90-minute audio), eliminates raw audio token overhead on LLM. |
| Reasoning & Synthesis | Google Gemini Pro | 2M token context window, robust LaTeX compilation, deterministic schema generation. |
| Object Storage | Cloudflare R2 | S3 API compliance, zero egress fees, supports multipart and 5GB direct uploads. |
| Database & Identity | Supabase (PostgreSQL 15+) | Row-Level Security, native JWT validation, relational grouping for academic courses. |

---

## 3. Token Economics & Quota Optimization

Direct ingestion of audio files into multimodal LLMs consumes approximately 32 tokens per second:
* 90 minutes raw audio: $5400 \times 32 \approx 172,800 \text{ tokens}$.
* 90 minutes transcribed text: $\approx 15,000 \text{ words} \approx 20,000 \text{ tokens}$.
* Overall token reduction: **~88% savings on input token allocation**.

### PDF Parsing Strategy
* Extract selectable digital text via server-side stream parser (`pdf-parse`).
* Average 60-slide academic deck in text mode: $\approx 3,000 - 5,000 \text{ tokens}$.
* Avoid rendering slides as images unless equations or diagrams lack text representations.

---

## 4. Database Schema (PostgreSQL DDL)

```sql
create extension if not exists "uuid-ossp";

-- User Profiles
create table profiles (
    id uuid primary key references auth.users on delete cascade,
    name text not null,
    email text unique not null,
    api_token uuid default gen_random_uuid() unique,
    created_at timestamptz default now()
);

-- Academic Courses
create table courses (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    code text not null,
    semester int check (semester in (1, 2)),
    academic_year text not null,
    color text default '#6366f1',
    created_at timestamptz default now()
);

-- Course Materials (R2 pointers)
create table materials (
    id uuid primary key default gen_random_uuid(),
    course_id uuid references courses(id) on delete cascade,
    uploader_id uuid references profiles(id) on delete set null,
    title text not null,
    type text not null check (type in ('audio', 'slides', 'specification', 'notes')),
    file_url text not null,
    file_size bigint,
    status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    created_at timestamptz default now()
);

-- Synthesized Obsidian Notes
create table notes (
    id uuid primary key default gen_random_uuid(),
    course_id uuid references courses(id) on delete cascade,
    material_id uuid references materials(id) on delete set null,
    title text not null,
    slug text not null,
    type text default 'lecture' check (type in ('lecture', 'project_breakdown', 'cheat_sheet')),
    lecture_date date,
    content_markdown text not null,
    frontmatter jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Academic Group Projects
create table projects (
    id uuid primary key default gen_random_uuid(),
    course_id uuid references courses(id) on delete cascade,
    title text not null,
    deadline timestamptz,
    specification_url text,
    status text default 'planning' check (status in ('planning', 'in_progress', 'completed')),
    created_at timestamptz default now()
);

-- Project Tasks (Obsidian Tasks / Kanban compatible)
create table project_tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references projects(id) on delete cascade,
    title text not null,
    description text,
    assigned_to uuid references profiles(id) on delete set null,
    status text default 'todo' check (status in ('todo', 'in_progress', 'done')),
    priority text default 'medium' check (priority in ('low', 'medium', 'high')),
    due_date date,
    created_at timestamptz default now()
);
```

---

## 5. Output Specification (Obsidian Vault Standard)

Generated Markdown documents must satisfy the following constraints:

1. **YAML Frontmatter:**
   ```yaml
   ---
   id: "<uuid>"
   course: "[[Distributed Systems]]"
   code: "DS"
   type: "lecture-summary"
   date: 2026-09-22
   topics: [consensus, raft, fault-tolerance]
   tags: [academic, ds, lecture]
   ---
   ```
2. **Semantic Callouts:**
   * `> [!NOTE]` for executive overviews and contextual definitions.
   * `> [!IMPORTANT]` for recurring exam questions and core requirements.
   * `> [!WARNING]` for edge cases and conceptual pitfalls.
3. **Mathematical Notation:**
   * Inline LaTeX: `$N \ge 2f + 1$`
   * Block LaTeX:
     $$
     S = \sum_{i=1}^{n} \frac{1}{i^2}
     $$
4. **Graph Linkage:**
   * Automated bidirectional references: `[[Lecture 02 - Logical Clocks]]`.

---

## 6. Threat Model & Security Controls

1. **Presigned Upload Authorization:**
   * Upload credentials are scoped per file, restricted to `PUT` operations, and expire after 900 seconds.
2. **Payload Validation:**
   * Magic bytes header inspection to verify true MIME types before ingestion.
   * Hard limits: Audio $\le 30\text{MB}$ post-compression; PDF $\le 25\text{MB}$.
3. **Rate Limiting:**
   * Sliding window limiter via Redis or edge middleware (max 5 synthesis jobs per hour per user).
4. **Prompt Injection Containment:**
   * Raw text isolated inside structural XML boundaries (`<lecture_transcript>`, `<slide_content>`).
   * Explicit system instructions enforcing strict factual derivation; user documents treated as passive data streams.
