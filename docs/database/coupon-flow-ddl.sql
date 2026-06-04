-- Mirror of Vivance-User-Repository/src/main/resources/db/create_coupon_tables.sql
-- Apply on vivance_java, then run seed_coupon_sample.sql in that repo.

CREATE TABLE IF NOT EXISTS coupon (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL COMMENT 'Uppercase code, e.g. SAVE10',
    description VARCHAR(512) NULL,
    discount_type VARCHAR(16) NOT NULL COMMENT 'PERCENT or FLAT',
    discount_value DECIMAL(14, 2) NOT NULL COMMENT 'Percent 0-100 or flat INR amount',
    max_discount_amount DECIMAL(14, 2) NULL COMMENT 'Cap for PERCENT discounts',
    min_booking_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    valid_from DATE NULL,
    valid_to DATE NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE, INACTIVE, EXPIRED',
    global_usage_limit INT NULL COMMENT 'NULL = unlimited',
    per_user_limit INT NOT NULL DEFAULT 1,
    applies_to VARCHAR(16) NOT NULL DEFAULT 'FLIGHT' COMMENT 'FLIGHT, HOTEL, ALL',
    allowed_channel VARCHAR(16) NOT NULL DEFAULT 'ALL' COMMENT 'B2B, B2C, ALL',
    stackable TINYINT(1) NOT NULL DEFAULT 0,
    created_by_id INT NULL,
    created_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_coupon_code (code),
    KEY idx_coupon_status (status),
    KEY idx_coupon_valid (valid_from, valid_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupon_application (
    id BIGINT NOT NULL AUTO_INCREMENT,
    applied_token VARCHAR(64) NOT NULL,
    coupon_id BIGINT NOT NULL,
    user_oid BIGINT NOT NULL,
    channel VARCHAR(16) NOT NULL COMMENT 'B2B or B2C',
    promo_code VARCHAR(64) NOT NULL,
    discount_amount DECIMAL(14, 2) NOT NULL,
    fare_before DECIMAL(14, 2) NOT NULL,
    fare_after DECIMAL(14, 2) NOT NULL,
    result_token_hash VARCHAR(128) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, RELEASED, REDEEMED',
    expires_at DATETIME NOT NULL,
    created_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_coupon_application_token (applied_token),
    KEY idx_coupon_application_user (user_oid, status),
    KEY idx_coupon_application_coupon (coupon_id, status),
    KEY idx_coupon_application_expires (expires_at),
    CONSTRAINT fk_coupon_application_coupon FOREIGN KEY (coupon_id) REFERENCES coupon (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupon_redemption (
    id BIGINT NOT NULL AUTO_INCREMENT,
    coupon_id BIGINT NOT NULL,
    coupon_application_id BIGINT NULL,
    user_oid BIGINT NOT NULL,
    channel VARCHAR(16) NOT NULL,
    promo_code VARCHAR(64) NOT NULL,
    discount_amount DECIMAL(14, 2) NOT NULL,
    fare_before DECIMAL(14, 2) NOT NULL,
    fare_after DECIMAL(14, 2) NOT NULL,
    app_reference VARCHAR(64) NULL,
    payment_order_id VARCHAR(128) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'REDEEMED' COMMENT 'REDEEMED, REVERSED',
    redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_coupon_redemption_coupon (coupon_id, status),
    KEY idx_coupon_redemption_user (user_oid, status),
    KEY idx_coupon_redemption_app_ref (app_reference),
    CONSTRAINT fk_coupon_redemption_coupon FOREIGN KEY (coupon_id) REFERENCES coupon (id),
    CONSTRAINT fk_coupon_redemption_application FOREIGN KEY (coupon_application_id) REFERENCES coupon_application (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupon_audit_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    event_type VARCHAR(32) NOT NULL COMMENT 'VALIDATE_SUCCESS, VALIDATE_FAIL, LOCK, REDEEM, RELEASE',
    coupon_id BIGINT NULL,
    user_oid BIGINT NULL,
    promo_code VARCHAR(64) NULL,
    applied_token VARCHAR(64) NULL,
    app_reference VARCHAR(64) NULL,
    discount_amount DECIMAL(14, 2) NULL,
    detail_message VARCHAR(512) NULL,
    ip_address VARCHAR(64) NULL,
    created_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_coupon_audit_event (event_type, created_datetime),
    KEY idx_coupon_audit_user (user_oid, created_datetime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
