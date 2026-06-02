/** Agent B2B portal host (login/signup only). B2C stays on NEXT_PUBLIC_B2C_APP_URL. */

const DEFAULT_AGENT_PORTAL_URL = "https://agent-dev.vivancetravels.com";
const DEFAULT_B2C_APP_URL = "https://next.vivancetravels.com";

export function getAgentPortalHosts(): string[] {
  const raw =
    process.env.AGENT_PORTAL_HOSTS ??
    process.env.NEXT_PUBLIC_AGENT_PORTAL_HOSTS ??
    "agent-dev.vivancetravels.com";
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

export function isAgentPortalHost(host: string | null | undefined): boolean {
  const h = normalizeHost(host);
  return h.length > 0 && getAgentPortalHosts().includes(h);
}

export function getAgentPortalBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_AGENT_PORTAL_URL?.trim() || DEFAULT_AGENT_PORTAL_URL;
  return url.replace(/\/$/, "");
}

export function getB2cAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_B2C_APP_URL?.trim() || DEFAULT_B2C_APP_URL;
  return url.replace(/\/$/, "");
}

/** Login URL on the agent portal (no /agent path). */
export function getAgentPortalLoginUrl(): string {
  return `${getAgentPortalBaseUrl()}/`;
}

export function getAgentPortalSignupUrl(): string {
  return `${getAgentPortalBaseUrl()}/signup`;
}

/** After agent sign-in, open B2C on the main site. */
export function getB2cAppUrl(path = "/"): string {
  const base = getB2cAppBaseUrl();
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
