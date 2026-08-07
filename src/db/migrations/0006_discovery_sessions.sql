-- Migration: Add skill discovery session tables
-- Supports interactive skill discovery dashboard (M4)

CREATE TYPE discovery_session_status AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

CREATE TABLE discovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status discovery_session_status NOT NULL DEFAULT 'ACTIVE',
  target_occupation_id UUID REFERENCES occupations(id) ON DELETE SET NULL,
  quiz_responses JSONB,
  narrative_content TEXT,
  narrative_metadata JSONB,
  extraction_confidence REAL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_discovery_sessions_user_id ON discovery_sessions(user_id);
CREATE INDEX idx_discovery_sessions_status ON discovery_sessions(status);

CREATE TABLE discovery_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
  skill_name VARCHAR(150) NOT NULL,
  proficiency_level VARCHAR(50) NOT NULL DEFAULT 'INTERMEDIATE',
  confidence REAL NOT NULL DEFAULT 0.5,
  evidence_snippet TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_discovery_skills_session_id ON discovery_skills(session_id);

CREATE TABLE user_skill_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_skill_id UUID NOT NULL UNIQUE REFERENCES user_skills(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_skill_sources_source_type ON user_skill_sources(source_type);

CREATE TABLE discovery_gap_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
  occupation_id UUID NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
  matched_skills JSONB NOT NULL,
  gap_skills JSONB NOT NULL,
  match_score REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, occupation_id)
);

CREATE INDEX idx_discovery_gap_analysis_session_id ON discovery_gap_analysis(session_id);
