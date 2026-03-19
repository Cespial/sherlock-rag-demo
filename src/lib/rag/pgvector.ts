import { createClient } from "@supabase/supabase-js";
import type { RetrievedChunk, SearchFilter } from "./types";
import type { EmbeddingProvider } from "./embeddings";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const RPC_MAP: Record<EmbeddingProvider, string> = {
  voyage: "match_fintech_documents",
  openai: "match_fintech_documents_openai",
};

export async function searchPgvector(
  queryVector: number[],
  filters: SearchFilter,
  topK = 5,
  embeddingProvider: EmbeddingProvider = "voyage"
): Promise<RetrievedChunk[]> {
  const supabase = getClient();
  const rpcName = RPC_MAP[embeddingProvider];

  const { data, error } = await supabase.rpc(rpcName, {
    query_embedding: queryVector,
    match_count: topK,
    filter_tema: filters.tema || null,
    filter_tipo: filters.tipo || null,
    filter_autoridad: filters.autoridad || null,
    filter_ano: filters.ano || null,
  });

  if (error) {
    throw new Error(`pgvector search error: ${error.message}`);
  }

  return (data || []).map(
    (row: {
      id: string;
      similarity: number;
      tema: string;
      subtema: string;
      extracto: string;
      documento_origen: string;
      filtro_tipo: string;
      filtro_autoridad: string;
      filtro_ano: string;
      terminos_relacionados: string;
      terminos_equivalentes: string;
      embedding_text: string;
    }) => ({
      id: row.id,
      score: row.similarity,
      metadata: {
        id: row.id,
        tema: row.tema || "",
        subtema: row.subtema || "",
        extracto: row.extracto || "",
        documentoOrigen: row.documento_origen || "",
        filtroTipo: row.filtro_tipo || "",
        filtroAutoridad: row.filtro_autoridad || "",
        filtroAno: row.filtro_ano || "",
        terminosRelacionados: row.terminos_relacionados || "",
        terminosEquivalentes: row.terminos_equivalentes || "",
        embeddingText: row.embedding_text || "",
      },
    })
  );
}
