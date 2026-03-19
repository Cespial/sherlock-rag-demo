import { NextRequest, NextResponse } from "next/server";
import { embedQuery } from "@/lib/rag/embeddings";
import { searchPinecone } from "@/lib/rag/pinecone";
import { searchPgvector } from "@/lib/rag/pgvector";
import { generateAnswer } from "@/lib/rag/claude";
import type { RAGResponse, SearchFilter, StageTimings } from "@/lib/rag/types";

interface ChatRequest {
  query: string;
  backend: "pinecone" | "pgvector" | "both";
  filters?: SearchFilter;
  topK?: number;
}

async function runRAGPipeline(
  query: string,
  queryVector: number[],
  embeddingMs: number,
  backend: "pinecone" | "pgvector",
  filters: SearchFilter,
  topK: number
): Promise<RAGResponse> {
  const t0 = performance.now();

  const chunks =
    backend === "pinecone"
      ? await searchPinecone(queryVector, filters, topK)
      : await searchPgvector(queryVector, filters, topK);

  const retrievalMs = performance.now() - t0;

  const t1 = performance.now();
  const answer = await generateAnswer(query, chunks);
  const generationMs = performance.now() - t1;

  const timings: StageTimings = {
    embedding_ms: Math.round(embeddingMs),
    retrieval_ms: Math.round(retrievalMs),
    generation_ms: Math.round(generationMs),
    total_ms: Math.round(embeddingMs + retrievalMs + generationMs),
  };

  return { answer, sources: chunks, timings, backend };
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { query, backend, filters = {}, topK = 8 } = body;

    if (!query || !backend) {
      return NextResponse.json(
        { error: "Missing query or backend" },
        { status: 400 }
      );
    }

    // Step 1: Embed query (shared across backends)
    const t0 = performance.now();
    const queryVector = await embedQuery(query);
    const embeddingMs = performance.now() - t0;

    // Step 2: Search + Generate
    if (backend === "both") {
      const [pineconeResult, pgvectorResult] = await Promise.all([
        runRAGPipeline(query, queryVector, embeddingMs, "pinecone", filters, topK),
        runRAGPipeline(query, queryVector, embeddingMs, "pgvector", filters, topK),
      ]);
      return NextResponse.json({ results: [pineconeResult, pgvectorResult] });
    }

    const result = await runRAGPipeline(
      query,
      queryVector,
      embeddingMs,
      backend,
      filters,
      topK
    );
    return NextResponse.json({ results: [result] });
  } catch (err) {
    console.error("Chat API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
