-- Bank proof for agent signup (bank statement or cancelled cheque).
-- Canonical copy: Vivance-User-Repository/src/main/resources/db/alter_agent_user_bank_proof.sql

ALTER TABLE agent_user
    ADD COLUMN bank_proof VARCHAR(255) NULL AFTER bank_account_holder_name;
