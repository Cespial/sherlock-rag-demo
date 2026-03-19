"use client";

import { EXAMPLE_QUERIES } from "@/lib/data/taxonomy";
import type { SearchFilter } from "@/lib/rag/types";
import { MessageSquare } from "lucide-react";

interface QuerySuggestionsProps {
  onSelect: (query: string, filters?: SearchFilter) => void;
}

export function QuerySuggestions({ onSelect }: QuerySuggestionsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Consultas sugeridas:</p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((q, i) => (
          <button
            key={i}
            onClick={() =>
              onSelect(q.text, q.filters as SearchFilter | undefined)
            }
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:border-blue-600 hover:bg-gray-800 hover:text-gray-100"
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            {q.text}
          </button>
        ))}
      </div>
    </div>
  );
}
