-- Dossara Database Schema
-- Run this in the Supabase SQL Editor after enabling the vector extension

create extension if not exists vector;

-- Documents table: tracks uploaded PDFs and their processing status
insert into storage.buckets (id, name, public) 
values ('documents', 'documents', true)
on conflict (id) do nothing;

create table documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  filename text not null,
  storage_path text not null,
  status text not null default 'uploaded', -- uploaded | processing | ready | failed
  page_count int,
  cursor int default 0,
  error_message text,
  created_at timestamptz default now()
);

-- Chunks table: stores text chunks with vector embeddings for similarity search
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  workspace_id uuid not null,
  page_number int not null,
  content text not null,
  embedding vector(384),
  created_at timestamptz default now()
);

-- HNSW index for fast cosine similarity searches on embeddings
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_workspace_idx on chunks (workspace_id);

-- Chat messages table: stores conversation history with citations
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  role text not null, -- user | assistant
  content text not null,
  citations jsonb,
  created_at timestamptz default now()
);
