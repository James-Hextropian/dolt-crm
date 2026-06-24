-- MEDDIC/MEDDPIC qualification columns on deals table

ALTER TABLE deals
  ADD COLUMN meddic_metrics          TEXT NULL,
  ADD COLUMN meddic_economic_buyer   TEXT NULL,
  ADD COLUMN meddic_decision_criteria TEXT NULL,
  ADD COLUMN meddic_decision_process  TEXT NULL,
  ADD COLUMN meddic_identify_pain    TEXT NULL,
  ADD COLUMN meddic_champion         TEXT NULL,
  ADD COLUMN meddic_paper_process    TEXT NULL,
  ADD COLUMN meddic_score            INT NOT NULL DEFAULT 0;
