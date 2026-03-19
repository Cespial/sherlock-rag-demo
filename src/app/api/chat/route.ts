import { NextRequest } from "next/server";
import { embedQuery } from "@/lib/rag/embeddings";
import { searchPinecone } from "@/lib/rag/pinecone";
import { searchPgvector } from "@/lib/rag/pgvector";
import { streamAnswer } from "@/lib/rag/claude";
import type { SearchFilter } from "@/lib/rag/types";

interface ChatRequest {
  query: string;
  backend: "pinecone" | "pgvector";
  filters?: SearchFilter;
  topK?: number;
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
    const body: ChatRequest = await request.json();
    const { query, backend, filters = {}, topK = 5 } = body;

    if (!query || !backend) {
      return Response.json(
        { error: "Missing query or backend" },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 1. Embed query
          const t0 = performance.now();
          const queryVector = await embedQuery(query);
          const embeddingMs = performance.now() - t0;
          sendEvent(controller, encoder, {
            type: "embedding",
            ms: Math.round(embeddingMs),
          });

          // 2. Retrieve chunks
          const t1 = performance.now();
          const chunks =
            backend === "pinecone"
              ? await searchPinecone(queryVector, filters, topK)
              : await searchPgvector(queryVector, filters, topK);
          const retrievalMs = performance.now() - t1;

          // Strip embeddingText from chunks sent to client
          const clientChunks = chunks.map((c) => ({
            ...c,
            metadata: { ...c.metadata, embeddingText: "" },
          }));
          sendEvent(controller, encoder, {
            type: "sources",
            chunks: clientChunks,
            retrieval_ms: Math.round(retrievalMs),
          });

          // 3. Stream generation
          const t2 = performance.now();
          for await (const token of streamAnswer(query, chunks)) {
            sendEvent(controller, encoder, { type: "token", text: token });
          }
          const generationMs = performance.now() - t2;

          // 4. Final metrics
          sendEvent(controller, encoder, {
            type: "metrics",
            timings: {
              embedding_ms: Math.round(embeddingMs),
              retrieval_ms: Math.round(retrievalMs),
              generation_ms: Math.round(generationMs),
              total_ms: Math.round(embeddingMs + retrievalMs + generationMs),
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
