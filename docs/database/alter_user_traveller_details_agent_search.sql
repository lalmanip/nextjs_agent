-- Run on vivance_java before deploying agent saved-passenger typeahead.
-- Source of truth: Vivance-User-Repository/src/main/resources/db/alter_user_traveller_details_agent_search.sql

ALTER TABLE user_traveller_details
  ADD COLUMN phone_number VARCHAR(20) NULL AFTER gender,
  ADD COLUMN lead_passenger_name VARCHAR(100) NULL AFTER phone_number,
  ADD COLUMN pan_number VARCHAR(12) NULL AFTER lead_passenger_name;

CREATE INDEX idx_utd_user_name_search
  ON user_traveller_details (user_id, first_name, last_name);
