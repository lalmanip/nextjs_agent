import type {
  LocationHighlightGroup,
  PackageDetailContent,
} from "@/lib/holidayPackages";

/** Row from holidays_package_detail_sections (when API exposes it). */
export type DetailSectionRow = {
  sectionType: string;
  content: string;
  sortOrder?: number;
};

const WHATS_MORE_HEADER = /^what[''\u2019]s\s+more\b/i;
const LOCATION_LINE = /^([A-Za-z][A-Za-z0-9\s\-/]+):\s*(.+)$/;

function tryParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function splitDetailLines(content: string): string[] {
  return content
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Parses a highlights block stored as plain text in MySQL/API, e.g.
 *
 * TOKYO: Visit temple | Tea ceremony | Skytree
 * HAKONE: Ropeway | Lake cruise
 *
 * WHAT'S MORE DURING THE TOUR
 *
 * Mochi Tasting
 * Sushi Tasting
 */
export function parseHighlightsBlock(content: string): {
  locationHighlights: LocationHighlightGroup[];
  whatsMore: string[];
  highlights: string[];
} {
  const locationHighlights: LocationHighlightGroup[] = [];
  const whatsMore: string[] = [];
  const highlights: string[] = [];
  let whatsMoreMode = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (WHATS_MORE_HEADER.test(line)) {
      whatsMoreMode = true;
      continue;
    }

    if (whatsMoreMode) {
      whatsMore.push(line);
      continue;
    }

    const cityMatch = line.match(LOCATION_LINE);
    if (cityMatch) {
      const items = cityMatch[2]
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
      if (items.length > 0) {
        locationHighlights.push({
          location: cityMatch[1].trim().toUpperCase(),
          items,
        });
      }
      continue;
    }

    highlights.push(line);
  }

  return { locationHighlights, whatsMore, highlights };
}

function parseLocationHighlightContent(content: string): LocationHighlightGroup | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const json = tryParseJson<LocationHighlightGroup>(trimmed);
  if (json?.location && Array.isArray(json.items)) {
    return {
      location: String(json.location).trim(),
      items: json.items.map((i) => String(i).trim()).filter(Boolean),
    };
  }

  const cms = trimmed.match(/^([A-Za-z0-9\s\-/]+)::\s*(.+)$/);
  if (cms) {
    const items = cms[2]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    return { location: cms[1].trim().toUpperCase(), items };
  }

  const singleColon = trimmed.match(LOCATION_LINE);
  if (singleColon) {
    const items = singleColon[2]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    return { location: singleColon[1].trim().toUpperCase(), items };
  }

  return null;
}

function mergeHighlightsBlock(
  content: PackageDetailContent,
  block: ReturnType<typeof parseHighlightsBlock>,
): PackageDetailContent {
  return {
    ...content,
    locationHighlights: [
      ...(content.locationHighlights ?? []),
      ...block.locationHighlights,
    ],
    whatsMore: [...(content.whatsMore ?? []), ...block.whatsMore],
    highlights: [...(content.highlights ?? []), ...block.highlights],
  };
}

function normalizeListField(items: string[] | undefined): string[] {
  if (!items?.length) return [];
  return items.flatMap((item) =>
    item.includes("\n") ? splitDetailLines(item) : [item.trim()],
  ).filter(Boolean);
}

function normalizeHighlightsField(content: PackageDetailContent): PackageDetailContent {
  let next = { ...content, highlights: [...(content.highlights ?? [])] };

  const parsedBlocks: ReturnType<typeof parseHighlightsBlock>[] = [];
  const plain: string[] = [];

  for (const line of next.highlights) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (
      trimmed.includes("\n") ||
      WHATS_MORE_HEADER.test(trimmed) ||
      LOCATION_LINE.test(trimmed)
    ) {
      parsedBlocks.push(parseHighlightsBlock(trimmed));
    } else {
      plain.push(trimmed);
    }
  }

  next.highlights = plain;
  for (const block of parsedBlocks) {
    next = mergeHighlightsBlock(next, block);
  }

  return next;
}

/**
 * Builds Package Details for the UI from API/DB rows.
 *
 * Your POST JSON can keep using one `detailSections` row:
 * { "sectionType": "highlights", "content": "TOKYO: a | b\n\nHAKONE: ...\n\nWHAT'S MORE...\n\nMochi..." }
 *
 * On GET, pass the same rows as `detailSections` (or pre-parsed fields in `details`).
 */
export function buildPackageDetailContent(
  base: PackageDetailContent,
  sections?: DetailSectionRow[] | null,
): PackageDetailContent {
  let result: PackageDetailContent = {
    ...base,
    highlights: [...(base.highlights ?? [])],
    locationHighlights: [...(base.locationHighlights ?? [])],
    whatsMore: [...(base.whatsMore ?? [])],
    transfer: [...(base.transfer ?? [])],
    sightseeing: [...(base.sightseeing ?? [])],
    meals: [...(base.meals ?? [])],
    inclusions: normalizeListField(base.inclusions),
    exclusions: normalizeListField(base.exclusions),
    flightsNote: base.flightsNote?.trim() ?? "",
    visaNote: base.visaNote?.trim() ?? "",
  };

  if (!sections?.length) {
    return normalizeHighlightsField(result);
  }

  const sorted = [...sections].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );

  for (const row of sorted) {
    const type = row.sectionType.trim().toLowerCase().replace(/\s+/g, "_");
    const content = row.content ?? "";
    if (!content.trim()) continue;

    switch (type) {
      case "highlights": {
        result = mergeHighlightsBlock(result, parseHighlightsBlock(content));
        break;
      }
      case "location_highlight":
      case "location_highlights": {
        const group = parseLocationHighlightContent(content);
        if (group) {
          result.locationHighlights!.push(group);
        }
        break;
      }
      case "whats_more":
      case "whatsmore":
        result.whatsMore!.push(...splitDetailLines(content));
        break;
      case "flights_note":
      case "flights":
        result.flightsNote = result.flightsNote
          ? `${result.flightsNote}\n${content.trim()}`
          : content.trim();
        break;
      case "visa_note":
      case "visa":
        result.visaNote = result.visaNote
          ? `${result.visaNote}\n${content.trim()}`
          : content.trim();
        break;
      case "transfer":
        result.transfer!.push(...splitDetailLines(content));
        break;
      case "sightseeing":
        result.sightseeing!.push(...splitDetailLines(content));
        break;
      case "meals":
        result.meals!.push(...splitDetailLines(content));
        break;
      case "inclusions":
        result.inclusions!.push(...splitDetailLines(content));
        break;
      case "exclusions":
        result.exclusions!.push(...splitDetailLines(content));
        break;
      default:
        break;
    }
  }

  result.inclusions = normalizeListField(result.inclusions);
  result.exclusions = normalizeListField(result.exclusions);

  return normalizeHighlightsField(result);
}
