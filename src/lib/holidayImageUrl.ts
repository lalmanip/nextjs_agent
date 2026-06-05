/**
 * Resolves heroImageUrl / imageUrl from the holidays API for <img> and CSS backgrounds.
 * Uploads return a full URL; legacy rows may store a site-relative path.
 */
export function resolveHolidayImageUrl(
  url: string | null | undefined
): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base =
    process.env.NEXT_PUBLIC_HOLIDAY_MEDIA_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_HOLIDAY_API_BASE_URL?.replace(/\/$/, "") ||
    "";

  if (!base) return raw;

  if (raw.startsWith("/api/v1/holidays/media/")) {
    return `${base}${raw}`;
  }
  if (raw.startsWith("/")) {
    return `${base}/api/v1/holidays/media${raw}`;
  }
  return `${base}/api/v1/holidays/media/${raw.replace(/^\/+/, "")}`;
}
