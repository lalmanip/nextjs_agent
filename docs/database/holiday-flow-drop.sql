-- Drop all holidays_* tables only (run before holiday-flow-ddl.sql if needed separately)
-- Target: MySQL 8.0+

SET FOREIGN_KEY_CHECKS = 0;

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

SET FOREIGN_KEY_CHECKS = 1;
