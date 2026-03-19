"use client";

import type { RetrievedChunk } from "@/lib/rag/types";
import {
  VERTICAL_COLORS,
  DEFAULT_VERTICAL_COLOR,
} from "@/lib/data/taxonomy";

// Direct hex colors for left border (Tailwind CSS vars don't work inline)
const BORDER_HEX: Record<string, string> = {
  "Crédito Digital": "#06b6d4",
  Crowdfunding: "#8b5cf6",
  Factoring: "#f59e0b",
  Insurtech: "#10b981",
  Neobancos: "#f43f5e",
  "Pagos Digitales": "#3b82f6",
  RegTech: "#f97316",
  WealthTech: "#84cc16",
};

function scoreLabel(score: number): { text: string; color: string } {
  if (score >= 0.7) return { text: "Alta", color: "text-emerald-600 bg-emerald-50" };
  if (score >= 0.55) return { text: "Media", color: "text-amber-600 bg-amber-50" };
  return { text: "Baja", color: "text-red-500 bg-red-50" };
}

export function SourceCard({
  chunk,
  index,
}: {
  chunk: RetrievedChunk;
  index: number;
}) {
  const { metadata, score } = chunk;
  const colors = VERTICAL_COLORS[metadata.tema] || DEFAULT_VERTICAL_COLOR;
  const borderColor = BORDER_HEX[metadata.tema] || "#94a3b8";
  const label = scoreLabel(score);

  return (
    <div
      className="animate-fade-up rounded-xl bg-card card-shadow border border-border/50 p-3.5 transition-shadow hover:card-shadow-hover"
      style={{
        animationDelay: `${index * 0.06}s`,
        borderLeftWidth: "3px",
        borderLeftColor: borderColor,
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

        {/* Score badge */}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${label.color}`}>
          {label.text}
        </span>
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
