ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS projects_is_public_idx ON projects (is_public) WHERE is_public = true;
