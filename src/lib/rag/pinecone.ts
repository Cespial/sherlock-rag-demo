import { Pinecone } from "@pinecone-database/pinecone";
import type { RetrievedChunk, SearchFilter } from "./types";
import type { EmbeddingProvider } from "./embeddings";

let client: Pinecone | null = null;

function getClient() {
  if (!client) {
    client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return client;
}

const INDEX_MAP: Record<EmbeddingProvider, string> = {
  voyage: process.env.PINECONE_INDEX || "sherlock-fintech",
  openai: process.env.PINECONE_INDEX_OPENAI || "sherlock-openai",
};

export async function searchPinecone(
  queryVector: number[],
  filters: SearchFilter,
  topK = 5,
  embeddingProvider: EmbeddingProvider = "voyage"
): Promise<RetrievedChunk[]> {
  const pc = getClient();
  const indexName = INDEX_MAP[embeddingProvider];
  const index = pc.index(indexName);

  const filterObj: Record<string, { $eq: string }> = {};
  if (filters.tema) filterObj.tema = { $eq: filters.tema };
  if (filters.tipo) filterObj.filtroTipo = { $eq: filters.tipo };
  if (filters.autoridad) filterObj.filtroAutoridad = { $eq: filters.autoridad };
  if (filters.ano) filterObj.filtroAno = { $eq: filters.ano };

  const results = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter: Object.keys(filterObj).length > 0 ? filterObj : undefined,
  });

  return (results.matches || []).map((m) => ({
    id: m.id,
    score: m.score ?? 0,
    metadata: {
      id: m.id,
      tema: (m.metadata?.tema as string) || "",
      subtema: (m.metadata?.subtema as string) || "",
      extracto: (m.metadata?.extracto as string) || "",
      documentoOrigen: (m.metadata?.documentoOrigen as string) || "",
      filtroTipo: (m.metadata?.filtroTipo as string) || "",
      filtroAutoridad: (m.metadata?.filtroAutoridad as string) || "",
      filtroAno: (m.metadata?.filtroAno as string) || "",
      terminosRelacionados: (m.metadata?.terminosRelacionados as string) || "",
      terminosEquivalentes: (m.metadata?.terminosEquivalentes as string) || "",
      embeddingText: (m.metadata?.embeddingText as string) || "",
    },
  }));
}
