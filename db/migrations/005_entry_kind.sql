ALTER TABLE entries ADD COLUMN IF NOT EXISTS kind   TEXT    NOT NULL DEFAULT 'journal';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS entries_project_order_idx
  ON entries (project_id, pinned DESC, created_at DESC);
