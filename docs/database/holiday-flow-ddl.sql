-- Vivance Holidays flow — MySQL schema
-- All tables use prefix holidays_ (shared DB with flights, hotels, etc.)
--
-- Supports: Hero banner, Holiday Partners, Trending destinations,
-- destination listing, package detail (Itinerary / Details / Price / Terms)
--
-- Target: MySQL 8.0+ / MariaDB 10.5+ (InnoDB, utf8mb4)
-- Boolean flags use TINYINT (0/1) without display width (avoids MySQL 8.0.17+ deprecation warnings)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Drop existing holidays_* tables (safe to re-run full script)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS holidays_season_packages;
DROP TABLE IF EXISTS holidays_package_itinerary_highlights;
DROP TABLE IF EXISTS holidays_package_inclusions;
DROP TABLE IF EXISTS holidays_package_itinerary_days;
DROP TABLE IF EXISTS holidays_package_detail_sections;
DROP TABLE IF EXISTS holidays_package_hotels;
DROP TABLE IF EXISTS holidays_package_terms;
DROP TABLE IF EXISTS holidays_package_pricing_config;
DROP TABLE IF EXISTS holidays_tour_packages;
DROP TABLE IF EXISTS holidays_hero_slides;
DROP TABLE IF EXISTS holidays_hero_ticker_items;
DROP TABLE IF EXISTS holidays_departure_cities;
DROP TABLE IF EXISTS holidays_seasons;
DROP TABLE IF EXISTS holidays_package_categories;
DROP TABLE IF EXISTS holidays_destinations;

-- ---------------------------------------------------------------------------
-- Core reference
-- ---------------------------------------------------------------------------

CREATE TABLE holidays_destinations (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug            VARCHAR(120) NOT NULL,
    name            VARCHAR(120) NOT NULL,
    region          VARCHAR(32) NOT NULL,
    description     TEXT,
    hero_image_url  VARCHAR(500) DEFAULT NULL,
    starting_price  DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_active       TINYINT NOT NULL DEFAULT 1,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_holidays_destinations_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays_package_categories (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code            VARCHAR(64) NOT NULL,
    label           VARCHAR(120) NOT NULL,
    icon_key        VARCHAR(64) DEFAULT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       TINYINT NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_holidays_package_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hero carousel (Holidays + Holiday Partners shared banner)
CREATE TABLE holidays_hero_slides (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title           VARCHAR(200) NOT NULL,
    subtitle        VARCHAR(300) DEFAULT NULL,
    image_url       VARCHAR(500) NOT NULL,
    accent_class    VARCHAR(64) DEFAULT NULL,
    object_fit      VARCHAR(16) DEFAULT 'cover',
    object_position VARCHAR(32) DEFAULT NULL,
    zoom            DECIMAL(4, 2) DEFAULT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       TINYINT NOT NULL DEFAULT 1,
    rotate_ms       INT DEFAULT 5000,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays_hero_ticker_items (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    text            VARCHAR(200) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       TINYINT NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Destination listing page (category icons + package cards)
-- ---------------------------------------------------------------------------

CREATE TABLE holidays_tour_packages (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pkg_id          VARCHAR(32) NOT NULL,
    slug            VARCHAR(160) NOT NULL,
    destination_id  BIGINT UNSIGNED NOT NULL,
    category_id     BIGINT UNSIGNED NOT NULL,
    title           VARCHAR(200) NOT NULL,
    image_url       VARCHAR(500) NOT NULL,
    price           DECIMAL(12, 2) NOT NULL,
    days            INT NOT NULL,
    nights          INT NOT NULL,
    rating          DECIMAL(3, 1) NOT NULL DEFAULT 4.0,
    review_count    INT NOT NULL DEFAULT 0,
    badge           VARCHAR(64) DEFAULT NULL,
    has_detail_page TINYINT NOT NULL DEFAULT 0,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       TINYINT NOT NULL DEFAULT 1,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_holidays_tour_packages_pkg_id (pkg_id),
    UNIQUE KEY uk_holidays_tour_packages_dest_slug (destination_id, slug),
    KEY idx_holidays_tour_packages_destination (destination_id),
    KEY idx_holidays_tour_packages_category (category_id),
    CONSTRAINT fk_holidays_tour_packages_destination
        FOREIGN KEY (destination_id) REFERENCES holidays_destinations (id),
    CONSTRAINT fk_holidays_tour_packages_category
        FOREIGN KEY (category_id) REFERENCES holidays_package_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays_package_inclusions (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    package_id      BIGINT UNSIGNED NOT NULL,
    label           VARCHAR(64) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_holidays_package_inclusions_package (package_id),
    CONSTRAINT fk_holidays_package_inclusions_package
        FOREIGN KEY (package_id) REFERENCES holidays_tour_packages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Package detail page tabs
-- ---------------------------------------------------------------------------

CREATE TABLE holidays_package_itinerary_days (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    package_id      BIGINT UNSIGNED NOT NULL,
    day_number      INT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    meals           VARCHAR(120) DEFAULT NULL,
    accommodation   VARCHAR(200) DEFAULT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_holidays_itinerary_package_day (package_id, day_number),
    CONSTRAINT fk_holidays_itinerary_days_package
        FOREIGN KEY (package_id) REFERENCES holidays_tour_packages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays_package_itinerary_highlights (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    itinerary_day_id BIGINT UNSIGNED NOT NULL,
    highlight        VARCHAR(200) NOT NULL,
    sort_order       INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_holidays_itinerary_highlights_day (itinerary_day_id),
    CONSTRAINT fk_holidays_itinerary_highlights_day
        FOREIGN KEY (itinerary_day_id) REFERENCES holidays_package_itinerary_days (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays_package_detail_sections (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    package_id      BIGINT UNSIGNED NOT NULL,
    section_type    VARCHAR(32) NOT NULL,
    content         TEXT NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_holidays_detail_sections_package (package_id),
    CONSTRAINT fk_holidays_detail_sections_package
        FOREIGN KEY (package_id) REFERENCES holidays_tour_packages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays_package_hotels (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    package_id      BIGINT UNSIGNED NOT NULL,
    name            VARCHAR(200) NOT NULL,
    nights_label    VARCHAR(64) DEFAULT NULL,
    meal_plan       VARCHAR(120) DEFAULT NULL,
    tour_type       VARCHAR(32) DEFAULT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_holidays_package_hotels_package (package_id),
    CONSTRAINT fk_holidays_package_hotels_package
        FOREIGN KEY (package_id) REFERENCES holidays_tour_packages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays_package_terms (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    package_id      BIGINT UNSIGNED NOT NULL,
    term_text       TEXT NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_holidays_package_terms_package (package_id),
    CONSTRAINT fk_holidays_package_terms_package
        FOREIGN KEY (package_id) REFERENCES holidays_tour_packages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Calculate Price (form options / pricing rules — extend later)
CREATE TABLE holidays_package_pricing_config (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    package_id      BIGINT UNSIGNED NOT NULL,
    base_price      DECIMAL(12, 2) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'INR',
    allows_flights  TINYINT NOT NULL DEFAULT 1,
    tour_types      VARCHAR(120) DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_holidays_pricing_config_package (package_id),
    CONSTRAINT fk_holidays_pricing_config_package
        FOREIGN KEY (package_id) REFERENCES holidays_tour_packages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays_departure_cities (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code            VARCHAR(16) NOT NULL,
    name            VARCHAR(80) NOT NULL,
    is_active       TINYINT NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_holidays_departure_cities_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Seasonal section ("Not Sure When to Go or Where to Go?")
-- ---------------------------------------------------------------------------

CREATE TABLE holidays_seasons (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code            VARCHAR(16) NOT NULL,
    label           VARCHAR(32) NOT NULL,
    headline        TEXT,
    description     TEXT,
    background_url  VARCHAR(500) DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_holidays_seasons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays_season_packages (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    season_id       BIGINT UNSIGNED NOT NULL,
    package_id      BIGINT UNSIGNED DEFAULT NULL,
    title           VARCHAR(200) NOT NULL,
    image_url       VARCHAR(500) DEFAULT NULL,
    days_label      VARCHAR(32) DEFAULT NULL,
    price           DECIMAL(12, 2) DEFAULT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_holidays_season_packages_season (season_id),
    KEY idx_holidays_season_packages_package (package_id),
    CONSTRAINT fk_holidays_season_packages_season
        FOREIGN KEY (season_id) REFERENCES holidays_seasons (id),
    CONSTRAINT fk_holidays_season_packages_package
        FOREIGN KEY (package_id) REFERENCES holidays_tour_packages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Table index (quick reference)
-- ---------------------------------------------------------------------------
-- holidays_destinations
-- holidays_package_categories
-- holidays_hero_slides
-- holidays_hero_ticker_items
-- holidays_tour_packages
-- holidays_package_inclusions
-- holidays_package_itinerary_days
-- holidays_package_itinerary_highlights
-- holidays_package_detail_sections
-- holidays_package_hotels
-- holidays_package_terms
-- holidays_package_pricing_config
-- holidays_departure_cities
-- holidays_seasons
-- holidays_season_packages

-- ---------------------------------------------------------------------------
-- Sample data: run holiday-flow-seed.sql after this DDL
-- ---------------------------------------------------------------------------
