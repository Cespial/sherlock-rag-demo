"use client";

import { ChatPanel } from "./ChatPanel";
import type { RAGResponse } from "@/lib/rag/types";

export function ComparisonView({ results }: { results: RAGResponse[] }) {
  if (results.length === 0) return null;

  if (results.length === 1) {
    return (
      <div className="mx-auto max-w-3xl">
        <ChatPanel response={results[0]} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {results.map((r) => (
        <ChatPanel key={r.backend} response={r} />
      ))}
    </div>
  );
}
