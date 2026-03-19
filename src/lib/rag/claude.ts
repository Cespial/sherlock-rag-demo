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
6. Si hay términos equivalentes relevantes, menciónalos para ampliar el contexto.
7. Usa formato Markdown: headers, listas, **negritas** para conceptos clave.`;

function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] Tema: ${c.metadata.tema} | Subtema: ${c.metadata.subtema}
Extracto: ${c.metadata.extracto}
Doc: ${c.metadata.documentoOrigen} | Tipo: ${c.metadata.filtroTipo} | Autoridad: ${c.metadata.filtroAutoridad} | Año: ${c.metadata.filtroAno}
Términos: ${c.metadata.terminosRelacionados.slice(0, 200)}
Equivalencias: ${c.metadata.terminosEquivalentes.slice(0, 200)}`
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
    max_tokens: 768,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `CONTEXTO:\n\n${context}\n\n---\n\nPREGUNTA: ${query}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type === "text") {
    return block.text;
  }
  return "Error: respuesta inesperada del modelo.";
}

export async function* streamAnswer(
  query: string,
  chunks: RetrievedChunk[]
): AsyncGenerator<string> {
  if (chunks.length === 0) {
    yield "No se encontraron documentos relevantes para tu consulta. Intenta reformular la pregunta o ajustar los filtros.";
    return;
  }

  const context = buildContext(chunks);

  const stream = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 768,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `CONTEXTO:\n\n${context}\n\n---\n\nPREGUNTA: ${query}`,
      },
    ],
    stream: true,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
