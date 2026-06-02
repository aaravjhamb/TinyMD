ALTER TABLE entries ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Backfill positions per project, preserving the current editor order.
WITH ordered AS (
  SELECT id,
         (row_number() OVER (PARTITION BY project_id ORDER BY pinned DESC, created_at DESC) - 1) AS rn
    FROM entries
)
UPDATE entries e
   SET position = o.rn
  FROM ordered o
 WHERE e.id = o.id;

CREATE INDEX IF NOT EXISTS entries_project_position_idx ON entries (project_id, position);
