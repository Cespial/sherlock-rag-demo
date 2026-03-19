"use client";

import { useEffect, useState } from "react";
import type { StageTimings } from "@/lib/rag/types";

function AnimatedNum({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const dur = 500;
    const start = performance.now();
    function tick() {
      const p = Math.min((performance.now() - start) / dur, 1);
      setDisplay(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);
  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display)}</>;
}

interface MetricsBarProps {
  timings: StageTimings;
  accent?: "pinecone" | "pgvector";
}

export function MetricsBar({ timings, accent = "pinecone" }: MetricsBarProps) {
  const total = timings.total_ms || 1;
  const accentClass = accent === "pinecone" ? "text-pinecone" : "text-pgvector";

  const stages = [
    { label: "Embed", ms: timings.embedding_ms, bar: "bg-gray-300" },
    {
      label: "Retrieval",
      ms: timings.retrieval_ms,
      bar: accent === "pinecone" ? "bg-cyan-400" : "bg-violet-400",
    },
    {
      label: "LLM",
      ms: timings.generation_ms,
      bar: accent === "pinecone" ? "bg-cyan-600" : "bg-violet-600",
    },
  ];

  return (
    <div className="animate-fade-up rounded-xl bg-surface/80 p-3.5">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
          Latencia
        </span>
        <span className={`text-base font-semibold font-mono ${accentClass}`}>
          <AnimatedNum value={total / 1000} decimals={2} />
          <span className="text-[11px] text-text-tertiary ml-0.5">s</span>
        </span>
      </div>

      {/* Bar */}
      <div className="flex h-1 overflow-hidden rounded-full bg-gray-100 mb-2.5">
        {stages.map((s) => (
          <div
            key={s.label}
            className={`${s.bar} animate-score-grow`}
            style={{ width: `${Math.max((s.ms / total) * 100, 1)}%` }}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex gap-4 text-[10px]">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${s.bar}`} />
            <span className="text-text-tertiary">{s.label}</span>
            <span className="font-mono text-text-secondary">
              {s.ms >= 1000 ? `${(s.ms / 1000).toFixed(1)}s` : `${s.ms}ms`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
