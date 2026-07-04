"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AgentPortalRuntimeConfig } from "@/lib/agentPortal";

const AgentPortalConfigContext = createContext<AgentPortalRuntimeConfig | null>(null);

export function AgentPortalConfigProvider({
  config,
  children,
}: {
  config: AgentPortalRuntimeConfig;
  children: ReactNode;
}) {
  return (
    <AgentPortalConfigContext.Provider value={config}>{children}</AgentPortalConfigContext.Provider>
  );
}

function useAgentPortalConfig(): AgentPortalRuntimeConfig | null {
  return useContext(AgentPortalConfigContext);
}

export function useAgentPortalBaseUrl(): string | null {
  const config = useAgentPortalConfig();
  if (config?.agentPortalBaseUrl) return config.agentPortalBaseUrl;
  if (typeof window !== "undefined") return window.location.origin;
  return null;
}

export function useAgentPortalLoginUrl(): string | null {
  const base = useAgentPortalBaseUrl();
  return base ? `${base.replace(/\/$/, "")}/` : null;
}

export function useAgentPortalSignupUrl(): string | null {
  const base = useAgentPortalBaseUrl();
  return base ? `${base.replace(/\/$/, "")}/signup` : null;
}

export function useIsAgentPortalConfigured(): boolean {
  const config = useAgentPortalConfig();
  return config?.configured ?? false;
}
