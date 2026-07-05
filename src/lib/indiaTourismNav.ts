import manifest from "@/data/india/manifest.json";

export type IndiaExperience = {
  slug: string;
  label: string;
  iconKey: string;
};

export type IndiaState = {
  slug: string;
  name: string;
};

export type IndiaRegion = {
  slug: string;
  name: string;
  title: string;
};

export type IndiaHeroSlide = {
  imageUrl: string;
  title: string;
  subtitle: string;
};

export type IndiaBreadcrumb = {
  label: string;
  href?: string;
};

export type IndiaContentLink = {
  label: string;
  href: string;
};

export type IndiaSiblingNav = {
  title: string;
  links: IndiaContentLink[];
};

export type IndiaTeaserCard = {
  title: string;
  subtitle?: string;
  excerpt: string;
  href: string;
  imageUrl?: string;
  readMoreLabel?: string;
};

export type IndiaTourPackage = {
  title: string;
  duration: string;
  imageUrl: string;
  detailsHref: string;
};

export type IndiaContentSection =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "link-grid"; title: string; links: IndiaContentLink[] }
  | {
      type: "destination-group";
      heading: string;
      groups: { title: string; links: IndiaContentLink[] }[];
    }
  | { type: "teaser-grid"; heading?: string; cards: IndiaTeaserCard[] }
  | { type: "tour-package-grid"; heading: string; packages: IndiaTourPackage[] }
  | { type: "itinerary-meta"; duration: string; destinations: string }
  | { type: "itinerary-heading"; text: string }
  | { type: "itinerary-day"; dayLabel: string; title: string }
  | { type: "itinerary-body"; text: string; html?: string };

export type IndiaTourCategoryTab = {
  slug: string;
  label: string;
  shortLabel?: string;
};

export type IndiaTourPackageListing = {
  title: string;
  duration: string;
  itinerary?: string;
  imageUrl: string;
  detailsHref: string;
};

export type IndiaTourPackageSubTab = {
  slug: string;
  label: string;
  sourcePath: string;
  title: string;
  intro: string[];
  packages: IndiaTourPackageListing[];
};

export const INDIA_TOUR_PACKAGE_CATEGORIES = [
  { slug: "hot-selling", label: "Hot Selling Tour Packages", sourcePath: "tour-planner/india-tour-packages" },
  { slug: "luxury-train", label: "Luxury Train Tour Packages", sourcePath: "tour-planner/luxury-train-packages" },
  { slug: "golden-triangle", label: "Golden Triangle Tour Packages", sourcePath: "tour-planner/golden-triangle-tours" },
  { slug: "north-india", label: "North India Tour Packages", sourcePath: "tour-planner/north-india-tour-packages" },
  { slug: "region-wise", label: "Region Wise Tour Packages", sourcePath: "tour-planner/north-east-india-tours" },
  { slug: "theme-based", label: "Theme Based Tour Packages", sourcePath: "tour-planner/cultural-tours" },
] as const;

export function indiaTourPackagesHref(categorySlug = "hot-selling"): string {
  return `/holidays/india/tour-packages/${categorySlug}`;
}

export function indiaTourPackagesSubHref(categorySlug: string, subTabSlug: string): string {
  return `/holidays/india/tour-packages/${categorySlug}/${subTabSlug}`;
}

const scrapedManifest = manifest as { heroSlides?: IndiaHeroSlide[] };

export const INDIA_TOURISM_CONTACT = {
  phone: "+91 91610-77111",
  email: "bookings@vivancetravels.com",
};

export const INDIA_HERO_SLIDES: IndiaHeroSlide[] =
  scrapedManifest.heroSlides?.length
    ? scrapedManifest.heroSlides
    : [
        {
          imageUrl: "/taj.jpg",
          title: "Create Unforgettable Travel Experiences",
          subtitle: "Discover the magic of India — from ancient heritage to vibrant cities",
        },
      ];

export const INDIA_EXPERIENCES: IndiaExperience[] = [
  { slug: "weekend-getaways", label: "Weekend Getaways", iconKey: "calendar" },
  { slug: "short-breaks", label: "Short Breaks", iconKey: "clock" },
  { slug: "honeymoon-tours", label: "Honeymoon Tours", iconKey: "heart" },
  { slug: "pilgrimage-tours", label: "Pilgrimage Tours", iconKey: "landmark" },
  { slug: "adventure-holidays", label: "Adventure Holidays", iconKey: "mountain" },
  { slug: "wildlife-holidays", label: "Wildlife Holidays", iconKey: "binoculars" },
  { slug: "ayurveda-spa", label: "Ayurveda & Spa", iconKey: "leaf" },
  { slug: "cruises", label: "Cruises", iconKey: "ship" },
  { slug: "hotels-resorts", label: "Hotels & Resorts", iconKey: "building" },
  { slug: "hill-stations", label: "Hill Stations", iconKey: "trees" },
  { slug: "leisure-holidays", label: "Leisure Holidays", iconKey: "sun" },
  { slug: "golden-triangle", label: "Golden Triangle", iconKey: "map" },
  { slug: "kerala-tours", label: "Kerala Tours", iconKey: "palmtree" },
  { slug: "goa-tours", label: "Goa Tours", iconKey: "umbrella" },
  { slug: "rajasthan-tourism", label: "Rajasthan Tourism", iconKey: "castle" },
  { slug: "luxury-trains", label: "Luxury Trains Tours", iconKey: "train" },
  { slug: "states-in-india", label: "States In India", iconKey: "map-pin" },
  { slug: "best-selling-packages", label: "Best Selling Packages", iconKey: "star" },
];

export const INDIA_STATES: IndiaState[] = [
  { slug: "andaman-and-nicobar-islands", name: "Andaman and Nicobar Islands" },
  { slug: "andhra-pradesh", name: "Andhra Pradesh" },
  { slug: "arunachal-pradesh", name: "Arunachal Pradesh" },
  { slug: "assam", name: "Assam" },
  { slug: "bihar", name: "Bihar" },
  { slug: "chandigarh", name: "Chandigarh" },
  { slug: "chhattisgarh", name: "Chhattisgarh" },
  { slug: "dadra-and-nagar-haveli", name: "Dadra and Nagar Haveli" },
  { slug: "daman-and-diu", name: "Daman and Diu" },
  { slug: "delhi", name: "Delhi" },
  { slug: "goa", name: "Goa" },
  { slug: "gujarat", name: "Gujarat" },
  { slug: "haryana", name: "Haryana" },
  { slug: "himachal-pradesh", name: "Himachal Pradesh" },
  { slug: "jammu-and-kashmir", name: "Jammu and Kashmir" },
  { slug: "jharkhand", name: "Jharkhand" },
  { slug: "karnataka", name: "Karnataka" },
  { slug: "kerala", name: "Kerala" },
  { slug: "lakshadweep", name: "Lakshadweep" },
  { slug: "madhya-pradesh", name: "Madhya Pradesh" },
  { slug: "maharashtra", name: "Maharashtra" },
  { slug: "manipur", name: "Manipur" },
  { slug: "meghalaya", name: "Meghalaya" },
  { slug: "mizoram", name: "Mizoram" },
  { slug: "nagaland", name: "Nagaland" },
  { slug: "odisha", name: "Odisha" },
  { slug: "puducherry", name: "Puducherry" },
  { slug: "punjab", name: "Punjab" },
  { slug: "rajasthan", name: "Rajasthan" },
  { slug: "sikkim", name: "Sikkim" },
  { slug: "tamil-nadu", name: "Tamil Nadu" },
  { slug: "telangana", name: "Telangana" },
  { slug: "tripura", name: "Tripura" },
  { slug: "uttar-pradesh", name: "Uttar Pradesh" },
  { slug: "uttarakhand", name: "Uttarakhand" },
  { slug: "west-bengal", name: "West Bengal" },
];

export const INDIA_REGIONS: IndiaRegion[] = [
  { slug: "north-india", name: "North India", title: "North India Tourism" },
  { slug: "south-india", name: "South India", title: "South India Tourism" },
  { slug: "north-east-india", name: "North East India", title: "North East India Tourism" },
  { slug: "west-central-india", name: "West/Central India", title: "West/Central India Tourism" },
];

export function indiaExperienceHref(slug: string): string {
  return `/holidays/india/experiences/${slug}`;
}

export function indiaStateHref(slug: string): string {
  return `/holidays/india/states/${slug}`;
}

export function indiaRegionHref(slug: string): string {
  return `/holidays/india/regions/${slug}`;
}
