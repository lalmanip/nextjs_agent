import type { TourPackageDetail } from "@/lib/holidayPackages";
import {
  buildPackageDetailContent,
  type DetailSectionRow,
} from "@/lib/packageDetailContentBuilder";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Holidays API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type ApiHeroSlide = {
  title: string;
  subtitle: string | null;
  imageUrl: string;
  objectFit: string;
  objectPosition: string | null;
  rotateMs: number;
};

export type ApiHeroResponse = {
  slides: ApiHeroSlide[];
  tickerItems: string[];
};

export type ApiTrendingDestination = {
  id: number;
  slug: string;
  name: string;
  imageUrl: string;
  startingPrice: number;
  listingPath: string | null;
};

/** Listing page route for a destination slug (international + India). */
export function destinationListingHref(slug: string): string {
  return `/international-tour-packages/${encodeURIComponent(slug)}`;
}

/** Strip trailing "Tour Packages" so UI can append it once. */
export function destinationBaseName(name: string): string {
  const trimmed = name.trim();
  const base = trimmed.replace(/\s+tour\s+packages$/i, "").trim();
  return base || trimmed;
}

/** Consistent listing heading, e.g. "Japan Tour Packages". */
export function destinationListingTitle(name: string): string {
  return `${destinationBaseName(name)} Tour Packages`;
}

export type ApiPackageCategory = {
  code: string;
  label: string;
  iconKey: string;
};

export type ApiDestination = {
  id: number;
  slug: string;
  name: string;
  description: string;
  heroImageUrl: string;
  startingPrice: number;
};

export type ApiPackageCard = {
  pkgId: string;
  slug: string;
  title: string;
  imageUrl: string;
  price: number;
  days: number;
  nights: number;
  rating: number;
  reviewCount: number;
  badge: string | null;
  inclusions: string[];
  hasDetailPage: boolean;
  detailUrl: string | null;
};

export type ApiDestinationPackagesResponse = {
  destination: ApiDestination;
  category: ApiPackageCategory;
  packages: ApiPackageCard[];
};

export type ApiSeasonPackage = {
  title: string;
  imageUrl: string;
  daysLabel: string;
  price: number;
};

export type ApiSeason = {
  code: string;
  label: string;
  headline: string;
  description: string;
  backgroundUrl: string | null;
  packages: ApiSeasonPackage[];
};

export type ApiSeasonsResponse = {
  seasons: ApiSeason[];
};

/** Backend package detail DTO (matches holidayPackages TourPackageDetail). */
export type ApiTourPackageDetail = TourPackageDetail & {
  /** Optional raw rows when API returns holidays_package_detail_sections. */
  detailSections?: DetailSectionRow[];
  pricing?: {
    basePrice: number;
    currency: string;
    allowsFlights: boolean;
    tourTypes: string[];
    departureCities: { code: string; name: string }[];
  };
};

export const CATEGORY_ICONS: Record<string, string> = {
  "best-seller": "◎",
  group: "♟",
  senior: "♧",
  customized: "☷",
  honeymoon: "♡",
  budget: "₹",
};

export function fetchHolidayHero() {
  return fetchJson<ApiHeroResponse>("/api/holidays/hero");
}

export function fetchTrendingDestinations(region: "international" | "india") {
  return fetchJson<ApiTrendingDestination[]>(
    `/api/holidays/destinations/trending?region=${region}`,
  );
}

export function fetchHolidayCategories() {
  return fetchJson<ApiPackageCategory[]>("/api/holidays/categories");
}

export function fetchDestination(slug: string) {
  return fetchJson<ApiDestination>(
    `/api/holidays/destinations/${encodeURIComponent(slug)}`,
  );
}

export function fetchDestinationPackages(slug: string, categoryCode: string) {
  return fetchJson<ApiDestinationPackagesResponse>(
    `/api/holidays/destinations/${encodeURIComponent(slug)}/packages?categoryCode=${encodeURIComponent(categoryCode)}`,
  );
}

export async function fetchPackageDetail(
  pkgId: string,
): Promise<ApiTourPackageDetail | null> {
  const res = await fetch(
    `/api/holidays/packages/${encodeURIComponent(pkgId)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Package detail failed: ${res.status}`);
  return res.json() as Promise<ApiTourPackageDetail>;
}

export async function fetchPackageDetailBySlug(
  destinationSlug: string,
  packageSlug: string,
): Promise<ApiTourPackageDetail | null> {
  const res = await fetch(
    `/api/holidays/packages/by-slug?destinationSlug=${encodeURIComponent(destinationSlug)}&packageSlug=${encodeURIComponent(packageSlug)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Package detail failed: ${res.status}`);
  return res.json() as Promise<ApiTourPackageDetail>;
}

export async function fetchSeasons(): Promise<ApiSeasonsResponse | null> {
  const res = await fetch("/api/holidays/seasons", { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Seasons failed: ${res.status}`);
  return res.json() as Promise<ApiSeasonsResponse>;
}

export function apiPackageToTourDetail(
  api: ApiTourPackageDetail & {
    tourPackage?: { detailSections?: DetailSectionRow[] };
  },
): TourPackageDetail {
  const detailSections =
    api.detailSections ?? api.tourPackage?.detailSections ?? null;

  return {
    pkgId: api.pkgId,
    slug: api.slug,
    destinationSlug: api.destinationSlug,
    destinationName: api.destinationName,
    title: api.title,
    image: api.image,
    price: api.price,
    days: api.days,
    nights: api.nights,
    rating: api.rating,
    comments: api.comments,
    badge: api.badge,
    inclusions: api.inclusions,
    itinerary: api.itinerary,
    details: buildPackageDetailContent(api.details, detailSections),
    terms: api.terms,
  };
}
