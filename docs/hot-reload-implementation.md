# Hot Reload Implementation for Kontext

## Overview

This document outlines the technical approach for implementing hot reload/live editing in Kontext using the JSBundler server at `jsbundler.coinnation.io`. This enables instant preview updates (2-5 seconds) instead of full deployment (1-3 minutes).

## Architecture

### Current Flow
```
User Chat → AI Generates Code → Files Saved → Full Deployment:
  ├─ Bundle Frontend (Vite) → 30-60s
  ├─ Compile Motoko → 10-30s  
  ├─ Upload to Canister → 20-40s
  └─ Preview Updates → Total: 1-3 minutes
```

### New Hot Reload Flow
```
User Chat → AI Generates Code → Files Saved → Smart Routing:
  ├─ Change Detection → <1s
  ├─ Route Decision:
  │   ├─ CSS/Style Only → Direct Injection → 2s
  │   ├─ Frontend Changes → Preview Session Update → 5s
  │   └─ Backend/Structure → Full Deployment → 1-3min
  └─ Preview Updates Instantly
```

## Backend Implementation (JSBundler Server)

### New Endpoints Required

#### 1. Create Preview Session
```
POST /kontext/preview
Content-Type: application/json

Request:
{
  "files": [
    { "name": "src/frontend/App.tsx", "content": "..." },
    ...
  ],
  "packageJson": { ... },
  "projectType": "icpstudio",
  "sessionId": "optional-existing-session-id"
}

Response:
{
  "success": true,
  "sessionId": "abc123xyz",
  "previewUrl": "https://preview-abc123.jsbundler.coinnation.io",
  "wsUrl": "wss://preview-abc123.jsbundler.coinnation.io/hmr",
  "expiresAt": 1234567890
}
```

#### 2. Update Preview Session Files
```
POST /kontext/preview/{sessionId}/update
Content-Type: application/json

Request:
{
  "files": [
    { "name": "src/frontend/App.tsx", "content": "..." }
  ]
}

Response:
{
  "success": true,
  "updated": ["src/frontend/App.tsx"],
  "hmrTriggered": true
}
```

#### 3. Get Preview Session Status
```
GET /kontext/preview/{sessionId}

Response:
{
  "success": true,
  "sessionId": "abc123xyz",
  "previewUrl": "https://preview-abc123.jsbundler.coinnation.io",
  "status": "active",
  "expiresAt": 1234567890
}
```

#### 4. Delete Preview Session
```
DELETE /kontext/preview/{sessionId}

Response:
{
  "success": true
}
```

### Backend Implementation Details

#### Session Management
```typescript
class PreviewSessionManager {
  private sessions: Map<string, {
    devServer: ViteDevServer;
    fileSystem: VirtualFS;
    createdAt: number;
    expiresAt: number;
  }> = new Map();

  async createSession(files: File[], sessionId?: string): Promise<PreviewSession> {
    const id = sessionId || generateSessionId();
    
    // Create virtual file system
    const virtualFS = createVirtualFS(files);
    
    // Start Vite dev server with HMR
    const devServer = await createServer({
      root: virtualFS.root,
      server: {
        port: 0, // Auto-assign
        hmr: {
          port: 0,
          protocol: 'wss'
        }
      },
      plugins: [react(), hmr()]
    });
    
    // Store session
    this.sessions.set(id, {
      devServer,
      fileSystem: virtualFS,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    });
    
    return {
      sessionId: id,
      previewUrl: `https://preview-${id}.jsbundler.coinnation.io`,
      wsUrl: `wss://preview-${id}.jsbundler.coinnation.io/hmr`,
      expiresAt: this.sessions.get(id)!.expiresAt
    };
  }

  async updateSession(sessionId: string, changedFiles: File[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    // Update virtual file system
    session.fileSystem.updateFiles(changedFiles);
    
    // Vite HMR will automatically detect changes and send updates via WebSocket
  }
}
```

#### Virtual File System
```typescript
class VirtualFS {
  private files: Map<string, string> = new Map();
  root: string;

  constructor(files: File[]) {
    this.root = `/tmp/preview-${Date.now()}`;
    files.forEach(f => this.files.set(f.name, f.content));
    this.syncToDisk();
  }

  updateFiles(changedFiles: File[]): void {
    changedFiles.forEach(f => {
      this.files.set(f.name, f.content);
      this.writeToDisk(f.name, f.content);
    });
  }

  private syncToDisk(): void {
    // Write all files to temporary directory
    // This directory serves as Vite's root
  }
}
```

#### WebSocket HMR
Vite's built-in HMR will automatically:
- Detect file changes
- Send WebSocket messages to connected clients
- Trigger hot module replacement in the browser

No custom WebSocket handling needed - Vite handles it automatically.

## Frontend Implementation (Kontext)

### Services Created

1. **HotReloadService** (`src/frontend/src/services/HotReloadService.ts`)
   - Manages preview sessions
   - Handles WebSocket connections for HMR
   - Updates preview files

2. **ChangeDetectionService** (`src/frontend/src/services/ChangeDetectionService.ts`)
   - Analyzes file changes
   - Determines if hot reload is possible
   - Routes to appropriate strategy

### Integration Points

#### 1. After Code Generation
```typescript
// In chatActionsSlice.ts after files are generated
const analysis = changeDetectionService.analyzeChanges(oldFiles, newFiles);

if (analysis.strategy === 'preview-update' || analysis.strategy === 'hot-reload') {
  // Create or update preview session
  const session = await hotReloadService.createPreviewSession(
    activeProject,
    filesArray,
    packageJson
  );
  
  // Update preview if session exists
  if (analysis.strategy === 'preview-update') {
    await hotReloadService.updatePreviewFiles(
      activeProject,
      analysis.changes.map(c => ({
        fileName: c.fileName,
        content: c.newContent
      }))
    );
  }
}
```

#### 2. Live Preview Interface
```typescript
// In LivePreviewInterface.tsx
const previewUrl = hotReloadService.getPreviewUrl(projectId) 
  || generateCanisterUrl(canisterId); // Fallback to deployed canister

<iframe src={previewUrl} />
```

### Change Detection Logic

| Change Type | Hot Reload? | Strategy |
|------------|-------------|----------|
| CSS file | ✅ Yes | Direct injection or preview update |
| Style-only (CSS-in-JS) | ✅ Yes | Preview update |
| Content-only (text) | ⚠️ Maybe | Preview update |
| Component structure | ❌ No | Full deployment |
| Backend (.mo) | ❌ No | Full deployment |
| New dependencies | ❌ No | Full deployment |

## User Experience Flow

1. **User**: "Make the header blue"
2. **AI**: Generates code updating `Header.tsx` with blue color
3. **System**: Detects CSS/style change → `preview-update` strategy
4. **Hot Reload**: Updates preview session → Vite HMR triggers → **2-5 seconds**
5. **User**: Sees blue header immediately ✨
6. **Background**: Full deployment continues (optional, for persistence)

## Benefits

- ✅ **Instant Feedback**: 2-5 seconds vs 1-3 minutes
- ✅ **Global Platform**: Works for all users, no local setup needed
- ✅ **Smart Routing**: Only uses hot reload when appropriate
- ✅ **Backward Compatible**: Existing deployment flow still works
- ✅ **Progressive Enhancement**: Works with current architecture

## Implementation Timeline

### Phase 1: Backend (JSBundler Server) - 1-2 weeks
- [ ] Add `/kontext/preview` endpoint
- [ ] Implement session management
- [ ] Set up Vite dev server with HMR
- [ ] Create virtual file system
- [ ] Add WebSocket support for HMR
- [ ] Add session expiration/cleanup

### Phase 2: Frontend Services - 1 week
- [x] Create `HotReloadService`
- [x] Create `ChangeDetectionService`
- [ ] Add integration to code generation flow
- [ ] Update `LivePreviewInterface` to use preview URLs

### Phase 3: Testing & Polish - 1 week
- [ ] Test with various change types
- [ ] Handle edge cases (session expiration, errors)
- [ ] Add user notifications
- [ ] Performance optimization

**Total: 3-4 weeks**

## Technical Considerations

### Session Management
- Sessions expire after 24 hours of inactivity
- Maximum 100 concurrent sessions per user
- Automatic cleanup of expired sessions

### Security
- Session IDs are cryptographically random
- Preview URLs are not publicly discoverable
- WebSocket connections require valid session ID

### Performance
- Vite dev server starts in ~2-3 seconds
- HMR updates propagate in <1 second
- File updates are debounced (500ms)

### Error Handling
- If preview session fails, fallback to full deployment
- WebSocket reconnection with exponential backoff
- Graceful degradation if JSBundler is unavailable

## Next Steps

1. **Backend Team**: Implement preview session endpoints on JSBundler server
2. **Frontend Team**: Integrate `HotReloadService` into code generation flow
3. **Testing**: Test with real projects and various change types
4. **Documentation**: Update user-facing docs with hot reload capabilities

