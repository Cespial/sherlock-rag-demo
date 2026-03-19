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
2. Usa search_documents para buscar. Puedes filtrar por vertical (tema).
3. Evalúa los resultados. Si necesitas más, busca de nuevo con otra query o vertical.
4. Cuando tengas suficiente contexto, genera una respuesta completa.

REGLAS:
- Haz entre 1 y 3 búsquedas según la complejidad.
- Para comparaciones entre verticales, busca en cada una por separado.
- Cita fuentes: [1], [2], etc.
- Responde en español, Markdown.
- Sé directo. Máximo 4-5 párrafos.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_documents",
    description:
      "Busca documentos legales Fintech colombianos por similitud semántica. Retorna los fragmentos más relevantes con sus metadatos, términos clave y equivalencias.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Consulta de búsqueda en español. Usa terminología legal específica.",
        },
        tema: {
          type: "string",
          enum: [
            "Crédito Digital",
            "Crowdfunding",
            "Factoring",
            "Insurtech",
            "Neobancos",
            "Pagos Digitales",
            "RegTech",
            "WealthTech",
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
    description:
      "Lista las verticales Fintech disponibles y sus cantidades de documentos.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

const TOPIC_COUNTS: Record<string, number> = {
  "Crédito Digital": 47,
  Crowdfunding: 21,
  Factoring: 34,
  Insurtech: 35,
  Neobancos: 12,
  "Pagos Digitales": 11,
  RegTech: 30,
  WealthTech: 32,
};

async function executeTool(
  block: Anthropic.ContentBlock & { type: "tool_use" },
  embeddingProvider: EmbeddingProvider,
  useRerank: boolean
): Promise<{ text: string; chunks: RetrievedChunk[] }> {
  if (block.name === "list_topics") {
    const lines = Object.entries(TOPIC_COUNTS).map(
      ([t, c]) => `- ${t}: ${c} documentos`
    );
    return {
      text: `Verticales disponibles (222 documentos total):\n${lines.join("\n")}`,
      chunks: [],
    };
  }

  if (block.name === "search_documents") {
    const input = block.input as {
      query: string;
      tema?: string;
      top_k?: number;
    };
    const topK = Math.min(10, Math.max(1, input.top_k || 5));
    const filters = input.tema ? { tema: input.tema } : {};

    const vec = await embedQuery(input.query, embeddingProvider);
    let chunks = await searchPinecone(
      vec,
      filters,
      useRerank ? 15 : topK,
      embeddingProvider
    );

    if (useRerank && chunks.length > 0) {
      chunks = await rerankChunks(input.query, chunks, topK);
    } else {
      chunks = chunks.slice(0, topK);
    }

    // Format results for Claude
    const text = chunks
      .map(
        (c, i) =>
          `[${i + 1}] ${c.metadata.tema} — ${c.metadata.subtema || c.metadata.extracto} (score: ${c.score.toFixed(3)})
Conceptos: ${c.metadata.terminosRelacionados}
Equivalencias: ${c.metadata.terminosEquivalentes}`
      )
      .join("\n\n");

    return {
      text: text || "No se encontraron documentos relevantes.",
      chunks,
    };
  }

  return { text: "Herramienta desconocida.", chunks: [] };
}

// Agent event types for streaming
export type AgentEvent =
  | { type: "step"; step: number }
  | {
      type: "tool_call";
      name: string;
      args: Record<string, unknown>;
    }
  | { type: "tool_result"; name: string; count: number; topScore: number }
  | { type: "token"; text: string }
  | {
      type: "sources";
      chunks: RetrievedChunk[];
    }
  | {
      type: "metrics";
      timings: { total_ms: number; steps: number; tool_calls: number };
    }
  | { type: "done" }
  | { type: "error"; message: string };

export async function* runAgent(
  query: string,
  embeddingProvider: EmbeddingProvider,
  speed: LLMSpeed,
  useRerank: boolean
): AsyncGenerator<AgentEvent> {
  const t0 = performance.now();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: query },
  ];
  const allChunks: RetrievedChunk[] = [];
  const seenIds = new Set<string>();
  let totalToolCalls = 0;

  for (let step = 0; step < 5; step++) {
    yield { type: "step", step: step + 1 };

    const response = await anthropic.messages.create({
      model: MODEL_MAP[speed],
      max_tokens: 1024,
      system: AGENT_SYSTEM,
      messages,
      tools: TOOLS,
    });

    // Check for tool use
    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
        b.type === "tool_use"
    );

    if (toolBlocks.length === 0 || response.stop_reason === "end_turn") {
      // Final answer — yield text in chunks for smooth rendering
      for (const block of response.content) {
        if (block.type === "text" && block.text) {
          const chunks = block.text.match(/.{1,15}/g) || [block.text];
          for (const chunk of chunks) {
            yield { type: "token", text: chunk };
          }
        }
      }
      break;
    }

    // Execute tools
    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolBlocks) {
      totalToolCalls++;
      yield {
        type: "tool_call",
        name: block.name,
        args: block.input as Record<string, unknown>,
      };

      const result = await executeTool(block, embeddingProvider, useRerank);

      // Dedup chunks
      for (const c of result.chunks) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          allChunks.push(c);
        }
      }

      yield {
        type: "tool_result",
        name: block.name,
        count: result.chunks.length,
        topScore: result.chunks[0]?.score ?? 0,
      };

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.text,
      });
    }

    messages.push({ role: "user", content: toolResults });
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
