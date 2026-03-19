import OpenAI from "openai";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const CACHE_TTL_MS = 5 * 60 * 1000;

export type EmbeddingProvider = "voyage" | "openai";

// In-memory cache keyed by provider:text
const queryCache = new Map<string, { vector: number[]; ts: number }>();

function getCached(key: string): number[] | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  return entry.vector;
}

function setCache(key: string, vector: number[]) {
  queryCache.set(key, { vector, ts: Date.now() });
  if (queryCache.size > 200) {
    const oldest = [...queryCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 100; i++) queryCache.delete(oldest[i][0]);
  }
}

async function embedVoyage(text: string): Promise<number[]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "voyage-3-large",
      input: [text],
      input_type: "query",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

async function embedOpenAI(text: string): Promise<number[]> {
  const client = new OpenAI();
  const response = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: [text],
    dimensions: 1024,
  });
  return response.data[0].embedding;
}

export async function embedQuery(
  text: string,
  provider: EmbeddingProvider = "voyage"
): Promise<number[]> {
  const cacheKey = `${provider}:${text}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const vector =
    provider === "openai" ? await embedOpenAI(text) : await embedVoyage(text);

  setCache(cacheKey, vector);
  return vector;
}

// Batch embedding for documents (Voyage only, used by ingestion scripts)
export async function embedDocuments(
  texts: string[]
): Promise<number[][]> {
  const BATCH_SIZE = 128;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "voyage-3-large",
        input: batch,
        input_type: "document",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Voyage API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    for (const item of data.data) {
      allEmbeddings.push(item.embedding);
    }

    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allEmbeddings;
}
