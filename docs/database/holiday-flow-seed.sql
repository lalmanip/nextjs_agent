-- Vivance Holidays — sample data from current hardcoded UI
-- Run AFTER holiday-flow-ddl.sql (tables must exist; data only, no DROP)
--
-- Sources:
--   HolidayHeroBanner.tsx, TrendingDestinations.tsx, SeasonalWhenWhere.tsx
--   InternationalPackagePage.tsx, holidayPackages.ts (Mauritius Classic detail)
--
-- Note: Listing pages still *generate* extra package cards per category in the UI.
--       This seed stores static tiles + full detail for PKG-MRU-CLASSIC-001 only.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Clear seed data (optional re-run). Child tables first.
DELETE FROM holidays_season_packages;
DELETE FROM holidays_package_itinerary_highlights;
DELETE FROM holidays_package_inclusions;
DELETE FROM holidays_package_itinerary_days;
DELETE FROM holidays_package_detail_sections;
DELETE FROM holidays_package_hotels;
DELETE FROM holidays_package_terms;
DELETE FROM holidays_package_pricing_config;
DELETE FROM holidays_tour_packages;
DELETE FROM holidays_hero_slides;
DELETE FROM holidays_hero_ticker_items;
DELETE FROM holidays_departure_cities;
DELETE FROM holidays_seasons;
DELETE FROM holidays_package_categories;
DELETE FROM holidays_destinations;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Destinations (TrendingDestinations + InternationalPackagePage DESTINATIONS)
-- ---------------------------------------------------------------------------

INSERT INTO holidays_destinations (id, slug, name, region, description, hero_image_url, starting_price, sort_order) VALUES
(1,  'mauritius-tour-packages',           'Mauritius',                 'international', 'Beach escapes, turquoise lagoons, island resorts, and relaxed holiday experiences.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1400&h=520&fit=crop&q=80', 37700.00,  1),
(2,  'japan-tour-packages',               'Japan',                     'international', 'Tokyo lights, Kyoto heritage, Mt. Fuji views, cherry blossoms, and curated cultural journeys.', 'https://images.unsplash.com/photo-1540959375944-7049f642e9a0?w=1400&h=520&fit=crop&q=80', 194500.00, 2),
(3,  'vietnam-tour-packages',             'Vietnam',                   'international', 'Scenic bays, lantern-lit towns, street food, heritage walks, and beautiful coastal escapes.', 'https://images.unsplash.com/photo-1559592413-7cec0d0c2990?w=1400&h=520&fit=crop&q=80', 32020.00,  3),
(4,  'singapore-malaysia-tour-packages',  'Singapore and Malaysia',    'international', 'Modern skylines, family attractions, shopping districts, theme parks, and multi-city fun.', 'https://images.unsplash.com/photo-1525626924447-227843c56f82?w=1400&h=520&fit=crop&q=80', 64000.00,  4),
(5,  'bali-tour-packages',                'Bali',                      'international', 'Temples, beaches, villas, rice terraces, honeymoon stays, and wellness retreats.', 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1400&h=520&fit=crop&q=80', 21000.00,  5),
(6,  'thailand-tour-packages',            'Thailand',                  'international', 'Islands, beaches, nightlife, temples, markets, and easy family-friendly getaways.', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&h=520&fit=crop&q=80', 22999.00,  6),
(7,  'dubai-tour-packages',               'Dubai',                     'international', 'Luxury stays, desert safaris, shopping, theme parks, skyline views, and family experiences.', 'https://images.unsplash.com/photo-1548013146-72479768bada?w=1400&h=520&fit=crop&q=80', 24999.00,  7),
(8,  'north-east-tour-packages',          'North East',                'india',         'Explore India and neighbouring destinations with curated packages.', '/ghaat.jpg', 18900.00,  1),
(9,  'andaman-tour-packages',             'Andaman',                   'india',         'Explore India and neighbouring destinations with curated packages.', 'https://images.unsplash.com/photo-1559127294-7c057b122f83?w=600&h=800&fit=crop&q=80', 17300.00,  2),
(10, 'varanasi-tour-packages',            'Varanasi',                  'india',         'Explore India and neighbouring destinations with curated packages.', '/ghaat.jpg', 8999.00,   3),
(11, 'spiritual-tour-packages',           'Spiritual',                 'india',         'Explore India and neighbouring destinations with curated packages.', '/ganga_aarti.jpg', 12100.00, 4),
(12, 'himalaya-tour-packages',            'Himalaya',                  'india',         'Explore India and neighbouring destinations with curated packages.', '/Himalaya.jpg', 18999.00, 5),
(13, 'tadoba-safari-tour-packages',       'Tadoba Safari',             'india',         'Explore India and neighbouring destinations with curated packages.', '/tiger.jpg', 14999.00,  6),
(14, 'swarved-mahamandir-packages',        'Swarved Mahamandir',        'india',         'Explore India and neighbouring destinations with curated packages.', '/SwarvedMahaMandir.jpg', 6999.00, 7);

-- ---------------------------------------------------------------------------
-- Package categories (InternationalPackagePage CATEGORIES)
-- ---------------------------------------------------------------------------

INSERT INTO holidays_package_categories (id, code, label, icon_key, sort_order) VALUES
(1, 'best-seller',  'Best Seller Packages',      'best-seller',  1),
(2, 'group',        'Group Packages',              'group',        2),
(3, 'senior',       'Senior Citizen Special',      'senior',       3),
(4, 'customized',   'Customized Packages',         'customized',   4),
(5, 'honeymoon',    'Honeymoon Special',           'honeymoon',    5),
(6, 'budget',       'Budget Packages',             'budget',       6);

-- ---------------------------------------------------------------------------
-- Hero carousel (HolidayHeroBanner HERO_SLIDES)
-- ---------------------------------------------------------------------------

INSERT INTO holidays_hero_slides (id, title, subtitle, image_url, object_fit, object_position, sort_order, rotate_ms) VALUES
(1, 'Step Into a Love Story',              'Experience the Timeless Majesty of the Taj Mahal, Agra',                    '/taj.jpg',                'cover',   'center', 1, 5000),
(2, 'The Wild Calls Your Name',            'Thrilling Tiger Safaris in the Heart of Tadoba National Park',              '/tiger.jpg',              'contain', 'center', 2, 5000),
(3, 'A Divine Night to Remember',          'Witness the Spiritual Grandeur of Swarved Mahamandir, Varanasi',           '/SwarvedMahaMandir.jpg',  'cover',   'center', 3, 5000),
(4, 'Mornings That Slow You Down',         'Soak in the Timeless Serenity of Varanasi''s Ancient Ghats',               '/ghaat.jpg',              'cover',   'center', 4, 5000),
(5, 'Meet the Soul of India',              'Immerse Yourself in the Spiritual Culture and Living Traditions of Varanasi', '/saadhu.jpg',             'cover',   'center', 5, 5000),
(6, 'Let the Sacred Flames Guide You',     'Be Part of the Mystical Ganga Aarti at the Ghats of Varanasi',             '/ganga_aarti.jpg',        'cover',   'center', 6, 5000);

-- ---------------------------------------------------------------------------
-- Hero ticker (HolidayHeroBanner TICKER_ITEMS)
-- ---------------------------------------------------------------------------

INSERT INTO holidays_hero_ticker_items (id, text, sort_order) VALUES
(1, 'Best-in-Class Tour Managers',                    1),
(2, 'Pioneers of Group Holidays',                     2),
(3, 'Proudly Creating Holidays for Over 75 Years',    3),
(4, 'Safe, Seamless Travel for Every Age Group',      4),
(5, 'Fully Customizable Holiday Packages',            5),
(6, 'India''s Favourite Travel Partner',              6),
(7, '1,000+ Unique Travel Experiences',               7);

-- ---------------------------------------------------------------------------
-- Departure cities (InternationalPackageDetailPage Calculate Price)
-- ---------------------------------------------------------------------------

INSERT INTO holidays_departure_cities (id, code, name) VALUES
(1, 'mumbai',     'Mumbai'),
(2, 'delhi',      'Delhi'),
(3, 'bengaluru',  'Bengaluru');

-- ---------------------------------------------------------------------------
-- Seasons (SeasonalWhenWhere SEASON_CONTENT)
-- ---------------------------------------------------------------------------

INSERT INTO holidays_seasons (id, code, label, headline, description, background_url) VALUES
(1, 'winter',  'Winter',  'Feel the winter charm with Vivance''s specially curated holiday packages!', 'Whether it''s skiing down powdery slopes or enjoying a snug fireside stay, the ideal winter weather and experiences are ready for you.', 'https://images.unsplash.com/photo-1509316785289-0252006092d4?w=1920&h=800&fit=crop&q=80'),
(2, 'summer',  'Summer',  'Feel the summer vibes with our exclusive holiday packages!', 'From sun-kissed beaches to vibrant city escapes, soak up the perfect weather and create unforgettable memories. Your dream summer getaway awaits with Vivance!', 'https://images.unsplash.com/photo-1509316785289-0252006092d4?w=1920&h=800&fit=crop&q=80'),
(3, 'monsoon', 'Monsoon', 'Monsoon moods, made memorable with Vivance!', 'Let the rains rejuvenate your spirit as you explore scenic destinations wrapped in the beauty of the monsoon season.', 'https://images.unsplash.com/photo-1509316785289-0252006092d4?w=1920&h=800&fit=crop&q=80');

INSERT INTO holidays_season_packages (season_id, package_id, title, image_url, days_label, price, sort_order) VALUES
-- Winter
(1, NULL, 'Himachal - Shimla Manali',                  '/Himalaya.jpg', '6 Days', 23320.00,  1),
(1, NULL, 'Kashmir - Pahalgam Gulmarg Special',        '/mountain.jpg', '7 Days', 46900.00,  2),
(1, NULL, 'Uttarakhand - Queen Of Hills',              'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&q=80', '3 Days', 14440.00, 3),
(1, NULL, 'Sikkim - Awesome Gangtok',                  'https://images.unsplash.com/photo-1472396961693-142e6e26973b?w=600&h=400&fit=crop&q=80', '4 Days', 24330.00, 4),
-- Summer
(2, NULL, 'Gujarat And Madhya Pradesh - Char Jyotirlinga Tour', '/SwarvedMahaMandir.jpg', '8 Days', 46600.00, 1),
(2, NULL, 'Passionate Paris',                          'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=400&fit=crop&q=80', '4 Days', 81746.00, 2),
(2, NULL, 'Wonderful Bali - Honeymoon Special',        'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=600&h=400&fit=crop&q=80', '5 Days', 26562.00, 3),
(2, NULL, 'Truly Dubai',                               'https://images.unsplash.com/photo-1548013146-72479768bada?w=600&h=400&fit=crop&q=80', '6 Days', 29556.00, 4),
-- Monsoon
(3, NULL, 'Hills of Kerala',                           'https://images.unsplash.com/photo-1602216052126-03a032634a34?w=600&h=400&fit=crop&q=80', '4 Days', 17320.00, 1),
(3, NULL, 'Munnar Calling',                            'https://images.unsplash.com/photo-1593693397690-362cb6890497?w=600&h=400&fit=crop&q=80', '4 Days', 13300.00, 2),
(3, NULL, 'Magical Nepal',                             'https://images.unsplash.com/photo-1544735716-392fe3899bb1?w=600&h=400&fit=crop&q=80', '7 Days', 37499.00, 3),
(3, NULL, 'Wonders Of Shillong And Guwahati',          'https://images.unsplash.com/photo-1472396961693-142e6e26973b?w=600&h=400&fit=crop&q=80', '5 Days', 29899.00, 4);

-- ---------------------------------------------------------------------------
-- Mauritius Best Seller listing cards (InternationalPackagePage buildPackages)
-- Only package id=1 has full detail page (holidayPackages.ts)
-- ---------------------------------------------------------------------------

INSERT INTO holidays_tour_packages (
    id, pkg_id, slug, destination_id, category_id, title, image_url,
    price, days, nights, rating, review_count, badge, has_detail_page, sort_order
) VALUES
(1, 'PKG-MRU-CLASSIC-001', 'mauritius-classic-package', 1, 1,
 'Mauritius Classic Package', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1400&h=520&fit=crop&q=80',
 37700.00, 5, 4, 4.5, 128, 'Recommended', 1, 1),
(2, 'PKG-MRU-PREMIUM-001', 'mauritius-premium-package', 1, 1,
 'Mauritius Premium Package', 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=700&h=460&fit=crop&q=80',
 50200.00, 7, 6, 4.5, 375, 'Best Value', 0, 2),
(3, 'PKG-MRU-FULL-001', 'mauritius-fully-loaded-package', 1, 1,
 'Mauritius Fully Loaded Package', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=700&h=460&fit=crop&q=80',
 62700.00, 9, 8, 4.7, 622, NULL, 0, 3);

-- Card hover inclusions (best-seller category)
INSERT INTO holidays_package_inclusions (package_id, label, sort_order) VALUES
(1, 'Hotel', 1), (1, 'Flight', 2), (1, 'Visa', 3), (1, 'Meals', 4), (1, 'Sightseeing', 5), (1, 'Transfers', 6),
(2, 'Hotel', 1), (2, 'Flight', 2), (2, 'Visa', 3), (2, 'Meals', 4), (2, 'Sightseeing', 5), (2, 'Transfers', 6),
(3, 'Hotel', 1), (3, 'Flight', 2), (3, 'Visa', 3), (3, 'Meals', 4), (3, 'Sightseeing', 5), (3, 'Transfers', 6);

-- ---------------------------------------------------------------------------
-- Mauritius Classic — detail tabs (holidayPackages.ts PKG-MRU-CLASSIC-001)
-- ---------------------------------------------------------------------------

INSERT INTO holidays_package_itinerary_days (package_id, day_number, title, description, meals, accommodation, sort_order) VALUES
(1, 1, 'Arrive in Mauritius', 'Welcome to Mauritius. Transfer to your beach resort. Evening at leisure by the lagoon.', 'Dinner', '4★ Beach Resort — Port Louis area', 1),
(1, 2, 'North Island Tour', 'Full-day sightseeing covering Port Louis, Caudan Waterfront, and northern coastal views.', 'Breakfast, Lunch', '4★ Beach Resort', 2),
(1, 3, 'South & Chamarel', 'Explore the south — Chamarel coloured earth, waterfalls, and scenic viewpoints.', 'Breakfast, Lunch', '4★ Beach Resort', 3),
(1, 4, 'Leisure Day', 'Free day to enjoy the beach, optional water sports, or spa at the resort.', 'Breakfast', '4★ Beach Resort', 4),
(1, 5, 'Departure', 'Check out and transfer to airport for your return flight.', 'Breakfast', '—', 5);

INSERT INTO holidays_package_itinerary_highlights (itinerary_day_id, highlight, sort_order) VALUES
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 1), 'Airport transfer', 1),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 1), 'Resort check-in', 2),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 1), 'Welcome dinner', 3),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 2), 'Port Louis city tour', 1),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 2), 'Waterfront visit', 2),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 2), 'Photo stops', 3),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 3), 'Chamarel 7 Coloured Earth', 1),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 3), 'Waterfall visit', 2),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 3), 'South coast drive', 3),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 4), 'Beach leisure', 1),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 4), 'Optional activities', 2),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 4), 'Sunset views', 3),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 5), 'Hotel check-out', 1),
((SELECT id FROM holidays_package_itinerary_days WHERE package_id = 1 AND day_number = 5), 'Airport transfer', 2);

INSERT INTO holidays_package_detail_sections (package_id, section_type, content, sort_order) VALUES
(1, 'location_highlight', '{"location":"PORT LOUIS","items":["Caudan Waterfront stroll","Central Market visit","Photo stops at harbour views"]}', 6),
(1, 'location_highlight', '{"location":"SOUTH ISLAND","items":["Chamarel 7 Coloured Earth","Waterfall visit","Scenic south coast drive"]}', 7),
(1, 'whats_more', 'Welcome drink on arrival', 8),
(1, 'whats_more', 'Resort orientation walk', 9),
(1, 'whats_more', 'Optional sunset cruise (on request)', 10),
(1, 'highlights', 'Round-trip flights from major Indian cities (optional add-on)', 1),
(1, 'highlights', '4 nights at a handpicked 4★ beach resort', 2),
(1, 'highlights', 'North & South island sightseeing tours', 3),
(1, 'highlights', 'Visa assistance and travel insurance guidance', 4),
(1, 'highlights', 'Dedicated tour coordinator support', 5),
(1, 'inclusions', 'Accommodation on twin-sharing basis', 1),
(1, 'inclusions', 'Daily breakfast and selected meals as per itinerary', 2),
(1, 'inclusions', 'Airport transfers on private basis', 3),
(1, 'inclusions', 'Sightseeing tours with English-speaking guide', 4),
(1, 'inclusions', 'All applicable hotel taxes', 5),
(1, 'exclusions', 'International airfare (unless flight add-on selected)', 1),
(1, 'exclusions', 'Personal expenses, tips, and porterage', 2),
(1, 'exclusions', 'Meals not mentioned in the itinerary', 3),
(1, 'exclusions', 'Optional activities and water sports', 4),
(1, 'exclusions', 'Travel insurance premium', 5),
(1, 'flights_note', 'Flights can be added during Calculate Price. Round-trip economy seats from Mumbai/Delhi/Bengaluru subject to availability.', 1),
(1, 'visa_note', 'Mauritius offers visa-on-arrival for Indian passport holders. Valid passport (6+ months) and return ticket required.', 1);

INSERT INTO holidays_package_hotels (package_id, name, nights_label, meal_plan, sort_order) VALUES
(1, 'Beachcomber-style Resort (or similar)', '4 Nights', 'Breakfast + selected lunches/dinners', 1);

INSERT INTO holidays_package_terms (package_id, term_text, sort_order) VALUES
(1, 'Prices are per person on twin-sharing basis and subject to availability.', 1),
(1, 'Rates may change based on travel dates, flight fares, and hotel inventory.', 2),
(1, '50% advance required at booking; balance due 21 days before departure.', 3),
(1, 'Cancellation charges apply as per company policy — 30+ days: 25%; 15–29 days: 50%; under 15 days: 100%.', 4),
(1, 'Passengers must carry valid passport, visa documents, and travel insurance where applicable.', 5),
(1, 'The company is not liable for delays caused by weather, airlines, or government regulations.', 6);

INSERT INTO holidays_package_pricing_config (package_id, base_price, currency, allows_flights, tour_types) VALUES
(1, 37700.00, 'INR', 1, 'Standard,Value,Premium');

-- Reset AUTO_INCREMENT after explicit IDs
ALTER TABLE holidays_destinations AUTO_INCREMENT = 15;
ALTER TABLE holidays_package_categories AUTO_INCREMENT = 7;
ALTER TABLE holidays_hero_slides AUTO_INCREMENT = 7;
ALTER TABLE holidays_hero_ticker_items AUTO_INCREMENT = 8;
ALTER TABLE holidays_departure_cities AUTO_INCREMENT = 4;
ALTER TABLE holidays_seasons AUTO_INCREMENT = 4;
ALTER TABLE holidays_tour_packages AUTO_INCREMENT = 4;
