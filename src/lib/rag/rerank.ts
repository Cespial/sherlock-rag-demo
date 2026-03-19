import { CohereClient } from "cohere-ai";
import type { RetrievedChunk } from "./types";

let client: CohereClient | null = null;

function getClient() {
  if (!client) {
    client = new CohereClient({ token: process.env.COHERE_API_KEY });
  }
  return client;
}

/**
 * Rerank retrieved chunks using Cohere rerank model.
 * Takes top N chunks from vector search, reranks them, returns top K.
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topK = 5
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];
  if (!process.env.COHERE_API_KEY) return chunks.slice(0, topK);

  const cohere = getClient();

  // Build documents for reranking: combine all metadata into a single text
  const documents = chunks.map((c) => {
    const m = c.metadata;
    return [
      `${m.tema} — ${m.subtema}`,
      m.extracto,
      m.terminosRelacionados,
      m.terminosEquivalentes,
    ]
      .filter(Boolean)
      .join(". ");
  });

  const response = await cohere.rerank({
    query,
    documents,
    topN: topK,
    model: "rerank-v3.5",
  });

  return response.results.map((r) => ({
    ...chunks[r.index],
    score: r.relevanceScore, // Replace vector similarity with rerank score
  }));
}
