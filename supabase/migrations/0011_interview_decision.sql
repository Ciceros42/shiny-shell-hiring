ALTER TABLE interviews ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interviewer_score INT CHECK (interviewer_score BETWEEN 1 AND 5);
