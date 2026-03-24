/**
 * Integrate norm chunks with existing documents.
 * Creates a unified documents-v2.json with both:
 * - 222 existing Excel-based docs (metadata + terms)
 * - 1500+ norm chunks (actual legal text)
 *
 * Then regenerates embeddings and re-ingests to all stores.
 */
import * as fs from "fs";
import * as path from "path";

interface ExistingDoc {
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

interface UnifiedDoc {
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
  source: "excel" | "norm";
}

function main() {
  const existingPath = path.join(__dirname, "..", "data", "documents.json");
  const chunksPath = path.join(
    __dirname,
    "..",
    "data",
    "norms",
    "chunks",
    "all-chunks.json"
  );
  const outPath = path.join(__dirname, "..", "data", "documents-v2.json");

  // Load existing
  const existing: ExistingDoc[] = JSON.parse(
    fs.readFileSync(existingPath, "utf-8")
  );
  console.log(`Existing docs: ${existing.length}`);

  // Load norm chunks
  const normChunks: NormChunk[] = JSON.parse(
    fs.readFileSync(chunksPath, "utf-8")
  );

  // Filter: only chunks with >100 chars of real content
  const validChunks = normChunks.filter((c) => c.content.length > 100);
  console.log(
    `Norm chunks: ${normChunks.length} total, ${validChunks.length} valid (>100 chars)`
  );

  // Convert existing docs to unified format
  const unified: UnifiedDoc[] = existing.map((d) => ({
    ...d,
    source: "excel" as const,
  }));

  // Convert norm chunks to unified format
  for (const chunk of validChunks) {
    const primaryTema = chunk.temas[0] || "General";

    unified.push({
      id: `norm-${chunk.id}`,
      tema: primaryTema,
      subtema: `Art. ${chunk.articleNum} — ${chunk.articleTitle.slice(0, 100)}`,
      extracto: chunk.content.slice(0, 500),
      documentoOrigen: chunk.normName,
      filtroTipo: chunk.type.charAt(0).toUpperCase() + chunk.type.slice(1),
      filtroAutoridad: chunk.authority,
      filtroAno: String(chunk.year),
      terminosRelacionados: "",
      terminosEquivalentes: "",
      embeddingText: chunk.embeddingText,
      source: "norm",
    });
  }

  console.log(`\nUnified total: ${unified.length}`);
  console.log(`  From Excel: ${unified.filter((d) => d.source === "excel").length}`);
  console.log(`  From Norms: ${unified.filter((d) => d.source === "norm").length}`);

  // Distribution
  const byTema = new Map<string, number>();
  for (const d of unified) {
    byTema.set(d.tema, (byTema.get(d.tema) || 0) + 1);
  }
  console.log(`\nDistribution by tema:`);
  for (const [tema, count] of [...byTema.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${tema}: ${count}`);
  }

  // Distribution by source type
  const byTipo = new Map<string, number>();
  for (const d of unified) {
    byTipo.set(d.filtroTipo, (byTipo.get(d.filtroTipo) || 0) + 1);
  }
  console.log(`\nBy type:`);
  for (const [tipo, count] of [...byTipo.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${tipo}: ${count}`);
  }

  // Save
  fs.writeFileSync(outPath, JSON.stringify(unified, null, 2));
  console.log(`\nSaved to ${outPath}`);

  // Replace documents.json with v2
  const backupPath = path.join(__dirname, "..", "data", "documents-v1-backup.json");
  fs.copyFileSync(existingPath, backupPath);
  fs.copyFileSync(outPath, existingPath);
  console.log(`Replaced documents.json (backup at documents-v1-backup.json)`);

  // Delete old embedding caches to force regeneration
  for (const f of ["embeddings.json", "embeddings-openai.json"]) {
    const p = path.join(__dirname, "..", "data", f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`Deleted ${f}`);
    }
  }
}

main();
