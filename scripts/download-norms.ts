/**
 * Download and chunk Colombian legal norms from funcionpublica.gov.co
 *
 * Pipeline:
 * 1. Fetch HTML from oficial sources
 * 2. Parse HTML → extract article text
 * 3. Chunk by article (ARTÍCULO N)
 * 4. Add metadata (norma, article, year, authority, temas)
 * 5. Save to data/norms/chunks/
 *
 * Usage: npx tsx scripts/download-norms.ts [--priority 1]
 */
import { parse as parseHTML } from "node-html-parser";
import * as fs from "fs";
import * as path from "path";
import { NORM_SOURCES, type NormSource } from "./norm-sources";

interface NormChunk {
  id: string;
  normId: string;
  normName: string;
  year: number;
  authority: string;
  type: string;
  temas: string[];
  articleNum: string;
  articleTitle: string;
  content: string;
  embeddingText: string;
}

import { execSync } from "child_process";

// ─── Fetch HTML from URL (via curl, SSL skip for gov.co) ───
async function fetchHTML(url: string): Promise<string> {
  try {
    const html = execSync(
      `curl -skL --max-time 30 "${url}"`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    if (!html || html.length < 100) throw new Error("Empty response");
    return html;
  } catch (err) {
    throw new Error(`curl failed: ${(err as Error).message.slice(0, 100)}`);
  }
}

// ─── Extract text from HTML ───
function extractTextFromHTML(html: string): string {
  const root = parseHTML(html);

  // funcionpublica.gov.co puts legal text in div#textoNorma or similar
  const candidates = [
    root.querySelector("#textoNorma"),
    root.querySelector(".texto_norma"),
    root.querySelector("#TextoNorma"),
    root.querySelector(".contenido-norma"),
    root.querySelector("article"),
    root.querySelector(".entry-content"),
    root.querySelector("#content"),
  ];

  const container = candidates.find((c) => c && c.text.length > 200);

  if (container) {
    // Remove scripts and styles
    container.querySelectorAll("script, style").forEach((el) => el.remove());
    return container.text.replace(/\s+/g, " ").trim();
  }

  // Fallback: get all text from body
  const body = root.querySelector("body");
  if (body) {
    body.querySelectorAll("script, style, nav, header, footer").forEach((el) =>
      el.remove()
    );
    return body.text.replace(/\s+/g, " ").trim();
  }

  return root.text.replace(/\s+/g, " ").trim();
}

// ─── Split text into articles ───
function chunkByArticle(
  text: string,
  norm: NormSource
): NormChunk[] {
  const chunks: NormChunk[] = [];

  // Pattern: ARTÍCULO N or Artículo N (with optional °, º, dot)
  const articlePattern =
    /(?:ART[IÍ]CULO|Art[ií]culo)\s*(\d+[A-Z]?)[°º.]?\s*[-–.]?\s*/gi;

  const matches = [...text.matchAll(articlePattern)];

  if (matches.length === 0) {
    // No articles found — treat entire text as one chunk
    if (text.length > 100) {
      const chunk = createChunk(norm, "general", "Texto completo", text, 0);
      chunks.push(chunk);
    }
    return chunks;
  }

  // Extract preamble (text before first article)
  const preambleEnd = matches[0].index!;
  const preamble = text.slice(0, preambleEnd).trim();
  if (preamble.length > 100) {
    chunks.push(
      createChunk(norm, "preámbulo", "Encabezado y considerandos", preamble, 0)
    );
  }

  // Extract each article
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const articleNum = match[1];
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    let articleText = text.slice(start, end).trim();

    // Extract title (first sentence or until period)
    const titleEnd = articleText.indexOf(".");
    const articleTitle =
      titleEnd > 0 && titleEnd < 200
        ? articleText.slice(0, titleEnd + 1).trim()
        : `Artículo ${articleNum}`;

    // Skip very short articles (likely just references)
    if (articleText.length < 30) continue;

    // If article is very long (>2000 chars), split by paragraph
    if (articleText.length > 2000) {
      const paragraphs = splitLongArticle(articleText, articleNum);
      for (let p = 0; p < paragraphs.length; p++) {
        chunks.push(
          createChunk(
            norm,
            `${articleNum}-p${p + 1}`,
            `${articleTitle} (parte ${p + 1})`,
            paragraphs[p],
            chunks.length
          )
        );
      }
    } else {
      chunks.push(
        createChunk(norm, articleNum, articleTitle, articleText, chunks.length)
      );
    }
  }

  return chunks;
}

function splitLongArticle(text: string, articleNum: string): string[] {
  // Split by PARÁGRAFO or numbered paragraphs
  const paraPattern =
    /(?:PAR[AÁ]GRAFO|Par[aá]grafo|NUMERAL|Numeral)\s*(\d*)[°º.]?\s*/gi;
  const matches = [...text.matchAll(paraPattern)];

  if (matches.length > 0) {
    const parts: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = i === 0 ? 0 : matches[i].index!;
      const end =
        i + 1 < matches.length ? matches[i + 1].index! : text.length;
      parts.push(text.slice(start, end).trim());
    }
    return parts.filter((p) => p.length > 50);
  }

  // Fallback: split by ~1500 char chunks at sentence boundaries
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 1500) {
    const splitPoint = remaining.lastIndexOf(". ", 1500);
    if (splitPoint > 500) {
      parts.push(remaining.slice(0, splitPoint + 1).trim());
      remaining = remaining.slice(splitPoint + 1).trim();
    } else {
      parts.push(remaining.slice(0, 1500).trim());
      remaining = remaining.slice(1500).trim();
    }
  }
  if (remaining.length > 50) parts.push(remaining);
  return parts;
}

function createChunk(
  norm: NormSource,
  articleNum: string,
  articleTitle: string,
  content: string,
  index: number
): NormChunk {
  const id = `${norm.id}-art-${articleNum}`;

  // Content-first embedding (same strategy as enriched docs)
  const embeddingText = [
    content.slice(0, 800),
    "",
    `Norma: ${norm.name}`,
    `Artículo: ${articleNum} — ${articleTitle}`,
    `Tipo: ${norm.type} | Autoridad: ${norm.authority} | Año: ${norm.year}`,
    `Temas: ${norm.temas.join(", ")}`,
  ].join("\n");

  return {
    id,
    normId: norm.id,
    normName: norm.name,
    year: norm.year,
    authority: norm.authority,
    type: norm.type,
    temas: norm.temas,
    articleNum,
    articleTitle: articleTitle.slice(0, 200),
    content,
    embeddingText,
  };
}

// ─── Main ───
async function main() {
  const priorityArg = process.argv.find((a) => a.startsWith("--priority="));
  const maxPriority = priorityArg
    ? parseInt(priorityArg.split("=")[1])
    : 3;

  const norms = NORM_SOURCES.filter((n) => n.priority <= maxPriority);
  console.log(
    `Downloading ${norms.length} norms (priority ≤ ${maxPriority})...\n`
  );

  const allChunks: NormChunk[] = [];
  const errors: string[] = [];

  for (const norm of norms) {
    process.stdout.write(`  ${norm.id}... `);
    try {
      const html = await fetchHTML(norm.url);
      const text = extractTextFromHTML(html);

      if (text.length < 200) {
        console.log(`SKIP (text too short: ${text.length} chars)`);
        errors.push(`${norm.id}: text too short (${text.length} chars)`);
        continue;
      }

      const chunks = chunkByArticle(text, norm);
      allChunks.push(...chunks);
      console.log(
        `OK (${text.length} chars → ${chunks.length} chunks)`
      );

      // Save raw text for reference
      const rawPath = path.join(
        __dirname,
        "..",
        "data",
        "norms",
        "raw",
        `${norm.id}.txt`
      );
      fs.writeFileSync(rawPath, text);

      // Rate limit
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`ERROR: ${msg.slice(0, 80)}`);
      errors.push(`${norm.id}: ${msg}`);
    }
  }

  // Save all chunks
  const outPath = path.join(
    __dirname,
    "..",
    "data",
    "norms",
    "chunks",
    "all-chunks.json"
  );
  fs.writeFileSync(outPath, JSON.stringify(allChunks, null, 2));

  console.log(`\n════════════════════════════════════`);
  console.log(`Norms processed: ${norms.length - errors.length}/${norms.length}`);
  console.log(`Total chunks: ${allChunks.length}`);
  console.log(`Saved to: ${outPath}`);

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) console.log(`  - ${e}`);
  }

  // Distribution
  const byNorm = new Map<string, number>();
  for (const c of allChunks) {
    byNorm.set(c.normId, (byNorm.get(c.normId) || 0) + 1);
  }
  console.log(`\nChunks per norm:`);
  for (const [id, count] of [...byNorm.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${id}: ${count}`);
  }
}

main();
