"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  getAllHeaderNavModes,
  getHeaderNavMode,
  type HeaderNavMode,
  type HeaderNavProductKey,
} from "@/lib/headerNavConfig";

type HeaderNavModes = Record<HeaderNavProductKey, HeaderNavMode>;

const HeaderNavConfigContext = createContext<HeaderNavModes | null>(null);

export function HeaderNavConfigProvider({
  modes,
  children,
}: {
  modes: HeaderNavModes;
  children: ReactNode;
}) {
  return (
    <HeaderNavConfigContext.Provider value={modes}>{children}</HeaderNavConfigContext.Provider>
  );
}

/** Prefer server-injected pod env; fall back to build-time NEXT_PUBLIC_* in the client bundle. */
export function useHeaderNavMode(key: HeaderNavProductKey): HeaderNavMode {
  const modes = useContext(HeaderNavConfigContext);
  if (modes) return modes[key];
  return getHeaderNavMode(key);
}

/** Default modes for SSR/client before provider mounts (build-time env only). */
export function getDefaultHeaderNavModes(): HeaderNavModes {
  return getAllHeaderNavModes();
}
