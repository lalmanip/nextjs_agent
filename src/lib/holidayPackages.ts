export type PackageTab = "itinerary" | "details" | "price" | "terms";

export type ItineraryDay = {
  day: number;
  title: string;
  description: string;
  highlights: string[];
  meals: string;
  accommodation: string;
};

export type LocationHighlightGroup = {
  location: string;
  items: string[];
};

export type PackageDetailContent = {
  highlights: string[];
  /** City/region grouped highlights (e.g. TOKYO: item | item). */
  locationHighlights?: LocationHighlightGroup[];
  whatsMore?: string[];
  inclusions: string[];
  exclusions: string[];
  hotels: { name: string; nights: string; mealPlan: string }[];
  flightsNote?: string;
  visaNote?: string;
  transfer?: string[];
  sightseeing?: string[];
  meals?: string[];
};

export type TourPackageDetail = {
  pkgId: string;
  slug: string;
  destinationSlug: string;
  destinationName: string;
  title: string;
  image: string;
  price: number;
  days: number;
  nights: number;
  rating: number;
  comments: number;
  badge?: string;
  inclusions: string[];
  itinerary: ItineraryDay[];
  details: PackageDetailContent;
  terms: string[];
};

/** Packages with full detail pages (expand as more are built). */
export const PACKAGE_DETAILS: Record<string, TourPackageDetail> = {
  "PKG-MRU-CLASSIC-001": {
    pkgId: "PKG-MRU-CLASSIC-001",
    slug: "mauritius-classic-package",
    destinationSlug: "mauritius-tour-packages",
    destinationName: "Mauritius",
    title: "Mauritius Classic Package",
    image:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1400&h=520&fit=crop&q=80",
    price: 37700,
    days: 5,
    nights: 4,
    rating: 4.5,
    comments: 128,
    badge: "Recommended",
    inclusions: ["Hotel", "Flight", "Visa", "Meals", "Sightseeing", "Transfers"],
    itinerary: [
      {
        day: 1,
        title: "Arrive in Mauritius",
        description:
          "Welcome to Mauritius. Transfer to your beach resort. Evening at leisure by the lagoon.",
        highlights: ["Airport transfer", "Resort check-in", "Welcome dinner"],
        meals: "Dinner",
        accommodation: "4★ Beach Resort — Port Louis area",
      },
      {
        day: 2,
        title: "North Island Tour",
        description:
          "Full-day sightseeing covering Port Louis, Caudan Waterfront, and northern coastal views.",
        highlights: ["Port Louis city tour", "Waterfront visit", "Photo stops"],
        meals: "Breakfast, Lunch",
        accommodation: "4★ Beach Resort",
      },
      {
        day: 3,
        title: "South & Chamarel",
        description:
          "Explore the south — Chamarel coloured earth, waterfalls, and scenic viewpoints.",
        highlights: ["Chamarel 7 Coloured Earth", "Waterfall visit", "South coast drive"],
        meals: "Breakfast, Lunch",
        accommodation: "4★ Beach Resort",
      },
      {
        day: 4,
        title: "Leisure Day",
        description:
          "Free day to enjoy the beach, optional water sports, or spa at the resort.",
        highlights: ["Beach leisure", "Optional activities", "Sunset views"],
        meals: "Breakfast",
        accommodation: "4★ Beach Resort",
      },
      {
        day: 5,
        title: "Departure",
        description: "Check out and transfer to airport for your return flight.",
        highlights: ["Hotel check-out", "Airport transfer"],
        meals: "Breakfast",
        accommodation: "—",
      },
    ],
    details: {
      highlights: [
        "Round-trip flights from major Indian cities (optional add-on)",
        "4 nights at a handpicked 4★ beach resort",
        "Visa assistance and travel insurance guidance",
        "Dedicated tour coordinator support",
      ],
      locationHighlights: [
        {
          location: "PORT LOUIS",
          items: [
            "Caudan Waterfront stroll",
            "Central Market visit",
            "Photo stops at harbour views",
          ],
        },
        {
          location: "SOUTH ISLAND",
          items: [
            "Chamarel 7 Coloured Earth",
            "Waterfall visit",
            "Scenic south coast drive",
          ],
        },
      ],
      whatsMore: [
        "Welcome drink on arrival",
        "Resort orientation walk",
        "Optional sunset cruise (on request)",
      ],
      inclusions: [
        "Accommodation on twin-sharing basis",
        "Daily breakfast and selected meals as per itinerary",
        "Airport transfers on private basis",
        "Sightseeing tours with English-speaking guide",
        "All applicable hotel taxes",
      ],
      exclusions: [
        "International airfare (unless flight add-on selected)",
        "Personal expenses, tips, and porterage",
        "Meals not mentioned in the itinerary",
        "Optional activities and water sports",
        "Travel insurance premium",
      ],
      hotels: [
        {
          name: "Beachcomber-style Resort (or similar)",
          nights: "4 Nights",
          mealPlan: "Breakfast + selected lunches/dinners",
        },
      ],
      transfer: ["Airport transfers on private basis"],
      sightseeing: [
        "North & South island sightseeing tours",
        "Sightseeing tours with English-speaking guide",
      ],
      meals: ["Daily breakfast and selected meals as per itinerary"],
      flightsNote:
        "Flights can be added during Calculate Price. Round-trip economy seats from Mumbai/Delhi/Bengaluru subject to availability.",
      visaNote:
        "Mauritius offers visa-on-arrival for Indian passport holders. Valid passport (6+ months) and return ticket required.",
    },
    terms: [
      "Prices are per person on twin-sharing basis and subject to availability.",
      "Rates may change based on travel dates, flight fares, and hotel inventory.",
      "50% advance required at booking; balance due 21 days before departure.",
      "Cancellation charges apply as per company policy — 30+ days: 25%; 15–29 days: 50%; under 15 days: 100%.",
      "Passengers must carry valid passport, visa documents, and travel insurance where applicable.",
      "The company is not liable for delays caused by weather, airlines, or government regulations.",
    ],
  },
};

export function getPackageDetail(pkgId: string): TourPackageDetail | null {
  return PACKAGE_DETAILS[pkgId] ?? null;
}

export function getPackageDetailBySlug(
  destinationSlug: string,
  packageSlug: string,
): TourPackageDetail | null {
  return (
    Object.values(PACKAGE_DETAILS).find(
      (p) =>
        p.destinationSlug === destinationSlug && p.slug === packageSlug,
    ) ?? null
  );
}

export function getPackageDetailUrl(pkg: TourPackageDetail): string {
  return `/international-tour-packages/${pkg.destinationSlug}/${pkg.slug}?pkgId=${pkg.pkgId}`;
}

/** Listing card id → detail pkgId (only wired packages). */
export const LISTING_TO_DETAIL: Record<string, string> = {
  "best-seller-1-mauritius": "PKG-MRU-CLASSIC-001",
};

export function listingDetailPkgId(
  destinationKey: string,
  categoryId: string,
  index: number,
): string | null {
  const key = `${categoryId}-${index + 1}-${destinationKey}`;
  return LISTING_TO_DETAIL[key] ?? null;
}
