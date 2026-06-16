-- Mirror: Vivance-User-Repository/src/main/resources/db/alter_agent_user_signup_fields.sql
-- Adds company, bank, and city_name columns on agent_user.

ALTER TABLE agent_user
    ADD COLUMN corporate_id VARCHAR(32) NULL AFTER company_name,
    ADD COLUMN sales_person_name VARCHAR(100) NULL AFTER corporate_id,
    ADD COLUMN pan_card_holder_name VARCHAR(100) NULL AFTER pan_number,
    ADD COLUMN establishment_date DATE NULL AFTER office_phone,
    ADD COLUMN annual_transaction_amount DECIMAL(14, 2) NULL AFTER establishment_date,
    ADD COLUMN no_of_employees INT NULL AFTER annual_transaction_amount,
    ADD COLUMN city_name VARCHAR(128) NULL AFTER city,
    ADD COLUMN bank_account_number VARCHAR(32) NULL AFTER address_proof,
    ADD COLUMN bank_ifsc VARCHAR(11) NULL AFTER bank_account_number,
    ADD COLUMN bank_account_holder_name VARCHAR(100) NULL AFTER bank_ifsc;
