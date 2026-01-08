# JSBundler HMR Endpoints Specification

## Overview

This document specifies the endpoints required on `jsbundler.coinnation.io` to enable hot module reloading (HMR) for Kontext's live preview feature. These endpoints will allow users to see code changes instantly (2-5 seconds) without full deployment.

## Architecture

The system uses **Vite dev server with HMR** running on the JSBundler server. Each project gets a temporary preview session with:
- A Vite dev server instance
- Virtual file system (in-memory)
- WebSocket connection for HMR updates
- 24-hour session expiration

## Required Endpoints

### 1. Create Preview Session

**Endpoint:** `POST /kontext/preview`

**Purpose:** Creates a new preview session with a Vite dev server for a project.

**Request Body:**
```json
{
  "files": [
    {
      "name": "src/frontend/App.tsx",
      "content": "import React from 'react';\n..."
    },
    {
      "name": "src/frontend/index.html",
      "content": "<!DOCTYPE html>..."
    }
  ],
  "packageJson": {
    "name": "my-project",
    "dependencies": {
      "react": "^18.2.0",
      "react-dom": "^18.2.0"
    }
  },
  "projectType": "icpstudio",
  "sessionId": "optional-existing-session-id"
}
```

**Response (Success):**
```json
{
  "success": true,
  "sessionId": "abc123xyz789",
  "previewUrl": "https://preview-abc123.jsbundler.coinnation.io",
  "wsUrl": "wss://preview-abc123.jsbundler.coinnation.io/hmr",
  "expiresAt": 1234567890000
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid package.json: missing dependencies"
}
```

**Implementation Requirements:**

1. **Session Management:**
   - Generate unique session ID (cryptographically random, 12+ characters)
   - Store session in memory/database with expiration (24 hours)
   - If `sessionId` provided and exists, reuse that session

2. **Virtual File System:**
   - Create temporary directory structure
   - Write all files from request to disk
   - Structure should match standard Vite project layout:
     ```
     /tmp/preview-{sessionId}/
       src/
         frontend/
           App.tsx
           index.html
           package.json
           ...
     ```

3. **Vite Dev Server:**
   - Start Vite dev server with:
     ```javascript
     import { createServer } from 'vite';
     import react from '@vitejs/plugin-react';
     
     const server = await createServer({
       root: '/tmp/preview-{sessionId}',
       server: {
         port: 0, // Auto-assign available port
         hmr: {
           port: 0, // Auto-assign HMR port
           protocol: 'wss' // WebSocket Secure
         }
       },
       plugins: [react()],
       // Enable HMR
       optimizeDeps: {
         include: ['react', 'react-dom']
       }
     });
     
     await server.listen();
     ```

4. **URL Generation:**
   - Map session ID to server port
   - Generate preview URL: `https://preview-{sessionId}.jsbundler.coinnation.io`
   - Generate WebSocket URL: `wss://preview-{sessionId}.jsbundler.coinnation.io/hmr`
   - Set up reverse proxy/load balancer to route these domains to the correct ports

5. **Session Storage:**
   ```javascript
   {
     sessionId: string,
     devServer: ViteDevServer,
     fileSystem: VirtualFS,
     createdAt: number,
     expiresAt: number,
     port: number,
     hmrPort: number
   }
   ```

---

### 2. Update Preview Session Files

**Endpoint:** `POST /kontext/preview/{sessionId}/update`

**Purpose:** Updates files in an existing preview session and triggers HMR.

**Path Parameters:**
- `sessionId` (string): The preview session ID

**Request Body:**
```json
{
  "files": [
    {
      "name": "src/frontend/App.tsx",
      "content": "// Updated content..."
    }
  ]
}
```

**Response (Success):**
```json
{
  "success": true,
  "updated": ["src/frontend/App.tsx"],
  "hmrTriggered": true
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Session not found or expired"
}
```

**Implementation Requirements:**

1. **Session Lookup:**
   - Find session by `sessionId`
   - Check if session exists and hasn't expired
   - Return error if session not found

2. **File Updates:**
   - Write updated files to virtual file system
   - Update file timestamps to trigger Vite file watcher
   - Vite will automatically detect changes and trigger HMR

3. **HMR Trigger:**
   - Vite's file watcher will automatically:
     - Detect file changes
     - Rebuild affected modules
     - Send WebSocket messages to connected clients
     - Clients will hot-reload the changed modules

4. **No Manual HMR Needed:**
   - Vite handles HMR automatically via file watcher
   - Just update files on disk, Vite does the rest

---

### 3. Get Preview Session Status

**Endpoint:** `GET /kontext/preview/{sessionId}`

**Purpose:** Returns the current status of a preview session.

**Path Parameters:**
- `sessionId` (string): The preview session ID

**Response (Success):**
```json
{
  "success": true,
  "sessionId": "abc123xyz789",
  "previewUrl": "https://preview-abc123.jsbundler.coinnation.io",
  "wsUrl": "wss://preview-abc123.jsbundler.coinnation.io/hmr",
  "status": "active",
  "expiresAt": 1234567890000,
  "createdAt": 1234560000000
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Session not found"
}
```

**Implementation Requirements:**

1. **Session Lookup:**
   - Find session by `sessionId`
   - Return session metadata
   - Check if session is still active (not expired)

2. **Status Values:**
   - `"active"`: Session is running and valid
   - `"expired"`: Session has passed expiration time
   - `"not_found"`: Session doesn't exist

---

### 4. Delete Preview Session

**Endpoint:** `DELETE /kontext/preview/{sessionId}`

**Purpose:** Closes and cleans up a preview session.

**Path Parameters:**
- `sessionId` (string): The preview session ID

**Response (Success):**
```json
{
  "success": true,
  "message": "Session closed successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Session not found"
}
```

**Implementation Requirements:**

1. **Session Cleanup:**
   - Stop Vite dev server
   - Close WebSocket connections
   - Delete temporary files/directories
   - Remove session from storage

2. **Graceful Shutdown:**
   - Allow in-flight requests to complete
   - Close WebSocket connections gracefully
   - Clean up file system resources

---

## Technical Implementation Details

### Vite Dev Server Setup

```javascript
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

async function createPreviewSession(files, packageJson, sessionId) {
  // 1. Create temporary directory
  const tempDir = `/tmp/preview-${sessionId}`;
  await fs.mkdir(tempDir, { recursive: true });
  
  // 2. Write files to disk
  for (const file of files) {
    const filePath = path.join(tempDir, file.name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.content, 'utf8');
  }
  
  // 3. Write package.json
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf8'
  );
  
  // 4. Create Vite config if needed
  const viteConfig = {
    plugins: [react()],
    server: {
      port: 0, // Auto-assign
      hmr: {
        port: 0, // Auto-assign
        protocol: 'wss'
      },
      host: '0.0.0.0' // Allow external connections
    },
    optimizeDeps: {
      include: ['react', 'react-dom']
    }
  };
  
  // 5. Start Vite dev server
  const server = await createServer({
    root: tempDir,
    ...viteConfig
  });
  
  await server.listen();
  
  const port = server.config.server.port;
  const hmrPort = server.config.server.hmr?.port || port;
  
  return {
    sessionId,
    devServer: server,
    tempDir,
    port,
    hmrPort,
    previewUrl: `https://preview-${sessionId}.jsbundler.coinnation.io`,
    wsUrl: `wss://preview-${sessionId}.jsbundler.coinnation.io/hmr`
  };
}
```

### Session Management

```javascript
class PreviewSessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000); // Every minute
  }
  
  async createSession(files, packageJson, sessionId) {
    // Check if session exists
    if (sessionId && this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId);
      if (existing.expiresAt > Date.now()) {
        return existing; // Reuse existing session
      }
      // Session expired, clean it up
      await this.closeSession(sessionId);
    }
    
    // Create new session
    const session = await createPreviewSession(files, packageJson, sessionId);
    session.createdAt = Date.now();
    session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    this.sessions.set(session.sessionId, session);
    return session;
  }
  
  async updateSession(sessionId, changedFiles) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    if (session.expiresAt <= Date.now()) {
      throw new Error('Session expired');
    }
    
    // Update files on disk
    for (const file of changedFiles) {
      const filePath = path.join(session.tempDir, file.name);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf8');
    }
    
    // Vite file watcher will automatically detect changes and trigger HMR
    return { updated: changedFiles.map(f => f.name), hmrTriggered: true };
  }
  
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    if (session.expiresAt <= Date.now()) {
      return { ...session, status: 'expired' };
    }
    
    return { ...session, status: 'active' };
  }
  
  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    // Stop Vite server
    await session.devServer.close();
    
    // Delete temporary files
    await fs.rm(session.tempDir, { recursive: true, force: true });
    
    // Remove from map
    this.sessions.delete(sessionId);
  }
  
  async cleanupExpired() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        console.log(`Cleaning up expired session: ${sessionId}`);
        await this.closeSession(sessionId);
      }
    }
  }
}
```

### Reverse Proxy Configuration

You'll need to set up reverse proxy/load balancer to route:
- `preview-*.jsbundler.coinnation.io` → Vite dev server port
- `wss://preview-*.jsbundler.coinnation.io/hmr` → Vite HMR WebSocket port

**Example Nginx Configuration:**
```nginx
# Extract session ID from subdomain
map $host $session_id {
    ~^preview-(?<id>[^.]+)\.jsbundler\.coinnation\.io$ $id;
    default "";
}

# HTTP preview
server {
    listen 443 ssl;
    server_name preview-*.jsbundler.coinnation.io;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        # Lookup session ID -> port mapping
        set $backend_port $session_port_${session_id};
        proxy_pass http://127.0.0.1:$backend_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# WebSocket HMR
server {
    listen 443 ssl;
    server_name preview-*.jsbundler.coinnation.io;
    
    location /hmr {
        set $backend_port $session_hmr_port_${session_id};
        proxy_pass http://127.0.0.1:$backend_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

**Alternative: Use a routing service**
- Store session ID → port mapping in Redis/database
- Use a routing service to look up ports dynamically
- Or use a service mesh/API gateway

---

## Error Handling

### Common Errors

1. **Session Not Found:**
   ```json
   {
     "success": false,
     "error": "Session not found",
     "code": "SESSION_NOT_FOUND"
   }
   ```

2. **Session Expired:**
   ```json
   {
     "success": false,
     "error": "Session expired",
     "code": "SESSION_EXPIRED"
   }
   ```

3. **Invalid Files:**
   ```json
   {
     "success": false,
     "error": "Invalid file structure: missing index.html",
     "code": "INVALID_FILES"
   }
   ```

4. **Port Allocation Failed:**
   ```json
   {
     "success": false,
     "error": "No available ports",
     "code": "PORT_ALLOCATION_FAILED"
   }
   ```

---

## Security Considerations

1. **Session ID Generation:**
   - Use cryptographically secure random generation
   - Minimum 12 characters, alphanumeric
   - Example: `crypto.randomBytes(8).toString('hex')`

2. **Rate Limiting:**
   - Limit session creation per IP/user
   - Prevent abuse (e.g., max 10 sessions per hour)

3. **Resource Limits:**
   - Maximum session duration: 24 hours
   - Maximum concurrent sessions per user: 10
   - Automatic cleanup of expired sessions

4. **CORS:**
   - Allow requests from `kontext.coinnation.io` (or your domain)
   - Configure CORS headers appropriately

5. **WebSocket Security:**
   - Use WSS (WebSocket Secure)
   - Validate origin headers
   - Rate limit WebSocket connections

---

## Performance Considerations

1. **Port Management:**
   - Use port range: e.g., 30000-40000
   - Track allocated ports
   - Reuse ports after session cleanup

2. **File System:**
   - Use fast storage (SSD)
   - Consider in-memory file system for small projects
   - Clean up temp files aggressively

3. **Memory Management:**
   - Limit concurrent sessions
   - Monitor memory usage per session
   - Kill sessions if memory exceeds threshold

4. **Vite Optimization:**
   - Pre-bundle common dependencies
   - Use Vite's dependency pre-bundling
   - Cache node_modules when possible

---

## Testing Checklist

- [ ] Create session with valid files → Returns preview URL
- [ ] Create session with invalid package.json → Returns error
- [ ] Update files in active session → HMR triggers
- [ ] Get session status → Returns correct status
- [ ] Delete session → Cleans up resources
- [ ] Expired session → Returns error on access
- [ ] Concurrent sessions → Multiple sessions work independently
- [ ] WebSocket HMR → Changes appear in browser instantly
- [ ] Port allocation → Handles port exhaustion gracefully
- [ ] File system cleanup → Temp files deleted after session close

---

## Example Request/Response Flow

### 1. Create Session
```bash
POST /kontext/preview
{
  "files": [...],
  "packageJson": {...}
}

→ 200 OK
{
  "success": true,
  "sessionId": "abc123",
  "previewUrl": "https://preview-abc123.jsbundler.coinnation.io",
  "wsUrl": "wss://preview-abc123.jsbundler.coinnation.io/hmr"
}
```

### 2. Update Files
```bash
POST /kontext/preview/abc123/update
{
  "files": [
    {"name": "src/App.tsx", "content": "// updated"}
  ]
}

→ 200 OK
{
  "success": true,
  "updated": ["src/App.tsx"],
  "hmrTriggered": true
}
```

### 3. Browser Receives HMR Update
- Vite detects file change
- Rebuilds module
- Sends WebSocket message to browser
- Browser hot-reloads module
- User sees change instantly ✨

---

## Dependencies

Required npm packages:
```json
{
  "vite": "^5.0.0",
  "@vitejs/plugin-react": "^4.0.0",
  "express": "^4.18.0",
  "ws": "^8.14.0"
}
```

---

## Questions?

If you need clarification on any part of this specification, please ask. The key points are:

1. **Vite handles HMR automatically** - you just need to update files on disk
2. **Each session = one Vite dev server instance**
3. **WebSocket is handled by Vite** - no custom WebSocket code needed
4. **Reverse proxy routes subdomains to ports**

Good luck with the implementation! 🚀

