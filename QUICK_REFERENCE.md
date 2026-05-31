# Quick Reference: Switch API Environment

## 🚀 Switch to LOCAL (Development)

**File:** `.env.local`
```env
API_MODE=local
NEXT_PUBLIC_API_MODE=local
```

**Then restart:**
```bash
npm run dev
```

**URLs used:**
- vivapi-mt: `http://localhost:8080`
- vivapi-user: `http://localhost:8082`

---

## 🌐 Switch to REMOTE (Production)

**File:** `.env.production`
```env
API_MODE=remote
NEXT_PUBLIC_API_MODE=remote
```

**Then build:**
```bash
npm run build
npm start
```

**URLs used:**
- vivapi-mt: `https://next.vivancetravels.com`
- vivapi-user: `https://next.vivancetravels.com`

---

## 📋 Checklist Before Deployment

- [ ] Set `API_MODE=remote` in `.env.production`
- [ ] Set `NEXT_PUBLIC_API_MODE=remote` in `.env.production`
- [ ] Run `npm run build` to create production build
- [ ] Verify console logs show correct URLs
- [ ] Test API calls work with remote backend
- [ ] Push to `dev` branch for Hostinger deployment

---

## 🔍 Verify Current Configuration

Check console output when app starts:
```
🔧 API Configuration:
  Mode: [local or remote]
  MT Base URL: [URL]
  User Base URL: [URL]
```

---

## 📁 Configuration File Location

**Central Config:** `src/lib/config.ts`

All API routes import from here:
```typescript
import { API_BASE_URL_MT, API_BASE_URL_USER, API_KEY } from '@/lib/config';
```
