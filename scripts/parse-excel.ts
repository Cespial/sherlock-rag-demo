import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

interface RawRow {
  EXTRACTO: string;
  "DOC. ORIGEN": string;
  SUBTEMAS: string;
  "TÉRMINOS RELACIONADOS": string;
  "TÉRMINOS EQUIVALENTES": string;
  FILTRO: string;
}

interface ParsedDocument {
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

// Map filename → canonical tema
const FILE_TEMA_MAP: Record<string, string> = {
  "EXCEL MAESTRO CRÉDITO DIGITAL.xlsx": "Crédito Digital",
  "EXCEL MAESTRO CROWDFUNDING.xlsx": "Crowdfunding",
  "EXCEL MAESTRO FACTORING.xlsx": "Factoring",
  "EXCEL MAESTRO INSURTECH.xlsx": "Insurtech",
  "EXCEL MAESTRO NEOBANCOS .xlsx": "Neobancos",
  "EXCEL MAESTRO PAGOS DIGITALES.xlsx": "Pagos Digitales",
  "EXCEL MAESTRO REGTECH.xlsx": "RegTech",
  "EXCEL MAESTRO V2 .xlsx": "Crédito Digital",  // V2 is Crédito Digital extended
  "EXCEL MAESTRO WEALTHTECH.xlsx": "WealthTech",
};

function parseFilterString(filtro: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!filtro) return result;

  const parts = filtro.split(";").map((s) => s.trim());
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim().toLowerCase();
    const value = part.slice(colonIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

function buildEmbeddingText(doc: Omit<ParsedDocument, "id" | "embeddingText">): string {
  const lines = [
    `DOCUMENTO LEGAL FINTECH — COLOMBIA`,
    `TEMA: ${doc.tema} | SUBTEMA: ${doc.subtema}`,
    `EXTRACTO: ${doc.extracto}`,
    `DOCUMENTO ORIGEN: ${doc.documentoOrigen}`,
    `TIPO: ${doc.filtroTipo} | AUTORIDAD: ${doc.filtroAutoridad} | AÑO: ${doc.filtroAno}`,
    `TÉRMINOS: ${doc.terminosRelacionados}`,
    `EQUIVALENCIAS: ${doc.terminosEquivalentes}`,
  ];
  return lines.join("\n");
}

function main() {
  const rawDir = path.join(__dirname, "..", "data", "raw");
  const outPath = path.join(__dirname, "..", "data", "documents.json");

  const files = fs.readdirSync(rawDir).filter((f) => f.endsWith(".xlsx"));
  console.log(`Found ${files.length} Excel files`);

  const documents: ParsedDocument[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const tema = FILE_TEMA_MAP[file];
    if (!tema) {
      console.warn(`Unknown file: ${file}, skipping`);
      continue;
    }

    const wb = XLSX.readFile(path.join(rawDir, file));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    console.log(`  ${file}: ${rows.length} rows → tema="${tema}"`);

    for (const row of rows) {
      const extracto = (row.EXTRACTO || "").trim();
      if (!extracto) continue;

      // Dedup by extracto text
      const dedupKey = extracto.toLowerCase().slice(0, 200);
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const filtro = parseFilterString(row.FILTRO || "");
      const subtemas = (row.SUBTEMAS || "").trim();

      // Extract subtema: take part after first comma or the whole thing
      const subtemaParts = subtemas.split(",").map((s) => s.trim());
      const subtema = subtemaParts.length > 1
        ? subtemaParts.slice(1).join(", ")
        : subtemaParts[0] || "";

      // Use filename tema as canonical; FILTRO tema is often a subtema
      const filtroTema = filtro.tema || "";
      const canonicalTema = tema;
      // If FILTRO tema differs from filename tema, append it to subtema
      const extraSubtema =
        filtroTema && filtroTema.toLowerCase() !== canonicalTema.toLowerCase()
          ? filtroTema
          : "";
      const fullSubtema = [subtema, extraSubtema].filter(Boolean).join(", ");

      const doc: Omit<ParsedDocument, "id" | "embeddingText"> = {
        tema: canonicalTema,
        subtema: fullSubtema,
        extracto,
        documentoOrigen: (row["DOC. ORIGEN"] || "").trim(),
        filtroTipo: filtro.tipo || filtro.tipoorigen || "",
        filtroAutoridad: filtro.autoridad || "",
        filtroAno: filtro["año"] || filtro.ano || "",
        terminosRelacionados: (row["TÉRMINOS RELACIONADOS"] || "").trim(),
        terminosEquivalentes: (row["TÉRMINOS EQUIVALENTES"] || "").trim(),
      };

      const embeddingText = buildEmbeddingText(doc);
      const id = `doc-${documents.length.toString().padStart(3, "0")}`;

      documents.push({ ...doc, id, embeddingText });
    }
  }

  console.log(`\nTotal documents: ${documents.length} (after dedup)`);

  // Write output
  fs.writeFileSync(outPath, JSON.stringify(documents, null, 2));
  console.log(`Written to ${outPath}`);

  // Print tema distribution
  const temaCount: Record<string, number> = {};
  for (const doc of documents) {
    temaCount[doc.tema] = (temaCount[doc.tema] || 0) + 1;
  }
  console.log("\nDistribution:");
  for (const [tema, count] of Object.entries(temaCount).sort()) {
    console.log(`  ${tema}: ${count}`);
  }
}

main();
