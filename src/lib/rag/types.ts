export interface SearchFilter {
  tema?: string;
  tipo?: string;
  autoridad?: string;
  ano?: string;
}

export interface DocumentMetadata {
  id: string;
  tema: string;
  subtema: string;
  extracto: string;
  documentoOrigen: string;
  filtroTipo: string;
  filtroAutoridad: string;
  filtroAno: string;
  terminosRelacionados: string;
  terminosEquivalentes: string;
  embeddingText: string;
}

export interface RetrievedChunk {
  id: string;
  score: number;
  metadata: DocumentMetadata;
}

export interface StageTimings {
  embedding_ms: number;
  retrieval_ms: number;
  generation_ms: number;
  total_ms: number;
}

export interface RAGResponse {
  answer: string;
  sources: RetrievedChunk[];
  timings: StageTimings;
  backend: "pinecone" | "pgvector";
}
