/** Share agent login across *.vivancetravels.com via cookie + localStorage. */

const USER_STORAGE_KEY = "user";
const USER_COOKIE_NAME = "vivance_agent_user";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function canUseSharedCookie(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith("vivancetravels.com");
}

function readUserCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${USER_COOKIE_NAME}=([^;]*)`),
  );
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function writeUserCookie(json: string): void {
  if (!canUseSharedCookie()) return;
  document.cookie = [
    `${USER_COOKIE_NAME}=${encodeURIComponent(json)}`,
    "path=/",
    "domain=.vivancetravels.com",
    `max-age=${COOKIE_MAX_AGE_SEC}`,
    "SameSite=Lax",
    "Secure",
  ].join("; ");
}

function clearUserCookie(): void {
  if (typeof document === "undefined") return;
  if (!canUseSharedCookie()) return;
  document.cookie = `${USER_COOKIE_NAME}=; path=/; domain=.vivancetravels.com; max-age=0; SameSite=Lax; Secure`;
}

export function setUserSession(user: unknown): void {
  const json = JSON.stringify(user);
  localStorage.setItem(USER_STORAGE_KEY, json);
  writeUserCookie(json);
}

export function clearUserSession(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
  clearUserCookie();
}

/** If localStorage is empty, hydrate from shared cookie (B2C host after agent-dev login). */
export function syncUserSessionFromCookie(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(USER_STORAGE_KEY)) return false;
  const fromCookie = readUserCookie();
  if (!fromCookie) return false;
  try {
    JSON.parse(fromCookie);
    localStorage.setItem(USER_STORAGE_KEY, fromCookie);
    return true;
  } catch {
    clearUserCookie();
    return false;
  }
}

export function getUserSessionRaw(): string | null {
  if (typeof window === "undefined") return null;
  syncUserSessionFromCookie();
  return localStorage.getItem(USER_STORAGE_KEY);
}

export function getUserSession<T = Record<string, unknown>>(): T | null {
  const raw = getUserSessionRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
