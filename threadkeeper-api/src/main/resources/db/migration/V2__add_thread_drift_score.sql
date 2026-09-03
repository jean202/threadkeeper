-- Drift detection stores the computed score alongside the status so the UI can
-- show how far a thread has moved, not just whether it crossed the threshold.
alter table threads add column drift_score numeric(5,2);
