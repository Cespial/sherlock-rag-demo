const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

export async function embedQuery(text: string): Promise<number[]> {
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
