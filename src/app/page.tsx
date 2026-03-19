"use client";

import { useState, useRef, useCallback } from "react";
import { ComparisonView } from "@/components/ComparisonView";
import { FilterChips } from "@/components/FilterChips";
import { QuerySuggestions } from "@/components/QuerySuggestions";
import { streamRAGQuery } from "@/lib/streaming";
import type { PanelState, SearchFilter, RetrievedChunk, StageTimings } from "@/lib/rag/types";
import { INITIAL_PANEL } from "@/lib/rag/types";
import { Search, Loader2 } from "lucide-react";

type BackendMode = "both" | "pinecone" | "pgvector";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilter>({});
  const [mode, setMode] = useState<BackendMode>("both");
  const [hasQueried, setHasQueried] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [panels, setPanels] = useState<Record<string, PanelState>>({
    pinecone: INITIAL_PANEL,
    pgvector: INITIAL_PANEL,
  });
  const abortRef = useRef<AbortController | null>(null);
  const answerRefs = useRef<Record<string, string>>({ pinecone: "", pgvector: "" });
  const rafRefs = useRef<Record<string, number | null>>({ pinecone: null, pgvector: null });

  const activeBackends: ("pinecone" | "pgvector")[] =
    mode === "both" ? ["pinecone", "pgvector"] : [mode];

  const executeQuery = useCallback(
    async (q: string, f: SearchFilter) => {
      if (!q.trim()) return;

      // Abort previous
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setHasQueried(true);
      setIsActive(true);

      const backends: ("pinecone" | "pgvector")[] =
        mode === "both" ? ["pinecone", "pgvector"] : [mode];

      // Reset panels
      const reset: Record<string, PanelState> = {};
      for (const b of backends) {
        reset[b] = { ...INITIAL_PANEL, status: "embedding" };
        answerRefs.current[b] = "";
      }
      setPanels(reset);

      const promises = backends.map((backend) =>
        streamRAGQuery(
          q,
          backend,
          f,
          {
            onEmbedding: () => {
              setPanels((p) => ({
                ...p,
                [backend]: { ...p[backend], status: "retrieving" },
              }));
            },
            onSources: (chunks: RetrievedChunk[], _ms: number) => {
              setPanels((p) => ({
                ...p,
                [backend]: { ...p[backend], sources: chunks, status: "generating" },
              }));
            },
            onToken: (text: string) => {
              answerRefs.current[backend] += text;
              // Throttle to animation frames
              if (!rafRefs.current[backend]) {
                rafRefs.current[backend] = requestAnimationFrame(() => {
                  const currentText = answerRefs.current[backend];
                  setPanels((p) => ({
                    ...p,
                    [backend]: { ...p[backend], answer: currentText },
                  }));
                  rafRefs.current[backend] = null;
                });
              }
            },
            onMetrics: (timings: StageTimings) => {
              setPanels((p) => ({
                ...p,
                [backend]: { ...p[backend], timings },
              }));
            },
            onDone: () => {
              // Final flush
              const finalText = answerRefs.current[backend];
              setPanels((p) => ({
                ...p,
                [backend]: { ...p[backend], answer: finalText, status: "done" },
              }));
            },
            onError: (msg: string) => {
              setPanels((p) => ({
                ...p,
                [backend]: { ...p[backend], status: "error", error: msg },
              }));
            },
          },
          controller.signal
        )
      );

      await Promise.allSettled(promises);
      setIsActive(false);
    },
    [mode]
  );

  function handleSubmit(overrideQuery?: string, overrideFilters?: SearchFilter) {
    executeQuery(overrideQuery ?? query, overrideFilters ?? filters);
  }

  function handleSuggestion(text: string, f?: SearchFilter) {
    setQuery(text);
    if (f) setFilters(f);
    executeQuery(text, f ?? filters);
  }

  // ─── Hero state (no query yet) ───
  if (!hasQueried) {
    return (
      <div className="dot-grid flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl space-y-8 animate-fade-up">
          {/* Brand */}
          <div className="text-center space-y-2">
            <h1
              className="text-5xl tracking-tight text-slate-100"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Sherlock
            </h1>
            <p className="text-sm text-slate-500">
              RAG architecture comparison — Pinecone vs pgvector
            </p>
            <p className="text-xs text-slate-600">
              222 documentos legales Fintech &middot; 8 verticales &middot; Colombia
            </p>
          </div>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="relative"
          >
            <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Consulta legal Fintech…"
              autoFocus
              className="w-full rounded-xl border border-border bg-card/80 py-4 pl-12 pr-28 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-border-bright transition-colors"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-950 transition-all hover:bg-accent-glow disabled:opacity-30"
            >
              Buscar
            </button>
          </form>

          {/* Backend toggle */}
          <div className="flex justify-center">
            <div className="flex rounded-lg border border-border bg-surface p-0.5">
              {(["both", "pinecone", "pgvector"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${
                    mode === m
                      ? "bg-card text-slate-200 shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {m === "both" ? "Ambos" : m === "pinecone" ? "Pinecone" : "pgvector"}
                </button>
              ))}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex justify-center">
            <FilterChips filters={filters} onChange={setFilters} />
          </div>

          {/* Suggestions */}
          <div className="animate-fade-up delay-3">
            <p className="mb-3 text-center text-[10px] font-medium text-slate-600 uppercase tracking-widest">
              Consultas sugeridas
            </p>
            <QuerySuggestions onSelect={handleSuggestion} />
          </div>
        </div>

        {/* Footer credit */}
        <p className="fixed bottom-4 text-[10px] text-slate-700">
          tensor.lat &middot; Pinecone &middot; Supabase &middot; Voyage AI &middot; Claude
        </p>
      </div>
    );
  }

  // ─── Results state ───
  return (
    <div className="dot-grid min-h-screen">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-border bg-base/90 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Brand (compact) */}
            <button
              onClick={() => {
                setHasQueried(false);
                setPanels({ pinecone: INITIAL_PANEL, pgvector: INITIAL_PANEL });
              }}
              className="shrink-0"
            >
              <span
                className="text-lg text-slate-300 hover:text-slate-100 transition-colors"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                Sherlock
              </span>
            </button>

            {/* Search bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="relative flex-1 max-w-xl"
            >
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Consulta legal Fintech…"
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-4 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-border-bright transition-colors"
              />
              {isActive && (
                <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-accent animate-spin" />
              )}
            </form>

            {/* Backend toggle */}
            <div className="hidden sm:flex rounded-lg border border-border bg-surface p-0.5">
              {(["both", "pinecone", "pgvector"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 text-[11px] font-medium transition-all ${
                    mode === m
                      ? "bg-card text-slate-200 shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {m === "both" ? "Ambos" : m === "pinecone" ? "Pinecone" : "pgvector"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Filter chips */}
      <div className="mx-auto max-w-7xl px-4 py-3">
        <FilterChips filters={filters} onChange={setFilters} />
      </div>

      {/* Results */}
      <main className="mx-auto max-w-7xl px-4 pb-12">
        <ComparisonView panels={panels} backends={activeBackends} />
      </main>
    </div>
  );
}
