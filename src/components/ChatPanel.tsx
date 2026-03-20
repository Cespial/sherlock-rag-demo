"use client";

import ReactMarkdown from "react-markdown";
import { SourceCard } from "./SourceCard";
import { MetricsBar } from "./MetricsBar";
import type { PanelState } from "@/lib/rag/types";
import { Sparkles, FileText, Search } from "lucide-react";

interface ChatPanelProps {
  panel: PanelState;
  backend: "pinecone" | "pgvector";
}

const STATUS_LABELS: Record<string, string> = {
  embedding: "Generando embedding…",
  retrieving: "Buscando documentos…",
  reranking: "Reranking con Cohere…",
  generating: "Generando respuesta…",
};

const STRATEGY_LABELS: Record<string, string> = {
  classic: "Classic",
  hyde: "HyDE",
  multiquery: "Multi-Query",
  router: "Router",
};

export function ChatPanel({ panel, backend }: ChatPanelProps) {
  const isPinecone = backend === "pinecone";
  const accentText = isPinecone ? "text-pinecone" : "text-pgvector";
  const panelClass = isPinecone ? "panel-pinecone" : "panel-pgvector";
  const label = isPinecone ? "Pinecone" : "pgvector";
  const sublabel = isPinecone ? "Serverless" : "Supabase HNSW";
  const dotColor = isPinecone ? "bg-cyan-500" : "bg-violet-500";

  const isStreaming = panel.status === "generating";
  const isActive =
    panel.status !== "idle" && panel.status !== "done" && panel.status !== "error";

  const config = panel.config;
  const strategyKey = config?.strategy || "classic";

  return (
    <div className={`animate-fade-up rounded-2xl ${panelClass} bg-card card-shadow overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${dotColor} ${isActive ? "animate-pulse-soft" : ""}`} />
          <div>
            <span className={`text-sm font-semibold ${accentText}`}>{label}</span>
            <span className="ml-2 text-[11px] text-text-tertiary">{sublabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {config && (
            <>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] font-medium text-text-tertiary uppercase">
                {config.embedding}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-600 uppercase">
                {STRATEGY_LABELS[strategyKey] || strategyKey}
              </span>
              {config.rerank && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700 uppercase">
                  rerank
                </span>
              )}
              <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] font-medium text-text-tertiary uppercase">
                {config.speed}
              </span>
            </>
          )}
          {isActive && (
            <span className="text-[11px] text-text-tertiary animate-pulse-soft ml-1">
              {STATUS_LABELS[panel.status] || ""}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 space-y-4">
        {/* Error */}
        {panel.status === "error" && panel.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700">
            {panel.error}
          </div>
        )}

        {/* Router decision */}
        {panel.routeDecision && (
          <div className="animate-fade-up flex items-start gap-2.5 rounded-xl bg-blue-50/60 border border-blue-100 p-3 text-[12px]">
            <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-blue-700">
                Router → {STRATEGY_LABELS[panel.routeDecision.strategy]}
              </span>
              <p className="text-blue-600/70 mt-0.5">{panel.routeDecision.reason}</p>
            </div>
          </div>
        )}

        {/* HyDE doc */}
        {panel.hydeDoc && (
          <div className="animate-fade-up flex items-start gap-2.5 rounded-xl bg-purple-50/60 border border-purple-100 p-3 text-[12px]">
            <FileText className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-purple-700">Documento hipotético (HyDE)</span>
              <p className="text-purple-600/70 mt-0.5 italic">{panel.hydeDoc}</p>
            </div>
          </div>
        )}

        {/* Multi-queries */}
        {panel.multiQueries && panel.multiQueries.length > 0 && (
          <div className="animate-fade-up flex items-start gap-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 p-3 text-[12px]">
            <Search className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-emerald-700">Query variations</span>
              <ul className="mt-1 space-y-0.5">
                {panel.multiQueries.map((q, i) => (
                  <li key={i} className="text-emerald-600/70">&ldquo;{q}&rdquo;</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Answer */}
        {panel.answer && (
          <div className={`markdown-body text-[14px] ${isStreaming ? "streaming-cursor" : ""}`}>
            <ReactMarkdown>{panel.answer}</ReactMarkdown>
          </div>
        )}

        {/* Skeleton */}
        {(panel.status === "retrieving" || panel.status === "reranking") && (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-surface animate-pulse-soft"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}

        {/* Sources */}
        {panel.sources.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">Fuentes</span>
              <span className="text-[10px] font-mono text-text-tertiary">{panel.sources.length}</span>
            </div>
            <div className="space-y-1.5">
              {panel.sources.map((chunk, i) => (
                <SourceCard key={chunk.id} chunk={chunk} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Metrics */}
        {panel.timings && (
          <MetricsBar timings={panel.timings} accent={isPinecone ? "pinecone" : "pgvector"} />
        )}
      </div>
    </div>
  );
}
