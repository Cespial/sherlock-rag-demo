#!/bin/bash
set -e

# ═══════════════════════════════════════════════
# Sherlock RAG Demo — Overnight Pipeline
# ═══════════════════════════════════════════════
# Run this and leave your machine overnight.
# Total estimated time: 2-3 hours
#
# Usage:
#   chmod +x scripts/run-overnight.sh
#   ./scripts/run-overnight.sh 2>&1 | tee data/overnight-log.txt
# ═══════════════════════════════════════════════

cd "$(dirname "$0")/.."
export $(grep -v '^#' .env.local | grep -v '^$' | xargs)

echo "════════════════════════════════════════════"
echo "  SHERLOCK RAG — OVERNIGHT PIPELINE"
echo "  Started: $(date)"
echo "════════════════════════════════════════════"

# ─── Phase 1: Enrich Data (~1 min) ───
echo ""
echo "▶ PHASE 1: Enriching documents (content-first embeddingText)..."
npx tsx scripts/enrich-documents.ts
echo "  ✓ Documents enriched"

# ─── Phase 2: Regenerate Embeddings (~2 min) ───
echo ""
echo "▶ PHASE 2: Regenerating embeddings..."

echo "  → Voyage AI (voyage-3-large)..."
npx tsx scripts/generate-embeddings.ts
echo "  ✓ Voyage embeddings generated"

echo "  → OpenAI (text-embedding-3-large)..."
npx tsx scripts/generate-embeddings-openai.ts
echo "  ✓ OpenAI embeddings generated"

# ─── Phase 3: Re-ingest to Vector Stores (~5 min) ───
echo ""
echo "▶ PHASE 3: Re-ingesting to all vector stores..."

echo "  → Pinecone (Voyage index)..."
npx tsx scripts/ingest-pinecone.ts
echo "  ✓ Pinecone Voyage done"

echo "  → Pinecone (OpenAI index)..."
npx tsx scripts/ingest-pinecone-openai.ts
echo "  ✓ Pinecone OpenAI done"

echo "  → Supabase pgvector (Voyage table)..."
npx tsx scripts/ingest-pgvector.ts
echo "  ✓ pgvector Voyage done"

echo "  → Supabase pgvector (OpenAI table)..."
npx tsx scripts/ingest-pgvector-openai.ts
echo "  ✓ pgvector OpenAI done"

# ─── Phase 4: Start Dev Server + Benchmark (~2h) ───
echo ""
echo "▶ PHASE 4: Running benchmark (20 queries × 24 configs = 480 runs)..."
echo "  Starting dev server..."

# Start dev server in background
npm run dev -- --port 3000 &
DEV_PID=$!
sleep 10  # Wait for server to be ready

# Verify server is up
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "  ✓ Dev server ready (PID: $DEV_PID)"
else
  echo "  ✗ Dev server failed to start"
  kill $DEV_PID 2>/dev/null
  exit 1
fi

# Run benchmark
npx tsx scripts/benchmark.ts
echo "  ✓ Benchmark complete"

# Stop dev server
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
echo "  ✓ Dev server stopped"

# ─── Phase 5: Analyze Results ───
echo ""
echo "▶ PHASE 5: Analyzing benchmark results..."
npx tsx scripts/analyze-benchmark.ts
echo "  ✓ Report generated"

# ─── Phase 6: Build + Deploy ───
echo ""
echo "▶ PHASE 6: Building and deploying..."
npm run build
git add -A
git commit -m "data: enriched embeddings + benchmark results (overnight pipeline)

- Content-first embeddingText (terms before metadata)
- Regenerated Voyage + OpenAI embeddings
- Re-ingested to all 4 vector stores
- Full benchmark: 20 queries × 24 configs
- Analysis report generated

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>" || true
git push || true
vercel --prod --yes || true

echo ""
echo "════════════════════════════════════════════"
echo "  PIPELINE COMPLETE"
echo "  Finished: $(date)"
echo "  Results: data/benchmark-results.json"
echo "  Report:  data/benchmark-report.md"
echo "  Log:     data/overnight-log.txt"
echo "════════════════════════════════════════════"
