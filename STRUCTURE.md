# Project Structure

This document outlines the organized folder structure for constants, configuration, and utilities.

## 📁 Folder Structure

```
src/
├── config/                  # Configuration files
│   ├── api.config.ts       # API URLs, keys, endpoints, credentials
│   └── index.ts            # Export all configs
│
├── constants/               # Application constants
│   ├── app.constants.ts    # HTTP status, user types, error messages, etc.
│   └── index.ts            # Export all constants
│
├── utils/                   # Utility functions
│   ├── error.utils.ts      # Error handling utilities
│   └── index.ts            # Export all utilities
│
└── lib/                     # Business logic and API wrappers
    └── api.ts              # API client functions
```

## 🎯 Usage

### Import Configuration
```typescript
import { API_CONFIG, API_ENDPOINTS, DOMAIN_CREDENTIALS } from '@/config';

// Use in your code
const url = `${API_CONFIG.MT_BASE_URL}${API_ENDPOINTS.FLIGHT.SEARCH}`;
```

### Import Constants
```typescript
import { HTTP_STATUS, ERROR_MESSAGES, USER_TYPES } from '@/constants';

// Use in your code
return NextResponse.json({ error: ERROR_MESSAGES.TOKEN_REQUIRED }, 
  { status: HTTP_STATUS.BAD_REQUEST }
);
```

### Import Utilities
```typescript
import { getErrorMessage, formatApiError } from '@/utils';

// Use in your code
catch (error) {
  console.error(getErrorMessage(error));
}
```

## 🔐 Environment Variables

Copy `.env.example` to `.env.local` and update the values:

```bash
cp .env.example .env.local
```

All configuration values in `api.config.ts` can be overridden using environment variables prefixed with `NEXT_PUBLIC_`.

## ✅ Benefits

1. **Single Source of Truth** - All constants in one place
2. **Type Safety** - TypeScript `as const` for immutable values
3. **Easy Maintenance** - Update once, reflect everywhere
4. **Environment Flexible** - Override via env variables
5. **Better DX** - Autocomplete and IntelliSense support
6. **Testable** - Easy to mock in tests

Yes, this is absolutely best practice and designed to be developer-friendly! Let me break it down:

✅ Industry Best Practices We're Following:

1. Separation of Concerns
    ✅ Configuration separate from logic
    ✅ Constants separate from implementation
    ✅ Utilities reusable across the app
    This is standard in React, Next.js, Angular, Vue projects
2. DRY Principle (Don't Repeat Yourself)
    ✅ No hardcoded URLs/keys scattered everywhere
    ✅ Single update point for all constants
    Used by: Google, Airbnb, Microsoft, Meta
3. Environment-Based Configuration
    ✅ .env files for different environments
    ✅ Easy to switch between dev/staging/production
    Standard in: All modern web applications

4. TypeScript Best Practices
    ✅ as const for immutable constants
    ✅ Type safety and autocomplete
Recommended by: TypeScript official docs
5. Clean Import Paths
// ✅ Clean and professional
import { API_CONFIG } from '@/config';

// ❌ Avoid this mess
import { API_CONFIG } from '../../../config/api.config';


🎓 Tips for Junior Developers:
1. Start simple:

import { API_CONFIG } from '@/config';
// Use API_CONFIG.MT_BASE_URL instead of hardcoding

2. When to add new constants:

    * Adding a new API endpoint? → Add to api.config.ts
    * New error message? → Add to app.constants.ts
    * New utility function? → Add to utils/
    * Don't overthink it:
3. Don't overthink it:
    * Just import what you need
    * Follow existing patterns
    * Code reviews will guide you
