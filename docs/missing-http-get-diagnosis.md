# Missing HTTP GET Requests - Diagnosis & Fix Guide

## Problem Summary

**Symptom**: WebSocket upgrade requests appear in server logs, but HTTP GET requests for the preview page do not.

**Impact**: The iframe shows a blank/error page even though:
- Preview session is created successfully
- WebSocket HMR connection works (after our fix)
- curl/test scripts can access the preview URL

## Root Cause Analysis

### Why Test Scripts Work But Browser Doesn't

| Factor | Test Script (curl) | Browser (iframe) |
|--------|-------------------|------------------|
| **Origin Header** | None | Present (kontext.coinnation.io) |
| **CORS** | No Origin → allowed | Has Origin → must be in allowlist |
| **Network** | Same network (server) | Different network (user's machine) |
| **Sticky Sessions** | May hit same pod | May hit different pod |
| **Request Type** | Direct GET | Iframe context (additional security) |
| **Preflight** | No OPTIONS request | May send OPTIONS first |

### Critical Observation

**WebSocket requests appear in logs** ✅
- This proves the server is reachable
- WebSocket upgrade handler is working
- Session lookup is working

**HTTP GET requests do NOT appear in logs** ❌
- This means the request never reaches Express
- Either blocked before Express, or browser isn't making it

## Most Likely Causes

### 1. CORS Preflight Failure (MOST LIKELY)

**What happens:**
1. Browser sees iframe src = `https://jsbundler.coinnation.io/preview/{sessionId}`
2. Browser checks CORS policy (different origin)
3. Browser sends **OPTIONS preflight request**
4. If OPTIONS is blocked/rejected → **GET never happens**

**How to check:**
```bash
# Check browser Network tab:
# 1. Look for OPTIONS request to /preview/{sessionId}
# 2. Check if it returns 200 OK or is blocked
# 3. Check response headers for CORS headers
```

**Fix:**
```javascript
// In your Express server, ensure OPTIONS requests are handled:
app.options('/preview/:sessionId*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*'); // or specific origin
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

// Also add CORS headers to GET responses:
app.use('/preview/:sessionId', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // or specific origin
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});
```

### 2. Mixed Content Blocking

**What happens:**
- Parent page: `https://kontext.coinnation.io` (HTTPS)
- Iframe src: `http://jsbundler.coinnation.io/...` (HTTP)
- Browser blocks mixed content

**How to check:**
```javascript
// In browser console:
console.log('Parent:', window.location.protocol);
console.log('Iframe src:', document.querySelector('iframe').src);
// If protocols don't match → mixed content issue
```

**Fix:**
- Ensure preview URL uses HTTPS: `https://jsbundler.coinnation.io/preview/{sessionId}`
- Check server SSL certificate is valid

### 3. Browser Security Policies

**X-Frame-Options:**
```javascript
// Server might be sending:
X-Frame-Options: DENY
// or
X-Frame-Options: SAMEORIGIN
```

**Content Security Policy (CSP):**
```javascript
// Parent page might have:
Content-Security-Policy: frame-src 'self'
// This blocks iframes to other domains
```

**How to check:**
```bash
# Check response headers:
curl -I https://jsbundler.coinnation.io/preview/{sessionId}
# Look for X-Frame-Options or Content-Security-Policy
```

**Fix:**
```javascript
// On server, ensure preview routes allow embedding:
app.use('/preview/:sessionId', (req, res, next) => {
  // Remove X-Frame-Options or set to ALLOWALL
  res.removeHeader('X-Frame-Options');
  // Or explicitly allow:
  res.header('X-Frame-Options', 'ALLOWALL');
  next();
});
```

### 4. Load Balancer Routing

**What happens:**
- Load balancer may route browser requests differently than curl
- Different User-Agent headers → different routing rules
- Sticky sessions not working → session not found on different pod

**How to check:**
```bash
# Test from browser network:
# 1. Check if request reaches load balancer
# 2. Check if load balancer forwards to Express
# 3. Check if different pods have different session data
```

**Fix:**
- Ensure sticky sessions are configured
- Or use shared session storage (Redis/database)
- Check load balancer logs

### 5. Iframe Not Actually Loading

**What happens:**
- `previewUrl` might be null/undefined
- Iframe src might be `about:blank`
- JavaScript error prevents iframe src from being set

**How to check:**
```javascript
// In browser console:
const iframe = document.querySelector('iframe[title*="Preview"]');
console.log('Iframe src:', iframe?.src);
console.log('Preview URL state:', /* check your state */);
```

**Fix:**
- Ensure `previewUrl` is set correctly
- Check HotReloadService is creating sessions
- Verify session response includes `previewUrl`

## Diagnostic Steps

### Step 1: Check Browser Network Tab

1. Open browser DevTools → Network tab
2. Filter by "preview" or the session ID
3. Look for:
   - **OPTIONS request** (CORS preflight)
   - **GET request** to `/preview/{sessionId}`
   - **Status codes** (200, 404, 403, CORS error)

**What to look for:**
- ✅ OPTIONS returns 200 → CORS is working
- ❌ OPTIONS blocked/404 → CORS preflight failing
- ✅ GET request appears → Request is being made
- ❌ No GET request → Browser isn't making the request

### Step 2: Check Server Logs

```bash
# Look for:
# 1. OPTIONS requests (CORS preflight)
# 2. GET requests to /preview/:sessionId
# 3. Any 404/403 errors
```

**Expected logs:**
```
🌐 [ALL REQUESTS] GET /preview/{sessionId}
📡 Proxying HTTP request for session {sessionId}: GET /
```

**If missing:**
- Request is blocked before Express
- Check load balancer/nginx logs
- Check CORS middleware

### Step 3: Test Direct Access

```bash
# From browser, try accessing directly:
https://jsbundler.coinnation.io/preview/{sessionId}

# If this works but iframe doesn't:
# → CORS/X-Frame-Options issue
```

### Step 4: Check CORS Configuration

```javascript
// Ensure your CORS middleware allows:
const allowedOrigins = [
  'https://kontext.coinnation.io',
  'https://www.kontext.coinnation.io',
  // Add your actual domain
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## Complete Fix Implementation

### 1. Add OPTIONS Handler

```javascript
// Handle CORS preflight for preview routes
app.options('/preview/:sessionId*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});
```

### 2. Add CORS Headers to Preview Route

```javascript
app.use('/preview/:sessionId', (req, res, next) => {
  // Allow iframe embedding
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('X-Frame-Options', 'ALLOWALL'); // or remove entirely
  
  // Continue to proxy
  next();
}, async (req, res, next) => {
  // ... existing proxy logic ...
});
```

### 3. Ensure HTTPS

```javascript
// In preview session creation, ensure HTTPS:
const previewUrl = `https://jsbundler.coinnation.io/preview/${sessionId}`;
```

### 4. Add Request Logging

```javascript
// Log ALL requests (including OPTIONS)
app.use((req, res, next) => {
  console.log(`🌐 [ALL REQUESTS] ${req.method} ${req.url}`);
  console.log(`   Origin: ${req.headers.origin || 'none'}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'none'}`);
  next();
});
```

## Verification

After applying fixes:

1. **Check browser Network tab:**
   - ✅ OPTIONS request returns 200
   - ✅ GET request appears
   - ✅ Response has CORS headers

2. **Check server logs:**
   - ✅ OPTIONS request logged
   - ✅ GET request logged
   - ✅ Proxy successful

3. **Check iframe:**
   - ✅ Iframe loads the preview page
   - ✅ No console errors
   - ✅ Content visible

## Summary

The missing HTTP GET is **separate from the WebSocket 400 error**. The WebSocket fix is correct and will work once the HTTP GET issue is resolved.

**Most likely fix:** Add CORS preflight (OPTIONS) handler and ensure CORS headers are set on preview routes.

**Priority order:**
1. ✅ Fix WebSocket 400 error (already done)
2. 🔧 Fix CORS preflight (OPTIONS handler)
3. 🔧 Ensure HTTPS for preview URLs
4. 🔧 Check X-Frame-Options headers
5. 🔧 Verify load balancer routing

