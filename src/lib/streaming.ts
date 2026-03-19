import type { RetrievedChunk, SearchFilter, StageTimings } from "./rag/types";
import type { EmbeddingProvider } from "./rag/embeddings";
import type { LLMSpeed } from "./rag/claude";

interface StreamCallbacks {
  onEmbedding: (ms: number) => void;
  onSources: (chunks: RetrievedChunk[], retrievalMs: number) => void;
  onRerank: (ms: number) => void;
  onToken: (text: string) => void;
  onMetrics: (timings: StageTimings) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}

function processLine(line: string, callbacks: StreamCallbacks) {
  if (!line.trim()) return;
  try {
    const event = JSON.parse(line);
    switch (event.type) {
      case "embedding":
        callbacks.onEmbedding(event.ms);
        break;
      case "sources":
        callbacks.onSources(event.chunks, event.retrieval_ms);
        break;
      case "rerank":
        callbacks.onRerank(event.ms);
        break;
      case "token":
        callbacks.onToken(event.text);
        break;
      case "metrics":
        callbacks.onMetrics(event.timings);
        break;
      case "done":
        callbacks.onDone();
        break;
      case "error":
        callbacks.onError(event.message);
        break;
    }
  } catch {
    // Skip malformed JSON
  }
}

export async function streamRAGQuery(
  query: string,
  backend: "pinecone" | "pgvector",
  filters: SearchFilter,
  callbacks: StreamCallbacks,
  options: {
    embedding?: EmbeddingProvider;
    rerank?: boolean;
    speed?: LLMSpeed;
    topK?: number;
  } = {},
  signal?: AbortSignal
): Promise<void> {
  let errorCalled = false;
  function safeError(msg: string) {
    if (!errorCalled) {
      errorCalled = true;
      callbacks.onError(msg);
    }
  }

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      backend,
      filters,
      embedding: options.embedding || "voyage",
      rerank: options.rerank || false,
      speed: options.speed || "sonnet",
      topK: options.topK || 5,
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      // ignore
    }
    safeError(msg);
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) processLine(buffer, callbacks);
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) processLine(line, callbacks);
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      safeError((err as Error).message);
    }
  }
}
