"use client";

import type { RetrievedChunk } from "@/lib/rag/types";
import {
  VERTICAL_COLORS,
  DEFAULT_VERTICAL_COLOR,
} from "@/lib/data/taxonomy";

export function SourceCard({
  chunk,
  index,
  animDelay,
}: {
  chunk: RetrievedChunk;
  index: number;
  animDelay?: number;
}) {
  const { metadata, score } = chunk;
  const colors = VERTICAL_COLORS[metadata.tema] || DEFAULT_VERTICAL_COLOR;
  const scorePct = Math.round(score * 100);

  return (
    <div
      className={`animate-fade-up rounded-lg border ${colors.border} ${colors.bg} p-3 transition-colors hover:bg-card-hover`}
      style={{ animationDelay: `${animDelay ?? index * 0.06}s` }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
          <span className="text-xs font-medium text-slate-300 truncate">
            [{index + 1}] {metadata.extracto.slice(0, 80)}
          </span>
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-1.5 w-12 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full animate-score-grow ${
                score > 0.75
                  ? "bg-emerald-400"
                  : score > 0.6
                    ? "bg-amber-400"
                    : "bg-red-400"
              }`}
              style={{ width: `${scorePct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500 w-7 text-right">
            .{(score * 1000).toFixed(0).padStart(3, "0")}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 text-[10px]">
        <span className={`rounded px-1.5 py-0.5 ${colors.bg} ${colors.text} font-medium`}>
          {metadata.tema}
        </span>
        {metadata.filtroTipo && (
          <span className="rounded px-1.5 py-0.5 bg-slate-800/60 text-slate-400">
            {metadata.filtroTipo}
          </span>
        )}
        {metadata.filtroAutoridad && (
          <span className="rounded px-1.5 py-0.5 bg-slate-800/60 text-slate-400">
            {metadata.filtroAutoridad}
          </span>
        )}
        {metadata.filtroAno && (
          <span className="rounded px-1.5 py-0.5 bg-slate-800/60 text-slate-500">
            {metadata.filtroAno}
          </span>
        )}
      </div>
    </div>
  );
}
