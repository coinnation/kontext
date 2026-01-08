/**
 * Hot Reload Service - Manages preview sessions on JSBundler server
 * Enables instant preview updates without full deployment
 */

/**
 * Generate Vite config for preview sessions (matches deployment config generation)
 * 
 * IMPORTANT: The server will enhance this config:
 * - Replaces `port: 3000` with the dynamically allocated port (30000+)
 * - Adds `css: { postcss: './postcss.config.js' }` if missing (for Tailwind)
 * 
 * For icpstudio projects, this should be placed at src/frontend/vite.config.js
 * with root: '.' so Vite can find postcss.config.js and tailwind.config.js
 * 
 * The server's injectServerConfigIntoViteConfig() will process this config.
 */
export function generateViteConfigForPreview(backendCanisterId?: string): string {
  // For preview, backend canister ID is optional (may not be deployed yet)
  const backendCanisterDefine = backendCanisterId 
    ? `        'import.meta.env.VITE_BACKEND_CANISTER_ID': '"${backendCanisterId}"',`
    : '';
  
  // Note: port: 3000 will be replaced by server with allocated port (30000+)
  // Note: PostCSS config will be added by server if missing
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    root: '.',
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: resolve(__dirname, 'index.html')
        }
    },
    server: {
        port: 3000
    },
    define: {
${backendCanisterDefine ? backendCanisterDefine + '\n' : ''}        'global': 'globalThis'
    }
});`;
}

/**
 * Normalize file paths for preview sessions (matches server's normalizeFilesForProjectType for icpstudio)
 * Removes project name prefix to match what Vite expects
 * Server's normalization: normalizedName.replace(/^[^/]+\//, '') - removes first path segment
 * 
 * This ensures files like "ProjectName/src/index.jsx" become "src/index.jsx" which Vite expects
 */
export function normalizeFilePathForPreview(fileName: string, projectName?: string | null): string {
  // Server's normalization for icpstudio: remove first path segment if it exists
  // Example: "ProjectName/src/index.jsx" -> "src/index.jsx"
  // Example: "src/index.jsx" -> "src/index.jsx" (no change)
  
  // If path has a slash, check if first segment should be removed
  const firstSlashIndex = fileName.indexOf('/');
  if (firstSlashIndex > 0) {
    const firstSegment = fileName.substring(0, firstSlashIndex);
    const restOfPath = fileName.substring(firstSlashIndex + 1);
    
    // If we know the project name and first segment matches, remove it
    if (projectName && firstSegment === projectName) {
      return restOfPath;
    }
    
    // If first segment is capitalized (likely project name) and rest starts with standard paths, remove it
    // Standard paths: src/, public/, etc.
    const isStandardPath = restOfPath.startsWith('src/') || 
                          restOfPath.startsWith('public/') || 
                          restOfPath === 'package.json' ||
                          restOfPath === 'index.html' ||
                          restOfPath.startsWith('vite.config');
    
    if (isStandardPath && firstSegment[0] === firstSegment[0].toUpperCase() && firstSegment.length > 1) {
      // First segment looks like a project name, remove it
      return restOfPath;
    }
  }
  
  // No normalization needed - path is already correct
  return fileName;
}

interface PreviewSession {
  sessionId: string;
  previewUrl: string;
  wsUrl: string;
  expiresAt: number;
  projectId: string;
}

interface FileUpdate {
  fileName: string;
  content: string;
}

interface PreviewSessionResponse {
  success: boolean;
  sessionId: string;
  previewUrl: string;
  wsUrl: string;
  expiresAt: number;
  error?: string;
}

class HotReloadService {
  private static instance: HotReloadService;
  private activeSessions: Map<string, PreviewSession> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();
  private fileWatchers: Map<string, NodeJS.Timeout> = new Map();
  private wsRetryCounts: Map<string, number> = new Map();
  private readonly MAX_WS_RETRIES = 3; // Limit retry attempts
  private pendingCreations: Map<string, Promise<PreviewSession>> = new Map(); // Lock for concurrent creation

  private constructor() {}

  static getInstance(): HotReloadService {
    if (!HotReloadService.instance) {
      HotReloadService.instance = new HotReloadService();
    }
    return HotReloadService.instance;
  }

  /**
   * Create or get existing preview session for a project
   */
  async createPreviewSession(
    projectId: string,
    files: Array<{ name: string; content: string }>,
    packageJson: any
  ): Promise<PreviewSession> {
    // Check if session already exists and is still valid
    const existingSession = this.activeSessions.get(projectId);
    if (existingSession && existingSession.expiresAt > Date.now()) {
      console.log(`[HotReload] ♻️ Reusing existing preview session: ${existingSession.sessionId}`);
      // Update files in existing session instead of creating new one
      try {
        await this.updatePreviewFiles(projectId, files.map(f => ({
          fileName: f.name,
          content: f.content
        })));
      } catch (error) {
        console.warn('[HotReload] ⚠️ Failed to update existing session, will create new one:', error);
        // If update fails, continue to create new session
      }
      return existingSession;
    }

    // 🔥 CRITICAL: Check if session creation is already in progress (prevent race condition)
    const pendingCreation = this.pendingCreations.get(projectId);
    if (pendingCreation) {
      console.log(`[HotReload] ⏳ Session creation already in progress for ${projectId}, waiting...`);
      return pendingCreation;
    }

    // Create new session (with lock to prevent concurrent creation)
    const creationPromise = this._doCreatePreviewSession(projectId, files, packageJson, existingSession?.sessionId);
    this.pendingCreations.set(projectId, creationPromise);

    try {
      const session = await creationPromise;
      return session;
    } finally {
      // Remove lock after creation completes (success or failure)
      this.pendingCreations.delete(projectId);
    }
  }

  /**
   * Internal method to actually create the preview session
   */
  private async _doCreatePreviewSession(
    projectId: string,
    files: Array<{ name: string; content: string }>,
    packageJson: any,
    existingSessionId?: string
  ): Promise<PreviewSession> {
    console.log(`[HotReload] Creating new preview session for project: ${projectId}${existingSessionId ? ` (reusing sessionId: ${existingSessionId})` : ''}`);

    try {
      const response = await fetch('https://jsbundler.coinnation.io/kontext/preview', {
        method: 'POST',
        credentials: 'include', // CRITICAL: Send cookies for session affinity (Ingress route cookie)
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          packageJson,
          projectType: 'icpstudio',
          sessionId: existingSessionId // Pass sessionId to server for reuse
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Preview session creation failed: ${errorText}`);
      }

      const data: PreviewSessionResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Preview session creation failed');
      }

      const session: PreviewSession = {
        sessionId: data.sessionId,
        previewUrl: data.previewUrl,
        wsUrl: data.wsUrl,
        expiresAt: data.expiresAt,
        projectId
      };

      // Store session
      this.activeSessions.set(projectId, session);

      // Connect WebSocket for HMR updates
      this.connectHMR(session);

      console.log(`[HotReload] ✅ Preview session created: ${session.previewUrl}`);
      console.log(`[HotReload] 📋 Session stored for project: ${projectId}`);
      return session;
    } catch (error) {
      console.error('[HotReload] ❌ Failed to create preview session:', error);
      throw error;
    }
  }

  /**
   * Update files in existing preview session
   */
  async updatePreviewFiles(
    projectId: string,
    changedFiles: FileUpdate[]
  ): Promise<void> {
    // 🔥 CRITICAL: Wait for any pending session creation to complete first
    // This prevents race conditions where updatePreviewFiles is called before session is stored
    const pendingCreation = this.pendingCreations.get(projectId);
    if (pendingCreation) {
      console.log(`[HotReload] ⏳ Waiting for pending session creation to complete before update...`);
      try {
        await pendingCreation;
        console.log(`[HotReload] ✅ Pending session creation completed, proceeding with update`);
      } catch (error) {
        console.warn(`[HotReload] ⚠️ Pending session creation failed, will check for existing session:`, error);
      }
    }
    
    // 🔥 CRITICAL: Re-fetch session to ensure we have the latest one (in case it was updated)
    let session = this.activeSessions.get(projectId);
    if (!session) {
      // Session doesn't exist - this is expected on first "Apply" click
      // The caller (PropertyEditor) will catch this and create a session
      // Don't log as error since this is normal flow
      throw new Error(`No active preview session for project: ${projectId}`);
    }

    if (session.expiresAt <= Date.now()) {
      console.log(`[HotReload] ⏰ Session expired, removing from cache...`);
      console.log(`[HotReload]   SessionId: ${session.sessionId}`);
      console.log(`[HotReload]   Expired at: ${new Date(session.expiresAt).toISOString()}`);
      console.log(`[HotReload]   Current time: ${new Date().toISOString()}`);
      // Session expired, will be recreated on next preview request
      this.activeSessions.delete(projectId);
      throw new Error('Preview session expired');
    }

    // 🔥 CRITICAL: Double-check session is still valid before using it
    const currentSession = this.activeSessions.get(projectId);
    if (!currentSession || currentSession.sessionId !== session.sessionId) {
      console.warn(`[HotReload] ⚠️ Session changed during update, using latest session`);
      session = currentSession;
      if (!session) {
        throw new Error(`Session was removed during update for project: ${projectId}`);
      }
    }

    console.log(`[HotReload] 📝 Updating ${changedFiles.length} files in preview session ${session.sessionId}...`);
    console.log(`[HotReload]   Project: ${projectId}`);
    console.log(`[HotReload]   Session age: ${Math.round((Date.now() - (session.expiresAt - 24 * 60 * 60 * 1000)) / 1000)}s`);

    try {
      const response = await fetch(
        `https://jsbundler.coinnation.io/kontext/preview/${session.sessionId}/update`,
        {
          method: 'POST',
          credentials: 'include', // CRITICAL: Send cookies for session affinity (Ingress route cookie)
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: changedFiles.map(f => ({
              name: f.fileName,
              content: f.content
            }))
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HotReload] ❌ Update failed for session ${session.sessionId}:`, errorText);
        console.error(`[HotReload]   Response status: ${response.status}`);
        throw new Error(`Preview update failed: ${errorText}`);
      }

      // HMR update will be sent via WebSocket automatically
      console.log(`[HotReload] ✅ Files updated, HMR will trigger automatically`);
    } catch (error) {
      console.error('[HotReload] ❌ Failed to update preview files:', error);
      console.error(`[HotReload]   SessionId used: ${session.sessionId}`);
      console.error(`[HotReload]   ProjectId: ${projectId}`);
      throw error;
    }
  }

  /**
   * Connect WebSocket for HMR updates
   * Note: WebSocket is optional - preview works without it, just without instant HMR
   */
  private connectHMR(session: PreviewSession): void {
    // Check retry count
    const retryCount = this.wsRetryCounts.get(session.projectId) || 0;
    if (retryCount >= this.MAX_WS_RETRIES) {
      console.warn(`[HotReload] ⚠️ Max WebSocket retries reached (${this.MAX_WS_RETRIES}). HMR disabled, but preview still works. Refresh preview to see changes.`);
      return;
    }

    // Close existing connection if any
    const existingWs = this.wsConnections.get(session.projectId);
    if (existingWs) {
      existingWs.close();
    }

    try {
      const ws = new WebSocket(session.wsUrl);

      ws.onopen = () => {
        console.log(`[HotReload] 🔌 HMR WebSocket connected for project: ${session.projectId}`);
        // Reset retry count on successful connection
        this.wsRetryCounts.set(session.projectId, 0);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'update') {
            console.log(`[HotReload] 🔄 HMR update received:`, message);
            // Preview will update automatically via HMR
          } else if (message.type === 'error') {
            console.error(`[HotReload] ❌ HMR error:`, message.error);
          }
        } catch (e) {
          console.warn(`[HotReload] ⚠️ Failed to parse WebSocket message:`, e);
        }
      };

      ws.onerror = (error) => {
        console.warn(`[HotReload] ⚠️ WebSocket connection failed (this is non-critical - preview still works):`, error);
        // Increment retry count
        this.wsRetryCounts.set(session.projectId, retryCount + 1);
      };

      ws.onclose = (event) => {
        // Only retry if it wasn't a normal close and we haven't exceeded max retries
        if (event.code !== 1000 && retryCount < this.MAX_WS_RETRIES) {
          console.log(`[HotReload] 🔌 WebSocket closed, attempting reconnect (${retryCount + 1}/${this.MAX_WS_RETRIES})...`);
          setTimeout(() => {
            if (this.activeSessions.has(session.projectId)) {
              this.connectHMR(session);
            }
          }, 3000);
        } else if (retryCount >= this.MAX_WS_RETRIES) {
          console.warn(`[HotReload] ⚠️ HMR WebSocket unavailable. Preview works, but you may need to refresh to see changes.`);
        }
      };

      this.wsConnections.set(session.projectId, ws);
    } catch (error) {
      console.warn(`[HotReload] ⚠️ Failed to connect HMR WebSocket (non-critical):`, error);
      this.wsRetryCounts.set(session.projectId, retryCount + 1);
    }
  }

  /**
   * Get preview URL for a project
   */
  getPreviewUrl(projectId: string): string | null {
    const session = this.activeSessions.get(projectId);
    if (!session || session.expiresAt <= Date.now()) {
      return null;
    }
    return session.previewUrl;
  }

  /**
   * Close preview session
   */
  async closePreviewSession(projectId: string): Promise<void> {
    const session = this.activeSessions.get(projectId);
    if (!session) return;

    // Close WebSocket
    const ws = this.wsConnections.get(projectId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(projectId);
    }

    // Clear file watcher
    const watcher = this.fileWatchers.get(projectId);
    if (watcher) {
      clearTimeout(watcher);
      this.fileWatchers.delete(projectId);
    }

    // Optionally notify server to clean up session
    try {
      await fetch(
        `https://jsbundler.coinnation.io/kontext/preview/${session.sessionId}`,
        { 
          method: 'DELETE',
          credentials: 'include' // CRITICAL: Send cookies for session affinity (Ingress route cookie)
        }
      );
    } catch (error) {
      console.error('[HotReload] Failed to close session on server:', error);
    }

    this.activeSessions.delete(projectId);
    console.log(`[HotReload] ✅ Preview session closed for project: ${projectId}`);
  }

  /**
   * Watch for file changes and auto-update preview
   */
  watchProjectFiles(
    projectId: string,
    getFiles: () => Record<string, string>,
    onUpdate?: () => void
  ): () => void {
    let lastFiles: Record<string, string> = {};
    let updateTimeout: NodeJS.Timeout | null = null;

    const checkForChanges = () => {
      const currentFiles = getFiles();
      const changedFiles: FileUpdate[] = [];

      // Detect changes
      for (const [fileName, content] of Object.entries(currentFiles)) {
        if (lastFiles[fileName] !== content) {
          changedFiles.push({ fileName, content });
        }
      }

      // Check for deleted files
      for (const fileName of Object.keys(lastFiles)) {
        if (!(fileName in currentFiles)) {
          // File was deleted - would need special handling
        }
      }

      if (changedFiles.length > 0) {
        // Debounce updates
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }

        updateTimeout = setTimeout(async () => {
          try {
            await this.updatePreviewFiles(projectId, changedFiles);
            onUpdate?.();
          } catch (error) {
            console.error('[HotReload] Auto-update failed:', error);
          }
        }, 500); // 500ms debounce
      }

      lastFiles = { ...currentFiles };
    };

    // Poll for changes every 1 second
    const interval = setInterval(checkForChanges, 1000);
    this.fileWatchers.set(projectId, interval as any);

    // Return cleanup function
    return () => {
      clearInterval(interval);
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      this.fileWatchers.delete(projectId);
    };
  }
}

export const hotReloadService = HotReloadService.getInstance();

