/**
 * Enrich documents.json with content-first embeddingText.
 *
 * Problem: 86/222 extractos are just section headers ("9.1.1 DEFINICIÓN Y ALCANCE").
 * The real semantic content is in terminosRelacionados + terminosEquivalentes.
 *
 * Old format (metadata-first):
 *   DOCUMENTO LEGAL FINTECH — COLOMBIA
 *   TEMA: ... | SUBTEMA: ...
 *   EXTRACTO: 9.1.1 DEFINICIÓN Y ALCANCE     ← just a header
 *   ...
 *   TÉRMINOS: financiación colaborativa, crowdfunding...
 *
 * New format (content-first):
 *   financiación colaborativa, crowdfunding, mercado de valores...
 *   financiación colaborativa: crowdfunding, SOFICO: plataforma autorizada...
 *   Tema: Crowdfunding | Subtema: 1. DEFINICIÓN-ALCANCE
 *   Sección: 9.1.1 DEFINICIÓN Y ALCANCE
 *
 * This gives embedding models the semantic content first (higher weight).
 */
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

function buildEnrichedEmbeddingText(doc: Document): string {
  const parts: string[] = [];

  // Content first (semantic weight)
  if (doc.terminosRelacionados) {
    parts.push(doc.terminosRelacionados);
  }
  if (doc.terminosEquivalentes) {
    parts.push(doc.terminosEquivalentes);
  }

  // Then metadata (context)
  parts.push("");
  parts.push(`Tema: ${doc.tema} | Subtema: ${doc.subtema}`);
  parts.push(`Sección: ${doc.extracto}`);
  if (doc.documentoOrigen) parts.push(`Fuente: ${doc.documentoOrigen}`);
  if (doc.filtroTipo) parts.push(`Tipo: ${doc.filtroTipo}`);

  return parts.join("\n");
}

function main() {
  const docsPath = path.join(__dirname, "..", "data", "documents.json");
  const documents: Document[] = JSON.parse(fs.readFileSync(docsPath, "utf-8"));

  const oldAvgLen =
    documents.reduce((s, d) => s + d.embeddingText.length, 0) / documents.length;

  // Enrich
  for (const doc of documents) {
    doc.embeddingText = buildEnrichedEmbeddingText(doc);
  }

  const newAvgLen =
    documents.reduce((s, d) => s + d.embeddingText.length, 0) / documents.length;

  // Write back
  fs.writeFileSync(docsPath, JSON.stringify(documents, null, 2));

  console.log(`Enriched ${documents.length} documents`);
  console.log(`Avg embeddingText: ${Math.round(oldAvgLen)} → ${Math.round(newAvgLen)} chars`);

  // Delete old embedding caches (force regeneration)
  const embVoyagePath = path.join(__dirname, "..", "data", "embeddings.json");
  const embOpenaiPath = path.join(__dirname, "..", "data", "embeddings-openai.json");
  if (fs.existsSync(embVoyagePath)) {
    fs.unlinkSync(embVoyagePath);
    console.log("Deleted embeddings.json (will regenerate)");
  }
  if (fs.existsSync(embOpenaiPath)) {
    fs.unlinkSync(embOpenaiPath);
    console.log("Deleted embeddings-openai.json (will regenerate)");
  }
}

main();
