const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Simple in-memory cache for query embeddings
// Saves ~50% of Voyage API calls when using "Ambos" mode
const queryCache = new Map<string, { vector: number[]; ts: number }>();

function getCached(text: string): number[] | null {
  const entry = queryCache.get(text);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    queryCache.delete(text);
    return null;
  }
  return entry.vector;
}

export async function embedQuery(text: string): Promise<number[]> {
  const cached = getCached(text);
  if (cached) return cached;

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
  const vector: number[] = data.data[0].embedding;

  // Cache the result
  queryCache.set(text, { vector, ts: Date.now() });

  // Evict old entries (keep cache small)
  if (queryCache.size > 100) {
    const oldest = [...queryCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 50; i++) {
      queryCache.delete(oldest[i][0]);
    }
  }

  return vector;
}

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
