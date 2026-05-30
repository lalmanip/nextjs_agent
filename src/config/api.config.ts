// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://next.vivancetravels.com/vivapi-user',
  MT_BASE_URL: process.env.NEXT_PUBLIC_API_MT_BASE_URL || 'https://next.vivancetravels.com/vivapi-mt',
  API_KEY: process.env.NEXT_PUBLIC_API_KEY || 'viv-8806f318-1ecf-11ee-b64f-36e9be0141c6',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    SIGNUP: '/user/signup',
    SIGNIN: '/user/signin',
    RESET_PASSWORD: '/user/reset-password',
  },
  
  // Flight endpoints
  FLIGHT: {
    TOKEN: '/vivapi-auth/app/auth/login',
    SEARCH: '/flight/service/search',
    AIRPORTS: '/airports',
  },
} as const;

// Domain credentials (consider moving to environment variables)
export const DOMAIN_CREDENTIALS = {
  DOMAIN_KEY: process.env.NEXT_PUBLIC_DOMAIN_KEY || 'TMX5193291565602439',
  USERNAME: process.env.NEXT_PUBLIC_DOMAIN_USERNAME || 'test229267',
  PASSWORD: process.env.NEXT_PUBLIC_DOMAIN_PASSWORD || 'test@229',
  SYSTEM: process.env.NEXT_PUBLIC_DOMAIN_SYSTEM || 'test',
} as const;
