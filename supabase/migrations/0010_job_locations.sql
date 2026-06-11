-- Jobs-to-locations assignment table
-- A job with NO entries here is shown at ALL locations for its company (backwards-compatible).
-- A job with at least one entry is only shown at the assigned locations.
CREATE TABLE IF NOT EXISTS job_locations (
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_job_locations_location ON job_locations (location_id);
