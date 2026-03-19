"use client";

import { useState, useRef, useCallback } from "react";
import { ComparisonView } from "@/components/ComparisonView";
import { FilterChips } from "@/components/FilterChips";
import { QuerySuggestions } from "@/components/QuerySuggestions";
import { AgentPanel, INITIAL_AGENT } from "@/components/AgentPanel";
import type { AgentPanelState, AgentStep } from "@/components/AgentPanel";
import { streamRAGQuery } from "@/lib/streaming";
import type {
  PanelState,
  SearchFilter,
  RetrievedChunk,
  StageTimings,
  QueryConfig,
} from "@/lib/rag/types";
import { INITIAL_PANEL } from "@/lib/rag/types";
import type { EmbeddingProvider } from "@/lib/rag/embeddings";
import type { LLMSpeed } from "@/lib/rag/claude";
import { Search, Loader2 } from "lucide-react";

type BackendMode = "both" | "pinecone" | "pgvector" | "agent";

function Toggle<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-white/70 p-0.5 card-shadow">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-full px-3 sm:px-4 py-1.5 text-[11px] font-medium transition-all ${
            value === o
              ? o === ("agent" as T)
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-text text-white shadow-sm"
              : "text-text-secondary hover:text-text"
          }`}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
  color = "bg-text",
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-all ${
        checked
          ? `${color} text-white border-transparent shadow-sm`
          : "border-border text-text-secondary hover:text-text bg-white/70"
      }`}
    >
      {label}
    </button>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilter>({});
  const [mode, setMode] = useState<BackendMode>("both");
  const [embedding, setEmbedding] = useState<EmbeddingProvider>("voyage");
  const [rerank, setRerank] = useState(false);
  const [speed, setSpeed] = useState<LLMSpeed>("sonnet");
  const [hasQueried, setHasQueried] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [panels, setPanels] = useState<Record<string, PanelState>>({
    pinecone: INITIAL_PANEL,
    pgvector: INITIAL_PANEL,
  });
  const [agentState, setAgentState] = useState<AgentPanelState>(INITIAL_AGENT);
  const [conversation, setConversation] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const abortRef = useRef<AbortController | null>(null);
  const answerRefs = useRef<Record<string, string>>({
    pinecone: "",
    pgvector: "",
    agent: "",
  });
  const rafRefs = useRef<Record<string, number | null>>({
    pinecone: null,
    pgvector: null,
    agent: null,
  });

  const activeBackends: ("pinecone" | "pgvector")[] =
    mode === "both" ? ["pinecone", "pgvector"] : mode === "agent" ? [] : [mode];

  // --- Agent streaming ---
  const executeAgentQuery = useCallback(
    async (q: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setHasQueried(true);
      setIsActive(true);
      answerRefs.current.agent = "";
      setAgentState({ ...INITIAL_AGENT, status: "thinking" });

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            embedding,
            speed,
            rerank,
            conversation,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setAgentState((s) => ({
            ...s,
            status: "error",
            error: (data as { error?: string }).error || `HTTP ${res.status}`,
          }));
          setIsActive(false);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) processAgentLine(buffer);
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!;
          for (const line of lines) processAgentLine(line);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAgentState((s) => ({
            ...s,
            status: "error",
            error: (err as Error).message,
          }));
        }
      }
      setIsActive(false);
    },
    [embedding, speed, rerank]
  );

  function processAgentLine(line: string) {
    if (!line.trim()) return;
    try {
      const e = JSON.parse(line);
      switch (e.type) {
        case "step":
          setAgentState((s) => ({
            ...s,
            status: "thinking",
            steps: [...s.steps, { type: "step", step: e.step } as AgentStep],
          }));
          break;
        case "thinking":
          setAgentState((s) => ({
            ...s,
            steps: [
              ...s.steps,
              { type: "thinking", text: e.text } as AgentStep,
            ],
          }));
          break;
        case "tool_call":
          setAgentState((s) => ({
            ...s,
            status: "searching",
            steps: [
              ...s.steps,
              { type: "tool_call", name: e.name, args: e.args } as AgentStep,
            ],
          }));
          break;
        case "tool_result":
          setAgentState((s) => ({
            ...s,
            steps: [
              ...s.steps,
              {
                type: "tool_result",
                name: e.name,
                count: e.count,
                topScore: e.topScore,
              } as AgentStep,
            ],
          }));
          break;
        case "token":
          answerRefs.current.agent += e.text;
          if (!rafRefs.current.agent) {
            rafRefs.current.agent = requestAnimationFrame(() => {
              setAgentState((s) => ({
                ...s,
                status: "generating",
                answer: answerRefs.current.agent,
              }));
              rafRefs.current.agent = null;
            });
          }
          break;
        case "sources":
          setAgentState((s) => ({ ...s, sources: e.chunks }));
          break;
        case "metrics":
          setAgentState((s) => ({ ...s, metrics: e.timings }));
          break;
        case "done": {
          const finalAnswer = answerRefs.current.agent;
          setAgentState((s) => ({
            ...s,
            status: "done",
            answer: finalAnswer,
          }));
          // Save to conversation history
          setConversation((prev) => [
            ...prev,
            { role: "user" as const, content: query },
            { role: "assistant" as const, content: finalAnswer },
          ]);
          break;
        }
        case "error":
          setAgentState((s) => ({
            ...s,
            status: "error",
            error: e.message,
          }));
          break;
      }
    } catch {
      // skip
    }
  }

  // --- Classic RAG streaming ---
  const executeClassicQuery = useCallback(
    async (q: string, f: SearchFilter) => {
      if (!q.trim()) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setHasQueried(true);
      setIsActive(true);

      const backends: ("pinecone" | "pgvector")[] =
        mode === "both" ? ["pinecone", "pgvector"] : [mode as "pinecone" | "pgvector"];

      const config: QueryConfig = {
        backend: "pinecone",
        embedding,
        rerank,
        speed,
      };

      const reset: Record<string, PanelState> = {};
      for (const b of backends) {
        reset[b] = { ...INITIAL_PANEL, status: "embedding", config: { ...config, backend: b } };
        answerRefs.current[b] = "";
      }
      setPanels(reset);

      const promises = backends.map((backend) =>
        streamRAGQuery(
          q, backend, f,
          {
            onEmbedding: () =>
              setPanels((p) => ({ ...p, [backend]: { ...p[backend], status: "retrieving" } })),
            onSources: (chunks: RetrievedChunk[]) =>
              setPanels((p) => ({ ...p, [backend]: { ...p[backend], sources: chunks, status: "generating" } })),
            onRerank: () =>
              setPanels((p) => ({ ...p, [backend]: { ...p[backend], status: "reranking" } })),
            onToken: (text: string) => {
              answerRefs.current[backend] += text;
              if (!rafRefs.current[backend]) {
                rafRefs.current[backend] = requestAnimationFrame(() => {
                  setPanels((p) => ({ ...p, [backend]: { ...p[backend], answer: answerRefs.current[backend] } }));
                  rafRefs.current[backend] = null;
                });
              }
            },
            onMetrics: (timings: StageTimings) =>
              setPanels((p) => ({ ...p, [backend]: { ...p[backend], timings } })),
            onDone: () => {
              const finalText = answerRefs.current[backend];
              setPanels((p) => ({ ...p, [backend]: { ...p[backend], answer: finalText, status: "done" } }));
            },
            onError: (msg: string) =>
              setPanels((p) => ({ ...p, [backend]: { ...p[backend], status: "error", error: msg } })),
          },
          { embedding, rerank, speed },
          controller.signal
        )
      );

      await Promise.allSettled(promises);
      setIsActive(false);
    },
    [mode, embedding, rerank, speed]
  );

  function handleSubmit(overrideQuery?: string, overrideFilters?: SearchFilter) {
    const q = overrideQuery ?? query;
    if (mode === "agent") {
      executeAgentQuery(q);
    } else {
      executeClassicQuery(q, overrideFilters ?? filters);
    }
  }

  function handleSuggestion(text: string, f?: SearchFilter) {
    setQuery(text);
    if (f) setFilters(f);
    handleSubmit(text, f);
  }

  function resetAll() {
    setHasQueried(false);
    setPanels({ pinecone: INITIAL_PANEL, pgvector: INITIAL_PANEL });
    setAgentState(INITIAL_AGENT);
    setConversation([]);
  }

  const controlsBar = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Toggle
        options={["both", "pinecone", "pgvector", "agent"] as BackendMode[]}
        value={mode}
        onChange={setMode}
        labels={{
          both: "Ambos",
          pinecone: "Pinecone",
          pgvector: "pgvector",
          agent: "Agente",
        }}
      />
      <Toggle
        options={["voyage", "openai"] as EmbeddingProvider[]}
        value={embedding}
        onChange={setEmbedding}
        labels={{ voyage: "Voyage", openai: "OpenAI" }}
      />
      <Toggle
        options={["sonnet", "haiku"] as LLMSpeed[]}
        value={speed}
        onChange={setSpeed}
        labels={{ sonnet: "Sonnet", haiku: "Haiku" }}
      />
      <Check label="Rerank" checked={rerank} onChange={setRerank} color="bg-amber-500" />
    </div>
  );

  // ─── Hero ───
  if (!hasQueried) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 overflow-hidden">
        <video autoPlay muted loop playsInline poster="/hero-poster.jpg" className="absolute inset-0 w-full h-full object-cover opacity-40">
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 hero-gradient" />

        <div className="relative z-10 w-full max-w-2xl space-y-8 animate-fade-up">
          <div className="text-center space-y-3">
            <h1 className="text-6xl sm:text-7xl tracking-tight text-text" style={{ fontFamily: "var(--font-display), serif" }}>
              Sherlock
            </h1>
            <p className="text-[15px] text-text-secondary">
              Comparación de arquitecturas RAG para búsqueda legal Fintech
            </p>
            <p className="text-[12px] text-text-tertiary">
              222 documentos &middot; 8 verticales &middot; Multi-embedding &middot; Reranking &middot; Modo Agente
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary" />
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribe una consulta legal Fintech…" autoFocus
                className="w-full rounded-2xl border border-border bg-white/80 py-4.5 pl-14 pr-32 text-[15px] text-text outline-none placeholder:text-text-tertiary focus:border-border-hover focus:bg-white card-shadow-hover transition-all"
              />
              <button type="submit" disabled={!query.trim()}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl bg-text px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-80 disabled:opacity-20">
                Buscar
              </button>
            </div>
          </form>

          {controlsBar}
          <div className="flex justify-center"><FilterChips filters={filters} onChange={setFilters} /></div>

          <div className="animate-fade-up delay-3">
            <p className="mb-4 text-center text-[10px] font-medium text-text-tertiary uppercase tracking-[0.15em]">Consultas sugeridas</p>
            <QuerySuggestions onSelect={handleSuggestion} />
          </div>
        </div>

        <p className="fixed bottom-5 text-[10px] text-text-tertiary tracking-wide z-10">
          tensor.lat &middot; Claude &middot; Voyage AI &middot; OpenAI &middot; Cohere &middot; Pinecone &middot; Supabase
        </p>
      </div>
    );
  }

  // ─── Results ───
  return (
    <div className="min-h-screen bg-surface/40">
      <header className="sticky top-0 z-20 frosted border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={resetAll} className="shrink-0">
              <span className="text-xl text-text hover:opacity-60 transition-opacity" style={{ fontFamily: "var(--font-display), serif" }}>
                Sherlock
              </span>
            </button>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Consulta legal Fintech…"
                className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-[13px] text-text outline-none placeholder:text-text-tertiary focus:border-border-hover transition-colors"
              />
              {isActive && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary animate-spin" />}
            </form>
            <div className="hidden lg:block">{controlsBar}</div>
          </div>
          <div className="lg:hidden mt-2.5 overflow-x-auto">{controlsBar}</div>
        </div>
      </header>

      {mode !== "agent" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <FilterChips filters={filters} onChange={setFilters} />
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pb-16 pt-4">
        {mode === "agent" ? (
          <AgentPanel state={agentState} conversation={conversation} />
        ) : (
          <ComparisonView panels={panels} backends={activeBackends} />
        )}
      </main>
    </div>
  );
}
