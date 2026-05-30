// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// User Types
export const USER_TYPES = {
  ADMIN: '1',
  AGENT: '2',
  CUSTOMER: '3',
  GUEST: '4',
} as const;

// User Status
export const USER_STATUS = {
  INACTIVE: '0',
  ACTIVE: '1',
  SUSPENDED: '2',
} as const;

// Flight Journey Types
export const JOURNEY_TYPES = {
  ONE_WAY: '1',
  ROUND_TRIP: '2',
  MULTI_CITY: '3',
} as const;

// Cabin Classes
export const CABIN_CLASSES = {
  ECONOMY: '1',
  PREMIUM_ECONOMY: '2',
  BUSINESS: '3',
  FIRST: '4',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  AUTH_ERROR: 'Authentication failed. Please login again.',
  TOKEN_REQUIRED: 'Token is required for this operation.',
  UNKNOWN_ERROR: 'An unknown error occurred.',
} as const;
