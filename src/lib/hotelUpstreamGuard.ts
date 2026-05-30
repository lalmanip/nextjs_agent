/** Hotel proxy must call the hotel Service in-cluster, not the public ingress host + /api/hotels (self-loop). */
export function isLikelyInClusterHotelHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname === "vivance-hotel-api-service") return true;
  if (hostname.endsWith(".svc.cluster.local")) return true;
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(hostname)) {
    const [a, b] = hostname.split(".").map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

/**
 * True when the URL points at hotel HTTP paths but the host is not in-cluster.
 * Covers /api/hotels/* (e.g. locations) and /api/v1/hotels/* (search, prebook, book, …).
 */
export function isPublicHotelApiHotelsLoop(apiUrl: string): boolean {
  try {
    const u = new URL(apiUrl);
    if (isLikelyInClusterHotelHost(u.hostname)) return false;
    const p = u.pathname;
    return p.startsWith("/api/hotels") || p.startsWith("/api/v1/hotels");
  } catch {
    return false;
  }
}
