# Sherlock — RAG Architecture Comparison

Side-by-side comparison of RAG architectures for Colombian Fintech legal search. 222 documents across 8 verticals.

**Live:** [sherlock-rag-demo.vercel.app](https://sherlock-rag-demo.vercel.app)

## Comparison Axes

| Axis | Options |
|---|---|
| **Vector Store** | Pinecone Serverless vs Supabase pgvector (HNSW) |
| **Embeddings** | Voyage `voyage-3-large` vs OpenAI `text-embedding-3-large` |
| **Reranking** | Cohere `rerank-v3.5` (optional) |
| **LLM** | Claude Sonnet 4 (precise) vs Claude Haiku 4.5 (fast) |
| **Mode** | Classic RAG vs Agentic RAG (tool use + multi-step reasoning) |

## Architecture

```
Classic:  Query → Embed → Retrieve → (Rerank) → Stream Generate
Agent:    Query → Claude thinks → Tool calls (1-3 searches) → Synthesize
```

## Stack

- **Framework:** Next.js 16 + TypeScript + Tailwind CSS 4
- **LLM:** Claude Sonnet 4 / Haiku 4.5 (Anthropic SDK)
- **Embeddings:** Voyage AI voyage-3-large + OpenAI text-embedding-3-large (1024d)
- **Vector Stores:** Pinecone Serverless + Supabase pgvector
- **Reranking:** Cohere rerank-v3.5
- **Deploy:** Vercel

## Data

222 legal documents from 9 Excel source files covering 8 Fintech verticals:
Credito Digital, Crowdfunding, Factoring, Insurtech, Neobancos, Pagos Digitales, RegTech, WealthTech.

## Setup

```bash
npm install
cp .env.local.example .env.local  # Fill in API keys

# Data pipeline
npx tsx scripts/parse-excel.ts
npx tsx scripts/generate-embeddings.ts
npx tsx scripts/generate-embeddings-openai.ts
npx tsx scripts/ingest-pinecone.ts
npx tsx scripts/ingest-pinecone-openai.ts
npx tsx scripts/ingest-pgvector.ts
npx tsx scripts/ingest-pgvector-openai.ts

npm run dev
```

## Environment Variables

```
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
OPENAI_API_KEY=
COHERE_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=sherlock-fintech
PINECONE_INDEX_OPENAI=sherlock-openai
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## API Endpoints

- `POST /api/chat` — Classic RAG streaming (NDJSON)
- `POST /api/agent` — Agentic RAG with tool use (NDJSON)
- `GET /api/health` — Configuration health check

---

Built by [tensor.lat](https://tensor.lat) for [REDEK](https://redek.co)
