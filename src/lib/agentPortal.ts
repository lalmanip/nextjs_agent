/** Agent B2B portal host (login/signup only). B2C stays on NEXT_PUBLIC_B2C_APP_URL. */

export const AGENT_PORTAL_NOT_CONFIGURED_MESSAGE =
  "Agent portal is not configured. Set AGENT_PORTAL_HOSTS (and NEXT_PUBLIC_AGENT_PORTAL_URL) in the deployment environment.";

export function getAgentPortalHosts(): string[] {
  const raw =
    process.env.AGENT_PORTAL_HOSTS ?? process.env.NEXT_PUBLIC_AGENT_PORTAL_HOSTS;
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function isAgentPortalConfigured(): boolean {
  return getAgentPortalHosts().length > 0;
}

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

export function isAgentPortalHost(host: string | null | undefined): boolean {
  const h = normalizeHost(host);
  return h.length > 0 && getAgentPortalHosts().includes(h);
}

export function getAgentPortalBaseUrl(): string | null {
  const explicit =
    process.env.NEXT_PUBLIC_AGENT_PORTAL_URL?.trim() ||
    process.env.AGENT_PORTAL_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const host = getAgentPortalHosts()[0];
  if (!host) return null;
  if (host === "localhost" || host === "127.0.0.1") {
    const port = process.env.PORT?.trim() || "3005";
    return `http://${host}:${port}`;
  }
  return `https://${host}`;
}

export function getB2cAppBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_B2C_APP_URL?.trim() || process.env.B2C_APP_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

/** True when agent portal and B2C share one origin (typical local dev on :3005). */
export function isCombinedAgentAndB2cHost(host: string | null | undefined): boolean {
  const requestHost = normalizeHost(host);
  const b2cBase = getB2cAppBaseUrl();
  if (!requestHost || !b2cBase) return false;
  try {
    const b2cHost = normalizeHost(new URL(`${b2cBase}/`).host);
    return b2cHost === requestHost;
  } catch {
    return false;
  }
}

/** Login URL on the agent portal (no /agent path). Returns null when not configured. */
export function getAgentPortalLoginUrl(): string | null {
  const base = getAgentPortalBaseUrl();
  return base ? `${base}/` : null;
}

export function getAgentPortalSignupUrl(): string | null {
  const base = getAgentPortalBaseUrl();
  return base ? `${base}/signup` : null;
}

/** Open B2C on the main site. Returns null when not configured. */
export function getB2cAppUrl(path = "/"): string | null {
  const base = getB2cAppBaseUrl();
  if (!base) return null;
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type AgentPortalRuntimeConfig = {
  configured: boolean;
  agentPortalHosts: string[];
  agentPortalBaseUrl: string | null;
  b2cAppBaseUrl: string | null;
};

export function getAgentPortalRuntimeConfig(): AgentPortalRuntimeConfig {
  return {
    configured: isAgentPortalConfigured(),
    agentPortalHosts: getAgentPortalHosts(),
    agentPortalBaseUrl: getAgentPortalBaseUrl(),
    b2cAppBaseUrl: getB2cAppBaseUrl(),
  };
}
