"use client";

import { useState } from "react";
import { ComparisonView } from "@/components/ComparisonView";
import { FilterSidebar } from "@/components/FilterSidebar";
import { QuerySuggestions } from "@/components/QuerySuggestions";
import type { RAGResponse, SearchFilter } from "@/lib/rag/types";
import { Search, Loader2, Zap } from "lucide-react";

type BackendMode = "both" | "pinecone" | "pgvector";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilter>({});
  const [mode, setMode] = useState<BackendMode>("both");
  const [results, setResults] = useState<RAGResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    overrideQuery?: string,
    overrideFilters?: SearchFilter
  ) {
    const q = overrideQuery ?? query;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          backend: mode,
          filters: overrideFilters ?? filters,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestion(text: string, suggestedFilters?: SearchFilter) {
    setQuery(text);
    if (suggestedFilters) setFilters(suggestedFilters);
    handleSubmit(text, suggestedFilters);
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Sherlock RAG Demo
              </h1>
              <p className="text-xs text-gray-500">
                Pinecone vs pgvector — 252 docs, 8 verticales Fintech
              </p>
            </div>
          </div>

          {/* Backend toggle */}
          <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-0.5">
            {(["both", "pinecone", "pgvector"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === m
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {m === "both"
                  ? "Ambos"
                  : m === "pinecone"
                    ? "Pinecone"
                    : "pgvector"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <FilterSidebar filters={filters} onChange={setFilters} />
          </aside>

          {/* Main content */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Search bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Escribe tu consulta legal Fintech..."
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 py-3 pl-10 pr-4 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </button>
            </form>

            {/* Mobile filters */}
            <div className="lg:hidden">
              <FilterSidebar filters={filters} onChange={setFilters} />
            </div>

            {/* Suggestions (when no results) */}
            {results.length === 0 && !loading && !error && (
              <QuerySuggestions onSelect={handleSuggestion} />
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center gap-3 py-12 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Buscando en {mode === "both" ? "ambas arquitecturas" : mode}...</span>
              </div>
            )}

            {/* Results */}
            <ComparisonView results={results} />
          </div>
        </div>
      </main>
    </div>
  );
}
