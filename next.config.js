const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Load .env.local before reading FLIGHT_HOLD_ENABLED (must pass dev flag for local env files).
loadEnvConfig(path.join(__dirname), process.env.NODE_ENV !== "production");

const flightHoldRaw =
  process.env.FLIGHT_HOLD_ENABLED ??
  process.env.NEXT_PUBLIC_FLIGHT_HOLD_ENABLED ??
  "on";

/** Map LCC_LEAD_* → NEXT_PUBLIC_LCC_LEAD_* for the client bundle (optional overrides). */
const LCC_LEAD_ENV_PAIRS = [
  ["NEXT_PUBLIC_LCC_LEAD_ADDRESS_LINE1", "LCC_LEAD_ADDRESS_LINE1"],
  ["NEXT_PUBLIC_LCC_LEAD_ADDRESS_LINE2", "LCC_LEAD_ADDRESS_LINE2"],
  ["NEXT_PUBLIC_LCC_LEAD_CITY", "LCC_LEAD_CITY"],
  ["NEXT_PUBLIC_LCC_LEAD_STATE", "LCC_LEAD_STATE"],
  ["NEXT_PUBLIC_LCC_LEAD_PIN_CODE", "LCC_LEAD_PIN_CODE"],
  ["NEXT_PUBLIC_LCC_LEAD_COUNTRY_CODE", "LCC_LEAD_COUNTRY_CODE"],
  ["NEXT_PUBLIC_LCC_LEAD_COUNTRY_NAME", "LCC_LEAD_COUNTRY_NAME"],
];

const lccLeadEnv = {};
for (const [publicKey, rawKey] of LCC_LEAD_ENV_PAIRS) {
  const value = process.env[rawKey] ?? process.env[publicKey];
  if (value != null && String(value).trim() !== "") {
    lccLeadEnv[publicKey] = value;
  }
}

const defaultAdultDob =
  process.env.DEFAULT_ADULT_DOB ?? process.env.NEXT_PUBLIC_DEFAULT_ADULT_DOB;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for reliable static asset serving in the K8s Docker image
  output: "standalone",
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  env: {
    NEXT_PUBLIC_FLIGHT_HOLD_ENABLED: flightHoldRaw,
    ...(defaultAdultDob ? { NEXT_PUBLIC_DEFAULT_ADULT_DOB: defaultAdultDob } : {}),
    ...lccLeadEnv,
  },
  allowedDevOrigins: [
    "next.vivancetravels.com",
    "*.vivancetravels.com",
  ],
  images: {
    domains: [
      "logos-world.net",
      "via.placeholder.com",
      "upload.wikimedia.org",
      "www.logo.wine",
      "seeklogo.com",
    ],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Agent signup uploads (multipart, up to 5 MB). Middleware buffers request bodies;
  // without this, large uploads can be truncated before the route handler runs.
  experimental: {
    middlewareClientMaxBodySize: "10mb",
  },
};

module.exports = nextConfig;
