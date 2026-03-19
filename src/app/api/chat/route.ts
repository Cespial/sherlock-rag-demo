import { NextRequest } from "next/server";
import { embedQuery } from "@/lib/rag/embeddings";
import type { EmbeddingProvider } from "@/lib/rag/embeddings";
import { searchPinecone } from "@/lib/rag/pinecone";
import { searchPgvector } from "@/lib/rag/pgvector";
import { streamAnswer } from "@/lib/rag/claude";
import type { LLMSpeed } from "@/lib/rag/claude";
import { rerankChunks } from "@/lib/rag/rerank";
import type { SearchFilter } from "@/lib/rag/types";

const VALID_BACKENDS = new Set(["pinecone", "pgvector"]);
const VALID_EMBEDDINGS = new Set(["voyage", "openai"]);
const VALID_SPEEDS = new Set(["sonnet", "haiku"]);
const ALLOWED_FILTER_KEYS = new Set(["tema", "tipo", "autoridad", "ano"]);

function sanitizeFilters(raw: Record<string, unknown>): SearchFilter {
  const clean: SearchFilter = {};
  for (const key of ALLOWED_FILTER_KEYS) {
    const val = raw[key];
    if (typeof val === "string" && val.trim()) {
      (clean as Record<string, string>)[key] = val.trim();
    }
  }
  return clean;
}

function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: Record<string, unknown>
) {
  controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const backend = body.backend as string;
    const embedding = (body.embedding || "voyage") as string;
    const rerank = body.rerank === true;
    const speed = (body.speed || "sonnet") as string;
    const rawTopK = typeof body.topK === "number" ? body.topK : 5;
    const topK = Math.min(20, Math.max(1, Math.round(rawTopK)));
    const filters = sanitizeFilters(body.filters || {});

    if (!query) {
      return Response.json({ error: "Missing query" }, { status: 400 });
    }
    if (!VALID_BACKENDS.has(backend)) {
      return Response.json({ error: "Invalid backend" }, { status: 400 });
    }
    if (!VALID_EMBEDDINGS.has(embedding)) {
      return Response.json({ error: "Invalid embedding provider" }, { status: 400 });
    }
    if (!VALID_SPEEDS.has(speed)) {
      return Response.json({ error: "Invalid speed" }, { status: 400 });
    }

    const embeddingProvider = embedding as EmbeddingProvider;
    const llmSpeed = speed as LLMSpeed;
    const retrieveK = rerank ? 15 : topK; // Fetch more if reranking

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 1. Embed
          const t0 = performance.now();
          const queryVector = await embedQuery(query, embeddingProvider);
          const embeddingMs = performance.now() - t0;
          sendEvent(controller, encoder, {
            type: "embedding",
            ms: Math.round(embeddingMs),
          });

          // 2. Retrieve
          const t1 = performance.now();
          let chunks =
            backend === "pinecone"
              ? await searchPinecone(queryVector, filters, retrieveK, embeddingProvider)
              : await searchPgvector(queryVector, filters, retrieveK, embeddingProvider);
          const retrievalMs = performance.now() - t1;

          // 3. Rerank (optional)
          let rerankMs = 0;
          if (rerank && chunks.length > 0) {
            const t2 = performance.now();
            chunks = await rerankChunks(query, chunks, topK);
            rerankMs = performance.now() - t2;
            sendEvent(controller, encoder, {
              type: "rerank",
              ms: Math.round(rerankMs),
              enabled: true,
            });
          } else {
            chunks = chunks.slice(0, topK);
          }

          // Send sources
          const clientChunks = chunks.map((c) => ({
            ...c,
            metadata: { ...c.metadata, embeddingText: "" },
          }));
          sendEvent(controller, encoder, {
            type: "sources",
            chunks: clientChunks,
            retrieval_ms: Math.round(retrievalMs),
          });

          // 4. Stream generation
          const t3 = performance.now();
          for await (const token of streamAnswer(query, chunks, llmSpeed)) {
            sendEvent(controller, encoder, { type: "token", text: token });
          }
          const generationMs = performance.now() - t3;

          // 5. Metrics
          sendEvent(controller, encoder, {
            type: "metrics",
            timings: {
              embedding_ms: Math.round(embeddingMs),
              retrieval_ms: Math.round(retrievalMs),
              rerank_ms: rerank ? Math.round(rerankMs) : undefined,
              generation_ms: Math.round(generationMs),
              total_ms: Math.round(
                embeddingMs + retrievalMs + rerankMs + generationMs
              ),
            },
          });

          sendEvent(controller, encoder, { type: "done" });
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown error";
          sendEvent(controller, encoder, { type: "error", message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
