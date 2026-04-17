-- ══════════════════════════════════════════════════════════════
-- NeuraNotes — Initial Database Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ══════════════════════════════════════════════════════════════

-- ── Enable Extensions ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- For gen_random_uuid()

-- ══════════════════════════════════════════════════════════════
-- TABLES
-- ══════════════════════════════════════════════════════════════

-- ── Users ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        VARCHAR(255),
    avatar_url  VARCHAR(2048),
    google_id   VARCHAR(255) UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    settings    JSONB DEFAULT '{}'::jsonb
);

-- ── Notes (core entity) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         VARCHAR(500),
    content       TEXT NOT NULL,
    content_type  VARCHAR(50) NOT NULL DEFAULT 'text',  -- text, url, pdf, voice, image
    source_url    VARCHAR(2048),
    file_path     VARCHAR(1024),     -- Supabase Storage path for files
    word_count    INTEGER DEFAULT 0,
    is_archived   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    metadata      JSONB DEFAULT '{}'::jsonb
);

-- ── Tags ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    VARCHAR(100) NOT NULL,
    color   VARCHAR(7) DEFAULT '#6366F1',
    UNIQUE(user_id, name)
);

-- ── Note-Tag Mapping ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- ── Note Chunks (for vector retrieval tracking) ──────────
CREATE TABLE IF NOT EXISTS note_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id     UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content     TEXT NOT NULL,
    token_count INTEGER,
    embedding   VECTOR(3072),  -- gemini-embedding-001 dimensions
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Conversations (chat sessions) ────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages (within conversations) ─────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
    content         TEXT NOT NULL,
    sources         JSONB DEFAULT '[]'::jsonb,  -- Referenced note IDs for citations
    subtasks        JSONB DEFAULT '[]'::jsonb,  -- Task decomposition trace
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════

-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_content_type ON notes(content_type);
CREATE INDEX IF NOT EXISTS idx_notes_user_archived ON notes(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_note_chunks_note_id ON note_chunks(note_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- HNSW index for fast vector similarity search
-- Uses cosine distance operator for semantic similarity
CREATE INDEX IF NOT EXISTS idx_note_chunks_embedding
    ON note_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

-- ══════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════

-- Semantic search function — called via Supabase RPC
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding VECTOR(3072),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 20,
    filter_user_id UUID DEFAULT NULL,
    filter_content_type TEXT DEFAULT NULL,
    filter_after TIMESTAMPTZ DEFAULT NULL,
    filter_before TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    chunk_id UUID,
    note_id UUID,
    chunk_content TEXT,
    chunk_index INT,
    similarity FLOAT,
    note_title VARCHAR(500),
    note_content_type VARCHAR(50),
    note_created_at TIMESTAMPTZ,
    note_source_url VARCHAR(2048)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        nc.id AS chunk_id,
        nc.note_id,
        nc.content AS chunk_content,
        nc.chunk_index,
        1 - (nc.embedding <=> query_embedding) AS similarity,
        n.title AS note_title,
        n.content_type AS note_content_type,
        n.created_at AS note_created_at,
        n.source_url AS note_source_url
    FROM note_chunks nc
    JOIN notes n ON nc.note_id = n.id
    WHERE
        nc.embedding IS NOT NULL
        AND 1 - (nc.embedding <=> query_embedding) > match_threshold
        AND (filter_user_id IS NULL OR n.user_id = filter_user_id)
        AND (filter_content_type IS NULL OR n.content_type = filter_content_type)
        AND (filter_after IS NULL OR n.created_at >= filter_after)
        AND (filter_before IS NULL OR n.created_at <= filter_before)
        AND n.is_archived = FALSE
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own data
CREATE POLICY users_own_data ON users
    FOR ALL USING (id = auth.uid());

CREATE POLICY notes_own_data ON notes
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY tags_own_data ON tags
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY note_tags_own_data ON note_tags
    FOR ALL USING (
        note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
    );

CREATE POLICY note_chunks_own_data ON note_chunks
    FOR ALL USING (
        note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
    );

CREATE POLICY conversations_own_data ON conversations
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY messages_own_data ON messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

-- ══════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ══════════════════════════════════════════════════════════════

-- Create storage bucket for file uploads (PDFs, audio, images)
-- Run this separately in Supabase Dashboard → Storage → New Bucket
-- Bucket name: neuranotes-files
-- Public: false
-- File size limit: 10MB
-- Allowed MIME types: application/pdf, audio/*, image/*
