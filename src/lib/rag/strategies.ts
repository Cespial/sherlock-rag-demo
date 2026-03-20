import Anthropic from "@anthropic-ai/sdk";
import { embedQuery } from "./embeddings";
import type { EmbeddingProvider } from "./embeddings";
import { searchPinecone } from "./pinecone";
import { searchPgvector } from "./pgvector";
import { rerankChunks } from "./rerank";
import type { RetrievedChunk, SearchFilter } from "./types";

const anthropic = new Anthropic();
const FAST_MODEL = "claude-haiku-4-5-20251001";

export type RAGStrategy = "classic" | "hyde" | "multiquery" | "router";

// ─── Search helper ───
async function searchBackend(
  vec: number[],
  backend: "pinecone" | "pgvector",
  filters: SearchFilter,
  topK: number,
  embedding: EmbeddingProvider
): Promise<RetrievedChunk[]> {
  return backend === "pinecone"
    ? searchPinecone(vec, filters, topK, embedding)
    : searchPgvector(vec, filters, topK, embedding);
}

// ─── HyDE: Hypothetical Document Embeddings ───
export async function generateHypotheticalDoc(query: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Genera un fragmento hipotético de un documento legal colombiano que responda esta consulta. Usa terminología Fintech y legal precisa. Máximo 3 oraciones en español.\n\nConsulta: ${query}`,
      },
    ],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text : query;
}

export async function hydeRetrieval(
  query: string,
  backend: "pinecone" | "pgvector",
  filters: SearchFilter,
  topK: number,
  embedding: EmbeddingProvider,
  rerank: boolean
): Promise<{ chunks: RetrievedChunk[]; hydeDoc: string; hydeMs: number }> {
  const t0 = performance.now();
  const hydeDoc = await generateHypotheticalDoc(query);
  const hydeMs = performance.now() - t0;

  // Embed the hypothetical document (not the original query)
  const vec = await embedQuery(hydeDoc, embedding);

  const retrieveK = rerank ? 15 : topK;
  let chunks = await searchBackend(vec, backend, filters, retrieveK, embedding);

  if (rerank && chunks.length > 0) {
    chunks = await rerankChunks(query, chunks, topK);
  } else {
    chunks = chunks.slice(0, topK);
  }

  return { chunks, hydeDoc, hydeMs: Math.round(hydeMs) };
}

// ─── Multi-Query: Generate query variations ───
export async function generateQueryVariations(
  query: string
): Promise<string[]> {
  const msg = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Genera 3 variaciones de esta consulta para buscar en una base de documentos legales Fintech colombianos. Usa sinónimos y diferentes ángulos. Retorna SOLO las 3 queries, una por línea, sin numeración.\n\nConsulta original: ${query}`,
      },
    ],
  });
  const block = msg.content[0];
  if (block.type !== "text") return [query];

  const lines = block.text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5);

  return lines.length > 0 ? lines.slice(0, 3) : [query];
}

export async function multiQueryRetrieval(
  query: string,
  backend: "pinecone" | "pgvector",
  filters: SearchFilter,
  topK: number,
  embedding: EmbeddingProvider,
  rerank: boolean
): Promise<{
  chunks: RetrievedChunk[];
  queries: string[];
  multiQueryMs: number;
}> {
  const t0 = performance.now();
  const queries = await generateQueryVariations(query);
  const multiQueryMs = performance.now() - t0;

  // Embed all variations in parallel
  const vecs = await Promise.all(
    queries.map((q) => embedQuery(q, embedding))
  );

  // Search with each variation in parallel
  const retrieveK = rerank ? 10 : Math.ceil(topK * 1.5);
  const allResults = await Promise.all(
    vecs.map((v) => searchBackend(v, backend, filters, retrieveK, embedding))
  );

  // Merge + dedup by ID, keep best score
  const seen = new Map<string, RetrievedChunk>();
  for (const results of allResults) {
    for (const chunk of results) {
      const existing = seen.get(chunk.id);
      if (!existing || chunk.score > existing.score) {
        seen.set(chunk.id, chunk);
      }
    }
  }

  let merged = [...seen.values()].sort((a, b) => b.score - a.score);

  if (rerank && merged.length > 0) {
    merged = await rerankChunks(query, merged.slice(0, 15), topK);
  } else {
    merged = merged.slice(0, topK);
  }

  return { chunks: merged, queries, multiQueryMs: Math.round(multiQueryMs) };
}

// ─── Router: Classify query → pick best strategy ───
export interface RouteDecision {
  strategy: RAGStrategy;
  reason: string;
  routeMs: number;
}

export async function routeQuery(query: string): Promise<RouteDecision> {
  const t0 = performance.now();
  const msg = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `Clasifica esta consulta legal Fintech en UNA estrategia de búsqueda:
- "classic": pregunta factual simple sobre un tema
- "hyde": pregunta vaga o conceptual que necesita más contexto
- "multiquery": pregunta con múltiples aspectos o que se beneficia de sinónimos

Responde SOLO JSON: {"strategy":"...","reason":"..."}

Consulta: ${query}`,
      },
    ],
  });

  const routeMs = Math.round(performance.now() - t0);
  const block = msg.content[0];

  if (block.type === "text") {
    try {
      const match = block.text.match(/\{[^}]+\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const strategy = ["classic", "hyde", "multiquery"].includes(
          parsed.strategy
        )
          ? (parsed.strategy as RAGStrategy)
          : "classic";
        return { strategy, reason: parsed.reason || "", routeMs };
      }
    } catch {
      // fallback
    }
  }

  return { strategy: "classic", reason: "Fallback to classic", routeMs };
}
