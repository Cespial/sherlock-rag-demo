"use client";

import ReactMarkdown from "react-markdown";
import { SourceCard } from "./SourceCard";
import { MetricsBar } from "./MetricsBar";
import type { PanelState, QueryConfig } from "@/lib/rag/types";

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

export function ChatPanel({ panel, backend }: ChatPanelProps) {
  const isPinecone = backend === "pinecone";
  const accentText = isPinecone ? "text-pinecone" : "text-pgvector";
  const panelClass = isPinecone ? "panel-pinecone" : "panel-pgvector";
  const label = isPinecone ? "Pinecone" : "pgvector";
  const sublabel = isPinecone ? "Serverless" : "Supabase HNSW";
  const dotColor = isPinecone ? "bg-cyan-500" : "bg-violet-500";

  const isStreaming = panel.status === "generating";
  const isActive =
    panel.status !== "idle" &&
    panel.status !== "done" &&
    panel.status !== "error";

  const config = panel.config;

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

        <div className="flex items-center gap-2">
          {/* Config badges */}
          {config && (
            <div className="flex gap-1">
              <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] font-medium text-text-tertiary uppercase">
                {config.embedding}
              </span>
              {config.rerank && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700 uppercase">
                  rerank
                </span>
              )}
              <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] font-medium text-text-tertiary uppercase">
                {config.speed}
              </span>
            </div>
          )}

          {isActive && (
            <span className="text-[11px] text-text-tertiary animate-pulse-soft">
              {STATUS_LABELS[panel.status] || ""}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 space-y-4">
        {panel.status === "error" && panel.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700">
            {panel.error}
          </div>
        )}

        {panel.answer && (
          <div className={`markdown-body text-[14px] ${isStreaming ? "streaming-cursor" : ""}`}>
            <ReactMarkdown>{panel.answer}</ReactMarkdown>
          </div>
        )}

        {(panel.status === "retrieving" || panel.status === "reranking") && (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-surface animate-pulse-soft"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        )}

        {panel.sources.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
                Fuentes
              </span>
              <span className="text-[10px] font-mono text-text-tertiary">
                {panel.sources.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {panel.sources.map((chunk, i) => (
                <SourceCard key={chunk.id} chunk={chunk} index={i} />
              ))}
            </div>
          </div>
        )}

        {panel.timings && (
          <MetricsBar
            timings={panel.timings}
            accent={isPinecone ? "pinecone" : "pgvector"}
          />
        )}
      </div>
    </div>
  );
}
