# SynapseVault

Collaborative academic ingestion and synthesis engine. Converts university lecture audio streams, slides, and project specifications into cross-linked Obsidian Markdown graphs, with collaborative multi-user study rooms and living syntheses.

---

## Core Capabilities

### 1. Ingestion Pipeline & Audio Downsampling
* Client-side audio processing via Web Audio API and LameJS (downsampling to 16kHz mono MP3, reducing payload sizes from >80MB to <8MB).
* Direct-to-storage binary upload utilizing Cloudflare R2 presigned URLs with automatic post-transcription zero-cost purge.
* Decoupled AI pipeline using Groq Whisper (`whisper-large-v3-turbo`) for high-speed speech-to-text and Google Gemini (3.8 Flash / 2.5 Pro) for mathematical reasoning and LaTeX formatting.
* Digital PDF text extraction directly from lecture slide decks via `unpdf`.

### 2. Collaborative Study Rooms ("Multiplayer NotebookLM")
* Multi-user academic course spaces backed by PostgreSQL and Row-Level Security (RLS) on Supabase.
* Strict Whitelist & Authentication (Google OAuth & Email Magic Links) with academic domain verification.
* Flexible hierarchical folder tree: **Year -> Semester -> Course -> Sections / Projects / Weekly Lectures**, with drag-resizable sidebar and session-persisted folder expansion states (`localStorage`).

### 3. Teóricas Home Page & Syllabus AI Synthesizer
* Course Home Page generator with AI syllabus synthesis from institutional syllabi/PDFs.
* Smart lecture routing: automatically detects lecture weeks ("Semana 1", "Aula 3") and organizes materials into categorized subfolders.
* Comprehensive "Weeks Directory" and "All Lectures" index views.

### 4. Living Master Notes & Collaborative Project Workspace
* **Living Master Note**: Incremental AI synthesis across all imported lecture notes within a folder, with auto-save scratchpad and single-click toggle to visualizer mode.
* **Interactive Markdown Visualizer**: Full KaTeX LaTeX math support (`$$...$$` and `$...$`), Obsidian/GitHub callouts (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, etc.), and clean wiki-link syntax rendering (`[[Concept]]`).
* **Collaborative Project Hub**: Shared Markdown log/scratchpad for team projects with message timestamping, plus AI-powered project guideline & checklist generation.
* **Lecture Note Management**: Direct Markdown import, personal note library ingestion, full reading modal, and note deletion (restricted to room owners and authors).

---

## Technical Documentation

* [Project Summary (`SUMMARY.md`)](./SUMMARY.md): Execution progress log and milestone tracker.
* [Technical Architecture (`ARCHITECTURE.md`)](./ARCHITECTURE.md): Systems design, data contracts, token economics, and threat mitigation.

---

## Stack

* **Runtime:** Node.js 20+ / Next.js 16 (Turbopack, App Router)
* **Language:** TypeScript (Strict mode)
* **Styling:** Tailwind CSS, Lucide Icons, KaTeX CSS
* **AI & Speech:** Google Gemini (3.8 Flash / 2.5 Pro), Groq Whisper (`whisper-large-v3-turbo`)
* **Audio Processing:** Web Audio API, `@breezystack/lamejs`
* **Storage:** Cloudflare R2 (S3-compatible, presigned PUT/DELETE)
* **Database & Auth:** Supabase (PostgreSQL 15+, Row-Level Security, `@supabase/ssr`)
* **Markdown & Math Rendering:** `marked`, `katex`

---

## Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy template and populate secrets:
```bash
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```

Server binds to `http://localhost:3000`.
