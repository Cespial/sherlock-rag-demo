import * as fs from "fs";
import * as path from "path";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const BATCH_SIZE = 128;

interface Document {
  id: string;
  embeddingText: string;
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "voyage-3-large",
      input: texts,
      input_type: "document",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

async function main() {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.error("Set VOYAGE_API_KEY environment variable");
    process.exit(1);
  }

  const docsPath = path.join(__dirname, "..", "data", "documents.json");
  const outPath = path.join(__dirname, "..", "data", "embeddings.json");

  // Check for cached embeddings
  if (fs.existsSync(outPath)) {
    console.log("embeddings.json already exists. Delete it to regenerate.");
    return;
  }

  const documents: Document[] = JSON.parse(fs.readFileSync(docsPath, "utf-8"));
  console.log(`Embedding ${documents.length} documents with voyage-3-large...`);

  const allEmbeddings: { id: string; embedding: number[] }[] = [];

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const texts = batch.map((d) => d.embeddingText);

    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}: ${batch.length} docs`
    );

    const embeddings = await embedBatch(texts, apiKey);

    for (let j = 0; j < batch.length; j++) {
      allEmbeddings.push({ id: batch[j].id, embedding: embeddings[j] });
    }

    // Rate limit
    if (i + BATCH_SIZE < documents.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(allEmbeddings));
  console.log(`Written ${allEmbeddings.length} embeddings to ${outPath}`);
  console.log(`Embedding dimension: ${allEmbeddings[0].embedding.length}`);
}

main();
