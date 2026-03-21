# Sherlock RAG Benchmark Report

**Date:** 2026-03-21
**Total runs:** 480 (480 success, 0 errors)
**Queries:** 20
**Configurations:** 24

## Best Configurations (by avg top-1 retrieval score)

| Rank | Strategy | Embedding | Backend | Rerank | Avg Score | Avg Total ms | Tema Match % |
|------|----------|-----------|---------|--------|-----------|-------------|-------------|
| 1 | hyde | voyage | pgvector | No | 0.7806 | 7226 | 60% |
| 2 | hyde | voyage | pinecone | No | 0.7742 | 7538 | 60% |
| 3 | hyde | openai | pinecone | No | 0.6768 | 7928 | 60% |
| 4 | hyde | openai | pgvector | No | 0.6738 | 7433 | 55% |
| 5 | multiquery | openai | pgvector | No | 0.6186 | 6264 | 60% |
| 6 | multiquery | openai | pinecone | No | 0.6147 | 6404 | 60% |
| 7 | classic | openai | pgvector | No | 0.6076 | 4360 | 60% |
| 8 | classic | openai | pinecone | No | 0.6075 | 4947 | 60% |
| 9 | classic | voyage | pgvector | No | 0.6046 | 4504 | 60% |
| 10 | classic | voyage | pinecone | No | 0.6046 | 4654 | 60% |

## Strategy Comparison

| Strategy | Avg Score | Median Total ms | Tema Match % |
|----------|-----------|----------------|-------------|
| hyde | 0.5641 | 7772 | 59% |
| classic | 0.5051 | 4720 | 60% |
| multiquery | 0.5041 | 6372 | 60% |

## Embedding Model Comparison

| Embedding | Avg Score | Avg Embed ms |
|-----------|-----------|-------------|
| voyage | 0.5305 | 317 |
| openai | 0.5183 | 494 |

## Backend Comparison

| Backend | Avg Score | Avg Retrieval ms |
|---------|-----------|-----------------|
| pinecone | 0.5238 | 966 |
| pgvector | 0.5251 | 864 |

## Best Strategy per Query Type

| Query Type | Best Strategy | Avg Score | Why |
|-----------|--------------|-----------|-----|
| simple | hyde | 0.5940 | Direct factual queries work well with basic vector search |
| complex | hyde | 0.5478 | Multiple aspects benefit from query expansion |
| vague | hyde | 0.5362 | Hypothetical documents bridge semantic gap |
| comparative | hyde | 0.4745 | Multiple searches cover both sides |

## Rerank Impact

- **Without rerank:** avg top-1 score = 0.6440
- **With rerank:** avg top-1 score = 0.4049
- **Delta:** -23.91% decrease