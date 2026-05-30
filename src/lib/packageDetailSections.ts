import type { PackageDetailContent } from "@/lib/holidayPackages";

export type DetailCategoryId =
  | "highlights"
  | "flights"
  | "transfer"
  | "visa"
  | "sightseeing"
  | "accommodation"
  | "meals"
  | "inclusion-exclusions";

export const DETAIL_CATEGORY_LABELS: Record<DetailCategoryId, string> = {
  highlights: "Highlights",
  flights: "Flights",
  transfer: "Transfer",
  visa: "Visa",
  sightseeing: "Sightseeing",
  accommodation: "Accommodation",
  meals: "Meals",
  "inclusion-exclusions": "Inclusion/Exclusions",
};

const DETAIL_CATEGORY_ORDER: DetailCategoryId[] = [
  "highlights",
  "flights",
  "transfer",
  "visa",
  "sightseeing",
  "accommodation",
  "meals",
  "inclusion-exclusions",
];

function hasText(value?: string | null): boolean {
  return Boolean(value?.trim());
}

function hasItems<T>(items?: T[] | null): items is T[] {
  return Array.isArray(items) && items.length > 0;
}

function filterInclusions(inclusions: string[], pattern: RegExp): string[] {
  return inclusions.filter((line) => pattern.test(line));
}

export type ResolvedDetailSections = {
  highlights: string[];
  locationHighlights: PackageDetailContent["locationHighlights"];
  whatsMore: string[];
  flightsNote: string;
  transfer: string[];
  visaNote: string;
  sightseeing: string[];
  hotels: PackageDetailContent["hotels"];
  meals: string[];
  inclusions: string[];
  exclusions: string[];
};

export function resolveDetailSections(
  details: PackageDetailContent,
): ResolvedDetailSections {
  return {
    highlights: details.highlights ?? [],
    locationHighlights: details.locationHighlights,
    whatsMore: details.whatsMore ?? [],
    flightsNote: details.flightsNote?.trim() ?? "",
    transfer:
      details.transfer ??
      filterInclusions(details.inclusions, /transfer|pickup|airport/i),
    visaNote: details.visaNote?.trim() ?? "",
    sightseeing:
      details.sightseeing ??
      filterInclusions(details.inclusions, /sightseeing|tour|guide|excursion/i),
    hotels: details.hotels ?? [],
    meals:
      details.meals ??
      filterInclusions(
        details.inclusions,
        /meal|breakfast|lunch|dinner|half board|full board/i,
      ),
    inclusions: details.inclusions ?? [],
    exclusions: details.exclusions ?? [],
  };
}

function categoryHasContent(
  id: DetailCategoryId,
  sections: ResolvedDetailSections,
): boolean {
  switch (id) {
    case "highlights":
      return (
        hasItems(sections.highlights) ||
        hasItems(sections.locationHighlights) ||
        hasItems(sections.whatsMore)
      );
    case "flights":
      return hasText(sections.flightsNote);
    case "transfer":
      return hasItems(sections.transfer);
    case "visa":
      return hasText(sections.visaNote);
    case "sightseeing":
      return hasItems(sections.sightseeing);
    case "accommodation":
      return hasItems(sections.hotels);
    case "meals":
      return (
        hasItems(sections.meals) ||
        sections.hotels.some((h) => hasText(h.mealPlan))
      );
    case "inclusion-exclusions":
      return hasItems(sections.inclusions) || hasItems(sections.exclusions);
    default:
      return false;
  }
}

export function getAvailableDetailCategories(
  details: PackageDetailContent,
): { id: DetailCategoryId; label: string }[] {
  const sections = resolveDetailSections(details);
  return DETAIL_CATEGORY_ORDER.filter((id) =>
    categoryHasContent(id, sections),
  ).map((id) => ({ id, label: DETAIL_CATEGORY_LABELS[id] }));
}

export function getDefaultDetailCategory(
  details: PackageDetailContent,
): DetailCategoryId | null {
  return getAvailableDetailCategories(details)[0]?.id ?? null;
}
