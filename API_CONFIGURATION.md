# API Configuration Guide

## Overview

This project uses a centralized configuration system to manage API endpoints. You can easily switch between **local development** and **remote production** environments by changing a single environment variable.

---

## Configuration Files

### 1. **Environment Files**

#### `.env.local` (Development)
```env
# API Mode: 'local' for localhost or 'remote' for production
API_MODE=local
NEXT_PUBLIC_API_MODE=local

# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID='rzp_test_8kZ5x8DQbwsU0d'
```

#### `.env.production` (Production)
```env
# API Mode: 'local' for localhost or 'remote' for production
API_MODE=remote
NEXT_PUBLIC_API_MODE=remote

# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID='rzp_test_8kZ5x8DQbwsU0d'
```

### 2. **Central Configuration File**

**Location:** `src/lib/config.ts`

This file reads the `API_MODE` environment variable and automatically sets the correct base URLs:

```typescript
const API_MODE = process.env.API_MODE || process.env.NEXT_PUBLIC_API_MODE || 'remote';

const API_URLS = {
  vivapi_mt: {
    local: 'http://localhost:8080',
    remote: 'https://next.vivancetravels.com'
  },
  vivapi_user: {
    local: 'http://localhost:8082',
    remote: 'https://next.vivancetravels.com'
  }
};

// For vivapi-mt endpoints (flight operations, payment)
export const API_BASE_URL_MT = API_URLS.vivapi_mt[API_MODE];

// For vivapi-user endpoints (auth, bookings, passengers)
export const API_BASE_URL_USER = API_URLS.vivapi_user[API_MODE];

// API Key
export const API_KEY = 'viv-8806f318-1ecf-11ee-b64f-36e9be0141c6';
```

---

## API Endpoints by Service

### **vivapi-mt** (Port 8080 local / Production)
Uses `API_BASE_URL_MT`

- Flight search
- Flight token (domain_currency)
- Fare quote (update-fare-quote)
- Commit booking
- Payment order creation
- Payment validation
- Airports list

**API Routes:**
- `/api/flight/search`
- `/api/flight/token`
- `/api/flight/fare-quote`
- `/api/flight/commit-booking`
- `/api/payment/order`
- `/api/payment/validate`
- `/api/airports`

### **vivapi-user** (Port 8082 local / Production)
Uses `API_BASE_URL_USER`

- User authentication (signup, signin, reset)
- Forgot password / Reset password
- Flight bookings (my bookings, ticket details, ticket PDF)
- Family members (create, fetch)
- Passenger management

**API Routes:**
- `/api/auth`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/flight/my-bookings`
- `/api/flight/ticket-details`
- `/api/flight/ticket-pdf`
- `/api/family-members`
- `/api/passenger/create`
- `/api/passenger/get`

---

## How to Switch Between Local and Remote

### **For Development (Local Backend)**

1. Make sure your local backend services are running:
   - `vivapi-mt` on `http://localhost:8080`
   - `vivapi-user` on `http://localhost:8082`

2. Set environment variable in `.env.local`:
   ```env
   API_MODE=local
   NEXT_PUBLIC_API_MODE=local
   ```

3. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

### **For Production (Remote Backend)**

1. Set environment variable in `.env.production`:
   ```env
   API_MODE=remote
   NEXT_PUBLIC_API_MODE=remote
   ```

2. Build and deploy:
   ```bash
   npm run build
   npm start
   ```

### **For Hostinger Deployment**

When deploying to Hostinger, ensure the environment variables are set in the deployment configuration:

```env
API_MODE=remote
NEXT_PUBLIC_API_MODE=remote
```

The application will automatically use `https://next.vivancetravels.com` as the base URL.

---

## Verification

When the application starts, you'll see console logs showing the active configuration:

```
🔧 API Configuration:
  Mode: local
  MT Base URL: http://localhost:8080
  User Base URL: http://localhost:8082
```

or

```
🔧 API Configuration:
  Mode: remote
  MT Base URL: https://next.vivancetravels.com
  User Base URL: https://next.vivancetravels.com
```

---

## Important Notes

1. **Never commit `.env.local`** - It's in `.gitignore` for security
2. **Always use centralized config** - Import from `@/lib/config` in API routes
3. **Both variables required** - Set both `API_MODE` and `NEXT_PUBLIC_API_MODE`
4. **Restart after changes** - Always restart the dev server after changing `.env` files
5. **Production builds** - Use `.env.production` for production builds

---

## Troubleshooting

### Issue: API calls failing with 500 error

**Solution:** Check that:
1. The correct `API_MODE` is set in your `.env` file
2. Local backend services are running (if using `local` mode)
3. You've restarted the Next.js server after changing environment variables

### Issue: Still seeing localhost URLs in production

**Solution:**
1. Verify `.env.production` has `API_MODE=remote`
2. Clear Next.js cache: `rm -rf .next`
3. Rebuild: `npm run build`

### Issue: CORS errors

**Solution:**
- All API calls go through Next.js API routes (`/api/*`)
- Next.js API routes handle CORS by making server-side requests
- Ensure backend allows requests from your Next.js server domain

---

## Summary

✅ **Single point of configuration** - Change `API_MODE` in one place  
✅ **Environment-specific** - Different settings for dev/prod  
✅ **Type-safe** - Centralized exports prevent typos  
✅ **Easy deployment** - Just set environment variable on server  
✅ **No hardcoded URLs** - All API routes use centralized config
