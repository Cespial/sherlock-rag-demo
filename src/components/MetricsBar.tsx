"use client";

import { useEffect, useState } from "react";
import type { StageTimings } from "@/lib/rag/types";

function AnimatedNumber({ value, suffix = "ms" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    function tick() {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span className="font-mono tabular-nums">
      {display}
      <span className="text-slate-600">{suffix}</span>
    </span>
  );
}

interface MetricsBarProps {
  timings: StageTimings;
  accent?: "cyan" | "violet";
}

export function MetricsBar({ timings, accent = "cyan" }: MetricsBarProps) {
  const total = timings.total_ms || 1;
  const accentColor = accent === "cyan" ? "text-cyan-400" : "text-violet-400";

  const stages = [
    {
      label: "Embed",
      ms: timings.embedding_ms,
      bg: "bg-slate-600",
    },
    {
      label: "Retrieval",
      ms: timings.retrieval_ms,
      bg: accent === "cyan" ? "bg-cyan-500" : "bg-violet-500",
    },
    {
      label: "LLM",
      ms: timings.generation_ms,
      bg: accent === "cyan" ? "bg-cyan-700" : "bg-violet-700",
    },
  ];

  return (
    <div className="animate-fade-up space-y-2 rounded-lg bg-surface/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Latencia
        </span>
        <span className={`text-sm font-mono font-semibold ${accentColor}`}>
          <AnimatedNumber value={Math.round(total)} suffix="ms" />
        </span>
      </div>

      {/* Bar */}
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-800/60">
        {stages.map((s) => (
          <div
            key={s.label}
            className={`${s.bg} animate-score-grow transition-all`}
            style={{ width: `${Math.max((s.ms / total) * 100, 1)}%` }}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-slate-500">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full ${s.bg}`} />
            <span>{s.label}</span>
            <span className="font-mono text-slate-600">{s.ms}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}
