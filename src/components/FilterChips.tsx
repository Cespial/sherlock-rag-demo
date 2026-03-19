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
        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
          !filters.tema
            ? "bg-slate-700 text-slate-100 ring-1 ring-slate-500"
            : "bg-slate-800/40 text-slate-500 hover:text-slate-300"
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
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              active
                ? `${colors.bg} ${colors.text} ring-1 ${colors.border}`
                : "bg-slate-800/40 text-slate-500 hover:text-slate-300 hover:bg-slate-800/70"
            }`}
          >
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                active ? colors.dot : "bg-slate-600"
              }`}
            />
            {tema}
          </button>
        );
      })}
    </div>
  );
}
