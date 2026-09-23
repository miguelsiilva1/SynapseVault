# Project Summary: SynapseVault

Executive log for tracking build progression, architectural iterations, and current deployment state.

---

## 1. System Scope
Collaborative ingestion pipeline and synthesis platform. Converts unstructured academic artifacts (lecture audio streams, slide decks, syllabi, project specifications) into standardized, cross-linked Obsidian Markdown graphs (`.md`) formatted with LaTeX, Callouts, and Wikilinks.

---

## 2. Completed Milestones

### Phase 1: Architecture & Feasibility
* Validated multi-tenant academic note graph concept.
* Eliminated server-side audio bottleneck via client-side Web Audio downsampling (PCM downsampling to 16kHz mono, MP3 encoding via LameJS).
* Designed decoupled AI pipeline: Groq Whisper for zero-cost speech-to-text; Gemini Pro/Flash for semantic synthesis and mathematical formatting.
* Formulated threat model: Presigned upload URLs, MIME sniffing, per-user token rate limiting, and PostgreSQL Row-Level Security (RLS).

### Phase 2: Repository Initialization & Tooling
* Project root established at `/Users/miguelsiilva1/Developer/Pessoal/SynapseVault`.
* Base stack configured: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS.
* Agent files (`AGENTS.md`, `CLAUDE.md`) eliminated and excluded in `.gitignore`.
* Multi-tier documentation initialized (`SUMMARY.md`, `ARCHITECTURE.md`, `README.md`).
* Remote repository synchronized with GitHub (`git@github.com:miguelsiilva1/SynapseVault.git`).

### Phase 3: Core Pipeline & Studio UI Implementation
* **Audio Optimization Engine (`src/lib/audio/compressAudio.ts`):** Client-side Web Audio API pipeline downsampling to 16kHz mono, quantized to Int16, and encoded via LameJS MP3 frame streamer. Includes thread-yielding execution and real-time progress callbacks.
* **Storage Ingestion (`src/lib/storage/r2.ts` & `src/app/api/upload/presign/route.ts`):** Presigned PUT URL generator for direct-to-R2 binary upload, enforcing MIME validation and a 100MB safety ceiling.
* **Text & Audio Processing (`src/lib/pdf/extractText.ts` & `src/lib/ai/groq.ts`):** Server-side PDF digital text extraction (via `unpdf`) and speech-to-text transcription via Groq Whisper (`whisper-large-v3-turbo`).
* **Semantic Synthesis Engine (`src/lib/ai/gemini.ts` & `src/app/api/process/route.ts`):** Gemini prompt orchestration enforcing YAML frontmatter, KaTeX math blocks, semantic callouts, and prompt injection isolation boundaries.

### Phase 4: UI Personalization & Model Expansion
* **Bilingual Output Engine (PT/EN):** Added instant language toggle in the UI and connected language parameter to Gemini system prompts and Whisper transcription language hints.
* **Dynamic Course Creation:** Built modal interface allowing users to define custom courses (e.g., "Sistemas Operativos [SO]" or "Machine Learning [ML]") persisted in `localStorage`.
* **Model Selector Matrix:** Added support for `gemini-3.8-flash` (latest generation default), `gemini-2.5-pro` (deep reasoning), `gemini-2.5-flash`, and custom model identifiers.
* **Production Build & Dev Server:** Development server running at `http://localhost:3000` with 0 TypeScript/build errors.

---

## 3. Current State
* [x] Next.js 15 App Router boilerplate with strict TypeScript.
* [x] Client-side audio downsampling utility (`compressAudio.ts`).
* [x] R2 Presigned URL storage infrastructure.
* [x] Groq Whisper and PDF text extraction services.
* [x] Gemini 3.8 Flash / 2.5 Pro synthesis engine with injection containment.
* [x] Bilingual studio UI (Portuguese / English).
* [x] Dynamic course creation with client persistence.
* [x] Clean compilation verified via `npx tsc` and `curl http://localhost:3000 -> 200 OK`.
* [ ] Supabase database migrations and user authentication.
* [ ] Obsidian sync / local vault direct export helper.

---

## 4. Next Step
Stage and commit Phase 4 enhancements, and provide `.env.local` credentials for live end-to-end processing.
