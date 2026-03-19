"use client";

import ReactMarkdown from "react-markdown";
import { SourceCard } from "./SourceCard";
import { MetricsBar } from "./MetricsBar";
import type { PanelState } from "@/lib/rag/types";

interface ChatPanelProps {
  panel: PanelState;
  backend: "pinecone" | "pgvector";
}

const STATUS_LABELS: Record<string, string> = {
  embedding: "Generando embedding…",
  retrieving: "Buscando documentos…",
  generating: "Generando respuesta…",
};

export function ChatPanel({ panel, backend }: ChatPanelProps) {
  const isPinecone = backend === "pinecone";
  const accent = isPinecone ? "cyan" : "violet";
  const accentText = isPinecone ? "text-cyan-400" : "text-violet-400";
  const accentBg = isPinecone ? "bg-cyan-400" : "bg-violet-400";
  const cardClass = isPinecone ? "accent-border-top" : "accent-border-top-pgvector";
  const label = isPinecone ? "Pinecone" : "pgvector";
  const sublabel = isPinecone ? "Serverless" : "Supabase HNSW";

  const isStreaming = panel.status === "generating";
  const isActive = panel.status !== "idle" && panel.status !== "done" && panel.status !== "error";

  return (
    <div
      className={`animate-fade-up flex flex-col gap-3 rounded-xl ${cardClass} p-4`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${accentBg} ${isActive ? "animate-status-pulse" : ""}`} />
          <div>
            <span className={`text-sm font-semibold ${accentText}`}>{label}</span>
            <span className="ml-1.5 text-[10px] text-slate-600">{sublabel}</span>
          </div>
        </div>

        {isActive && (
          <span className="text-[10px] text-slate-500 animate-status-pulse">
            {STATUS_LABELS[panel.status] || ""}
          </span>
        )}
      </div>

      {/* Error */}
      {panel.status === "error" && panel.error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-xs text-red-400">
          {panel.error}
        </div>
      )}

      {/* Answer */}
      {panel.answer && (
        <div
          className={`markdown-body text-sm leading-relaxed ${
            isStreaming ? "streaming-cursor" : ""
          }`}
        >
          <ReactMarkdown>{panel.answer}</ReactMarkdown>
        </div>
      )}

      {/* Skeleton while retrieving */}
      {panel.status === "retrieving" && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 rounded-lg bg-slate-800/30 animate-status-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}

      {/* Sources */}
      {panel.sources.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
              Fuentes
            </span>
            <span className="text-[10px] font-mono text-slate-600">
              {panel.sources.length} docs
            </span>
          </div>
          {panel.sources.map((chunk, i) => (
            <SourceCard key={chunk.id} chunk={chunk} index={i} />
          ))}
        </div>
      )}

      {/* Metrics */}
      {panel.timings && <MetricsBar timings={panel.timings} accent={accent} />}
    </div>
  );
}
