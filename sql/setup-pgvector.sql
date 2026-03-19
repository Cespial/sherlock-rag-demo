-- Enable pgvector extension
create extension if not exists vector;

-- Create table for fintech documents
create table if not exists fintech_documents (
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

-- HNSW index for fast approximate nearest neighbor search
create index if not exists fintech_documents_embedding_idx
  on fintech_documents
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Indexes for metadata filtering
create index if not exists fintech_documents_tema_idx on fintech_documents (tema);
create index if not exists fintech_documents_tipo_idx on fintech_documents (filtro_tipo);
create index if not exists fintech_documents_autoridad_idx on fintech_documents (filtro_autoridad);
create index if not exists fintech_documents_ano_idx on fintech_documents (filtro_ano);

-- RPC function for filtered vector search
create or replace function match_fintech_documents(
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
    from fintech_documents fd
    where
      (filter_tema is null or fd.tema = filter_tema)
      and (filter_tipo is null or fd.filtro_tipo = filter_tipo)
      and (filter_autoridad is null or fd.filtro_autoridad = filter_autoridad)
      and (filter_ano is null or fd.filtro_ano = filter_ano)
    order by fd.embedding <=> query_embedding
    limit match_count;
end;
$$;
