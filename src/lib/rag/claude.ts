import Anthropic from "@anthropic-ai/sdk";
import type { RetrievedChunk } from "./types";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `Eres Sherlock, un asistente legal especializado en regulación Fintech colombiana.

REGLAS:
1. Responde ÚNICAMENTE con base en los fragmentos proporcionados como contexto.
2. Si la información no está en el contexto, dilo claramente: "No encontré información relevante sobre ese tema en los documentos disponibles."
3. Cita las fuentes usando [Fuente N] donde N corresponde al número del fragmento.
4. Responde en español.
5. Sé preciso y conciso. Los usuarios son abogados o reguladores que necesitan respuestas claras.
6. Si hay términos equivalentes relevantes, menciónalos para ampliar el contexto.`;

function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Fuente ${i + 1}] (score: ${c.score.toFixed(3)})
Tema: ${c.metadata.tema} | Subtema: ${c.metadata.subtema}
Tipo: ${c.metadata.filtroTipo} | Autoridad: ${c.metadata.filtroAutoridad} | Año: ${c.metadata.filtroAno}
Documento: ${c.metadata.documentoOrigen}
Extracto: ${c.metadata.extracto}
Términos: ${c.metadata.terminosRelacionados}
Equivalencias: ${c.metadata.terminosEquivalentes}`
    )
    .join("\n\n---\n\n");
}

export async function generateAnswer(
  query: string,
  chunks: RetrievedChunk[]
): Promise<string> {
  if (chunks.length === 0) {
    return "No se encontraron documentos relevantes para tu consulta. Intenta reformular la pregunta o ajustar los filtros.";
  }

  const context = buildContext(chunks);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `CONTEXTO (fragmentos recuperados de la base documental Fintech):\n\n${context}\n\n---\n\nPREGUNTA: ${query}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type === "text") {
    return block.text;
  }
  return "Error: respuesta inesperada del modelo.";
}
