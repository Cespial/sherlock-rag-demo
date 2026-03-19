import Anthropic from "@anthropic-ai/sdk";
import { embedQuery } from "./embeddings";
import type { EmbeddingProvider } from "./embeddings";
import { searchPinecone } from "./pinecone";
import { rerankChunks } from "./rerank";
import type { RetrievedChunk } from "./types";
import type { LLMSpeed } from "./claude";

const anthropic = new Anthropic();

const MODEL_MAP: Record<LLMSpeed, string> = {
  sonnet: "claude-sonnet-4-20250514",
  haiku: "claude-haiku-4-5-20251001",
};

const AGENT_SYSTEM = `Eres Sherlock, un agente de investigación legal especializado en regulación Fintech colombiana.

Tienes acceso a una base de datos de 222 documentos legales organizados en 8 verticales Fintech:
Crédito Digital, Crowdfunding, Factoring, Insurtech, Neobancos, Pagos Digitales, RegTech, WealthTech.

PROCESO:
1. Analiza la consulta y determina qué información necesitas.
2. Usa search_documents para buscar. Filtra por tema cuando sepas la vertical.
3. Evalúa los resultados. Si necesitas más, busca con otra query o vertical.
4. Cuando tengas suficiente contexto, genera una respuesta completa.

REGLAS:
- Haz entre 1 y 3 búsquedas según la complejidad.
- Para comparaciones entre verticales, busca en cada una por separado.
- Cita fuentes: [1], [2], etc. referenciando los fragmentos encontrados.
- Responde en español con formato Markdown.
- Sé directo. Máximo 4-5 párrafos.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_documents",
    description:
      "Busca documentos legales Fintech colombianos por similitud semántica. Retorna fragmentos con metadatos, términos clave y equivalencias.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Consulta en español. Usa terminología legal específica.",
        },
        tema: {
          type: "string",
          enum: [
            "Crédito Digital", "Crowdfunding", "Factoring", "Insurtech",
            "Neobancos", "Pagos Digitales", "RegTech", "WealthTech",
          ],
          description: "Opcional: filtrar por vertical Fintech.",
        },
        top_k: {
          type: "number",
          description: "Número de resultados (1-10, default 5).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_topics",
    description: "Lista las verticales Fintech disponibles con cantidades de documentos.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

const TOPIC_COUNTS: Record<string, number> = {
  "Crédito Digital": 47, Crowdfunding: 21, Factoring: 34, Insurtech: 35,
  Neobancos: 12, "Pagos Digitales": 11, RegTech: 30, WealthTech: 32,
};

async function executeTool(
  block: { id: string; name: string; input: unknown },
  embeddingProvider: EmbeddingProvider,
  useRerank: boolean
): Promise<{ text: string; chunks: RetrievedChunk[] }> {
  if (block.name === "list_topics") {
    const lines = Object.entries(TOPIC_COUNTS).map(([t, c]) => `- ${t}: ${c} documentos`);
    return { text: `Verticales (222 docs total):\n${lines.join("\n")}`, chunks: [] };
  }

  if (block.name === "search_documents") {
    const input = block.input as { query: string; tema?: string; top_k?: number };
    const topK = Math.min(10, Math.max(1, input.top_k || 5));
    const filters = input.tema ? { tema: input.tema } : {};

    const vec = await embedQuery(input.query, embeddingProvider);
    let chunks = await searchPinecone(vec, filters, useRerank ? 15 : topK, embeddingProvider);

    if (useRerank && chunks.length > 0) {
      chunks = await rerankChunks(input.query, chunks, topK);
    } else {
      chunks = chunks.slice(0, topK);
    }

    const text = chunks
      .map((c, i) => {
        const m = c.metadata;
        return `[${i + 1}] ${m.tema} — ${m.subtema || m.extracto} (score: ${c.score.toFixed(3)})\nConceptos: ${m.terminosRelacionados}\nEquivalencias: ${m.terminosEquivalentes}`;
      })
      .join("\n\n");

    return { text: text || "No se encontraron documentos relevantes.", chunks };
  }

  return { text: "Herramienta desconocida.", chunks: [] };
}

// Agent event types
export type AgentEvent =
  | { type: "step"; step: number }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; count: number; topScore: number }
  | { type: "token"; text: string }
  | { type: "sources"; chunks: RetrievedChunk[] }
  | { type: "metrics"; timings: { total_ms: number; steps: number; tool_calls: number } }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function* runAgent(
  query: string,
  embeddingProvider: EmbeddingProvider,
  speed: LLMSpeed,
  useRerank: boolean,
  conversationHistory: ConversationMessage[] = []
): AsyncGenerator<AgentEvent> {
  const t0 = performance.now();

  // Build messages with conversation history
  const messages: Anthropic.MessageParam[] = [];
  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: "user", content: query });

  const allChunks: RetrievedChunk[] = [];
  const seenIds = new Set<string>();
  let totalToolCalls = 0;

  for (let step = 0; step < 5; step++) {
    yield { type: "step", step: step + 1 };

    // Stream the response to capture thinking + detect tool calls
    const stream = await anthropic.messages.create({
      model: MODEL_MAP[speed],
      max_tokens: 1024,
      system: AGENT_SYSTEM,
      messages,
      tools: TOOLS,
      stream: true,
    });

    let textBuffer = "";
    let emittedThinking = false;
    const toolUseBlocks: { id: string; name: string; input: unknown }[] = [];
    let currentToolUse: { id: string; name: string; inputJson: string } | null = null;

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const cb = event.content_block;
        if (cb.type === "tool_use") {
          // We saw a tool_use — any buffered text was reasoning
          if (textBuffer.trim() && !emittedThinking) {
            yield { type: "thinking", text: textBuffer.trim() };
            emittedThinking = true;
          }
          currentToolUse = { id: cb.id, name: cb.name, inputJson: "" };
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          textBuffer += event.delta.text;
        } else if (
          event.delta.type === "input_json_delta" &&
          currentToolUse
        ) {
          currentToolUse.inputJson += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        if (currentToolUse) {
          try {
            toolUseBlocks.push({
              id: currentToolUse.id,
              name: currentToolUse.name,
              input: JSON.parse(currentToolUse.inputJson),
            });
          } catch {
            // skip malformed
          }
          currentToolUse = null;
        }
      }
    }

    // No tool calls → this is the final answer
    if (toolUseBlocks.length === 0) {
      const chunks = textBuffer.match(/.{1,10}/g) || [textBuffer];
      for (const chunk of chunks) {
        yield { type: "token", text: chunk };
      }
      break;
    }

    // Emit tool call events
    for (const block of toolUseBlocks) {
      totalToolCalls++;
      yield {
        type: "tool_call",
        name: block.name,
        args: block.input as Record<string, unknown>,
      };
    }

    // Build assistant message for conversation history
    const assistantContent: Anthropic.ContentBlockParam[] = [];
    if (textBuffer.trim()) {
      assistantContent.push({ type: "text", text: textBuffer });
    }
    for (const tool of toolUseBlocks) {
      assistantContent.push({
        type: "tool_use",
        id: tool.id,
        name: tool.name,
        input: tool.input as Record<string, unknown>,
      });
    }
    messages.push({ role: "assistant", content: assistantContent });

    // Execute tools in parallel
    const results = await Promise.all(
      toolUseBlocks.map((block) =>
        executeTool(block, embeddingProvider, useRerank)
      )
    );

    // Process results
    const toolResultContent: Anthropic.ToolResultBlockParam[] = [];
    for (let i = 0; i < toolUseBlocks.length; i++) {
      const result = results[i];
      for (const c of result.chunks) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          allChunks.push(c);
        }
      }
      yield {
        type: "tool_result",
        name: toolUseBlocks[i].name,
        count: result.chunks.length,
        topScore: result.chunks[0]?.score ?? 0,
      };
      toolResultContent.push({
        type: "tool_result",
        tool_use_id: toolUseBlocks[i].id,
        content: result.text,
      });
    }

    messages.push({ role: "user", content: toolResultContent });
  }

  // Send deduplicated sources
  const clientChunks = allChunks.map((c) => ({
    ...c,
    metadata: { ...c.metadata, embeddingText: "" },
  }));
  yield { type: "sources", chunks: clientChunks };

  yield {
    type: "metrics",
    timings: {
      total_ms: Math.round(performance.now() - t0),
      steps: Math.min(5, totalToolCalls + 1),
      tool_calls: totalToolCalls,
    },
  };

  yield { type: "done" };
}
