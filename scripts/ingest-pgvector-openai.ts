import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

interface Document {
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

interface EmbeddingEntry {
  id: string;
  embedding: number[];
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const docsPath = path.join(__dirname, "..", "data", "documents.json");
  const embPath = path.join(__dirname, "..", "data", "embeddings-openai.json");

  const documents: Document[] = JSON.parse(fs.readFileSync(docsPath, "utf-8"));
  const embeddings: EmbeddingEntry[] = JSON.parse(fs.readFileSync(embPath, "utf-8"));
  const embMap = new Map(embeddings.map((e) => [e.id, e.embedding]));

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Upserting ${documents.length} documents to fintech_documents_openai...`);

  const BATCH_SIZE = 50;
  let upserted = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const rows = batch.map((doc) => ({
      id: doc.id,
      tema: doc.tema,
      subtema: doc.subtema,
      extracto: doc.extracto,
      documento_origen: doc.documentoOrigen,
      filtro_tipo: doc.filtroTipo,
      filtro_autoridad: doc.filtroAutoridad,
      filtro_ano: doc.filtroAno,
      terminos_relacionados: doc.terminosRelacionados,
      terminos_equivalentes: doc.terminosEquivalentes,
      embedding_text: doc.embeddingText,
      embedding: embMap.get(doc.id)!,
    }));

    const { error } = await supabase
      .from("fintech_documents_openai")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      console.error(`Batch error at ${i}:`, error.message);
      continue;
    }

    upserted += rows.length;
    console.log(`Upserted ${upserted}/${documents.length}`);
  }

  console.log("Done! Supabase OpenAI ingestion complete.");
  const { count } = await supabase
    .from("fintech_documents_openai")
    .select("*", { count: "exact", head: true });
  console.log(`Total rows: ${count}`);
}

main();
