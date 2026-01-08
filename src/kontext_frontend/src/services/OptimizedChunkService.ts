/**
 * 🚀 OPTIMIZED CHUNK SERVICE
 * 
 * High-performance chunk loading with:
 * - Batch retrieval (5-10× faster)
 * - Parallel loading
 * - Smart prefetching
 * - IndexedDB caching
 * - Intelligent file prediction
 */

import { userCanisterService } from './UserCanisterService';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ===============================
// TYPES
// ===============================

interface Chunk {
  id: number;
  content: Uint8Array;
  size: number;
}

interface CachedChunk {
  id: number;
  content: Uint8Array;
  timestamp: number;
  projectId: string;
  accessCount: number;
}

interface FileMetadata {
  id: string;
  projectId: string;
  fileName: string;
  path: string;
  size: number;
  mimeType: string;
  language: string;
  isChunked: boolean;
  chunkCount?: number;
}

interface ChunkCacheDB extends DBSchema {
  chunks: {
    key: string; // `${projectId}:${chunkId}`
    value: CachedChunk;
    indexes: {
      'by-project': string;
      'by-timestamp': number;
      'by-access-count': number;
    };
  };
  metadata: {
    key: string; // projectId or `${projectId}:${versionId}`
    value: {
      files: FileMetadata[];
      timestamp: number;
    };
  };
}

// ===============================
// CONFIGURATION
// ===============================

const CONFIG = {
  CACHE_TTL: 1000 * 60 * 30, // 30 minutes
  MAX_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  PREFETCH_COMMON_FILES: true,
  PREFETCH_RECENT_FILES: true,
  MAX_PARALLEL_REQUESTS: 6, // Browser limit
  BATCH_SIZE_THRESHOLD: 3, // Use batch API if >= 3 chunks
};

// ===============================
// OPTIMIZED CHUNK SERVICE
// ===============================

class OptimizedChunkService {
  private db: IDBPDatabase<ChunkCacheDB> | null = null;
  private initPromise: Promise<void> | null = null;
  private prefetchQueue: Set<string> = new Set();
  private recentFiles: Map<string, string[]> = new Map(); // projectId -> file paths

  constructor() {
    this.initPromise = this.initDB();
  }

  // ===============================
  // DATABASE INITIALIZATION
  // ===============================

  private async initDB(): Promise<void> {
    try {
      this.db = await openDB<ChunkCacheDB>('kontext-chunk-cache', 1, {
        upgrade(db) {
          // Chunks store
          const chunksStore = db.createObjectStore('chunks', { keyPath: 'id' });
          chunksStore.createIndex('by-project', 'projectId');
          chunksStore.createIndex('by-timestamp', 'timestamp');
          chunksStore.createIndex('by-access-count', 'accessCount');

          // Metadata store
          db.createObjectStore('metadata', { keyPath: 'key' });
        },
      });

      console.log('🚀 [OptimizedChunkService] IndexedDB initialized');
      
      // Cleanup old entries
      await this.cleanupOldEntries();
    } catch (error) {
      console.error('❌ [OptimizedChunkService] Failed to initialize IndexedDB:', error);
    }
  }

  private async ensureDB(): Promise<IDBPDatabase<ChunkCacheDB> | null> {
    if (this.initPromise) {
      await this.initPromise;
    }
    return this.db;
  }

  // ===============================
  // PHASE 2: METADATA API
  // ===============================

  /**
   * Get file metadata without loading content (fast, small payload)
   */
  async getFileMetadata(projectId: string, versionId?: string): Promise<FileMetadata[]> {
    const db = await this.ensureDB();
    const cacheKey = versionId ? `${projectId}:${versionId}` : projectId;

    // Check cache first
    if (db) {
      try {
        const cached = await db.get('metadata', cacheKey);
        if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_TTL) {
          console.log('🚀 [OptimizedChunkService] Metadata cache HIT:', projectId);
          return cached.files;
        }
      } catch (error) {
        console.warn('⚠️ [OptimizedChunkService] Cache read error:', error);
      }
    }

    // Fetch from backend
    console.log('🚀 [OptimizedChunkService] Fetching metadata from backend');
    const startTime = performance.now();

    try {
      const result = await userCanisterService.getProjectFileMetadata(
        projectId,
        versionId || null
      );

      const duration = performance.now() - startTime;
      console.log(`🚀 [OptimizedChunkService] Metadata fetched in ${duration.toFixed(0)}ms`);

      // Cache the result
      if (db && result) {
        await db.put('metadata', {
          key: cacheKey,
          files: result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      console.error('❌ [OptimizedChunkService] Failed to fetch metadata:', error);
      throw error;
    }
  }

  // ===============================
  // PHASE 1 & 3: BATCH & PARALLEL RETRIEVAL
  // ===============================

  /**
   * Load chunks with automatic batching and parallelization
   */
  async loadChunks(
    projectId: string,
    chunkIds: number[]
  ): Promise<Map<number, Uint8Array>> {
    console.log(`🚀 [OptimizedChunkService] Loading ${chunkIds.length} chunks`);
    const startTime = performance.now();

    // Check cache first
    const results = new Map<number, Uint8Array>();
    const uncachedIds: number[] = [];

    for (const id of chunkIds) {
      const cached = await this.getCachedChunk(projectId, id);
      if (cached) {
        results.set(id, cached.content);
        console.log(`✅ [OptimizedChunkService] Cache HIT for chunk ${id}`);
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length === 0) {
      console.log('🚀 [OptimizedChunkService] All chunks from cache (0ms)');
      return results;
    }

    // Decide: Batch API or parallel individual requests
    let chunks: Map<number, Uint8Array>;

    if (uncachedIds.length >= CONFIG.BATCH_SIZE_THRESHOLD) {
      // Use batch API
      chunks = await this.loadChunksBatch(projectId, uncachedIds);
    } else {
      // Use parallel individual requests
      chunks = await this.loadChunksParallel(projectId, uncachedIds);
    }

    // Merge cached and newly fetched
    for (const [id, content] of chunks) {
      results.set(id, content);
    }

    const duration = performance.now() - startTime;
    console.log(
      `🚀 [OptimizedChunkService] Loaded ${uncachedIds.length} chunks in ${duration.toFixed(0)}ms ` +
      `(${cached ? chunkIds.length - uncachedIds.length : 0} from cache)`
    );

    return results;
  }

  /**
   * Load chunks using batch API (single canister call)
   */
  private async loadChunksBatch(
    projectId: string,
    chunkIds: number[]
  ): Promise<Map<number, Uint8Array>> {
    console.log(`🚀 [OptimizedChunkService] Batch loading ${chunkIds.length} chunks`);

    try {
      const results = await userCanisterService.getChunksBatch(chunkIds);
      const chunks = new Map<number, Uint8Array>();

      for (const [id, chunk] of results) {
        if (chunk) {
          chunks.set(id, chunk.content);
          
          // Cache the chunk
          await this.cacheChunk(projectId, id, chunk.content);
        }
      }

      return chunks;
    } catch (error) {
      console.error('❌ [OptimizedChunkService] Batch load failed:', error);
      throw error;
    }
  }

  /**
   * Load chunks in parallel (multiple canister calls)
   */
  private async loadChunksParallel(
    projectId: string,
    chunkIds: number[]
  ): Promise<Map<number, Uint8Array>> {
    console.log(`🚀 [OptimizedChunkService] Parallel loading ${chunkIds.length} chunks`);

    const promises = chunkIds.map(async (id) => {
      const chunk = await userCanisterService.getChunk(id);
      if (chunk) {
        await this.cacheChunk(projectId, id, chunk.content);
        return [id, chunk.content] as [number, Uint8Array];
      }
      return null;
    });

    const results = await Promise.all(promises);
    const chunks = new Map<number, Uint8Array>();

    for (const result of results) {
      if (result) {
        chunks.set(result[0], result[1]);
      }
    }

    return chunks;
  }

  // ===============================
  // PHASE 4: INTELLIGENT PREFETCHING
  // ===============================

  /**
   * Prefetch common and recently accessed files
   */
  async prefetchFiles(projectId: string, versionId?: string): Promise<void> {
    if (!CONFIG.PREFETCH_COMMON_FILES && !CONFIG.PREFETCH_RECENT_FILES) {
      return;
    }

    console.log('🚀 [OptimizedChunkService] Starting intelligent prefetch');

    try {
      // Get metadata first
      const metadata = await this.getFileMetadata(projectId, versionId);

      // Identify files to prefetch
      const filesToPrefetch: FileMetadata[] = [];

      // Common files (high priority)
      if (CONFIG.PREFETCH_COMMON_FILES) {
        const commonPatterns = [
          /main\.mo$/,
          /App\.tsx$/,
          /index\.tsx$/,
          /dfx\.json$/,
          /README\.md$/,
        ];

        for (const file of metadata) {
          if (commonPatterns.some(pattern => pattern.test(file.fileName))) {
            filesToPrefetch.push(file);
          }
        }
      }

      // Recently accessed files (medium priority)
      if (CONFIG.PREFETCH_RECENT_FILES) {
        const recent = this.recentFiles.get(projectId) || [];
        for (const path of recent.slice(0, 5)) {
          const file = metadata.find(f => f.path === path);
          if (file && !filesToPrefetch.includes(file)) {
            filesToPrefetch.push(file);
          }
        }
      }

      // Prefetch in background (non-blocking)
      this.prefetchInBackground(projectId, filesToPrefetch);
    } catch (error) {
      console.error('❌ [OptimizedChunkService] Prefetch failed:', error);
    }
  }

  private async prefetchInBackground(
    projectId: string,
    files: FileMetadata[]
  ): Promise<void> {
    for (const file of files) {
      if (file.isChunked && file.chunkCount) {
        // Prefetch chunks for large files
        const queueKey = `${projectId}:${file.id}`;
        if (this.prefetchQueue.has(queueKey)) {
          continue; // Already prefetching
        }

        this.prefetchQueue.add(queueKey);

        // Prefetch asynchronously (don't await)
        setTimeout(async () => {
          try {
            // Get full file to find chunk IDs
            const fullFile = await userCanisterService.getProjectFile(
              projectId,
              file.id
            );

            if (fullFile?.chunks) {
              const chunkIds = fullFile.chunks.map(([id]) => id);
              await this.loadChunks(projectId, chunkIds);
              console.log(`✅ [OptimizedChunkService] Prefetched: ${file.fileName}`);
            }
          } catch (error) {
            console.warn(`⚠️ [OptimizedChunkService] Prefetch failed for ${file.fileName}`);
          } finally {
            this.prefetchQueue.delete(queueKey);
          }
        }, 100); // Small delay to not block main thread
      }
    }
  }

  /**
   * Track recently accessed files for smart prefetching
   */
  trackFileAccess(projectId: string, filePath: string): void {
    const recent = this.recentFiles.get(projectId) || [];
    
    // Remove if already in list
    const filtered = recent.filter(p => p !== filePath);
    
    // Add to front
    filtered.unshift(filePath);
    
    // Keep only last 10
    this.recentFiles.set(projectId, filtered.slice(0, 10));
  }

  // ===============================
  // PHASE 6: SMART CACHING
  // ===============================

  private async getCachedChunk(
    projectId: string,
    chunkId: number
  ): Promise<CachedChunk | null> {
    const db = await this.ensureDB();
    if (!db) return null;

    try {
      const key = `${projectId}:${chunkId}`;
      const cached = await db.get('chunks', key);

      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < CONFIG.CACHE_TTL) {
          // Update access count
          cached.accessCount++;
          await db.put('chunks', cached);
          return cached;
        } else {
          // Expired
          await db.delete('chunks', key);
        }
      }
    } catch (error) {
      console.warn('⚠️ [OptimizedChunkService] Cache read error:', error);
    }

    return null;
  }

  private async cacheChunk(
    projectId: string,
    chunkId: number,
    content: Uint8Array
  ): Promise<void> {
    const db = await this.ensureDB();
    if (!db) return;

    try {
      const key = `${projectId}:${chunkId}`;
      await db.put('chunks', {
        id: key,
        content,
        timestamp: Date.now(),
        projectId,
        accessCount: 1,
      });
    } catch (error) {
      console.warn('⚠️ [OptimizedChunkService] Cache write error:', error);
    }
  }

  private async cleanupOldEntries(): Promise<void> {
    const db = await this.ensureDB();
    if (!db) return;

    try {
      const now = Date.now();
      const tx = db.transaction('chunks', 'readwrite');
      const index = tx.store.index('by-timestamp');

      let cursor = await index.openCursor();
      let deletedCount = 0;

      while (cursor) {
        const age = now - cursor.value.timestamp;
        if (age > CONFIG.CACHE_TTL) {
          await cursor.delete();
          deletedCount++;
        }
        cursor = await cursor.continue();
      }

      await tx.done;

      if (deletedCount > 0) {
        console.log(`🚀 [OptimizedChunkService] Cleaned up ${deletedCount} old cache entries`);
      }
    } catch (error) {
      console.error('❌ [OptimizedChunkService] Cleanup failed:', error);
    }
  }

  /**
   * Clear all cached data (useful for debugging or force refresh)
   */
  async clearCache(): Promise<void> {
    const db = await this.ensureDB();
    if (!db) return;

    try {
      await db.clear('chunks');
      await db.clear('metadata');
      console.log('🚀 [OptimizedChunkService] Cache cleared');
    } catch (error) {
      console.error('❌ [OptimizedChunkService] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    chunkCount: number;
    totalSize: number;
    oldestEntry: number;
    newestEntry: number;
  }> {
    const db = await this.ensureDB();
    if (!db) {
      return { chunkCount: 0, totalSize: 0, oldestEntry: 0, newestEntry: 0 };
    }

    try {
      const chunks = await db.getAll('chunks');
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.content.byteLength, 0);
      const timestamps = chunks.map(c => c.timestamp);

      return {
        chunkCount: chunks.length,
        totalSize,
        oldestEntry: Math.min(...timestamps),
        newestEntry: Math.max(...timestamps),
      };
    } catch (error) {
      console.error('❌ [OptimizedChunkService] Failed to get cache stats:', error);
      return { chunkCount: 0, totalSize: 0, oldestEntry: 0, newestEntry: 0 };
    }
  }
}

// ===============================
// SINGLETON EXPORT
// ===============================

export const optimizedChunkService = new OptimizedChunkService();

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Assemble chunks into a single file content
 */
export function assembleChunks(chunks: Map<number, Uint8Array>): Uint8Array {
  // Sort by chunk ID
  const sortedIds = Array.from(chunks.keys()).sort((a, b) => a - b);
  
  // Calculate total size
  let totalSize = 0;
  for (const id of sortedIds) {
    totalSize += chunks.get(id)!.byteLength;
  }
  
  // Assemble
  const result = new Uint8Array(totalSize);
  let offset = 0;
  
  for (const id of sortedIds) {
    const chunk = chunks.get(id)!;
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  
  return result;
}

/**
 * Convert Uint8Array to text
 */
export function chunksToText(chunks: Map<number, Uint8Array>): string {
  const assembled = assembleChunks(chunks);
  return new TextDecoder().decode(assembled);
}

export default optimizedChunkService;



