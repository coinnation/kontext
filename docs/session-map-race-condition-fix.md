# Session Map Race Condition & Multi-Pod Issues - Fix Guide

## Critical Issues Identified

### 1. Session Map Race Condition
**Symptom**: Session created successfully, but GET request immediately returns 404
```
✅ Session created: a1fad95226646c9f
... 0.3 seconds later ...
GET /preview/a1fad95226646c9f
❌ Session not found in map (Total sessions: 0)
```

**Root Cause**: 
- Session created in one request handler
- GET request hits before session is fully registered in map
- OR: GET request hits different pod with separate in-memory map

### 2. Multi-Pod Session Storage
**Symptom**: Sessions appear/disappear randomly
```
Total sessions in map: 1  ✅
... later ...
Total sessions in map: 0  ❌
```

**Root Cause**: 
- Kubernetes has multiple pods (`api-gateway-5c64b5fb96-vmxbj` and others)
- Each pod has separate in-memory session map
- No shared storage (Redis/database)
- Load balancer routes requests to different pods

### 3. WebSocket 400 Still Occurring
**Symptom**: Vite HMR WebSocket connection rejected
```
🔌 Connecting to Vite HMR server: ws://127.0.0.1:30001/
❌ Unexpected server response: 400
```

**Root Cause**: 
- WebSocket fix may not be applied
- OR: Vite HMR expects different path/headers

## Solutions

### Solution 1: Shared Session Storage (RECOMMENDED)

Replace in-memory Map with Redis or database:

```javascript
// Instead of: const sessions = new Map();
// Use Redis:
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Store session
async function storeSession(sessionId, sessionData) {
  await redis.setex(
    `preview:session:${sessionId}`,
    86400, // 24 hours
    JSON.stringify(sessionData)
  );
}

// Get session
async function getSession(sessionId) {
  const data = await redis.get(`preview:session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

// Delete session
async function deleteSession(sessionId) {
  await redis.del(`preview:session:${sessionId}`);
}
```

**Benefits**:
- ✅ Sessions shared across all pods
- ✅ No race conditions
- ✅ Persists across pod restarts
- ✅ Automatic expiration (Redis TTL)

### Solution 2: Sticky Sessions (QUICK FIX)

Configure load balancer for session affinity:

```yaml
# Kubernetes Service
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600  # 1 hour
```

**Benefits**:
- ✅ Same client always hits same pod
- ✅ No code changes needed
- ⚠️ Still vulnerable to pod restarts

### Solution 3: Session Registration Lock (IMMEDIATE FIX)

Ensure session is registered before returning response:

```javascript
// In createPreviewSession:
async createPreviewSession(files, packageJson, sessionId) {
  // 1. Create session data
  const sessionData = {
    sessionId,
    port: 30000,
    hmrPort: 30001,
    status: 'active',
    expiresAt: Date.now() + 86400000,
    // ... other data
  };

  // 2. Register in map FIRST (before starting Vite)
  sessions.set(sessionId, sessionData);
  
  // 3. Verify it's in map
  const verifySession = sessions.get(sessionId);
  if (!verifySession) {
    throw new Error('Session registration failed');
  }
  
  // 4. THEN start Vite server
  await startViteServer(sessionData);
  
  // 5. Return response
  return {
    success: true,
    sessionId,
    previewUrl: `https://jsbundler.coinnation.io/preview/${sessionId}`,
    wsUrl: `wss://jsbundler.coinnation.io/preview/${sessionId}/hmr`
  };
}
```

### Solution 4: Retry Logic for GET Requests

Add retry logic when session not found:

```javascript
app.use('/preview/:sessionId', async (req, res, next) => {
  const sessionId = req.params.sessionId;
  
  // Try to get session with retry
  let session = getPreviewSession(sessionId);
  let retries = 0;
  const maxRetries = 5;
  
  while (!session && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
    session = getPreviewSession(sessionId);
    retries++;
  }
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Preview session not found',
      sessionId,
      retries
    });
  }
  
  // Continue with proxy...
});
```

## Immediate Action Items

### Priority 1: Fix Session Registration Order
1. Register session in map BEFORE starting Vite
2. Verify session is in map before returning response
3. Add logging to track registration timing

### Priority 2: Apply WebSocket Fix
1. Ensure `websocket-hmr-fix-complete.mjs` is applied
2. Verify Vite HMR WebSocket path is correct
3. Check Vite configuration for HMR settings

### Priority 3: Add Shared Storage
1. Set up Redis (or use existing database)
2. Replace in-memory Map with Redis
3. Test across multiple pods

## Verification

After fixes, check:

1. **Session Registration**:
   ```
   ✅ Session created: a1fad95226646c9f
   ✅ Session verified in map (status: active)
   GET /preview/a1fad95226646c9f
   ✅ Session found in map
   ```

2. **No Race Conditions**:
   - Session always found immediately after creation
   - No "session not found" errors for valid sessions

3. **WebSocket Connection**:
   ```
   ✅ Client WebSocket upgraded
   ✅ Connecting to Vite HMR server
   ✅ WebSocket proxy established
   ❌ NO MORE 400 errors
   ```

## Quick Test

```bash
# Test session creation and immediate access
curl -X POST https://jsbundler.coinnation.io/kontext/preview \
  -H "Content-Type: application/json" \
  -d '{"files":[...],"packageJson":{...}}'

# Get sessionId from response, then immediately:
curl https://jsbundler.coinnation.io/preview/{sessionId}

# Should return 200, not 404
```

