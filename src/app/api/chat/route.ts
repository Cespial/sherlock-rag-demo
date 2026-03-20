import { NextRequest } from "next/server";
import { embedQuery } from "@/lib/rag/embeddings";
import type { EmbeddingProvider } from "@/lib/rag/embeddings";
import { searchPinecone } from "@/lib/rag/pinecone";
import { searchPgvector } from "@/lib/rag/pgvector";
import { streamAnswer } from "@/lib/rag/claude";
import type { LLMSpeed } from "@/lib/rag/claude";
import { rerankChunks } from "@/lib/rag/rerank";
import {
  hydeRetrieval,
  multiQueryRetrieval,
  routeQuery,
} from "@/lib/rag/strategies";
import type { RAGStrategy } from "@/lib/rag/strategies";
import type { SearchFilter } from "@/lib/rag/types";

const VALID_BACKENDS = new Set(["pinecone", "pgvector"]);
const VALID_EMBEDDINGS = new Set(["voyage", "openai"]);
const VALID_SPEEDS = new Set(["sonnet", "haiku"]);
const VALID_STRATEGIES = new Set(["classic", "hyde", "multiquery", "router"]);
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
    let strategy = (body.strategy || "classic") as string;
    const rawTopK = typeof body.topK === "number" ? body.topK : 5;
    const topK = Math.min(20, Math.max(1, Math.round(rawTopK)));
    const filters = sanitizeFilters(body.filters || {});

    if (!query) return Response.json({ error: "Missing query" }, { status: 400 });
    if (!VALID_BACKENDS.has(backend)) return Response.json({ error: "Invalid backend" }, { status: 400 });
    if (!VALID_EMBEDDINGS.has(embedding)) return Response.json({ error: "Invalid embedding" }, { status: 400 });
    if (!VALID_SPEEDS.has(speed)) return Response.json({ error: "Invalid speed" }, { status: 400 });
    if (!VALID_STRATEGIES.has(strategy)) return Response.json({ error: "Invalid strategy" }, { status: 400 });

    const embeddingProvider = embedding as EmbeddingProvider;
    const llmSpeed = speed as LLMSpeed;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const t0Total = performance.now();

          // ─── Router: auto-select strategy ───
          if (strategy === "router") {
            const decision = await routeQuery(query);
            strategy = decision.strategy;
            sendEvent(controller, encoder, {
              type: "route",
              strategy: decision.strategy,
              reason: decision.reason,
              ms: decision.routeMs,
            });
          }

          let chunks;
          let embeddingMs = 0;
          let retrievalMs = 0;
          let rerankMs = 0;
          let strategyMs = 0;

          if (strategy === "hyde") {
            // ─── HyDE strategy ───
            const t1 = performance.now();
            const result = await hydeRetrieval(
              query, backend as "pinecone" | "pgvector",
              filters, topK, embeddingProvider, rerank
            );
            chunks = result.chunks;
            strategyMs = result.hydeMs;
            retrievalMs = Math.round(performance.now() - t1 - result.hydeMs);

            sendEvent(controller, encoder, {
              type: "hyde_doc",
              text: result.hydeDoc,
              ms: result.hydeMs,
            });
          } else if (strategy === "multiquery") {
            // ─── Multi-Query strategy ───
            const t1 = performance.now();
            const result = await multiQueryRetrieval(
              query, backend as "pinecone" | "pgvector",
              filters, topK, embeddingProvider, rerank
            );
            chunks = result.chunks;
            strategyMs = result.multiQueryMs;
            retrievalMs = Math.round(performance.now() - t1 - result.multiQueryMs);

            sendEvent(controller, encoder, {
              type: "multi_queries",
              queries: result.queries,
              ms: result.multiQueryMs,
            });
          } else {
            // ─── Classic strategy ───
            const t1 = performance.now();
            const queryVector = await embedQuery(query, embeddingProvider);
            embeddingMs = Math.round(performance.now() - t1);
            sendEvent(controller, encoder, { type: "embedding", ms: embeddingMs });

            const t2 = performance.now();
            const retrieveK = rerank ? 15 : topK;
            chunks =
              backend === "pinecone"
                ? await searchPinecone(queryVector, filters, retrieveK, embeddingProvider)
                : await searchPgvector(queryVector, filters, retrieveK, embeddingProvider);
            retrievalMs = Math.round(performance.now() - t2);

            if (rerank && chunks.length > 0) {
              const t3 = performance.now();
              chunks = await rerankChunks(query, chunks, topK);
              rerankMs = Math.round(performance.now() - t3);
              sendEvent(controller, encoder, { type: "rerank", ms: rerankMs, enabled: true });
            } else {
              chunks = chunks.slice(0, topK);
            }
          }

          // Send sources
          const clientChunks = chunks.map((c) => ({
            ...c,
            metadata: { ...c.metadata, embeddingText: "" },
          }));
          sendEvent(controller, encoder, {
            type: "sources",
            chunks: clientChunks,
            retrieval_ms: retrievalMs,
          });

          // Stream generation
          const t4 = performance.now();
          for await (const token of streamAnswer(query, chunks, llmSpeed)) {
            sendEvent(controller, encoder, { type: "token", text: token });
          }
          const generationMs = Math.round(performance.now() - t4);

          // Metrics
          sendEvent(controller, encoder, {
            type: "metrics",
            timings: {
              embedding_ms: embeddingMs,
              retrieval_ms: retrievalMs,
              rerank_ms: rerankMs || undefined,
              strategy_ms: strategyMs || undefined,
              generation_ms: generationMs,
              total_ms: Math.round(performance.now() - t0Total),
            },
          });

          sendEvent(controller, encoder, { type: "done" });
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
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
