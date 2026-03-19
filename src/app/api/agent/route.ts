import { NextRequest } from "next/server";
import { runAgent } from "@/lib/rag/agent";
import type { EmbeddingProvider } from "@/lib/rag/embeddings";
import type { LLMSpeed } from "@/lib/rag/claude";

const VALID_EMBEDDINGS = new Set(["voyage", "openai"]);
const VALID_SPEEDS = new Set(["sonnet", "haiku"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const embedding = (body.embedding || "voyage") as string;
    const speed = (body.speed || "sonnet") as string;
    const rerank = body.rerank === true;

    if (!query) {
      return Response.json({ error: "Missing query" }, { status: 400 });
    }
    if (!VALID_EMBEDDINGS.has(embedding)) {
      return Response.json({ error: "Invalid embedding" }, { status: 400 });
    }
    if (!VALID_SPEEDS.has(speed)) {
      return Response.json({ error: "Invalid speed" }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runAgent(
            query,
            embedding as EmbeddingProvider,
            speed as LLMSpeed,
            rerank
          )) {
            controller.enqueue(
              encoder.encode(JSON.stringify(event) + "\n")
            );
          }
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "error", message }) + "\n"
            )
          );
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
