"use client";

import ReactMarkdown from "react-markdown";
import { SourceCard } from "./SourceCard";
import { MetricsBar } from "./MetricsBar";
import type { RAGResponse } from "@/lib/rag/types";
import { Database, Cloud } from "lucide-react";

export function ChatPanel({ response }: { response: RAGResponse }) {
  const backendLabel =
    response.backend === "pinecone" ? "Pinecone" : "pgvector (Supabase)";
  const BackendIcon = response.backend === "pinecone" ? Cloud : Database;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-700 bg-gray-900/50 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        <BackendIcon className="h-5 w-5 text-blue-400" />
        <h3 className="font-semibold text-gray-100">{backendLabel}</h3>
      </div>

      {/* Answer */}
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown>{response.answer}</ReactMarkdown>
      </div>

      {/* Metrics */}
      <MetricsBar timings={response.timings} />

      {/* Sources */}
      {response.sources.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400">
            Fuentes ({response.sources.length})
          </h4>
          <div className="grid gap-2">
            {response.sources.map((chunk, i) => (
              <SourceCard key={chunk.id} chunk={chunk} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
