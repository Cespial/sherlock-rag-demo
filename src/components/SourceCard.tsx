"use client";

import { FileText } from "lucide-react";
import type { RetrievedChunk } from "@/lib/rag/types";

export function SourceCard({
  chunk,
  index,
}: {
  chunk: RetrievedChunk;
  index: number;
}) {
  const { metadata, score } = chunk;
  const scorePercent = (score * 100).toFixed(1);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-400" />
          <span className="font-medium text-gray-200">
            Fuente {index + 1}
          </span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-mono ${
            score > 0.8
              ? "bg-emerald-900/50 text-emerald-300"
              : score > 0.6
                ? "bg-yellow-900/50 text-yellow-300"
                : "bg-red-900/50 text-red-300"
          }`}
        >
          {scorePercent}%
        </span>
      </div>

      <p className="mb-2 line-clamp-3 text-gray-300">{metadata.extracto}</p>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {metadata.tema && (
          <span className="rounded bg-blue-900/40 px-1.5 py-0.5 text-blue-300">
            {metadata.tema}
          </span>
        )}
        {metadata.filtroTipo && (
          <span className="rounded bg-purple-900/40 px-1.5 py-0.5 text-purple-300">
            {metadata.filtroTipo}
          </span>
        )}
        {metadata.filtroAutoridad && (
          <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-amber-300">
            {metadata.filtroAutoridad}
          </span>
        )}
        {metadata.filtroAno && (
          <span className="rounded bg-gray-700 px-1.5 py-0.5 text-gray-300">
            {metadata.filtroAno}
          </span>
        )}
      </div>

      {metadata.documentoOrigen && (
        <p className="mt-2 truncate text-xs text-gray-500">
          {metadata.documentoOrigen}
        </p>
      )}
    </div>
  );
}
