"use client";

import { EXAMPLE_QUERIES } from "@/lib/data/taxonomy";
import type { SearchFilter } from "@/lib/rag/types";

interface QuerySuggestionsProps {
  onSelect: (query: string, filters?: SearchFilter) => void;
}

export function QuerySuggestions({ onSelect }: QuerySuggestionsProps) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {EXAMPLE_QUERIES.map((q, i) => (
        <button
          key={i}
          onClick={() =>
            onSelect(q.text, q.filters as SearchFilter | undefined)
          }
          className={`animate-fade-up delay-${i + 1} group rounded-2xl bg-card card-shadow border border-transparent p-4 text-left transition-all hover:card-shadow-hover hover:border-border`}
        >
          <p className="text-[13px] leading-relaxed text-text-secondary group-hover:text-text transition-colors">
            {q.text}
          </p>
          {q.filters?.tema && (
            <span className="mt-2.5 inline-block text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
              {q.filters.tema}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
