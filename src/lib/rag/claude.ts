import Anthropic from "@anthropic-ai/sdk";
import type { RetrievedChunk } from "./types";

const anthropic = new Anthropic();

export type LLMSpeed = "sonnet" | "haiku";

const MODEL_MAP: Record<LLMSpeed, string> = {
  sonnet: "claude-sonnet-4-20250514",
  haiku: "claude-haiku-4-5-20251001",
};

const SYSTEM_PROMPT = `Eres Sherlock, un asistente legal especializado en regulación Fintech colombiana.

Tu base de conocimiento son extractos de documentos legales (leyes, decretos, circulares, conceptos) organizados por vertical Fintech: Crédito Digital, Crowdfunding, Factoring, Insurtech, Neobancos, Pagos Digitales, RegTech, WealthTech.

REGLAS:
1. Responde ÚNICAMENTE con base en los fragmentos proporcionados. Si la información no está en el contexto, dilo: "No encontré información sobre ese tema en los documentos disponibles."
2. Cita las fuentes: [1], [2], etc. correspondiendo al número del fragmento.
3. Responde en español, usando Markdown (## headers, **negritas**, listas).
4. Sé preciso y directo. Máximo 3-4 párrafos. Los usuarios son abogados y reguladores.
5. Cuando un fragmento liste términos equivalentes, menciona los más relevantes para dar contexto al lector.
6. Si múltiples fuentes cubren el mismo tema, sintetiza en vez de repetir.`;

function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const m = c.metadata;
      const lines: string[] = [];
      lines.push(`[${i + 1}] ${m.tema} — ${m.subtema || m.extracto}`);
      const meta: string[] = [];
      if (m.documentoOrigen) meta.push(m.documentoOrigen);
      if (m.filtroTipo) meta.push(m.filtroTipo);
      if (m.filtroAutoridad) meta.push(m.filtroAutoridad);
      if (m.filtroAno) meta.push(m.filtroAno);
      if (meta.length > 0) lines.push(`Fuente: ${meta.join(" · ")}`);
      if (m.terminosRelacionados) {
        lines.push(`Conceptos clave: ${m.terminosRelacionados}`);
      }
      if (m.terminosEquivalentes) {
        lines.push(`Equivalencias: ${m.terminosEquivalentes}`);
      }
      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

function buildMessages(query: string, chunks: RetrievedChunk[]) {
  return {
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: `CONTEXTO:\n\n${buildContext(chunks)}\n\n---\n\nPREGUNTA: ${query}`,
      },
    ],
  };
}

export async function generateAnswer(
  query: string,
  chunks: RetrievedChunk[],
  speed: LLMSpeed = "sonnet"
): Promise<string> {
  if (chunks.length === 0) {
    return "No se encontraron documentos relevantes para tu consulta.";
  }

  const { system, messages } = buildMessages(query, chunks);
  const message = await anthropic.messages.create({
    model: MODEL_MAP[speed],
    max_tokens: 768,
    system,
    messages,
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "Error: respuesta inesperada.";
}

export async function* streamAnswer(
  query: string,
  chunks: RetrievedChunk[],
  speed: LLMSpeed = "sonnet"
): AsyncGenerator<string> {
  if (chunks.length === 0) {
    yield "No se encontraron documentos relevantes para tu consulta.";
    return;
  }

  const { system, messages } = buildMessages(query, chunks);
  const stream = await anthropic.messages.create({
    model: MODEL_MAP[speed],
    max_tokens: 768,
    system,
    messages,
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
