-- Migration: Add resume upload support to skill discovery
-- Allows users to optionally upload a resume during the discovery flow

ALTER TABLE discovery_sessions
ADD COLUMN linked_resume_parse_id UUID REFERENCES resume_parses(id) ON DELETE SET NULL;

CREATE INDEX idx_discovery_sessions_resume_id ON discovery_sessions(linked_resume_parse_id);
