# WebSocket HMR 400 Error - Complete Fix Guide

## Problem

The WebSocket connection to Vite HMR is failing with:
```
❌ WebSocket target error: Unexpected server response: 400
❌ Failed to connect to Vite HMR server
```

## Root Causes

1. **Wrong hostname**: Using `localhost` instead of `127.0.0.1` (IPv6 vs IPv4 issue)
2. **Wrong connection order**: Connecting to Vite BEFORE client upgrade completes
3. **Missing/incorrect path**: Vite HMR expects root path `/`
4. **Missing headers**: Not forwarding proper Origin/Host headers

## Solution

Replace your WebSocket upgrade handler with the fixed version in `websocket-hmr-fix-complete.mjs`.

### Key Changes

1. **Use `127.0.0.1` instead of `localhost`**
   ```javascript
   // OLD (WRONG)
   const targetWs = new WebSocket(`ws://localhost:${session.hmrPort}`, {
     headers: { 'Origin': `http://localhost:${session.hmrPort}` }
   });
   
   // NEW (CORRECT)
   const targetWs = new WebSocket(`ws://127.0.0.1:${session.hmrPort}/`, {
     headers: {
       'Origin': `http://127.0.0.1:${session.hmrPort}`,
       'Host': `127.0.0.1:${session.hmrPort}`
     }
   });
   ```

2. **Wait for client upgrade BEFORE connecting to Vite**
   ```javascript
   // OLD (WRONG) - connects to Vite immediately
   const targetWs = new WebSocket(...);
   wss.handleUpgrade(request, socket, head, (clientWs) => {
     // Setup forwarding
   });
   
   // NEW (CORRECT) - upgrade client first, then connect to Vite
   wss.handleUpgrade(request, socket, head, (clientWs) => {
     // Client is upgraded, NOW connect to Vite
     const targetWs = new WebSocket(...);
     targetWs.on('open', () => {
       // Setup forwarding
     });
   });
   ```

3. **Use root path `/` for Vite HMR**
   ```javascript
   const viteHmrUrl = `ws://127.0.0.1:${session.hmrPort}/`;
   ```

4. **Forward proper headers**
   ```javascript
   headers: {
     'Origin': `http://127.0.0.1:${session.hmrPort}`,
     'Host': `127.0.0.1:${session.hmrPort}`,
     ...(request.headers['sec-websocket-protocol'] && {
       'Sec-WebSocket-Protocol': request.headers['sec-websocket-protocol']
     })
   }
   ```

## How to Apply

1. **On your JSBundler server**, find the WebSocket upgrade handler in your `index.mjs` (or equivalent server file)

2. **Replace the `setupWebSocketProxy` function** with the one from `websocket-hmr-fix-complete.mjs`

3. **Restart your server**

4. **Test the connection** - you should see:
   ```
   ✅ Client WebSocket upgraded for session {sessionId}
   🔌 Connecting to Vite HMR server: ws://127.0.0.1:{hmrPort}/
   ✅ WebSocket proxy established for session {sessionId}
   ```

## Verification

After applying the fix, check your server logs. You should see:
- ✅ Client WebSocket upgraded
- ✅ Connecting to Vite HMR server
- ✅ WebSocket proxy established
- ❌ NO MORE "Unexpected server response: 400" errors

## Additional Debugging

If you still see 400 errors after applying the fix:

1. **Check if Vite HMR server is running**:
   ```bash
   curl http://127.0.0.1:30001/
   # Should return HTML or 200 OK
   ```

2. **Check Vite HMR WebSocket directly**:
   ```bash
   wscat -c ws://127.0.0.1:30001/
   # Should connect successfully
   ```

3. **Check Vite configuration** - ensure HMR is enabled:
   ```javascript
   // vite.config.js
   export default {
     server: {
       hmr: {
         port: 30001, // or your HMR port
         host: '0.0.0.0' // or '127.0.0.1'
       }
     }
   }
   ```

## Why This Works

- **IPv4 explicit**: `127.0.0.1` ensures we use IPv4, avoiding IPv6 resolution issues
- **Correct path**: Vite HMR WebSocket listens on root path `/`
- **Proper order**: Client upgrade must complete before connecting to Vite
- **Correct headers**: Vite validates Origin and Host headers for security

