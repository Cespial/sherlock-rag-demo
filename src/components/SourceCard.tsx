"use client";

import type { RetrievedChunk } from "@/lib/rag/types";
import {
  VERTICAL_COLORS,
  DEFAULT_VERTICAL_COLOR,
} from "@/lib/data/taxonomy";

export function SourceCard({
  chunk,
  index,
}: {
  chunk: RetrievedChunk;
  index: number;
}) {
  const { metadata, score } = chunk;
  const colors = VERTICAL_COLORS[metadata.tema] || DEFAULT_VERTICAL_COLOR;

  return (
    <div
      className="animate-fade-up rounded-xl bg-card card-shadow border border-border/50 p-3.5 transition-shadow hover:card-shadow-hover"
      style={{
        animationDelay: `${index * 0.06}s`,
        borderLeftWidth: "3px",
        borderLeftColor: `var(--tw-${colors.dot.replace("bg-", "")}, #94a3b8)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug text-text font-medium truncate">
            {metadata.extracto}
          </p>
          {metadata.documentoOrigen && (
            <p className="mt-0.5 text-[11px] text-text-tertiary truncate">
              {metadata.documentoOrigen}
            </p>
          )}
        </div>

        {/* Score */}
        <div className="flex flex-col items-end shrink-0">
          <span className={`text-[11px] font-mono font-semibold ${
            score > 0.75 ? "text-emerald-600" : score > 0.6 ? "text-amber-600" : "text-red-500"
          }`}>
            {(score * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.pill}`}>
          {metadata.tema}
        </span>
        {metadata.filtroTipo && (
          <span className="rounded-full px-2 py-0.5 text-[10px] bg-surface text-text-secondary">
            {metadata.filtroTipo}
          </span>
        )}
        {metadata.filtroAutoridad && (
          <span className="rounded-full px-2 py-0.5 text-[10px] bg-surface text-text-secondary">
            {metadata.filtroAutoridad}
          </span>
        )}
        {metadata.filtroAno && (
          <span className="rounded-full px-2 py-0.5 text-[10px] bg-surface text-text-tertiary">
            {metadata.filtroAno}
          </span>
        )}
      </div>
    </div>
  );
}
