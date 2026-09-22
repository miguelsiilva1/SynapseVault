# SynapseVault

Collaborative academic ingestion and synthesis engine. Converts university lecture audio streams, slides, and project specifications into cross-linked Obsidian Markdown graphs.

---

## Capabilities

* Client-side audio processing via Web Audio API and LameJS (downsampling to 16kHz mono MP3, reducing payload sizes from >80MB to <8MB).
* Decoupled AI pipeline using Groq Whisper for speech-to-text and Google Gemini Pro for mathematical reasoning, LaTeX formatting, and structural synthesis.
* Direct-to-storage binary upload utilizing Cloudflare R2 presigned URLs.
* Standardized Obsidian output schema including YAML frontmatter, semantic callouts, KaTeX blocks, and automated wikilinks.
* Multi-user academic course spaces backed by PostgreSQL and Row-Level Security.

---

## Technical Documentation

* [Project Summary (`SUMMARY.md`)](./SUMMARY.md): Execution progress log and milestone tracker.
* [Technical Architecture (`ARCHITECTURE.md`)](./ARCHITECTURE.md): Systems design, data contracts, token economics, and threat mitigation.

---

## Stack

* Runtime: Node.js 26+ / Next.js 15+ (App Router)
* Language: TypeScript (Strict mode)
* Styling: Tailwind CSS
* AI & Speech: Google Gemini Pro, Groq Whisper
* Audio Processing: Web Audio API, `@breezystack/lamejs`
* Storage: Cloudflare R2 (S3-compatible)
* Database: Supabase (PostgreSQL 15+)

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
