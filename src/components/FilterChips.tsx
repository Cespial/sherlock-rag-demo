"use client";

import { TEMAS } from "@/lib/data/taxonomy";
import { VERTICAL_COLORS, DEFAULT_VERTICAL_COLOR } from "@/lib/data/taxonomy";
import type { SearchFilter } from "@/lib/rag/types";

interface FilterChipsProps {
  filters: SearchFilter;
  onChange: (filters: SearchFilter) => void;
}

export function FilterChips({ filters, onChange }: FilterChipsProps) {
  function toggleTema(tema: string) {
    onChange({
      ...filters,
      tema: filters.tema === tema ? undefined : tema,
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange({ ...filters, tema: undefined })}
        className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all ${
          !filters.tema
            ? "bg-text text-white shadow-sm"
            : "bg-transparent text-text-secondary hover:text-text hover:bg-surface"
        }`}
      >
        Todos
      </button>

      {TEMAS.map((tema) => {
        const colors = VERTICAL_COLORS[tema] || DEFAULT_VERTICAL_COLOR;
        const active = filters.tema === tema;
        return (
          <button
            key={tema}
            onClick={() => toggleTema(tema)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all ${
              active
                ? `${colors.pill} shadow-sm ring-1 ${colors.border}`
                : "bg-transparent text-text-secondary hover:text-text hover:bg-surface"
            }`}
          >
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                active ? colors.dot : "bg-gray-300"
              }`}
            />
            {tema}
          </button>
        );
      })}
    </div>
  );
}
