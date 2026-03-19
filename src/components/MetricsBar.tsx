"use client";

import type { StageTimings } from "@/lib/rag/types";

export function MetricsBar({ timings }: { timings: StageTimings }) {
  const total = timings.total_ms || 1;
  const stages = [
    { label: "Embedding", ms: timings.embedding_ms, color: "bg-blue-500" },
    { label: "Retrieval", ms: timings.retrieval_ms, color: "bg-emerald-500" },
    { label: "Generation", ms: timings.generation_ms, color: "bg-purple-500" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Latencia total</span>
        <span className="font-mono">{(total / 1000).toFixed(2)}s</span>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-800">
        {stages.map((s) => (
          <div
            key={s.label}
            className={`${s.color} transition-all`}
            style={{ width: `${(s.ms / total) * 100}%` }}
            title={`${s.label}: ${s.ms}ms`}
          />
        ))}
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${s.color}`} />
            <span>
              {s.label}: {s.ms}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
