-- Run this AFTER schema.sql in the Supabase SQL Editor
-- Creates an RPC function for vector similarity search

create or replace function match_chunks(
  query_embedding vector(384),
  match_workspace_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  page_number int,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
    select
      chunks.id,
      chunks.document_id,
      chunks.page_number,
      chunks.content,
      1 - (chunks.embedding <=> query_embedding) as similarity
    from chunks
    where chunks.workspace_id = match_workspace_id
    order by chunks.embedding <=> query_embedding
    limit match_count;
end;
$$;
