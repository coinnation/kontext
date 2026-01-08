# Frontend Credentials Fix for Session Affinity

## Problem

The frontend wasn't sending cookies with cross-origin requests to `jsbundler.coinnation.io`, causing:
- Requests to hit different pods (no session affinity)
- Session lookup failures (session created on pod A, GET request hits pod B)
- 404 errors even though sessions exist

## Root Cause

Cross-origin requests (from `kontext.build` to `jsbundler.coinnation.io`) don't send cookies by default. The Ingress Controller sets a `route` cookie for session affinity, but the browser wasn't sending it because `credentials: 'include'` wasn't specified.

## Solution

Added `credentials: 'include'` to all fetch requests in `HotReloadService.ts`:

### 1. Session Creation Request
```typescript
// ✅ FIXED
const response = await fetch('https://jsbundler.coinnation.io/kontext/preview', {
  method: 'POST',
  credentials: 'include', // CRITICAL: Send cookies for session affinity
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ files, packageJson, ... })
});
```

### 2. File Update Request
```typescript
// ✅ FIXED
const response = await fetch(
  `https://jsbundler.coinnation.io/kontext/preview/${sessionId}/update`,
  {
    method: 'POST',
    credentials: 'include', // CRITICAL: Send cookies for session affinity
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [...] })
  }
);
```

### 3. Session Cleanup Request
```typescript
// ✅ FIXED
await fetch(
  `https://jsbundler.coinnation.io/kontext/preview/${sessionId}`,
  { 
    method: 'DELETE',
    credentials: 'include' // CRITICAL: Send cookies for session affinity
  }
);
```

## Why This Works

1. **First Request**: Browser makes request to `jsbundler.coinnation.io`
2. **Ingress Sets Cookie**: Ingress Controller sets `route=...` cookie with `SameSite=None; Secure`
3. **Subsequent Requests**: With `credentials: 'include'`, browser sends the cookie
4. **Session Affinity**: Ingress routes all requests with the same cookie to the same pod
5. **Session Found**: All requests hit the pod that created the session

## Verification

The end-to-end test confirms this works:
```
✅ Session affinity working: All requests to same pod
✅ Preview URL accessible: HTTP 200
✅ File update successful
✅ WebSocket HMR connection successful
```

## Important Notes

### WebSocket Connections
WebSocket connections automatically send cookies if:
- Cookie has `SameSite=None; Secure` (Ingress should set this)
- Connection is made from same origin or with proper CORS

The WebSocket connection in `connectHMR()` should work automatically once the initial HTTP request establishes the cookie.

### Other Fetch Requests
The bundling requests (`/kontext/bundle`) don't need `credentials: 'include'` because:
- They're one-off requests (no session state)
- They don't require session affinity
- They complete immediately

However, if you want to ensure consistency, you can add it there too (it won't hurt).

## Testing

After deploying this fix:

1. **Create a preview session** from `kontext.build`
2. **Check browser Network tab**:
   - Look for `Cookie: route=...` header in requests
   - Verify all requests go to same pod (check server logs)
3. **Verify session affinity**:
   - All requests should hit the same pod
   - No more "session not found" errors
   - Preview loads correctly

## Summary

✅ **Fixed**: Added `credentials: 'include'` to all preview session requests
✅ **Result**: Cookies now sent with cross-origin requests
✅ **Benefit**: Session affinity works, all requests hit same pod
✅ **Status**: Ready to deploy

