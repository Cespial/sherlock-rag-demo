/**
 * Systematic benchmark of all RAG configurations.
 *
 * Runs 20 test queries × multiple configs against the local dev server.
 * Captures timing, retrieval scores, and configuration for each run.
 *
 * Usage:
 *   1. Start dev server: npm run dev (in another terminal)
 *   2. Run: npx tsx scripts/benchmark.ts
 *
 * Output: data/benchmark-results.json
 */
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";

interface TestQuery {
  query: string;
  expectedTema: string | null;
  type: "simple" | "complex" | "vague" | "comparative";
}

const TEST_QUERIES: TestQuery[] = [
  // Simple factual
  { query: "¿Qué es crowdfunding en Colombia?", expectedTema: "Crowdfunding", type: "simple" },
  { query: "¿Cuáles son los requisitos para operar como neobanco?", expectedTema: "Neobancos", type: "simple" },
  { query: "¿Qué es el factoring electrónico?", expectedTema: "Factoring", type: "simple" },
  { query: "¿Cómo se regula el scoring crediticio?", expectedTema: "Crédito Digital", type: "simple" },
  { query: "¿Qué es un SOFICO?", expectedTema: "Crowdfunding", type: "simple" },
  { query: "¿Qué es RADIAN y cómo funciona?", expectedTema: "Factoring", type: "simple" },

  // Complex multi-aspect
  { query: "¿Qué obligaciones de protección de datos tienen las fintech?", expectedTema: null, type: "complex" },
  { query: "¿Cuáles son las herramientas tecnológicas para gestión de riesgos?", expectedTema: null, type: "complex" },
  { query: "¿Qué normas regulan la firma electrónica en servicios financieros?", expectedTema: null, type: "complex" },
  { query: "¿Cómo funciona el audit trail en RegTech?", expectedTema: "RegTech", type: "complex" },

  // Vague / conceptual
  { query: "supervisión financiera innovación tecnológica", expectedTema: null, type: "vague" },
  { query: "inclusión financiera digital Colombia", expectedTema: null, type: "vague" },
  { query: "riesgos operativos plataformas digitales", expectedTema: null, type: "vague" },

  // Comparative (best for agent, but testing classic too)
  { query: "¿Qué diferencias hay entre crowdfunding y factoring?", expectedTema: null, type: "comparative" },
  { query: "Comparar regulación de insurtech con regtech", expectedTema: null, type: "comparative" },

  // Vertical-specific
  { query: "¿Qué son los challenger banks?", expectedTema: "Neobancos", type: "simple" },
  { query: "¿Cómo funciona el insurtech en Colombia?", expectedTema: "Insurtech", type: "simple" },
  { query: "¿Qué es RegTech y para qué sirve?", expectedTema: "RegTech", type: "simple" },
  { query: "¿Cómo se regula el robo-advisory?", expectedTema: "WealthTech", type: "simple" },
  { query: "¿Qué normativa aplica para billeteras digitales?", expectedTema: "Pagos Digitales", type: "simple" },
];

interface Config {
  strategy: string;
  embedding: string;
  backend: string;
  rerank: boolean;
}

const CONFIGS: Config[] = [];
for (const strategy of ["classic", "hyde", "multiquery"]) {
  for (const embedding of ["voyage", "openai"]) {
    for (const backend of ["pinecone", "pgvector"]) {
      for (const rerank of [false, true]) {
        CONFIGS.push({ strategy, embedding, backend, rerank });
      }
    }
  }
}

interface BenchmarkResult {
  query: string;
  queryType: string;
  expectedTema: string | null;
  config: Config;
  topScores: number[];
  topTemas: string[];
  temaMatch: boolean;
  answerLength: number;
  timings: Record<string, number>;
  error: string | null;
}

async function runSingleTest(
  query: string,
  config: Config
): Promise<Partial<BenchmarkResult>> {
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        backend: config.backend,
        embedding: config.embedding,
        strategy: config.strategy,
        rerank: config.rerank,
        speed: "haiku", // Always use haiku for benchmark speed
        topK: 5,
      }),
    });

    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let topScores: number[] = [];
    let topTemas: string[] = [];
    let timings: Record<string, number> = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (e.type === "sources") {
            topScores = e.chunks.map((c: { score: number }) => c.score);
            topTemas = e.chunks.map(
              (c: { metadata: { tema: string } }) => c.metadata.tema
            );
          } else if (e.type === "token") {
            answer += e.text;
          } else if (e.type === "metrics") {
            timings = e.timings;
          }
        } catch {
          // skip
        }
      }
    }

    return { topScores, topTemas, answerLength: answer.length, timings, error: null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

async function main() {
  console.log(
    `Benchmark: ${TEST_QUERIES.length} queries × ${CONFIGS.length} configs = ${TEST_QUERIES.length * CONFIGS.length} runs`
  );

  // Verify dev server is running
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    if (!healthRes.ok) throw new Error("Health check failed");
    console.log("Dev server is running ✓\n");
  } catch {
    console.error("ERROR: Dev server not running. Start it with: npm run dev");
    process.exit(1);
  }

  const results: BenchmarkResult[] = [];
  let completed = 0;
  const total = TEST_QUERIES.length * CONFIGS.length;

  for (const tq of TEST_QUERIES) {
    for (const config of CONFIGS) {
      completed++;
      const pct = ((completed / total) * 100).toFixed(1);
      process.stdout.write(
        `\r  [${pct}%] ${completed}/${total} — ${config.strategy}/${config.embedding}/${config.backend}${config.rerank ? "/rerank" : ""}          `
      );

      const partial = await runSingleTest(tq.query, config);

      const temaMatch =
        tq.expectedTema && partial.topTemas
          ? partial.topTemas.slice(0, 3).includes(tq.expectedTema)
          : false;

      results.push({
        query: tq.query,
        queryType: tq.type,
        expectedTema: tq.expectedTema,
        config,
        topScores: partial.topScores || [],
        topTemas: partial.topTemas || [],
        temaMatch: !!temaMatch,
        answerLength: partial.answerLength || 0,
        timings: partial.timings || {},
        error: partial.error || null,
      });

      // Small delay to avoid overwhelming the server
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(`\n\nCompleted ${results.length} runs`);

  // Save results
  const outPath = path.join(__dirname, "..", "data", "benchmark-results.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${outPath}`);

  // Quick summary
  const errors = results.filter((r) => r.error);
  const successful = results.filter((r) => !r.error);
  console.log(`\nSuccess: ${successful.length}, Errors: ${errors.length}`);

  if (successful.length > 0) {
    // Best config by avg top-1 score
    const byConfig = new Map<string, number[]>();
    for (const r of successful) {
      const key = `${r.config.strategy}/${r.config.embedding}/${r.config.backend}/${r.config.rerank}`;
      if (!byConfig.has(key)) byConfig.set(key, []);
      if (r.topScores.length > 0) byConfig.get(key)!.push(r.topScores[0]);
    }

    const ranked = [...byConfig.entries()]
      .map(([key, scores]) => ({
        key,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    console.log("\nTop 5 configs by avg top-1 retrieval score:");
    for (const r of ranked.slice(0, 5)) {
      console.log(`  ${r.avgScore.toFixed(4)} — ${r.key} (${r.count} runs)`);
    }
  }
}

main();
