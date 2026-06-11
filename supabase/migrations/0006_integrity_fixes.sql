-- 0006_integrity_fixes.sql
-- Addresses two integrity findings:
--   Finding 20: applications.job_id FK lacks ON DELETE SET NULL — a deleted job
--               would either block deletion or orphan the FK depending on client
--               behaviour. Replace with explicit ON DELETE SET NULL so removing a
--               job gracefully nulls the reference on existing applications.
--   Finding 21: questions.deleted_at exists (added in 0001) but has no supporting
--               partial index, making "active questions" queries do full scans.
--               Add a partial index and a column comment documenting the soft-delete
--               contract.

-- ============================================================
-- Finding 20: fix applications.job_id FK → ON DELETE SET NULL
-- ============================================================

-- Drop the auto-generated FK from 0004 if it exists (name follows Postgres convention)
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_job_id_fkey;

-- Re-add with explicit ON DELETE SET NULL
ALTER TABLE applications
  ADD CONSTRAINT applications_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;

-- ============================================================
-- Finding 21: partial index + comment for questions.deleted_at
-- ============================================================

-- questions.deleted_at already exists (defined in 0001_initial_schema.sql).
-- No column addition needed — just add the partial index and protective comment.

CREATE INDEX IF NOT EXISTS idx_questions_active
  ON questions(question_set_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN questions.deleted_at IS
  'Soft delete — never hard-delete questions with live screen_answers references';
