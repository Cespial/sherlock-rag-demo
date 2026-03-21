/**
 * Analyze benchmark results and generate a comprehensive report.
 *
 * Reads: data/benchmark-results.json
 * Outputs: data/benchmark-report.md
 */
import * as fs from "fs";
import * as path from "path";

interface BenchmarkResult {
  query: string;
  queryType: string;
  expectedTema: string | null;
  config: {
    strategy: string;
    embedding: string;
    backend: string;
    rerank: boolean;
  };
  topScores: number[];
  topTemas: string[];
  temaMatch: boolean;
  answerLength: number;
  timings: Record<string, number>;
  error: string | null;
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function main() {
  const resultsPath = path.join(__dirname, "..", "data", "benchmark-results.json");
  const reportPath = path.join(__dirname, "..", "data", "benchmark-report.md");

  if (!fs.existsSync(resultsPath)) {
    console.error("No benchmark results found. Run benchmark.ts first.");
    process.exit(1);
  }

  const results: BenchmarkResult[] = JSON.parse(
    fs.readFileSync(resultsPath, "utf-8")
  );

  const successful = results.filter((r) => !r.error);
  const errors = results.filter((r) => r.error);

  const lines: string[] = [];
  lines.push("# Sherlock RAG Benchmark Report");
  lines.push("");
  lines.push(`**Date:** ${new Date().toISOString().split("T")[0]}`);
  lines.push(`**Total runs:** ${results.length} (${successful.length} success, ${errors.length} errors)`);
  lines.push(`**Queries:** ${new Set(results.map((r) => r.query)).size}`);
  lines.push(`**Configurations:** ${new Set(results.map((r) => `${r.config.strategy}/${r.config.embedding}/${r.config.backend}/${r.config.rerank}`)).size}`);
  lines.push("");

  // ─── Best config overall ───
  lines.push("## Best Configurations (by avg top-1 retrieval score)");
  lines.push("");
  lines.push("| Rank | Strategy | Embedding | Backend | Rerank | Avg Score | Avg Total ms | Tema Match % |");
  lines.push("|------|----------|-----------|---------|--------|-----------|-------------|-------------|");

  const byConfig = new Map<
    string,
    { scores: number[]; totalMs: number[]; temaMatches: number; count: number }
  >();

  for (const r of successful) {
    const key = `${r.config.strategy}|${r.config.embedding}|${r.config.backend}|${r.config.rerank}`;
    if (!byConfig.has(key))
      byConfig.set(key, { scores: [], totalMs: [], temaMatches: 0, count: 0 });
    const entry = byConfig.get(key)!;
    if (r.topScores.length > 0) entry.scores.push(r.topScores[0]);
    if (r.timings.total_ms) entry.totalMs.push(r.timings.total_ms);
    if (r.temaMatch) entry.temaMatches++;
    entry.count++;
  }

  const ranked = [...byConfig.entries()]
    .map(([key, data]) => {
      const [strategy, embedding, backend, rerank] = key.split("|");
      return {
        strategy,
        embedding,
        backend,
        rerank: rerank === "true",
        avgScore: avg(data.scores),
        avgTotalMs: avg(data.totalMs),
        temaMatchPct: data.count > 0 ? (data.temaMatches / data.count) * 100 : 0,
        count: data.count,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  for (let i = 0; i < Math.min(ranked.length, 10); i++) {
    const r = ranked[i];
    lines.push(
      `| ${i + 1} | ${r.strategy} | ${r.embedding} | ${r.backend} | ${r.rerank ? "Yes" : "No"} | ${r.avgScore.toFixed(4)} | ${Math.round(r.avgTotalMs)} | ${r.temaMatchPct.toFixed(0)}% |`
    );
  }

  // ─── Strategy comparison ───
  lines.push("");
  lines.push("## Strategy Comparison");
  lines.push("");
  lines.push("| Strategy | Avg Score | Median Total ms | Tema Match % |");
  lines.push("|----------|-----------|----------------|-------------|");

  const byStrategy = new Map<
    string,
    { scores: number[]; totalMs: number[]; matches: number; total: number }
  >();

  for (const r of successful) {
    const key = r.config.strategy;
    if (!byStrategy.has(key))
      byStrategy.set(key, { scores: [], totalMs: [], matches: 0, total: 0 });
    const entry = byStrategy.get(key)!;
    if (r.topScores.length > 0) entry.scores.push(r.topScores[0]);
    if (r.timings.total_ms) entry.totalMs.push(r.timings.total_ms);
    if (r.temaMatch) entry.matches++;
    entry.total++;
  }

  for (const [strat, data] of [...byStrategy.entries()].sort(
    (a, b) => avg(b[1].scores) - avg(a[1].scores)
  )) {
    lines.push(
      `| ${strat} | ${avg(data.scores).toFixed(4)} | ${Math.round(median(data.totalMs))} | ${((data.matches / data.total) * 100).toFixed(0)}% |`
    );
  }

  // ─── Embedding comparison ───
  lines.push("");
  lines.push("## Embedding Model Comparison");
  lines.push("");
  lines.push("| Embedding | Avg Score | Avg Embed ms |");
  lines.push("|-----------|-----------|-------------|");

  const byEmbed = new Map<string, { scores: number[]; embedMs: number[] }>();
  for (const r of successful) {
    const key = r.config.embedding;
    if (!byEmbed.has(key)) byEmbed.set(key, { scores: [], embedMs: [] });
    const entry = byEmbed.get(key)!;
    if (r.topScores.length > 0) entry.scores.push(r.topScores[0]);
    if (r.timings.embedding_ms) entry.embedMs.push(r.timings.embedding_ms);
  }

  for (const [emb, data] of byEmbed) {
    lines.push(
      `| ${emb} | ${avg(data.scores).toFixed(4)} | ${Math.round(avg(data.embedMs))} |`
    );
  }

  // ─── Backend comparison ───
  lines.push("");
  lines.push("## Backend Comparison");
  lines.push("");
  lines.push("| Backend | Avg Score | Avg Retrieval ms |");
  lines.push("|---------|-----------|-----------------|");

  const byBackend = new Map<string, { scores: number[]; retMs: number[] }>();
  for (const r of successful) {
    const key = r.config.backend;
    if (!byBackend.has(key)) byBackend.set(key, { scores: [], retMs: [] });
    const entry = byBackend.get(key)!;
    if (r.topScores.length > 0) entry.scores.push(r.topScores[0]);
    if (r.timings.retrieval_ms) entry.retMs.push(r.timings.retrieval_ms);
  }

  for (const [be, data] of byBackend) {
    lines.push(
      `| ${be} | ${avg(data.scores).toFixed(4)} | ${Math.round(avg(data.retMs))} |`
    );
  }

  // ─── Best config per query type ───
  lines.push("");
  lines.push("## Best Strategy per Query Type");
  lines.push("");
  lines.push("| Query Type | Best Strategy | Avg Score | Why |");
  lines.push("|-----------|--------------|-----------|-----|");

  const byType = new Map<string, Map<string, number[]>>();
  for (const r of successful) {
    if (!byType.has(r.queryType)) byType.set(r.queryType, new Map());
    const typeMap = byType.get(r.queryType)!;
    if (!typeMap.has(r.config.strategy)) typeMap.set(r.config.strategy, []);
    if (r.topScores.length > 0)
      typeMap.get(r.config.strategy)!.push(r.topScores[0]);
  }

  const whyMap: Record<string, string> = {
    simple: "Direct factual queries work well with basic vector search",
    complex: "Multiple aspects benefit from query expansion",
    vague: "Hypothetical documents bridge semantic gap",
    comparative: "Multiple searches cover both sides",
  };

  for (const [type, strategies] of byType) {
    let best = "";
    let bestAvg = 0;
    for (const [strat, scores] of strategies) {
      const a = avg(scores);
      if (a > bestAvg) {
        bestAvg = a;
        best = strat;
      }
    }
    lines.push(
      `| ${type} | ${best} | ${bestAvg.toFixed(4)} | ${whyMap[type] || ""} |`
    );
  }

  // ─── Rerank impact ───
  lines.push("");
  lines.push("## Rerank Impact");
  lines.push("");

  const withRerank = successful.filter((r) => r.config.rerank);
  const withoutRerank = successful.filter((r) => !r.config.rerank);

  const rerankScores = withRerank.filter((r) => r.topScores.length > 0).map((r) => r.topScores[0]);
  const noRerankScores = withoutRerank.filter((r) => r.topScores.length > 0).map((r) => r.topScores[0]);

  lines.push(`- **Without rerank:** avg top-1 score = ${avg(noRerankScores).toFixed(4)}`);
  lines.push(`- **With rerank:** avg top-1 score = ${avg(rerankScores).toFixed(4)}`);
  lines.push(
    `- **Delta:** ${((avg(rerankScores) - avg(noRerankScores)) * 100).toFixed(2)}% ${avg(rerankScores) > avg(noRerankScores) ? "improvement" : "decrease"}`
  );

  // Write report
  const report = lines.join("\n");
  fs.writeFileSync(reportPath, report);
  console.log(`Report written to ${reportPath}`);
  console.log("\n" + report);
}

main();
