-- Resume Parser Tables (Milestone 1)

-- Enum for parse status
CREATE TYPE parse_status AS ENUM (
  'PENDING',
  'EXTRACTING',
  'EXTRACTED',
  'PARSING',
  'COMPLETED',
  'FAILED',
  'NEEDS_REVIEW'
);

-- Resumes: uploaded file metadata
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_format VARCHAR(20) NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  file_size_bytes INTEGER NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Resume parses: extracted structured data + quality metrics
CREATE TABLE IF NOT EXISTS resume_parses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL UNIQUE REFERENCES resumes(id) ON DELETE CASCADE,
  status parse_status NOT NULL DEFAULT 'PENDING',
  extracted_data JSONB,
  provenance JSONB,
  overall_confidence REAL DEFAULT 0,
  field_confidence JSONB,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_reasons TEXT,
  error_message TEXT,
  parsing_version VARCHAR(50) DEFAULT '1.0',
  parsed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Parse corrections: labeled dataset from human review
CREATE TABLE IF NOT EXISTS parse_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parse_id UUID NOT NULL REFERENCES resume_parses(id) ON DELETE CASCADE,
  corrected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  field_path TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT NOT NULL,
  notes TEXT,
  corrected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cost tracking for LLM + OCR
CREATE TABLE IF NOT EXISTS parse_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parse_id UUID NOT NULL UNIQUE REFERENCES resume_parses(id) ON DELETE CASCADE,
  llm_cost_usd REAL DEFAULT 0,
  ocr_cost_usd REAL DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indices for common queries
CREATE INDEX idx_resumes_uploaded_by_user_id ON resumes(uploaded_by_user_id);
CREATE INDEX idx_resumes_file_hash ON resumes(file_hash);
CREATE INDEX idx_resume_parses_status ON resume_parses(status);
CREATE INDEX idx_resume_parses_needs_review ON resume_parses(needs_review);
CREATE INDEX idx_parse_corrections_parse_id ON parse_corrections(parse_id);
