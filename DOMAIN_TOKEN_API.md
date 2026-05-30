# Domain Currency Token API - Endpoint Details

## 📍 Endpoint Information

### **API Route (Frontend)**
```
POST /api/flight/token
```

### **Backend Endpoint**

#### Local Mode (API_MODE=local)
```
POST http://localhost:8080/vivapi-mt/rest/domain_currency
```

#### Remote Mode (API_MODE=remote)
```
POST https://next.vivancetravels.com/vivapi-mt/rest/domain_currency
```

---

## 📤 Request Details

### **Headers**
```json
{
  "Content-Type": "application/json",
  "X-API-KEY": "viv-8806f318-1ecf-11ee-b64f-36e9be0141c6"
}
```

### **Request Body**
```json
{
  "domain_key": "TMX5193291565602439",
  "username": "test229267",
  "password": "test@229",
  "system": "test"
}
```

---

## 📥 Expected Response

### **Success Response (200 OK)**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "status": "success"
}
```

### **Error Response (4xx/5xx)**
```json
{
  "error": "Token API failed",
  "message": "HTTP 500: Internal Server Error"
}
```

---

## 🔍 Console Logs

When you call this API, you'll see detailed logs:

```
========== DOMAIN TOKEN API REQUEST ==========
Timestamp: 2025-01-XX...

--- CONFIGURATION ---
API_BASE_URL_MT: http://localhost:8080
API_ENDPOINTS.FLIGHT.TOKEN: /rest/domain_currency
Full URL: http://localhost:8080/vivapi-mt/rest/domain_currency

--- REQUEST HEADERS ---
{
  "Content-Type": "application/json",
  "X-API-KEY": "viv-8806f318-1ecf-11ee-b64f-36e9be0141c6"
}

--- REQUEST BODY ---
{
  "domain_key": "TMX5193291565602439",
  "username": "test229267",
  "password": "test@229",
  "system": "test"
}

--- SENDING REQUEST ---

--- RESPONSE DETAILS ---
Status Code: 200
Status Text: OK
Response Time: 245ms
Response Headers: {
  "content-type": "application/json",
  "content-length": "XXX"
}

--- SUCCESS RESPONSE ---
Response: {
  "token": "...",
  "status": "success"
}
=============================================
```

---

## 🐛 Troubleshooting

### Issue: "Connection refused" or "ECONNREFUSED"

**Cause:** Backend service not running on localhost:8080

**Solution:**
1. Start your vivapi-mt backend service
2. Verify it's running: `curl http://localhost:8080/vivapi-mt/rest/domain_currency`
3. Or switch to remote mode in `.env.local`:
   ```env
   API_MODE=remote
   NEXT_PUBLIC_API_MODE=remote
   ```

### Issue: "404 Not Found"

**Cause:** Incorrect endpoint path

**Solution:** Verify the backend endpoint is:
- `/vivapi-mt/rest/domain_currency` (with `/vivapi-mt` prefix)

### Issue: "401 Unauthorized" or "403 Forbidden"

**Cause:** Invalid API key or credentials

**Solution:** Verify:
- X-API-KEY: `viv-8806f318-1ecf-11ee-b64f-36e9be0141c6`
- domain_key: `TMX5193291565602439`
- username: `test229267`
- password: `test@229`

### Issue: Token API returns error after configuration change

**Cause:** Server not restarted after `.env` changes

**Solution:**
1. Stop the dev server (Ctrl+C)
2. Restart: `npm run dev`
3. Check console logs for correct URL

---

## 🧪 Testing

### Test with cURL (Local)
```bash
curl -X POST http://localhost:8080/vivapi-mt/rest/domain_currency \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: viv-8806f318-1ecf-11ee-b64f-36e9be0141c6" \
  -d '{
    "domain_key": "TMX5193291565602439",
    "username": "test229267",
    "password": "test@229",
    "system": "test"
  }'
```

### Test with cURL (Remote)
```bash
curl -X POST https://next.vivancetravels.com/vivapi-mt/rest/domain_currency \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: viv-8806f318-1ecf-11ee-b64f-36e9be0141c6" \
  -d '{
    "domain_key": "TMX5193291565602439",
    "username": "test229267",
    "password": "test@229",
    "system": "test"
  }'
```

---

## 📝 Code Location

**API Route File:** `src/app/api/flight/token/route.ts`

**Configuration Files:**
- `src/lib/config.ts` - Base URL configuration
- `src/config/api.config.ts` - Endpoint paths and credentials
- `.env.local` - Environment variables

---

## ✅ Current Configuration

Based on your `.env.local`:
```
API_MODE=local
```

**Active Endpoint:**
```
http://localhost:8080/vivapi-mt/rest/domain_currency
```

**Make sure your local backend is running on port 8080!**
