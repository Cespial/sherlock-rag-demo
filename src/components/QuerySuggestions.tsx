"use client";

import { EXAMPLE_QUERIES } from "@/lib/data/taxonomy";
import type { SearchFilter } from "@/lib/rag/types";

interface QuerySuggestionsProps {
  onSelect: (query: string, filters?: SearchFilter) => void;
}

export function QuerySuggestions({ onSelect }: QuerySuggestionsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {EXAMPLE_QUERIES.map((q, i) => (
        <button
          key={i}
          onClick={() =>
            onSelect(q.text, q.filters as SearchFilter | undefined)
          }
          className={`animate-fade-up delay-${i + 1} group rounded-lg border border-border bg-card/50 p-3.5 text-left transition-all hover:border-border-bright hover:bg-card`}
        >
          <p className="text-sm leading-snug text-slate-300 group-hover:text-slate-100 transition-colors">
            {q.text}
          </p>
          {q.filters?.tema && (
            <span className="mt-2 inline-block text-[10px] text-slate-600">
              {q.filters.tema}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
