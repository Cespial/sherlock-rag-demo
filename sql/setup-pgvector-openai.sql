-- Table for OpenAI embeddings (same schema, separate table)
create table if not exists fintech_documents_openai (
  id text primary key,
  tema text not null,
  subtema text not null default '',
  extracto text not null,
  documento_origen text not null default '',
  filtro_tipo text not null default '',
  filtro_autoridad text not null default '',
  filtro_ano text not null default '',
  terminos_relacionados text not null default '',
  terminos_equivalentes text not null default '',
  embedding_text text not null,
  embedding vector(1024) not null,
  created_at timestamptz default now()
);

-- HNSW index
create index if not exists fintech_documents_openai_embedding_idx
  on fintech_documents_openai
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Metadata indexes
create index if not exists fintech_documents_openai_tema_idx on fintech_documents_openai (tema);
create index if not exists fintech_documents_openai_tipo_idx on fintech_documents_openai (filtro_tipo);

-- RPC function for OpenAI embeddings search
create or replace function match_fintech_documents_openai(
  query_embedding vector(1024),
  match_count int default 8,
  filter_tema text default null,
  filter_tipo text default null,
  filter_autoridad text default null,
  filter_ano text default null
)
returns table (
  id text,
  similarity float,
  tema text,
  subtema text,
  extracto text,
  documento_origen text,
  filtro_tipo text,
  filtro_autoridad text,
  filtro_ano text,
  terminos_relacionados text,
  terminos_equivalentes text,
  embedding_text text
)
language plpgsql
as $$
begin
  return query
    select
      fd.id,
      1 - (fd.embedding <=> query_embedding) as similarity,
      fd.tema,
      fd.subtema,
      fd.extracto,
      fd.documento_origen,
      fd.filtro_tipo,
      fd.filtro_autoridad,
      fd.filtro_ano,
      fd.terminos_relacionados,
      fd.terminos_equivalentes,
      fd.embedding_text
    from fintech_documents_openai fd
    where
      (filter_tema is null or fd.tema = filter_tema)
      and (filter_tipo is null or fd.filtro_tipo = filter_tipo)
      and (filter_autoridad is null or fd.filtro_autoridad = filter_autoridad)
      and (filter_ano is null or fd.filtro_ano = filter_ano)
    order by fd.embedding <=> query_embedding
    limit match_count;
end;
$$;
