import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const BATCH_SIZE = 100;

interface Document {
  id: string;
  embeddingText: string;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Set OPENAI_API_KEY environment variable");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });
  const docsPath = path.join(__dirname, "..", "data", "documents.json");
  const outPath = path.join(__dirname, "..", "data", "embeddings-openai.json");

  if (fs.existsSync(outPath)) {
    console.log("embeddings-openai.json already exists. Delete it to regenerate.");
    return;
  }

  const documents: Document[] = JSON.parse(fs.readFileSync(docsPath, "utf-8"));
  console.log(`Embedding ${documents.length} documents with text-embedding-3-large (1024d)...`);

  const allEmbeddings: { id: string; embedding: number[] }[] = [];

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const texts = batch.map((d) => d.embeddingText);

    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}: ${batch.length} docs`
    );

    const response = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: texts,
      dimensions: 1024,
    });

    for (let j = 0; j < batch.length; j++) {
      allEmbeddings.push({
        id: batch[j].id,
        embedding: response.data[j].embedding,
      });
    }

    if (i + BATCH_SIZE < documents.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(allEmbeddings));
  console.log(`Written ${allEmbeddings.length} embeddings to ${outPath}`);
  console.log(`Embedding dimension: ${allEmbeddings[0].embedding.length}`);
}

main();
