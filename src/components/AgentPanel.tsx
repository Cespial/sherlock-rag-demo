"use client";

import ReactMarkdown from "react-markdown";
import { SourceCard } from "./SourceCard";
import type { RetrievedChunk } from "@/lib/rag/types";
import { Search, CheckCircle2, Loader2 } from "lucide-react";

export interface AgentStep {
  type: "step" | "tool_call" | "tool_result";
  step?: number;
  name?: string;
  args?: Record<string, unknown>;
  count?: number;
  topScore?: number;
}

export interface AgentPanelState {
  status: "idle" | "thinking" | "searching" | "generating" | "done" | "error";
  steps: AgentStep[];
  answer: string;
  sources: RetrievedChunk[];
  metrics: { total_ms: number; steps: number; tool_calls: number } | null;
  error: string | null;
}

export const INITIAL_AGENT: AgentPanelState = {
  status: "idle",
  steps: [],
  answer: "",
  sources: [],
  metrics: null,
  error: null,
};

export function AgentPanel({ state }: { state: AgentPanelState }) {
  const isActive = state.status !== "idle" && state.status !== "done" && state.status !== "error";
  const isStreaming = state.status === "generating";

  return (
    <div className="animate-fade-up mx-auto max-w-3xl rounded-2xl bg-card card-shadow overflow-hidden border-t-2 border-amber-400">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full bg-amber-500 ${isActive ? "animate-pulse-soft" : ""}`} />
          <div>
            <span className="text-sm font-semibold text-amber-600">Modo Agente</span>
            <span className="ml-2 text-[11px] text-text-tertiary">Tool Use + Multi-step</span>
          </div>
        </div>

        {state.metrics && (
          <div className="flex gap-3 text-[10px] font-mono text-text-tertiary">
            <span>{state.metrics.tool_calls} búsquedas</span>
            <span>{(state.metrics.total_ms / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>

      <div className="px-5 pb-5 space-y-4">
        {/* Error */}
        {state.status === "error" && state.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700">
            {state.error}
          </div>
        )}

        {/* Steps timeline */}
        {state.steps.length > 0 && (
          <div className="space-y-2">
            {state.steps.map((s, i) => (
              <div key={i} className="animate-fade-up flex items-start gap-3" style={{ animationDelay: `${i * 0.05}s` }}>
                {s.type === "step" && (
                  <>
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-amber-700">{s.step}</span>
                    </div>
                    <span className="text-[12px] text-text-secondary pt-0.5">
                      Analizando…
                    </span>
                  </>
                )}

                {s.type === "tool_call" && (
                  <>
                    <Search className="mt-0.5 h-4 w-4 text-cyan-500 shrink-0" />
                    <div className="text-[12px]">
                      <span className="font-medium text-text">
                        {s.name === "search_documents" ? "Buscando" : s.name}
                      </span>
                      {s.args?.tema ? (
                        <span className="ml-1.5 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] text-cyan-700">
                          {String(s.args.tema)}
                        </span>
                      ) : null}
                      {s.args?.query ? (
                        <span className="ml-1.5 text-text-tertiary italic">
                          &ldquo;{String(s.args.query).slice(0, 60)}&rdquo;
                        </span>
                      ) : null}
                    </div>
                  </>
                )}

                {s.type === "tool_result" && (
                  <>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-[12px] text-text-secondary">
                      {s.count} resultados encontrados
                    </span>
                  </>
                )}
              </div>
            ))}

            {isActive && state.status !== "generating" && (
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                <span className="text-[12px] text-text-tertiary">
                  {state.status === "thinking" ? "Pensando…" : "Buscando…"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Answer */}
        {state.answer && (
          <div className={`markdown-body text-[14px] ${isStreaming ? "streaming-cursor" : ""}`}>
            <ReactMarkdown>{state.answer}</ReactMarkdown>
          </div>
        )}

        {/* Sources */}
        {state.sources.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
                Fuentes utilizadas
              </span>
              <span className="text-[10px] font-mono text-text-tertiary">
                {state.sources.length} docs
              </span>
            </div>
            <div className="space-y-1.5">
              {state.sources.map((chunk, i) => (
                <SourceCard key={chunk.id} chunk={chunk} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
