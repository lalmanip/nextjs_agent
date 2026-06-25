/** Runtime env ribbon for dev/staging — same rules as vivance-ui (see appConfigShared). */

const ENV_RIBBON_ENV_KEYS = [
  "ENV_RIBBON_LABEL",
  "NEXT_PUBLIC_ENV_RIBBON_LABEL",
  "ENV_RIBBON",
] as const;

const APP_ENVIRONMENT_KEYS = [
  "APP_ENVIRONMENT",
  "DEPLOY_ENV",
  "NEXT_PUBLIC_APP_ENVIRONMENT",
] as const;

function readFirstEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Show ribbon on dev/test/staging; hidden on production (default). */
export function parseEnvRibbonLabel(): string | null {
  const explicit = readFirstEnv(ENV_RIBBON_ENV_KEYS);
  if (explicit) {
    const v = explicit.toLowerCase();
    if (v === "off" || v === "false" || v === "0" || v === "no" || v === "hidden") {
      return null;
    }
    return explicit;
  }

  const env = readFirstEnv(APP_ENVIRONMENT_KEYS)?.toLowerCase();
  if (!env || env === "production" || env === "prod") return null;
  if (env === "staging") return "STAGING ENV — Not for production use";
  if (env === "dev" || env === "development" || env === "test") {
    return "TEST ENV — Not for production use";
  }
  return `${env.toUpperCase()} — Not for production use`;
}
