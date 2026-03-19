"use client";

import { TEMAS, FILTRO_TIPOS, FILTRO_AUTORIDADES } from "@/lib/data/taxonomy";
import type { SearchFilter } from "@/lib/rag/types";
import { Filter, X } from "lucide-react";

interface FilterSidebarProps {
  filters: SearchFilter;
  onChange: (filters: SearchFilter) => void;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4 rounded-xl border border-gray-700 bg-gray-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-200">Filtros</h3>
        </div>
        {hasFilters && (
          <button
            onClick={() => onChange({})}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>

      <SelectField
        label="Tema / Vertical"
        value={filters.tema || ""}
        options={TEMAS}
        onChange={(v) => onChange({ ...filters, tema: v || undefined })}
      />

      <SelectField
        label="Tipo de documento"
        value={filters.tipo || ""}
        options={FILTRO_TIPOS}
        onChange={(v) => onChange({ ...filters, tipo: v || undefined })}
      />

      <SelectField
        label="Autoridad"
        value={filters.autoridad || ""}
        options={FILTRO_AUTORIDADES}
        onChange={(v) => onChange({ ...filters, autoridad: v || undefined })}
      />

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-400">Año</label>
        <input
          type="text"
          placeholder="Ej: 2024"
          value={filters.ano || ""}
          onChange={(e) =>
            onChange({ ...filters, ano: e.target.value || undefined })
          }
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}
