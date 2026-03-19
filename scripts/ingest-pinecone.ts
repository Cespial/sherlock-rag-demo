import { Pinecone } from "@pinecone-database/pinecone";
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
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    console.error("Set PINECONE_API_KEY environment variable");
    process.exit(1);
  }

  const docsPath = path.join(__dirname, "..", "data", "documents.json");
  const embPath = path.join(__dirname, "..", "data", "embeddings.json");

  const documents: Document[] = JSON.parse(fs.readFileSync(docsPath, "utf-8"));
  const embeddings: EmbeddingEntry[] = JSON.parse(fs.readFileSync(embPath, "utf-8"));

  const embMap = new Map(embeddings.map((e) => [e.id, e.embedding]));

  const pc = new Pinecone({ apiKey });
  const indexName = process.env.PINECONE_INDEX || "sherlock-fintech";

  // Check if index exists
  const indexes = await pc.listIndexes();
  const exists = indexes.indexes?.some((i) => i.name === indexName);

  if (!exists) {
    console.log(`Creating index "${indexName}"...`);
    await pc.createIndex({
      name: indexName,
      dimension: 1024,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
    // Wait for index to be ready
    console.log("Waiting for index to be ready...");
    await new Promise((r) => setTimeout(r, 30000));
  }

  const index = pc.index(indexName);

  // Upsert in batches of 100
  const BATCH_SIZE = 100;
  let upserted = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const vectors = batch.map((doc) => ({
      id: doc.id,
      values: embMap.get(doc.id)!,
      metadata: {
        tema: doc.tema,
        subtema: doc.subtema,
        extracto: doc.extracto.slice(0, 500),
        documentoOrigen: doc.documentoOrigen,
        filtroTipo: doc.filtroTipo,
        filtroAutoridad: doc.filtroAutoridad,
        filtroAno: doc.filtroAno,
        terminosRelacionados: doc.terminosRelacionados.slice(0, 500),
        terminosEquivalentes: doc.terminosEquivalentes.slice(0, 500),
        embeddingText: doc.embeddingText.slice(0, 1000),
      },
    }));

    await index.upsert({ records: vectors });
    upserted += vectors.length;
    console.log(`Upserted ${upserted}/${documents.length}`);
  }

  console.log("Done! Pinecone ingestion complete.");

  // Verify
  const stats = await index.describeIndexStats();
  console.log("Index stats:", JSON.stringify(stats, null, 2));
}

main();
