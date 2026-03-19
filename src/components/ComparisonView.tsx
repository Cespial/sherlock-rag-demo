"use client";

import { ChatPanel } from "./ChatPanel";
import type { PanelState } from "@/lib/rag/types";

interface ComparisonViewProps {
  panels: Record<string, PanelState>;
  backends: ("pinecone" | "pgvector")[];
}

export function ComparisonView({ panels, backends }: ComparisonViewProps) {
  if (backends.length === 0) return null;

  if (backends.length === 1) {
    const b = backends[0];
    return (
      <div className="mx-auto max-w-3xl">
        <ChatPanel panel={panels[b]} backend={b} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {backends.map((b) => (
        <ChatPanel key={b} panel={panels[b]} backend={b} />
      ))}
    </div>
  );
}
