/**
 * Sprint 2: Download SFC circulars, BanRep, DIAN norms
 *
 * Handles multiple formats:
 * - HTML from funcionpublica.gov.co (same as Sprint 1)
 * - DOCX/PDF from SFC (download + extract text)
 * - HTML from other legal databases
 *
 * For DOCX/PDF, we use WebFetch which processes through AI to extract text.
 * For HTML, we use curl + node-html-parser.
 */
import { parse as parseHTML } from "node-html-parser";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { SPRINT2_SOURCES } from "./norm-sources-sprint2";

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

// ─── Fetch content (tries curl for HTML, falls back to textutil for docx) ───
async function fetchContent(url: string, normId: string): Promise<string> {
  const rawDir = path.join(__dirname, "..", "data", "norms", "raw");

  if (url.endsWith(".docx")) {
    // Download DOCX and convert to text using textutil (macOS built-in)
    const docxPath = path.join(rawDir, `${normId}.docx`);
    const txtPath = path.join(rawDir, `${normId}.txt`);
    try {
      execSync(`curl -skL --max-time 60 -o "${docxPath}" "${url}"`, {
        encoding: "utf-8",
      });
      // macOS textutil converts docx → txt
      execSync(`textutil -convert txt -output "${txtPath}" "${docxPath}"`, {
        encoding: "utf-8",
      });
      const text = fs.readFileSync(txtPath, "utf-8");
      return text;
    } catch (err) {
      throw new Error(
        `DOCX fetch/convert failed: ${(err as Error).message.slice(0, 80)}`
      );
    }
  }

  if (url.endsWith(".pdf")) {
    // Download PDF and try to extract text
    const pdfPath = path.join(rawDir, `${normId}.pdf`);
    try {
      execSync(`curl -skL --max-time 60 -o "${pdfPath}" "${url}"`, {
        encoding: "utf-8",
      });
      // Try multiple PDF text extractors
      try {
        // pdftotext (poppler)
        const text = execSync(`pdftotext "${pdfPath}" -`, {
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        });
        if (text.length > 200) return text;
      } catch {
        // Fallback: use macOS built-in mdimport/textutil
        try {
          const text = execSync(
            `mdimport -d 2 "${pdfPath}" 2>&1 | head -500`,
            { encoding: "utf-8" }
          );
          if (text.length > 200) return text;
        } catch {
          // ignore
        }
      }
      throw new Error("Could not extract text from PDF");
    } catch (err) {
      throw new Error(
        `PDF fetch/extract failed: ${(err as Error).message.slice(0, 80)}`
      );
    }
  }

  // HTML (same as Sprint 1)
  try {
    const html = execSync(`curl -skL --max-time 30 "${url}"`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (!html || html.length < 100) throw new Error("Empty response");

    const root = parseHTML(html);
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
      container
        .querySelectorAll("script, style")
        .forEach((el) => el.remove());
      return container.text.replace(/\s+/g, " ").trim();
    }
    const body = root.querySelector("body");
    if (body) {
      body
        .querySelectorAll("script, style, nav, header, footer")
        .forEach((el) => el.remove());
      return body.text.replace(/\s+/g, " ").trim();
    }
    return root.text.replace(/\s+/g, " ").trim();
  } catch (err) {
    throw new Error(
      `HTML fetch failed: ${(err as Error).message.slice(0, 80)}`
    );
  }
}

// ─── Chunk text by sections ───
function chunkBySection(
  text: string,
  normId: string,
  normName: string,
  year: number,
  authority: string,
  type: string,
  temas: string[]
): NormChunk[] {
  const chunks: NormChunk[] = [];

  // Try article pattern first
  const articlePattern =
    /(?:ART[IÍ]CULO|Art[ií]culo|ARTICULO)\s*(\d+[A-Z]?)[°º.]?\s*[-–.]?\s*/gi;
  const matches = [...text.matchAll(articlePattern)];

  if (matches.length >= 3) {
    // Chunk by article
    for (let i = 0; i < matches.length; i++) {
      const artNum = matches[i][1];
      const start = matches[i].index! + matches[i][0].length;
      const end =
        i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const content = text.slice(start, end).trim();
      if (content.length < 30) continue;

      const titleEnd = content.indexOf(".");
      const title =
        titleEnd > 0 && titleEnd < 200
          ? content.slice(0, titleEnd + 1)
          : `Artículo ${artNum}`;

      chunks.push(createChunk(normId, normName, year, authority, type, temas, artNum, title, content));
    }
  } else {
    // No article structure — split by paragraph (~1000 char chunks)
    const sentences = text.split(/(?<=[.;])\s+/);
    let current = "";
    let partNum = 1;

    for (const sentence of sentences) {
      current += sentence + " ";
      if (current.length > 1000) {
        chunks.push(
          createChunk(normId, normName, year, authority, type, temas,
            `p${partNum}`, `Parte ${partNum}`, current.trim())
        );
        current = "";
        partNum++;
      }
    }
    if (current.trim().length > 50) {
      chunks.push(
        createChunk(normId, normName, year, authority, type, temas,
          `p${partNum}`, `Parte ${partNum}`, current.trim())
      );
    }
  }

  return chunks;
}

function createChunk(
  normId: string, normName: string, year: number, authority: string,
  type: string, temas: string[], articleNum: string, title: string,
  content: string
): NormChunk {
  const embeddingText = [
    content.slice(0, 800),
    "",
    `Norma: ${normName}`,
    `Artículo: ${articleNum} — ${title.slice(0, 100)}`,
    `Tipo: ${type} | Autoridad: ${authority} | Año: ${year}`,
    `Temas: ${temas.join(", ")}`,
  ].join("\n");

  return {
    id: `${normId}-${articleNum}`,
    normId,
    normName,
    year,
    authority,
    type,
    temas,
    articleNum,
    articleTitle: title.slice(0, 200),
    content,
    embeddingText,
  };
}

// ─── Main ───
async function main() {
  const norms = SPRINT2_SOURCES;
  console.log(`Sprint 2: Downloading ${norms.length} circulars/resolutions...\n`);

  const allChunks: NormChunk[] = [];
  const errors: string[] = [];

  for (const norm of norms) {
    process.stdout.write(`  ${norm.id}... `);
    try {
      const text = await fetchContent(norm.url, norm.id);

      if (text.length < 100) {
        console.log(`SKIP (${text.length} chars)`);
        errors.push(`${norm.id}: too short`);
        continue;
      }

      const chunks = chunkBySection(
        text, norm.id, norm.name, norm.year, norm.authority, norm.type, norm.temas
      );
      allChunks.push(...chunks);
      console.log(`OK (${text.length} chars → ${chunks.length} chunks)`);

      // Save raw
      const rawPath = path.join(__dirname, "..", "data", "norms", "raw", `${norm.id}.txt`);
      if (!fs.existsSync(rawPath)) {
        fs.writeFileSync(rawPath, text);
      }

      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`ERROR: ${msg.slice(0, 100)}`);
      errors.push(`${norm.id}: ${msg.slice(0, 100)}`);
    }
  }

  // Load Sprint 1 chunks and merge
  const sprint1Path = path.join(__dirname, "..", "data", "norms", "chunks", "all-chunks.json");
  const sprint1Chunks: NormChunk[] = JSON.parse(fs.readFileSync(sprint1Path, "utf-8"));

  const merged = [...sprint1Chunks, ...allChunks];

  // Save merged
  fs.writeFileSync(sprint1Path, JSON.stringify(merged, null, 2));

  console.log(`\n════════════════════════════════════`);
  console.log(`Sprint 2 new chunks: ${allChunks.length}`);
  console.log(`Sprint 1 existing: ${sprint1Chunks.length}`);
  console.log(`Merged total: ${merged.length}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log(`\nErrors:`);
    for (const e of errors) console.log(`  - ${e}`);
  }

  // Distribution of new chunks
  const byNorm = new Map<string, number>();
  for (const c of allChunks) {
    byNorm.set(c.normId, (byNorm.get(c.normId) || 0) + 1);
  }
  console.log(`\nNew chunks per source:`);
  for (const [id, count] of [...byNorm.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id}: ${count}`);
  }
}

main();
