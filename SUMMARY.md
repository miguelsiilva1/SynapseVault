# Project Summary: SynapseVault

Executive log for tracking build progression, architectural iterations, and current deployment state.

---

## 1. System Scope
Collaborative academic ingestion pipeline and multi-user study space ("Multiplayer NotebookLM"). Converts unstructured academic artifacts (lecture audio streams, slide decks, institutional syllabi, project specifications) into standardized, cross-linked Obsidian Markdown graphs (`.md`) formatted with LaTeX math, callouts, and bidirectional concepts.

---

## 2. Completed Milestones

### Phase 1: Architecture & Feasibility
* Validated multi-tenant academic note graph concept.
* Eliminated server-side audio bottleneck via client-side Web Audio downsampling (PCM downsampling to 16kHz mono, MP3 encoding via LameJS).
* Designed decoupled AI pipeline: Groq Whisper for zero-cost speech-to-text; Gemini Pro/Flash for semantic synthesis and mathematical formatting.
* Formulated threat model: Presigned upload URLs, MIME sniffing, per-user token rate limiting, and PostgreSQL Row-Level Security (RLS).

### Phase 2: Repository Initialization & Tooling
* Project root established at `/Users/miguelsiilva1/Developer/Pessoal/SynapseVault`.
* Base stack configured: Next.js 16 (Turbopack, App Router), React 19, TypeScript, Tailwind CSS.
* Multi-tier documentation initialized (`SUMMARY.md`, `ARCHITECTURE.md`, `README.md`).
* Remote repository synchronized with GitHub (`git@github.com:miguelsiilva1/SynapseVault.git`).

### Phase 3: Core Pipeline & Studio UI Implementation
* **Audio Optimization Engine (`src/lib/audio/compressAudio.ts`):** Client-side Web Audio API pipeline downsampling to 16kHz mono, quantized to Int16, and encoded via LameJS MP3 frame streamer with real-time progress callbacks.
* **Storage Ingestion (`src/lib/storage/r2.ts` & `src/app/api/upload/presign/route.ts`):** Presigned PUT URL generator for direct-to-R2 binary upload, enforcing MIME validation and a 100MB safety ceiling.
* **Text & Audio Processing (`src/lib/pdf/extractText.ts` & `src/lib/ai/groq.ts`):** Server-side PDF digital text extraction (via `unpdf`) and speech-to-text transcription via Groq Whisper (`whisper-large-v3-turbo`).
* **Semantic Synthesis Engine (`src/lib/ai/gemini.ts` & `src/app/api/process/route.ts`):** Gemini prompt orchestration enforcing YAML frontmatter, KaTeX math blocks, semantic callouts, and prompt injection isolation boundaries.

### Phase 4: UI Personalization & Model Expansion
* **Bilingual Output Engine (PT/EN):** Added instant language toggle in the UI and connected language parameter to Gemini system prompts and Whisper transcription language hints.
* **Dynamic Course Creation:** Built modal interface allowing users to define custom courses persisted in `localStorage`.
* **Model Selector Matrix:** Added support for `gemini-3.8-flash` (latest generation default), `gemini-2.5-pro` (deep reasoning), `gemini-2.5-flash`, and custom model identifiers.

### Phase 5: Authentication & Whitelist Access Control
* **Supabase SSR Client Architecture (`src/lib/supabase/`):** Full session lifecycle management using `@supabase/ssr` with Next.js App Router cookies.
* **Whitelist Guard Engine (`src/lib/auth/whitelist.ts` & `src/lib/auth/guard.ts`):** Enforces email and academic domain authorization. Protects backend API endpoints against unauthorized quota exhaustion.
* **Zero-Cost Storage Enforcement:** Automatic execution of `deleteFileFromR2` post-transcription in `/api/process`, ensuring 0 MB persistent R2 usage.

### Phase 6: Study Rooms & Multiplayer Workspace ("Multiplayer NotebookLM")
* **Relational Schema (`supabase/migrations/` & `supabase/schema.sql`):** Designed `study_rooms`, `room_members`, `room_folders`, `room_notes`, `room_master_summaries`, and `room_project_logs` with PostgreSQL Row-Level Security.
* **Study Rooms Dashboard (`src/app/rooms/page.tsx`):** Complete room creation, membership listing, and quick navigation.
* **Room Workspace (`src/app/rooms/[roomId]/page.tsx`):** Workspace environment with resizable sidebar (220px–650px), member management, and dynamic section routing.

### Phase 7: Hierarchical Academic Structure & Teóricas Home Page
* **Academic Folder Tree:** Flexible nested hierarchy: Year (1º/2º/3º Ano) -> Semester (1º/2º Semestre) -> Courses -> Subfolders (`section` for Teóricas, `project` for Practical/Group projects).
* **Teóricas Course Home Page & Syllabus Generator (`/api/rooms/[roomId]/course-syllabus`):** Gemini-powered extraction of institutional course syllabi into an organized Home Page with weekly lecture breakdown.
* **Smart Weekly Routing:** Automatically parses note titles ("Semana 1", "Aula 02") to auto-create and assign notes into corresponding weekly subfolders.
* **Weeks Directory & Lecture Archive:** Dedicated tabs for exploring weekly summaries and browsing all imported lectures.

### Phase 8: Living Master Notes & Collaborative Project Workspace
* **Living Master Note Synthesis (`/api/rooms/[roomId]/master-summary`):** Incremental synthesis compounding newly imported notes into a unified master document, with debounce auto-saving to database.
* **Collaborative Project Hub (`/api/rooms/[roomId]/project-log` & `/api/rooms/[roomId]/project-analysis`):** Shared team scratchpad with real-time log messages and AI-powered project guideline & checklist generator.
* **Personal Notes Ingestion:** Modal to import previously synthesized personal notes or raw Markdown into any study room folder.

### Phase 9: Markdown Visualizer & Lecture Asset Lifecycle
* **KaTeX & Callout Engine (`src/lib/utils/markdownRenderer.ts`):** Preprocesses inline and block LaTeX math (`$`, `$$`) with KaTeX, transforms Obsidian/GitHub callouts (`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, etc.) into styled containers with SVG icons, and cleans wiki-links (`[[Organizações]]` -> bold concept).
* **Folder State Persistence:** Automatically preserves user's tree expansion/collapse choices across reloads (`Ctrl + R`) using `localStorage`.
* **Default Visualizer on Week Selection:** Entering weekly lecture folders opens directly into visualizer mode rather than raw editor.
* **Lecture Note Deletion:** Authorized room creators and note authors can delete imported lecture notes directly from the "Todas as Aulas" tab or the reading modal.

---

## 3. Current State
* [x] Next.js 16 App Router build verified with 0 errors via `npm run build`.
* [x] Client-side audio downsampling utility (`compressAudio.ts`).
* [x] R2 Presigned storage with zero persistent footprint.
* [x] Groq Whisper and PDF text extraction services.
* [x] Gemini 3.8 Flash / 2.5 Pro synthesis with LaTeX and Callout compilation.
* [x] Supabase Auth + Whitelist access control.
* [x] Multiplayer study rooms with hierarchical folders and living master notes.
* [x] Teóricas Home Page and AI course syllabus synthesizer.
* [x] Interactive markdown visualizer with KaTeX math and callouts.
* [x] Lecture deletion and week default view mode implemented.
* [ ] UI Redesign and aesthetic modernization.

---

## 4. Next Step
Iterate on visual design and user interface layout based on UI generation AI proposals.
