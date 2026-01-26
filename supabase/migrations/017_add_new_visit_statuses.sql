/* Add new visit statuses: potential and already_client */

/* Drop old constraint and add new one with additional statuses */
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE visits ADD CONSTRAINT visits_status_check 
  CHECK (status IN ('visited', 'interested', 'demo_planned', 'not_interested', 'potential', 'already_client'));
