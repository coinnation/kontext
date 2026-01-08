# JSBundler HMR Implementation - Quick Start Prompt

## TL;DR

Add 4 endpoints to `jsbundler.coinnation.io` to enable instant preview updates (2-5 seconds) instead of full deployment (1-3 minutes).

## Required Endpoints

### 1. `POST /kontext/preview`
**Creates a Vite dev server session**

**Request:**
```json
{
  "files": [{"name": "src/App.tsx", "content": "..."}],
  "packageJson": {...},
  "sessionId": "optional"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123",
  "previewUrl": "https://preview-abc123.jsbundler.coinnation.io",
  "wsUrl": "wss://preview-abc123.jsbundler.coinnation.io/hmr",
  "expiresAt": 1234567890000
}
```

**Implementation:**
- Create temp directory `/tmp/preview-{sessionId}`
- Write all files to disk
- Start Vite dev server with HMR enabled
- Return preview URL and WebSocket URL
- Store session (expires in 24 hours)

### 2. `POST /kontext/preview/{sessionId}/update`
**Updates files and triggers HMR**

**Request:**
```json
{
  "files": [{"name": "src/App.tsx", "content": "// updated"}]
}
```

**Response:**
```json
{
  "success": true,
  "updated": ["src/App.tsx"],
  "hmrTriggered": true
}
```

**Implementation:**
- Find session by ID
- Write updated files to disk
- Vite file watcher automatically triggers HMR (no manual code needed!)

### 3. `GET /kontext/preview/{sessionId}`
**Get session status**

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123",
  "previewUrl": "https://preview-abc123.jsbundler.coinnation.io",
  "status": "active",
  "expiresAt": 1234567890000
}
```

### 4. `DELETE /kontext/preview/{sessionId}`
**Close session and cleanup**

**Response:**
```json
{
  "success": true
}
```

## Key Implementation Points

1. **Use Vite Dev Server:**
   ```javascript
   import { createServer } from 'vite';
   import react from '@vitejs/plugin-react';
   
   const server = await createServer({
     root: '/tmp/preview-{sessionId}',
     server: {
       port: 0, // Auto-assign
       hmr: { port: 0, protocol: 'wss' }
     },
     plugins: [react()]
   });
   await server.listen();
   ```

2. **Vite Handles HMR Automatically:**
   - Just update files on disk
   - Vite's file watcher detects changes
   - Vite sends WebSocket messages
   - Browser hot-reloads automatically
   - **No custom WebSocket code needed!**

3. **Reverse Proxy Setup:**
   - Route `preview-*.jsbundler.coinnation.io` → Vite server port
   - Route `wss://preview-*.jsbundler.coinnation.io/hmr` → Vite HMR port
   - Use session ID → port mapping

4. **Session Management:**
   - Store sessions in memory/Redis
   - Auto-expire after 24 hours
   - Clean up temp files on close

## Full Specification

See `docs/jsbundler-hmr-endpoints-spec.md` for complete technical details, error handling, security, and examples.

## Questions?

The main thing to remember: **Vite does all the HMR work automatically**. You just need to:
1. Start Vite dev server per session
2. Update files on disk when requested
3. Vite handles the rest! 🚀

