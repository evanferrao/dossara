# Dossara — Intelligent Document Chat

> A full-stack RAG (Retrieval-Augmented Generation) application that lets users upload PDF documents and have AI-powered conversations about their contents, with inline source citations and page references.

---

## Elevator Pitch

Dossara is a document intelligence platform built with Next.js 16 that implements a complete RAG pipeline: users upload PDFs, the system extracts text, generates vector embeddings using a local transformer model, stores them in a Postgres vector database (Supabase + pgvector), and enables natural-language Q&A over the documents with cited, page-level references — all streamed in real time via Groq's LLM API.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) | Full-stack React framework with API routes |
| **Language** | TypeScript | End-to-end type safety |
| **Frontend** | React 19, Tailwind CSS 4 | UI with responsive two-pane layout |
| **Typography** | Inter + JetBrains Mono (Google Fonts) | Modern, clean typography |
| **AI/LLM** | Groq API (Llama 3.1 8B / Llama 3.3 70B) | Fast LLM inference for chat responses |
| **AI SDK** | Vercel AI SDK v7 (`ai`, `@ai-sdk/react`, `@ai-sdk/groq`) | Streaming chat, message handling, transport layer |
| **Embeddings** | `@xenova/transformers` (all-MiniLM-L6-v2) | Local 384-dim sentence embeddings — no external API calls |
| **ONNX Runtime** | `onnxruntime-node` (native glibc build) | Hardware-accelerated inference for the transformer model |
| **PDF Processing** | `unpdf` + `pdfjs-dist` | Server-side text extraction from uploaded PDFs |
| **PDF Viewing** | `react-pdf` | Client-side PDF rendering with page navigation |
| **Image Processing** | `sharp` | Image optimization (Next.js dependency) |
| **Database** | Supabase (PostgreSQL + pgvector) | Documents, chunks, chat history, vector similarity search |
| **Storage** | Supabase Storage | PDF file storage with presigned upload/download URLs |
| **Containerization** | Docker (multi-stage, standalone output) | Production deployment with optimized image |
| **Orchestration** | Docker Compose | Single-command deployment with security hardening |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React 19)                  │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ Document Panel│  │         Chat Panel               │ │
│  │  - Upload     │  │  - Message history               │ │
│  │  - PDF viewer │  │  - Streaming responses           │ │
│  │  - Doc list   │  │  - Citation badges → PDF jumps   │ │
│  │  - Progress   │  │  - Model selector (fast/versatile│ │
│  └──────┬───────┘  └──────────┬───────────────────────┘ │
│         │ x-workspace-id      │ x-workspace-id          │
└─────────┼─────────────────────┼─────────────────────────┘
          │                     │
          ▼                     ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (Server)                │
│                                                         │
│  /api/upload-url      → Presigned upload URL            │
│  /api/process-document→ PDF → text → chunks → embed     │
│  /api/document-url    → Presigned download URL          │
│  /api/document-status → Processing progress             │
│  /api/documents       → List / delete documents         │
│  /api/chat            → RAG pipeline + LLM streaming    │
│  /api/chat-history    → Load / clear history            │
│                                                         │
│  ┌─────────────────┐  ┌────────────────────────────┐   │
│  │ Rate Limiter     │  │ Embedding Pipeline         │   │
│  │ (in-memory Map)  │  │ @xenova/transformers       │   │
│  │ per-IP, per-day  │  │ all-MiniLM-L6-v2 (384-dim)│   │
│  └─────────────────┘  └────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL)                   │
│                                                         │
│  documents   → id, workspace_id, filename, status, ...  │
│  chunks      → id, document_id, content, embedding,     │
│                page_number (HNSW index on embedding)     │
│  chat_messages→ id, workspace_id, role, content,        │
│                 citations (JSONB)                        │
│                                                         │
│  match_chunks() → pgvector cosine similarity RPC        │
│  Storage bucket → PDF file storage                      │
└─────────────────────────────────────────────────────────┘
```

---

## Features

### 1. PDF Upload & Processing Pipeline
- **Drag-and-drop upload** with progress indicator
- Files are uploaded directly to Supabase Storage via **presigned URLs** (no server relay, reducing bandwidth costs)
- Server-side text extraction using `unpdf` (built on `pdfjs-dist`)
- **Batched processing** with a configurable cursor — if processing is interrupted, it resumes from where it left off
- Processing status is tracked in the database and polled by the frontend to show real-time progress

### 2. RAG (Retrieval-Augmented Generation) Pipeline
The core intelligence of the application:

1. **Chunking** — Extracted page text is split into overlapping chunks (~2000 chars with 200-char overlap) using sentence-boundary-aware splitting to avoid cutting mid-sentence
2. **Embedding** — Each chunk is embedded into a 384-dimensional vector using the `all-MiniLM-L6-v2` model running **locally on the server** via `@xenova/transformers` + `onnxruntime-node` — no external embedding API calls
3. **Storage** — Chunks and their embeddings are stored in Supabase with an **HNSW index** for fast approximate nearest-neighbor search
4. **Retrieval** — When the user asks a question, their query is embedded and the top-K most similar chunks are retrieved via a **pgvector cosine similarity RPC** (`match_chunks`)
5. **Generation** — Retrieved passages are injected into the system prompt along with document metadata, and the LLM generates a cited response streamed to the client

### 3. AI Chat Interface
- **Real-time streaming** responses via Vercel AI SDK v7's `streamText` and `UIMessageStreamResponse`
- **Model selection** — Users can switch between a fast model (Llama 3.1 8B) and a versatile model (Llama 3.3 70B)
- **Chat history persistence** — Conversations are stored in Supabase and restored on page reload
- **Source citations** — The LLM is instructed to cite specific passages; citations are parsed from a structured HTML comment in the response and rendered as clickable badges
- **Citation-to-page navigation** — Clicking a citation badge scrolls the PDF viewer to the referenced page

### 4. Multi-Tenant Workspace Isolation
- Each browser generates a unique **workspace UUID** on first visit (stored in `localStorage`)
- All API requests include an `x-workspace-id` header
- All database queries are scoped to the workspace — users only see their own documents and chat history
- No authentication required (appropriate for a public demo)

### 5. Integrated PDF Viewer
- Client-side PDF rendering via `react-pdf`
- Page navigation controls with current/total page display
- **Citation-driven navigation** — clicking a citation in the chat jumps the viewer to the cited page

### 6. Rate Limiting
- **In-memory rate limiter** (per-IP, per-day) to protect API costs on the public demo
- Configurable via `MAX_CHAT_PER_IP_PER_DAY` environment variable (default: 20)
- Runs as the **very first check** in the chat endpoint — before any embedding, Supabase, or LLM work — so rate-limited requests have zero cost
- Returns a user-friendly message explaining this is a demo quota (not a bug), displayed as a normal chat message
- **Design decision: in-memory Map over SQLite** — since the app is deployed on ephemeral hosting (Docker containers), SQLite would lose data on restart just like a Map does. A Map avoids I/O overhead and the need for a native SQLite dependency in the Docker image

### 7. Responsive Design
- **Desktop**: Side-by-side two-pane layout (Documents | Chat)
- **Mobile**: Tab-based switcher between Documents and Chat views
- Dark theme with glassmorphism effects and gradient mesh background

---

## Docker Optimization

The Dockerfile was engineered through multiple optimization passes to minimize image size while maintaining full functionality:

| Version | Image Size | Key Change |
|---|---|---|
| Initial (naive) | **1.91 GB** | Full `node_modules` copied to runner |
| + Standalone output | **601 MB** | `output: "standalone"` traces only needed files |
| + Minimal base + exclusions | **475 MB** | `debian:bookworm-slim` runner + platform exclusions |

### Optimization Techniques Used

1. **Multi-stage build** (3 stages: `deps` → `builder` → `runner`) — build tools and dev dependencies never enter the final image
2. **Next.js standalone output** (`output: "standalone"`) — file tracing copies only the `node_modules` files actually imported at runtime, instead of the entire directory
3. **Minimal runner base** — The production stage uses `debian:bookworm-slim` (116 MB) instead of `node:22-slim` (327 MB), copying only the `node` binary. npm, yarn, and corepack are not needed since the entrypoint is `node server.js`
4. **Platform-specific binary exclusions** via `outputFileTracingExcludes`:
   - Stripped macOS and Windows binaries from `onnxruntime-node` (only linux/x64 is needed)
   - Stripped WASM fallback binaries from `@xenova/transformers` (the app uses native `onnxruntime-node`)
   - Stripped `sharp-wasm32` (native linux-x64 binary is used)
   - Stripped `pdfjs-dist/legacy` (the app uses the modern build)
5. **Layer consolidation** — Multiple `RUN`/`ENV` commands merged to reduce Docker layers
6. **`--no-install-recommends`** on apt-get to skip unnecessary suggested packages
7. **Debian base preserved** (not Alpine/musl) because `onnxruntime-node` requires glibc

### Docker Compose Security Hardening
- `cap_drop: ALL` — Drops all Linux capabilities
- `no-new-privileges: true` — Prevents privilege escalation
- Resource limits: 1 CPU, 1 GB memory
- Non-root user (`nextjs:nodejs`, UID/GID 1001)

---

## Database Design

### Schema (Supabase/PostgreSQL + pgvector)

**`documents`** — Tracks uploaded PDFs and their processing lifecycle
- Status machine: `uploaded` → `processing` → `ready` (or `failed`)
- `cursor` field enables resumable batch processing

**`chunks`** — Stores text chunks with 384-dimensional vector embeddings
- `embedding vector(384)` column with **HNSW index** for fast cosine similarity search
- Referential integrity: cascading delete from parent document

**`chat_messages`** — Conversation history with structured citations
- `citations jsonb` stores parsed citation metadata (document ID, filename, page number)

**`match_chunks()`** — PostgreSQL RPC function for vector similarity search
- Takes a query embedding and workspace ID
- Returns ranked chunks by cosine similarity using pgvector's `<=>` distance operator

---

## Configuration

All tunable parameters are exposed as environment variables with sensible defaults:

| Variable | Default | Description |
|---|---|---|
| `EMBEDDING_MODEL` | `Xenova/all-MiniLM-L6-v2` | Hugging Face model for embeddings |
| `EMBEDDING_DIMENSIONS` | `384` | Embedding vector dimensions |
| `CHUNK_SIZE` | `2000` | Max characters per text chunk |
| `CHUNK_OVERLAP` | `200` | Overlap between consecutive chunks |
| `TOP_K_CHUNKS` | `5` | Number of chunks retrieved for context |
| `HISTORY_LIMIT` | `10` | Chat history messages included in LLM prompt |
| `PAGES_PER_BATCH` | `10` | PDF pages processed per batch |
| `MAX_CHAT_PER_IP_PER_DAY` | `20` | Rate limit for the public demo |
| `NEXT_PUBLIC_MODEL_FAST` | `llama-3.1-8b-instant` | Fast Groq model |
| `NEXT_PUBLIC_MODEL_VERSATILE` | `llama-3.3-70b-versatile` | High-quality Groq model |

---

## Key Engineering Decisions

| Decision | Rationale |
|---|---|
| **Local embeddings** (not OpenAI/Cohere API) | Zero per-request cost, no API key dependency, full control over model. Adds ~16 MB to Docker image via onnxruntime native binary |
| **Groq** (not OpenAI) for LLM | Extremely fast inference (built on custom LPU hardware), generous free tier, ideal for a demo project |
| **pgvector HNSW** (not FAISS/Pinecone) | Runs inside existing Supabase Postgres — no extra service to deploy or pay for. HNSW provides sub-millisecond approximate search |
| **Presigned upload URLs** | Client uploads directly to Supabase Storage, avoiding server as a relay. Reduces bandwidth and memory pressure |
| **In-memory rate limiter** | Ephemeral hosting makes SQLite/Redis durability moot. A Map is O(1) with zero I/O |
| **Workspace isolation via UUID** | No auth needed for a demo — each browser gets a unique workspace via `localStorage` |
| **Debian over Alpine** for Docker | `onnxruntime-node` requires glibc; Alpine uses musl, which is incompatible |
| **Standalone output** for Docker | Reduces Docker image from 1.91 GB to 475 MB by tracing only imported files |

---

## Resume Bullet Points

- Built a **full-stack RAG application** with Next.js 16 that enables AI-powered Q&A over uploaded PDFs with real-time streaming responses and page-level source citations
- Implemented a **complete embedding pipeline** using `@xenova/transformers` running locally on the server, eliminating external API costs while generating 384-dimensional sentence vectors
- Designed a **pgvector-backed retrieval system** with HNSW indexing and cosine similarity search, achieving sub-millisecond approximate nearest-neighbor lookups across document chunks
- Engineered a **multi-stage Docker build** that reduced the production image from 1.91 GB to 475 MB through standalone output tracing, platform-specific binary exclusions, and a minimal Debian runner base
- Built an **in-memory per-IP rate limiter** to protect API costs on the public demo, with configurable daily quotas and user-friendly limit messages
- Implemented **resumable batch processing** for PDF ingestion with cursor-based progress tracking, handling large documents without timeout or memory issues
